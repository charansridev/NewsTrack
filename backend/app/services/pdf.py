"""Render a report dataset to a PDF (title, date range, generation timestamp)."""

import io
from datetime import datetime, timezone

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _fmt_range(from_, to) -> str:
    lo = from_.isoformat() if from_ else "—"
    hi = to.isoformat() if to else "—"
    return f"{lo}  to  {hi}"


def build_report_pdf(title: str, columns: list[str], rows: list[list], *,
                     from_=None, to=None) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"NewsTrack — {title}", styles["Title"]),
        Paragraph(f"Date range: {_fmt_range(from_, to)}", styles["Normal"]),
        Paragraph(
            f"Generated: {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
            styles["Normal"],
        ),
        Spacer(1, 16),
    ]

    table_data = [columns] + [[str(c) for c in r] for r in rows] if rows else [columns, ["(no data)"]]
    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#eef2f7")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(table)
    doc.build(story)
    return buf.getvalue()
