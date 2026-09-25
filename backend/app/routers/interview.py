from fastapi import APIRouter

from app import mock_data
from app.schemas import InterviewAnswer, InterviewFeedback, InterviewQuestion

router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.get("/questions", response_model=list[InterviewQuestion])
def get_questions() -> list[InterviewQuestion]:
    """Mocked question generation. This is where the Aivana MMI call goes."""
    return mock_data.QUESTIONS


@router.post("/feedback", response_model=InterviewFeedback)
def get_feedback(answer: InterviewAnswer) -> InterviewFeedback:
    """Mocked feedback. This is where the Aivana MMI call goes."""
    return mock_data.FEEDBACK
