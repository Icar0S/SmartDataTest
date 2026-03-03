"""File processing services for GOLD dataset cleaning."""

from pathlib import Path

import pandas as pd

from ..processor import (
    clean_dataframe_chunk,
    get_null_counts,
    normalize_column_name,
    read_dataset,
)
from .serialization_utils import convert_to_json_serializable


def process_csv_chunked(
    file_path, session_id, options, encoding, sep, chunksize, config, processing_status
):
    """Process CSV file in chunks.

    Args:
        file_path: Path to the CSV file
        session_id: Session identifier
        options: Processing options dict
        encoding: File encoding
        sep: Column separator
        chunksize: Number of rows per chunk
        config: Configuration object with storage_path
        processing_status: Status tracking dict

    Returns:
        pd.DataFrame: Processed dataframe
    """
    session_dir = config.storage_path / session_id

    # First pass: analyze structure
    processing_status[session_id]["progress"]["phase"] = "analyzing"
    df_first = read_dataset(file_path, encoding=encoding, sep=sep, nrows=1000)

    # Get total rows
    total_rows = sum(1 for _ in open(file_path, "r", encoding=encoding)) - 1

    # Normalize headers if requested
    column_mapping = {}
    if options.get("normalizeHeaders", True):
        normalized_cols = []
        for col in df_first.columns:
            normalized = normalize_column_name(col, normalized_cols)
            normalized_cols.append(normalized)
            column_mapping[col] = normalized
        df_first.columns = normalized_cols

    # Identify empty columns to drop
    columns_to_drop = []
    if options.get("dropEmptyColumns", True):
        # Need to check full file for empty columns
        df_check = read_dataset(file_path, encoding=encoding, sep=sep)
        if column_mapping:
            df_check.columns = [column_mapping.get(col, col) for col in df_check.columns]
        for col in df_check.columns:
            if df_check[col].isna().all():
                columns_to_drop.append(col)

    # Get null counts before
    nulls_before = get_null_counts(df_first)
    columns_before = len(df_first.columns)

    # Drop empty columns
    df_first = df_first.drop(columns=columns_to_drop, errors="ignore")

    # Process in chunks
    processing_status[session_id]["progress"]["phase"] = "cleaning"

    chunks = []
    metrics = {"trimStrings": 0, "coerceNumeric": 0, "parseDates": 0}

    # Use robust CSV reading with chunking - try different strategies for problematic files
    chunk_reader = None
    chunk_strategies = [
        # Standard approach
        {"encoding": encoding, "sep": sep, "chunksize": chunksize},
        # With quoting for CSV files with embedded commas/newlines
        {"encoding": encoding, "sep": sep, "chunksize": chunksize, "quoting": 1},
        # With different quote handling
        {
            "encoding": encoding,
            "sep": sep,
            "chunksize": chunksize,
            "quotechar": '"',
            "doublequote": True,
        },
        # Skip bad lines
        {
            "encoding": encoding,
            "sep": sep,
            "chunksize": chunksize,
            "on_bad_lines": "skip",
        },
        # Engine change for problematic files
        {"encoding": encoding, "sep": sep, "chunksize": chunksize, "engine": "python"},
        # Last resort with more permissive settings
        {
            "encoding": encoding,
            "sep": sep,
            "chunksize": chunksize,
            "engine": "python",
            "on_bad_lines": "skip",
            "quoting": 3,
        },
    ]

    last_error = None
    successful_strategy = None
    for i, strategy in enumerate(chunk_strategies):
        try:
            # Test if this strategy can read at least one chunk first
            test_strategy = {k: v for k, v in strategy.items() if k != "chunksize"}
            test_strategy["nrows"] = 10
            test_reader = pd.read_csv(file_path, **test_strategy)

            if len(test_reader) > 0:
                # Strategy works, now create the actual chunk reader
                chunk_reader = pd.read_csv(file_path, **strategy)
                successful_strategy = i + 1
                if i > 0:  # Log fallback usage
                    print(f"Using CSV chunk reading strategy {successful_strategy} for processing")
                break
        except Exception as e:
            last_error = e
            continue

    if chunk_reader is None:
        raise ValueError(
            f"Could not read CSV file {file_path} in chunks. Last error: {str(last_error)}. "
            f"The file may have structural issues that prevent chunked reading."
        )

    total_chunks = (total_rows // chunksize) + 1
    chunk_count = 0

    try:
        for chunk in chunk_reader:
            try:
                chunk_count += 1
                processing_status[session_id]["progress"]["current"] = chunk_count
                processing_status[session_id]["progress"]["total"] = total_chunks

                # Apply column mapping
                if column_mapping:
                    chunk.columns = [column_mapping.get(col, col) for col in chunk.columns]

                # Drop empty columns
                chunk = chunk.drop(columns=columns_to_drop, errors="ignore")

                # Clean chunk
                cleaned_chunk, chunk_metrics = clean_dataframe_chunk(
                    chunk,
                    options,
                    column_mapping=column_mapping,
                    is_first_chunk=(chunk_count == 1),
                )

                # Update metrics
                for key in metrics:
                    metrics[key] += chunk_metrics.get(key, 0)

                chunks.append(cleaned_chunk)

            except Exception as chunk_error:
                print(f"Warning: Error processing chunk {chunk_count}: {str(chunk_error)}")
                # Skip this problematic chunk and continue
                continue

    except Exception as reader_error:
        # If chunk reading fails completely, try to recover with more permissive settings
        print(
            f"Chunk reading failed: {str(reader_error)}. Attempting recovery with permissive settings..."
        )

        # Try to read the entire file with the most permissive strategy and then chunk it in memory
        try:
            recovery_strategy = {
                "encoding": encoding,
                "sep": sep,
                "engine": "python",
                "on_bad_lines": "skip",
                "quoting": 3,
                "skipinitialspace": True,
            }

            print("Attempting recovery by reading entire file with permissive settings...")
            df_full = pd.read_csv(file_path, **recovery_strategy)

            # Apply column mapping to full dataframe
            if column_mapping:
                df_full.columns = [column_mapping.get(col, col) for col in df_full.columns]

            # Drop empty columns
            df_full = df_full.drop(columns=columns_to_drop, errors="ignore")

            # Process in memory chunks
            print(f"Recovery successful. Processing {len(df_full)} rows in memory chunks...")
            total_chunks = (len(df_full) // chunksize) + 1

            for i in range(0, len(df_full), chunksize):
                chunk_count += 1
                processing_status[session_id]["progress"]["current"] = chunk_count
                processing_status[session_id]["progress"]["total"] = total_chunks

                chunk = df_full.iloc[i : i + chunksize].copy()

                try:
                    # Clean chunk
                    cleaned_chunk, chunk_metrics = clean_dataframe_chunk(
                        chunk,
                        options,
                        column_mapping=column_mapping,
                        is_first_chunk=(i == 0),
                    )

                    # Update metrics
                    for key in metrics:
                        metrics[key] += chunk_metrics.get(key, 0)

                    chunks.append(cleaned_chunk)

                except Exception as chunk_error:
                    print(
                        f"Warning: Error processing memory chunk {chunk_count}: {str(chunk_error)}"
                    )
                    continue

            print("Recovery processing completed successfully.")

        except Exception as recovery_error:
            print(
                f"Python engine recovery failed: {str(recovery_error)}. Trying C engine with permissive settings..."
            )

            # Try one more time with C engine and very permissive settings
            try:
                # Build recovery strategy with compatibility check
                recovery_strategy_c = {
                    "encoding": encoding,
                    "sep": sep,
                    "engine": "c",
                    "quoting": 3,
                    "skipinitialspace": True,
                    "low_memory": False,
                }

                # Add on_bad_lines parameter based on pandas version compatibility
                try:
                    recovery_strategy_c["on_bad_lines"] = "skip"
                except Exception:
                    # Fallback for older pandas versions
                    recovery_strategy_c["error_bad_lines"] = False
                    recovery_strategy_c["warn_bad_lines"] = False

                print("Attempting final recovery with C engine...")
                df_full = pd.read_csv(file_path, **recovery_strategy_c)

                # Apply column mapping to full dataframe
                if column_mapping:
                    df_full.columns = [column_mapping.get(col, col) for col in df_full.columns]

                # Drop empty columns
                df_full = df_full.drop(columns=columns_to_drop, errors="ignore")

                # Process in memory chunks
                print(
                    f"Final recovery successful. Processing {len(df_full)} rows in memory chunks..."
                )
                total_chunks = (len(df_full) // chunksize) + 1

                for i in range(0, len(df_full), chunksize):
                    chunk_count += 1
                    processing_status[session_id]["progress"]["current"] = chunk_count
                    processing_status[session_id]["progress"]["total"] = total_chunks

                    chunk = df_full.iloc[i : i + chunksize].copy()

                    try:
                        # Clean chunk
                        cleaned_chunk, chunk_metrics = clean_dataframe_chunk(
                            chunk,
                            options,
                            column_mapping=column_mapping,
                            is_first_chunk=(i == 0),
                        )

                        # Update metrics
                        for key in metrics:
                            metrics[key] += chunk_metrics.get(key, 0)

                        chunks.append(cleaned_chunk)

                    except Exception as chunk_error:
                        print(
                            f"Warning: Error processing final recovery chunk {chunk_count}: {str(chunk_error)}"
                        )
                        continue

                print("Final recovery processing completed successfully.")

            except Exception as final_error:
                raise ValueError(
                    f"Error reading CSV chunks: {str(reader_error)}. "
                    f"Python engine recovery failed: {str(recovery_error)}. "
                    f"C engine recovery also failed: {str(final_error)}. "
                    f"File has severe structural issues that prevent any form of processing."
                )

    # Concatenate all chunks
    processing_status[session_id]["progress"]["phase"] = "finalizing"
    result_df = pd.concat(chunks, ignore_index=True)

    # Drop duplicates if requested
    if options.get("dropDuplicates", False):
        result_df = result_df.drop_duplicates()

    # Get null counts after
    nulls_after = get_null_counts(result_df)

    # Save cleaned CSV
    output_csv = session_dir / "gold_clean.csv"
    result_df.to_csv(output_csv, index=False)

    # Generate preview
    preview = result_df.head(50).to_dict(orient="records")
    for record in preview:
        for key, value in record.items():
            if pd.isna(value):
                record[key] = None

    # Build report
    report = {
        "rowsRead": int(total_rows),
        "rowsWritten": int(len(result_df)),
        "columnsBefore": int(columns_before),
        "columnsAfter": int(len(result_df.columns)),
        "removedColumns": columns_to_drop,
        "changedRows": convert_to_json_serializable(metrics),
        "nullsPerColumn": {
            "before": convert_to_json_serializable(nulls_before),
            "after": convert_to_json_serializable(nulls_after),
        },
        "samplePreview": preview,
        "startedAt": processing_status[session_id]["startedAt"],
    }

    processing_status[session_id]["report"] = report

    return result_df


def process_excel(file_path, session_id, options, chunksize, config, processing_status):
    """Process Excel file.

    Args:
        file_path: Path to the Excel file
        session_id: Session identifier
        options: Processing options dict
        chunksize: Number of rows per chunk
        config: Configuration object with storage_path
        processing_status: Status tracking dict

    Returns:
        pd.DataFrame: Processed dataframe
    """
    session_dir = config.storage_path / session_id

    processing_status[session_id]["progress"]["phase"] = "reading"

    # Read entire Excel file
    df = pd.read_excel(file_path)

    total_rows = len(df)
    columns_before = len(df.columns)

    # Normalize headers
    column_mapping = {}
    if options.get("normalizeHeaders", True):
        processing_status[session_id]["progress"]["phase"] = "normalizing headers"
        normalized_cols = []
        for col in df.columns:
            normalized = normalize_column_name(col, normalized_cols)
            normalized_cols.append(normalized)
            column_mapping[col] = normalized
        df.columns = normalized_cols

    # Get null counts before
    nulls_before = get_null_counts(df)

    # Drop empty columns
    columns_to_drop = []
    if options.get("dropEmptyColumns", True):
        for col in df.columns:
            if df[col].isna().all():
                columns_to_drop.append(col)
        df = df.drop(columns=columns_to_drop)

    # Process in memory chunks
    processing_status[session_id]["progress"]["phase"] = "cleaning"

    metrics = {"trimStrings": 0, "coerceNumeric": 0, "parseDates": 0}
    chunks = []

    total_chunks = (len(df) // chunksize) + 1

    for i in range(0, len(df), chunksize):
        chunk_num = i // chunksize + 1
        processing_status[session_id]["progress"]["current"] = chunk_num
        processing_status[session_id]["progress"]["total"] = total_chunks

        chunk = df.iloc[i : i + chunksize].copy()

        # Clean chunk
        cleaned_chunk, chunk_metrics = clean_dataframe_chunk(
            chunk, options, is_first_chunk=(i == 0)
        )

        # Update metrics
        for key in metrics:
            metrics[key] += chunk_metrics.get(key, 0)

        chunks.append(cleaned_chunk)

    # Concatenate chunks
    processing_status[session_id]["progress"]["phase"] = "finalizing"
    result_df = pd.concat(chunks, ignore_index=True)

    # Drop duplicates if requested
    if options.get("dropDuplicates", False):
        result_df = result_df.drop_duplicates()

    # Get null counts after
    nulls_after = get_null_counts(result_df)

    # Save as CSV
    output_csv = session_dir / "gold_clean.csv"
    result_df.to_csv(output_csv, index=False)

    # Also save as Excel
    output_xlsx = session_dir / "gold_clean.xlsx"
    result_df.to_excel(output_xlsx, index=False, engine="openpyxl")

    # Generate preview
    preview = result_df.head(50).to_dict(orient="records")
    for record in preview:
        for key, value in record.items():
            if pd.isna(value):
                record[key] = None

    # Build report
    report = {
        "rowsRead": int(total_rows),
        "rowsWritten": int(len(result_df)),
        "columnsBefore": int(columns_before),
        "columnsAfter": int(len(result_df.columns)),
        "removedColumns": columns_to_drop,
        "changedRows": convert_to_json_serializable(metrics),
        "nullsPerColumn": {
            "before": convert_to_json_serializable(nulls_before),
            "after": convert_to_json_serializable(nulls_after),
        },
        "samplePreview": preview,
        "startedAt": processing_status[session_id]["startedAt"],
    }

    processing_status[session_id]["report"] = report

    return result_df


def process_parquet_chunked(file_path, session_id, options, chunksize, config, processing_status):
    """Process Parquet file in chunks.

    Args:
        file_path: Path to the Parquet file
        session_id: Session identifier
        options: Processing options dict
        chunksize: Number of rows per chunk
        config: Configuration object with storage_path
        processing_status: Status tracking dict

    Returns:
        pd.DataFrame: Processed dataframe
    """
    session_dir = config.storage_path / session_id

    processing_status[session_id]["progress"]["phase"] = "reading"

    # Read parquet file
    df = pd.read_parquet(file_path)

    total_rows = len(df)
    columns_before = len(df.columns)

    # Normalize headers
    column_mapping = {}
    if options.get("normalizeHeaders", True):
        normalized_cols = []
        for col in df.columns:
            normalized = normalize_column_name(col, normalized_cols)
            normalized_cols.append(normalized)
            column_mapping[col] = normalized
        df.columns = normalized_cols

    # Get null counts before
    nulls_before = get_null_counts(df)

    # Drop empty columns
    columns_to_drop = []
    if options.get("dropEmptyColumns", True):
        for col in df.columns:
            if df[col].isna().all():
                columns_to_drop.append(col)
        df = df.drop(columns=columns_to_drop)

    # Process in chunks
    processing_status[session_id]["progress"]["phase"] = "cleaning"

    metrics = {"trimStrings": 0, "coerceNumeric": 0, "parseDates": 0}
    chunks = []

    total_chunks = (len(df) // chunksize) + 1

    for i in range(0, len(df), chunksize):
        chunk_num = i // chunksize + 1
        processing_status[session_id]["progress"]["current"] = chunk_num
        processing_status[session_id]["progress"]["total"] = total_chunks

        chunk = df.iloc[i : i + chunksize].copy()

        # Clean chunk
        cleaned_chunk, chunk_metrics = clean_dataframe_chunk(
            chunk, options, is_first_chunk=(i == 0)
        )

        # Update metrics
        for key in metrics:
            metrics[key] += chunk_metrics.get(key, 0)

        chunks.append(cleaned_chunk)

    # Concatenate chunks
    processing_status[session_id]["progress"]["phase"] = "finalizing"
    result_df = pd.concat(chunks, ignore_index=True)

    # Drop duplicates if requested
    if options.get("dropDuplicates", False):
        result_df = result_df.drop_duplicates()

    # Get null counts after
    nulls_after = get_null_counts(result_df)

    # Save as CSV
    output_csv = session_dir / "gold_clean.csv"
    result_df.to_csv(output_csv, index=False)

    # Also save as Parquet
    output_parquet = session_dir / "gold_clean.parquet"
    result_df.to_parquet(output_parquet, index=False)

    # Generate preview
    preview = result_df.head(50).to_dict(orient="records")
    for record in preview:
        for key, value in record.items():
            if pd.isna(value):
                record[key] = None

    # Build report
    report = {
        "rowsRead": int(total_rows),
        "rowsWritten": int(len(result_df)),
        "columnsBefore": int(columns_before),
        "columnsAfter": int(len(result_df.columns)),
        "removedColumns": columns_to_drop,
        "changedRows": convert_to_json_serializable(metrics),
        "nullsPerColumn": {
            "before": convert_to_json_serializable(nulls_before),
            "after": convert_to_json_serializable(nulls_after),
        },
        "samplePreview": preview,
        "startedAt": processing_status[session_id]["startedAt"],
    }

    processing_status[session_id]["report"] = report

    return result_df
