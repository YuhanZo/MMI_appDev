"""Client for the JSearch job API (OpenWeb Ninja).

Only the backend calls this, so the API key never reaches the browser.

Some filters are sent to JSearch as parameters (employment type, experience,
remote). The ones JSearch can't filter on (hybrid, on-site, salary range) are
applied here after the results come back. Raw results are cached on disk for
a day, so changing only a post-filter (like salary) doesn't use a request.
"""

import hashlib
import json
import time
from pathlib import Path
from typing import Any, Protocol

import httpx

JSEARCH_URL = "https://api.openwebninja.com/jsearch/search-v2"
CACHE_DIR = Path(__file__).resolve().parent.parent / ".job_cache"
CACHE_VERSION = "v2"  # bump when the cached format changes, so old files are ignored
CACHE_TTL_SECONDS = 24 * 60 * 60

EMPLOYMENT_TYPES = {
    "full_time": "FULLTIME",
    "part_time": "PARTTIME",
    "contract": "CONTRACTOR",
    "internship": "INTERN",
}

# JSearch only distinguishes "under 3 years" from "more than 3 years", so mid and
# senior share a value; "senior" is also added to the keywords to separate them.
EXPERIENCE_REQUIREMENTS = {
    "entry": "no_experience,under_3_years_experience",
    "mid": "more_than_3_years_experience",
    "senior": "more_than_3_years_experience",
}

# Multipliers that turn a listed salary into a yearly amount.
PERIODS_PER_YEAR = {"HOUR": 2080, "DAY": 260, "WEEK": 52, "MONTH": 12, "YEAR": 1}


class SearchFilters(Protocol):
    """The fields of JobSearchRequest that this module reads."""

    role: str
    location: str
    work_arrangement: str
    experience_level: str
    employment_type: str
    salary_min: int | None
    salary_max: int | None
    industry: str


class JobApiError(Exception):
    """The job API couldn't be reached or returned an error."""


# Building request 

def build_params(req: SearchFilters) -> dict[str, str]:
    keywords = [req.role.strip()]
    if req.experience_level == "senior" and "senior" not in req.role.lower():
        keywords.insert(0, "senior")
    if req.industry.strip():
        keywords.append(req.industry.strip())
    query = " ".join(k for k in keywords if k)

    location = req.location.strip()
    params = {"query": f"{query} in {location}" if location else query}

    if req.work_arrangement == "remote":
        params["work_from_home"] = "true"
    if req.employment_type in EMPLOYMENT_TYPES:
        params["employment_types"] = EMPLOYMENT_TYPES[req.employment_type]
    if req.experience_level in EXPERIENCE_REQUIREMENTS:
        params["job_requirements"] = EXPERIENCE_REQUIREMENTS[req.experience_level]
    return params


# Filters 

def yearly_salary(raw: dict[str, Any]) -> tuple[float | None, float | None]:
    """The listing's salary range per year, or (None, None) if it isn't listed."""
    per_year = PERIODS_PER_YEAR.get(str(raw.get("job_salary_period") or "YEAR").upper())
    if per_year is None:
        return None, None

    def yearly(value: Any) -> float | None:
        return float(value) * per_year if isinstance(value, (int, float)) else None

    return yearly(raw.get("job_min_salary")), yearly(raw.get("job_max_salary"))


def salary_matches(raw: dict[str, Any], salary_min: int | None, salary_max: int | None) -> bool:
    low, high = yearly_salary(raw)
    if low is None and high is None:
        return True  # Most postings don't list pay; keep them rather than hide them.
    low = low if low is not None else high
    high = high if high is not None else low
    if salary_min is not None and high < salary_min:
        return False
    if salary_max is not None and low > salary_max:
        return False
    return True


def arrangement_matches(raw: dict[str, Any], work_arrangement: str) -> bool:
    if work_arrangement in ("any", "remote"):  # remote is filtered by JSearch itself
        return True
    listed = str(raw.get("work_arrangement") or "").lower()
    if work_arrangement == "hybrid":
        text = " ".join(str(raw.get(k) or "") for k in ("job_title", "job_description")).lower()
        return "hybrid" in listed or "hybrid" in text
    # on-site
    return not raw.get("job_is_remote") and "remote" not in listed and "hybrid" not in listed


def filter_listings(listings: list[dict[str, Any]], req: SearchFilters) -> list[dict[str, Any]]:
    return [
        raw
        for raw in listings
        if arrangement_matches(raw, req.work_arrangement)
        and salary_matches(raw, req.salary_min, req.salary_max)
    ]


#  Reading response 

def to_job(raw: dict[str, Any]) -> dict[str, str] | None:
    """Map one JSearch listing to the shared Job format. Skips incomplete listings."""
    job_id, title = raw.get("job_id"), raw.get("job_title")
    if not job_id or not title:
        return None

    location = raw.get("job_location") or ", ".join(
        part for part in (raw.get("job_city"), raw.get("job_state")) if part
    )
    if raw.get("job_is_remote"):
        location = f"{location} (Remote)" if location else "Remote"

    return {
        "id": str(job_id),
        "title": title,
        "company": raw.get("employer_name") or "Unknown company",
        "location": location or "Location not listed",
        "description": raw.get("job_description") or "",
        "url": raw.get("job_apply_link") or raw.get("job_google_link") or "",
        "company_logo": raw.get("employer_logo") or "",
    }


def extract_listings(body: Any) -> list[dict[str, Any]]:
    """Pull the raw listings out of a JSearch response, whichever shape it uses."""
    data = body.get("data") if isinstance(body, dict) else None
    if isinstance(data, dict):  # search-v2 may nest listings next to a paging cursor
        data = data.get("jobs")
    if not isinstance(data, list):
        return []
    return [raw for raw in data if isinstance(raw, dict)]


#  Calling the API 

def _cache_path(params: dict[str, str]) -> Path:
    key = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]
    return CACHE_DIR / f"{CACHE_VERSION}-{key}.json"


async def _fetch_listings(params: dict[str, str], api_key: str) -> list[dict[str, Any]]:
    cached = _cache_path(params)
    if cached.exists() and time.time() - cached.stat().st_mtime < CACHE_TTL_SECONDS:
        return json.loads(cached.read_text(encoding="utf-8"))

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.get(JSEARCH_URL, params=params, headers={"x-api-key": api_key})
    except httpx.HTTPError as e:
        raise JobApiError(f"Could not reach JSearch: {e}") from e

    if res.status_code != 200:
        raise JobApiError(f"JSearch returned {res.status_code}: {res.text[:200]}")

    listings = extract_listings(res.json())
    CACHE_DIR.mkdir(exist_ok=True)
    cached.write_text(json.dumps(listings), encoding="utf-8")
    return listings


async def search_jobs(req: SearchFilters, api_key: str) -> list[dict[str, str]]:
    if not api_key:
        raise JobApiError("JSEARCH_API_KEY is not set in backend/.env")

    listings = await _fetch_listings(build_params(req), api_key)
    jobs = (to_job(raw) for raw in filter_listings(listings, req))
    return [job for job in jobs if job]