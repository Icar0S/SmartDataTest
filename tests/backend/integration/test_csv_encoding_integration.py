"""Integration test for CSV encoding and delimiter auto-detection.

This test verifies that the system can correctly handle CSV files with:
- Non-UTF8 encodings (like latin-1/ISO-8859-1)
- Tab delimiters
- Special characters (Portuguese accents)
- Many columns (40+)
"""

import unittest
import tempfile
import os
import sys

# Add project root to path
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
)

from src.dataset_inspector.inspector import inspect_csv
from src.dataset_inspector.dsl_generator import generate_dsl_from_metadata
from src.code_generator.pyspark_generator import generate_pyspark_code


class TestCSVEncodingIntegration(unittest.TestCase):
    """Integration tests for CSV encoding and delimiter auto-detection."""

    def test_latin1_encoding_with_special_chars(self):
        """Test auto-detection of latin-1 encoded CSV with Portuguese characters."""
        # Create CSV with Portuguese special characters
        csv_content = "Ano\tMês\tUF\tValor\n2000\tJaneiro\tAC\t1000\n"

        with tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False) as f:
            f.write(csv_content.encode("latin-1"))
            temp_path = f.name

        try:
            # Test auto-detection (no encoding specified)
            result = inspect_csv(temp_path, {})

            # Verify correct detection (chardet may return ISO-8859-1, WINDOWS-1252,
            # windows-1252, or latin-1 depending on version/platform; compare lowercase)
            detected_enc = result["detected_options"]["encoding"]
            self.assertIn(
                detected_enc.lower(), ["iso-8859-1", "windows-1252", "latin-1"]
            )
            self.assertEqual(result["detected_options"]["delimiter"], "\t")
            self.assertEqual(len(result["columns"]), 4)

            # Verify special characters were decoded correctly
            column_names = [col["name"] for col in result["columns"]]
            self.assertIn("Mês", column_names)

        finally:
            os.unlink(temp_path)

    def test_many_columns_csv(self):
        """Test CSV with many columns (44 like the problem statement)."""
        columns = [
            "Ano",
            "Mês",
            "UF",
            "IMPOSTO SOBRE IMPORTAÇÃO",
            "IMPOSTO SOBRE EXPORTAÇÃO",
            "IPI - FUMO",
            "IPI - BEBIDAS",
            "IPI - AUTOMÓVEIS",
            "IPI - VINCULADO À IMPORTACAO",
            "IPI - OUTROS",
            "IRPF",
            "IRPJ - ENTIDADES FINANCEIRAS",
            "IRPJ - DEMAIS EMPRESAS",
            "IRRF - RENDIMENTOS DO TRABALHO",
            "IRRF - RENDIMENTOS DO CAPITAL",
            "IRRF - REMESSAS P/ EXTERIOR",
            "IRRF - OUTROS RENDIMENTOS",
            "IMPOSTO S/ OPERAÇÕES FINANCEIRAS",
            "IMPOSTO TERRITORIAL RURAL",
            "IMPOSTO PROVIS.S/ MOVIMENT. FINANC. - IPMF",
            "CPMF",
            "COFINS",
            "COFINS - FINANCEIRAS",
            "COFINS - DEMAIS",
            "CONTRIBUIÇÃO PARA O PIS/PASEP",
            "CONTRIBUIÇÃO PARA O PIS/PASEP - FINANCEIRAS",
            "CONTRIBUIÇÃO PARA O PIS/PASEP - DEMAIS",
            "CSLL",
            "CSLL - FINANCEIRAS",
            "CSLL - DEMAIS",
            "CIDE-COMBUSTÍVEIS (parc. não dedutível)",
            "CIDE-COMBUSTÍVEIS",
            "CONTRIBUIÇÃO PLANO SEG. SOC. SERVIDORES",
            "CPSSS - Contrib. p/ o Plano de Segurid. Social Serv. Público",
            "CONTRIBUICÕES PARA FUNDAF",
            "REFIS",
            "PAES",
            "RETENÇÃO NA FONTE - LEI 10.833, Art. 30",
            "PAGAMENTO UNIFICADO",
            "OUTRAS RECEITAS ADMINISTRADAS",
            "DEMAIS RECEITAS",
            "RECEITA PREVIDENCIÁRIA",
            "RECEITA PREVIDENCIÁRIA - PRÓPRIA",
            "RECEITA PREVIDENCIÁRIA - DEMAIS",
        ]

        header = "\t".join(columns)
        data = "\t".join(["2000", "Janeiro", "AC"] + ["0"] * 41)
        csv_content = header + "\n" + data + "\n"

        with tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False) as f:
            f.write(csv_content.encode("latin-1"))
            temp_path = f.name

        try:
            result = inspect_csv(temp_path, {})

            # Verify all 44 columns were detected
            self.assertEqual(len(result["columns"]), 44)
            self.assertEqual(result["detected_options"]["delimiter"], "\t")

            # Verify first and last columns
            self.assertEqual(result["columns"][0]["name"], "Ano")
            self.assertEqual(
                result["columns"][-1]["name"], "RECEITA PREVIDENCIÁRIA - DEMAIS"
            )

        finally:
            os.unlink(temp_path)

    def test_end_to_end_code_generation(self):
        """Test complete flow: inspect -> DSL -> PySpark code."""
        csv_content = "Ano\tMês\tUF\n2000\tJaneiro\tAC\n"

        with tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False) as f:
            f.write(csv_content.encode("latin-1"))
            temp_path = f.name

        try:
            # Step 1: Inspect
            metadata = inspect_csv(temp_path, {})

            # Step 2: Generate DSL
            user_edits = {"dataset_name": "test_dataset"}
            dsl = generate_dsl_from_metadata(metadata, user_edits)

            # Verify DSL contains detected options
            self.assertIn("detected_options", dsl["dataset"])
            detected_enc = dsl["dataset"]["detected_options"]["encoding"]
            self.assertIn(
                detected_enc.lower(), ["iso-8859-1", "windows-1252", "latin-1"]
            )
            self.assertEqual(dsl["dataset"]["detected_options"]["delimiter"], "\t")

            # Step 3: Generate PySpark code
            code = generate_pyspark_code(dsl)

            # Verify code contains the detected options
            self.assertIn(detected_enc, code)
            self.assertIn('.option("encoding"', code)
            self.assertIn('.option("delimiter"', code)
            self.assertIn("findspark.init()", code)  # Verify Colab compatibility
            self.assertIn("files.upload()", code)  # Verify file upload

        finally:
            os.unlink(temp_path)

    def test_utf8_csv_still_works(self):
        """Test that UTF-8 CSVs still work correctly."""
        csv_content = "Name,Age,City\nJohn,30,NYC\n"

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write(csv_content)
            temp_path = f.name

        try:
            result = inspect_csv(temp_path, {})

            # Should detect UTF-8 or ASCII
            self.assertIn(
                result["detected_options"]["encoding"].lower(), ["utf-8", "ascii"]
            )
            self.assertEqual(result["detected_options"]["delimiter"], ",")
            self.assertEqual(len(result["columns"]), 3)

        finally:
            os.unlink(temp_path)


if __name__ == "__main__":
    unittest.main()
