# app/api/inspect.py

import json
import asyncio
import uuid
from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# Import services used by the structural inspection pipeline
from app.services.ingestion import IngestionService
from app.services.ast_parser import PythonASTParser
from app.services.graph_mapper import DependencyGraphMapper

router = APIRouter()


# Define Pydantic models for incoming requests
class LocalInspectRequest(BaseModel):
    directory_path: str


class GitHubInspectRequest(BaseModel):
    repo_url: str


# In-memory job state store
jobs = {}


def run_analysis_task(job_id: str, repo_url: str):
    ingestion = IngestionService()
    temp_dir = None
    try:
        jobs[job_id] = {
            "status": "processing",
            "progress": 20,
            "message": "Cloning GitHub repository...",
        }
        temp_dir = ingestion.clone_github_repo(repo_url)

        jobs[job_id] = {
            "status": "processing",
            "progress": 50,
            "message": "Parsing AST & building dependency graph...",
        }
        python_files = ingestion.collect_python_files(temp_dir)

        if not python_files:
            jobs[job_id] = {
                "status": "failed",
                "progress": 0,
                "message": "No Python files found in repository.",
            }
            return

        parser = PythonASTParser()
        ast_data = [
            parser.parse_code(f["relative_path"], f["code"])
            for f in python_files
        ]

        mapper = DependencyGraphMapper()
        graph_metrics = mapper.build_graph(ast_data)

        jobs[job_id] = {
            "status": "processing",
            "progress": 80,
            "message": "Finalising structural analysis...",
        }

        jobs[job_id] = {
            "status": "completed",
            "progress": 100,
            "message": "Analysis Complete!",
            "result": {
                "files_analyzed": len(python_files),
                "ast_summary": ast_data,
                "dependency_graph": graph_metrics,
            },
        }
    except Exception as e:
        jobs[job_id] = {
            "status": "failed",
            "progress": 0,
            "message": f"Analysis failed: {str(e)}",
        }
    finally:
        if temp_dir:
            ingestion.cleanup_temp_dir(temp_dir)


@router.post("/github")
async def inspect_github_repository(
    payload: GitHubInspectRequest, background_tasks: BackgroundTasks
):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "queued",
        "progress": 5,
        "message": "Initializing analysis pipeline...",
    }

    background_tasks.add_task(run_analysis_task, job_id, payload.repo_url)

    return {"job_id": job_id, "status": "processing"}


@router.get("/stream/{job_id}")
async def stream_inspection_progress(job_id: str):
    async def event_generator():
        while True:
            job = jobs.get(job_id)
            if not job:
                yield f"data: {json.dumps({'progress': 0, 'message': 'Job not found'})}\n\n"
                break

            yield f"data: {json.dumps(job)}\n\n"

            if job.get("status") in ("completed", "failed"):
                break

            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")