def test_health_reports_ok_and_dialect(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "sqlite"}
