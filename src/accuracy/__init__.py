"""Data Accuracy module for comparing and correcting datasets."""

from .config import AccuracyConfig
from .processor import (
    coerce_numeric,
    compare_and_correct,
    handle_duplicates,
    normalize_column_name,
    normalize_key_value,
    read_dataset,
    strip_accents,
)
from .routes import accuracy_bp

__all__ = [
    "AccuracyConfig",
    "accuracy_bp",
    "normalize_column_name",
    "strip_accents",
    "normalize_key_value",
    "coerce_numeric",
    "read_dataset",
    "handle_duplicates",
    "compare_and_correct",
]
