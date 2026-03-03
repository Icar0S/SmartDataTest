"""Flask routes for GOLD Dataset Testing feature."""

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from .config import GoldConfig
from .processor import (
    clean_dataframe_chunk,
    get_null_counts,
    normalize_column_name,
    read_dataset,
)
from .services.file_processor import (
    process_csv_chunked,
    process_excel,
    process_parquet_chunked,
)
from .services.serialization_utils import convert_to_json_serializable

# Create blueprint
gold_bp = Blueprint("gold", __name__, url_prefix="/api/gold")

# Initialize config
config = GoldConfig.from_env()

# Ensure storage directories exist
config.storage_path.mkdir(parents=True, exist_ok=True)

# Track processing status
processing_status = {}


@gold_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"ok": True, "service": "gold", "status": "running"})


@gold_bp.route("/upload", methods=["POST"])
def upload_dataset():
    """Handle dataset upload.

    Form-data:
        file: Dataset file

    Returns:
        JSON with sessionId, datasetId, columns, sample, and format
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

        # Generate session ID
        session_id = str(uuid.uuid4())
        dataset_id = str(uuid.uuid4())

        # Create session directory
        session_dir = config.storage_path / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        # Secure filename
        safe_filename = secure_filename(file.filename)
        # Prevent path traversal
        if ".." in safe_filename or "/" in safe_filename or "\\" in safe_filename:
            return jsonify({"error": "Invalid filename"}), 400

        # Save file with original extension
        file_path = session_dir / f"raw{file_ext}"
        file.save(file_path)

        # Read dataset sample
        if file_ext == ".csv":
            from .processor import detect_encoding

            encoding, sep = detect_encoding(file_path)
            df_sample = read_dataset(file_path, encoding=encoding, sep=sep, nrows=20)
            # Store encoding and separator for later use
            metadata = {"encoding": encoding, "sep": sep, "format": "csv"}
        elif file_ext in [".xlsx", ".xls"]:
            df_sample = pd.read_excel(file_path, nrows=20)
            metadata = {"format": "xlsx" if file_ext == ".xlsx" else "xls"}
        elif file_ext == ".parquet":
            df = pd.read_parquet(file_path)
            df_sample = df.head(20)
            metadata = {"format": "parquet", "total_rows": len(df)}
        else:
            return jsonify({"error": "Unsupported file format"}), 415

        # Get columns
        columns = df_sample.columns.tolist()

        # Get sample data
        sample = df_sample.to_dict(orient="records")

        # Convert NaN to None for JSON
        for record in sample:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None

        # Save metadata
        metadata.update(
            {
                "sessionId": session_id,
                "datasetId": dataset_id,
                "originalFilename": safe_filename,
                "uploadedAt": datetime.now(timezone.utc).isoformat(),
            }
        )

        with open(session_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        return jsonify(
            {
                "sessionId": session_id,
                "datasetId": dataset_id,
                "columns": columns,
                "sample": sample,
                "format": metadata["format"],
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gold_bp.route("/clean", methods=["POST"])
def clean_dataset():
    """Clean dataset with specified options.

    Body JSON:
        {
            "sessionId": "string",
            "datasetId": "string",
            "options": {
                "dropEmptyColumns": true,
                "normalizeHeaders": true,
                "trimStrings": true,
                "coerceNumeric": true,
                "parseDates": true,
                "dropDuplicates": false,
                "chunksize": 200000
            }
        }

    Returns:
        JSON with status and download links
    """
    try:
        data = request.get_json()

        # Validate required fields
        session_id = data.get("sessionId")
        if not session_id:
            return jsonify({"error": "sessionId is required"}), 400

        # Get session directory
        session_dir = config.storage_path / session_id
        if not session_dir.exists():
            return jsonify({"error": "Session not found"}), 404

        # Get options
        options = data.get("options", {})
        chunksize = options.get("chunksize", 200000)

        # Load metadata
        metadata_path = session_dir / "metadata.json"
        if not metadata_path.exists():
            return jsonify({"error": "Session metadata not found"}), 404

        with open(metadata_path, "r") as f:
            metadata = json.load(f)

        file_format = metadata.get("format")

        # Get raw file
        raw_files = list(session_dir.glob("raw.*"))
        if not raw_files:
            return jsonify({"error": "Raw file not found"}), 404

        raw_file = raw_files[0]

        # Initialize processing status
        processing_status[session_id] = {
            "state": "running",
            "progress": {"current": 0, "total": 100, "phase": "initializing"},
            "startedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Start cleaning process
        try:
            start_time = time.time()

            # Read and clean dataset
            if file_format == "csv":
                # Process CSV in chunks
                encoding = metadata.get("encoding", "utf-8")
                sep = metadata.get("sep", ",")

                process_csv_chunked(
                    raw_file,
                    session_id,
                    options,
                    encoding,
                    sep,
                    chunksize,
                    config,
                    processing_status,
                )

            elif file_format in ["xlsx", "xls"]:
                # Load Excel file entirely, then process in memory chunks
                process_excel(raw_file, session_id, options, chunksize, config, processing_status)

            elif file_format == "parquet":
                # Process Parquet in chunks
                process_parquet_chunked(
                    raw_file, session_id, options, chunksize, config, processing_status
                )
            else:
                processing_status[session_id]["state"] = "failed"
                processing_status[session_id]["error"] = "Unsupported format"
                return jsonify({"error": "Unsupported format"}), 415

            # Generate report
            report = processing_status[session_id].get("report", {})
            report["finishedAt"] = datetime.now(timezone.utc).isoformat()
            report["durationSec"] = time.time() - start_time

            # Save report
            with open(session_dir / "report.json", "w") as f:
                json.dump(report, f, indent=2)

            # Update status
            processing_status[session_id]["state"] = "completed"
            processing_status[session_id]["report"] = report
            processing_status[session_id]["progress"] = {
                "current": 100,
                "total": 100,
                "phase": "completed",
            }

            # Generate download links
            download_links = {"csv": f"/api/gold/download/{session_id}/gold_clean.csv"}

            # Add same format download if available
            if file_format == "csv":
                download_links["sameFormat"] = download_links["csv"]
            elif file_format in ["xlsx", "xls"]:
                if (session_dir / "gold_clean.xlsx").exists():
                    download_links["sameFormat"] = (
                        f"/api/gold/download/{session_id}/gold_clean.xlsx"
                    )
            elif file_format == "parquet":
                if (session_dir / "gold_clean.parquet").exists():
                    download_links["sameFormat"] = (
                        f"/api/gold/download/{session_id}/gold_clean.parquet"
                    )

            return (
                jsonify(
                    {
                        "status": "completed",
                        "progressUrl": f"/api/gold/status?sessionId={session_id}",
                        "download": download_links,
                    }
                ),
                200,
            )

        except Exception as e:
            processing_status[session_id]["state"] = "failed"
            processing_status[session_id]["error"] = str(e)
            raise

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@gold_bp.route("/status", methods=["GET"])
def get_status():
    """Get processing status.

    Query params:
        sessionId: Session ID

    Returns:
        JSON with state, progress, and report (if completed)
    """
    session_id = request.args.get("sessionId")
    if not session_id:
        return jsonify({"error": "sessionId is required"}), 400

    if session_id not in processing_status:
        return jsonify({"error": "Session not found"}), 404

    status = processing_status[session_id]
    return jsonify(status)


@gold_bp.route("/report", methods=["GET"])
def get_report():
    """Get cleaning report.

    Query params:
        sessionId: Session ID

    Returns:
        JSON report
    """
    session_id = request.args.get("sessionId")
    if not session_id:
        return jsonify({"error": "sessionId is required"}), 400

    session_dir = config.storage_path / session_id
    report_path = session_dir / "report.json"

    if not report_path.exists():
        return jsonify({"error": "Report not found"}), 404

    with open(report_path, "r") as f:
        report = json.load(f)

    return jsonify(report)


@gold_bp.route("/download/<session_id>/<filename>", methods=["GET"])
def download_file(session_id, filename):
    """Download cleaned dataset.

    Args:
        session_id: Session ID
        filename: File name to download

    Returns:
        File download
    """
    # Validate session_id and filename to prevent path traversal
    if ".." in session_id or "/" in session_id or "\\" in session_id:
        return jsonify({"error": "Invalid session ID"}), 400

    if ".." in filename or "/" in filename or "\\" in filename:
        return jsonify({"error": "Invalid filename"}), 400

    session_dir = config.storage_path / session_id
    file_path = session_dir / filename

    if not file_path.exists():
        return jsonify({"error": "File not found"}), 404

    # Verify file is in session directory (double-check path traversal)
    try:
        file_path.resolve().relative_to(session_dir.resolve())
    except ValueError:
        return jsonify({"error": "Invalid file path"}), 400

    return send_file(file_path, as_attachment=True)
