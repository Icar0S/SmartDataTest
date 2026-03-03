"""Uniqueness metrics calculation for data quality assessment."""

from typing import Any, Dict

import pandas as pd


def calculate_uniqueness_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate uniqueness metrics for the dataset.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with uniqueness metrics
    """
    total_rows = len(df)
    duplicate_rows = df.duplicated().sum()
    unique_rows = total_rows - duplicate_rows
    uniqueness_rate = (unique_rows / total_rows * 100) if total_rows > 0 else 0

    # Per-column uniqueness
    column_uniqueness = {}
    for col in df.columns:
        unique_values = df[col].nunique()
        total_values = len(df[col].dropna())
        uniqueness = (unique_values / total_values * 100) if total_values > 0 else 0
        column_uniqueness[col] = {
            "uniqueness": round(uniqueness, 2),
            "unique_count": int(unique_values),
            "total_count": int(total_values),
        }

    return {
        "overall_uniqueness": round(uniqueness_rate, 2),
        "total_rows": int(total_rows),
        "unique_rows": int(unique_rows),
        "duplicate_rows": int(duplicate_rows),
        "column_uniqueness": column_uniqueness,
    }
