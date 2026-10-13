"""Each test gets its own throwaway database, so tests never touch the configured one.

The app reads its engine from app.state.engine (startup table creation, requests and
/api/health all use it), so swapping that one attribute isolates everything.
"""

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import aivana, job_api
from app.config import settings
from app.db import Base
from app.main import app


@pytest.fixture(autouse=True)
def no_real_aivana(monkeypatch):
    """Tests never call the real API, whatever backend/.env says.

    Mock mode by default; any request that slips through to Aivana fails loudly.
    Tests that exercise the client install their own transport.
    """

    def refuse(request):
        raise AssertionError(f"test tried to call the real Aivana API: {request.url}")

    monkeypatch.setattr(settings, "aivana_mode", "mock")
    monkeypatch.setattr(settings, "aivana_api_key", "test-key")
    monkeypatch.setattr(settings, "aivana_base_url", "https://aivana.test")
    monkeypatch.setattr(aivana, "_transport", httpx.MockTransport(refuse))
    monkeypatch.setattr(aivana, "_sleep", lambda s: None)


@pytest.fixture(autouse=True)
def no_real_jsearch(monkeypatch):
    """Same for JSearch: mock mode by default, and a real request fails the test
    (it would spend the 200/month free quota). JSearch tests fake _fetch_listings."""

    async def refuse(params, api_key):
        raise AssertionError(f"test tried to call the real JSearch API: {params}")

    monkeypatch.setattr(settings, "job_api_mode", "mock")
    monkeypatch.setattr(settings, "jsearch_api_key", "test-key")
    monkeypatch.setattr(job_api, "_fetch_listings", refuse)


@pytest.fixture
def db_engine(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def client(db_engine):
    configured = app.state.engine
    app.state.engine = db_engine
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.state.engine = configured


@pytest.fixture
def session(db_engine):
    TestingSession = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)
    db = TestingSession()
    yield db
    db.close()


@pytest.fixture
def sample_job():
    return {
        "id": "job_001",
        "title": "Software Engineer Intern",
        "company": "Example Company",
        "location": "Columbus, OH",
        "description": "Build backend services using Python and AWS.",
        "url": "https://example.com/job/001",
    }


@pytest.fixture
def sample_profile():
    return {
        "skills": ["Python", "Java", "React"],
        "education": "BS Computer Science",
        "experience": "Backend and web development project experience.",
    }
