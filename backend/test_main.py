import asyncio
import threading

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.services.auth import get_current_user
from app.services.ingestion import _positive_int_from_env


def test_health_endpoint():
    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Reposeer Backend"}


def test_persistent_endpoint_reports_missing_database_configuration(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    main.app.dependency_overrides[get_current_user] = lambda: {
        "id": "00000000-0000-0000-0000-000000000001"
    }
    try:
        with TestClient(main.app) as client:
            response = client.get("/api/inspect/reports")
    finally:
        main.app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 503
    assert "Database persistence is not configured" in response.json()["detail"]


def test_api_starts_and_stops_embedded_analysis_worker(monkeypatch):
    worker_started = threading.Event()
    pool_closed = threading.Event()

    class FakePool:
        async def close(self):
            pool_closed.set()

    class FakeStore:
        async def prune_expired(self):
            return None

    async def create_pool(_database_url):
        return FakePool()

    async def run_worker(store):
        assert isinstance(store, FakeStore)
        worker_started.set()
        await asyncio.Event().wait()

    async def run_maintenance(_store):
        await asyncio.Event().wait()

    monkeypatch.setenv("DATABASE_URL", "postgresql://test/db")
    monkeypatch.setattr(main, "create_database_pool", create_pool)
    monkeypatch.setattr(main, "DatabaseStore", lambda _pool: FakeStore())
    monkeypatch.setattr(main, "run_worker_loop", run_worker)
    monkeypatch.setattr(main, "run_database_maintenance", run_maintenance)

    with TestClient(main.app):
        assert worker_started.wait(timeout=2)

    assert pool_closed.is_set()


def test_cors_allows_configured_origin_only():
    with TestClient(main.app) as client:
        allowed_response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:3001",
                "Access-Control-Request-Method": "GET",
            },
        )
        denied_response = client.options(
            "/health",
            headers={
                "Origin": "https://unapproved.example",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert allowed_response.headers["access-control-allow-origin"] == "http://localhost:3001"
    assert "access-control-allow-origin" not in denied_response.headers


def test_request_size_limit_returns_payload_too_large(monkeypatch):
    monkeypatch.setattr(main, "MAX_REQUEST_SIZE_BYTES", 1)

    with TestClient(main.app) as client:
        response = client.post("/api/inspect/github", json={"repo_url": "https://github.com/example/repo"})

    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower()


def test_cors_rejects_wildcard_origins(monkeypatch):
    monkeypatch.setenv("REPOSEER_CORS_ORIGINS", "https://*.example.com")

    with pytest.raises(ValueError, match="wildcards are not allowed"):
        main._configured_cors_origins()


@pytest.mark.parametrize("value", ["0", "-1", "invalid"])
def test_archive_limit_configuration_requires_positive_whole_numbers(monkeypatch, value):
    monkeypatch.setenv("REPOSEER_MAX_ARCHIVE_SIZE_MB", value)

    with pytest.raises(ValueError, match="positive whole number"):
        _positive_int_from_env("REPOSEER_MAX_ARCHIVE_SIZE_MB", 50)
