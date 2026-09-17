from io import BytesIO
import zipfile

from fastapi.testclient import TestClient

from app.main import app
import app.services.ingestion as ingestion


def test_upload_zip_endpoint_accepts_archive():
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
    assert data["status"] == "processing"


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


def test_upload_zip_endpoint_rejects_path_traversal():
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
