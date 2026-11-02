import json

import pytest

from app import aivana
from app.config import settings
from app.interview_ai import generate_questions


QUESTIONS = [f"Question {index}?" for index in range(1, 6)]


@pytest.fixture(autouse=True)
def live_mode(monkeypatch):
    monkeypatch.setattr(settings, "aivana_mode", "live")


def test_generate_questions_sends_context_and_accepts_structured_output(monkeypatch):
    seen = {}

    def fake_generate(prompt, **kwargs):
        seen["prompt"] = prompt
        seen["kwargs"] = kwargs
        return {
            "request_id": "req_test",
            "structured": {"questions": [{"question": question} for question in QUESTIONS]},
        }

    monkeypatch.setattr(aivana, "generate", fake_generate)

    result = generate_questions("Aivana", "Backend Engineer", "technical")

    assert result == QUESTIONS
    assert "Aivana" in seen["prompt"]
    assert "Backend Engineer" in seen["prompt"]
    assert "technical" in seen["prompt"].lower()
    assert seen["kwargs"]["output_shape"] == "extract"


def test_generate_questions_parses_json_from_answer(monkeypatch):
    monkeypatch.setattr(
        aivana,
        "generate",
        lambda *args, **kwargs: {
            "request_id": "req_test",
            "structured": None,
            "answer": json.dumps({"questions": [{"question": question} for question in QUESTIONS]}),
        },
    )

    assert generate_questions("Aivana", "Engineer", "behavioral") == QUESTIONS


@pytest.mark.parametrize(
    "questions",
    [
        QUESTIONS[:4],
        ["Repeated question?"] * 5,
        ["One?", "Two?", "Three?", "Four?", "   "],
    ],
)
def test_generate_questions_rejects_invalid_sets(monkeypatch, questions):
    monkeypatch.setattr(
        aivana,
        "generate",
        lambda *args, **kwargs: {
            "request_id": "req_test",
            "structured": {"questions": [{"question": question} for question in questions]},
        },
    )

    with pytest.raises(aivana.AivanaError) as exc_info:
        generate_questions("Aivana", "Engineer", "behavioral")

    assert exc_info.value.code == "bad_output"

