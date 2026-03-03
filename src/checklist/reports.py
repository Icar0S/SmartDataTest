"""Report generation for checklist runs."""

from io import BytesIO
from typing import Any, Dict, List

from .models import ChecklistRun, ChecklistTemplate, ItemStatus
from .storage import load_template

# Optional imports for PDF generation
REPORTLAB_AVAILABLE = False
try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    REPORTLAB_AVAILABLE = True
except ImportError:
    pass


def generate_markdown_report(
    run: ChecklistRun,
    template: ChecklistTemplate,
    recommendations: List[Dict[str, Any]] | None = None,
) -> str:
    """Generate Markdown report for a checklist run.

    Args:
        run: ChecklistRun instance
        template: ChecklistTemplate instance
        recommendations: Optional list of recommendations from RAG

    Returns:
        Markdown string
    """
    md_lines = []

    # Header
    md_lines.append(f"# {template.name}")
    md_lines.append("")
    md_lines.append(f"**Data:** {run.updated_at.strftime('%d/%m/%Y %H:%M')}")
    md_lines.append(f"**Usuário:** {run.user_id}")
    if run.project_id:
        md_lines.append(f"**Projeto:** {run.project_id}")
    md_lines.append("")

    # Add test metadata if available
    if run.metadata:
        md_lines.append("## Informações do Teste")
        md_lines.append("")
        if run.metadata.tester_name:
            md_lines.append(f"- **Nome do Testador:** {run.metadata.tester_name}")
        if run.metadata.test_environment:
            md_lines.append(f"- **Ambiente de Teste:** {run.metadata.test_environment}")
        if run.metadata.browser_platform:
            md_lines.append(f"- **Navegador/Plataforma:** {run.metadata.browser_platform}")
        if run.metadata.test_duration:
            md_lines.append(f"- **Duração do Teste:** {run.metadata.test_duration}")
        if run.metadata.additional_notes:
            md_lines.append(f"- **Observações Adicionais:** {run.metadata.additional_notes}")
        md_lines.append("")

    # Summary
    total_items = sum(len(dim.items) for dim in template.dimensions)
    done_items = sum(1 for status in run.marks.values() if status == ItemStatus.DONE)
    coverage = (done_items / total_items * 100) if total_items > 0 else 0

    md_lines.append("## Resumo")
    md_lines.append("")
    md_lines.append(f"- **Total de itens:** {total_items}")
    md_lines.append(f"- **Itens concluídos:** {done_items}")
    md_lines.append(f"- **Cobertura:** {coverage:.1f}%")
    md_lines.append("")

    # Coverage by dimension
    md_lines.append("## Cobertura por Dimensão")
    md_lines.append("")

    for dim in template.dimensions:
        dim_total = len(dim.items)
        dim_done = sum(1 for item in dim.items if run.marks.get(item.id) == ItemStatus.DONE)
        dim_coverage = (dim_done / dim_total * 100) if dim_total > 0 else 0
        md_lines.append(f"### {dim.name}")
        md_lines.append(f"- **Concluídos:** {dim_done}/{dim_total} ({dim_coverage:.1f}%)")
        md_lines.append("")

    # Missing items (prioritized)
    missing_items = []
    for dim in template.dimensions:
        for item in dim.items:
            if run.marks.get(item.id) != ItemStatus.DONE:
                missing_items.append((dim.name, item))

    # Sort by priority_weight descending
    missing_items.sort(key=lambda x: x[1].priority_weight, reverse=True)

    if missing_items:
        md_lines.append("## Itens Faltantes (Priorizados)")
        md_lines.append("")

        for dim_name, item in missing_items:
            md_lines.append(f"### {item.code} - {item.title}")
            md_lines.append(f"**Dimensão:** {dim_name}")
            md_lines.append(f"**Prioridade:** {item.priority_weight}")
            md_lines.append(f"**Manual:** {item.manual}")
            md_lines.append(f"**Referências:** {', '.join(item.references)}")
            md_lines.append("")

    # Recommendations
    if recommendations:
        md_lines.append("## Recomendações (LLM + RAG)")
        md_lines.append("")

        for rec in recommendations:
            if isinstance(rec, dict):
                md_lines.append(f"### {rec.get('title', 'Recomendação')}")
                md_lines.append("")
                md_lines.append(rec.get("content", ""))
                md_lines.append("")
                if rec.get("sources"):
                    md_lines.append(f"**Fontes:** {', '.join(rec['sources'])}")
                    md_lines.append("")
            else:
                md_lines.append(str(rec))
                md_lines.append("")

    # Full manual
    md_lines.append("## Manual Completo")
    md_lines.append("")

    for dim in template.dimensions:
        md_lines.append(f"### {dim.name}")
        md_lines.append("")

        for item in dim.items:
            status = "[DONE]" if run.marks.get(item.id) == ItemStatus.DONE else "[PENDING]"
            md_lines.append(f"#### {status} {item.code} - {item.title}")
            md_lines.append(f"**Manual:** {item.manual}")
            md_lines.append(f"**Referências:** {', '.join(item.references)}")
            md_lines.append(f"**Prioridade:** {item.priority_weight}")
            md_lines.append("")

    return "\n".join(md_lines)


def generate_pdf_report(
    run: ChecklistRun,
    template: ChecklistTemplate,
    recommendations: List[Dict[str, Any]] | None = None,
) -> BytesIO:
    """Generate PDF report for a checklist run.

    Args:
        run: ChecklistRun instance
        template: ChecklistTemplate instance
        recommendations: Optional list of recommendations from RAG

    Returns:
        BytesIO containing PDF data

    Raises:
        ImportError: If reportlab is not available
    """
    if not REPORTLAB_AVAILABLE:
        raise ImportError(
            "reportlab is required for PDF generation. Install with: pip install reportlab"
        )

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=30,
        alignment=TA_CENTER,
    )

    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=16,
        textColor=colors.HexColor("#16213e"),
        spaceAfter=12,
        spaceBefore=20,
    )

    # Title
    story.append(Paragraph(template.name, title_style))
    story.append(Spacer(1, 0.2 * inch))

    # Metadata
    metadata_data = [
        ["Data:", run.updated_at.strftime("%d/%m/%Y %H:%M")],
        ["Usuário:", run.user_id],
    ]
    if run.project_id:
        metadata_data.append(["Projeto:", run.project_id])

    # Add test metadata if available
    if run.metadata:
        if run.metadata.tester_name:
            metadata_data.append(["Nome do Testador:", run.metadata.tester_name])
        if run.metadata.test_environment:
            metadata_data.append(["Ambiente de Teste:", run.metadata.test_environment])
        if run.metadata.browser_platform:
            metadata_data.append(["Navegador/Plataforma:", run.metadata.browser_platform])
        if run.metadata.test_duration:
            metadata_data.append(["Duração do Teste:", run.metadata.test_duration])
        if run.metadata.additional_notes:
            metadata_data.append(["Observações Adicionais:", run.metadata.additional_notes])

    metadata_table = Table(metadata_data, colWidths=[2 * inch, 4 * inch])
    metadata_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ]
        )
    )
    story.append(metadata_table)
    story.append(Spacer(1, 0.3 * inch))

    # Summary
    story.append(Paragraph("Resumo", heading_style))

    total_items = sum(len(dim.items) for dim in template.dimensions)
    done_items = sum(1 for status in run.marks.values() if status == ItemStatus.DONE)
    coverage = (done_items / total_items * 100) if total_items > 0 else 0

    summary_data = [
        ["Total de itens:", str(total_items)],
        ["Itens concluídos:", str(done_items)],
        ["Cobertura:", f"{coverage:.1f}%"],
    ]

    summary_table = Table(summary_data, colWidths=[3 * inch, 3 * inch])
    summary_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 11),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0f0f0")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 0.3 * inch))

    # Coverage by dimension
    story.append(Paragraph("Cobertura por Dimensão", heading_style))

    dim_data = [["Dimensão", "Concluídos", "Total", "Cobertura"]]
    for dim in template.dimensions:
        dim_total = len(dim.items)
        dim_done = sum(1 for item in dim.items if run.marks.get(item.id) == ItemStatus.DONE)
        dim_coverage = (dim_done / dim_total * 100) if dim_total > 0 else 0
        dim_data.append([dim.name, str(dim_done), str(dim_total), f"{dim_coverage:.1f}%"])

    dim_table = Table(dim_data, colWidths=[2.5 * inch, 1.2 * inch, 1 * inch, 1.3 * inch])
    dim_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(dim_table)
    story.append(Spacer(1, 0.3 * inch))

    # Missing items
    missing_items = []
    for dim in template.dimensions:
        for item in dim.items:
            if run.marks.get(item.id) != ItemStatus.DONE:
                missing_items.append((dim.name, item))

    missing_items.sort(key=lambda x: x[1].priority_weight, reverse=True)

    if missing_items:
        story.append(Paragraph("Itens Faltantes (Priorizados)", heading_style))

        for dim_name, item in missing_items[:10]:  # Limit to top 10 for PDF
            story.append(Paragraph(f"<b>{item.code}</b> - {item.title}", styles["Normal"]))
            story.append(
                Paragraph(
                    f"Dimensão: {dim_name} | Prioridade: {item.priority_weight}",
                    styles["Normal"],
                )
            )
            story.append(Spacer(1, 0.1 * inch))

    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer
