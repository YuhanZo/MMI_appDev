"""The Benchmark endpoint, against faked Aivana and baseline replies -- no real API calls."""

import asyncio
import json

import httpx
import pytest
from pydantic import ValidationError

from app import aivana, baseline
from app.config import Settings, settings
from app.routers.benchmark import _running

PROMPT = "Correct grammar: I are happy."


@pytest.fixture
def live(monkeypatch):
    """Both sides live; returns a function that sets their replies and records what was sent."""
    monkeypatch.setattr(settings, "aivana_mode", "live")
    monkeypatch.setattr(settings, "baseline_mode", "live")
    sent: dict = {}

    def serve(aivana_reply: httpx.Response, baseline_reply: httpx.Response):
        def aivana_handler(request):
            sent["aivana"] = json.loads(request.content)
            return aivana_reply

        def baseline_handler(request):
            sent["baseline"] = json.loads(request.content)
            sent["auth"] = request.headers["authorization"]
            return baseline_reply

        monkeypatch.setattr(aivana, "_transport", httpx.MockTransport(aivana_handler))
        monkeypatch.setattr(baseline, "_transport", httpx.MockTransport(baseline_handler))
        return sent

    return serve


def aivana_ok(answer='The correct grammar is "I am happy."'):
    return httpx.Response(
        200,
        json={
            "answer": answer,
            "models_used": ["aivana-mmi"],
            "usage": {"input_tokens": 12, "output_tokens": 9, "credits": 0.0001},
            "request_id": "req_1",
        },
    )


def baseline_ok(text="I'm happy to help with your grammar."):
    return httpx.Response(
        200,
        json={"choices": [{"message": {"content": text}}], "usage": {"prompt_tokens": 10, "completion_tokens": 8}},
    )


def ask(client, prompt=PROMPT):
    return client.post("/api/benchmark/chat", json={"prompt": prompt})


def test_mock_mode_returns_placeholder_replies_for_both(client):
    res = ask(client)
    assert res.status_code == 200
    replies = res.json()["replies"]
    assert [r["system"] for r in replies] == ["aivana", "baseline"]
    assert all(r["mock"] and PROMPT in r["text"] for r in replies)
    assert replies[0]["text"] == replies[1]["text"]  # nothing in the text gives the model away


def test_both_get_the_prompt_unchanged_and_report_speed_and_cost(client, live, monkeypatch):
    monkeypatch.setattr(settings, "baseline_price_in_per_m", 0.5)
    monkeypatch.setattr(settings, "baseline_price_out_per_m", 2.0)
    sent = live(aivana_ok(), baseline_ok())

    a, b = ask(client).json()["replies"]

    assert sent["aivana"]["prompt"] == PROMPT
    assert "output_shape" not in sent["aivana"]  # free text, no JSON template
    assert sent["baseline"]["messages"] == [{"role": "user", "content": PROMPT}]
    assert (sent["baseline"]["model"], sent["auth"]) == ("test-model", "Bearer test-key")
    assert a | {"latency_ms": 0} == {
        "system": "aivana",
        "model": "aivana-mmi",
        "mock": False,
        "text": 'The correct grammar is "I am happy."',
        "latency_ms": 0,
        "cost": 0.0001,
        "cost_unit": "credits",
        "input_tokens": 12,
        "output_tokens": 9,
        "error": None,
        "request_id": "req_1",
    }
    assert b["text"] == "I'm happy to help with your grammar."
    assert b["cost"] == pytest.approx((10 * 0.5 + 8 * 2.0) / 1_000_000)
    assert (b["cost_unit"], b["input_tokens"], b["output_tokens"]) == ("usd", 10, 8)
    assert a["latency_ms"] >= 0 and b["latency_ms"] >= 0


def test_no_prices_means_no_baseline_cost(client, live):
    live(aivana_ok(), baseline_ok())
    _, b = ask(client).json()["replies"]
    assert b["cost"] is None


def test_one_side_failing_does_not_hide_the_other(client, live):
    live(aivana_ok(), httpx.Response(429, text="quota exceeded"))
    a, b = ask(client).json()["replies"]

    assert a["text"] == 'The correct grammar is "I am happy."'
    assert (b["text"], b["error"]) == (None, "Baseline model returned 429: quota exceeded")


def test_a_provider_error_shows_its_own_message(client, live):
    gemini_404 = [{"error": {"code": 404, "message": "This model is no longer available to new users."}}]
    live(aivana_ok(), httpx.Response(404, json=gemini_404))
    _, b = ask(client).json()["replies"]
    assert b["error"] == "Baseline model returned 404: This model is no longer available to new users."


def test_an_aivana_reply_without_text_is_an_error(client, live):
    live(aivana_ok(answer=None), baseline_ok())
    a, _ = ask(client).json()["replies"]
    assert (a["text"], a["error"]) == (None, "Aivana's reply had no answer text")


@pytest.mark.parametrize("prompt", ["", "   ", "x" * 4001])
def test_a_blank_or_too_long_prompt_is_rejected(client, prompt):
    assert ask(client, prompt).status_code == 422


def test_only_one_comparison_runs_at_a_time(client):
    asyncio.run(_running.acquire())  # as if another comparison were running
    try:
        res = ask(client)
    finally:
        _running.release()
    assert res.status_code == 429
    assert res.json()["detail"]["code"] == "benchmark_busy"


def test_baseline_live_mode_requires_a_key():
    with pytest.raises(ValidationError, match="BASELINE_MODE=live needs"):
        Settings(_env_file=None, baseline_mode="live", baseline_api_key="")
