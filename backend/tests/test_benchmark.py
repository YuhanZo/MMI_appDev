"""The Benchmark endpoint, against faked Aivana and baseline replies -- no real API calls."""

import asyncio
import json

import httpx
import pytest
from pydantic import ValidationError

from app import aivana, baseline
from app.config import Settings, settings
from app.routers.benchmark import _running

FIT = {
    "summary": "Good fit.",
    "strengths": ["Python"],
    "gaps": ["AWS"],
    "recommendations": ["Learn AWS basics"],
}


@pytest.fixture
def live(monkeypatch):
    """Both sides live; returns a function that sets their replies and records prompts."""
    monkeypatch.setattr(settings, "aivana_mode", "live")
    monkeypatch.setattr(settings, "baseline_mode", "live")
    prompts: dict = {"aivana_calls": 0}

    def serve(aivana_reply: httpx.Response, baseline_reply: httpx.Response):
        def aivana_handler(request):
            prompts["aivana"] = json.loads(request.content)["prompt"]
            prompts["aivana_calls"] += 1
            return aivana_reply

        def baseline_handler(request):
            body = json.loads(request.content)
            prompts["baseline"] = body["messages"][0]["content"]
            prompts["baseline_model"] = body["model"]
            prompts["auth"] = request.headers["authorization"]
            return baseline_reply

        monkeypatch.setattr(aivana, "_transport", httpx.MockTransport(aivana_handler))
        monkeypatch.setattr(baseline, "_transport", httpx.MockTransport(baseline_handler))
        return prompts

    return serve


def aivana_ok(structured=FIT):
    return httpx.Response(
        200,
        json={
            "structured": structured,
            "models_used": ["aivana-mmi"],
            "usage": {"input_tokens": 120, "output_tokens": 80, "credits": 0.0004},
            "request_id": "req_1",
        },
    )


def baseline_ok(text=f"```json\n{json.dumps(FIT)}\n```"):
    return httpx.Response(
        200,
        json={"choices": [{"message": {"content": text}}], "usage": {"prompt_tokens": 100, "completion_tokens": 60}},
    )


def run(client, sample_job, sample_profile):
    return client.post("/api/benchmark/run", json={"job": sample_job, "user_profile": sample_profile})


def test_mock_mode_returns_placeholder_runs_for_both(client, sample_job, sample_profile):
    res = run(client, sample_job, sample_profile)
    assert res.status_code == 200
    runs = res.json()["runs"]
    assert [r["system"] for r in runs] == ["aivana", "baseline"]
    assert all(r["mock"] and r["format_ok"] for r in runs)


def test_both_get_the_same_prompt_and_report_speed_cost_and_format(
    client, sample_job, sample_profile, live, monkeypatch
):
    monkeypatch.setattr(settings, "baseline_price_in_per_m", 0.5)
    monkeypatch.setattr(settings, "baseline_price_out_per_m", 2.0)
    prompts = live(aivana_ok(), baseline_ok())

    a, b = run(client, sample_job, sample_profile).json()["runs"]

    assert prompts["aivana"] == prompts["baseline"]
    assert (prompts["baseline_model"], prompts["auth"]) == ("test-model", "Bearer test-key")
    assert a | {"latency_ms": 0} == {
        "system": "aivana",
        "model": "aivana-mmi",
        "mock": False,
        "answer": FIT,
        "format_ok": True,
        "latency_ms": 0,
        "cost": 0.0004,
        "cost_unit": "credits",
        "input_tokens": 120,
        "output_tokens": 80,
        "error": None,
        "request_id": "req_1",
    }
    assert b["answer"] == FIT and b["format_ok"] is True  # JSON found inside the ``` fence
    assert b["cost"] == pytest.approx((100 * 0.5 + 60 * 2.0) / 1_000_000)
    assert b["cost_unit"] == "usd" and (b["input_tokens"], b["output_tokens"]) == (100, 60)
    assert a["latency_ms"] >= 0 and b["latency_ms"] >= 0


def test_a_wrong_format_is_reported_without_a_retry(client, sample_job, sample_profile, live):
    prompts = live(aivana_ok(structured={"fit": "good"}), baseline_ok(text="Sure! The candidate fits well."))
    a, b = run(client, sample_job, sample_profile).json()["runs"]

    assert prompts["aivana_calls"] == 1  # the app's fit analysis would have retried

    assert (a["format_ok"], a["answer"]) == (False, None)
    assert (b["format_ok"], b["answer"]) == (False, None)
    assert b["cost"] is None  # no prices configured


def test_one_side_failing_does_not_hide_the_other(client, sample_job, sample_profile, live):
    live(aivana_ok(), httpx.Response(429, text="quota exceeded"))
    a, b = run(client, sample_job, sample_profile).json()["runs"]

    assert a["format_ok"] is True
    assert b["error"] == "Baseline model returned 429: quota exceeded"
    assert b["format_ok"] is False


def test_a_provider_error_shows_its_own_message(client, sample_job, sample_profile, live):
    gemini_404 = [{"error": {"code": 404, "message": "This model is no longer available to new users."}}]
    live(aivana_ok(), httpx.Response(404, json=gemini_404))
    _, b = run(client, sample_job, sample_profile).json()["runs"]
    assert b["error"] == "Baseline model returned 404: This model is no longer available to new users."


def test_only_one_benchmark_runs_at_a_time(client, sample_job, sample_profile):
    asyncio.run(_running.acquire())  # as if another benchmark were running
    try:
        res = run(client, sample_job, sample_profile)
    finally:
        _running.release()
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "benchmark_busy"


def test_baseline_live_mode_requires_a_key():
    with pytest.raises(ValidationError, match="BASELINE_MODE=live needs"):
        Settings(_env_file=None, baseline_mode="live", baseline_api_key="")
