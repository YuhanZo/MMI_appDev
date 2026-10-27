"""Covers the Job Search + Fit Analysis workflow."""

from app.models import SearchLog

JOB_FIELDS = {"id", "title", "company", "location", "description", "url", "company_logo"}
FIT_FIELDS = {"summary", "strengths", "gaps", "recommendations"}


def test_search_returns_jobs_in_the_shared_format(client):
    res = client.post(
        "/api/jobs/search",
        json={"role": "Software Engineer Intern", "location": "Columbus, OH", "work_arrangement": "remote"},
    )
    assert res.status_code == 200
    jobs = res.json()
    assert jobs, "expected at least one job"
    for job in jobs:
        assert set(job) == JOB_FIELDS


def test_search_filters_by_role(client):
    res = client.post(
        "/api/jobs/search",
        json={"role": "Frontend", "location": "Columbus, OH", "work_arrangement": "any"},
    )
    titles = [j["title"] for j in res.json()]
    assert titles == ["Frontend Developer Intern"]


def test_search_falls_back_to_all_jobs_when_nothing_matches(client):
    """Documents current mock behaviour -- revisit once the real job API is wired up."""
    res = client.post(
        "/api/jobs/search",
        json={"role": "Underwater Basket Weaver", "location": "Columbus, OH", "work_arrangement": "any"},
    )
    assert len(res.json()) == 3


def test_search_is_logged_to_the_database(client, session):
    client.post(
        "/api/jobs/search",
        json={"role": "Data Analyst", "location": "Remote", "work_arrangement": "remote"},
    )
    logs = session.query(SearchLog).all()
    assert len(logs) == 1
    assert logs[0].role == "Data Analyst"
    assert logs[0].remote is True
    assert logs[0].result_count == 1


def test_search_rejects_a_missing_field(client):
    res = client.post("/api/jobs/search", json={"role": "Intern"})
    assert res.status_code == 422


def test_fit_analysis_returns_the_shared_format(client, sample_job, sample_profile):
    res = client.post(
        "/api/jobs/fit-analysis",
        json={"job": sample_job, "user_profile": sample_profile},
    )
    assert res.status_code == 200
    body = res.json()
    assert set(body) == FIT_FIELDS
    assert all(isinstance(body[k], list) for k in ("strengths", "gaps", "recommendations"))


def test_fit_analysis_rejects_a_malformed_job(client, sample_profile):
    res = client.post(
        "/api/jobs/fit-analysis",
        json={"job": {"id": "job_001"}, "user_profile": sample_profile},
    )
    assert res.status_code == 422
