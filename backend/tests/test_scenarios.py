"""The Scenario Test: Aivana answers eight questions, one judge call grades them.

Real Aivana and judge requests are refused by conftest.py; tests that need live
behaviour install fake transports.
"""

import asyncio
import json

import httpx
import pytest

from app import aivana, baseline, scenarios
from app.config import settings
from app.routers.benchmark import _running

SCENARIO_FIELDS = {"id", "number", "type", "title", "question", "key_points"}
JUDGEMENT_FIELDS = {"model", "mock", "latency_ms", "summary", "overall_score", "passed", "results"}
VERDICT_FIELDS = {
    "scenario_id", "correctness", "helpfulness", "honesty", "speed", "score", "key_points_met", "verdict", "comment",
}  # fmt: skip


def answers(*ids, latency_ms=5000):
    return [{"scenario_id": i, "text": f"Answer to {i}", "latency_ms": latency_ms} for i in ids]


def judge_reply(results, summary="Mostly solid."):
    body = {"summary": summary, "results": results}
    return httpx.Response(200, json={"choices": [{"message": {"content": f"```json\n{json.dumps(body)}\n```"}}]})


def verdict(scenario_id, n_points, c=5, h=5, o=5, verdict="pass"):
    return {
        "scenario_id": scenario_id,
        "correctness": c,
        "helpfulness": h,
        "honesty": o,
        "key_points_met": [True] * n_points,
        "verdict": verdict,
        "comment": "Clear and correct.",
    }


@pytest.fixture
def live_judge(monkeypatch):
    """The judge is live; returns a function that sets its reply and records the request."""
    monkeypatch.setattr(settings, "baseline_mode", "live")
    sent: dict = {}

    def serve(reply: httpx.Response):
        def handler(request):
            sent.update(json.loads(request.content))
            return reply

        monkeypatch.setattr(baseline, "_transport", httpx.MockTransport(handler))
        return sent

    return serve


def test_lists_eight_scenarios_in_the_shared_format(client):
    res = client.get("/api/scenarios")
    assert res.status_code == 200
    items = res.json()
    assert [s["number"] for s in items] == list(range(1, 9))
    assert len({s["id"] for s in items}) == 8
    for s in items:
        assert set(s) == SCENARIO_FIELDS
        assert s["question"] and s["key_points"]


def test_mock_answer_is_a_placeholder_reply(client):
    res = client.post("/api/scenarios/calculation/answer")
    assert res.status_code == 200
    reply = res.json()
    assert reply["system"] == "aivana" and reply["mock"] is True
    assert "Offer A pays $32" in reply["text"]


def test_live_answer_sends_the_question_unchanged_at_effort_auto(client, monkeypatch):
    monkeypatch.setattr(settings, "aivana_mode", "live")
    sent: dict = {}

    def handler(request):
        sent.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={"answer": "B leaves $3,240 more.", "usage": {"input_tokens": 60, "output_tokens": 40, "credits": 0.0002}},
        )

    monkeypatch.setattr(aivana, "_transport", httpx.MockTransport(handler))
    reply = client.post("/api/scenarios/calculation/answer").json()

    assert sent == {"prompt": scenarios.BY_ID["calculation"].question, "effort": "auto"}
    assert (reply["text"], reply["cost"], reply["error"]) == ("B leaves $3,240 more.", 0.0002, None)


def test_unknown_scenario_is_404(client):
    assert client.post("/api/scenarios/nope/answer").status_code == 404


def test_an_answer_is_refused_while_aivana_is_busy(client):
    asyncio.run(_running.acquire())  # as if a Benchmark comparison were running
    try:
        res = client.post("/api/scenarios/basic/answer")
    finally:
        _running.release()
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "aivana_busy"


def test_mock_judgement_grades_every_answer_sent(client):
    res = client.post("/api/scenarios/judge", json={"answers": answers("basic", "calculation", "false-premise")})
    assert res.status_code == 200
    body = res.json()
    assert set(body) == JUDGEMENT_FIELDS
    assert body["mock"] is True
    assert [r["scenario_id"] for r in body["results"]] == ["basic", "calculation", "false-premise"]
    for r in body["results"]:
        assert set(r) == VERDICT_FIELDS
        assert len(r["key_points_met"]) == len(scenarios.BY_ID[r["scenario_id"]].key_points)
    assert body["passed"] == 2  # the canned set has one partial in three


def test_live_judgement_scores_from_the_judge_and_the_latency(client, live_judge, monkeypatch):
    monkeypatch.setattr(settings, "judge_model", "judge-pro")
    sent = live_judge(judge_reply([verdict("basic", 2), verdict("calculation", 3, c=3, h=4, verdict="partial")]))

    res = client.post(
        "/api/scenarios/judge",
        json={"answers": [*answers("basic", latency_ms=5000), *answers("calculation", latency_ms=25000)]},
    )
    body = res.json()

    assert sent["model"] == "judge-pro"
    prompt = sent["messages"][0]["content"]
    assert scenarios.BY_ID["calculation"].question in prompt
    assert "Concludes B leaves $3,240 more" in prompt and "Answer to calculation" in prompt
    basic, calc = body["results"]
    assert (basic["speed"], basic["score"]) == (5, 100)
    # 0.35 * 60 + 0.30 * 80 + 0.25 * 100 + 0.10 * 60 = 76
    assert (calc["speed"], calc["score"], calc["verdict"]) == (3, 76, "partial")
    assert (body["overall_score"], body["passed"], body["model"], body["mock"]) == (88, 1, "judge-pro", False)


def test_judge_defaults_to_the_baseline_model(client, live_judge):
    sent = live_judge(judge_reply([verdict("basic", 2)]))
    client.post("/api/scenarios/judge", json={"answers": answers("basic")})
    assert sent["model"] == "test-model"


@pytest.mark.parametrize(
    "reply",
    [
        httpx.Response(200, json={"choices": [{"message": {"content": "Looks good to me!"}}]}),
        judge_reply([verdict("calculation", 3)]),  # graded the wrong scenario
        judge_reply([verdict("basic", 5)]),  # wrong number of key points
        judge_reply([verdict("basic", 2, c=9)]),  # score out of range
    ],
)
def test_a_malformed_judgement_is_a_502(client, live_judge, reply):
    live_judge(reply)
    res = client.post("/api/scenarios/judge", json={"answers": answers("basic")})
    assert res.status_code == 502
    assert res.json()["detail"]["code"] == "bad_judgement"


def test_a_judge_provider_error_is_a_502_with_its_message(client, live_judge):
    live_judge(httpx.Response(503, json={"error": {"message": "high demand"}}))
    res = client.post("/api/scenarios/judge", json={"answers": answers("basic")})
    assert res.status_code == 502
    assert res.json()["detail"] == {"message": "Baseline model returned 503: high demand", "code": "judge_failed"}


@pytest.mark.parametrize(
    "body",
    [
        {"answers": []},
        {"answers": answers("nope")},
        {"answers": answers("basic", "basic")},
        {"answers": [{"scenario_id": "basic", "text": "", "latency_ms": 1}]},
    ],
)
def test_bad_judge_requests_are_rejected(client, body):
    assert client.post("/api/scenarios/judge", json=body).status_code == 422


@pytest.mark.parametrize(
    ("latency_ms", "expected"), [(0, 5), (10_000, 5), (10_001, 4), (30_000, 3), (45_000, 2), (45_001, 1)]
)
def test_speed_score_bands(latency_ms, expected):
    assert scenarios.speed_score(latency_ms) == expected
