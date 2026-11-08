import uuid

import pytest

from app.main import app
from app.services.database import get_database_store


class FakeDatabaseStore:
    def __init__(self):
        self.jobs = {}
        self.reports = {}
        self.ai_actions = []

    async def create_analysis(self, owner_id, ip_hash, job_id=None):
        job_id = job_id or str(uuid.uuid4())
        self.jobs[job_id] = {
            "owner_id": owner_id,
            "status": "queued",
            "progress": 5,
            "message": "Initializing analysis pipeline...",
        }
        return job_id

    async def update_job(self, job_id, *, status, progress, message, result=None):
        job = self.jobs[job_id]
        job.update(status=status, progress=progress, message=message)
        if status == "completed" and result is not None:
            job["result"] = result
            self.reports[job_id] = {"id": job_id, "result": result, "owner_id": job["owner_id"]}

    async def get_job(self, job_id, owner_id):
        job = self.jobs.get(job_id)
        if not job or job["owner_id"] != owner_id:
            return None
        return {"job_id": job_id, **{key: value for key, value in job.items() if key != "owner_id"}}

    async def consume_ai_action(self, owner_id, ip_hash, action):
        self.ai_actions.append((owner_id, ip_hash, action))

    async def list_reports(self, owner_id):
        return [
            {"id": report_id, "created_at": "", "expires_at": "", "files_analyzed": 0}
            for report_id, report in self.reports.items()
            if report["owner_id"] == owner_id
        ]

    async def get_report(self, report_id, owner_id):
        report = self.reports.get(report_id)
        if not report or report["owner_id"] != owner_id:
            return None
        return report

    async def delete_report(self, report_id, owner_id):
        report = self.reports.get(report_id)
        if not report or report["owner_id"] != owner_id:
            return False
        self.reports.pop(report_id)
        self.jobs.pop(report_id, None)
        return True


@pytest.fixture
def fake_database_store(monkeypatch):
    monkeypatch.setenv("REPOSEER_RATE_LIMIT_HMAC_KEY", "test-only-rate-limit-key")
    store = FakeDatabaseStore()
    app.dependency_overrides[get_database_store] = lambda: store
    yield store
    app.dependency_overrides.pop(get_database_store, None)
