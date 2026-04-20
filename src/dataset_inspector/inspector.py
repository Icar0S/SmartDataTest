"""Dataset inspection module for automatic schema and statistics inference."""

import os
from typing import Any, Dict, Optional

import chardet
import numpy as np
import pandas as pd

# Constants
MAX_FILE_SIZE_MB = 100
SAMPLE_SIZE = 10000
PREVIEW_ROWS = 10


def sanitize_for_json(obj: Any) -> Any:
    """Convert pandas/numpy NaN and inf values to None for JSON serialization.

    Args:
        obj: Object to sanitize (can be dict, list, or scalar)

    Returns:
        Sanitized object with NaN/inf replaced by None
    """
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj
    elif pd.isna(obj):
        return None
    return obj


def detect_encoding(file_path: str) -> str:
    """Detect file encoding using chardet.

    Args:
        file_path: Path to the file

    Returns:
        Detected encoding string (e.g., 'utf-8', 'latin-1')
    """
    with open(file_path, "rb") as f:
        raw_data = f.read(10000)  # Read first 10KB for detection

    # Try UTF-8 first; this also covers plain ASCII files which chardet may
    # misdetect as windows-1252 when the sample is very small.
    try:
        raw_data.decode("utf-8")
        return "utf-8"
    except (UnicodeDecodeError, AttributeError):
        pass

    result = chardet.detect(raw_data)
    encoding = result["encoding"] or "utf-8"
    confidence = result.get("confidence", 0.0)

    # When chardet/charset_normalizer is not confident about a specific
    # ISO-8859-x variant (e.g. it returns iso-8859-3 or iso8859-3 for a file
    # with only a handful of special bytes), normalise to iso-8859-1 which is
    # the most prevalent Latin encoding for Portuguese/Brazilian content.
    # A high-confidence detection is respected so that legitimately different
    # encodings (e.g. iso-8859-2 for Central European content) are preserved.
    # Note: charset_normalizer may omit the hyphen between "iso" and "8859"
    # (e.g. "iso8859-3"), so we normalise the name before comparing.
    enc_normalised = encoding.lower().replace("iso8859", "iso-8859")
    if enc_normalised.startswith("iso-8859-") and confidence < 0.9:
        return "iso-8859-1"

    return encoding


def detect_csv_delimiter(file_path: str, encoding: str) -> str:
    """Detect CSV delimiter by trying common delimiters.

    Args:
        file_path: Path to the CSV file
        encoding: File encoding

    Returns:
        Detected delimiter character
    """
    delimiters = [",", ";", "\t", "|"]
    max_columns = 0
    best_delimiter = ","

    for delimiter in delimiters:
        try:
            df = pd.read_csv(file_path, encoding=encoding, delimiter=delimiter, nrows=5)
            num_columns = len(df.columns)
            if num_columns > max_columns:
                max_columns = num_columns
                best_delimiter = delimiter
        except Exception:
            continue

    return best_delimiter


def infer_column_statistics(
    df: pd.DataFrame, column: str, sample_size: int = SAMPLE_SIZE
) -> Dict[str, Any]:
    """Infer statistics for a single column.

    Args:
        df: DataFrame containing the column
        column: Column name
        sample_size: Number of rows to sample for statistics

    Returns:
        Dictionary with column statistics
    """
    # Sample the data if it's too large
    if len(df) > sample_size:
        sample_df = df.sample(n=sample_size, random_state=42)
    else:
        sample_df = df

    col_data = sample_df[column]

    stats = {
        "name": column,
        "type": str(col_data.dtype),
        "null_count": int(col_data.isna().sum()),
        "null_ratio": (float(col_data.isna().sum() / len(col_data)) if len(col_data) > 0 else 0.0),
        "unique_count": int(col_data.nunique()),
        "unique_ratio": (float(col_data.nunique() / len(col_data)) if len(col_data) > 0 else 0.0),
    }
    # Add type-specific statistics
    if pd.api.types.is_numeric_dtype(col_data):
        non_null = col_data.dropna()
        if len(non_null) > 0:
            stats["min"] = float(non_null.min())
            stats["max"] = float(non_null.max())
            stats["mean"] = float(non_null.mean())
            stats["median"] = float(non_null.median())
            stats["std"] = float(non_null.std()) if len(non_null) > 1 else 0.0
    elif pd.api.types.is_string_dtype(col_data) or pd.api.types.is_object_dtype(col_data):
        non_null = col_data.dropna()
        if len(non_null) > 0:
            stats["avg_length"] = float(non_null.astype(str).str.len().mean())
            stats["max_length"] = int(non_null.astype(str).str.len().max())
            # Get sample values (up to 5 most common)
            value_counts = non_null.value_counts().head(5)
            stats["sample_values"] = [str(v) for v in value_counts.index.tolist()]

    return stats


def inspect_csv(file_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Inspect a CSV file and extract metadata.

    Args:
        file_path: Path to the CSV file
        options: Optional dict with delimiter, encoding, header, sample_size

    Returns:
        Dictionary with file metadata, schema, and statistics

    Raises:
        ValueError: If file cannot be read or parsed as CSV
    """
    options = options or {}

    # Validate file exists
    if not os.path.exists(file_path):
        raise ValueError(f"File not found: {file_path}")

    # Auto-detect or use provided options
    try:
        encoding = options.get("encoding") or detect_encoding(file_path)
    except Exception as e:
        raise ValueError(f"Failed to detect file encoding: {e}") from e

    try:
        delimiter = options.get("delimiter") or detect_csv_delimiter(file_path, encoding)
    except Exception as e:
        raise ValueError(f"Failed to detect CSV delimiter: {e}") from e

    header = options.get("header", True)
    sample_size = options.get("sample_size", SAMPLE_SIZE)

    # Read the file
    try:
        if header:
            df = pd.read_csv(file_path, encoding=encoding, delimiter=delimiter)
        else:
            df = pd.read_csv(file_path, encoding=encoding, delimiter=delimiter, header=None)
    except Exception as e:
        raise ValueError(f"Failed to parse CSV file: {e}") from e

    # Validate dataframe
    if df.empty:
        raise ValueError("CSV file contains no data rows")

    if len(df.columns) == 0:
        raise ValueError("CSV file contains no columns")

    # Generate metadata
    metadata = {
        "format": "csv",
        "row_count": len(df),
        "column_count": len(df.columns),
        "detected_options": {
            "encoding": encoding,
            "delimiter": delimiter,
            "header": header,
        },
        "columns": [],
        "preview": df.head(PREVIEW_ROWS).to_dict(orient="records"),
    }

    # Infer statistics for each column
    for column in df.columns:
        col_stats = infer_column_statistics(df, column, sample_size)
        metadata["columns"].append(col_stats)

    # Sanitize NaN/inf values for JSON serialization
    return sanitize_for_json(metadata)


def inspect_parquet(file_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Inspect a Parquet file and extract metadata.

    Args:
        file_path: Path to the Parquet file
        options: Optional dict with sample_size

    Returns:
        Dictionary with file metadata, schema, and statistics

    Raises:
        ValueError: If file cannot be read or parsed as Parquet
    """
    options = options or {}
    sample_size = options.get("sample_size", SAMPLE_SIZE)

    # Validate file exists
    if not os.path.exists(file_path):
        raise ValueError(f"File not found: {file_path}")

    # Read the file
    try:
        df = pd.read_parquet(file_path)
    except Exception as e:
        raise ValueError(f"Failed to parse Parquet file: {e}") from e

    # Validate dataframe
    if df.empty:
        raise ValueError("Parquet file contains no data rows")

    if len(df.columns) == 0:
        raise ValueError("Parquet file contains no columns")

    # Generate metadata
    metadata = {
        "format": "parquet",
        "row_count": len(df),
        "column_count": len(df.columns),
        "detected_options": {},
        "columns": [],
        "preview": df.head(PREVIEW_ROWS).to_dict(orient="records"),
    }

    # Infer statistics for each column
    for column in df.columns:
        col_stats = infer_column_statistics(df, column, sample_size)
        metadata["columns"].append(col_stats)

    # Sanitize NaN/inf values for JSON serialization
    return sanitize_for_json(metadata)


def inspect_json(file_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Inspect a JSON file and extract metadata.

    Args:
        file_path: Path to the JSON file
        options: Optional dict with sample_size

    Returns:
        Dictionary with file metadata, schema, and statistics

    Raises:
        ValueError: If file cannot be read or parsed as JSON
    """
    options = options or {}
    sample_size = options.get("sample_size", SAMPLE_SIZE)

    # Validate file exists
    if not os.path.exists(file_path):
        raise ValueError(f"File not found: {file_path}")

    # Try to read as regular JSON first (array of objects), then as JSON lines
    json_type = "json"
    try:
        df = pd.read_json(file_path)
    except ValueError:
        try:
            df = pd.read_json(file_path, lines=True)
            json_type = "jsonl"
        except Exception as e:
            raise ValueError(
                f"Unable to parse JSON file. Not a valid JSON array or JSON Lines format: {e}"
            ) from e
    except Exception as e:
        raise ValueError(f"Failed to parse JSON file: {e}") from e

    # Validate dataframe
    if df.empty:
        raise ValueError("JSON file contains no data rows")

    if len(df.columns) == 0:
        raise ValueError("JSON file contains no columns")

    # Generate metadata
    metadata = {
        "format": "json",
        "row_count": len(df),
        "column_count": len(df.columns),
        "detected_options": {
            "json_type": json_type,
        },
        "columns": [],
        "preview": df.head(PREVIEW_ROWS).to_dict(orient="records"),
    }

    # Infer statistics for each column
    for column in df.columns:
        col_stats = infer_column_statistics(df, column, sample_size)
        metadata["columns"].append(col_stats)

    # Sanitize NaN/inf values for JSON serialization
    return sanitize_for_json(metadata)


def inspect_dataset(
    file_path: str, file_format: str, options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Inspect a dataset file and extract metadata.

    Args:
        file_path: Path to the dataset file
        file_format: Format of the file ('csv', 'parquet', 'json')
        options: Optional dict with format-specific options

    Returns:
        Dictionary with file metadata, schema, and statistics

    Raises:
        ValueError: If format is not supported
    """
    file_format = file_format.lower()

    if file_format == "csv":
        return inspect_csv(file_path, options)
    if file_format == "parquet":
        return inspect_parquet(file_path, options)
    if file_format == "json":
        return inspect_json(file_path, options)
    raise ValueError(f"Unsupported file format: {file_format}")


def map_pandas_type_to_spark(pandas_type: str) -> str:
    """Map pandas dtype to PySpark type.

    Args:
        pandas_type: Pandas dtype string

    Returns:
        PySpark type string
    """
    type_mapping = {
        "int64": "long",
        "int32": "integer",
        "float64": "double",
        "float32": "float",
        "object": "string",
        "string": "string",
        "bool": "boolean",
        "datetime64[ns]": "timestamp",
    }

    return type_mapping.get(pandas_type, "string")
