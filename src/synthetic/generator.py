"""Core synthetic data generator using LLM."""

import csv
import io
import json
import os
import random
import re
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

# Use relative import instead of sys.path manipulation
try:
    from ..llm_client import create_llm_client
except ImportError:
    # Fallback for when run directly (not as package)
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from llm_client import create_llm_client


class SyntheticDataGenerator:
    """Generates synthetic data using LLM."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
    ):
        """Initialize generator.

        Args:
            api_key: API key for Anthropic (optional, can use env var)
            model: Model name to use (optional, can use env var)
            provider: LLM provider ('anthropic' or 'ollama', optional, defaults to env var or 'ollama')
        """
        self.llm_client = None
        self._llm_available = False
        self.api_key = api_key
        self.model = model

        # Try to initialize LLM client
        try:
            # Determine provider
            provider = provider or os.getenv("LLM_PROVIDER", "ollama")

            # Validate model/provider compatibility
            if model:
                if provider == "gemini" and (
                    model.startswith("claude") or "qwen" in model or "llama" in model
                ):
                    print(
                        f"[ERROR] Model '{model}' is not compatible with Gemini provider. Use a Gemini model like 'gemini-2.0-flash-exp'"
                    )
                    raise ValueError(f"Model {model} is not compatible with provider {provider}")
                elif provider == "anthropic" and (
                    model.startswith("gemini") or "qwen" in model or "llama" in model
                ):
                    print(
                        f"[ERROR] Model '{model}' is not compatible with Anthropic provider. Use a Claude model like 'claude-3-haiku-20240307'"
                    )
                    raise ValueError(f"Model {model} is not compatible with provider {provider}")
                elif provider == "ollama" and (
                    model.startswith("gemini") or model.startswith("claude")
                ):
                    print(
                        f"[ERROR] Model '{model}' is not compatible with Ollama provider. Use an Ollama model like 'qwen2.5-coder:7b'"
                    )
                    raise ValueError(f"Model {model} is not compatible with provider {provider}")

            # Create LLM client based on provider
            self.llm_client = create_llm_client(
                provider=provider,
                api_key=api_key,
                model=model,
            )
            self._llm_available = True
            print(
                f"[OK] LLM client initialized for synthetic data generation (provider: {provider}, model: {model or 'default'})"
            )
        except (ImportError, ValueError) as e:
            # Log the error but don't fail - will use mock data instead
            print(f"[WARNING] Could not initialize LLM client: {e}")
            print("Synthetic data generation will use mock data fallback")
            self._llm_available = False

    def _build_prompt(
        self,
        schema: Dict[str, Any],
        num_rows: int,
        locale: str = "pt_BR",
        seed: Optional[int] = None,
    ) -> str:
        """Build LLM prompt for data generation.

        Args:
            schema: Column schema
            num_rows: Number of rows to generate
            locale: Locale for data generation
            seed: Random seed for reproducibility

        Returns:
            Prompt string
        """
        columns = schema.get("columns", [])

        # Build column descriptions
        col_descriptions = []
        for col in columns:
            name = col["name"]
            col_type = col["type"]
            options = col.get("options", {})

            desc = f"- {name} ({col_type})"

            # Add type-specific constraints
            if col_type in ["integer", "float", "price"]:
                if "min" in options and "max" in options:
                    desc += f": range [{options['min']}, {options['max']}]"
                if col_type in ["float", "price"] and "decimals" in options:
                    desc += f", {options['decimals']} decimal places"

            elif col_type in ["date", "datetime"]:
                if "start" in options and "end" in options:
                    desc += f": between {options['start']} and {options['end']}"
                if "format" in options:
                    desc += f", format: {options['format']}"

            elif col_type == "category":
                if "categories" in options:
                    cats = options["categories"]
                    if isinstance(cats, list):
                        desc += f": choose from {cats}"
                    elif isinstance(cats, dict):
                        desc += f": weighted choices {cats}"

            elif col_type == "string":
                if "length" in options:
                    desc += f": approximately {options['length']} characters"
                if "vocabulary" in options:
                    desc += f", vocabulary: {options['vocabulary']}"

            elif col_type == "custom_pattern":
                if "pattern" in options:
                    desc += f": pattern '{options['pattern']}'"
                if "description" in options:
                    desc += f": {options['description']}"

            # Add null percentage if specified
            if options.get("allow_nulls", 0) > 0:
                desc += f", allow {options['allow_nulls']}% nulls"

            # Add uniqueness constraint
            if options.get("unique", False):
                desc += ", MUST BE UNIQUE"

            col_descriptions.append(desc)

        # Build the prompt
        prompt = f"""Generate {num_rows} rows of synthetic data in CSV format (no header) following this schema:

{chr(10).join(col_descriptions)}

Requirements:
- Locale: {locale} (use appropriate formats, names, addresses for this locale)
- Output ONLY the CSV data, no explanations or markdown
- Use comma as delimiter, quote strings with commas
- Follow RFC 4180 CSV format strictly
- For date/datetime, use ISO format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS) unless specified otherwise
- For boolean, use 'true' or 'false'
- For null values, use empty field
- Ensure data is realistic and coherent
- For unique columns, ensure all values are distinct"""

        if seed is not None:
            prompt += f"\n- Use seed {seed} for reproducibility"

        prompt += "\n\nGenerate the CSV data now:"

        return prompt

    def _parse_csv_response(self, response_text: str, num_columns: int) -> List[List[Any]]:
        """Parse LLM CSV response into rows.

        Args:
            response_text: Raw LLM response
            num_columns: Expected number of columns

        Returns:
            List of rows (each row is a list of values)
        """
        # Clean up response - remove markdown code blocks if present
        text = response_text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first and last line if they are markdown fences
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines)

        # Parse CSV
        rows = []
        reader = csv.reader(io.StringIO(text))
        for row in reader:
            # Skip empty rows
            if not row or all(not cell.strip() for cell in row):
                continue
            # Skip header row if present (heuristic: check if first cell is a column name)
            if rows == [] and any(char.isalpha() for char in row[0]) and "_" in row[0]:
                continue
            rows.append(row)

        # Validate column count
        valid_rows = []
        for row in rows:
            if len(row) == num_columns:
                valid_rows.append(row)

        return valid_rows

    def _coerce_types(self, rows: List[List[str]], schema: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Coerce string values to proper types.

        Args:
            rows: List of string rows
            schema: Column schema

        Returns:
            List of dictionaries with properly typed values
        """
        columns = schema.get("columns", [])
        result = []

        for row in rows:
            record = {}
            for i, col in enumerate(columns):
                if i >= len(row):
                    record[col["name"]] = None
                    continue

                value = row[i].strip()
                col_type = col["type"]

                # Handle empty/null values
                if not value or value.lower() in ["null", "none", ""]:
                    record[col["name"]] = None
                    continue

                # Type coercion
                try:
                    if col_type == "integer":
                        record[col["name"]] = int(float(value))
                    elif col_type in ["float", "price"]:
                        record[col["name"]] = float(value)
                    elif col_type == "boolean":
                        record[col["name"]] = value.lower() in ["true", "1", "yes"]
                    elif col_type in ["date", "datetime"]:
                        # Keep as string for now (could parse to datetime if needed)
                        record[col["name"]] = value
                    else:
                        # String types
                        record[col["name"]] = value
                except (ValueError, TypeError):
                    # If coercion fails, use None
                    record[col["name"]] = None

            result.append(record)

        return result

    def _enforce_uniqueness(
        self, records: List[Dict[str, Any]], schema: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Enforce uniqueness constraints on columns.

        Args:
            records: List of records
            schema: Column schema

        Returns:
            List of records with unique values enforced
        """
        columns = schema.get("columns", [])

        # Find unique columns
        unique_cols = [
            col["name"] for col in columns if col.get("options", {}).get("unique", False)
        ]

        if not unique_cols:
            return records

        # Track seen values for each unique column
        seen = {col: set() for col in unique_cols}
        result = []

        for record in records:
            # Check if all unique columns have unique values
            is_unique = True
            for col in unique_cols:
                val = record.get(col)
                if val is not None and val in seen[col]:
                    is_unique = False
                    break

            if is_unique:
                # Add to result and mark values as seen
                for col in unique_cols:
                    val = record.get(col)
                    if val is not None:
                        seen[col].add(val)
                result.append(record)

        return result

    def generate_batch(
        self,
        schema: Dict[str, Any],
        num_rows: int,
        locale: str = "pt_BR",
        seed: Optional[int] = None,
        max_retries: int = 3,
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """Generate a batch of synthetic data.

        Args:
            schema: Column schema
            num_rows: Number of rows to generate
            locale: Locale for generation
            seed: Random seed
            max_retries: Maximum number of retries on parse failure

        Returns:
            Tuple of (records, logs)
        """
        logs = []

        if not self._llm_available or not self.llm_client:
            logs.append("ERROR: No LLM configured, using mock data")
            return self._generate_mock_data(schema, num_rows), logs

        # Build prompt
        prompt = self._build_prompt(schema, num_rows, locale, seed)
        logs.append(f"Generated prompt for {num_rows} rows")

        # Try to generate data with retries
        for attempt in range(max_retries):
            try:
                logs.append(f"Calling LLM (attempt {attempt + 1}/{max_retries})...")

                # Call LLM using abstraction layer
                response_text = self.llm_client.generate(
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=4096,
                    temperature=0.7 if seed is None else 0.3,
                )

                logs.append(f"Received response ({len(response_text)} chars)")

                # Parse CSV response
                num_columns = len(schema.get("columns", []))
                rows = self._parse_csv_response(response_text, num_columns)
                logs.append(f"Parsed {len(rows)} rows from CSV")

                if len(rows) < num_rows * 0.8:  # At least 80% of requested rows
                    logs.append(f"WARNING: Only got {len(rows)}/{num_rows} rows, retrying...")
                    continue

                # Coerce types
                records = self._coerce_types(rows, schema)
                logs.append(f"Coerced types for {len(records)} records")

                # Enforce uniqueness
                records = self._enforce_uniqueness(records, schema)
                logs.append(f"Enforced uniqueness: {len(records)} unique records")

                return records[:num_rows], logs

            except Exception as e:
                logs.append(f"ERROR on attempt {attempt + 1}: {str(e)}")
                if attempt == max_retries - 1:
                    logs.append("Max retries reached, using mock data")
                    return self._generate_mock_data(schema, num_rows), logs
                time.sleep(1)  # Brief delay before retry

        return [], logs

    def _generate_random_date(
        self, start_str: str, end_str: str, include_time: bool = False
    ) -> str:
        """Generate a random date or datetime within a range.

        Args:
            start_str: Start date in YYYY-MM-DD format
            end_str: End date in YYYY-MM-DD format
            include_time: If True, include time component (for datetime)

        Returns:
            Random date string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
        """
        try:
            start_date = datetime.strptime(start_str, "%Y-%m-%d")
            end_date = datetime.strptime(end_str, "%Y-%m-%d")

            # Ensure start_date is before or equal to end_date
            if start_date > end_date:
                start_date, end_date = end_date, start_date

            days_between = (end_date - start_date).days
            random_days = random.randint(0, max(0, days_between))
            random_date = start_date + timedelta(days=random_days)

            if include_time:
                # Add random time component for datetime
                random_hour = random.randint(0, 23)
                random_minute = random.randint(0, 59)
                random_second = random.randint(0, 59)
                random_datetime = random_date + timedelta(
                    hours=random_hour, minutes=random_minute, seconds=random_second
                )
                return random_datetime.strftime("%Y-%m-%d %H:%M:%S")
            else:
                return random_date.strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            # Fallback if date parsing fails
            if include_time:
                return (
                    f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d} "
                    f"{random.randint(0,23):02d}:{random.randint(0,59):02d}:{random.randint(0,59):02d}"
                )
            else:
                return f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}"

    def _generate_mock_data(self, schema: Dict[str, Any], num_rows: int) -> List[Dict[str, Any]]:
        """Generate mock data without LLM (fallback).

        Args:
            schema: Column schema
            num_rows: Number of rows

        Returns:
            List of mock records
        """
        columns = schema.get("columns", [])
        records = []

        for i in range(num_rows):
            record = {}
            for col in columns:
                name = col["name"]
                col_type = col["type"]
                options = col.get("options", {})

                # Simple mock generation
                if col_type == "integer":
                    min_val = options.get("min", 0)
                    max_val = options.get("max", 100)
                    record[name] = random.randint(min_val, max_val)
                elif col_type in ["float", "price"]:
                    min_val = options.get("min", 0)
                    max_val = options.get("max", 100)
                    record[name] = round(random.uniform(min_val, max_val), 2)
                elif col_type == "boolean":
                    record[name] = random.choice([True, False])
                elif col_type == "date":
                    # Generate date with optional range constraints
                    start_date_str = options.get("start", "2020-01-01")
                    end_date_str = options.get("end", "2025-12-31")
                    record[name] = self._generate_random_date(
                        start_date_str, end_date_str, include_time=False
                    )
                elif col_type == "datetime":
                    # Generate datetime with optional range constraints
                    start_date_str = options.get("start", "2020-01-01")
                    end_date_str = options.get("end", "2025-12-31")
                    record[name] = self._generate_random_date(
                        start_date_str, end_date_str, include_time=True
                    )
                elif col_type == "uuid":
                    record[name] = f"mock-uuid-{i:06d}"
                else:
                    record[name] = f"mock_{name}_{i}"

            records.append(record)

        return records
