"""Covers the Mock Interview workflow."""

QUESTION_FIELDS = {"id", "question", "type"}
FEEDBACK_FIELDS = {"summary", "strengths", "improvements"}
VALID_TYPES = {"behavioral", "technical", "general"}


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
