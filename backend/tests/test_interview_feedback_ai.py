import json

import pytest

from app import aivana
from app.config import settings
from app.interview_feedback_ai import generate_feedback


VALID_FEEDBACK = {
    "score": 8,
    "feedback": "The answer is clear and relevant.",
    "strengths": ["Specific example", "Clear ownership"],
    "areas_to_improve": ["Quantify the outcome"],
    "improved_answer": "I aligned the team and improved delivery time by 20%.",
}


@pytest.fixture(autouse=True)
def live_mode(monkeypatch):
    monkeypatch.setattr(settings, "aivana_mode", "live")


def test_generate_feedback_sends_full_behavioral_context(monkeypatch):
    seen = {}

    def fake_generate(prompt, **kwargs):
        seen.update(prompt=prompt, kwargs=kwargs)
        return {"request_id": "req_test", "structured": VALID_FEEDBACK}

    monkeypatch.setattr(aivana, "generate", fake_generate)

    result = generate_feedback(
        company="Aivana",
        position="Backend Engineer",
        mode="behavioral",
        question="Tell me about a conflict.",
        answer="I aligned the team around shared goals.",
        answer_type="text",
        language=None,
    )

    assert result.model_dump() == VALID_FEEDBACK
    for value in ("Aivana", "Backend Engineer", "behavioral", "Tell me about a conflict", "shared goals"):
        assert value in seen["prompt"]
    assert seen["kwargs"]["output_shape"] == "extract"


def test_generate_feedback_includes_code_and_language(monkeypatch):
    seen = {}

    def fake_generate(prompt, **kwargs):
        seen["prompt"] = prompt
        return {"structured": VALID_FEEDBACK}

    monkeypatch.setattr(aivana, "generate", fake_generate)

    generate_feedback(
        company="Aivana",
        position="Software Engineer",
        mode="technical",
        question="Implement a stack.",
        answer="const stack = [];",
        answer_type="code",
        language="JavaScript",
    )

    assert "JavaScript" in seen["prompt"]
    assert "const stack = [];" in seen["prompt"]


def test_generate_feedback_parses_answer_json(monkeypatch):
    monkeypatch.setattr(
        aivana,
        "generate",
        lambda *args, **kwargs: {"structured": None, "answer": json.dumps(VALID_FEEDBACK)},
    )

    result = generate_feedback("Aivana", "Engineer", "behavioral", "Question?", "Answer.", "text", None)

    assert result.score == 8


def test_generate_feedback_normalizes_aivana_compact_field_names(monkeypatch):
    compact = {
        "score": VALID_FEEDBACK["score"],
        "feedback": VALID_FEEDBACK["feedback"],
        "strengths": VALID_FEEDBACK["strengths"],
        "areastoimprove": VALID_FEEDBACK["areas_to_improve"],
        "improvedanswer": VALID_FEEDBACK["improved_answer"],
    }
    monkeypatch.setattr(aivana, "generate", lambda *args, **kwargs: {"structured": compact})

    result = generate_feedback("Aivana", "Engineer", "behavioral", "Question?", "Answer.", "text", None)

    assert result.model_dump() == VALID_FEEDBACK


@pytest.mark.parametrize(
    "payload",
    [
        {**VALID_FEEDBACK, "score": 11},
        {key: value for key, value in VALID_FEEDBACK.items() if key != "improved_answer"},
        {**VALID_FEEDBACK, "strengths": []},
        {**VALID_FEEDBACK, "unexpected": "field"},
    ],
)
def test_generate_feedback_rejects_invalid_output(monkeypatch, payload):
    monkeypatch.setattr(aivana, "generate", lambda *args, **kwargs: {"structured": payload})

    with pytest.raises(aivana.AivanaError) as exc_info:
        generate_feedback("Aivana", "Engineer", "behavioral", "Question?", "Answer.", "text", None)

    assert exc_info.value.code == "bad_output"

