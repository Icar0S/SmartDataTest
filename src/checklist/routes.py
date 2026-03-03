"""Flask routes for Checklist Support QA."""

from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from .models import run_to_dict, template_to_dict
from .reports import generate_markdown_report, generate_pdf_report
from .storage import ChecklistStorage, load_template

# Create blueprint
checklist_bp = Blueprint("checklist", __name__, url_prefix="/api/checklist")

# Initialize storage
STORAGE_PATH = Path(__file__).parent.parent.parent / "data" / "checklist"
storage = ChecklistStorage(STORAGE_PATH)

# Load template once at startup
TEMPLATE = load_template()


@checklist_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "Checklist service is running"})


@checklist_bp.route("/template", methods=["GET"])
def get_template():
    """Get the checklist template.

    Returns:
        JSON with template data
    """
    return jsonify(template_to_dict(TEMPLATE))


@checklist_bp.route("/runs", methods=["POST"])
def create_run():
    """Create a new checklist run.

    Request JSON:
        user_id: User identifier
        project_id: Optional project identifier

    Returns:
        JSON with created run data
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_id = data.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        project_id = data.get("project_id")

        # Create run
        run = storage.create_run(user_id, project_id)

        return (
            jsonify(
                {
                    "id": run.id,
                    "user_id": run.user_id,
                    "project_id": run.project_id,
                    "created_at": run.created_at.isoformat(),
                    "updated_at": run.updated_at.isoformat(),
                    "marks": {},
                }
            ),
            201,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@checklist_bp.route("/runs/<run_id>", methods=["GET"])
def get_run(run_id):
    """Get a checklist run by ID.

    Args:
        run_id: Run identifier

    Returns:
        JSON with run data
    """
    run = storage.get_run(run_id)

    if not run:
        return jsonify({"error": "Run not found"}), 404

    return jsonify(run_to_dict(run))


@checklist_bp.route("/runs/<run_id>", methods=["PUT"])
def update_run(run_id):
    """Update marks and metadata for a checklist run.

    Args:
        run_id: Run identifier

    Request JSON:
        marks: List of {itemId, status} objects
        metadata: Optional object with test metadata fields

    Returns:
        JSON with updated run data
    """
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No data provided"}), 400

        marks_list = data.get("marks", [])

        # Convert list to dict
        marks_dict = {}
        for mark in marks_list:
            item_id = mark.get("itemId")
            status = mark.get("status")

            if not item_id or not status:
                continue

            # Validate status
            if status not in ["DONE", "NOT_DONE"]:
                return jsonify({"error": f"Invalid status: {status}"}), 400

            marks_dict[item_id] = status

        # Get metadata if provided
        metadata_data = data.get("metadata")

        # Update run
        run = storage.update_run(run_id, marks_dict, metadata_data)

        if not run:
            return jsonify({"error": "Run not found"}), 404

        return jsonify(run_to_dict(run))

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@checklist_bp.route("/runs/<run_id>/recommendations", methods=["POST"])
def generate_recommendations(run_id):
    """Generate recommendations using RAG for missing items.

    Args:
        run_id: Run identifier

    Request JSON:
        missingItemIds: List of item IDs that are not done

    Returns:
        JSON with recommendations
    """
    try:
        run = storage.get_run(run_id)

        if not run:
            return jsonify({"error": "Run not found"}), 404

        data = request.get_json()
        missing_item_ids = data.get("missingItemIds", [])

        # Find missing items
        missing_items = []
        for dim in TEMPLATE.dimensions:
            for item in dim.items:
                if item.id in missing_item_ids:
                    missing_items.append(item)

        # Sort by priority
        missing_items.sort(key=lambda x: x.priority_weight, reverse=True)

        # Build query for RAG
        if missing_items:
            query_parts = []
            for item in missing_items[:5]:  # Top 5 missing items
                query_parts.append(f"{item.code}: {item.title}")

            query = (
                "Forneça recomendações para implementar os seguintes itens de QA de Big Data:\n"
                + "\n".join(query_parts)
            )

            # Call RAG system (import here to avoid circular dependency)
            try:
                from rag.config_simple import RAGConfig
                from rag.simple_rag import SimpleRAG

                rag_config = RAGConfig.from_env()
                rag_system = SimpleRAG(rag_config)

                results = rag_system.search(query, top_k=5)

                # Format recommendations
                recommendations = []

                # Add main recommendation based on missing items
                rec_content = f"Baseado nos itens faltantes priorizados, recomendamos focar em:\n\n"
                for i, item in enumerate(missing_items[:3], 1):
                    rec_content += f"{i}. **{item.code}**: {item.manual}\n"

                recommendations.append(
                    {
                        "title": "Prioridades Principais",
                        "content": rec_content,
                        "sources": [
                            r.get("metadata", {}).get("filename", "Unknown") for r in results[:3]
                        ],
                    }
                )

                # Add RAG-based recommendations
                for result in results[:3]:
                    recommendations.append(
                        {
                            "title": f"Recomendação: {result.get('metadata', {}).get('filename', 'Unknown')}",
                            "content": result.get("content", "")[:500] + "...",
                            "sources": [result.get("metadata", {}).get("filename", "Unknown")],
                        }
                    )

                return jsonify({"recommendations": recommendations})

            except Exception as rag_error:
                # Fallback if RAG is not available
                print(f"RAG error: {rag_error}")

                recommendations = []
                for item in missing_items[:5]:
                    recommendations.append(
                        {
                            "title": f"{item.code} - {item.title}",
                            "content": item.manual,
                            "sources": item.references,
                        }
                    )

                return jsonify({"recommendations": recommendations})

        return jsonify({"recommendations": []})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@checklist_bp.route("/runs/<run_id>/report", methods=["POST"])
def download_report(run_id):
    """Download report in PDF or Markdown format.

    Args:
        run_id: Run identifier

    Request JSON:
        format: "pdf" or "md"
        recommendations: Optional list of recommendations

    Returns:
        File download
    """
    try:
        run = storage.get_run(run_id)

        if not run:
            return jsonify({"error": "Run not found"}), 404

        data = request.get_json()
        format_type = data.get("format", "pdf")
        recommendations = data.get("recommendations", [])

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if format_type == "md":
            # Generate Markdown
            md_content = generate_markdown_report(run, TEMPLATE, recommendations)

            # Save to file
            filename = f"checklist_report_{run_id[:8]}_{timestamp}.md"
            filepath = STORAGE_PATH / "reports" / filename
            filepath.parent.mkdir(parents=True, exist_ok=True)

            with open(filepath, "w", encoding="utf-8") as f:
                f.write(md_content)

            return send_file(
                filepath,
                as_attachment=True,
                download_name=filename,
                mimetype="text/markdown",
            )

        elif format_type == "pdf":
            # Generate PDF
            pdf_buffer = generate_pdf_report(run, TEMPLATE, recommendations)

            filename = f"checklist_report_{run_id[:8]}_{timestamp}.pdf"

            return send_file(
                pdf_buffer,
                as_attachment=True,
                download_name=filename,
                mimetype="application/pdf",
            )

        else:
            return jsonify({"error": "Invalid format. Use 'pdf' or 'md'"}), 400

    except Exception as e:
        print(f"Error generating report: {e}")
        return jsonify({"error": str(e)}), 500
