"""PySpark code generator module for converting DSL to executable PySpark code."""

# PySpark imports are used in the generated code strings
# These imports are not directly used in the generator function
# but are included in the generated code output


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
from pyspark.sql.functions import col, lit, to_date, regexp_extract, array_contains, countDistinct
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
            range_condition = []
            if min_val is not None:
                range_condition.append(f'col("{column}") < {min_val}')
            if max_val is not None:
                range_condition.append(f'col("{column}") > {max_val}')

            if range_condition:
                # Add floating point for numeric literals to match test expectations
                def add_float_literal(val):
                    if val is not None and isinstance(val, (int, float)):
                        return str(float(val))
                    return str(val)

                range_condition = []
                if min_val is not None:
                    range_condition.append(f'col("{column}") < {add_float_literal(min_val)}')
                if max_val is not None:
                    range_condition.append(f'col("{column}") > {add_float_literal(max_val)}')

                condition_str = " | ".join(range_condition)
                code += f"""
print(f"\\nChecking range [{add_float_literal(min_val) if min_val is not None else '-inf'}, {add_float_literal(max_val) if max_val is not None else 'inf'}] for column: {column}")
if check_column_exists(df, "{column}"):
    failed_range = df.filter({condition_str})
    all_failed_records = run_check(f"range_{column}", failed_range, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
        elif rule_type == "in_set":
            values = rule.get("values", [])
            values_str = ", ".join([f"'{v}'" for v in values])
            code += f"""
print(f"\\nChecking values in set [{values_str}] for column: {column}")
if check_column_exists(df, "{column}"):
    failed_in_set = df.filter(~col("{column}").isin({values_str}))
    all_failed_records = run_check(f"in_set_{column}", failed_in_set, all_failed_records)
else:
    print(f"  SKIPPED: Column '{column}' not found in dataset")
"""
        elif rule_type == "regex":
            pattern = rule.get("pattern")
            if not pattern:
                continue  # Skip if no pattern specified
            # Handle backslash escaping for regex patterns
            escaped_pattern = pattern.replace("\\", "\\\\")
            code += f"""
print(f"\\nChecking regex pattern '{pattern}' for column: {column}")
if check_column_exists(df, "{column}"):
    failed_regex = df.filter(~col("{column}").rlike("{escaped_pattern}"))
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
    failed_comparison = df.filter(~(col("{col1}") {operator} col("{col2}")))
    all_failed_records = run_check(f"cross_column_{col1}_{operator}_{col2}", failed_comparison, all_failed_records)
else:
    print(f"  SKIPPED: One or both columns not found in dataset")
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
