from datetime import datetime, timedelta, timezone
import uuid

import pytest
from fastapi import HTTPException

from app.main import app
from app.services.database import ANALYSIS_STALE_SECONDS, get_database_store


class FakeDatabaseStore:
    def __init__(self):
        self.jobs = {}
        self.reports = {}
        self.ai_actions = []
        self.analysis_usage = []

    async def create_analysis(self, owner_id, ip_hash, job_id=None):
        if any(
            job["owner_id"] == owner_id and job["status"] in ("queued", "processing")
            for job in self.jobs.values()
        ):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "active_analysis",
                    "message": "You already have an active analysis. Resume it or recover it if it is stale.",
                },
            )
        job_id = job_id or str(uuid.uuid4())
        self.jobs[job_id] = {
            "owner_id": owner_id,
            "status": "queued",
            "progress": 5,
            "message": "Initializing analysis pipeline...",
            "updated_at": datetime.now(timezone.utc),
        }
        self.analysis_usage.append(job_id)
        return job_id

    async def update_job(self, job_id, *, status, progress, message, result=None):
        job = self.jobs[job_id]
        if job["status"] not in ("queued", "processing"):
            return False
        job.update(status=status, progress=progress, message=message)
        job["updated_at"] = datetime.now(timezone.utc)
        if status == "completed" and result is not None:
            job["result"] = result
            self.reports[job_id] = {"id": job_id, "result": result, "owner_id": job["owner_id"]}
        elif status == "failed":
            self.analysis_usage = [usage_id for usage_id in self.analysis_usage if usage_id != job_id]
        return True

    async def get_job(self, job_id, owner_id):
        job = self.jobs.get(job_id)
        if not job or job["owner_id"] != owner_id:
            return None
        result = {"job_id": job_id, **{key: value for key, value in job.items() if key != "owner_id"}}
        updated_at = job.get("updated_at", datetime.now(timezone.utc))
        result["updated_at"] = updated_at.isoformat()
        result["is_stale"] = (
            job["status"] in ("queued", "processing")
            and datetime.now(timezone.utc) - updated_at
            > timedelta(seconds=ANALYSIS_STALE_SECONDS)
        )
        return result

    async def get_active_job(self, owner_id):
        active_jobs = [
            (job_id, job)
            for job_id, job in self.jobs.items()
            if job["owner_id"] == owner_id and job["status"] in ("queued", "processing")
        ]
        if not active_jobs:
            return None
        job_id, job = max(active_jobs, key=lambda item: item[1]["updated_at"])
        return {
            "job_id": job_id,
            "status": job["status"],
            "progress": job["progress"],
            "message": job["message"],
            "updated_at": job["updated_at"].isoformat(),
            "is_stale": datetime.now(timezone.utc) - job["updated_at"]
            > timedelta(seconds=ANALYSIS_STALE_SECONDS),
        }

    async def recover_stale_job(self, job_id, owner_id):
        job = self.jobs.get(job_id)
        if not job or job["owner_id"] != owner_id:
            return None
        if job["status"] not in ("queued", "processing"):
            return False
        if datetime.now(timezone.utc) - job["updated_at"] <= timedelta(seconds=ANALYSIS_STALE_SECONDS):
            return False
        job.update(
            status="failed",
            progress=0,
            message="Analysis was recovered after no progress was reported.",
            updated_at=datetime.now(timezone.utc),
        )
        self.analysis_usage = [usage_id for usage_id in self.analysis_usage if usage_id != job_id]
        return True

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
