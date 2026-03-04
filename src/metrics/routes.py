"""Flask routes for Dataset Metrics feature."""

import gc
import uuid
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Blueprint, jsonify, request, send_file
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename

from limiter import limiter

from .config import MetricsConfig
from .processor import generate_quality_report, read_dataset


def convert_to_json_serializable(obj):
    """Convert numpy/pandas types to JSON serializable types."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        # Handle NaN, inf, -inf values
        if np.isnan(obj):
            return None
        elif np.isinf(obj):
            return None
        else:
            return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    elif isinstance(obj, float):
        # Handle Python float NaN and inf values
        if np.isnan(obj) or np.isinf(obj):
            return None
        else:
            return obj
    return obj


# Create blueprint
metrics_bp = Blueprint("metrics", __name__, url_prefix="/api/metrics")

# Initialize config
config = MetricsConfig.from_env()

# Ensure storage directories exist
config.storage_path.mkdir(parents=True, exist_ok=True)

# Track processing status
processing_status = {}


def _metrics_rate_limit_key():
    """Combine client IP with session id to avoid cross-session throttling."""
    payload = {}
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
    session_id = payload.get("sessionId") or ""
    return f"{get_remote_address()}:{session_id}"


@metrics_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"ok": True, "service": "metrics", "status": "running"})


@metrics_bp.route("/upload", methods=["POST"])
def upload_dataset():
    """Handle dataset upload.

    Form-data:
        file: Dataset file

    Returns:
        JSON with sessionId, columns, and sample data
    """
    try:
        # Check file in request
        if "file" not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files["file"]
        if file.filename == "" or file.filename is None:
            return jsonify({"error": "No file selected"}), 400

        # Check file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in config.allowed_file_types:
            return (
                jsonify(
                    {
                        "error": f"File type {file_ext} not allowed. Allowed types: {config.allowed_file_types}"
                    }
                ),
                400,
            )

        # Check file size
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning

        max_size = config.max_upload_mb * 1024 * 1024
        if file_size > max_size:
            return (
                jsonify(
                    {
                        "error": f"File size ({file_size / 1024 / 1024:.2f}MB) exceeds maximum ({config.max_upload_mb}MB)"
                    }
                ),
                413,
            )

        # Generate session ID and save file
        session_id = str(uuid.uuid4())
        session_dir = config.storage_path / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Secure filename
        filename = secure_filename(file.filename)
        file_path = session_dir / filename

        # Save file
        file.save(file_path)

        # Read dataset to get preview
        df = read_dataset(file_path)

        # Validate row count
        if len(df) > config.max_rows:
            return (
                jsonify(
                    {
                        "error": f"Dataset too large: {len(df)} rows exceeds maximum of {config.max_rows} rows for current plan.",
                        "suggestion": "Please reduce dataset size or upgrade to a higher plan.",
                    }
                ),
                413,
            )

        # Get sample data
        sample = df.head(config.sample_size).to_dict(orient="records")
        sample = convert_to_json_serializable(sample)

        # Store session info
        processing_status[session_id] = {
            "file_path": str(file_path),
            "filename": filename,
            "uploaded_at": datetime.now().isoformat(),
            "rows": len(df),
            "columns": len(df.columns),
        }

        return jsonify(
            {
                "sessionId": session_id,
                "columns": list(df.columns),
                "sample": sample,
                "format": file_ext.lstrip("."),
                "rows": len(df),
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@metrics_bp.route("/analyze", methods=["POST"])
@limiter.limit("20 per minute", key_func=_metrics_rate_limit_key)
def analyze_dataset():
    """Analyze dataset and generate quality report.

    JSON Body:
        sessionId: Session ID from upload

    Returns:
        JSON with quality metrics and report
    """
    try:
        data = request.get_json()
        session_id = data.get("sessionId")

        if not session_id:
            return jsonify({"error": "sessionId is required"}), 400

        if session_id not in processing_status:
            return jsonify({"error": "Invalid session ID"}), 404

        # Get file path
        file_path = Path(processing_status[session_id]["file_path"])

        if not file_path.exists():
            return jsonify({"error": "File not found"}), 404

        # Check row count before loading full dataset
        row_count = processing_status[session_id]["rows"]
        if row_count > config.max_rows:
            return (
                jsonify(
                    {
                        "error": f"Dataset too large: {row_count} rows exceeds maximum of {config.max_rows} rows for current plan.",
                        "suggestion": "Please reduce dataset size or upgrade to a higher plan.",
                    }
                ),
                413,
            )

        # Read dataset
        df = read_dataset(file_path)

        # Generate quality report
        report = generate_quality_report(df)

        # Convert to JSON serializable
        report = convert_to_json_serializable(report)

        # Free memory after analysis
        del df
        gc.collect()

        # Store report in session
        processing_status[session_id]["report"] = report
        processing_status[session_id]["analyzed_at"] = datetime.now().isoformat()

        return jsonify(report)

    except MemoryError:
        return (
            jsonify(
                {
                    "error": "Analysis failed due to insufficient memory.",
                    "suggestion": "Please use a smaller dataset or upgrade to Professional plan for more memory.",
                }
            ),
            507,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@metrics_bp.route("/report", methods=["GET"])
def get_report():
    """Get quality report for a session.

    Query params:
        sessionId: Session ID

    Returns:
        JSON with quality report
    """
    try:
        session_id = request.args.get("sessionId")

        if not session_id:
            return jsonify({"error": "sessionId is required"}), 400

        if session_id not in processing_status:
            return jsonify({"error": "Invalid session ID"}), 404

        if "report" not in processing_status[session_id]:
            return jsonify({"error": "No report available. Run analysis first."}), 404

        return jsonify(processing_status[session_id]["report"])

    except Exception as e:
        return jsonify({"error": str(e)}), 500
