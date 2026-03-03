"""Validators for synthetic data generation schemas and requests."""

from typing import Any, Dict, List, Tuple

SUPPORTED_TYPES = {
    "string",
    "integer",
    "float",
    "boolean",
    "date",
    "datetime",
    "category",
    "email",
    "phone",
    "address",
    "product_name",
    "price",
    "uuid",
    "custom_pattern",
}

SUPPORTED_FILE_TYPES = {"csv", "xlsx", "json", "parquet"}


def validate_schema(schema: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate dataset schema.

    Args:
        schema: Schema dictionary with 'columns' list

    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []

    if not schema:
        errors.append("Schema is required")
        return False, errors

    if "columns" not in schema:
        errors.append("Schema must have 'columns' key")
        return False, errors

    columns = schema["columns"]
    if not isinstance(columns, list):
        errors.append("'columns' must be a list")
        return False, errors

    if not columns:
        errors.append("At least one column is required")
        return False, errors

    if len(columns) > 50:
        errors.append("Maximum 50 columns allowed")
        return False, errors

    # Track column names for uniqueness
    column_names = set()

    for i, col in enumerate(columns):
        if not isinstance(col, dict):
            errors.append(f"Column {i} must be a dictionary")
            continue

        # Validate name
        if "name" not in col:
            errors.append(f"Column {i} is missing 'name'")
            continue

        name = col["name"]
        if not name or not isinstance(name, str):
            errors.append(f"Column {i} has invalid name")
            continue

        if name in column_names:
            errors.append(f"Duplicate column name: {name}")
        column_names.add(name)

        # Validate type
        if "type" not in col:
            errors.append(f"Column '{name}' is missing 'type'")
            continue

        col_type = col["type"]
        if col_type not in SUPPORTED_TYPES:
            errors.append(
                f"Column '{name}' has unsupported type '{col_type}'. "
                f"Supported types: {', '.join(sorted(SUPPORTED_TYPES))}"
            )

        # Validate options based on type
        options = col.get("options", {})
        if not isinstance(options, dict):
            errors.append(f"Column '{name}' options must be a dictionary")
            continue

        # Type-specific validation
        if col_type in ["integer", "float", "price"]:
            if "min" in options and "max" in options:
                try:
                    min_val = float(options["min"])
                    max_val = float(options["max"])
                    if min_val >= max_val:
                        errors.append(f"Column '{name}': min must be less than max")
                except (ValueError, TypeError):
                    errors.append(f"Column '{name}': min/max must be numeric")

        elif col_type in ["date", "datetime"]:
            if "start" not in options or "end" not in options:
                errors.append(f"Column '{name}': date/datetime requires 'start' and 'end' options")

        elif col_type == "category":
            if "categories" not in options:
                errors.append(f"Column '{name}': category type requires 'categories' option")

    return len(errors) == 0, errors


def validate_generate_request(data: Dict[str, Any], max_rows: int) -> Tuple[bool, List[str]]:
    """Validate dataset generation request.

    Args:
        data: Request data dictionary
        max_rows: Maximum allowed rows

    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []

    # Validate schema
    schema_valid, schema_errors = validate_schema(data.get("schema", {}))
    errors.extend(schema_errors)

    # Validate rows
    if "rows" not in data:
        errors.append("'rows' field is required")
    else:
        rows = data["rows"]
        if not isinstance(rows, int):
            errors.append("'rows' must be an integer")
        elif rows < 1:
            errors.append("'rows' must be at least 1")
        elif rows > max_rows:
            errors.append(f"'rows' must not exceed {max_rows:,}")

    # Validate file type
    if "fileType" in data:
        file_type = data["fileType"]
        if file_type not in SUPPORTED_FILE_TYPES:
            errors.append(
                f"Unsupported file type '{file_type}'. "
                f"Supported types: {', '.join(sorted(SUPPORTED_FILE_TYPES))}"
            )

    # Validate batch size if provided
    if "batchSize" in data:
        batch_size = data["batchSize"]
        if not isinstance(batch_size, int) or batch_size < 1:
            errors.append("'batchSize' must be a positive integer")
        elif batch_size > 10000:
            errors.append("'batchSize' should not exceed 10,000")

    return len(errors) == 0, errors


def validate_preview_request(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Validate preview request.

    Args:
        data: Request data dictionary

    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []

    # Validate schema
    schema_valid, schema_errors = validate_schema(data.get("schema", {}))
    errors.extend(schema_errors)

    # Validate rows (should be small for preview)
    if "rows" in data:
        rows = data["rows"]
        if not isinstance(rows, int):
            errors.append("'rows' must be an integer")
        elif rows < 1 or rows > 100:
            errors.append("Preview 'rows' must be between 1 and 100")

    return len(errors) == 0, errors
