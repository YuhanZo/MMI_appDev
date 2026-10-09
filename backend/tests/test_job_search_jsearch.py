"""Job search with JOB_API_MODE=jsearch, against faked JSearch listings -- no real API calls."""

import pytest

from app import job_api
from app.config import settings
from app.models import SearchLog

LISTING = {
    "job_id": "js_1",
    "job_title": "Software Engineer Intern",
    "employer_name": "Acme",
    "employer_logo": "https://logo.example/acme.png",
    "job_city": "Columbus",
    "job_state": "OH",
    "job_is_remote": False,
    "job_description": "Build services in Python.",
    "job_apply_link": "https://acme.example/apply",
    "job_min_salary": 30,
    "job_max_salary": 40,
    "job_salary_period": "HOUR",
}


@pytest.fixture
def jsearch(monkeypatch):
    """Switch to JSearch mode; returns a function that sets the faked listings."""
    monkeypatch.setattr(settings, "job_api_mode", "jsearch")
    calls: list[dict] = []

    def serve(*listings, error: str | None = None):
        async def fake_fetch(params, api_key):
            calls.append(params)
            if error:
                raise job_api.JobApiError(error)
            return list(listings)

        monkeypatch.setattr(job_api, "_fetch_listings", fake_fetch)
        return calls

    return serve


def search(client, **filters):
    body = {"role": "Software Engineer Intern", "location": "Columbus, OH", **filters}
    return client.post("/api/jobs/search", json=body)


def test_listings_are_mapped_to_the_shared_job_format(client, jsearch):
    calls = jsearch(LISTING)
    res = search(client, work_arrangement="remote", employment_type="internship")

    assert res.status_code == 200
    assert res.json() == [
        {
            "id": "js_1",
            "title": "Software Engineer Intern",
            "company": "Acme",
            "location": "Columbus, OH",
            "description": "Build services in Python.",
            "url": "https://acme.example/apply",
            "company_logo": "https://logo.example/acme.png",
        }
    ]
    assert calls[0]["query"] == "Software Engineer Intern in Columbus, OH"
    assert calls[0]["work_from_home"] == "true"
    assert calls[0]["employment_types"] == "INTERN"


def test_salary_filter_uses_the_yearly_amount(client, jsearch):
    jsearch(LISTING)  # $30-40/hour is about $62k-83k a year
    assert len(search(client, salary_min=60000).json()) == 1
    assert search(client, salary_min=90000).json() == []


def test_search_is_logged_with_the_remote_flag(client, session, jsearch):
    jsearch(LISTING)
    search(client, work_arrangement="remote")
    log = session.query(SearchLog).one()
    assert (log.remote, log.result_count) == (True, 1)


def test_jsearch_errors_are_a_502_with_a_message(client, jsearch):
    jsearch(error="JSearch returned 429: too many requests")
    res = search(client)
    assert res.status_code == 502
    assert res.json()["detail"] == {"message": "JSearch returned 429: too many requests", "code": "job_api_error"}


def test_jsearch_mode_requires_a_key():
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError, match="JOB_API_MODE=jsearch needs"):
        Settings(_env_file=None, job_api_mode="jsearch", jsearch_api_key="")
