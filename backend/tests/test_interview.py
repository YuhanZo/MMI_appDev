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
