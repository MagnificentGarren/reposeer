import logging
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app.api.chat as chat
import app.api.inspect as inspect_api
import app.api.interview as interview
from app.main import app
from app.services.auth import get_current_user


@pytest.fixture(autouse=True)
def authenticated_user(fake_database_store):
    app.dependency_overrides[get_current_user] = lambda: {"id": "test-user"}
    yield
    app.dependency_overrides.pop(get_current_user, None)


def test_completed_and_failed_jobs_stream_and_report_deletion(fake_database_store):
    completed_job_id = "00000000-0000-0000-0000-000000000021"
    failed_job_id = "00000000-0000-0000-0000-000000000022"
    fake_database_store.jobs[completed_job_id] = {
        "owner_id": "test-user",
        "status": "completed",
        "progress": 100,
        "message": "Analysis complete",
    }
    fake_database_store.jobs[failed_job_id] = {
        "owner_id": "test-user",
        "status": "failed",
        "progress": 0,
        "message": "Analysis failed",
    }
    fake_database_store.reports[completed_job_id] = {
        "id": completed_job_id,
        "owner_id": "test-user",
        "result": {"files_analyzed": 1},
    }

    with TestClient(app) as client:
        completed_response = client.get(f"/api/inspect/stream/{completed_job_id}")
        failed_response = client.get(f"/api/inspect/stream/{failed_job_id}")
        delete_response = client.delete(f"/api/inspect/reports/{completed_job_id}")
        missing_report_response = client.get(f"/api/inspect/reports/{completed_job_id}")

    assert completed_response.status_code == 200
    assert '"status": "completed"' in completed_response.text
    assert failed_response.status_code == 200
    assert '"status": "failed"' in failed_response.text
    assert delete_response.status_code == 200
    assert delete_response.json() == {"deleted": True}
    assert missing_report_response.status_code == 404


def test_chat_and_interview_generation_and_evaluation(monkeypatch):
    class FakeModels:
        def generate_content_stream(self, **_kwargs):
            return [SimpleNamespace(text="Repository overview")]

        async def generate_content(self, **kwargs):
            if kwargs["contents"].lower().startswith("generate a"):
                return SimpleNamespace(text="How would you refactor app/main.py?")
            return SimpleNamespace(
                text="Architecture: 80/100\nClarity: 90/100\nModularity: 70/100\nGood explanation."
            )

    class FakeAsyncClient:
        models = FakeModels()

        async def aclose(self):
            return None

    class FakeClient:
        models = FakeModels()
        aio = FakeAsyncClient()

    monkeypatch.setattr(chat, "get_gemini_client", lambda: FakeClient())
    monkeypatch.setattr(interview, "get_gemini_client", lambda: FakeClient())

    with TestClient(app) as client:
        chat_response = client.post(
            "/api/seer/chat",
            json={"query": "Summarise this repository.", "report_context": {}},
        )
        question_response = client.post(
            "/api/interview/generate-question",
            json={"difficulty": "Medium", "report_context": {}},
        )
        evaluation_response = client.post(
            "/api/interview/evaluate",
            json={
                "question": "How would you refactor this module?",
                "candidate_answer": "I would separate responsibilities.",
            },
        )

    assert chat_response.status_code == 200
    assert "Repository overview" in chat_response.text
    assert question_response.status_code == 200
    assert "app/main.py" in question_response.json()["question"]
    assert evaluation_response.status_code == 200
    assert evaluation_response.json()["scores"] == {
        "architecture": 80,
        "clarity": 90,
        "modularity": 70,
        "overall": 80,
    }


def test_quota_exhaustion_blocks_analysis_and_ai_actions(
    monkeypatch, fake_database_store
):
    async def quota_exhausted(*_args, **_kwargs):
        raise HTTPException(
            status_code=429,
            detail={"code": "quota_exceeded", "quota": "ai_actions"},
        )

    async def analysis_quota_exhausted(*_args, **_kwargs):
        raise HTTPException(
            status_code=429,
            detail={"code": "quota_exceeded", "quota": "analyses"},
        )

    monkeypatch.setattr(fake_database_store, "consume_ai_action", quota_exhausted)
    monkeypatch.setattr(fake_database_store, "create_analysis", analysis_quota_exhausted)
    monkeypatch.setattr(
        chat, "get_gemini_client", lambda: pytest.fail("AI call bypassed exhausted quota")
    )

    with TestClient(app) as client:
        ai_response = client.post("/api/seer/chat", json={"query": "Explain the project."})
        analysis_response = client.post(
            "/api/inspect/github",
            json={"repo_url": "https://github.com/example/repo"},
        )

    assert ai_response.status_code == 429
    assert ai_response.json()["detail"]["code"] == "quota_exceeded"
    assert analysis_response.status_code == 429
    assert analysis_response.json()["detail"]["code"] == "quota_exceeded"


def test_ai_provider_failure_does_not_expose_secrets_or_source_in_logs(
    monkeypatch, caplog
):
    secret_marker = "provider-token-marker"
    source_marker = "uploaded-source-marker"

    class FailingModels:
        async def generate_content(self, **_kwargs):
            raise RuntimeError(f"{secret_marker} {source_marker}")

    class FailingAsyncClient:
        models = FailingModels()

        async def aclose(self):
            return None

    monkeypatch.setattr(
        interview,
        "get_gemini_client",
        lambda: SimpleNamespace(aio=FailingAsyncClient()),
    )
    caplog.set_level(logging.ERROR)

    with TestClient(app) as client:
        response = client.post(
            "/api/interview/generate-question",
            json={"report_context": {"repository_files": [{"relative_path": "x.py", "code": source_marker}]}},
        )

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to generate an interview question."
    assert secret_marker not in caplog.text
    assert source_marker not in caplog.text
    assert secret_marker not in response.text
    assert source_marker not in response.text


def test_analysis_failure_is_actionable_without_logging_uploaded_content(
    monkeypatch, caplog, fake_database_store
):
    secret_marker = "private-repository-source-marker"
    job_id = "00000000-0000-0000-0000-000000000023"
    fake_database_store.jobs[job_id] = {
        "owner_id": "test-user",
        "status": "queued",
        "progress": 5,
        "message": "Queued",
        "worker_id": "test-worker",
    }

    def fail_clone(*_args, **_kwargs):
        raise RuntimeError(secret_marker)

    monkeypatch.setattr(inspect_api.IngestionService, "clone_github_repo", fail_clone)
    caplog.set_level(logging.ERROR)

    asyncio.run(
        inspect_api.run_analysis_task(
            job_id,
            "https://github.com/example/repo",
            fake_database_store,
            "test-worker",
        )
    )

    assert fake_database_store.jobs[job_id]["status"] == "failed"
    assert "Please try again" in fake_database_store.jobs[job_id]["message"]
    assert secret_marker not in caplog.text
    assert secret_marker not in fake_database_store.jobs[job_id]["message"]
