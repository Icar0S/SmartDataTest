"""Validity metrics calculation for data quality assessment."""

from typing import Any, Dict

import numpy as np
import pandas as pd


def calculate_validity_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate validity metrics for the dataset.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with validity metrics
    """
    column_validity = {}
    total_valid_cells = 0
    total_cells = 0

    for col in df.columns:
        col_data = df[col].dropna()
        total_values = len(col_data)
        valid_values = total_values  # Start assuming all are valid

        # Detect data type and validate
        if pd.api.types.is_numeric_dtype(df[col]):
            # For numeric columns, check for infinity values
            invalid = np.isinf(col_data).sum() if len(col_data) > 0 else 0
            valid_values = total_values - invalid
        elif pd.api.types.is_string_dtype(df[col]):
            # For string columns, check for empty strings after stripping
            invalid = col_data.apply(lambda x: isinstance(x, str) and x.strip() == "").sum()
            valid_values = total_values - invalid

        validity = (valid_values / total_values * 100) if total_values > 0 else 0
        column_validity[col] = {
            "validity": round(validity, 2),
            "valid_count": int(valid_values),
            "invalid_count": int(total_values - valid_values),
            "total_count": int(total_values),
        }

        total_valid_cells += valid_values
        total_cells += total_values

    overall_validity = (total_valid_cells / total_cells * 100) if total_cells > 0 else 0

    return {
        "overall_validity": round(overall_validity, 2),
        "total_cells": int(total_cells),
        "valid_cells": int(total_valid_cells),
        "invalid_cells": int(total_cells - total_valid_cells),
        "column_validity": column_validity,
    }
