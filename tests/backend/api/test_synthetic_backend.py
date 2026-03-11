"""Tests for synthetic data generation backend."""

import re
import pytest
from unittest.mock import MagicMock, patch
from src.synthetic.validators import (
    validate_schema,
    validate_generate_request,
    validate_preview_request,
)
from src.synthetic.generator import SyntheticDataGenerator, _LLM_MAX_ROWS_PER_CALL


class TestValidators:
    """Test validation functions."""

    def test_validate_schema_valid(self):
        """Test valid schema validation."""
        schema = {
            "columns": [
                {"name": "id", "type": "integer", "options": {"min": 1, "max": 100}},
                {"name": "name", "type": "string", "options": {}},
                {"name": "email", "type": "email", "options": {}},
            ]
        }
        is_valid, errors = validate_schema(schema)
        assert is_valid
        assert len(errors) == 0

    def test_validate_schema_missing_columns(self):
        """Test schema validation with missing columns."""
        schema = {}
        is_valid, errors = validate_schema(schema)
        assert not is_valid
        assert len(errors) > 0  # Just verify there are errors

    def test_validate_schema_empty_columns(self):
        """Test schema validation with empty columns."""
        schema = {"columns": []}
        is_valid, errors = validate_schema(schema)
        assert not is_valid
        assert any("at least one column" in err.lower() for err in errors)

    def test_validate_schema_duplicate_names(self):
        """Test schema validation with duplicate column names."""
        schema = {
            "columns": [
                {"name": "id", "type": "integer"},
                {"name": "id", "type": "string"},
            ]
        }
        is_valid, errors = validate_schema(schema)
        assert not is_valid
        assert any("duplicate" in err.lower() for err in errors)

    def test_validate_schema_unsupported_type(self):
        """Test schema validation with unsupported type."""
        schema = {"columns": [{"name": "test", "type": "unsupported_type"}]}
        is_valid, errors = validate_schema(schema)
        assert not is_valid
        assert any("unsupported type" in err.lower() for err in errors)

    def test_validate_schema_invalid_numeric_range(self):
        """Test schema validation with invalid numeric range."""
        schema = {
            "columns": [
                {"name": "value", "type": "integer", "options": {"min": 100, "max": 10}}
            ]
        }
        is_valid, errors = validate_schema(schema)
        assert not is_valid
        assert any("min must be less than max" in err.lower() for err in errors)

    def test_validate_schema_missing_date_options(self):
        """Test schema validation with missing date options."""
        schema = {"columns": [{"name": "created", "type": "date", "options": {}}]}
        is_valid, errors = validate_schema(schema)
        assert not is_valid
        assert any("start" in err.lower() and "end" in err.lower() for err in errors)

    def test_validate_generate_request_valid(self):
        """Test valid generate request."""
        request = {
            "schema": {"columns": [{"name": "id", "type": "integer", "options": {}}]},
            "rows": 1000,
            "fileType": "csv",
        }
        is_valid, errors = validate_generate_request(request, max_rows=1000000)
        assert is_valid
        assert len(errors) == 0

    def test_validate_generate_request_exceeds_max_rows(self):
        """Test generate request exceeding max rows."""
        request = {
            "schema": {"columns": [{"name": "id", "type": "integer", "options": {}}]},
            "rows": 2000000,
            "fileType": "csv",
        }
        is_valid, errors = validate_generate_request(request, max_rows=1000000)
        assert not is_valid
        assert any("1,000,000" in err for err in errors)

    def test_validate_generate_request_invalid_file_type(self):
        """Test generate request with invalid file type."""
        request = {
            "schema": {"columns": [{"name": "id", "type": "integer", "options": {}}]},
            "rows": 1000,
            "fileType": "invalid",
        }
        is_valid, errors = validate_generate_request(request, max_rows=1000000)
        assert not is_valid
        assert any("unsupported file type" in err.lower() for err in errors)

    def test_validate_preview_request_valid(self):
        """Test valid preview request."""
        request = {
            "schema": {"columns": [{"name": "id", "type": "integer", "options": {}}]},
            "rows": 50,
        }
        is_valid, errors = validate_preview_request(request)
        assert is_valid
        assert len(errors) == 0

    def test_validate_preview_request_too_many_rows(self):
        """Test preview request with too many rows."""
        request = {
            "schema": {"columns": [{"name": "id", "type": "integer", "options": {}}]},
            "rows": 200,
        }
        is_valid, errors = validate_preview_request(request)
        assert not is_valid
        assert any("between 1 and 100" in err.lower() for err in errors)


class TestSyntheticDataGenerator:
    """Test SyntheticDataGenerator class."""

    def test_generator_initialization(self):
        """Test generator initialization."""
        generator = SyntheticDataGenerator(api_key="test-key", model="test-model")
        assert generator.api_key == "test-key"
        assert generator.model == "test-model"

    def test_build_prompt(self):
        """Test prompt building."""
        generator = SyntheticDataGenerator(api_key="test-key")
        schema = {
            "columns": [
                {"name": "id", "type": "integer", "options": {"min": 1, "max": 100}},
                {"name": "name", "type": "string", "options": {}},
            ]
        }

        prompt = generator._build_prompt(schema, 10, locale="pt_BR", seed=42)

        assert "10 rows" in prompt
        assert "id" in prompt
        assert "name" in prompt
        assert "pt_BR" in prompt
        assert "seed 42" in prompt

    def test_parse_csv_response(self):
        """Test CSV response parsing."""
        generator = SyntheticDataGenerator(api_key="test-key")

        csv_text = """1,John,john@example.com
2,Jane,jane@example.com
3,Bob,bob@example.com"""

        rows = generator._parse_csv_response(csv_text, num_columns=3)

        assert len(rows) == 3
        assert rows[0] == ["1", "John", "john@example.com"]
        assert rows[1] == ["2", "Jane", "jane@example.com"]

    def test_parse_csv_response_with_markdown(self):
        """Test CSV response parsing with markdown code blocks."""
        generator = SyntheticDataGenerator(api_key="test-key")

        csv_text = """```csv
1,John,john@example.com
2,Jane,jane@example.com
```"""

        rows = generator._parse_csv_response(csv_text, num_columns=3)

        assert len(rows) == 2
        assert rows[0] == ["1", "John", "john@example.com"]

    def test_coerce_types(self):
        """Test type coercion."""
        generator = SyntheticDataGenerator(api_key="test-key")

        schema = {
            "columns": [
                {"name": "id", "type": "integer"},
                {"name": "price", "type": "float"},
                {"name": "active", "type": "boolean"},
                {"name": "name", "type": "string"},
            ]
        }

        rows = [
            ["1", "19.99", "true", "Product A"],
            ["2", "29.99", "false", "Product B"],
        ]

        records = generator._coerce_types(rows, schema)

        assert len(records) == 2
        assert records[0]["id"] == 1
        assert records[0]["price"] == pytest.approx(19.99)
        assert records[0]["active"] is True
        assert records[0]["name"] == "Product A"
        assert records[1]["active"] is False

    def test_enforce_uniqueness(self):
        """Test uniqueness enforcement."""
        generator = SyntheticDataGenerator(api_key="test-key")

        schema = {
            "columns": [
                {"name": "id", "type": "integer", "options": {"unique": True}},
                {"name": "name", "type": "string"},
            ]
        }

        records = [
            {"id": 1, "name": "A"},
            {"id": 2, "name": "B"},
            {"id": 1, "name": "C"},  # Duplicate ID
            {"id": 3, "name": "D"},
        ]

        unique_records = generator._enforce_uniqueness(records, schema)

        assert len(unique_records) == 3  # Duplicate removed
        ids = [r["id"] for r in unique_records]
        assert ids == [1, 2, 3]

    def test_generate_mock_data(self):
        """Test mock data generation."""
        generator = SyntheticDataGenerator(api_key="")  # No API key

        schema = {
            "columns": [
                {"name": "id", "type": "integer", "options": {"min": 1, "max": 100}},
                {"name": "price", "type": "price", "options": {"min": 10, "max": 100}},
                {"name": "active", "type": "boolean"},
                {"name": "created", "type": "date"},
            ]
        }

        records = generator._generate_mock_data(schema, 10)

        assert len(records) == 10
        assert all("id" in r for r in records)
        assert all("price" in r for r in records)
        assert all("active" in r for r in records)
        assert all("created" in r for r in records)

        # Check types
        assert all(isinstance(r["id"], int) for r in records)
        assert all(isinstance(r["price"], float) for r in records)
        assert all(isinstance(r["active"], bool) for r in records)

    def test_generate_mock_data_with_datetime(self):
        """Test mock data generation with datetime type."""
        generator = SyntheticDataGenerator(api_key="")  # No API key

        schema = {
            "columns": [
                {"name": "id", "type": "integer", "options": {"min": 1, "max": 100}},
                {"name": "created_at", "type": "datetime", "options": {"start": "2020-01-01", "end": "2025-12-31"}},
                {"name": "updated_at", "type": "datetime", "options": {}},
            ]
        }

        records = generator._generate_mock_data(schema, 10)

        assert len(records) == 10
        assert all("id" in r for r in records)
        assert all("created_at" in r for r in records)
        assert all("updated_at" in r for r in records)

        # Check datetime format (should be YYYY-MM-DD HH:MM:SS)
        datetime_pattern = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$')
        for record in records:
            assert datetime_pattern.match(record["created_at"]), f"Invalid datetime format: {record['created_at']}"
            assert datetime_pattern.match(record["updated_at"]), f"Invalid datetime format: {record['updated_at']}"
            # Ensure datetime is not the mock string pattern
            assert not record["created_at"].startswith("mock_"), f"Datetime should not be mock string: {record['created_at']}"
            assert not record["updated_at"].startswith("mock_"), f"Datetime should not be mock string: {record['updated_at']}"

    def test_generate_mock_data_with_swapped_dates(self):
        """Test mock data generation with start date after end date (should auto-swap)."""
        generator = SyntheticDataGenerator(api_key="")  # No API key

        schema = {
            "columns": [
                {"name": "id", "type": "integer", "options": {"min": 1, "max": 100}},
                # Deliberately swap start and end dates
                {"name": "created_at", "type": "datetime", "options": {"start": "2025-12-31", "end": "2020-01-01"}},
            ]
        }

        records = generator._generate_mock_data(schema, 5)

        assert len(records) == 5
        # Check that dates are still generated correctly (should auto-swap internally)
        datetime_pattern = re.compile(r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$')
        for record in records:
            assert datetime_pattern.match(record["created_at"]), f"Invalid datetime format: {record['created_at']}"


class TestGenerateBatchLargeRowHandling:
    """Tests for generate_batch behaviour with large row counts and LLM failures."""

    SCHEMA = {
        "columns": [
            {"name": "id", "type": "integer", "options": {"min": 1, "max": 1000000}},
            {"name": "name", "type": "string", "options": {}},
        ]
    }

    def _make_generator_with_mock_llm(self, llm_side_effect=None, llm_return_value=None):
        """Return a SyntheticDataGenerator with a mocked LLM client."""
        generator = SyntheticDataGenerator.__new__(SyntheticDataGenerator)
        generator.api_key = "fake-key"
        generator.model = "fake-model"
        generator._llm_available = True
        mock_client = MagicMock()
        if llm_side_effect is not None:
            mock_client.generate.side_effect = llm_side_effect
        elif llm_return_value is not None:
            mock_client.generate.return_value = llm_return_value
        generator.llm_client = mock_client
        return generator

    def _csv_for_n_rows(self, n, start=1):
        """Generate a valid CSV string for n rows (id, name)."""
        lines = [f"{start + i},name_{start + i}" for i in range(n)]
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Sub-batching tests
    # ------------------------------------------------------------------

    def test_llm_max_rows_per_call_constant_is_100(self):
        """_LLM_MAX_ROWS_PER_CALL should be 100 so ≤100-row requests stay
        in a single LLM call while larger requests are split."""
        assert _LLM_MAX_ROWS_PER_CALL == 100

    def test_large_request_is_split_into_sub_batches(self):
        """Requesting >100 rows must trigger sub-batching; each sub-call
        should receive at most _LLM_MAX_ROWS_PER_CALL rows."""
        call_sizes = []

        def capture_prompt(messages, **kwargs):
            content = messages[0]["content"]
            # Extract row count from "Generate X rows…"
            import re as _re
            m = _re.search(r"Generate (\d+) rows", content)
            if m:
                call_sizes.append(int(m.group(1)))
            # Return enough rows for the requested count
            n = int(m.group(1)) if m else 1
            return self._csv_for_n_rows(n)

        generator = self._make_generator_with_mock_llm(llm_side_effect=capture_prompt)
        records, logs = generator.generate_batch(self.SCHEMA, num_rows=200)

        assert len(records) == 200
        # Each individual LLM call must be ≤ _LLM_MAX_ROWS_PER_CALL
        assert all(n <= _LLM_MAX_ROWS_PER_CALL for n in call_sizes), (
            f"Some LLM calls requested more than {_LLM_MAX_ROWS_PER_CALL} rows: {call_sizes}"
        )

    def test_exact_threshold_uses_single_call(self):
        """Requesting exactly _LLM_MAX_ROWS_PER_CALL rows must NOT trigger
        sub-batching (one LLM call)."""
        call_count = [0]

        def counting_side_effect(messages, **kwargs):
            call_count[0] += 1
            return self._csv_for_n_rows(_LLM_MAX_ROWS_PER_CALL)

        generator = self._make_generator_with_mock_llm(llm_side_effect=counting_side_effect)
        records, _ = generator.generate_batch(self.SCHEMA, num_rows=_LLM_MAX_ROWS_PER_CALL)

        assert call_count[0] == 1
        assert len(records) == _LLM_MAX_ROWS_PER_CALL

    # ------------------------------------------------------------------
    # Bug-fix: return [], logs → fallback when all retries return too few rows
    # ------------------------------------------------------------------

    def test_insufficient_rows_all_retries_falls_back_to_mock_data(self):
        """When all retries return fewer than 80% of requested rows (no
        exception), generate_batch must return the requested count via
        mock-data fill instead of an empty list."""
        # LLM always returns only 70 rows when 100 are requested
        generator = self._make_generator_with_mock_llm(
            llm_return_value=self._csv_for_n_rows(70)
        )
        records, logs = generator.generate_batch(self.SCHEMA, num_rows=100, max_retries=2)

        assert len(records) == 100, (
            "Expected 100 records but got an empty list – the return [], logs bug may have reappeared"
        )
        assert any("filling remainder with mock data" in log for log in logs), (
            "Expected a log message about filling with mock data"
        )

    def test_insufficient_rows_result_is_never_empty(self):
        """generate_batch must never return an empty list regardless of how
        many retries fail the 80% threshold."""
        generator = self._make_generator_with_mock_llm(
            llm_return_value=self._csv_for_n_rows(10)  # 10/100 = 10%, well below 80%
        )
        records, logs = generator.generate_batch(self.SCHEMA, num_rows=100, max_retries=3)

        assert len(records) > 0, "generate_batch must never return an empty list"
        assert len(records) == 100

    def test_best_partial_rows_are_kept_when_retries_exhausted(self):
        """The best partial LLM result should be used (not discarded) when
        retries are exhausted via the insufficient-rows path."""
        attempt_num = [0]

        def improving_side_effect(messages, **kwargs):
            attempt_num[0] += 1
            # Return progressively more rows but always < 80 (threshold for 100)
            rows = 50 + attempt_num[0] * 5  # 55, 60, 65 – all < 80
            return self._csv_for_n_rows(rows)

        generator = self._make_generator_with_mock_llm(llm_side_effect=improving_side_effect)
        records, logs = generator.generate_batch(self.SCHEMA, num_rows=100, max_retries=3)

        # Should have 100 rows (best partial 65 + 35 mock fill)
        assert len(records) == 100
        # The mock-fill log should be present
        assert any("filling remainder with mock data" in log for log in logs)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
