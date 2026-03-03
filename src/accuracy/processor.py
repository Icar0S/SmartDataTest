"""Data processing logic for Data Accuracy feature."""

import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd


def normalize_column_name(name: str) -> str:
    """Convert column name to snake_case."""
    # Remove leading/trailing whitespace
    name = name.strip()
    # Strip accents first
    name = strip_accents(name)
    # Replace spaces and hyphens with underscores
    name = re.sub(r"[\s\-]+", "_", name)
    # Remove special characters except underscores
    name = re.sub(r"[^\w]", "", name)
    # Convert to lowercase
    name = name.lower()
    return name


def strip_accents(text: str) -> str:
    """Remove accents from text."""
    if not isinstance(text, str):
        return text
    nfd = unicodedata.normalize("NFD", text)
    return "".join(char for char in nfd if unicodedata.category(char) != "Mn")


def normalize_key_value(value: Any, options: Dict[str, Any]) -> str:
    """Normalize a key value according to options."""
    if pd.isna(value):
        return ""

    text = str(value)

    # Trim
    text = text.strip()

    # Lowercase
    if options.get("lowercase", True):
        text = text.lower()

    # Strip accents
    if options.get("stripAccents", True):
        text = strip_accents(text)

    # Strip punctuation
    if options.get("stripPunctuation", True):
        text = re.sub(r"[^\w\s]", "", text)

    return text


def coerce_numeric(value: Any, options: Dict[str, Any]) -> Any:
    """Coerce value to numeric, handling various formats."""
    if pd.isna(value):
        return np.nan

    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()

    if options.get("coerceNumeric", True):
        # Remove thousands separators (. or ,)
        # Handle both European (1.234,56) and US (1,234.56) formats
        # First, check if there's a comma or period that could be decimal
        if "," in text and "." in text:
            # Both present - determine which is decimal separator
            last_comma = text.rfind(",")
            last_period = text.rfind(".")
            if last_comma > last_period:
                # European format: 1.234,56
                text = text.replace(".", "").replace(",", ".")
            else:
                # US format: 1,234.56
                text = text.replace(",", "")
        elif "," in text:
            # Only comma - could be thousands or decimal
            # If only one comma and 2-3 digits after, assume decimal
            parts = text.split(",")
            if len(parts) == 2 and len(parts[1]) <= 3 and "." not in text:
                text = text.replace(",", ".")
            else:
                text = text.replace(",", "")
        elif "." in text:
            # Only period - keep as decimal
            pass

    try:
        return float(text)
    except ValueError:
        return np.nan


def read_dataset(file_path: Path) -> pd.DataFrame:
    """Read dataset from file with auto-detection of encoding and separator."""
    suffix = file_path.suffix.lower()

    if suffix == ".csv":
        # First, try to detect encoding
        try:
            import chardet

            with open(file_path, "rb") as f:
                raw_data = f.read(10000)  # Read first 10KB for detection
                encoding_result = chardet.detect(raw_data)
                detected_encoding = encoding_result["encoding"]
                confidence = encoding_result["confidence"]

                # Use detected encoding if confidence is high enough
                if confidence > 0.7 and detected_encoding:
                    try:
                        df = pd.read_csv(file_path, encoding=detected_encoding)
                        return df
                    except Exception:
                        pass
        except ImportError:
            # chardet not available, fall back to manual detection
            pass

        # Fallback: Try common encodings with different separators
        encodings = [
            "utf-8",
            "utf-8-sig",
            "latin1",
            "iso-8859-1",
            "cp1252",
            "windows-1252",
        ]
        separators = [",", ";", "\t"]

        for encoding in encodings:
            for sep in separators:
                try:
                    # Try to read a small sample first
                    df_sample = pd.read_csv(file_path, encoding=encoding, sep=sep, nrows=5)
                    # If successful and has multiple columns, use this configuration
                    if len(df_sample.columns) > 1:
                        df = pd.read_csv(file_path, encoding=encoding, sep=sep)
                        return df
                except Exception:
                    continue

        # Last resort: try with different encodings
        try:
            df = pd.read_csv(file_path, encoding="utf-8")
            return df
        except Exception:
            try:
                df = pd.read_csv(file_path, encoding="latin1")
                return df
            except Exception:
                # Final fallback
                df = pd.read_csv(file_path, encoding="cp1252")
                return df

    elif suffix == ".xlsx":
        return pd.read_excel(file_path)

    elif suffix == ".parquet":
        return pd.read_parquet(file_path)

    else:
        raise ValueError(f"Unsupported file type: {suffix}")


def handle_duplicates(
    df: pd.DataFrame, key_columns: List[str], policy: str = "keep_last"
) -> pd.DataFrame:
    """Handle duplicate keys in dataframe."""

    if policy == "keep_last":
        return df.drop_duplicates(subset=key_columns, keep="last")
    elif policy == "sum":
        # Group by key columns and sum numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        non_key_numeric = [col for col in numeric_cols if col not in key_columns]

        if non_key_numeric:
            grouped = df.groupby(key_columns, as_index=False).agg(
                dict.fromkeys(non_key_numeric, "sum")
            )
            return grouped
        else:
            return df.drop_duplicates(subset=key_columns, keep="last")

    elif policy == "mean":
        # Group by key columns and average numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        non_key_numeric = [col for col in numeric_cols if col not in key_columns]

        if non_key_numeric:
            grouped = df.groupby(key_columns, as_index=False).agg(
                dict.fromkeys(non_key_numeric, "mean")
            )
            return grouped
        else:
            return df.drop_duplicates(subset=key_columns, keep="last")

    else:
        return df.drop_duplicates(subset=key_columns, keep="last")


def compare_and_correct(
    gold_df: pd.DataFrame,
    target_df: pd.DataFrame,
    key_columns: List[str],
    value_columns: List[str],
    options: Dict[str, Any],
) -> Tuple[pd.DataFrame, Dict[str, Any], List[Dict[str, Any]]]:
    """Compare target against gold and correct differences.

    Returns:
        - Corrected dataframe
        - Summary metrics
        - List of differences
    """
    # Normalize column names
    gold_df.columns = [normalize_column_name(col) for col in gold_df.columns]
    target_df.columns = [normalize_column_name(col) for col in target_df.columns]

    # Normalize key column names in parameters
    key_columns = [normalize_column_name(col) for col in key_columns]
    value_columns = [normalize_column_name(col) for col in value_columns]

    # Validate columns exist
    for col in key_columns + value_columns:
        if col not in gold_df.columns:
            raise ValueError(f"Column '{col}' not found in GOLD dataset")
        if col not in target_df.columns:
            raise ValueError(f"Column '{col}' not found in TARGET dataset")

    # Create normalized key columns
    gold_normalized_keys = gold_df[key_columns].copy()
    target_normalized_keys = target_df[key_columns].copy()

    for col in key_columns:
        if options.get("normalizeKeys", True):
            gold_normalized_keys[col] = gold_df[col].apply(
                lambda x: normalize_key_value(x, options)
            )
            target_normalized_keys[col] = target_df[col].apply(
                lambda x: normalize_key_value(x, options)
            )

    # Create composite key for joining
    gold_df["__composite_key__"] = gold_normalized_keys.apply(
        lambda row: "||".join(row.astype(str)), axis=1
    )
    target_df["__composite_key__"] = target_normalized_keys.apply(
        lambda row: "||".join(row.astype(str)), axis=1
    )

    # Check for duplicates in GOLD
    gold_duplicates = gold_df[gold_df.duplicated(subset=["__composite_key__"], keep=False)]
    if len(gold_duplicates) > 0:
        duplicate_keys = gold_duplicates["__composite_key__"].unique().tolist()
        raise ValueError(
            f"Duplicate keys found in GOLD dataset: {duplicate_keys[:5]}... "
            f"({len(duplicate_keys)} total)"
        )

    # Handle duplicates in TARGET
    target_df = handle_duplicates(
        target_df,
        ["__composite_key__"],
        options.get("targetDuplicatePolicy", "keep_last"),
    )

    # Coerce numeric columns
    decimal_places = options.get("decimalPlaces", 2)
    for col in value_columns:
        gold_df = gold_df.copy()
        target_df = target_df.copy()
        gold_df[col] = gold_df[col].apply(lambda x: coerce_numeric(x, options))
        target_df[col] = target_df[col].apply(lambda x: coerce_numeric(x, options))

    # Merge datasets - include original key columns from gold for reporting
    gold_merge_cols = ["__composite_key__"] + key_columns + value_columns
    merged = pd.merge(
        target_df,
        gold_df[gold_merge_cols],
        on="__composite_key__",
        how="outer",
        suffixes=("_target", "_gold"),
        indicator=True,
    )

    # Calculate metrics
    rows_gold = len(gold_df)
    rows_target = len(target_df)
    common_keys = len(merged[merged["_merge"] == "both"])
    missing_in_target = len(merged[merged["_merge"] == "right_only"])
    extra_in_target = len(merged[merged["_merge"] == "left_only"])

    # Compare values and collect differences
    tolerance = options.get("tolerance", 0.0)
    differences = []
    mismatches_total = 0
    matches_exact = 0

    corrected_df = target_df.copy()

    for col in value_columns:
        target_col = f"{col}_target" if f"{col}_target" in merged.columns else col
        gold_col = f"{col}_gold"

        # Only compare rows that exist in both
        both_mask = merged["_merge"] == "both"
        comparison_rows = merged[both_mask].copy()

        if gold_col not in merged.columns:
            continue

        # Skip if no data to compare
        if len(comparison_rows) == 0:
            continue

        # Calculate differences
        diff_mask = ~np.isclose(
            comparison_rows[target_col].fillna(0),
            comparison_rows[gold_col].fillna(0),
            atol=tolerance,
            rtol=0,
        )

        mismatches = comparison_rows[diff_mask]
        mismatches_total += len(mismatches)
        matches_exact += len(comparison_rows) - len(mismatches)

        # Correct values in target
        for idx, row in mismatches.iterrows():
            composite_key = row["__composite_key__"]
            gold_value = row[gold_col]
            target_value = row[target_col]

            # Round to decimal places
            if not pd.isna(gold_value):
                corrected_value = round(gold_value, decimal_places)
            else:
                corrected_value = gold_value

            # Update corrected dataframe
            corrected_df.loc[corrected_df["__composite_key__"] == composite_key, col] = (
                corrected_value
            )

            # Record difference - use original key values from target dataframe
            key_values = {}
            for key_col in key_columns:
                # Get original value from target dataframe (before normalization)
                # The key column might have _target suffix if it exists in both dataframes
                if f"{key_col}_target" in row.index:
                    original_value = row[f"{key_col}_target"]
                elif key_col in row.index:
                    original_value = row[key_col]
                else:
                    # Fallback to normalized value from composite key if can't find original
                    original_value = composite_key.split("||")[key_columns.index(key_col)]

                # Convert to native Python type for JSON serialization
                if pd.isna(original_value):
                    key_values[key_col] = None
                elif isinstance(original_value, np.integer):
                    key_values[key_col] = int(original_value)
                elif isinstance(original_value, np.floating):
                    key_values[key_col] = float(original_value)
                else:
                    key_values[key_col] = original_value

            differences.append(
                {
                    "keys": key_values,
                    "column": col,
                    "gold": float(gold_value) if not pd.isna(gold_value) else None,
                    "target": (float(target_value) if not pd.isna(target_value) else None),
                    "corrected": (float(corrected_value) if not pd.isna(corrected_value) else None),
                    "delta": (
                        float(abs(gold_value - target_value))
                        if not pd.isna(gold_value) and not pd.isna(target_value)
                        else None
                    ),
                }
            )

    # Calculate accuracy
    total_comparisons = matches_exact + mismatches_total
    accuracy = matches_exact / total_comparisons if total_comparisons > 0 else 0.0

    # Remove composite key column
    corrected_df = corrected_df.drop(columns=["__composite_key__"])

    summary = {
        "rows_gold": rows_gold,
        "rows_target": rows_target,
        "common_keys": common_keys,
        "missing_in_target": missing_in_target,
        "extra_in_target": extra_in_target,
        "mismatches_total": mismatches_total,
        "accuracy": round(accuracy, 4),
    }

    return corrected_df, summary, differences
