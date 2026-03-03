"""Data quality metrics calculation logic."""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import numpy as np
import pandas as pd

from .services.completeness import calculate_completeness_metrics
from .services.consistency import calculate_consistency_metrics

# Import from services
from .services.file_reader import read_csv_chunked, read_csv_robust, read_dataset
from .services.uniqueness import calculate_uniqueness_metrics
from .services.validity import calculate_validity_metrics


def calculate_all_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate all data quality metrics for the dataset.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with all metrics
    """
    return {
        "completeness": calculate_completeness_metrics(df),
        "uniqueness": calculate_uniqueness_metrics(df),
        "validity": calculate_validity_metrics(df),
        "consistency": calculate_consistency_metrics(df),
        "dataset_info": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "column_names": list(df.columns),
            "memory_usage_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
        },
    }


def identify_problematic_columns(
    metrics: Dict[str, Any], threshold: float = 80.0
) -> Dict[str, Any]:
    """Identify columns with quality issues.

    Args:
        metrics: Metrics dictionary from calculate_all_metrics
        threshold: Quality threshold below which a column is considered problematic

    Returns:
        Dictionary with problematic columns per category
    """
    problematic = {
        "completeness": [],
        "uniqueness": [],
        "validity": [],
        "consistency": [],
    }

    # Check completeness
    for col, data in metrics["completeness"]["column_completeness"].items():
        if data["completeness"] < threshold:
            problematic["completeness"].append(
                {
                    "column": col,
                    "score": data["completeness"],
                    "missing_count": data["missing_count"],
                    "total_count": data["total_count"],
                }
            )

    # Check uniqueness
    for col, data in metrics["uniqueness"]["column_uniqueness"].items():
        if data["uniqueness"] < threshold:
            problematic["uniqueness"].append(
                {
                    "column": col,
                    "score": data["uniqueness"],
                    "unique_count": data["unique_count"],
                    "total_count": data["total_count"],
                }
            )

    # Check validity
    for col, data in metrics["validity"]["column_validity"].items():
        if data["validity"] < threshold:
            problematic["validity"].append(
                {
                    "column": col,
                    "score": data["validity"],
                    "invalid_count": data["invalid_count"],
                    "total_count": data["total_count"],
                }
            )

    # Check consistency
    for col, data in metrics["consistency"]["column_consistency"].items():
        if data["consistency"] < threshold:
            problematic["consistency"].append(
                {
                    "column": col,
                    "score": data["consistency"],
                    "data_type": data["data_type"],
                }
            )

    # Sort each category by score (worst first)
    for category in problematic:
        problematic[category] = sorted(problematic[category], key=lambda x: x["score"])

    return problematic


def calculate_column_statistics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate statistical summary for dataset columns.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with column statistics
    """
    stats = {}

    for col in df.columns:
        col_stats = {
            "data_type": str(df[col].dtype),
            "non_null_count": int(df[col].count()),
            "null_count": int(df[col].isna().sum()),
        }

        # For numeric columns, add statistical measures
        if pd.api.types.is_numeric_dtype(df[col]):
            col_data = df[col].dropna()
            if len(col_data) > 0:
                col_stats.update(
                    {
                        "min": float(col_data.min()),
                        "max": float(col_data.max()),
                        "mean": float(col_data.mean()),
                        "median": float(col_data.median()),
                        "std": float(col_data.std()) if len(col_data) > 1 else 0.0,
                    }
                )

        # For string columns, add text statistics
        elif pd.api.types.is_string_dtype(df[col]) or df[col].dtype == "object":
            col_data = df[col].dropna()
            if len(col_data) > 0:
                lengths = col_data.astype(str).str.len()
                col_stats.update(
                    {
                        "min_length": int(lengths.min()) if len(lengths) > 0 else 0,
                        "max_length": int(lengths.max()) if len(lengths) > 0 else 0,
                        "avg_length": float(lengths.mean()) if len(lengths) > 0 else 0.0,
                        "unique_values": int(df[col].nunique()),
                    }
                )

        stats[col] = col_stats

    return stats


def get_data_type_distribution(df: pd.DataFrame) -> Dict[str, int]:
    """Get distribution of data types in the dataset.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with count of columns per data type
    """
    type_counts = {}

    for col in df.columns:
        dtype = str(df[col].dtype)

        # Simplify dtype names
        if "int" in dtype:
            dtype = "integer"
        elif "float" in dtype:
            dtype = "float"
        elif "object" in dtype or "string" in dtype:
            dtype = "text"
        elif "bool" in dtype:
            dtype = "boolean"
        elif "datetime" in dtype:
            dtype = "datetime"

        type_counts[dtype] = type_counts.get(dtype, 0) + 1

    return type_counts


def generate_quality_report(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate comprehensive quality report.

    Args:
        df: Input DataFrame

    Returns:
        Dictionary with quality report including metrics and recommendations
    """
    metrics = calculate_all_metrics(df)

    # Identify problematic columns
    problematic_columns = identify_problematic_columns(metrics)

    # Calculate column statistics
    column_stats = calculate_column_statistics(df)

    # Get data type distribution
    data_type_distribution = get_data_type_distribution(df)

    # Generate recommendations based on metrics
    recommendations = []

    if metrics["completeness"]["overall_completeness"] < 90:
        # Find most incomplete columns
        incomplete_cols = problematic_columns["completeness"][:3]
        col_names = [c["column"] for c in incomplete_cols]

        msg = f"Dataset has {metrics['completeness']['overall_completeness']:.1f}% completeness. Consider reviewing missing values."
        if col_names:
            msg += f" Most problematic columns: {', '.join(col_names)}."

        recommendations.append(
            {
                "severity": "high",
                "category": "completeness",
                "message": msg,
            }
        )

    if metrics["uniqueness"]["overall_uniqueness"] < 95:
        recommendations.append(
            {
                "severity": "medium",
                "category": "uniqueness",
                "message": f"Found {metrics['uniqueness']['duplicate_rows']} duplicate rows. Consider removing duplicates.",
            }
        )

    if metrics["validity"]["overall_validity"] < 95:
        # Find columns with most invalid values
        invalid_cols = problematic_columns["validity"][:3]
        col_names = [c["column"] for c in invalid_cols]

        msg = f"Dataset has {metrics['validity']['overall_validity']:.1f}% validity. Review invalid values."
        if col_names:
            msg += f" Most problematic columns: {', '.join(col_names)}."

        recommendations.append(
            {
                "severity": "high",
                "category": "validity",
                "message": msg,
            }
        )

    if metrics["consistency"]["overall_consistency"] < 80:
        # Find columns with consistency issues
        inconsistent_cols = problematic_columns["consistency"][:3]
        col_names = [c["column"] for c in inconsistent_cols]

        msg = "Some columns show inconsistent formatting. Consider standardizing data formats."
        if col_names:
            msg += f" Most problematic columns: {', '.join(col_names)}."

        recommendations.append(
            {
                "severity": "medium",
                "category": "consistency",
                "message": msg,
            }
        )

    # Calculate overall quality score (weighted average)
    quality_score = (
        metrics["completeness"]["overall_completeness"] * 0.3
        + metrics["uniqueness"]["overall_uniqueness"] * 0.2
        + metrics["validity"]["overall_validity"] * 0.3
        + metrics["consistency"]["overall_consistency"] * 0.2
    )

    return {
        "metrics": metrics,
        "recommendations": recommendations,
        "overall_quality_score": round(quality_score, 2),
        "generated_at": datetime.now().isoformat(),
        "problematic_columns": problematic_columns,
        "column_statistics": column_stats,
        "data_type_distribution": data_type_distribution,
    }
