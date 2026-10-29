"""Aivana-backed question generation for Mock Interview sessions."""

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app import aivana
from app.config import settings
from app.schemas import InterviewMode

FORMAT_ATTEMPTS = 2
QUESTION_TEMPLATE = '{"questions": [{"question": "..."}, {"question": "..."}, {"question": "..."}, {"question": "..."}, {"question": "..."}]}'


class _GeneratedQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    question: str = Field(min_length=1)


class _GeneratedQuestionSet(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questions: list[_GeneratedQuestion] = Field(min_length=5, max_length=5)

    @field_validator("questions")
    @classmethod
    def questions_must_be_distinct(cls, questions: list[_GeneratedQuestion]) -> list[_GeneratedQuestion]:
        normalized = {question.question.casefold() for question in questions}
        if len(normalized) != len(questions):
            raise ValueError("questions must be distinct")
        return questions


def build_question_prompt(company: str, position: str, mode: InterviewMode) -> str:
    focus = (
        "communication, teamwork, problem solving, and leadership"
        if mode == "behavioral"
        else f"technical skills directly relevant to the {position} position"
    )
    context = {"company": company, "position": position, "mode": mode}
    return (
        "Create exactly five distinct interview questions for the supplied interview setup. "
        "Questions must not repeat or paraphrase each other. "
        f"Focus on {focus}.\n\n"
        f"INPUT:\n{json.dumps(context, ensure_ascii=False)}\n\n"
        "Return ONLY a JSON object matching this exact template, with no extra keys:\n"
        f"{QUESTION_TEMPLATE}"
    )


def response_json(response: dict[str, Any]) -> Any:
    structured = response.get("structured")
    if isinstance(structured, dict):
        return structured

    answer = response.get("answer")
    if not isinstance(answer, str):
        return None
    text = answer.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].strip() == "```":
            text = "\n".join(lines[1:-1])
            if text.lstrip().startswith("json"):
                text = text.lstrip()[4:].lstrip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def generate_questions(company: str, position: str, mode: InterviewMode) -> list[str]:
    if settings.aivana_mode != "live":
        raise aivana.AivanaError(
            "Interview question generation requires AIVANA_MODE=live",
            code="not_configured",
        )

    prompt = build_question_prompt(company, position, mode)
    budget = aivana.Budget()
    request_id = None
    for _ in range(FORMAT_ATTEMPTS):
        if not budget.has_call():
            break
        response = aivana.generate(prompt, output_shape="extract", budget=budget)
        request_id = response.get("request_id")
        try:
            generated = _GeneratedQuestionSet.model_validate(response_json(response))
        except ValidationError:
            continue
        return [question.question for question in generated.questions]

    raise aivana.AivanaError(
        "Aivana did not return exactly five distinct interview questions",
        code="bad_output",
        request_id=request_id,
    )
