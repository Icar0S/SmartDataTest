"""Tests for metrics memory limit constraints."""

import json
import os
import sys
import tempfile
from io import BytesIO

import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "src"))

from src.metrics.config import MetricsConfig


class TestMetricsMemoryLimits:
    """Test memory and size limit enforcement in metrics endpoints."""

    @pytest.fixture
    def app(self):
        """Create test Flask app."""
        from flask import Flask

        from src.metrics.routes import metrics_bp

        app = Flask(__name__)
        app.register_blueprint(metrics_bp)
        app.config["TESTING"] = True
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return app.test_client()

    def test_upload_file_too_large(self, client):
        """Test that files over 10MB are rejected."""
        # Create data that exceeds 10MB limit
        # "test,data\n" is 10 bytes; need >10*1024*1024/10 = 1,048,576 rows
        large_data = b"col1,col2\n" + b"test,data\n" * 1_100_000
        assert len(large_data) > 10 * 1024 * 1024

        response = client.post(
            "/api/metrics/upload",
            data={"file": (BytesIO(large_data), "large.csv")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 413
        data = json.loads(response.data)
        assert "exceeds maximum" in data["error"]

    def test_upload_file_within_limit(self, client):
        """Test that files within 10MB are accepted."""
        small_data = b"col1,col2,col3\n1,a,x\n2,b,y\n"

        response = client.post(
            "/api/metrics/upload",
            data={"file": (BytesIO(small_data), "small.csv")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 200

    def test_upload_too_many_rows(self, client):
        """Test that datasets over max_rows are rejected during upload."""
        # Build CSV with more rows than max_rows (50,000)
        lines = ["col1,col2"] + ["val,data"] * 51_000
        large_csv = "\n".join(lines).encode()

        response = client.post(
            "/api/metrics/upload",
            data={"file": (BytesIO(large_csv), "big.csv")},
            content_type="multipart/form-data",
        )
        assert response.status_code == 413
        data = json.loads(response.data)
        assert "exceeds" in data["error"]
        assert "suggestion" in data

    def test_analyze_too_many_rows(self, client):
        """Test that datasets over max_rows are rejected in analysis."""
        # Upload a small file first to get a session
        small_csv = b"col1,col2\n1,a\n2,b\n"
        upload_response = client.post(
            "/api/metrics/upload",
            data={"file": (BytesIO(small_csv), "small.csv")},
            content_type="multipart/form-data",
        )
        assert upload_response.status_code == 200
        session_id = json.loads(upload_response.data)["sessionId"]

        # Manually override row count in processing_status to exceed max_rows
        from src.metrics.routes import processing_status, config

        processing_status[session_id]["rows"] = config.max_rows + 1

        response = client.post(
            "/api/metrics/analyze",
            json={"sessionId": session_id},
            content_type="application/json",
        )
        assert response.status_code == 413
        data = json.loads(response.data)
        assert "rows exceeds maximum" in data["error"]
        assert "suggestion" in data

    def test_analyze_missing_session(self, client):
        """Test that analyze rejects missing session IDs."""
        response = client.post(
            "/api/metrics/analyze",
            json={"sessionId": "nonexistent-session-id"},
            content_type="application/json",
        )
        assert response.status_code == 404

    def test_config_env_vars(self):
        """Test that config respects environment variable overrides."""
        os.environ["MAX_UPLOAD_MB"] = "5"
        os.environ["METRICS_MAX_ROWS"] = "10000"
        os.environ["METRICS_MAX_MEMORY_MB"] = "100"

        config = MetricsConfig.from_env()

        assert config.max_upload_mb == 5
        assert config.max_rows == 10_000
        assert config.max_memory_mb == 100

        del os.environ["MAX_UPLOAD_MB"]
        del os.environ["METRICS_MAX_ROWS"]
        del os.environ["METRICS_MAX_MEMORY_MB"]

    def test_config_defaults_are_safe(self):
        """Test that default config values are within safe limits for Render Hobby plan."""
        config = MetricsConfig()
        assert config.max_upload_mb <= 10
        assert config.max_rows <= 50_000
        assert config.max_memory_mb <= 200
