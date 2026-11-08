import httpx
import pytest
from fastapi.testclient import TestClient

import app.api.inspect as inspect
import app.main as main
import app.services.auth as auth


@pytest.fixture
def mock_supabase_auth(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key")

    def handle_auth_request(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/auth/v1/user"
        assert request.headers["apikey"] == "test-anon-key"
        token = request.headers.get("authorization")
        if token == "Bearer invalid-token":
            return httpx.Response(401, json={"message": "Invalid token"})
        if token != "Bearer valid-token":
            return httpx.Response(401, json={"message": "Missing token"})
        return httpx.Response(200, json={"id": "verified-user-id"})

    real_async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handle_auth_request)
    monkeypatch.setattr(
        auth.httpx,
        "AsyncClient",
        lambda *args, **kwargs: real_async_client(transport=transport, **kwargs),
    )


def test_protected_route_rejects_signed_out_request():
    with TestClient(main.app) as client:
        response = client.get("/api/inspect/stream/unknown-job")

    assert response.status_code == 401


def test_protected_route_accepts_supabase_verified_user(mock_supabase_auth):
    inspect.jobs["owned-job"] = {
        "user_id": "verified-user-id",
        "status": "completed",
        "progress": 100,
        "message": "Analysis complete",
        "result": {"files_analyzed": 1},
    }

    try:
        with TestClient(main.app) as client:
            response = client.get(
                "/api/inspect/stream/owned-job",
                headers={"Authorization": "Bearer valid-token"},
            )
    finally:
        inspect.jobs.pop("owned-job", None)

    assert response.status_code == 200
    assert '"status": "completed"' in response.text
    assert "verified-user-id" not in response.text


def test_protected_route_rejects_invalid_token(mock_supabase_auth):
    with TestClient(main.app) as client:
        response = client.get(
            "/api/inspect/stream/unknown-job",
            headers={"Authorization": "Bearer invalid-token"},
        )

    assert response.status_code == 401


def test_user_cannot_read_another_users_analysis_job(mock_supabase_auth):
    inspect.jobs["other-users-job"] = {
        "user_id": "another-user-id",
        "status": "completed",
        "progress": 100,
        "message": "Private analysis",
    }

    try:
        with TestClient(main.app) as client:
            response = client.get(
                "/api/inspect/stream/other-users-job",
                headers={"Authorization": "Bearer valid-token"},
            )
    finally:
        inspect.jobs.pop("other-users-job", None)

    assert response.status_code == 404
