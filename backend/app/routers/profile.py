import asyncio

from fastapi import APIRouter, HTTPException, UploadFile

from app import resume
from app.schemas import MAX_RESUME_CHARS, ResumeUploadResult

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.post("/resume", response_model=ResumeUploadResult)
async def upload_resume(file: UploadFile) -> ResumeUploadResult:
    """Extracts the text of an uploaded resume. Nothing is stored on the server: the
    browser keeps the text with the rest of the profile and sends it with each fit analysis."""
    data = await file.read(resume.MAX_UPLOAD_BYTES + 1)
    if len(data) > resume.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"message": "That file is over 5 MB. Upload a smaller resume.", "code": "file_too_large"},
        )
    try:
        text = await asyncio.to_thread(resume.extract_text, file.filename or "", data)
    except resume.ResumeError as e:
        raise HTTPException(status_code=422, detail={"message": str(e), "code": "bad_resume"}) from e

    return ResumeUploadResult(
        filename=file.filename or "resume",
        text=text[:MAX_RESUME_CHARS],
        truncated=len(text) > MAX_RESUME_CHARS,
    )