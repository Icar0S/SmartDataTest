"""Flask routes for Dataset Metrics feature."""

import gc
import json
import os
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

# Track processing status (in-memory cache; disk is the source of truth)
processing_status = {}


def _session_file(session_id: str) -> Path:
    """Return the path of the JSON metadata file for a session."""
    return config.storage_path / session_id / "session.json"


def _load_session(session_id: str) -> dict | None:
    """Load session metadata from memory cache or disk.

    Returns the session dict, or None if the session does not exist.
    """
    if session_id in processing_status:
        return processing_status[session_id]

    path = _session_file(session_id)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as fh:
                session = json.load(fh)
            # Warm the in-memory cache for this worker
            processing_status[session_id] = session
            return session
        except (json.JSONDecodeError, OSError) as exc:
            # Corrupt or unreadable session file — treat as non-existent
            import logging
            logging.getLogger(__name__).warning(
                "Could not read session file %s: %s", path, exc
            )
            return None

    return None


def _save_session(session_id: str, session: dict) -> None:
    """Persist session metadata to disk atomically and update the in-memory cache."""
    processing_status[session_id] = session
    path = _session_file(session_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp file first, then rename for atomic replacement so that a
    # worker reading concurrently never sees a half-written file.
    tmp_path = path.with_suffix(".json.tmp")
    with open(tmp_path, "w", encoding="utf-8") as fh:
        json.dump(session, fh)
    os.replace(tmp_path, path)


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

        # Read only up to max_rows+1 rows to avoid loading a huge file into
        # memory before the size check (prevents worker OOM / SIGKILL).
        df = read_dataset(file_path, nrows=config.max_rows + 1)

        # Validate row count — fail fast before building the sample
        if len(df) > config.max_rows:
            del df
            gc.collect()
            return (
                jsonify(
                    {
                        "error": f"Dataset too large: exceeds {config.max_rows} row limit for current plan.",
                        "suggestion": "Please reduce dataset size or upgrade to a higher plan.",
                    }
                ),
                413,
            )

        # Get sample data
        sample = df.head(config.sample_size).to_dict(orient="records")
        sample = convert_to_json_serializable(sample)

        # Capture values needed for the response before releasing the DataFrame
        columns = list(df.columns)
        total_rows = len(df)

        # Free memory as soon as we have what we need
        del df
        gc.collect()

        # Store session info
        _save_session(
            session_id,
            {
                "file_path": str(file_path),
                "filename": filename,
                "uploaded_at": datetime.now().isoformat(),
                "rows": total_rows,
                "columns": len(columns),
            },
        )

        return jsonify(
            {
                "sessionId": session_id,
                "columns": columns,
                "sample": sample,
                "format": file_ext.lstrip("."),
                "rows": total_rows,
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

        session = _load_session(session_id)
        if session is None:
            return jsonify({"error": "Invalid session ID"}), 404

        # Get file path
        file_path = Path(session["file_path"])

        if not file_path.exists():
            return jsonify({"error": "File not found"}), 404

        # Check row count before loading full dataset
        row_count = session["rows"]
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

        # Persist updated session (including the report) to disk
        session["report"] = report
        session["analyzed_at"] = datetime.now().isoformat()
        _save_session(session_id, session)

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

        session = _load_session(session_id)
        if session is None:
            return jsonify({"error": "Invalid session ID"}), 404

        if "report" not in session:
            return jsonify({"error": "No report available. Run analysis first."}), 404

        return jsonify(session["report"])

    except Exception as e:
        return jsonify({"error": str(e)}), 500
