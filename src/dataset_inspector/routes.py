import logging
import os
import tempfile

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from code_generator.pyspark_generator import generate_pyspark_code
from dataset_inspector.dsl_generator import generate_dsl_from_metadata
from dataset_inspector.inspector import MAX_FILE_SIZE_MB, inspect_dataset

# Configure logger
logger = logging.getLogger(__name__)


# Create blueprint
dataset_inspector_bp = Blueprint("dataset_inspector", __name__, url_prefix="/api/datasets")

# Allowed extensions
ALLOWED_EXTENSIONS = {"csv", "parquet", "json", "jsonl"}
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed.

    Args:
        filename: Name of the file

    Returns:
        True if extension is allowed
    """
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_format(filename: str) -> str:
    """Get file format from filename.

    Args:
        filename: Name of the file

    Returns:
        File format string
    """
    ext = filename.rsplit(".", 1)[1].lower()
    if ext == "jsonl":
        return "json"
    return ext


@dataset_inspector_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "Dataset inspector service is running"})


@dataset_inspector_bp.route("/inspect", methods=["POST"])
def inspect_uploaded_dataset():
    """Inspect an uploaded dataset file.

    Request:
        - file: Dataset file (multipart/form-data)
        - delimiter (optional): CSV delimiter
        - encoding (optional): File encoding
        - header (optional): Whether CSV has header (true/false)
        - sample_size (optional): Number of rows to sample for statistics

    Returns:
        JSON with dataset metadata, schema, and statistics
    """
    temp_path = None

    try:
        # Check if file is in request
        if "file" not in request.files:
            logger.warning("No file provided in request")
            return jsonify({"error": "No file provided"}), 400

        file = request.files["file"]

        # Check if file is selected
        if not file or file.filename == "":
            logger.warning("No file selected")
            return jsonify({"error": "No file selected"}), 400

        # Check if filename is valid
        if not file.filename:
            logger.warning("Invalid filename")
            return jsonify({"error": "Invalid filename"}), 400

        # Check file extension
        if not allowed_file(file.filename):
            logger.warning(f"File type not allowed: {file.filename}")
            return (
                jsonify(
                    {
                        "error": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"
                    }
                ),
                400,
            )

        # Save file temporarily
        filename = secure_filename(file.filename)
        if not filename:
            logger.error("Filename is empty after sanitization")
            return jsonify({"error": "Invalid filename"}), 400

        file_format = get_file_format(filename)

        # Create temporary file
        try:
            tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_format}")
            temp_path = tmp_file.name
            tmp_file.close()
        except Exception as e:
            logger.error(f"Failed to create temporary file: {e}")
            return jsonify({"error": "Failed to create temporary file"}), 500

        # Save uploaded file to temp location
        try:
            file.save(temp_path)
        except Exception as e:
            logger.error(f"Failed to save uploaded file: {e}")
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            return jsonify({"error": "Failed to save uploaded file"}), 500

        # Check file size
        try:
            file_size = os.path.getsize(temp_path)
        except Exception as e:
            logger.error(f"Failed to get file size: {e}")
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            return jsonify({"error": "Failed to read file"}), 500

        if file_size == 0:
            logger.warning("Uploaded file is empty")
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            return jsonify({"error": "File is empty"}), 400

        if file_size > MAX_FILE_SIZE_BYTES:
            logger.warning(f"File too large: {file_size} bytes (max: {MAX_FILE_SIZE_BYTES})")
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)
            return (
                jsonify({"error": f"File too large. Maximum size: {MAX_FILE_SIZE_MB}MB"}),
                400,
            )

        # Get optional parameters
        options = {}
        if request.form.get("delimiter"):
            options["delimiter"] = request.form.get("delimiter")
        if request.form.get("encoding"):
            options["encoding"] = request.form.get("encoding")
        if request.form.get("header"):
            header_value = request.form.get("header")
            options["header"] = header_value.lower() == "true" if header_value else False
        if request.form.get("sample_size"):
            try:
                sample_size_str = request.form.get("sample_size")
                if sample_size_str is not None:
                    sample_size = int(sample_size_str)
                    if sample_size <= 0:
                        logger.warning(f"Invalid sample_size: {sample_size}")
                    else:
                        options["sample_size"] = sample_size
            except ValueError as e:
                logger.warning(f"Invalid sample_size format: {e}")

        # Inspect the dataset
        try:
            logger.info(
                f"Inspecting dataset: {filename} (format: {file_format}, size: {file_size} bytes)"
            )
            metadata = inspect_dataset(temp_path, file_format, options)
            metadata["filename"] = filename
            metadata["file_size_bytes"] = file_size

            logger.info(f"Successfully inspected dataset: {filename}")
            return jsonify(metadata), 200

        except ValueError as e:
            # Controlled error - safe to expose
            logger.warning(f"Validation error while inspecting {filename}: {e}")
            return jsonify({"error": str(e)}), 400

        except Exception as e:
            # Unknown error - log details but don't expose to user
            logger.error(f"Unexpected error while inspecting {filename}: {e}", exc_info=True)
            return (
                jsonify(
                    {
                        "error": "Failed to inspect dataset. Please check the file format and try again."
                    }
                ),
                500,
            )

        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    logger.error(f"Failed to delete temporary file {temp_path}: {e}")

    except Exception as e:
        # Catch-all for truly unexpected errors
        logger.error(f"Unexpected error in inspect_uploaded_dataset: {e}", exc_info=True)
        # Clean up temp file if it exists
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception:
                pass
        return (
            jsonify({"error": "An unexpected error occurred during file upload"}),
            500,
        )


@dataset_inspector_bp.route("/generate-dsl", methods=["POST"])
def generate_dsl_endpoint():
    """Generate DSL from dataset metadata.

    Request JSON:
        - metadata: Dataset metadata from inspection
        - user_edits (optional): User edits to override auto-detected values

    Returns:
        JSON with generated DSL
    """
    try:
        try:
            data = request.get_json()
        except Exception as e:
            logger.warning(f"Failed to parse JSON in generate-dsl request: {e}")
            return jsonify({"error": "Invalid JSON data"}), 400

        if data is None:
            logger.warning("No data provided in generate-dsl request")
            return jsonify({"error": "No data provided"}), 400

        metadata = data.get("metadata")
        if not metadata:
            logger.warning("metadata field is missing in generate-dsl request")
            return jsonify({"error": "metadata is required"}), 400

        user_edits = data.get("user_edits", {})

        # Generate DSL
        try:
            logger.info("Generating DSL from metadata")
            dsl = generate_dsl_from_metadata(metadata, user_edits)
            logger.info("Successfully generated DSL")
            return jsonify({"dsl": dsl}), 200
        except ValueError as e:
            # Controlled error - safe to expose
            logger.warning(f"Validation error while generating DSL: {e}")
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            # Unknown error - log details but don't expose to user
            logger.error(f"Unexpected error while generating DSL: {e}", exc_info=True)
            return jsonify({"error": "Failed to generate DSL"}), 500

    except Exception as e:
        # Catch-all for truly unexpected errors
        logger.error(f"Unexpected error in generate_dsl_endpoint: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate DSL"}), 500


@dataset_inspector_bp.route("/generate-pyspark", methods=["POST"])
def generate_pyspark_endpoint():
    """Generate PySpark code from DSL.

    Request JSON:
        - dsl: DSL dictionary

    Returns:
        JSON with generated PySpark code and suggested filename
    """
    try:
        try:
            data = request.get_json()
        except Exception as e:
            logger.warning(f"Failed to parse JSON in generate-pyspark request: {e}")
            return jsonify({"error": "Invalid JSON data"}), 400

        if data is None:
            logger.warning("No data provided in generate-pyspark request")
            return jsonify({"error": "No data provided"}), 400

        dsl = data.get("dsl")
        if not dsl:
            logger.warning("dsl field is missing in generate-pyspark request")
            return jsonify({"error": "dsl is required"}), 400

        # Generate PySpark code
        try:
            logger.info("Generating PySpark code from DSL")
            pyspark_code = generate_pyspark_code(dsl)

            # Suggest filename
            dataset_name = dsl.get("name", dsl.get("dataset", {}).get("name", "dataset"))
            filename = f"generated_{dataset_name}.py"

            logger.info(f"Successfully generated PySpark code: {filename}")
            return jsonify({"pyspark_code": pyspark_code, "filename": filename}), 200
        except ValueError as e:
            # Controlled error - safe to expose
            logger.warning(f"Validation error while generating PySpark code: {e}")
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            # Unknown error - log details but don't expose to user
            logger.error(f"Unexpected error while generating PySpark code: {e}", exc_info=True)
            return jsonify({"error": "Failed to generate PySpark code"}), 500

    except Exception as e:
        # Catch-all for truly unexpected errors
        logger.error(f"Unexpected error in generate_pyspark_endpoint: {e}", exc_info=True)
        return jsonify({"error": "Failed to generate PySpark code"}), 500
