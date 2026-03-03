"""Flask routes for Data Accuracy feature."""

import json
import uuid
from pathlib import Path

import pandas as pd
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from .config import AccuracyConfig
from .processor import compare_and_correct, normalize_column_name, read_dataset

# Create blueprint
accuracy_bp = Blueprint("accuracy", __name__, url_prefix="/api/accuracy")

# Initialize config
config = AccuracyConfig.from_env()

# Ensure storage directories exist
config.storage_path.mkdir(parents=True, exist_ok=True)
(config.storage_path / "uploads").mkdir(exist_ok=True)
(config.storage_path / "results").mkdir(exist_ok=True)


@accuracy_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "Data Accuracy service is running"})


@accuracy_bp.route("/upload", methods=["POST"])
def upload_dataset():
    """Handle dataset upload.

    Query params:
        role: 'gold' or 'target'

    Returns:
        JSON with sessionId, role, datasetId, columns, and preview
    """
    try:
        # Get role from query params
        role = request.args.get("role")
        if role not in ["gold", "target"]:
            return jsonify({"error": "Role must be 'gold' or 'target'"}), 400

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
                400,
            )

        # Generate session ID if not provided
        session_id = request.args.get("sessionId")
        if not session_id:
            session_id = str(uuid.uuid4())

        # Save file
        session_dir = config.storage_path / "uploads" / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        file_path = session_dir / f"{role}{file_ext}"
        file.save(file_path)

        # Read dataset
        df = read_dataset(file_path)

        # Check row limit
        if len(df) > config.max_rows:
            return (
                jsonify(
                    {"error": f"Dataset has {len(df)} rows, exceeds maximum of {config.max_rows}"}
                ),
                400,
            )

        # Normalize column names
        original_columns = df.columns.tolist()
        df.columns = [normalize_column_name(col) for col in df.columns]

        # Get columns and preview
        columns = df.columns.tolist()
        preview = df.head(20).to_dict(orient="records")

        # Convert any NaN values to None for JSON serialization
        for record in preview:
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None

        dataset_id = str(uuid.uuid4())

        return jsonify(
            {
                "sessionId": session_id,
                "role": role,
                "datasetId": dataset_id,
                "columns": columns,
                "originalColumns": original_columns,
                "preview": preview,
                "rowCount": len(df),
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@accuracy_bp.route("/compare-correct", methods=["POST"])
def compare_correct():
    """Compare and correct datasets.

    Body JSON:
        {
            "sessionId": "string",
            "goldDatasetId": "string",
            "targetDatasetId": "string",
            "keyColumns": ["col1", "col2"],
            "valueColumns": ["val1", "val2"],
            "options": {
                "normalizeKeys": true,
                "lowercase": true,
                "stripAccents": true,
                "stripPunctuation": true,
                "coerceNumeric": true,
                "decimalPlaces": 2,
                "tolerance": 0.0,
                "targetDuplicatePolicy": "keep_last"
            }
        }

    Returns:
        JSON with summary, diffSample, and download links
    """
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ["sessionId", "keyColumns", "valueColumns"]
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        session_id = data["sessionId"]
        key_columns = data["keyColumns"]
        value_columns = data["valueColumns"]
        options = data.get("options", {})

        # Find uploaded files
        session_dir = config.storage_path / "uploads" / session_id
        if not session_dir.exists():
            return jsonify({"error": "Session not found"}), 404

        # Find gold and target files
        gold_file = None
        target_file = None

        for file_path in session_dir.iterdir():
            if file_path.stem == "gold":
                gold_file = file_path
            elif file_path.stem == "target":
                target_file = file_path

        if not gold_file or not target_file:
            return (
                jsonify({"error": "Both GOLD and TARGET datasets must be uploaded"}),
                400,
            )

        # Read datasets
        gold_df = read_dataset(gold_file)
        target_df = read_dataset(target_file)

        # Compare and correct
        corrected_df, summary, differences = compare_and_correct(
            gold_df, target_df, key_columns, value_columns, options
        )

        # Save results
        results_dir = config.storage_path / "results" / session_id
        results_dir.mkdir(parents=True, exist_ok=True)

        # Save corrected dataset
        corrected_path = results_dir / "target_corrected.csv"
        corrected_df.to_csv(corrected_path, index=False)

        # Save diff CSV
        if differences:
            diff_df = pd.DataFrame(differences)
            # Flatten keys dict into columns
            if "keys" in diff_df.columns:
                keys_df = pd.json_normalize(diff_df["keys"].tolist())
                diff_df = pd.concat([keys_df, diff_df.drop("keys", axis=1)], axis=1)

            diff_path = results_dir / "diff.csv"
            diff_df.to_csv(diff_path, index=False)
        else:
            # Create empty diff file
            diff_path = results_dir / "diff.csv"
            pd.DataFrame(columns=["message"]).to_csv(diff_path, index=False)

        # Save report JSON
        report = {
            "summary": summary,
            "parameters": {
                "keyColumns": key_columns,
                "valueColumns": value_columns,
                "options": options,
            },
            "differences": differences[:100],  # Limit to first 100 for JSON
        }

        report_path = results_dir / "report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)

        # Return response
        return jsonify(
            {
                "summary": summary,
                "diffSample": differences[:50],  # First 50 for response
                "download": {
                    "correctedCsv": f"/api/accuracy/download/{session_id}/target_corrected.csv",
                    "diffCsv": f"/api/accuracy/download/{session_id}/diff.csv",
                    "reportJson": f"/api/accuracy/download/{session_id}/report.json",
                },
            }
        )

    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@accuracy_bp.route("/download/<session_id>/<filename>", methods=["GET"])
def download_file(session_id, filename):
    """Download generated file.

    Args:
        session_id: Session ID
        filename: Name of file to download

    Returns:
        File download
    """
    try:
        # Sanitize filename to prevent path traversal
        filename = secure_filename(filename)

        # Only allow specific files
        allowed_files = ["target_corrected.csv", "diff.csv", "report.json"]
        if filename not in allowed_files:
            return jsonify({"error": "File not allowed"}), 403

        file_path = config.storage_path / "results" / session_id / filename

        if not file_path.exists():
            return jsonify({"error": "File not found"}), 404

        # Determine mimetype based on file extension
        if filename.endswith(".csv"):
            mimetype = "text/csv"
        elif filename.endswith(".json"):
            mimetype = "application/json"
        else:
            mimetype = "application/octet-stream"

        return send_file(file_path, as_attachment=True, download_name=filename, mimetype=mimetype)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
