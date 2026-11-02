"""Aivana-backed evaluation of one answer in a persisted interview session."""

import json

from pydantic import ValidationError

from app import aivana
from app.config import settings
from app.interview_ai import response_json
from app.schemas import InterviewAnswerType, InterviewFeedbackDetail, InterviewMode

FORMAT_ATTEMPTS = 2
FEEDBACK_TEMPLATE = (
    '{"score": 0, "feedback": "...", "strengths": ["..."], '
    '"areas_to_improve": ["..."], "improved_answer": "..."}'
)


def generate_feedback(
    company: str,
    position: str,
    mode: InterviewMode,
    question: str,
    answer: str,
    answer_type: InterviewAnswerType,
    language: str | None,
) -> InterviewFeedbackDetail:
    if settings.aivana_mode != "live":
        raise aivana.AivanaError(
            "Interview feedback generation requires AIVANA_MODE=live",
            code="not_configured",
        )

    context = {
        "company": company,
        "position": position,
        "mode": mode,
        "question": question,
        "answer": answer,
        "answer_type": answer_type,
        "language": language,
    }
    prompt = (
        "Evaluate this interview answer. Score it from 0 to 10 and provide concise, actionable feedback. "
        "For behavioral answers, assess relevance, structure, communication, and evidence. "
        "For technical answers, assess correctness, reasoning, trade-offs, and code in the supplied language.\n\n"
        f"INPUT:\n{json.dumps(context, ensure_ascii=False)}\n\n"
        "Return ONLY a JSON object matching this exact template, with no extra keys:\n"
        f"{FEEDBACK_TEMPLATE}"
    )

    budget = aivana.Budget()
    request_id = None
    for _ in range(FORMAT_ATTEMPTS):
        if not budget.has_call():
            break
        response = aivana.generate(prompt, output_shape="extract", budget=budget)
        request_id = response.get("request_id")
        try:
            return InterviewFeedbackDetail.model_validate(response_json(response))
        except ValidationError:
            continue

    raise aivana.AivanaError(
        "Aivana did not return valid interview feedback",
        code="bad_output",
        request_id=request_id,
    )
