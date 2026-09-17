# app/api/inspect.py

import json
import asyncio
import os
import shutil
import tempfile
import time
import uuid
import zipfile
from collections import OrderedDict
from urllib.parse import urlparse
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Import services used by the structural inspection pipeline
from app.services.ingestion import (
    MAX_ARCHIVE_SIZE_BYTES,
    IngestionService,
)
from app.services.ast_parser import PythonASTParser
from app.services.graph_mapper import DependencyGraphMapper

router = APIRouter()


# Define Pydantic models for incoming requests
class LocalInspectRequest(BaseModel):
    directory_path: str


class GitHubInspectRequest(BaseModel):
    repo_url: str


# Bounded in-memory job state store. Completed jobs only need to survive long enough
# for the frontend to receive the final streamed event.
JOB_TTL_SECONDS = int(os.getenv("REPOSEER_JOB_TTL_SECONDS", "3600"))
MAX_JOBS = int(os.getenv("REPOSEER_MAX_JOBS", "100"))
jobs: OrderedDict[str, dict] = OrderedDict()


def _prune_jobs() -> None:
    IngestionService.cleanup_expired_temp_dirs(JOB_TTL_SECONDS)
    now = time.time()
    expired_ids = [
        job_id
        for job_id, job in jobs.items()
        if job.get("status") in {"completed", "failed"}
        and now - job.get("updated_at", now) > JOB_TTL_SECONDS
    ]
    for job_id in expired_ids:
        jobs.pop(job_id, None)

    while len(jobs) >= MAX_JOBS:
        oldest_id, oldest_job = next(iter(jobs.items()))
        if oldest_job.get("status") in {"processing", "queued"}:
            break
        jobs.pop(oldest_id, None)


def _set_job(job_id: str, **updates: object) -> None:
    _prune_jobs()
    job = {**jobs.get(job_id, {}), **updates, "updated_at": time.time()}
    jobs.pop(job_id, None)
    jobs[job_id] = job


def run_analysis_task(job_id: str, repo_url: str):
    ingestion = IngestionService()
    temp_dir = None
    try:
        _set_job(job_id, status="processing", progress=20, message="Cloning GitHub repository...")
        temp_dir = ingestion.clone_github_repo(repo_url)
        _run_analysis_on_directory(job_id, temp_dir)
    except Exception as e:
        _set_job(job_id, status="failed", progress=0, message=f"Analysis failed: {str(e)}")
    finally:
        if temp_dir:
            ingestion.cleanup_temp_dir(temp_dir)


def run_zip_analysis_task(job_id: str, extracted_dir: str):
    ingestion = IngestionService()
    try:
        _set_job(job_id, status="processing", progress=20, message="Extracting uploaded archive...")
        _run_analysis_on_directory(job_id, extracted_dir)
    except Exception as e:
        _set_job(job_id, status="failed", progress=0, message=f"Analysis failed: {str(e)}")
    finally:
        if extracted_dir:
            ingestion.cleanup_temp_dir(extracted_dir)


def _run_analysis_on_directory(job_id: str, source_dir: str):
    ingestion = IngestionService()

    _set_job(job_id, status="processing", progress=50, message="Parsing AST & building dependency graph...")
    python_files = ingestion.collect_python_files(source_dir)

    if not python_files:
        _set_job(
            job_id,
            status="failed",
            progress=0,
            message="Analysis requires at least one Python file in the repository or uploaded archive. Please provide Python source files for analysis.",
        )
        return

    parser = PythonASTParser()
    ast_data = [
        parser.parse_code(f["relative_path"], f["code"])
        for f in python_files
    ]

    mapper = DependencyGraphMapper()
    graph_metrics = mapper.build_graph(ast_data)

    _set_job(job_id, status="processing", progress=80, message="Finalising structural analysis...")

    _set_job(
        job_id,
        status="completed",
        progress=100,
        message="Analysis Complete!",
        result={
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
        },
    )


@router.post("/github")
async def inspect_github_repository(
    payload: GitHubInspectRequest, background_tasks: BackgroundTasks
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

    job_id = str(uuid.uuid4())
    _set_job(job_id, status="queued", progress=5, message="Initializing analysis pipeline...")

    background_tasks.add_task(run_analysis_task, job_id, repo_url)

    return {"job_id": job_id, "status": "processing"}


@router.post("/upload")
async def inspect_uploaded_repository(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a ZIP archive containing the repository. Analysis requires at least one Python file in the archive.",
        )

    job_id = str(uuid.uuid4())
    _set_job(job_id, status="queued", progress=5, message="Initializing ZIP analysis pipeline...")

    temp_dir = tempfile.mkdtemp(prefix="reposeer_upload_")

    try:
        archive_size = file.file.seek(0, os.SEEK_END)
        file.file.seek(0)
        if archive_size > MAX_ARCHIVE_SIZE_BYTES:
            limit_mb = MAX_ARCHIVE_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"The uploaded ZIP is too large. The limit is {limit_mb}MB.",
            )

        with zipfile.ZipFile(file.file, "r") as archive:
            has_python_file = any(
                not entry.is_dir() and entry.filename.lower().endswith(".py")
                for entry in archive.infolist()
            )
            if not has_python_file:
                shutil.rmtree(temp_dir, ignore_errors=True)
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "The uploaded ZIP was rejected because it contains no Python files. "
                        "Please upload a repository archive with at least one .py source file."
                    ),
                )
            IngestionService.extract_zip_safely(archive, temp_dir)
    except ValueError as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except zipfile.BadZipFile as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Invalid ZIP archive: {str(exc)}") from exc

    background_tasks.add_task(run_zip_analysis_task, job_id, temp_dir)
    return {"job_id": job_id, "status": "processing"}


@router.get("/stream/{job_id}")
async def stream_inspection_progress(job_id: str):
    async def event_generator():
        while True:
            _prune_jobs()
            job = jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'progress': 0, 'message': 'Job not found'})}\n\n"
                break

            yield f"data: {json.dumps(job)}\n\n"

            if job.get("status") in ("completed", "failed"):
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")