"""Tests for Data Accuracy backend."""

import pytest
import tempfile
import shutil
from pathlib import Path
import pandas as pd
import numpy as np
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from src.accuracy.processor import (
    normalize_column_name,
    strip_accents,
    normalize_key_value,
    coerce_numeric,
    read_dataset,
    handle_duplicates,
    compare_and_correct,
)


class TestNormalization:
    """Test normalization functions."""

    def test_normalize_column_name(self):
        """Test column name normalization."""
        assert normalize_column_name("Product ID") == "product_id"
        assert normalize_column_name("Preço Unitário") == "preco_unitario"
        assert normalize_column_name("  spaces  ") == "spaces"
        assert normalize_column_name("dash-name") == "dash_name"

    def test_strip_accents(self):
        """Test accent removal."""
        assert strip_accents("café") == "cafe"
        assert strip_accents("açúcar") == "acucar"
        assert strip_accents("Município") == "Municipio"

    def test_normalize_key_value(self):
        """Test key value normalization."""
        options = {"lowercase": True, "stripAccents": True, "stripPunctuation": True}

        assert normalize_key_value("  Product-123  ", options) == "product123"
        assert normalize_key_value("Café Especial", options) == "cafe especial"
        assert normalize_key_value(np.nan, options) == ""

    def test_coerce_numeric(self):
        """Test numeric coercion."""
        options = {"coerceNumeric": True}

        # US format
        assert coerce_numeric("1,234.56", options) == 1234.56
        # European format
        assert coerce_numeric("1.234,56", options) == 1234.56
        # Simple decimal
        assert coerce_numeric("123.45", options) == 123.45
        # Integer
        assert coerce_numeric(100, options) == 100.0
        # Invalid value
        assert pd.isna(coerce_numeric("invalid-number", options))

    def test_read_dataset_utf8_with_a_single_accent(self, tmp_path):
        """UTF-8 CSV whose only accented character is in the header.

        chardet took so little evidence for ISO-8859-1, which turned the "Mês"
        header into "MÃªs" and made the key column impossible to map.
        """
        csv_file = tmp_path / "target.csv"
        csv_file.write_text(
            'Ano,Mês,UF,IRPF\n2024,Janeiro,CE,"3654460,85"\n2024,Marco,SP,"100,00"\n',
            encoding="utf-8",
        )

        df = read_dataset(csv_file)

        assert list(df.columns) == ["Ano", "Mês", "UF", "IRPF"]
        assert len(df) == 2

    def test_read_dataset_unsupported_type(self):
        """Test unsupported file type."""
        with pytest.raises(ValueError, match="Unsupported file type"):
            read_dataset(Path("unsupported.txt"))

    def test_handle_duplicates_without_numeric_columns(self):
        """Test duplicate policy fallback when no numeric columns are present."""
        df = pd.DataFrame({"produto": ["A", "A", "B"], "categoria": ["x", "x", "y"]})
        result = handle_duplicates(df, ["produto"], policy="sum")
        assert len(result) == 2


class TestCompareAndCorrect:
    """Test compare and correct functionality."""

    def setup_method(self):
        """Setup test data."""
        self.temp_dir = tempfile.mkdtemp()

    def teardown_method(self):
        """Cleanup test data."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_simple_comparison(self):
        """Test simple comparison with one mismatch."""
        # Create GOLD dataset
        gold_df = pd.DataFrame(
            {"produto": ["A", "B", "C"], "preco_unitario": [10.0, 20.0, 30.0]}
        )

        # Create TARGET dataset with one difference
        target_df = pd.DataFrame(
            {
                "produto": ["A", "B", "C"],
                "preco_unitario": [10.0, 25.0, 30.0],  # B is different
            }
        )

        corrected_df, summary, differences = compare_and_correct(
            gold_df,
            target_df,
            key_columns=["produto"],
            value_columns=["preco_unitario"],
            options={
                "normalizeKeys": True,
                "lowercase": True,
                "stripAccents": True,
                "stripPunctuation": True,
                "coerceNumeric": True,
                "decimalPlaces": 2,
                "tolerance": 0.0,
                "targetDuplicatePolicy": "keep_last",
            },
        )

        # Check summary
        assert summary["rows_gold"] == 3
        assert summary["rows_target"] == 3
        assert summary["common_keys"] == 3
        assert summary["missing_in_target"] == 0
        assert summary["extra_in_target"] == 0
        assert summary["mismatches_total"] == 1
        assert summary["accuracy"] > 0.6  # 2 out of 3 match

        # Check differences
        assert len(differences) == 1
        assert differences[0]["column"] == "preco_unitario"
        assert differences[0]["gold"] == 20.0
        assert differences[0]["target"] == 25.0
        assert differences[0]["corrected"] == 20.0

        # Check corrected dataframe
        assert (
            corrected_df[corrected_df["produto"] == "B"]["preco_unitario"].values[0]
            == 20.0
        )

    def test_missing_keys(self):
        """Test with keys missing in target."""
        gold_df = pd.DataFrame(
            {"produto": ["A", "B", "C"], "preco_unitario": [10.0, 20.0, 30.0]}
        )

        target_df = pd.DataFrame(
            {"produto": ["A", "C"], "preco_unitario": [10.0, 30.0]}  # B is missing
        )

        corrected_df, summary, differences = compare_and_correct(
            gold_df,
            target_df,
            key_columns=["produto"],
            value_columns=["preco_unitario"],
            options={},
        )

        assert summary["rows_gold"] == 3
        assert summary["rows_target"] == 2
        assert summary["common_keys"] == 2
        assert summary["missing_in_target"] == 1

    def test_duplicate_in_gold_error(self):
        """Test that duplicates in GOLD raise error."""
        gold_df = pd.DataFrame(
            {
                "produto": ["A", "A", "B"],  # Duplicate A
                "preco_unitario": [10.0, 15.0, 20.0],
            }
        )

        target_df = pd.DataFrame(
            {"produto": ["A", "B"], "preco_unitario": [10.0, 20.0]}
        )

        with pytest.raises(ValueError, match="Duplicate keys found in GOLD dataset"):
            compare_and_correct(
                gold_df,
                target_df,
                key_columns=["produto"],
                value_columns=["preco_unitario"],
                options={},
            )

    def test_duplicate_in_target_keep_last(self):
        """Test duplicate handling in TARGET with keep_last policy."""
        gold_df = pd.DataFrame({"produto": ["A", "B"], "preco_unitario": [10.0, 20.0]})

        target_df = pd.DataFrame(
            {
                "produto": ["A", "A", "B"],  # Duplicate A
                "preco_unitario": [10.0, 15.0, 20.0],
            }
        )

        corrected_df, summary, differences = compare_and_correct(
            gold_df,
            target_df,
            key_columns=["produto"],
            value_columns=["preco_unitario"],
            options={"targetDuplicatePolicy": "keep_last"},
        )

        # After deduplication, should have 2 rows
        assert len(corrected_df) == 2

    def test_tolerance(self):
        """Test comparison with tolerance."""
        gold_df = pd.DataFrame({"produto": ["A"], "preco_unitario": [10.0]})

        target_df = pd.DataFrame(
            {"produto": ["A"], "preco_unitario": [10.05]}  # Within tolerance
        )

        # With tolerance 0.1
        corrected_df, summary, differences = compare_and_correct(
            gold_df,
            target_df,
            key_columns=["produto"],
            value_columns=["preco_unitario"],
            options={"tolerance": 0.1},
        )

        # Should not count as mismatch
        assert summary["mismatches_total"] == 0
        assert len(differences) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
