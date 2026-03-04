"""Tests for Metrics feature."""

import pytest
import json
import tempfile
from pathlib import Path
import pandas as pd
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "src"))

from src.metrics.config import MetricsConfig
from src.metrics.processor import (
    calculate_completeness_metrics,
    calculate_uniqueness_metrics,
    calculate_validity_metrics,
    calculate_consistency_metrics,
    calculate_all_metrics,
    generate_quality_report,
    read_csv_robust,
)


class TestMetricsProcessor:
    """Test metrics calculation functions."""

    def test_calculate_completeness_metrics(self):
        """Test completeness metrics calculation."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, None, 4],
                "col2": ["a", "b", "c", "d"],
                "col3": [None, None, None, None],
            }
        )

        metrics = calculate_completeness_metrics(df)

        # Overall completeness: 7 filled / 12 total = 58.33%
        assert metrics["overall_completeness"] == pytest.approx(58.33, rel=0.1)
        assert metrics["total_cells"] == 12
        assert metrics["missing_cells"] == 5
        assert metrics["filled_cells"] == 7

        # col1: 3/4 = 75%
        assert metrics["column_completeness"]["col1"]["completeness"] == pytest.approx(
            75.0, rel=0.1
        )
        # col2: 4/4 = 100%
        assert metrics["column_completeness"]["col2"]["completeness"] == pytest.approx(
            100.0, rel=0.1
        )
        # col3: 0/4 = 0%
        assert metrics["column_completeness"]["col3"]["completeness"] == pytest.approx(
            0.0, abs=0.1
        )

    def test_calculate_uniqueness_metrics(self):
        """Test uniqueness metrics calculation."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3, 3, 4],
                "name": ["Alice", "Bob", "Charlie", "Charlie", "David"],
            }
        )

        metrics = calculate_uniqueness_metrics(df)

        # 4 unique rows out of 5 total = 80%
        assert metrics["overall_uniqueness"] == pytest.approx(80.0, rel=0.1)
        assert metrics["total_rows"] == 5
        assert metrics["unique_rows"] == 4
        assert metrics["duplicate_rows"] == 1

        # id column: 4 unique values out of 5 = 80%
        assert metrics["column_uniqueness"]["id"]["uniqueness"] == pytest.approx(
            80.0, rel=0.1
        )
        # name column: 4 unique values out of 5 = 80%
        assert metrics["column_uniqueness"]["name"]["uniqueness"] == pytest.approx(
            80.0, rel=0.1
        )

    def test_calculate_validity_metrics(self):
        """Test validity metrics calculation."""
        df = pd.DataFrame(
            {
                "numbers": [1, 2, 3, float("inf")],
                "strings": ["valid", "", "also valid", "  "],
            }
        )

        metrics = calculate_validity_metrics(df)

        # Numbers: 3 valid out of 4 = 75%
        assert metrics["column_validity"]["numbers"]["validity"] == pytest.approx(
            75.0, rel=0.1
        )
        assert metrics["column_validity"]["numbers"]["valid_count"] == 3

        # Strings: 2 valid (empty and whitespace-only are invalid) = 50%
        assert metrics["column_validity"]["strings"]["validity"] == pytest.approx(
            50.0, rel=0.1
        )

    def test_calculate_consistency_metrics(self):
        """Test consistency metrics calculation."""
        df = pd.DataFrame(
            {
                "numbers": [1, 2, 3, 4],
                "mixed_strings": ["abc", "abcd", "ab", "abcde"],
            }
        )

        metrics = calculate_consistency_metrics(df)

        # Numbers should have high consistency
        assert metrics["column_consistency"]["numbers"]["consistency"] == pytest.approx(
            100.0, rel=0.1
        )

        # Mixed strings should have lower consistency due to length variance
        assert metrics["column_consistency"]["mixed_strings"]["consistency"] < 100.0

    def test_calculate_all_metrics(self):
        """Test all metrics calculation."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, 3],
                "col2": ["a", "b", "c"],
            }
        )

        metrics = calculate_all_metrics(df)

        assert "completeness" in metrics
        assert "uniqueness" in metrics
        assert "validity" in metrics
        assert "consistency" in metrics
        assert "dataset_info" in metrics

        assert metrics["dataset_info"]["rows"] == 3
        assert metrics["dataset_info"]["columns"] == 2

    def test_generate_quality_report(self):
        """Test quality report generation."""
        df = pd.DataFrame(
            {
                "col1": [1, 2, None, 4],
                "col2": ["a", "b", "c", "c"],
            }
        )

        report = generate_quality_report(df)

        assert "metrics" in report
        assert "recommendations" in report
        assert "overall_quality_score" in report
        assert "generated_at" in report
        assert "problematic_columns" in report
        assert "column_statistics" in report
        assert "data_type_distribution" in report

        # Quality score should be between 0 and 100
        assert 0 <= report["overall_quality_score"] <= 100

        # Should have recommendations for low completeness
        assert len(report["recommendations"]) > 0

        # Check problematic columns structure
        assert "completeness" in report["problematic_columns"]
        assert "uniqueness" in report["problematic_columns"]
        assert "validity" in report["problematic_columns"]
        assert "consistency" in report["problematic_columns"]

        # Check column statistics
        assert "col1" in report["column_statistics"]
        assert "col2" in report["column_statistics"]

        # Check data type distribution
        assert isinstance(report["data_type_distribution"], dict)
        assert len(report["data_type_distribution"]) > 0


class TestMetricsConfig:
    """Test metrics configuration."""

    def test_config_defaults(self):
        """Test default configuration."""
        config = MetricsConfig()

        assert config.max_upload_mb == 10
        assert config.max_rows == 50_000
        assert config.max_memory_mb == 200
        assert config.sample_size == 10
        assert ".csv" in config.allowed_file_types

    def test_config_from_env(self):
        """Test configuration from environment."""
        os.environ["MAX_UPLOAD_MB"] = "100"
        os.environ["METRICS_SAMPLE_SIZE"] = "20"

        config = MetricsConfig.from_env()

        assert config.max_upload_mb == 100
        assert config.sample_size == 20

        # Clean up
        del os.environ["MAX_UPLOAD_MB"]
        del os.environ["METRICS_SAMPLE_SIZE"]


class TestMetricsAPI:
    """Test metrics API endpoints."""

    @pytest.fixture
    def app(self):
        """Create test Flask app."""
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "src"))
        from src.metrics.routes import metrics_bp
        from flask import Flask

        app = Flask(__name__)
        app.register_blueprint(metrics_bp)
        app.config["TESTING"] = True
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()

    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get("/api/metrics/health")
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data["ok"] is True
        assert data["service"] == "metrics"

    def test_upload_no_file(self, client):
        """Test upload without file."""
        response = client.post("/api/metrics/upload")
        assert response.status_code == 400
        data = json.loads(response.data)
        assert "error" in data

    def test_upload_and_analyze(self, client):
        """Test file upload and analysis."""
        # Create a temporary CSV file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("col1,col2,col3\n")
            f.write("1,a,x\n")
            f.write("2,b,y\n")
            f.write("3,c,z\n")
            temp_path = f.name

        try:
            # Upload file
            with open(temp_path, "rb") as f:
                response = client.post(
                    "/api/metrics/upload",
                    data={"file": (f, "test.csv")},
                    content_type="multipart/form-data",
                )

            assert response.status_code == 200
            upload_data = json.loads(response.data)
            assert "sessionId" in upload_data
            assert "columns" in upload_data
            assert len(upload_data["columns"]) == 3

            session_id = upload_data["sessionId"]

            # Analyze dataset
            response = client.post(
                "/api/metrics/analyze",
                json={"sessionId": session_id},
                content_type="application/json",
            )

            assert response.status_code == 200
            analysis_data = json.loads(response.data)
            assert "metrics" in analysis_data
            assert "overall_quality_score" in analysis_data

        finally:
            # Clean up
            os.unlink(temp_path)


class TestCSVProcessing:
    """Test suite for CSV processing and robust reading functions."""

    def test_malformed_csv_tokenization_error(self):
        """Test handling of malformed CSV that causes tokenization errors."""
        # Create a CSV with inconsistent field counts that would cause tokenization error
        malformed_csv_content = """id,name
1,John Doe
2,Jane,Smith,Extra,Fields,That,Should,Not,Be,Here,But,Are,Present,And,Cause,Issues,With,The,Parser,Because,Too,Many,Commas,In,This,Row,Making,It,Malformed
3,Bob Wilson
4,Alice,Johnson,Another,Row,With,Too,Many,Fields,That,Would,Cause,The,Error,Expected,2,Fields,In,Line,But,Saw,More,Than,Expected"""

        # Write to temporary file
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(malformed_csv_content)
            temp_file = f.name

        try:
            # Test that read_csv_robust can handle this malformed CSV
            df = read_csv_robust(Path(temp_file))

            # Should successfully read the file, handling malformed rows
            assert df is not None
            assert len(df) > 0

            # Should at least read the well-formed rows
            assert "id" in df.columns
            assert "name" in df.columns

        finally:
            # Clean up temporary file
            os.unlink(temp_file)

    def test_csv_with_different_encodings(self):
        """Test reading CSV files with different encodings."""
        csv_content = (
            "id,name,description\n1,José,Café com açúcar\n2,François,Crème brûlée"
        )

        # Test UTF-8 encoding
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".csv", delete=False, encoding="utf-8"
        ) as f:
            f.write(csv_content)
            temp_file_utf8 = f.name

        try:
            df = read_csv_robust(Path(temp_file_utf8))
            assert df is not None
            assert len(df) == 2
            assert "José" in df["name"].values

        finally:
            os.unlink(temp_file_utf8)

    def test_csv_with_mixed_separators(self):
        """Test CSV with mixed or unusual separators."""
        csv_content = "id;name;value\n1;John;100\n2;Jane;200"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            df = read_csv_robust(Path(temp_file))
            assert df is not None
            assert len(df) == 2
            assert "id" in df.columns
            assert "name" in df.columns
            assert "value" in df.columns

        finally:
            os.unlink(temp_file)

    def test_empty_csv_file(self):
        """Test handling of empty CSV files."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("")
            temp_file = f.name

        try:
            df = read_csv_robust(Path(temp_file))
            # Should handle gracefully, either return None or empty DataFrame
            assert df is None or len(df) == 0

        finally:
            os.unlink(temp_file)

    def test_csv_with_quotes_and_commas(self):
        """Test CSV with quoted fields containing commas."""
        csv_content = '''id,name,description
1,"John, Jr.","Works at Smith, Johnson & Associates"
2,"Mary O'Connor","Likes to say ""Hello, World!"""'''

        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(csv_content)
            temp_file = f.name

        try:
            df = read_csv_robust(Path(temp_file))
            assert df is not None
            assert len(df) == 2
            assert "John, Jr." in df["name"].values
            assert "Mary O'Connor" in df["name"].values

        finally:
            os.unlink(temp_file)
