"""Serialization utilities for converting data to JSON-compatible formats."""

import numpy as np


def convert_to_json_serializable(obj):
    """Convert numpy/pandas types to JSON serializable types.

    Args:
        obj: Object to convert (can be numpy/pandas types, dict, list, or primitive)

    Returns:
        JSON-serializable version of the object
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    return obj
