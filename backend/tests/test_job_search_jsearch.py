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
}


def listing(job_id, title, **fields):
    return {**LISTING, "job_id": job_id, "job_title": title, **fields}


@pytest.fixture
def jsearch(monkeypatch):
    """Switch to JSearch mode; returns a function that sets the faked listings."""
    monkeypatch.setattr(settings, "job_api_mode", "jsearch")
    calls: list[dict] = []

    def serve(*listings, error: str | None = None, by_query: dict[str, list] | None = None):
        async def fake_fetch(params, api_key):
            calls.append(params)
            if error:
                raise job_api.JobApiError(error)
            if by_query is not None:
                return by_query[params["query"]]
            return list(listings)

        monkeypatch.setattr(job_api, "_fetch_listings", fake_fetch)
        return calls

    return serve


def search(client, **filters):
    body = {"job_functions": ["Software Engineer Intern"], "location": "Columbus, OH", **filters}
    return client.post("/api/jobs/search", json=body)


def test_listings_are_mapped_to_the_shared_job_format(client, jsearch):
    calls = jsearch(LISTING)
    res = search(client, work_models=["remote"], job_types=["internship"])

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


def test_each_job_function_is_searched_and_duplicates_are_merged(client, jsearch):
    calls = jsearch(
        by_query={
            "Backend Engineer in Columbus, OH": [listing("a", "Backend Engineer"), listing("both", "Python Engineer")],
            "Python Engineer in Columbus, OH": [listing("both", "Python Engineer"), listing("b", "Python Developer")],
        }
    )
    res = search(client, job_functions=["Backend Engineer", "Python Engineer"])

    assert [c["query"] for c in calls] == ["Backend Engineer in Columbus, OH", "Python Engineer in Columbus, OH"]
    assert [j["id"] for j in res.json()] == ["a", "both", "b"]


def test_job_functions_must_be_one_to_five(client, jsearch):
    jsearch(LISTING)
    assert search(client, job_functions=[]).status_code == 422
    assert search(client, job_functions=["  "]).status_code == 422
    assert search(client, job_functions=[f"Role {i}" for i in range(6)]).status_code == 422


def test_job_types_and_experience_are_sent_together(client, jsearch):
    calls = jsearch(LISTING)
    search(client, job_types=["internship", "full_time"], experience_levels=["intern", "entry"])
    assert calls[0]["employment_types"] == "FULLTIME,INTERN"
    assert calls[0]["job_requirements"] == "no_experience,under_3_years_experience"
    assert "work_from_home" not in calls[0]


def test_senior_and_above_are_filtered_by_title(client, jsearch):
    jsearch(listing("s", "Sr. Backend Engineer"), listing("l", "Staff Engineer"), listing("j", "Backend Engineer"))
    assert [j["id"] for j in search(client, experience_levels=["senior"]).json()] == ["s"]
    assert [j["id"] for j in search(client, experience_levels=["senior", "lead"]).json()] == ["s", "l"]
    # A lower level in the mix keeps everything: JSearch's job_requirements covers it.
    assert len(search(client, experience_levels=["mid", "senior"]).json()) == 3


def test_work_models_match_any_chosen(client, jsearch):
    jsearch(
        listing("on", "Engineer"),
        listing("hy", "Engineer", job_description="Hybrid, 3 days in the office."),
        listing("re", "Engineer", job_is_remote=True),
    )
    assert [j["id"] for j in search(client, work_models=["onsite", "hybrid"]).json()] == ["on", "hy"]
    assert [j["id"] for j in search(client, work_models=["remote", "hybrid"]).json()] == ["hy", "re"]


def test_search_is_logged_with_the_remote_flag(client, session, jsearch):
    jsearch(LISTING)
    search(client, work_models=["remote"], job_functions=["Backend Engineer", "Data Engineer"])
    log = session.query(SearchLog).one()
    assert (log.role, log.remote, log.result_count) == ("Backend Engineer, Data Engineer", True, 1)


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
