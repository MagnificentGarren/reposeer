import httpx
import pytest
from fastapi.testclient import TestClient

import app.main as main
import app.services.auth as auth


@pytest.fixture
def mock_supabase_auth(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key")

    def handle_auth_request(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/auth/v1/user"
        assert request.headers["apikey"] == "test-anon-key"
        if request.headers.get("authorization") == "Bearer accepted-test-token":
            return httpx.Response(200, json={"id": "00000000-0000-0000-0000-000000000001"})
        return httpx.Response(401, json={"message": "Invalid token"})

    real_async_client = httpx.AsyncClient
    transport = httpx.MockTransport(handle_auth_request)
    monkeypatch.setattr(
        auth.httpx,
        "AsyncClient",
        lambda *args, **kwargs: real_async_client(transport=transport, **kwargs),
    )


def test_protected_route_rejects_signed_out_request():
    with TestClient(main.app) as client:
        response = client.get("/api/inspect/stream/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 401


def test_protected_route_accepts_supabase_verified_user(mock_supabase_auth, fake_database_store):
    job_id = "00000000-0000-0000-0000-000000000002"
    fake_database_store.jobs[job_id] = {
        "owner_id": "00000000-0000-0000-0000-000000000001",
        "status": "completed",
        "progress": 100,
        "message": "Analysis complete",
        "result": {"files_analyzed": 1},
    }

    with TestClient(main.app) as client:
        response = client.get(
            f"/api/inspect/stream/{job_id}",
            headers={"Authorization": "Bearer accepted-test-token"},
        )

    assert response.status_code == 200
    assert '"status": "completed"' in response.text
    assert "00000000-0000-0000-0000-000000000001" not in response.text


def test_protected_route_rejects_invalid_token(mock_supabase_auth):
    with TestClient(main.app) as client:
        response = client.get(
            "/api/inspect/stream/00000000-0000-0000-0000-000000000002",
            headers={"Authorization": "Bearer rejected-test-token"},
        )
    assert response.status_code == 401


def test_user_cannot_read_another_users_analysis_job(mock_supabase_auth, fake_database_store):
    job_id = "00000000-0000-0000-0000-000000000002"
    fake_database_store.jobs[job_id] = {
        "owner_id": "00000000-0000-0000-0000-000000000003",
        "status": "completed",
        "progress": 100,
        "message": "Private analysis",
    }

    with TestClient(main.app) as client:
        response = client.get(
            f"/api/inspect/stream/{job_id}",
            headers={"Authorization": "Bearer accepted-test-token"},
        )
    assert response.status_code == 404


def test_report_read_and_delete_are_limited_to_owner(mock_supabase_auth, fake_database_store):
    report_id = "00000000-0000-0000-0000-000000000002"
    fake_database_store.reports[report_id] = {
        "id": report_id,
        "owner_id": "00000000-0000-0000-0000-000000000003",
        "result": {"files_analyzed": 1},
    }

    with TestClient(main.app) as client:
        headers = {"Authorization": "Bearer accepted-test-token"}
        read_response = client.get(f"/api/inspect/reports/{report_id}", headers=headers)
        delete_response = client.delete(f"/api/inspect/reports/{report_id}", headers=headers)

    assert read_response.status_code == 404
    assert delete_response.status_code == 404
