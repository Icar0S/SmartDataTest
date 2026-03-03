"""API routes for RAG functionality."""

from pathlib import Path

from flask import Blueprint, Response, jsonify, request, stream_with_context
from werkzeug.utils import secure_filename

from .chat import ChatEngine
from .config import RAGConfig
from .ingest import DocumentIngestor

# Create blueprint
rag_bp = Blueprint("rag", __name__, url_prefix="/api/rag")

# Initialize RAG components
config = RAGConfig.from_env()
ingestor = DocumentIngestor(config)
chat_engine = ChatEngine(config, ingestor)


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return any(filename.lower().endswith(ext) for ext in config.allowed_file_types)


@rag_bp.route("/chat", methods=["POST"])
def chat():
    """Chat endpoint with optional streaming."""
    data = request.get_json()
    if not data or "message" not in data:
        return jsonify({"error": "Missing message"}), 400

    message = data["message"]
    stream = request.args.get("stream", "true").lower() == "true"

    if stream:

        def generate():
            for chunk in chat_engine.chat(message, stream=True):
                yield f"data: {chunk}\n\n"

        return Response(stream_with_context(generate()), mimetype="text/event-stream")

    response = chat_engine.chat(message, stream=False)
    return jsonify(response)


@rag_bp.route("/upload", methods=["POST"])
def upload():
    """Upload and index a new document."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "Invalid file"}), 400

    if not allowed_file(file.filename):
        return (
            jsonify(
                {"error": f"File type not allowed. Must be one of: {config.allowed_file_types}"}
            ),
            400,
        )

    try:
        # Save file temporarily
        filename = secure_filename(file.filename)
        temp_path = Path("./storage/temp") / filename
        temp_path.parent.mkdir(parents=True, exist_ok=True)
        file.save(str(temp_path))

        # Check file size
        size_mb = temp_path.stat().st_size / (1024 * 1024)
        if size_mb > config.max_upload_mb:
            temp_path.unlink()
            return (
                jsonify({"error": f"File too large. Maximum size is {config.max_upload_mb}MB"}),
                400,
            )

        # Read content
        content = temp_path.read_text(encoding="utf-8")

        # Index document
        doc_id = ingestor.add_document(
            content=content,
            metadata={
                "filename": filename,
                "size": size_mb,
                "content": content,  # Store for reindexing
            },
        )

        # Cleanup
        temp_path.unlink()

        return jsonify({"document_id": doc_id, "filename": filename, "size_mb": size_mb})

    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/sources", methods=["GET"])
def list_sources():
    """List indexed documents."""
    documents = ingestor.list_documents()
    return jsonify(documents)


@rag_bp.route("/sources/<doc_id>", methods=["DELETE"])
def delete_source(doc_id: str):
    """Delete a document from the index."""
    success = ingestor.remove_document(doc_id)
    if success:
        return "", 204
    return jsonify({"error": "Document not found"}), 404


@rag_bp.route("/reindex", methods=["POST"])
def reindex():
    """Rebuild the entire index."""
    try:
        ingestor.reindex()
        return "", 204
    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/health", methods=["GET"])
def health():
    """Check system health."""
    try:
        doc_count = len(ingestor.list_documents())
        return jsonify(
            {
                "status": "ok",
                "documents": doc_count,
                "llm": config.llm_model,
                "embeddings": config.embed_model,
            }
        )
    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"status": "error", "error": str(e)}), 500
