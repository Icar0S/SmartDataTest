"""Simple RAG routes for Flask."""

import json
import os
from pathlib import Path

from flask import Blueprint, Response, jsonify, request
from werkzeug.utils import secure_filename

from .config_simple import RAGConfig
from .simple_chat import SimpleChatEngine
from .simple_rag import SimpleRAG

# Create blueprint
rag_bp = Blueprint("rag", __name__, url_prefix="/api/rag")

# Initialize RAG system
config = RAGConfig.from_env()
rag_system = SimpleRAG(config)
chat_engine = SimpleChatEngine(rag_system)

# Debug: Print RAG initialization info
total_chunks = sum(len(chunks) for chunks in rag_system.document_chunks.values())
print(f"RAG System initialized: {len(rag_system.documents)} documents, {total_chunks} chunks")
print(f"Storage path: {config.storage_path}")
print(f"Documents file: {config.storage_path / 'documents.json'}")
print(f"File exists: {(config.storage_path / 'documents.json').exists()}")
print(f"Current working directory: {os.getcwd()}")


@rag_bp.route("/debug", methods=["GET"])
def debug_rag():
    """Debug endpoint to check RAG system state."""
    total_chunks = sum(len(chunks) for chunks in rag_system.document_chunks.values())

    docs_file = config.storage_path / "documents.json"

    # LLM diagnostic information
    llm_status = {
        "configured": chat_engine.use_llm,
        "client_type": (type(chat_engine.llm_client).__name__ if chat_engine.llm_client else None),
        "provider": os.getenv("LLM_PROVIDER", "not set"),
        "model": os.getenv("LLM_MODEL") or os.getenv("GEMINI_MODEL", "not set"),
        "gemini_key_set": bool(os.getenv("GEMINI_API_KEY")),
        "anthropic_key_set": bool(os.getenv("LLM_API_KEY")),
    }

    return jsonify(
        {
            "documents_count": len(rag_system.documents),
            "chunks_count": total_chunks,
            "storage_path": str(config.storage_path),
            "docs_file_path": str(docs_file),
            "docs_file_exists": docs_file.exists(),
            "cwd": os.getcwd(),
            "llm_status": llm_status,
            "documents": [
                {
                    "id": doc_id[:8] + "...",
                    "filename": doc_data.get("metadata", {}).get("filename", "Unknown"),
                    "content_length": len(doc_data.get("content", "")),
                }
                for doc_id, doc_data in list(rag_system.documents.items())[:5]
            ],
        }
    )


@rag_bp.route("/ingest", methods=["POST"])
def ingest_documents():
    """Scan docs_to_import folder and import any files not yet in the index.

    Drop new PDF/TXT/MD files into the docs_to_import directory and call this
    endpoint to add them to the RAG index without re-importing existing documents.
    """
    try:
        result = rag_system.import_new_documents()
        if "error" in result:
            return jsonify(result), 404
        return jsonify(
            {
                "status": "success",
                "new_documents": result["imported"],
                "total_documents": result["total"],
            }
        )
    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/reload", methods=["POST"])
def reload_rag():
    """Reload RAG system to pick up new documents/chunks."""
    global rag_system, chat_engine  # pylint: disable=global-statement

    try:
        # Reinitialize RAG system
        new_config = RAGConfig.from_env()
        rag_system = SimpleRAG(new_config)
        chat_engine = SimpleChatEngine(rag_system)

        return jsonify(
            {
                "status": "success",
                "message": "RAG system reloaded",
                "documents_count": len(rag_system.documents),
                "chunks_count": len(rag_system.document_chunks),
            }
        )
    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/search", methods=["POST"])
def search():
    """Handle search requests."""
    try:
        data = request.get_json()
        query = data.get("query", "")
        max_results = data.get("max_results", 5)

        if not query:
            return jsonify({"error": "Query is required"}), 400

        # Search for relevant documents
        results = rag_system.search(query)

        # Limit results
        limited_results = results[:max_results]

        return jsonify({"results": limited_results, "total": len(results)})

    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/chat", methods=["POST"])
def chat():
    """Handle chat requests."""
    try:
        data = request.get_json()
        message = data.get("message", "")

        if not message:
            return jsonify({"error": "Message is required"}), 400

        # Get response from chat engine
        result = chat_engine.chat(message)

        return jsonify({"response": result["response"], "citations": result["citations"]})

    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/chat-stream", methods=["POST"])
def chat_stream():
    """Handle streaming chat requests."""
    try:
        data = request.get_json()
        message = data.get("message", "")

        if not message:
            return jsonify({"error": "Message is required"}), 400

        def generate():
            try:
                # Get response from chat engine
                result = chat_engine.chat(message)
                response_text = result["response"]

                # Stream response word by word
                words = response_text.split()
                for word in words:
                    yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"

                # Send citations at the end
                yield f"data: {json.dumps({'type': 'citations', 'content': {'citations': result['citations']}})}\n\n"
                yield "data: [DONE]\n\n"

            except Exception as e:  # pylint: disable=broad-exception-caught
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        return Response(
            generate(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Cache-Control",
            },
        )

    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/chat", methods=["GET"])
def chat_stream_get():
    """Handle streaming chat requests via GET for EventSource."""
    try:
        message = request.args.get("message", "")

        if not message:
            return (
                "data: " + json.dumps({"type": "error", "content": "Message is required"}) + "\n\n",
                400,
            )

        def generate():
            try:
                # Get response from chat engine
                result = chat_engine.chat(message)
                response_text = result["response"]

                # Stream response word by word
                words = response_text.split()
                for word in words:
                    yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"

                # Send citations at the end
                yield f"data: {json.dumps({'type': 'citations', 'content': {'citations': result['citations']}})}\n\n"
                yield "data: [DONE]\n\n"

            except Exception as e:  # pylint: disable=broad-exception-caught
                yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        return Response(
            generate(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Cache-Control",
            },
        )

    except Exception as e:  # pylint: disable=broad-exception-caught
        return "data: " + json.dumps({"type": "error", "content": str(e)}) + "\n\n", 500


@rag_bp.route("/upload", methods=["POST"])
def upload_document():
    """Handle document upload."""
    try:
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

        # Save file temporarily
        filename = secure_filename(file.filename)
        temp_path = config.storage_path / "temp" / filename
        temp_path.parent.mkdir(exist_ok=True)
        file.save(temp_path)

        try:
            # Extract text content
            content = _extract_text_from_file(temp_path)

            # Add to RAG system
            metadata = {
                "filename": filename,
                "size": temp_path.stat().st_size,
                "type": file_ext,
            }

            doc_id = rag_system.add_document(content, metadata)

            # Clean up temp file
            temp_path.unlink()

            return jsonify(
                {
                    "message": "Document uploaded successfully",
                    "document_id": doc_id,
                    "filename": filename,
                }
            )

        except Exception as e:
            # Clean up temp file on error
            if temp_path.exists():
                temp_path.unlink()
            raise e

    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/sources", methods=["GET"])
def get_sources():
    """Get all document sources."""
    try:
        sources = rag_system.get_sources()
        return jsonify({"sources": sources})
    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


@rag_bp.route("/sources/<doc_id>", methods=["DELETE"])
def delete_source(doc_id):
    """Delete a document source."""
    try:
        success = rag_system.delete_document(doc_id)
        if success:
            return jsonify({"message": "Document deleted successfully"})
        return jsonify({"error": "Document not found"}), 404
    except Exception as e:  # pylint: disable=broad-exception-caught
        return jsonify({"error": str(e)}), 500


def _extract_text_from_file(file_path: Path) -> str:
    """Extract text content from a file."""
    suffix = file_path.suffix.lower()

    if suffix in [".txt", ".md"]:
        return file_path.read_text(encoding="utf-8")
    if suffix == ".pdf":
        try:
            import PyPDF2  # pylint: disable=import-outside-toplevel

            text = ""
            with open(file_path, "rb") as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page in pdf_reader.pages:
                    text += page.extract_text() + "\n"
            return text
        except ImportError:
            return "PDF processing not available. Please install PyPDF2."
    if suffix == ".csv":
        try:
            import pandas as pd  # pylint: disable=import-outside-toplevel

            df = pd.read_csv(file_path)
            return df.to_string()
        except ImportError:
            # Fallback: simple CSV reading
            return file_path.read_text(encoding="utf-8")
    if suffix == ".docx":
        try:
            import docx  # pylint: disable=import-outside-toplevel

            doc = docx.Document(file_path)
            return "\n".join([paragraph.text for paragraph in doc.paragraphs])
        except ImportError:
            return "DOCX processing not available. Please install python-docx."
    raise ValueError(f"Unsupported file type: {suffix}")


@rag_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "RAG service is running"})
