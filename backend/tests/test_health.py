from sqlalchemy import create_engine


def test_health_reports_ok_and_dialect(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "sqlite"}


def test_health_returns_503_when_the_database_is_unreachable(client, tmp_path):
    unreachable = create_engine(f"sqlite:///{tmp_path / 'missing-dir' / 'db.sqlite'}")
    client.app.state.engine = unreachable  # the client fixture restores the real one

    res = client.get("/api/health")
    assert res.status_code == 503
    assert res.json() == {"status": "error", "database": "sqlite"}
