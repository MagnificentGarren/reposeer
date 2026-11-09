import asyncio
from io import BytesIO
from datetime import datetime, timedelta, timezone
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.inspect import _save_analysis_result
import app.services.ingestion as ingestion
from app.services.auth import get_current_user
from app.services.database import ANALYSIS_STALE_SECONDS


@pytest.fixture(autouse=True)
def authenticated_test_user(fake_database_store):
    app.dependency_overrides[get_current_user] = lambda: {"id": "test-user"}
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_upload_zip_endpoint_accepts_archive(fake_database_store):
    archive_buffer = BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr("sample_app/__init__.py", "VALUE = 1\n")
        archive.writestr("sample_app/main.py", "def hello():\n    return 'hi'\n")

    archive_buffer.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/inspect/upload",
            files={"file": ("project.zip", archive_buffer.getvalue(), "application/zip")},
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "queued"
    assert fake_database_store.jobs[data["job_id"]]["input_type"] == "zip"
    assert fake_database_store.jobs[data["job_id"]]["input_archive"]


def test_github_endpoint_persists_repository_as_queued_work(fake_database_store):
    repo_url = "https://github.com/example/repo"

    with TestClient(app) as client:
        response = client.post(
            "/api/inspect/github",
            json={"repo_url": repo_url},
        )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "queued"
    job = fake_database_store.jobs[data["job_id"]]
    assert job["input_type"] == "github"
    assert job["input_payload"] == {"repo_url": repo_url}


def test_upload_zip_endpoint_rejects_archive_without_python_file():
    archive_buffer = BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr("README.md", "Documentation only\n")

    archive_buffer.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/inspect/upload",
            files={"file": ("project.zip", archive_buffer.getvalue(), "application/zip")},
        )

    assert response.status_code == 400, response.text
    assert "no Python files" in response.json()["detail"]


def test_upload_zip_endpoint_rejects_path_traversal(fake_database_store):
    archive_buffer = BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr("../outside.py", "VALUE = 1\n")

    archive_buffer.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/inspect/upload",
            files={"file": ("project.zip", archive_buffer.getvalue(), "application/zip")},
        )

    assert response.status_code == 400, response.text
    assert "unsafe path" in response.json()["detail"]
    assert fake_database_store.analysis_usage == []


def test_upload_zip_endpoint_rejects_excessive_extracted_size(monkeypatch):
    monkeypatch.setattr(ingestion, "MAX_EXTRACTED_SIZE_BYTES", 4)
    archive_buffer = BytesIO()
    with zipfile.ZipFile(archive_buffer, "w") as archive:
        archive.writestr("sample_app/main.py", "12345")

    archive_buffer.seek(0)

    with TestClient(app) as client:
        response = client.post(
            "/api/inspect/upload",
            files={"file": ("project.zip", archive_buffer.getvalue(), "application/zip")},
        )

    assert response.status_code == 400, response.text
    assert "extraction limit" in response.json()["detail"]


def test_active_analysis_is_resumable_and_duplicate_start_is_conflict(fake_database_store):
    job_id = "00000000-0000-0000-0000-000000000010"
    fake_database_store.jobs[job_id] = {
        "owner_id": "test-user",
        "status": "processing",
        "progress": 45,
        "message": "Parsing Python files...",
        "updated_at": datetime.now(timezone.utc),
    }

    with TestClient(app) as client:
        active_response = client.get("/api/inspect/jobs/active")
        duplicate_response = client.post(
            "/api/inspect/github",
            json={"repo_url": "https://github.com/example/repo"},
        )

    assert active_response.status_code == 200
    assert active_response.json()["job"]["job_id"] == job_id
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"]["code"] == "active_analysis"
    assert list(fake_database_store.jobs) == [job_id]


def test_healthy_analysis_cannot_be_recovered(fake_database_store):
    job_id = "00000000-0000-0000-0000-000000000011"
    fake_database_store.jobs[job_id] = {
        "owner_id": "test-user",
        "status": "processing",
        "progress": 60,
        "message": "Parsing Python files...",
        "updated_at": datetime.now(timezone.utc),
    }

    with TestClient(app) as client:
        response = client.post(f"/api/inspect/jobs/{job_id}/recover")

    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "recovery_not_safe"
    assert fake_database_store.jobs[job_id]["status"] == "processing"


def test_stale_progress_stream_closes_for_safe_recovery(fake_database_store):
    job_id = "00000000-0000-0000-0000-000000000014"
    fake_database_store.jobs[job_id] = {
        "owner_id": "test-user",
        "status": "processing",
        "progress": 60,
        "message": "Parsing Python files...",
        "updated_at": datetime.now(timezone.utc)
        - timedelta(seconds=ANALYSIS_STALE_SECONDS + 1),
        "worker_id": "interrupted-worker",
    }

    with TestClient(app) as client:
        response = client.get(f"/api/inspect/stream/{job_id}")

    assert response.status_code == 200
    assert '"is_stale": true' in response.text


def test_stale_analysis_can_be_recovered_and_late_completion_is_fenced(fake_database_store):
    job_id = "00000000-0000-0000-0000-000000000012"
    fake_database_store.jobs[job_id] = {
        "owner_id": "test-user",
        "status": "processing",
        "progress": 60,
        "message": "Parsing Python files...",
        "updated_at": datetime.now(timezone.utc)
        - timedelta(seconds=ANALYSIS_STALE_SECONDS + 1),
    }
    fake_database_store.analysis_usage.append(job_id)

    with TestClient(app) as client:
        response = client.post(f"/api/inspect/jobs/{job_id}/recover")

    assert response.status_code == 200
    assert response.json()["recovered"] is True
    assert fake_database_store.jobs[job_id]["status"] == "queued"
    assert fake_database_store.jobs[job_id]["worker_id"] is None
    assert job_id in fake_database_store.analysis_usage

    asyncio.run(
        _save_analysis_result(
            job_id, {"files_analyzed": 1}, fake_database_store, "interrupted-worker"
        )
    )

    assert fake_database_store.jobs[job_id]["status"] == "queued"
    assert job_id not in fake_database_store.reports


def test_another_account_cannot_recover_or_list_a_job(fake_database_store):
    job_id = "00000000-0000-0000-0000-000000000013"
    fake_database_store.jobs[job_id] = {
        "owner_id": "job-owner",
        "status": "processing",
        "progress": 60,
        "message": "Private analysis",
        "updated_at": datetime.now(timezone.utc)
        - timedelta(seconds=ANALYSIS_STALE_SECONDS + 1),
    }
    current_user_override = app.dependency_overrides[get_current_user]
    app.dependency_overrides[get_current_user] = lambda: {"id": "other-user"}
    try:
        with TestClient(app) as client:
            active_response = client.get("/api/inspect/jobs/active")
            recover_response = client.post(f"/api/inspect/jobs/{job_id}/recover")
    finally:
        app.dependency_overrides[get_current_user] = current_user_override

    assert active_response.status_code == 200
    assert active_response.json()["job"] is None
    assert recover_response.status_code == 404
    assert fake_database_store.jobs[job_id]["status"] == "processing"
