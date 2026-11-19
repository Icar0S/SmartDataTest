"""PySpark code generator module for converting DSL to executable PySpark code."""

# PySpark imports are used in the generated code strings
# These imports are not directly used in the generator function
# but are included in the generated code output


def _anchor_regex(pattern: str) -> str:
    """Transforma um padrão de busca em casamento total.

    `rlike` do Spark procura o padrão em QUALQUER posição da string, então
    `^\\d{3}$` valida, mas `\\d{3}` aceita "abc123xyz". Como o padrão foi
    escrito para descrever um campo, ele deve casar o campo inteiro.

    Âncoras já presentes são removidas antes de reenvolver, para não gerar
    `^(?:^...$)$`, que funciona mas é ilegível para quem lê o script.
    """
    p = (pattern or "").strip()
    if p.startswith("^"):
        p = p[1:]
    # `\$` é um cifrão literal, não âncora — não pode ser removido.
    if p.endswith("$") and not p.endswith("\\$"):
        p = p[:-1]
    return f"^(?:{p})$"


# Como cada tipo declarado é verificado no código gerado. A expressão à
# direita devolve NULL quando o valor NÃO é daquele tipo, e é essa nulidade
# que a regra trata como falha.
_CONVERSORES_DE_TIPO = {
    "integer": ('col("{c}").cast("long")', "integer"),
    "float": ('as_number("{c}")', "number"),
    "date": ('as_date("{c}")', "date"),
    "timestamp": ('as_timestamp("{c}")', "timestamp"),
    "boolean": ('col("{c}").cast("boolean")', "boolean"),
}


def generate_pyspark_code(dsl):
    """Generates PySpark code from the DSL and formats it for Google Colab."""
    dataset_name = dsl.get("dataset", {}).get("name", "data")
    data_format = dsl.get("dataset", {}).get("format", "").lower()
    has_header = dsl.get("dataset", {}).get("has_header", False)

    # Get detected options (encoding and delimiter)
    detected_options = dsl.get("dataset", {}).get("detected_options", {})
    encoding = detected_options.get("encoding", "utf-8")
    delimiter = detected_options.get("delimiter", ",")

    # Initialize the code with Colab setup and helper functions
    code = """# Data Quality Validation Script
# After installation above, run this cell.
# You will be prompted to upload your data file.
# =================================================================

import os
import findspark
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    abs as spark_abs, coalesce, col, countDistinct, expr, lit, to_date, to_timestamp,
)
from google.colab import files

# Initialize findspark to locate Spark installation
findspark.init()

# 1. Create SparkSession for Colab environment
spark = SparkSession.builder \\
    .appName("DataQualityValidation_{dataset_name}") \\
    .master("local[*]") \\
    .getOrCreate()

# Helper function to avoid code repetition
def run_check(check_name, failed_df, all_failed_records_list):
    \"\"\"Execute failure count and display results.\"\"\"
    failed_count = failed_df.count()
    if failed_count > 0:
        print(f"  FAIL: {{failed_count}} records violated the rule.")
        print("  Sample of failing records:")
        failed_df.limit(5).show(truncate=False)
        all_failed_records_list.append((check_name, failed_count))
    else:
        print(f"  SUCCESS: All records passed the check.")
    return all_failed_records_list

# 2. Upload the data file to Colab environment
print("Please upload your {data_format_upper} file")
uploaded = files.upload()

# Get the uploaded file name
try:
    file_name = next(iter(uploaded))
    print(f"\\nFile '{{file_name}}' received successfully!")
except StopIteration:
    print("No file was uploaded. Ending script.")
    spark.stop()
    exit()

# List to collect all failure records for summary
all_failed_records = []

# 3. Read data from file
# Detect file format from extension
file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
print(f"\\nReading data from '{{file_name}}' (detected format: {{file_ext if file_ext else 'unknown'}})")

# Display auto-detected settings for CSV files
if file_ext == "csv":
    print("CSV Reading Configuration:")
    print(f"  - Delimiter: '{delimiter}' (auto-detected)")
    print(f"  - Encoding: '{encoding}' (auto-detected)")
    print(f"  - Header: {has_header}")

try:
    if not file_ext:
        print(f"Error: Unable to detect file format. File has no extension.")
        spark.stop()
        exit(1)
    elif file_ext == "csv":
        df = spark.read.format("csv") \\
            .option("header", "{has_header}") \\
            .option("inferSchema", "true") \\
            .option("delimiter", "{delimiter}") \\
            .option("encoding", "{encoding}") \\
            .load(file_name)
    elif file_ext in ["json", "jsonl"]:
        df = spark.read.json(file_name)
    elif file_ext == "parquet":
        df = spark.read.parquet(file_name)
    elif file_ext == "delta":
        df = spark.read.format("delta").load(file_name)
    else:
        print(f"Unsupported file extension: '{{file_ext}}'. Please ensure your file has a valid extension (.csv, .json, .parquet, .delta).")
        spark.stop()
        exit(1)
except Exception as e:
    print(f"Error reading data: {{e}}")
    print(f"Hint: Check if the file delimiter is '{delimiter}' and encoding is '{encoding}'")
    spark.stop()
    exit(1)

print(f"Data loaded successfully. Total records: {{df.count()}}")
print(f"Columns found: {{len(df.columns)}}")
print("\\nData schema:")
df.printSchema()
print(f"\\nColumn names: {{df.columns}}")

# Helper function to check if column exists
def check_column_exists(df, column_name):
    \"\"\"Check if a column exists in the DataFrame.\"\"\"
    if column_name not in df.columns:
        print(f"  WARNING: Column '{{column_name}}' not found in dataset. Available columns: {{df.columns}}")
        return False
    return True

# ----------------------------------------------------------------------
# Type helpers
#
# Spark reads a CSV column as string whenever ANY row in it is not numeric.
# Comparing that column against a number then casts it silently, and a row
# holding "abc" becomes NULL — which no comparison matches, so the offending
# row disappears from every check instead of failing it. That is why putting
# text in a numeric column used to pass unnoticed.
#
# as_number() makes the cast explicit so the rules below can treat
# "not a number" as a FAILURE rather than as absence of data.
# ----------------------------------------------------------------------
def as_number(column_name):
    \"\"\"Column cast to double; NULL when the text is not a number.\"\"\"
    return col(column_name).cast("double")

# Date formats tried when validating a date column, in order. The first one
# that parses wins; a value none of them parse is reported as a failure.
DATE_FORMATS = [
    "yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy/MM/dd",
    "dd-MM-yyyy", "MM-dd-yyyy", "yyyyMMdd",
]

def as_date(column_name):
    \"\"\"Column parsed with any known date format; NULL when none applies.\"\"\"
    return coalesce(*[to_date(col(column_name), f) for f in DATE_FORMATS])

def as_timestamp(column_name):
    \"\"\"Column parsed as timestamp; NULL when it does not parse.\"\"\"
    return coalesce(
        to_timestamp(col(column_name)),
        *[to_timestamp(col(column_name), f) for f in DATE_FORMATS],
    )

# ================================================================
# 4. Applying Data Quality Rules
# ================================================================
print("\\n--- Applying Data Quality Rules ---")
""".format(
        dataset_name=dataset_name,
        data_format_upper=data_format.upper(),
        data_format=data_format,
        has_header=str(has_header).lower(),
        encoding=encoding,
        delimiter=delimiter,
    )

    # Process each rule
    for rule in dsl.get("rules", []):
        rule_type = rule.get("type")
        column = rule.get("column")
        columns = rule.get("columns")  # For uniqueness rule

        if rule_type == "not_null":
            code += f"""
print(f"\\nChecking not_null for column: {column}")
if check_column_exists(df, "{column}"):
    failed_not_null = df.filter(col("{column}").isNull())
    all_failed_records = run_check(f"null_{column}", failed_not_null, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
        elif rule_type == "uniqueness":
            if not columns:
                continue  # Skip if no columns specified
            cols_str = ", ".join([f"'{c}'" for c in columns])
            cols_check = " and ".join([f'check_column_exists(df, "{c}")' for c in columns])
            code += f"""
print(f"\\nChecking uniqueness for columns: {cols_str}")
if {cols_check}:
    failed_uniqueness = df.groupBy({cols_str}).count().filter(col("count") > 1)
    all_failed_records = run_check(f"uniqueness_{'_'.join(columns)}", failed_uniqueness, all_failed_records)
else:
    print(f"  SKIPPED: One or more columns not found in dataset")
"""
        elif rule_type == "format":
            fmt = rule.get("format")
            if not fmt:
                continue  # Skip if no format specified
            date_formats = {
                "YYYY-MM-DD": "yyyy-MM-dd",
                "MM-DD-YYYY": "MM-dd-yyyy",
                "DD/MM/YYYY": "dd/MM/yyyy",
                "YYYY/MM/DD": "yyyy/MM/dd",
            }
            spark_date_format = date_formats.get(fmt.upper())

            if spark_date_format:
                code += f"""
print(f"\\nChecking date format '{fmt}' for column: {column}")
if check_column_exists(df, "{column}"):
    failed_format = df.filter(to_date(col("{column}"), "{spark_date_format}").isNull() & col("{column}").isNotNull())
    all_failed_records = run_check(f"date_format_{column}", failed_format, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
            else:  # Generic format check using regex
                code += f"""
print(f"\\nChecking custom format (regex) '{fmt}' for column: {column}")
if check_column_exists(df, "{column}"):
    failed_format = df.filter(~col("{column}").rlike("{fmt}"))
    all_failed_records = run_check(f"format_{column}", failed_format, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""

        elif rule_type == "range":
            min_val = rule.get("min")
            max_val = rule.get("max")

            def add_float_literal(val):
                if val is not None and isinstance(val, (int, float)):
                    return str(float(val))
                return str(val)

            # PARÊNTESES EM CADA OPERANDO — não é estilo, é correção.
            #
            # Em Python o `|` tem precedência MAIOR que `<` e `>`, então
            #     col("q") < 1.0 | col("q") > 100.0
            # é lido como  col("q") < (1.0 | col("q")) > 100.0
            # e estoura na hora. Foi o erro relatado em 2026-11-19 nos três
            # datasets: "o código tenta limitar os valores da coluna Quantity
            # e usa do operador | sem parênteses", obrigando a corrigir o
            # script à mão antes de rodar.
            limites = []
            if min_val is not None:
                limites.append(f"(valores < {add_float_literal(min_val)})")
            if max_val is not None:
                limites.append(f"(valores > {add_float_literal(max_val)})")

            if limites:
                fora_do_intervalo = " | ".join(limites)
                faixa = (
                    f"[{add_float_literal(min_val) if min_val is not None else '-inf'}, "
                    f"{add_float_literal(max_val) if max_val is not None else 'inf'}]"
                )
                code += f"""
print(f"\\nChecking range {faixa} for column: {column}")
if check_column_exists(df, "{column}"):
    # `valores` é a coluna convertida para número: fica NULL quando o texto
    # não é numérico, e esse caso conta como FALHA — e não como ausência de
    # dado, que o filtro descartaria.
    valores = as_number("{column}")
    failed_range = df.filter(
        col("{column}").isNotNull()
        & (valores.isNull() | {fora_do_intervalo})
    )
    all_failed_records = run_check(f"range_{column}", failed_range, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
        elif rule_type == "in_set":
            values = rule.get("values", [])
            if not values:
                continue
            # Lista como literal numa variável, em vez de interpolada na
            # mensagem: um valor com aspa simples ("O'Brien") ou dupla
            # fechava o literal da própria mensagem e gerava script inválido.
            # repr() cuida das aspas; a mensagem só imprime a variável.
            values_str = "[" + ", ".join(repr(str(v)) for v in values) + "]"
            code += f"""
valores_aceitos = {values_str}
print(f"\\nChecking values in set {{valores_aceitos}} for column: {column}")
if check_column_exists(df, "{column}"):
    # isNotNull(): `~isin(...)` devolve NULL para linha nula, e NULL não
    # passa no filtro — sem esta guarda os nulos sumiriam do relatório em
    # vez de ficarem a cargo da regra de obrigatoriedade.
    failed_in_set = df.filter(col("{column}").isNotNull() & ~col("{column}").isin(*valores_aceitos))
    all_failed_records = run_check(f"in_set_{column}", failed_in_set, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
        elif rule_type == "regex":
            pattern = rule.get("pattern")
            if not pattern:
                continue  # Skip if no pattern specified
            anchored = _anchor_regex(pattern)
            # Handle backslash escaping for regex patterns
            escaped_pattern = anchored.replace("\\", "\\\\")
            # O padrão também entra na MENSAGEM, que é uma f-string: ali
            # `\d` seria escape inválido e `{7}` um campo de formatação —
            # a mensagem saía errada e o Python avisava a cada execução.
            pattern_exibicao = (
                pattern.replace("\\", "\\\\").replace("{", "{{").replace("}", "}}")
            )
            code += f"""
print(f"\\nChecking regex pattern '{pattern_exibicao}' for column: {column}")
if check_column_exists(df, "{column}"):
    # Padrão ancorado: `rlike` faz BUSCA, não casamento total, então
    # '[0-9]{{3}}' aceitaria "abc123xyz". Quem escreve um padrão para
    # validar um campo espera que ele descreva o campo inteiro.
    failed_regex = df.filter(col("{column}").isNotNull() & ~col("{column}").rlike("{escaped_pattern}"))
    all_failed_records = run_check(f"regex_{column}", failed_regex, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
        elif rule_type == "value_distribution":
            value = rule.get("value")
            min_freq = rule.get("min_freq")
            max_freq = rule.get("max_freq")
            code += f"""
print(f"\\nChecking value distribution for column '{column}' (value: '{value}', min_freq: {min_freq}, max_freq: {max_freq})")
if check_column_exists(df, "{column}"):
    total_count = df.count()
    value_count = df.filter(col("{column}") == "{value}").count()
    if total_count > 0:
        actual_freq = value_count / total_count
        if {min_freq} <= actual_freq <= {max_freq}:
            print(f"  SUCCESS: Value '{value}' in column '{column}' has frequency {{actual_freq:.4f}}, within range [{min_freq}, {max_freq}].")
        else:
            print(f"  FAIL: Value '{value}' in column '{column}' has frequency {{actual_freq:.4f}}, outside range [{min_freq}, {max_freq}].")
            all_failed_records.append((f"distribution_{column}_{value}", actual_freq))
    else:
        print(f"  WARNING: Dataset is empty, unable to check value distribution for column '{column}'.")
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
        elif rule_type == "cross_column_comparison":
            col1 = rule.get("column1")
            operator = rule.get("operator")
            col2 = rule.get("column2")

            code += f"""
print(f"\\nChecking cross-column comparison: {col1} {operator} {col2}")
if check_column_exists(df, "{col1}") and check_column_exists(df, "{col2}"):
    # Comparar só onde os dois lados existem: com um lado nulo a comparação
    # devolve NULL, o filtro a descarta, e a linha some do relatório em vez
    # de ser avaliada. Ausência de dado é assunto da regra de obrigatoriedade.
    failed_comparison = df.filter(
        col("{col1}").isNotNull()
        & col("{col2}").isNotNull()
        & ~(col("{col1}") {operator} col("{col2}"))
    )
    all_failed_records = run_check(f"cross_column_{col1}_{operator}_{col2}", failed_comparison, all_failed_records)
else:
    print(f"  SKIPPED: One or both columns not found in dataset")
"""

        elif rule_type == "column_type":
            expected = rule.get("expected_type")
            conversor = _CONVERSORES_DE_TIPO.get(expected)
            if not conversor:
                continue
            expressao, rotulo = conversor
            convertido = expressao.format(c=column)
            code += f"""
print(f"\\nChecking that column '{column}' holds {rotulo} values")
if check_column_exists(df, "{column}"):
    # O tipo declarado no checklist vira verificação de verdade. A conversão
    # devolve NULL para o que não é {rotulo}; linha preenchida que não
    # converte é um valor do tipo errado — o caso de texto em coluna
    # numérica, que antes passava batido.
    failed_type = df.filter(col("{column}").isNotNull() & ({convertido}).isNull())
    all_failed_records = run_check(f"type_{column}", failed_type, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""

        elif rule_type == "computed_comparison":
            expressao = rule.get("expression")
            if not column or not expressao:
                continue
            origem = rule.get("expression_source", expressao)
            tolerancia = rule.get("tolerance", 0.01)
            referenciadas = rule.get("referenced_columns") or []
            checagens = " and ".join(
                [f'check_column_exists(df, "{column}")']
                + [f'check_column_exists(df, "{c}")' for c in referenciadas]
            )
            expr_escapada = expressao.replace("\\", "\\\\").replace('"', '\\"')
            code += f"""
print(f"\\nChecking business rule: {column} = {origem}")
if {checagens}:
    # Tolerância em vez de igualdade exata: 19.99 * 3 dá 59.967000000000006
    # em ponto flutuante, e uma comparação exata reprovaria o dataset inteiro
    # por um erro de arredondamento que não existe nos dados.
    valor_declarado = as_number("{column}")
    valor_calculado = expr("{expr_escapada}").cast("double")
    failed_rule = df.filter(
        valor_declarado.isNotNull()
        & valor_calculado.isNotNull()
        & (spark_abs(valor_declarado - valor_calculado) > {tolerancia})
    )
    all_failed_records = run_check(f"business_rule_{column}", failed_rule, all_failed_records)

    # Linha em que a conta não pôde sequer ser feita é relatada à parte:
    # somada às violações, esconderia um problema de tipo atrás de um
    # problema de regra de negócio.
    nao_avaliaveis = df.filter(
        col("{column}").isNotNull()
        & (as_number("{column}").isNull() | expr("{expr_escapada}").cast("double").isNull())
    )
    nao_avaliaveis_count = nao_avaliaveis.count()
    if nao_avaliaveis_count > 0:
        print(f"  WARNING: {{nao_avaliaveis_count}} records could not be evaluated (non-numeric values).")
        all_failed_records.append(("business_rule_{column}_not_numeric", nao_avaliaveis_count))
else:
    print(f"  SKIPPED: One or more columns not found in dataset")
"""

    # Add final summary and cleanup
    code += """
# ================================================================
# 5. Data Quality Summary
# ================================================================
print("\\n\\n--- Data Quality Summary ---")
if all_failed_records:
    print("The following data quality rules failed:")
    for rule_name, failed_count in all_failed_records:
        print(f"- {rule_name}: {failed_count} failures")
else:
    print("[SUCCESS] All data quality rules passed!")

# 6. Finalize Spark Session
spark.stop()
print("\\nSpark session finalized.")
"""

    return code
