"""Client for the JSearch job API (OpenWeb Ninja).

Only the backend calls this, so the API key never reaches the browser.

JSearch takes one text query per request, so each job function is its own request;
the results are merged. Job types, experience and remote-only are sent as
parameters. What JSearch can't filter on (on-site, hybrid, a mix of work models,
senior/lead/director titles) is applied here after the results come back.
"""

import asyncio
import hashlib
import json
import re
import time
from pathlib import Path
from typing import Any, Protocol

import httpx

JSEARCH_URL = "https://api.openwebninja.com/jsearch/search-v2"
CACHE_DIR = Path(__file__).resolve().parent.parent / ".job_cache"
CACHE_VERSION = "v2"  
CACHE_TTL_SECONDS = 24 * 60 * 60

JOB_TYPES = {
    "full_time": "FULLTIME",
    "part_time": "PARTTIME",
    "contract": "CONTRACTOR",
    "internship": "INTERN",
}

# JSearch only distinguishes no experience / under 3 years / more than 3 years, so
# the upper levels share a value and are told apart by the job title (below).
EXPERIENCE_REQUIREMENTS = {
    "intern": "no_experience",
    "entry": "under_3_years_experience",
    "mid": "more_than_3_years_experience",
    "senior": "more_than_3_years_experience",
    "lead": "more_than_3_years_experience",
    "director": "more_than_3_years_experience",
}

TITLE_PATTERNS = {
    "senior": r"\b(senior|sr)\b",
    "lead": r"\b(lead|staff|principal)\b",
    "director": r"\b(director|head|vp|vice president|chief|executive)\b",
}


class SearchFilters(Protocol):
    """The fields of JobSearchRequest that this module reads."""

    location: str
    job_functions: list[str]
    experience_levels: list[str]
    job_types: list[str]
    work_models: list[str]


class JobApiError(Exception):
    """The job API couldn't be reached or returned an error."""


# Building request 

def build_params(req: SearchFilters, job_function: str) -> dict[str, str]:
    location = req.location.strip()
    params = {"query": f"{job_function} in {location}" if location else job_function}

    if req.work_models == ["remote"]:
        params["work_from_home"] = "true"
    if req.job_types:
        params["employment_types"] = ",".join(JOB_TYPES[t] for t in sorted(req.job_types))
    if req.experience_levels:
        params["job_requirements"] = ",".join(sorted({EXPERIENCE_REQUIREMENTS[e] for e in req.experience_levels}))
    return params


# Filters 

def experience_matches(raw: dict[str, Any], levels: list[str]) -> bool:
    """Only filters by title when every chosen level is senior or above; lower levels
    are covered by JSearch's job_requirements, which can't be checked here."""
    if not levels or any(level not in TITLE_PATTERNS for level in levels):
        return True
    title = str(raw.get("job_title") or "").lower()
    return any(re.search(TITLE_PATTERNS[level], title) for level in levels)


def work_model_of(raw: dict[str, Any]) -> str:
    listed = str(raw.get("work_arrangement") or "").lower()
    text = " ".join(str(raw.get(k) or "") for k in ("job_title", "job_description")).lower()
    if "hybrid" in listed or "hybrid" in text:
        return "hybrid"
    if raw.get("job_is_remote") or "remote" in listed:
        return "remote"
    return "onsite"


def work_model_matches(raw: dict[str, Any], work_models: list[str]) -> bool:
    if not work_models or work_models == ["remote"]:  # remote-only is filtered by JSearch
        return True
    return work_model_of(raw) in work_models


def filter_listings(listings: list[dict[str, Any]], req: SearchFilters) -> list[dict[str, Any]]:
    return [
        raw
        for raw in listings
        if work_model_matches(raw, req.work_models) and experience_matches(raw, req.experience_levels)
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
    if isinstance(data, dict):  
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

    batches = await asyncio.gather(
        *(_fetch_listings(build_params(req, f), api_key) for f in req.job_functions)
    )
    # The same posting can come back for several job functions; keep the first.
    seen: set[Any] = set()
    merged = []
    for raw in (raw for batch in batches for raw in batch):
        if raw.get("job_id") not in seen:
            seen.add(raw.get("job_id"))
            merged.append(raw)

    jobs = (to_job(raw) for raw in filter_listings(merged, req))
    return [job for job in jobs if job]
