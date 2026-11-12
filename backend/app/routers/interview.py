from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import interview_data, mock_data
from app.aivana import AivanaError
from app.db import get_db
from app.interview_feedback_ai import generate_feedback
from app.interview_ai import generate_questions, generate_resume_aware_questions
from app.interview_summary_ai import generate_summary
from app.models import InterviewSessionContext, InterviewSessionRecord, InterviewTurn
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
    InterviewStats,
    InterviewSummary,
    InterviewTurnAnswer,
    InterviewTurnEvaluated,
    SessionInterviewQuestionResult,
    SessionInterviewSummary,
    TechnicalDetailedFeedback,
)

router = APIRouter(prefix="/api/interview", tags=["interview"])
RESUME_QUESTION_CATEGORIES = frozenset({"resume", "resume_position", "resume_technical"})


def _public_question_type(mode: InterviewMode, category: str) -> str:
    return "general" if category == "general" else mode

QUESTIONS_PER_SESSION = 5


def _raise_aivana_http_error(error: AivanaError) -> None:
    status_code = 503 if error.code == "not_configured" else 502
    raise HTTPException(
        status_code=status_code,
        detail={"message": str(error), "code": error.code, "request_id": error.request_id},
    ) from error


@router.post("/sessions", response_model=InterviewSessionCreated, status_code=201)
def create_session(req: InterviewSessionCreate, db: Session = Depends(get_db)) -> InterviewSessionCreated:
    resume_text = (req.resume_text or "").strip()
    try:
        if resume_text:
            generated = generate_resume_aware_questions(req.company, req.position, req.mode, resume_text)
            question_specs = [(question.question, question.category) for question in generated]
        else:
            generated_questions = generate_questions(req.company, req.position, req.mode)
            question_specs = [(question, req.mode) for question in generated_questions]
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
                question_type=category,
            )
            for index, (question, category) in enumerate(question_specs)
        ],
    )
    db.add(record)
    db.flush()
    if resume_text:
        db.add(InterviewSessionContext(session_id=record.id, resume_text=resume_text))
    db.commit()
    db.refresh(record)

    questions = [
        InterviewQuestion(
            id=f"{req.mode}-{index + 1}",
            question=question,
            type=_public_question_type(req.mode, category),
        )
        for index, (question, category) in enumerate(question_specs)
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

    resume_text = ""
    if turn.question_type in RESUME_QUESTION_CATEGORIES:
        context = db.get(InterviewSessionContext, session_id)
        if context is None:
            raise HTTPException(status_code=409, detail="Resume context is unavailable for this question")
        resume_text = context.resume_text

    try:
        feedback_args = {
            "company": record.company,
            "position": record.position,
            "mode": record.mode,
            "question": turn.question,
            "answer": req.answer,
            "answer_type": req.answer_type,
            "language": req.language,
        }
        if resume_text:
            feedback_args["resume_text"] = resume_text
        generated = generate_feedback(**feedback_args)
    except AivanaError as error:
        _raise_aivana_http_error(error)

    turn.answer = req.answer
    turn.answer_type = req.answer_type
    turn.language = req.language
    turn.feedback = generated.model_dump()
    turn.score = generated.score
    record.current_question_index = req.question_index + 1
    if record.current_question_index >= QUESTIONS_PER_SESSION:
        record.status = "completed"  # updated_at then marks when; the weekly count uses it
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
            type=_public_question_type(record.mode, next_turn.question_type),
        )

    return InterviewTurnEvaluated(
        session_id=record.id,
        question_index=req.question_index,
        question_id=f"{record.mode}-{req.question_index + 1}",
        current_question_index=record.current_question_index,
        next_question=next_question,
        **generated.model_dump(),
    )


@router.get("/stats", response_model=InterviewStats)
def interview_stats(
    mode: InterviewMode,
    since: datetime,
    db: Session = Depends(get_db),
) -> InterviewStats:
    """Interviews of this mode completed (all five questions answered): since `since` --
    the frontend sends the start of the user's week in their own time zone -- and ever."""
    since_utc = since.astimezone(timezone.utc) if since.tzinfo else since.replace(tzinfo=timezone.utc)
    finished = list(db.scalars(
        select(InterviewSessionRecord.updated_at).where(
            InterviewSessionRecord.mode == mode,
            InterviewSessionRecord.current_question_index >= QUESTIONS_PER_SESSION,
        )
    ))
    # SQLite gives naive datetimes back; they're stored in UTC.
    completed = sum(1 for at in finished if (at if at.tzinfo else at.replace(tzinfo=timezone.utc)) >= since_utc)
    return InterviewStats(mode=mode, completed=completed, total=len(finished))


@router.post(
    "/sessions/{session_id}/summary",
    response_model=SessionInterviewSummary,
    response_model_exclude_none=True,
)
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
        len(turns) != QUESTIONS_PER_SESSION
        or record.current_question_index != QUESTIONS_PER_SESSION
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
    context = db.get(InterviewSessionContext, session_id)
    try:
        summary_args = {
            "company": record.company,
            "position": record.position,
            "mode": record.mode,
            "turns": summary_context,
        }
        if context is not None:
            summary_args["resume_text"] = context.resume_text
        generated = generate_summary(**summary_args)
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
    record.summary = result.model_dump(exclude_none=True)
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
