from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import interview_data, mock_data
from app.aivana import AivanaError
from app.db import get_db
from app.interview_feedback_ai import generate_feedback
from app.interview_ai import generate_questions
from app.interview_summary_ai import generate_summary
from app.models import InterviewSessionRecord, InterviewTurn
from app.schemas import (
    BehavioralDetailedFeedback,
    DetailedFeedbackRequest,
    InterviewAnswer,
    InterviewFeedback,
    InterviewMode,
    InterviewQuestion,
    InterviewFeedbackDetail,
    InterviewSessionCreate,
    InterviewSessionCreated,
    InterviewSummary,
    InterviewTurnAnswer,
    InterviewTurnEvaluated,
    SessionInterviewQuestionResult,
    SessionInterviewSummary,
    TechnicalDetailedFeedback,
)

router = APIRouter(prefix="/api/interview", tags=["interview"])


def _raise_aivana_http_error(error: AivanaError) -> None:
    status_code = 503 if error.code == "not_configured" else 502
    raise HTTPException(
        status_code=status_code,
        detail={"message": str(error), "code": error.code, "request_id": error.request_id},
    ) from error


@router.post("/sessions", response_model=InterviewSessionCreated, status_code=201)
def create_session(req: InterviewSessionCreate, db: Session = Depends(get_db)) -> InterviewSessionCreated:
    try:
        generated_questions = generate_questions(req.company, req.position, req.mode)
    except AivanaError as error:
        _raise_aivana_http_error(error)

    record = InterviewSessionRecord(
        company=req.company,
        position=req.position,
        mode=req.mode,
        turns=[
            InterviewTurn(
                question_index=index,
                question=question,
                question_type=req.mode,
            )
            for index, question in enumerate(generated_questions)
        ],
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    questions = [
        InterviewQuestion(
            id=f"{req.mode}-{index + 1}",
            question=question,
            type=req.mode,
        )
        for index, question in enumerate(generated_questions)
    ]
    return InterviewSessionCreated(
        session_id=record.id,
        company=record.company,
        position=record.position,
        mode=req.mode,
        status="active",
        current_question_index=record.current_question_index,
        questions=questions,
    )


@router.post("/sessions/{session_id}/answers", response_model=InterviewTurnEvaluated)
def submit_session_answer(
    session_id: str,
    req: InterviewTurnAnswer,
    db: Session = Depends(get_db),
) -> InterviewTurnEvaluated:
    record = db.get(InterviewSessionRecord, session_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if req.question_index != record.current_question_index:
        raise HTTPException(status_code=409, detail="Answer does not match the current question")
    if req.answer_type == "code" and record.mode != "technical":
        raise HTTPException(status_code=422, detail="Code answers are only supported in technical interviews")

    turn = db.scalar(
        select(InterviewTurn).where(
            InterviewTurn.session_id == session_id,
            InterviewTurn.question_index == req.question_index,
        )
    )
    if turn is None:
        raise HTTPException(status_code=409, detail="Current interview question is unavailable")
    if turn.feedback is not None:
        raise HTTPException(status_code=409, detail="This answer has already been evaluated")

    try:
        generated = generate_feedback(
            company=record.company,
            position=record.position,
            mode=record.mode,
            question=turn.question,
            answer=req.answer,
            answer_type=req.answer_type,
            language=req.language,
        )
    except AivanaError as error:
        _raise_aivana_http_error(error)

    turn.answer = req.answer
    turn.answer_type = req.answer_type
    turn.language = req.language
    turn.feedback = generated.model_dump()
    turn.score = generated.score
    record.current_question_index = req.question_index + 1
    db.commit()

    next_turn = db.scalar(
        select(InterviewTurn).where(
            InterviewTurn.session_id == session_id,
            InterviewTurn.question_index == record.current_question_index,
        )
    )
    next_question = None
    if next_turn is not None:
        next_question = InterviewQuestion(
            id=f"{record.mode}-{next_turn.question_index + 1}",
            question=next_turn.question,
            type=record.mode,
        )

    return InterviewTurnEvaluated(
        session_id=record.id,
        question_index=req.question_index,
        question_id=f"{record.mode}-{req.question_index + 1}",
        current_question_index=record.current_question_index,
        next_question=next_question,
        **generated.model_dump(),
    )


@router.post("/sessions/{session_id}/summary", response_model=SessionInterviewSummary)
def create_session_summary(
    session_id: str,
    db: Session = Depends(get_db),
) -> SessionInterviewSummary:
    record = db.get(InterviewSessionRecord, session_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if record.summary is not None:
        return SessionInterviewSummary.model_validate(record.summary)

    turns = list(
        db.scalars(
            select(InterviewTurn)
            .where(InterviewTurn.session_id == session_id)
            .order_by(InterviewTurn.question_index)
        )
    )
    if (
        len(turns) != 5
        or record.current_question_index != 5
        or any(turn.answer is None or turn.feedback is None or turn.score is None for turn in turns)
    ):
        raise HTTPException(status_code=409, detail="Interview must be completed before generating a summary")

    validated_feedback = [InterviewFeedbackDetail.model_validate(turn.feedback) for turn in turns]
    summary_context = [
        {
            "question": turn.question,
            "answer": turn.answer,
            "score": turn.score,
            "strengths": feedback.strengths,
            "areas_to_improve": feedback.areas_to_improve,
        }
        for turn, feedback in zip(turns, validated_feedback, strict=True)
    ]
    try:
        generated = generate_summary(
            company=record.company,
            position=record.position,
            mode=record.mode,
            turns=summary_context,
        )
    except AivanaError as error:
        _raise_aivana_http_error(error)

    total_score = sum(turn.score for turn in turns if turn.score is not None)
    result = SessionInterviewSummary(
        session_id=record.id,
        total_score=total_score,
        average_score=round(total_score / len(turns), 2),
        question_results=[
            SessionInterviewQuestionResult(
                question=turn.question,
                answer=turn.answer or "",
                score=turn.score if turn.score is not None else 0,
                feedback=feedback.feedback,
            )
            for turn, feedback in zip(turns, validated_feedback, strict=True)
        ],
        **generated.model_dump(),
    )
    record.summary = result.model_dump()
    db.commit()
    return result


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
