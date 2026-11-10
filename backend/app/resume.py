"""Turns an uploaded resume (PDF, Word .docx or plain text) into plain text.

Only text is extracted; the fit analysis prompt reads it as written. A scanned PDF
(an image of a page) has no text layer.
"""

import io
import re

from docx import Document
from pypdf import PdfReader

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB; a text resume is far smaller


class ResumeError(Exception):
    """The file couldn't be turned into resume text; the message is shown to the user."""


def extract_text(filename: str, data: bytes) -> str:
    name = filename.lower()
    if name.endswith(".pdf"):
        text = _pdf_text(data)
    elif name.endswith(".docx"):
        text = _docx_text(data)
    elif name.endswith(".txt"):
        text = data.decode("utf-8", errors="replace")
    else:
        raise ResumeError("Upload a PDF, Word (.docx) or .txt file.")

    text = _tidy(text)
    if not text:
        raise ResumeError(
            "No text was found in this file. If it's a scanned PDF, export your resume "
            "as a text-based PDF or a Word file instead."
        )
    return text


def _pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ResumeError("This PDF is password-protected. Remove the password and upload it again.")
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except ResumeError:
        raise
    except Exception as e:  # pypdf raises many different errors for damaged files
        raise ResumeError("This PDF couldn't be read. Try exporting it again or upload a Word file.") from e


def _docx_text(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
    except Exception as e:
        raise ResumeError("This Word file couldn't be read. Make sure it's a .docx, not an older .doc.") from e
    parts = [p.text for p in doc.paragraphs]
    # Many resume templates lay out sections in tables, which paragraphs don't include.
    for table in doc.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def _tidy(text: str) -> str:
    lines = (re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines())
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()