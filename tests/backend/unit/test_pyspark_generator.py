"""Unit tests for PySpark code generator functionality."""
import unittest
import sys
import os

# Add project root to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from src.code_generator.pyspark_generator import generate_pyspark_code


class TestPySparkGenerator(unittest.TestCase):
    """Test suite for PySpark code generation from DSL."""

    def test_basic_code_generation(self):
        """Test basic code generation structure."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/test_data.csv",
                "format": "csv",
                "has_header": True,
            },
            "rules": [],
        }
        code = generate_pyspark_code(dsl)
        self.assertIsInstance(code, str)
        self.assertIn("SparkSession.builder", code)
        self.assertIn('appName("DataQualityValidation_test_data")', code)
        self.assertIn('spark.read.format("csv")', code)
        self.assertIn("spark.stop()", code)

    def test_not_null_rule(self):
        """Test not_null rule code generation."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/data.csv",
                "format": "csv",
            },
            "rules": [{"type": "not_null", "column": "id"}],
        }
        code = generate_pyspark_code(dsl)
        self.assertIn('df.filter(col("id").isNull())', code)
        self.assertIn("Checking not_null for column: id", code)

    def test_uniqueness_rule(self):
        """Test uniqueness rule code generation."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/data.csv",
                "format": "csv",
            },
            "rules": [{"type": "uniqueness", "columns": ["id", "email"]}],
        }
        code = generate_pyspark_code(dsl)
        self.assertIn(
            "df.groupBy('id', 'email').count().filter(col(\"count\") > 1)", code
        )
        self.assertIn("Checking uniqueness for columns: 'id', 'email'", code)

    def test_format_rule_date(self):
        """Test date format rule code generation."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/data.csv",
                "format": "csv",
            },
            "rules": [
                {"type": "format", "column": "event_date", "format": "YYYY-MM-DD"}
            ],
        }
        code = generate_pyspark_code(dsl)
        self.assertIn('to_date(col("event_date"), "yyyy-MM-dd").isNull()', code)
        self.assertIn("Checking date format 'YYYY-MM-DD' for column: event_date", code)

    def test_range_rule(self):
        """Test range rule code generation."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/data.csv",
                "format": "csv",
            },
            "rules": [{"type": "range", "column": "age", "min": 18, "max": 65}],
        }
        code = generate_pyspark_code(dsl)
        # A asserção anterior exigia `col("age") < 18.0 | col("age") > 65.0`,
        # que é o DEFEITO relatado em 2026-11-19: em Python o `|` tem
        # precedência maior que `<` e `>`, então aquilo era lido como
        # `col("age") < (18.0 | col("age")) > 65.0`. O teste protegia o bug.
        self.assertIn("(valores < 18.0) | (valores > 65.0)", code)
        self.assertIn('valores = as_number("age")', code)
        self.assertIn("Checking range [18.0, 65.0] for column: age", code)

    def test_in_set_rule(self):
        """Test in_set rule code generation."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/data.csv",
                "format": "csv",
            },
            "rules": [
                {"type": "in_set", "column": "status", "values": ["active", "inactive"]}
            ],
        }
        code = generate_pyspark_code(dsl)
        # A lista passou a ser um literal nomeado: interpolada na mensagem,
        # um valor com aspa ("O'Brien") fechava o literal e gerava script
        # inválido.
        self.assertIn("valores_aceitos = ['active', 'inactive']", code)
        self.assertIn('~col("status").isin(*valores_aceitos)', code)
        self.assertIn('col("status").isNotNull()', code)

    def test_regex_rule(self):
        """Test regex pattern rule code generation."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/data.csv",
                "format": "csv",
            },
            "rules": [
                {
                    "type": "regex",
                    "column": "email",
                    "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                }
            ],
        }
        code = generate_pyspark_code(dsl)
        # `rlike` BUSCA o padrão em vez de casar a string inteira, então um
        # padrão sem âncora aceitava lixo em volta. O gerador agora reenvolve
        # em `^(?:...)$` — as âncoras já presentes não são duplicadas.
        self.assertIn(
            '~col("email").rlike("^(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,})$")',
            code,
        )
        # A mensagem é uma f-string no código gerado, então as chaves do
        # quantificador precisam estar duplicadas NA FONTE para sairem como
        # `{2,}` na execução. Sem isso, `{2,}` era lido como campo de
        # formatação e a mensagem saía errada.
        self.assertIn(
            "Checking regex pattern '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{{2,}}$' for column: email",
            code,
        )

    def test_value_distribution_rule(self):
        """Test value distribution rule code generation."""
        dsl = {
            "dataset": {
                "name": "test_data",
                "source": "/path/to/data.csv",
                "format": "csv",
            },
            "rules": [
                {
                    "type": "value_distribution",
                    "column": "category",
                    "value": "A",
                    "min_freq": 0.2,
                    "max_freq": 0.4,
                }
            ],
        }
        code = generate_pyspark_code(dsl)
        self.assertIn('value_count = df.filter(col("category") == "A").count()', code)
        self.assertIn("if 0.2 <= actual_freq <= 0.4:", code)
        self.assertIn(
            "Checking value distribution for column 'category' (value: 'A', min_freq: 0.2, max_freq: 0.4)",
            code,
        )


if __name__ == "__main__":
    unittest.main()
