"""Covers the Mock Interview workflow."""

import json

import pytest
from sqlalchemy import text

from app import aivana
from app.routers import interview as interview_router
from app.schemas import GeneratedInterviewSummary, InterviewFeedbackDetail

QUESTION_FIELDS = {"id", "question", "type"}
FEEDBACK_FIELDS = {"summary", "strengths", "improvements"}
VALID_TYPES = {"behavioral", "technical", "general"}


GENERATED_QUESTIONS = [f"Generated question {index}?" for index in range(1, 6)]
GENERATED_FEEDBACK = InterviewFeedbackDetail(
    score=8,
    feedback="Clear and relevant answer.",
    strengths=["Specific example"],
    areas_to_improve=["Add a measurable result"],
    improved_answer="I aligned the team and improved delivery time by 20%.",
)


def create_generated_session(client, monkeypatch, mode="behavioral"):
    monkeypatch.setattr(interview_router, "generate_questions", lambda *args: GENERATED_QUESTIONS)
    response = client.post(
        "/api/interview/sessions",
        json={"company": "Aivana", "position": "Backend Engineer", "mode": mode},
    )
    assert response.status_code == 201
    return response.json()


def complete_generated_session(client, monkeypatch, scores=(6, 7, 8, 9, 10)):
    created = create_generated_session(client, monkeypatch)

    def fake_feedback(**kwargs):
        index = GENERATED_QUESTIONS.index(kwargs["question"])
        return InterviewFeedbackDetail(
            score=scores[index],
            feedback=f"Stored feedback {index + 1}",
            strengths=[f"Stored strength {index + 1}"],
            areas_to_improve=[f"Stored improvement {index + 1}"],
            improved_answer=f"Stored improved answer {index + 1}",
        )

    monkeypatch.setattr(interview_router, "generate_feedback", fake_feedback, raising=False)
    for index in range(5):
        response = client.post(
            f"/api/interview/sessions/{created['session_id']}/answers",
            json={
                "question_index": index,
                "answer": f"Answer {index + 1}",
                "answer_type": "text",
                "language": None,
            },
        )
        assert response.status_code == 200
    return created


def test_create_session_generates_and_persists_five_questions(client, session, monkeypatch):
    seen = {}

    def fake_generate(company, position, mode):
        seen.update(company=company, position=position, mode=mode)
        return GENERATED_QUESTIONS

    monkeypatch.setattr(interview_router, "generate_questions", fake_generate, raising=False)

    res = client.post(
        "/api/interview/sessions",
        json={"company": "Aivana", "position": "Backend Engineer", "mode": "technical"},
    )

    assert res.status_code == 201
    body = res.json()
    assert seen == {"company": "Aivana", "position": "Backend Engineer", "mode": "technical"}
    assert body["company"] == "Aivana"
    assert body["position"] == "Backend Engineer"
    assert body["mode"] == "technical"
    assert body["status"] == "active"
    assert body["current_question_index"] == 0
    assert len(body["questions"]) == 5
    assert [question["question"] for question in body["questions"]] == GENERATED_QUESTIONS
    assert {question["type"] for question in body["questions"]} == {"technical"}

    stored_session = session.execute(
        text("SELECT id, company, position, mode, status, current_question_index FROM interview_sessions")
    ).mappings().one()
    assert stored_session == {
        "id": body["session_id"],
        "company": "Aivana",
        "position": "Backend Engineer",
        "mode": "technical",
        "status": "active",
        "current_question_index": 0,
    }
    stored_turns = session.execute(
        text("SELECT question_index, question, question_type FROM interview_turns ORDER BY question_index")
    ).mappings().all()
    assert [turn["question"] for turn in stored_turns] == GENERATED_QUESTIONS
    assert [turn["question_index"] for turn in stored_turns] == list(range(5))
    assert {turn["question_type"] for turn in stored_turns} == {"technical"}


def test_create_session_does_not_persist_when_aivana_fails(client, session, monkeypatch):
    def fail(*args):
        raise aivana.AivanaError("Invalid generated questions", code="bad_output", request_id="req_secret")

    monkeypatch.setattr(interview_router, "generate_questions", fail, raising=False)

    res = client.post(
        "/api/interview/sessions",
        json={"company": "Aivana", "position": "Engineer", "mode": "behavioral"},
    )

    assert res.status_code == 502
    assert res.json()["detail"] == {
        "message": "Invalid generated questions",
        "code": "bad_output",
        "request_id": "req_secret",
    }
    assert session.execute(text("SELECT COUNT(*) FROM interview_sessions")).scalar_one() == 0
    assert session.execute(text("SELECT COUNT(*) FROM interview_turns")).scalar_one() == 0


def test_create_session_rejects_blank_setup_values(client):
    res = client.post(
        "/api/interview/sessions",
        json={"company": "   ", "position": "Engineer", "mode": "behavioral"},
    )

    assert res.status_code == 422


def test_submit_answer_generates_feedback_persists_and_advances(client, session, monkeypatch):
    created = create_generated_session(client, monkeypatch)
    seen = {}

    def fake_feedback(**kwargs):
        seen.update(kwargs)
        return GENERATED_FEEDBACK

    monkeypatch.setattr(interview_router, "generate_feedback", fake_feedback, raising=False)

    res = client.post(
        f"/api/interview/sessions/{created['session_id']}/answers",
        json={
            "question_index": 0,
            "answer": "I aligned the team around shared goals.",
            "answer_type": "text",
            "language": None,
        },
    )

    assert res.status_code == 200
    body = res.json()
    assert body["score"] == 8
    assert body["feedback"] == "Clear and relevant answer."
    assert body["question_index"] == 0
    assert body["current_question_index"] == 1
    assert body["next_question"]["question"] == GENERATED_QUESTIONS[1]
    assert seen == {
        "company": "Aivana",
        "position": "Backend Engineer",
        "mode": "behavioral",
        "question": GENERATED_QUESTIONS[0],
        "answer": "I aligned the team around shared goals.",
        "answer_type": "text",
        "language": None,
    }

    stored_turn = session.execute(
        text("SELECT answer, answer_type, language, feedback, score FROM interview_turns WHERE question_index = 0")
    ).mappings().one()
    assert stored_turn["answer"] == "I aligned the team around shared goals."
    assert stored_turn["answer_type"] == "text"
    assert stored_turn["language"] is None
    assert json.loads(stored_turn["feedback"])["feedback"] == "Clear and relevant answer."
    assert stored_turn["score"] == 8
    assert session.execute(text("SELECT current_question_index FROM interview_sessions")).scalar_one() == 1


def test_submit_technical_code_sends_language_and_code(client, monkeypatch):
    created = create_generated_session(client, monkeypatch, mode="technical")
    seen = {}

    def fake_feedback(**kwargs):
        seen.update(kwargs)
        return GENERATED_FEEDBACK

    monkeypatch.setattr(interview_router, "generate_feedback", fake_feedback, raising=False)

    res = client.post(
        f"/api/interview/sessions/{created['session_id']}/answers",
        json={
            "question_index": 0,
            "answer": "const stack = [];",
            "answer_type": "code",
            "language": "JavaScript",
        },
    )

    assert res.status_code == 200
    assert seen["mode"] == "technical"
    assert seen["answer"] == "const stack = [];"
    assert seen["answer_type"] == "code"
    assert seen["language"] == "JavaScript"


def test_submit_answer_failure_does_not_mutate_session(client, session, monkeypatch):
    created = create_generated_session(client, monkeypatch)

    def fail(**kwargs):
        raise aivana.AivanaError("Feedback unavailable", code="timeout", request_id="req_test")

    monkeypatch.setattr(interview_router, "generate_feedback", fail, raising=False)
    res = client.post(
        f"/api/interview/sessions/{created['session_id']}/answers",
        json={"question_index": 0, "answer": "Keep this answer", "answer_type": "text", "language": None},
    )

    assert res.status_code == 502
    stored = session.execute(
        text("SELECT answer, feedback, score FROM interview_turns WHERE question_index = 0")
    ).mappings().one()
    assert stored == {"answer": None, "feedback": None, "score": None}
    assert session.execute(text("SELECT current_question_index FROM interview_sessions")).scalar_one() == 0


def test_submit_answer_rejects_wrong_index_duplicate_and_blank(client, monkeypatch):
    created = create_generated_session(client, monkeypatch)
    monkeypatch.setattr(interview_router, "generate_feedback", lambda **kwargs: GENERATED_FEEDBACK, raising=False)
    url = f"/api/interview/sessions/{created['session_id']}/answers"

    wrong = client.post(
        url,
        json={"question_index": 1, "answer": "Answer", "answer_type": "text", "language": None},
    )
    assert wrong.status_code == 409

    blank = client.post(
        url,
        json={"question_index": 0, "answer": "   ", "answer_type": "text", "language": None},
    )
    assert blank.status_code == 422

    first = client.post(
        url,
        json={"question_index": 0, "answer": "Answer", "answer_type": "text", "language": None},
    )
    assert first.status_code == 200
    duplicate = client.post(
        url,
        json={"question_index": 0, "answer": "Answer again", "answer_type": "text", "language": None},
    )
    assert duplicate.status_code == 409


def test_session_summary_requires_all_five_answers(client, monkeypatch):
    created = create_generated_session(client, monkeypatch)
    monkeypatch.setattr(
        interview_router,
        "generate_summary",
        lambda *args, **kwargs: pytest.fail("summary generation must not run for an incomplete session"),
        raising=False,
    )

    response = client.post(f"/api/interview/sessions/{created['session_id']}/summary")

    assert response.status_code == 409


def test_session_summary_uses_minimal_context_and_sqlite_results(client, session, monkeypatch):
    created = complete_generated_session(client, monkeypatch)
    seen = {}

    def fake_summary(company, position, mode, turns):
        seen.update(company=company, position=position, mode=mode, turns=turns)
        return GeneratedInterviewSummary(
            overall_evaluation="Concise overall evaluation.",
            strong_areas=["Communication"],
            areas_to_improve=["Metrics"],
            suggested_next_steps=["Practice timed answers"],
        )

    monkeypatch.setattr(interview_router, "generate_summary", fake_summary, raising=False)

    response = client.post(f"/api/interview/sessions/{created['session_id']}/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == created["session_id"]
    assert body["total_score"] == 40
    assert body["average_score"] == 8.0
    assert len(body["question_results"]) == 5
    assert body["question_results"][0] == {
        "question": GENERATED_QUESTIONS[0],
        "answer": "Answer 1",
        "score": 6,
        "feedback": "Stored feedback 1",
    }
    assert seen["company"] == "Aivana"
    assert seen["position"] == "Backend Engineer"
    assert seen["mode"] == "behavioral"
    assert seen["turns"][0] == {
        "question": GENERATED_QUESTIONS[0],
        "answer": "Answer 1",
        "score": 6,
        "strengths": ["Stored strength 1"],
        "areas_to_improve": ["Stored improvement 1"],
    }
    assert "feedback" not in seen["turns"][0]
    assert "improved_answer" not in seen["turns"][0]
    stored = session.execute(
        text("SELECT summary FROM interview_sessions WHERE id = :id"),
        {"id": created["session_id"]},
    ).scalar_one()
    assert json.loads(stored) == body


def test_session_summary_returns_cached_value_without_another_mmi_call(client, monkeypatch):
    created = complete_generated_session(client, monkeypatch)
    calls = 0

    def fake_summary(*args, **kwargs):
        nonlocal calls
        calls += 1
        return GeneratedInterviewSummary(
            overall_evaluation="Cached evaluation.",
            strong_areas=["Communication"],
            areas_to_improve=["Metrics"],
            suggested_next_steps=["Practice"],
        )

    monkeypatch.setattr(interview_router, "generate_summary", fake_summary, raising=False)
    url = f"/api/interview/sessions/{created['session_id']}/summary"

    first = client.post(url)
    second = client.post(url)

    assert first.status_code == 200
    assert second.json() == first.json()
    assert calls == 1


def test_session_summary_failure_does_not_persist_partial_summary(client, session, monkeypatch):
    created = complete_generated_session(client, monkeypatch)

    def fail(*args, **kwargs):
        raise aivana.AivanaError("Summary unavailable", code="timeout", request_id="req_summary")

    monkeypatch.setattr(interview_router, "generate_summary", fail, raising=False)

    response = client.post(f"/api/interview/sessions/{created['session_id']}/summary")

    assert response.status_code == 502
    assert session.execute(
        text("SELECT summary FROM interview_sessions WHERE id = :id"),
        {"id": created["session_id"]},
    ).scalar_one() is None


def test_questions_use_the_shared_format(client):
    res = client.get("/api/interview/questions")
    assert res.status_code == 200
    questions = res.json()
    assert questions
    for q in questions:
        assert set(q) == QUESTION_FIELDS
        assert q["type"] in VALID_TYPES


def test_feedback_uses_the_shared_format(client):
    res = client.post(
        "/api/interview/feedback",
        json={"question_id": "q1", "answer": "In one of my projects..."},
    )
    assert res.status_code == 200
    assert set(res.json()) == FEEDBACK_FIELDS


def test_feedback_rejects_a_missing_answer(client):
    res = client.post("/api/interview/feedback", json={"question_id": "q1"})
    assert res.status_code == 422


def test_full_interview_round_trip(client):
    """question -> answer -> feedback, the flow the proposal's success criteria name."""
    question = client.get("/api/interview/questions").json()[0]
    res = client.post(
        "/api/interview/feedback",
        json={"question_id": question["id"], "answer": "I led a project that..."},
    )
    assert res.status_code == 200
    assert res.json()["summary"]


def test_questions_can_be_filtered_by_mode(client):
    behavioral = client.get("/api/interview/questions?mode=behavioral")
    assert behavioral.status_code == 200
    assert len(behavioral.json()) == 5
    assert {question["type"] for question in behavioral.json()} == {"behavioral"}

    technical = client.get("/api/interview/questions?mode=technical")
    assert technical.status_code == 200
    assert len(technical.json()) == 5
    assert {question["type"] for question in technical.json()} == {"technical"}


def test_questions_reject_an_invalid_mode(client):
    res = client.get("/api/interview/questions?mode=general")
    assert res.status_code == 422


def test_behavioral_detailed_feedback(client):
    res = client.post(
        "/api/interview/detailed-feedback",
        json={
            "question_id": "behavioral-1",
            "answer": "I aligned the team around a small prototype.",
            "answer_type": "text",
            "language": None,
            "company": "Aivana",
            "position": "Software Engineer Intern",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "behavioral"
    assert body["ai_feedback"]
    assert body["strengths"]
    assert body["areas_to_improve"]
    assert body["star_structure"]
    assert body["improved_answer"]


def test_technical_detailed_feedback(client):
    res = client.post(
        "/api/interview/detailed-feedback",
        json={
            "question_id": "technical-1",
            "answer": "Use a stack.",
            "answer_type": "code",
            "language": "Python",
            "company": "Aivana",
            "position": "Software Engineer Intern",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["mode"] == "technical"
    assert body["assessment"]
    assert body["explanation"]
    assert body["missing_points"]
    assert body["time_complexity"]
    assert body["space_complexity"]
    assert body["suggested_solution"]


def test_detailed_feedback_rejects_an_unknown_question(client):
    res = client.post(
        "/api/interview/detailed-feedback",
        json={
            "question_id": "missing",
            "answer": "An answer",
            "answer_type": "text",
            "language": None,
            "company": "Aivana",
            "position": "Engineer",
        },
    )
    assert res.status_code == 404


def test_detailed_feedback_rejects_an_empty_answer(client):
    res = client.post(
        "/api/interview/detailed-feedback",
        json={
            "question_id": "behavioral-1",
            "answer": "",
            "answer_type": "text",
            "language": None,
            "company": "Aivana",
            "position": "Engineer",
        },
    )
    assert res.status_code == 422


def test_interview_summaries_are_available_for_each_mode(client):
    for mode in ("behavioral", "technical"):
        res = client.get(f"/api/interview/summary?mode={mode}")
        assert res.status_code == 200
        body = res.json()
        assert body["overall_performance"]
        assert body["strong_areas"]
        assert body["areas_to_improve"]
        assert len(body["question_results"]) == 5
        assert body["suggested_next_steps"]


def test_summary_rejects_an_invalid_mode(client):
    res = client.get("/api/interview/summary?mode=invalid")
    assert res.status_code == 422
