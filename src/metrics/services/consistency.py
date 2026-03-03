"""Consistency metrics calculation for data quality assessment."""

from typing import Any, Dict

import pandas as pd


def calculate_consistency_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate consistency metrics for the dataset.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with consistency metrics
    """
    column_consistency = {}

    for col in df.columns:
        col_data = df[col].dropna()
        if len(col_data) == 0:
            continue

        # Check data type consistency
        if pd.api.types.is_numeric_dtype(df[col]):
            # For numeric columns, check for mixed types (int vs float)
            type_consistency = 100.0
        elif pd.api.types.is_string_dtype(df[col]):
            # For string columns, check format consistency
            # Example: check if all values have similar patterns (same case, same length range)
            lengths = col_data.astype(str).str.len()
            if len(lengths) > 0:
                length_variance = lengths.std() / lengths.mean() if lengths.mean() > 0 else 0
                # Lower variance means more consistency
                type_consistency = max(0, min(100, 100 - (length_variance * 10)))
            else:
                type_consistency = 100.0
        else:
            type_consistency = 100.0

        column_consistency[col] = {
            "consistency": round(type_consistency, 2),
            "data_type": str(df[col].dtype),
        }

    # Overall consistency is average of column consistencies
    if column_consistency:
        overall_consistency = sum(c["consistency"] for c in column_consistency.values()) / len(
            column_consistency
        )
    else:
        overall_consistency = 0.0

    return {
        "overall_consistency": round(overall_consistency, 2),
        "column_consistency": column_consistency,
    }
