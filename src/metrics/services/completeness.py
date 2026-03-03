"""Completeness metrics calculation for data quality assessment."""

from typing import Any, Dict

import pandas as pd


def calculate_completeness_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate completeness metrics for the dataset.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with completeness metrics
    """
    total_cells = df.shape[0] * df.shape[1]
    missing_cells = df.isna().sum().sum()
    completeness_rate = (
        ((total_cells - missing_cells) / total_cells * 100) if total_cells > 0 else 0
    )

    # Per-column completeness
    column_completeness = {}
    for col in df.columns:
        missing = df[col].isna().sum()
        total = len(df)
        completeness = ((total - missing) / total * 100) if total > 0 else 0
        column_completeness[col] = {
            "completeness": round(completeness, 2),
            "missing_count": int(missing),
            "total_count": int(total),
        }

    return {
        "overall_completeness": round(completeness_rate, 2),
        "total_cells": int(total_cells),
        "missing_cells": int(missing_cells),
        "filled_cells": int(total_cells - missing_cells),
        "column_completeness": column_completeness,
    }
