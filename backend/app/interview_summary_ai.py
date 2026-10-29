"""Token-efficient Aivana summary generation for one completed interview."""

import json
from typing import Any

from pydantic import ValidationError

from app import aivana
from app.config import settings
from app.interview_ai import response_json
from app.schemas import GeneratedInterviewSummary, InterviewMode

FORMAT_ATTEMPTS = 2
SUMMARY_TEMPLATE = (
    '{"overall_evaluation":"...","strong_areas":["..."],'
    '"areas_to_improve":["..."],"suggested_next_steps":["..."]}'
)


def generate_summary(
    company: str,
    position: str,
    mode: InterviewMode,
    turns: list[dict[str, Any]],
) -> GeneratedInterviewSummary:
    if settings.aivana_mode != "live":
        raise aivana.AivanaError(
            "Interview summary generation requires AIVANA_MODE=live",
            code="not_configured",
        )

    context = {
        "company": company,
        "position": position,
        "mode": mode,
        "turns": turns,
    }
    prompt = (
        "Summarize this completed five-question interview. Be concise and avoid repeating "
        "question-level details. Return one short overall evaluation (maximum 600 characters), "
        "plus up to 3 short items for each list; each item must be at most 160 characters.\n\n"
        f"INPUT:\n{json.dumps(context, ensure_ascii=False, separators=(',', ':'))}\n\n"
        "Return ONLY a JSON object matching this exact template, with no extra keys:\n"
        f"{SUMMARY_TEMPLATE}"
    )

    budget = aivana.Budget()
    request_id = None
    for _ in range(FORMAT_ATTEMPTS):
        if not budget.has_call():
            break
        response = aivana.generate(prompt, output_shape="extract", budget=budget)
        request_id = response.get("request_id")
        try:
            return GeneratedInterviewSummary.model_validate(response_json(response))
        except ValidationError:
            continue

    raise aivana.AivanaError(
        "Aivana did not return a valid interview summary",
        code="bad_output",
        request_id=request_id,
    )
