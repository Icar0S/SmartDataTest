"""File reading utilities for data quality metrics."""

from pathlib import Path
from typing import Optional

import pandas as pd


def read_dataset(file_path: Path, nrows: Optional[int] = None) -> pd.DataFrame:
    """Read dataset from file with robust CSV handling.

    Args:
        file_path: Path to the dataset file
        nrows: Maximum number of rows to read. If None, reads all rows.
               Pass ``max_rows + 1`` during upload to detect oversized
               datasets without loading the entire file into memory.

    Returns:
        DataFrame containing the dataset

    Raises:
        ValueError: If file format is not supported
    """
    file_ext = file_path.suffix.lower()

    if file_ext == ".csv":
        return read_csv_robust(file_path, nrows=nrows)
    elif file_ext in [".xlsx", ".xls"]:
        df = pd.read_excel(file_path, nrows=nrows)
    elif file_ext == ".parquet":
        df = pd.read_parquet(file_path)
        if nrows is not None and len(df) > nrows:
            df = df.iloc[:nrows]
    else:
        raise ValueError(f"Unsupported file format: {file_ext}")

    return df


def read_csv_robust(file_path: Path, nrows: Optional[int] = None) -> pd.DataFrame:
    """Robust CSV reading with multiple fallback strategies.

    Args:
        file_path: Path to CSV file
        nrows: Maximum number of rows to read. Pass ``max_rows + 1`` during
               upload validation so the caller can detect oversized files
               without loading the whole dataset into memory.

    Returns:
        DataFrame with successfully parsed data, or empty DataFrame if file is empty

    Raises:
        ValueError: If all parsing strategies fail
    """
    # Check if file is empty first
    if file_path.stat().st_size == 0:
        print("File is empty, returning empty DataFrame")
        return pd.DataFrame()

    # Try to detect separator first by reading a sample
    separators_to_try = [",", ";", "\t", "|"]
    detected_sep = ","

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            first_line = f.readline().strip()
            if first_line:
                # Count occurrences of each separator in first line
                sep_counts = {sep: first_line.count(sep) for sep in separators_to_try}
                # Choose separator with highest count (if > 0)
                if any(count > 0 for count in sep_counts.values()):
                    detected_sep = max(sep_counts, key=lambda sep: sep_counts[sep])
                    print(
                        f"Detected separator: '{detected_sep}' (count: {sep_counts[detected_sep]})"
                    )
    except Exception as e:
        print(f"Could not detect separator, using default comma: {e}")

    # Strategy list with detected separator first
    strategies = [
        {
            "encoding": "utf-8",
            "sep": detected_sep,
            "on_bad_lines": "skip",
        },
        {
            "encoding": "utf-8",
            "sep": ",",
            "on_bad_lines": "skip",
        },
        {
            "encoding": "utf-8",
            "sep": ";",
            "on_bad_lines": "skip",
        },
        {
            "encoding": "utf-8",
            "sep": "\t",
            "on_bad_lines": "skip",
        },
        {
            "encoding": "latin-1",
            "sep": detected_sep,
            "on_bad_lines": "skip",
        },
        {
            "encoding": "latin-1",
            "sep": ",",
            "on_bad_lines": "skip",
        },
        {
            "encoding": "latin-1",
            "sep": ";",
            "on_bad_lines": "skip",
        },
        {
            "encoding": "utf-8",
            "sep": detected_sep,
            "quoting": 1,
            "on_bad_lines": "skip",
        },
        {
            "encoding": "utf-8",
            "sep": None,
            "engine": "python",
            "on_bad_lines": "skip",
        },
    ]

    errors = []

    for i, strategy in enumerate(strategies, 1):
        try:
            print(f"Trying CSV reading strategy {i}: {strategy}")

            read_kwargs = dict(strategy)
            if nrows is not None:
                read_kwargs["nrows"] = nrows
            df = pd.read_csv(file_path, **read_kwargs)

            # Check if we got a reasonable result
            if df.empty and file_path.stat().st_size > 0:
                raise ValueError("Empty DataFrame from non-empty file")

            if len(df.columns) == 0:
                raise ValueError("No columns found")

            # If we only got one column but expected more (and the column name contains separators)
            if len(df.columns) == 1 and detected_sep in df.columns[0]:
                raise ValueError("Data not properly separated - single column contains separators")

            print(f"Successfully read CSV with strategy {i}. Shape: {df.shape}")
            return df

        except Exception as e:
            error_msg = f"Strategy {i} failed: {str(e)}"
            print(error_msg)
            errors.append(error_msg)
            continue

    # If all strategies fail, try chunk-based reading as last resort
    try:
        print("Attempting chunk-based reading as last resort...")
        result = read_csv_chunked(file_path, nrows=nrows)
        if result is not None:
            return result
    except Exception as e:
        errors.append(f"Chunk-based reading failed: {str(e)}")

    # All strategies failed
    error_summary = "\n".join(errors)
    raise ValueError(f"Failed to read CSV file with all strategies:\n{error_summary}")


def read_csv_chunked(
    file_path: Path, chunk_size: int = 10000, nrows: Optional[int] = None
) -> pd.DataFrame:
    """Read CSV in chunks and combine, handling malformed lines.

    Args:
        file_path: Path to CSV file
        chunk_size: Size of each chunk
        nrows: Maximum number of rows to read. Reading stops as soon as this
               limit is reached so callers can detect oversized files without
               loading the entire dataset into memory.

    Returns:
        Combined DataFrame
    """
    chunks = []
    total_rows = 0

    try:
        # Try reading in chunks with error handling
        for chunk in pd.read_csv(
            file_path,
            encoding="utf-8",
            sep=",",
            on_bad_lines="skip",
            chunksize=chunk_size,
            low_memory=False,
        ):
            if not chunk.empty:
                if nrows is not None and total_rows + len(chunk) > nrows:
                    # Take only as many rows as needed to reach the limit
                    chunks.append(chunk.iloc[: nrows - total_rows])
                    total_rows = nrows
                    break
                chunks.append(chunk)
                total_rows += len(chunk)

        if not chunks:
            raise ValueError("No valid chunks found")

        df = pd.concat(chunks, ignore_index=True)
        print(f"Successfully read {total_rows} rows using chunked approach")
        return df

    except Exception as e:
        # Final fallback: try with python engine and more flexible settings
        try:
            read_kwargs: dict = {
                "encoding": "utf-8",
                "sep": None,  # Let pandas auto-detect
                "engine": "python",
                "on_bad_lines": "skip",
                "skipinitialspace": True,
            }
            if nrows is not None:
                read_kwargs["nrows"] = nrows
            df = pd.read_csv(file_path, **read_kwargs)
            if df.empty:
                raise ValueError("Empty DataFrame from python engine")
            return df
        except Exception:
            raise ValueError(f"Chunked reading failed: {str(e)}")
