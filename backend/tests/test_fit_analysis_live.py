"""Fit analysis in live mode, against a fake Aivana -- no real API calls."""

import json

import httpx
import pytest

from app import aivana
from app.config import settings

FIT_FIELDS = {"summary", "strengths", "gaps", "recommendations"}
GOOD = {
    "summary": "Good fit for the backend work.",
    "strengths": ["Python"],
    "gaps": ["No AWS"],
    "recommendations": ["Do an AWS project"],
}
# What Aivana returned when the template was only in `system`.
WRONG_SHAPE = {"fit_summary": "...", "match_level": "Good fit", "recommendation": "Apply"}


@pytest.fixture
def live(monkeypatch):
    """Switch to live mode; returns a function that queues Aivana `structured` replies."""
    monkeypatch.setattr(settings, "aivana_mode", "live")
    seen: list[httpx.Request] = []

    def reply_with(*structured_or_responses):
        queue = list(structured_or_responses)

        def handler(request):
            seen.append(request)
            nxt = queue.pop(0)
            if isinstance(nxt, httpx.Response):
                return nxt
            return httpx.Response(200, json={"request_id": "req_live", "answer": "", "structured": nxt})

        monkeypatch.setattr(aivana, "_transport", httpx.MockTransport(handler))
        return seen

    return reply_with


def post_fit(client, sample_job, sample_profile):
    return client.post("/api/jobs/fit-analysis", json={"job": sample_job, "user_profile": sample_profile})


def test_live_fit_analysis_returns_aivanas_answer(client, live, sample_job, sample_profile):
    seen = live(GOOD)
    res = post_fit(client, sample_job, sample_profile)

    assert res.status_code == 200
    assert res.json() == GOOD
    assert set(res.json()) == FIT_FIELDS

    sent = json.loads(seen[0].content)
    assert sent["output_shape"] == "extract"
    assert "Software Engineer Intern" in sent["prompt"]
    assert "Python" in sent["prompt"]
    assert '"recommendations": [' in sent["prompt"]


def test_wrong_shape_is_retried_once(client, live, sample_job, sample_profile):
    seen = live(WRONG_SHAPE, GOOD)
    res = post_fit(client, sample_job, sample_profile)
    assert res.status_code == 200
    assert res.json() == GOOD
    assert len(seen) == 2


def test_wrong_shape_twice_is_a_502(client, live, sample_job, sample_profile):
    live(WRONG_SHAPE, None)
    res = post_fit(client, sample_job, sample_profile)
    assert res.status_code == 502
    assert res.json()["detail"] == {
        "message": "Aivana's answer did not match the fit analysis format",
        "code": "bad_output",
        "request_id": "req_live",
    }


def test_retries_share_one_budget_of_three_calls(client, live, sample_job, sample_profile):
    """Two transport retries use up the budget, so the wrong shape gets no second round."""
    upstream = httpx.Response(502, json={"error": {"code": "upstream_error", "message": "x", "request_id": "r"}})
    seen = live(upstream, upstream, WRONG_SHAPE, GOOD)
    res = post_fit(client, sample_job, sample_profile)
    assert res.status_code == 502
    assert res.json()["detail"]["code"] == "bad_output"
    assert len(seen) == 3


def test_worst_case_is_three_calls_not_six(client, live, sample_job, sample_profile):
    upstream = httpx.Response(502, json={"error": {"code": "upstream_error", "message": "x", "request_id": "r"}})
    seen = live(*[upstream] * 6)
    res = post_fit(client, sample_job, sample_profile)
    assert res.status_code == 502
    assert len(seen) == 3


def test_aivana_errors_surface_as_502_with_request_id(client, live, sample_job, sample_profile):
    live(httpx.Response(401, json={"error": {"code": "invalid_api_key", "message": "Invalid key", "request_id": "req_x"}}))
    res = post_fit(client, sample_job, sample_profile)
    assert res.status_code == 502
    assert res.json()["detail"]["code"] == "invalid_api_key"
    assert res.json()["detail"]["request_id"] == "req_x"
