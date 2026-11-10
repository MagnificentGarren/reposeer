# app/api/inspect.py

import json
import asyncio
import logging
import tempfile
import uuid
import zipfile
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Import services used by the structural inspection pipeline
from app.services.ingestion import (
    MAX_ARCHIVE_SIZE_BYTES,
    IngestionService,
)
from app.services.ast_parser import PythonASTParser
from app.services.graph_mapper import DependencyGraphMapper
from app.services.auth import get_current_user
from app.services.database import DatabaseStore, get_database_store, hash_client_ip

router = APIRouter()
logger = logging.getLogger(__name__)


# Define Pydantic models for incoming requests
class LocalInspectRequest(BaseModel):
    directory_path: str


class GitHubInspectRequest(BaseModel):
    repo_url: str


async def run_analysis_task(job_id: str, repo_url: str, store: DatabaseStore, worker_id: str):
    ingestion = IngestionService()
    temp_dir = None
    try:
        job_active = await store.update_job(
            job_id, status="processing", progress=20, message="Cloning GitHub repository...",
            worker_id=worker_id,
        )
        if not job_active:
            return

        loop = asyncio.get_running_loop()
        clone_progress = 20
        job_recovered = False

        def update_clone_progress(current: float, maximum: float, message: str) -> None:
            nonlocal clone_progress, job_recovered
            if maximum > 0:
                clone_progress = max(clone_progress, 20 + min(14, int(14 * current / maximum)))
            else:
                clone_progress = min(34, clone_progress + 1)
            progress_message = "Cloning GitHub repository..."
            if message:
                progress_message = f"Cloning GitHub repository: {message.strip()}"
            future = asyncio.run_coroutine_threadsafe(
                store.update_job(
                    job_id,
                    status="processing",
                    progress=clone_progress,
                    message=progress_message[:500],
                    worker_id=worker_id,
                ),
                loop,
            )
            if not future.result():
                job_recovered = True

        temp_dir = await asyncio.to_thread(
            ingestion.clone_github_repo, repo_url, update_clone_progress, job_id
        )
        if job_recovered:
            return
        job_active = await store.update_job(
            job_id, status="processing", progress=35,
            message="Repository cloned. Preparing analysis...", worker_id=worker_id,
        )
        if not job_active:
            return
        report = await _run_analysis_on_directory(job_id, temp_dir, store, worker_id)
        ingestion.cleanup_temp_dir(temp_dir)
        temp_dir = None
        await _save_analysis_result(job_id, report, store, worker_id)
    except Exception:
        logger.error("Analysis job %s failed.", job_id)
        await store.update_job(
            job_id,
            status="failed",
            progress=0,
            message="Analysis failed while processing the repository. Please try again.",
            worker_id=worker_id,
        )
    finally:
        if temp_dir:
            ingestion.cleanup_temp_dir(temp_dir)


async def run_zip_analysis_task(job_id: str, archive_bytes: bytes, store: DatabaseStore, worker_id: str):
    ingestion = IngestionService()
    extracted_dir = tempfile.mkdtemp(prefix=f"reposeer_upload_{job_id}_")
    loop = asyncio.get_running_loop()

    def update_extraction_progress(current: int, total: int) -> None:
        percent = int(100 * current / max(total, 1))
        future = asyncio.run_coroutine_threadsafe(
            store.update_job(
                job_id,
                status="processing",
                progress=10 + int(10 * percent / 100),
                message=f"Extracting uploaded archive ({percent}%)...",
                worker_id=worker_id,
            ),
            loop,
        )
        future.result()

    try:
        job_active = await store.update_job(
            job_id, status="processing", progress=10, message="Extracting uploaded archive...",
            worker_id=worker_id,
        )
        if not job_active:
            return
        with zipfile.ZipFile(BytesIO(archive_bytes), "r") as archive:
            await asyncio.to_thread(
                ingestion.extract_zip_safely,
                archive,
                extracted_dir,
                update_extraction_progress,
            )
        report = await _run_analysis_on_directory(job_id, extracted_dir, store, worker_id)
        ingestion.cleanup_temp_dir(extracted_dir)
        extracted_dir = None
        await _save_analysis_result(job_id, report, store, worker_id)
    except Exception:
        logger.error("Analysis job %s failed.", job_id)
        await store.update_job(
            job_id,
            status="failed",
            progress=0,
            message="Analysis failed while processing the uploaded archive. Please try again.",
            worker_id=worker_id,
        )
    finally:
        if extracted_dir:
            ingestion.cleanup_temp_dir(extracted_dir)


async def _run_analysis_on_directory(
    job_id: str, source_dir: str, store: DatabaseStore, worker_id: str
):
    ingestion = IngestionService()

    job_active = await store.update_job(
        job_id, status="processing", progress=40,
        message="Scanning repository for Python files...", worker_id=worker_id,
    )
    if not job_active:
        return None
    python_files = await asyncio.to_thread(ingestion.collect_python_files, source_dir)
    if not python_files:
        return None

    parser = PythonASTParser()
    ast_data = []
    total_files = len(python_files)
    for index, file in enumerate(python_files, start=1):
        ast_data.append(
            await asyncio.to_thread(
                parser.parse_code, file["relative_path"], file["code"]
            )
        )
        progress = 40 + int(45 * index / total_files)
        job_active = await store.update_job(
            job_id,
            status="processing",
            progress=progress,
            message=f"Parsing Python files ({index}/{total_files})...",
            worker_id=worker_id,
        )
        if not job_active:
            return None

    job_active = await store.update_job(
        job_id, status="processing", progress=90,
        message="Building dependency graph...", worker_id=worker_id,
    )
    if not job_active:
        return None
    graph_metrics = await asyncio.to_thread(DependencyGraphMapper().build_graph, ast_data)
    return {
        "files_analyzed": len(python_files),
        "ast_summary": ast_data,
        "repository_files": [
            {
                "relative_path": file["relative_path"],
                "code": file["code"][:12000],
            }
            for file in python_files[:40]
        ],
        "dependency_graph": graph_metrics,
    }


async def _save_analysis_result(
    job_id: str, report: dict | None, store: DatabaseStore, worker_id: str | None = None
) -> None:
    if report is None:
        await store.update_job(
            job_id,
            status="failed",
            progress=0,
            message="Analysis requires at least one Python file in the repository or uploaded archive. Please provide Python source files for analysis.",
            worker_id=worker_id,
        )
        return
    await store.update_job(
        job_id,
        status="completed",
        progress=100,
        message="Analysis Complete!",
        result=report,
        worker_id=worker_id,
    )

async def process_analysis_job(
    job: dict, store: DatabaseStore, worker_id: str
) -> None:
    job_id = job["job_id"]
    if job["input_type"] == "github":
        repo_url = (job.get("input_payload") or {}).get("repo_url")
        if not isinstance(repo_url, str) or not repo_url:
            raise ValueError(f"GitHub analysis job {job_id} has no repository URL.")
        await run_analysis_task(job_id, repo_url, store, worker_id)
    elif job["input_type"] == "zip":
        archive_bytes = job.get("input_archive")
        if not isinstance(archive_bytes, bytes):
            raise ValueError(f"ZIP analysis job {job_id} has no persisted archive.")
        await run_zip_analysis_task(job_id, archive_bytes, store, worker_id)
    else:
        raise ValueError(f"Analysis job {job_id} has unsupported input type {job['input_type']!r}.")


@router.post("/github")
async def inspect_github_repository(
    payload: GitHubInspectRequest,
    request: Request,
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    repo_url = (payload.repo_url or "").strip()
    parsed = urlparse(repo_url)
    is_valid_github_url = (
        parsed.scheme in {"http", "https"}
        and parsed.netloc.lower().replace("www.", "") in {"github.com"}
        and len([segment for segment in parsed.path.split("/") if segment]) >= 2
    )

    if not is_valid_github_url:
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid GitHub repository URL, for example: https://github.com/owner/repo. Analysis requires at least one Python file in the repository.",
        )

    job_id = await store.create_analysis(
        user["id"],
        hash_client_ip(request.client.host if request.client else None),
        input_type="github",
        input_payload={"repo_url": repo_url},
    )

    return {"job_id": job_id, "status": "queued"}


@router.post("/upload")
async def inspect_uploaded_repository(
    request: Request,
    file: UploadFile = File(...),
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a ZIP archive containing the repository. Analysis requires at least one Python file in the archive.",
        )

    archive_size = file.file.seek(0, 2)
    file.file.seek(0)
    if archive_size > MAX_ARCHIVE_SIZE_BYTES:
        limit_mb = MAX_ARCHIVE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"The uploaded ZIP is too large. The limit is {limit_mb}MB.",
        )

    archive_bytes = await file.read()
    try:
        with zipfile.ZipFile(BytesIO(archive_bytes), "r") as archive:
            IngestionService.validate_zip_archive(archive, Path(tempfile.gettempdir()))
            has_python_file = any(
                not entry.is_dir() and entry.filename.lower().endswith(".py")
                for entry in archive.infolist()
            )
            if not has_python_file:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "The uploaded ZIP was rejected because it contains no Python files. "
                        "Please upload a repository archive with at least one .py source file."
                    ),
                )

            job_id = await store.create_analysis(
                user["id"],
                hash_client_ip(request.client.host if request.client else None),
                input_type="zip",
                input_archive=archive_bytes,
            )
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail=f"Invalid ZIP archive: {str(exc)}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"job_id": job_id, "status": "queued"}


@router.get("/stream/{job_id}")
async def stream_inspection_progress(
    job_id: uuid.UUID,
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    job_id = str(job_id)
    initial_job = await store.get_job(job_id, user["id"])
    if not initial_job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")

    async def event_generator():
        while True:
            job = await store.get_job(job_id, user["id"])
            if not job:
                yield f"data: {json.dumps({'progress': 0, 'message': 'Job not found'})}\n\n"
                break

            yield f"data: {json.dumps(job)}\n\n"

            if job.get("status") in ("completed", "failed") or job.get("is_stale"):
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/jobs/active")
async def get_active_analysis_job(
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    return {"job": await store.get_active_job(user["id"])}


@router.get("/jobs/{job_id}")
async def get_analysis_job(
    job_id: uuid.UUID,
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    job = await store.get_job(str(job_id), user["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    return job


@router.post("/jobs/{job_id}/recover")
async def recover_analysis_job(
    job_id: uuid.UUID,
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    recovered = await store.recover_stale_job(str(job_id), user["id"])
    if recovered is None:
        raise HTTPException(status_code=404, detail="Analysis job not found.")
    if recovered == "not_active":
        raise HTTPException(
            status_code=409,
            detail={
                "code": "job_not_active",
                "message": "This analysis is no longer active and cannot be recovered.",
            },
        )
    if not recovered:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "recovery_not_safe",
                "message": "This analysis has reported progress recently and cannot be recovered yet.",
            },
        )
    job = await store.get_job(str(job_id), user["id"])
    return {"job": job, "recovered": True}


@router.get("/reports")
async def list_owned_reports(
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    return {"reports": await store.list_reports(user["id"])}


@router.get("/reports/{report_id}")
async def get_owned_report(
    report_id: uuid.UUID,
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    report = await store.get_report(str(report_id), user["id"])
    if not report:
        raise HTTPException(status_code=404, detail="Report not found or expired.")
    return report


@router.delete("/reports/{report_id}")
async def delete_owned_report(
    report_id: uuid.UUID,
    user: dict[str, str] = Depends(get_current_user),
    store: DatabaseStore = Depends(get_database_store),
):
    deleted = await store.delete_report(str(report_id), user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Report not found or already deleted.")
    return {"deleted": True}