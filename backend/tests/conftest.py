"""Each test run gets its own throwaway database, so tests never touch dev.db."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base, get_db
from app.main import app


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
    TestingSession = sessionmaker(bind=db_engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


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
