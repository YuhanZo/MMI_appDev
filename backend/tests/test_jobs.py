"""Covers the Job Search + Fit Analysis workflow."""

from app.models import SearchLog

JOB_FIELDS = {
    "id", "title", "company", "location", "description", "url", "company_logo",
    "posted_at", "employment_type", "work_model", "salary", "benefits", "employer_website", "publisher",
}
FIT_FIELDS = {"summary", "strengths", "gaps", "recommendations"}


def test_search_returns_jobs_in_the_shared_format(client):
    res = client.post(
        "/api/jobs/search",
        json={"job_functions": ["Software Engineer Intern"], "location": "Columbus, OH", "work_models": ["remote"]},
    )
    assert res.status_code == 200
    jobs = res.json()
    assert jobs, "expected at least one job"
    for job in jobs:
        assert set(job) == JOB_FIELDS


def test_search_filters_by_any_job_function(client):
    res = client.post(
        "/api/jobs/search",
        json={"job_functions": ["Frontend", "Data"], "location": "Columbus, OH"},
    )
    titles = [j["title"] for j in res.json()]
    assert titles == ["Frontend Developer Intern", "Data Analyst Intern"]


def test_search_falls_back_to_all_jobs_when_nothing_matches(client):
    """Documents current mock behaviour -- revisit once the real job API is wired up."""
    res = client.post(
        "/api/jobs/search",
        json={"job_functions": ["Underwater Basket Weaver"], "location": "Columbus, OH"},
    )
    assert len(res.json()) == 3


def test_search_is_logged_to_the_database(client, session):
    client.post(
        "/api/jobs/search",
        json={"job_functions": ["Data Analyst"], "location": "Remote", "work_models": ["remote"]},
    )
    logs = session.query(SearchLog).all()
    assert len(logs) == 1
    assert logs[0].role == "Data Analyst"
    assert logs[0].remote is True
    assert logs[0].result_count == 1


def test_search_rejects_a_missing_field(client):
    res = client.post("/api/jobs/search", json={"job_functions": ["Intern"]})
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


def test_the_fit_prompt_includes_pay_and_job_type_but_not_display_only_details(sample_job, sample_profile):
    from app.fit_analysis import build_prompt
    from app.schemas import FitAnalysisRequest

    job = {**sample_job, "salary": "$90K–$116K a year", "employment_type": "Full-time", "work_model": "onsite",
           "posted_at": "1 day ago", "publisher": "Indeed", "employer_website": "https://acme.example"}
    prompt = build_prompt(FitAnalysisRequest(job=job, user_profile=sample_profile))
    assert "$116K a year" in prompt and "Full-time" in prompt and "onsite" in prompt
    assert "1 day ago" not in prompt and "Indeed" not in prompt and "acme.example" not in prompt
