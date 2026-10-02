"""Guards the test setup itself: the app must never reach the configured database."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect

from app.main import app


def test_startup_creates_tables_in_the_swapped_in_engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    configured = app.state.engine
    app.state.engine = engine
    try:
        with TestClient(app):  # runs the lifespan, i.e. create_all
            pass
    finally:
        app.state.engine = configured
        engine.dispose()

    assert "search_logs" in inspect(engine).get_table_names()
