import json

import pytest

from app import aivana
from app.config import settings
from app.interview_summary_ai import generate_summary


TURNS = [
    {
        "question": f"Question {index}?",
        "answer": f"Answer {index}",
        "score": 5 + index,
        "strengths": [f"Strength {index}"],
        "areas_to_improve": [f"Improvement {index}"],
    }
    for index in range(1, 6)
]

VALID_SUMMARY = {
    "overall_evaluation": "A concise overall evaluation.",
    "strong_areas": ["Clear communication", "Relevant examples"],
    "areas_to_improve": ["Add measurable outcomes"],
    "suggested_next_steps": ["Practice concise STAR answers"],
}


@pytest.fixture(autouse=True)
def live_mode(monkeypatch):
    monkeypatch.setattr(settings, "aivana_mode", "live")


def test_generate_summary_sends_only_compact_required_context(monkeypatch):
    seen = {}

    def fake_generate(prompt, **kwargs):
        seen.update(prompt=prompt, kwargs=kwargs)
        return {"structured": VALID_SUMMARY}

    monkeypatch.setattr(aivana, "generate", fake_generate)

    result = generate_summary("Aivana", "Backend Engineer", "behavioral", TURNS)

    payload_text = seen["prompt"].split("INPUT:\n", 1)[1].split("\n\nReturn ONLY", 1)[0]
    payload = json.loads(payload_text)
    assert payload == {
        "company": "Aivana",
        "position": "Backend Engineer",
        "mode": "behavioral",
        "turns": TURNS,
    }
    assert "improved_answer" not in payload_text
    assert '"feedback"' not in payload_text
    assert "up to 3" in seen["prompt"]
    assert seen["kwargs"]["output_shape"] == "extract"
    assert result.model_dump() == VALID_SUMMARY


def test_generate_summary_normalizes_compact_aivana_field_names(monkeypatch):
    compact = {
        "overallevaluation": VALID_SUMMARY["overall_evaluation"],
        "strongareas": VALID_SUMMARY["strong_areas"],
        "areastoimprove": VALID_SUMMARY["areas_to_improve"],
        "suggestednextsteps": VALID_SUMMARY["suggested_next_steps"],
    }
    monkeypatch.setattr(aivana, "generate", lambda *args, **kwargs: {"structured": compact})

    result = generate_summary("Aivana", "Engineer", "technical", TURNS)

    assert result.model_dump() == VALID_SUMMARY


@pytest.mark.parametrize(
    "payload",
    [
        {**VALID_SUMMARY, "overall_evaluation": "x" * 601},
        {**VALID_SUMMARY, "strong_areas": ["one", "two", "three", "four"]},
        {key: value for key, value in VALID_SUMMARY.items() if key != "suggested_next_steps"},
        {**VALID_SUMMARY, "unexpected": "field"},
    ],
)
def test_generate_summary_rejects_invalid_or_oversized_output(monkeypatch, payload):
    monkeypatch.setattr(aivana, "generate", lambda *args, **kwargs: {"structured": payload})

    with pytest.raises(aivana.AivanaError) as exc_info:
        generate_summary("Aivana", "Engineer", "behavioral", TURNS)

    assert exc_info.value.code == "bad_output"

