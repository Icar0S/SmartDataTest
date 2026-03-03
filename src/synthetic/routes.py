"""Flask routes for Synthetic Data Generation."""

import time
import uuid

import pandas as pd
from flask import Blueprint, jsonify, request, send_file
from werkzeug.utils import secure_filename

from .config import SyntheticConfig
from .generator import SyntheticDataGenerator
from .validators import (
    validate_generate_request,
    validate_preview_request,
)

# Create blueprint
synth_bp = Blueprint("synth", __name__, url_prefix="/api/synth")

# Initialize config
config = SyntheticConfig.from_env()

# Log configuration for debugging
print(f"[SYNTHETIC CONFIG] Provider: {config.llm_provider}")
print(f"[SYNTHETIC CONFIG] Model: {config.llm_model}")
print(f"[SYNTHETIC CONFIG] API Key configured: {'Yes' if config.llm_api_key else 'No'}")

# Initialize generator with provider
generator = SyntheticDataGenerator(
    api_key=config.llm_api_key,
    model=config.llm_model,
    provider=config.llm_provider,
)

# Ensure storage directories exist
config.storage_path.mkdir(parents=True, exist_ok=True)


@synth_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify(
        {
            "status": "ok",
            "message": "Synthetic Data Generation service is running",
            "provider": config.llm_provider,
            "model": config.llm_model,
            "max_rows": config.max_rows,
        }
    )


@synth_bp.route("/preview", methods=["POST"])
def preview():
    """Generate preview of synthetic data.

    Request JSON:
        schema: Column schema definition
        rows: Number of rows (max 100 for preview)
        llmMode: 'batched' or 'full' (optional)
        locale: Locale code (default: pt_BR)
        seed: Random seed (optional)

    Returns:
        JSON with preview data and column names
    """
    try:
        data = request.get_json()

        # Validate request
        is_valid, errors = validate_preview_request(data)
        if not is_valid:
            return jsonify({"error": "Validation failed", "details": errors}), 400

        # Extract parameters
        schema = data.get("schema", {})
        num_rows = data.get("rows", 50)
        locale = data.get("locale", "pt_BR")
        seed = data.get("seed")

        # Generate preview data
        start_time = time.time()
        records, logs = generator.generate_batch(
            schema=schema,
            num_rows=min(num_rows, 100),  # Cap at 100 for preview
            locale=locale,
            seed=seed,
        )

        duration = time.time() - start_time

        # Extract column names
        columns = [col["name"] for col in schema.get("columns", [])]

        return jsonify(
            {
                "preview": records,
                "columns": columns,
                "rows_generated": len(records),
                "duration_sec": round(duration, 2),
                "logs": logs,
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@synth_bp.route("/generate", methods=["POST"])
def generate():
    """Generate full synthetic dataset.

    Request JSON:
        schema: Column schema definition
        rows: Number of rows to generate
        fileType: Output file type (csv, xlsx, json, parquet)
        llmMode: 'batched' or 'full' (optional, default: batched)
        batchSize: Rows per batch (optional, default: 1000)
        locale: Locale code (default: pt_BR)
        seed: Random seed (optional)

    Returns:
        JSON with download URL and generation summary
    """
    try:
        data = request.get_json()

        # Validate request
        is_valid, errors = validate_generate_request(data, config.max_rows)
        if not is_valid:
            return jsonify({"error": "Validation failed", "details": errors}), 400

        # Extract parameters
        schema = data.get("schema", {})
        num_rows = data["rows"]
        file_type = data.get("fileType", "csv")
        llm_mode = data.get("llmMode", "batched")
        batch_size = data.get("batchSize", 1000)
        locale = data.get("locale", "pt_BR")
        seed = data.get("seed")

        # Create session directory
        session_id = str(uuid.uuid4())
        session_path = config.storage_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)

        # Generate data in batches
        start_time = time.time()
        all_records = []
        all_logs = []

        if llm_mode == "full" and num_rows <= 5000:
            # Generate all at once for small datasets
            all_logs.append(f"Generating {num_rows} rows in single batch...")
            records, logs = generator.generate_batch(
                schema=schema, num_rows=num_rows, locale=locale, seed=seed
            )
            all_records.extend(records)
            all_logs.extend(logs)
        else:
            # Generate in batches
            batches = (num_rows + batch_size - 1) // batch_size
            all_logs.append(f"Generating {num_rows} rows in {batches} batches of {batch_size}...")

            for batch_num in range(batches):
                batch_rows = min(batch_size, num_rows - len(all_records))
                all_logs.append(f"Batch {batch_num + 1}/{batches}: generating {batch_rows} rows...")

                # Use different seed for each batch if seed is provided
                batch_seed = seed + batch_num if seed is not None else None

                records, logs = generator.generate_batch(
                    schema=schema, num_rows=batch_rows, locale=locale, seed=batch_seed
                )

                all_records.extend(records)
                all_logs.extend(logs)
                all_logs.append(
                    f"Batch {batch_num + 1} complete: {len(all_records)}/{num_rows} total rows"
                )

                # Stop if we have enough rows
                if len(all_records) >= num_rows:
                    break

        # Truncate to exact number of rows requested
        all_records = all_records[:num_rows]

        # Convert to DataFrame
        df = pd.DataFrame(all_records)

        # Save to file
        if file_type == "csv":
            output_file = session_path / "dataset.csv"
            df.to_csv(output_file, index=False)
        elif file_type == "xlsx":
            output_file = session_path / "dataset.xlsx"
            df.to_excel(output_file, index=False, engine="openpyxl")
        elif file_type == "json":
            output_file = session_path / "dataset.json"
            # Use JSON Lines for large datasets
            if num_rows > 200000:
                df.to_json(output_file, orient="records", lines=True)
                all_logs.append("Using JSON Lines format for large dataset")
            else:
                df.to_json(output_file, orient="records", indent=2)
        elif file_type == "parquet":
            output_file = session_path / "dataset.parquet"
            df.to_parquet(output_file, index=False)
        else:
            return jsonify({"error": f"Unsupported file type: {file_type}"}), 400

        duration = time.time() - start_time

        # Build download URL - make it absolute if we have a host header
        download_path = f"/api/synth/download/{session_id}/{output_file.name}"
        download_url = download_path

        # In production environments, build an absolute URL
        if request.host:
            # Check for forwarded proto header (set by reverse proxies like Render)
            forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
            # Use HTTPS if forwarded proto is https, or if request is secure
            # Default to HTTPS in production (when host is not localhost)
            is_localhost = "localhost" in request.host or "127.0.0.1" in request.host
            scheme = (
                "https"
                if (forwarded_proto == "https" or request.is_secure or not is_localhost)
                else "http"
            )
            download_url = f"{scheme}://{request.host}{download_path}"

        # Return summary
        return jsonify(
            {
                "summary": {
                    "rows": len(all_records),
                    "cols": len(df.columns),
                    "fileType": file_type,
                    "durationSec": round(duration, 2),
                },
                "downloadUrl": download_url,
                "logs": all_logs,
            }
        )

    except Exception as e:
        import traceback

        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500


@synth_bp.route("/download/<session_id>/<filename>", methods=["GET"])
def download(session_id: str, filename: str):
    """Download generated dataset file.

    Args:
        session_id: Session UUID
        filename: File name

    Returns:
        File download
    """
    try:
        # Log request for debugging
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "not set")
        print(
            f"[DOWNLOAD] Request from {request.host} via {forwarded_proto}, is_secure={request.is_secure}"
        )

        # Sanitize inputs
        session_id = secure_filename(session_id)
        filename = secure_filename(filename)

        # Build file path
        file_path = config.storage_path / session_id / filename

        if not file_path.exists():
            return jsonify({"error": "File not found"}), 404

        # Determine MIME type and proper extension
        mime_type = "application/octet-stream"
        download_name = filename

        if filename.endswith(".csv"):
            mime_type = "text/csv"
            # Ensure CSV extension is preserved
            if not download_name.endswith(".csv"):
                download_name = f"{download_name}.csv"
        elif filename.endswith(".xlsx"):
            mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            if not download_name.endswith(".xlsx"):
                download_name = f"{download_name}.xlsx"
        elif filename.endswith(".json"):
            mime_type = "application/json"
            if not download_name.endswith(".json"):
                download_name = f"{download_name}.json"
        elif filename.endswith(".parquet"):
            mime_type = "application/octet-stream"
            if not download_name.endswith(".parquet"):
                download_name = f"{download_name}.parquet"

        # Create response with explicit headers
        response = send_file(
            file_path,
            mimetype=mime_type,
            as_attachment=True,
            download_name=download_name,
        )

        # Add additional headers to ensure proper download behavior
        response.headers["Content-Disposition"] = f'attachment; filename="{download_name}"'
        response.headers["Content-Type"] = mime_type

        # Add cache control headers
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        # Security headers to prevent mixed content issues
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"

        # Ensure CORS allows the download
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Expose-Headers"] = "Content-Disposition"

        return response

    except Exception as e:
        return jsonify({"error": str(e)}), 500
