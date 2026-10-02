"""The Aivana client, against a fake transport -- no real API calls."""

import json

import httpx
import pytest
from pydantic import ValidationError

from app import aivana
from app.config import Settings

OK_BODY = {"id": "gen_1", "request_id": "req_1", "answer": "5432", "structured": None}


def fake_aivana(monkeypatch, *responses):
    """Serve the given responses in order; return the list of requests received."""
    seen: list[httpx.Request] = []
    queue = list(responses)

    def handler(request):
        seen.append(request)
        nxt = queue.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt

    monkeypatch.setattr(aivana, "_transport", httpx.MockTransport(handler))
    return seen


def error(status, code, **extra):
    return httpx.Response(status, json={"error": {"code": code, "message": code, "request_id": "req_err", **extra}})


def test_generate_sends_key_and_body(monkeypatch):
    seen = fake_aivana(monkeypatch, httpx.Response(200, json=OK_BODY))

    assert aivana.generate("What port?", output_shape="extract") == OK_BODY

    req = seen[0]
    assert str(req.url) == "https://aivana.test/v1/generate"
    assert req.headers["X-API-Key"] == "test-key"
    assert json.loads(req.content) == {"prompt": "What port?", "effort": "low", "output_shape": "extract"}


def test_generate_retries_a_502_then_succeeds(monkeypatch):
    seen = fake_aivana(monkeypatch, error(502, "upstream_error"), httpx.Response(200, json=OK_BODY))
    assert aivana.generate("hi")["answer"] == "5432"
    assert len(seen) == 2


def test_generate_does_not_retry_an_auth_error(monkeypatch):
    seen = fake_aivana(monkeypatch, error(401, "invalid_api_key"))
    with pytest.raises(aivana.AivanaError) as exc:
        aivana.generate("hi")
    assert (exc.value.status, exc.value.code, exc.value.request_id) == (401, "invalid_api_key", "req_err")
    assert len(seen) == 1


def test_generate_honours_retry_after_then_gives_up(monkeypatch):
    waits: list[float] = []
    monkeypatch.setattr(aivana, "_sleep", waits.append)
    limited = error(429, "rate_limit_exceeded", retry_after_ms=3000)
    seen = fake_aivana(monkeypatch, limited, limited, limited)

    with pytest.raises(aivana.AivanaError) as exc:
        aivana.generate("hi")
    assert exc.value.code == "rate_limit_exceeded"
    assert len(seen) == aivana.MAX_RETRIES + 1
    assert waits == [3.0, 3.0]


def test_generate_reports_a_network_failure(monkeypatch):
    down = httpx.ConnectError("connection refused")
    fake_aivana(monkeypatch, down, down, down)
    with pytest.raises(aivana.AivanaError) as exc:
        aivana.generate("hi")
    assert exc.value.code == "network_error"


def test_a_200_that_is_not_json_is_an_invalid_response(monkeypatch):
    fake_aivana(monkeypatch, httpx.Response(200, text="<html>oops</html>", headers={"x-request-id": "req_h"}))
    with pytest.raises(aivana.AivanaError) as exc:
        aivana.generate("hi")
    assert (exc.value.code, exc.value.request_id) == ("invalid_response", "req_h")


def test_a_200_that_is_a_json_list_is_an_invalid_response(monkeypatch):
    fake_aivana(monkeypatch, httpx.Response(200, json=[1, 2]))
    with pytest.raises(aivana.AivanaError) as exc:
        aivana.generate("hi")
    assert exc.value.code == "invalid_response"


def test_an_error_body_that_is_not_an_object_is_still_an_aivana_error(monkeypatch):
    fake_aivana(monkeypatch, httpx.Response(401, json=["bad"]))
    with pytest.raises(aivana.AivanaError) as exc:
        aivana.generate("hi")
    assert (exc.value.status, exc.value.code) == (401, "invalid_response")


def test_a_non_numeric_retry_after_falls_back_to_backoff(monkeypatch):
    waits: list[float] = []
    monkeypatch.setattr(aivana, "_sleep", waits.append)
    bad = error(429, "rate_limit_exceeded", retry_after_ms="12000")
    fake_aivana(monkeypatch, bad, bad, bad)
    with pytest.raises(aivana.AivanaError) as exc:
        aivana.generate("hi")
    assert exc.value.code == "rate_limit_exceeded"
    assert len(waits) == 2 and all(1 <= w < 5 for w in waits)


def test_live_mode_requires_credentials():
    with pytest.raises(ValidationError, match="AIVANA_MODE=live needs"):
        Settings(_env_file=None, aivana_mode="live", aivana_api_key="", aivana_base_url="")
