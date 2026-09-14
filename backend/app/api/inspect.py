import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ingestion import IngestionService
from app.services.ast_parser import PythonASTParser
from app.services.graph_mapper import DependencyGraphMapper
from app.services.ai_engine import inspection_graph, WorkflowState

router = APIRouter()


class LocalInspectRequest(BaseModel):
    directory_path: str


class GitHubInspectRequest(BaseModel):
    repo_url: str


def _process_repository(target_path: str):
    """Processes Python files using AST parsing, NetworkX graph mapping, and LangGraph evaluation."""
    ingestion = IngestionService()
    python_files = ingestion.collect_python_files(target_path)

    if not python_files:
        raise HTTPException(status_code=400, detail="No Python files found in the specified repository path.")

    parser = PythonASTParser()
    ast_data = []

    for file_info in python_files:
        parsed = parser.parse_code(file_info["relative_path"], file_info["code"])
        ast_data.append(parsed)

    mapper = DependencyGraphMapper()
    graph_metrics = mapper.build_graph(ast_data)

    # Format simple directory tree representation for LLM context
    file_list_str = "\n".join([f["relative_path"] for f in python_files])

    initial_state: WorkflowState = {
        "ast_summary": {
            "file_count": len(ast_data),
            "modules": ast_data[:15],
            "graph_metrics": graph_metrics,
        },
        "repo_structure": file_list_str,
        "report": None,
    }

    try:
        final_state = inspection_graph.invoke(initial_state)
        report = final_state.get("report")
    except Exception as e:
        report = {"error": f"AI Engine evaluation failed: {str(e)}"}

    return {
        "files_analyzed": len(python_files),
        "ast_summary": ast_data,
        "dependency_graph": graph_metrics,
        "ai_report": report,
    }


@router.post("/local")
async def inspect_local_directory(payload: LocalInspectRequest):
    if not os.path.exists(payload.directory_path):
        raise HTTPException(status_code=400, detail="Specified directory path does not exist.")

    return _process_repository(payload.directory_path)


@router.post("/github")
async def inspect_github_repository(payload: GitHubInspectRequest):
    ingestion = IngestionService()
    temp_dir = None
    try:
        temp_dir = ingestion.clone_github_repo(payload.repo_url)
        return _process_repository(temp_dir)
    finally:
        if temp_dir:
            ingestion.cleanup_temp_dir(temp_dir)