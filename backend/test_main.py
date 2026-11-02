import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.services.ingestion import _positive_int_from_env


def test_health_endpoint():
    with TestClient(main.app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Reposeer Backend"}


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
