from fastapi import APIRouter, HTTPException

from app import interview_data, mock_data
from app.schemas import (
    BehavioralDetailedFeedback,
    DetailedFeedbackRequest,
    InterviewAnswer,
    InterviewFeedback,
    InterviewMode,
    InterviewQuestion,
    InterviewSummary,
    TechnicalDetailedFeedback,
)

router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.get("/questions", response_model=list[InterviewQuestion])
def get_questions(mode: InterviewMode | None = None) -> list[InterviewQuestion]:
    """Prepared questions. A future Aivana MMI call can replace this lookup."""
    if mode is not None:
        return interview_data.QUESTIONS_BY_MODE[mode]
    return [
        question
        for questions in interview_data.QUESTIONS_BY_MODE.values()
        for question in questions
    ]


@router.post("/feedback", response_model=InterviewFeedback)
def get_feedback(answer: InterviewAnswer) -> InterviewFeedback:
    """Mocked feedback. This is where the Aivana MMI call goes."""
    return mock_data.FEEDBACK


@router.post(
    "/detailed-feedback",
    response_model=BehavioralDetailedFeedback | TechnicalDetailedFeedback,
)
def get_detailed_feedback(
    req: DetailedFeedbackRequest,
) -> BehavioralDetailedFeedback | TechnicalDetailedFeedback:
    """Returns prepared detailed feedback for the requested interview question."""
    result = interview_data.DETAILED_FEEDBACK_BY_QUESTION_ID.get(req.question_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Interview question not found")
    return result


@router.get("/summary", response_model=InterviewSummary)
def get_summary(mode: InterviewMode) -> InterviewSummary:
    """Returns the prepared summary for one interview mode."""
    return interview_data.SUMMARIES_BY_MODE[mode]
