import os
import json
import instructor  # type: ignore
from litellm import completion  # type: ignore
from langgraph.graph import StateGraph, END
from typing import TypedDict
from app.models.schemas import InspectionReport, ArchitecturalScore, CodeRoast, InterviewQuestion

# Initialize Instructor wrapper using LiteLLM with MD_JSON mode for Gemini compatibility
client = instructor.from_litellm(
    completion,
    mode=instructor.Mode.MD_JSON,
)


class WorkflowState(TypedDict):
    ast_summary: dict
    repo_structure: str
    report: dict | None


def evaluate_architecture_node(state: WorkflowState) -> dict:
    """Node that generates structured scores, code roast, and technical interview questions."""
    prompt = f"""
    You are a senior codebase architect evaluating a Python repository structure and AST analysis.
    
    AST Structural Summary:
    {json.dumps(state['ast_summary'], indent=2)}

    Directory Tree Structure:
    {state['repo_structure']}

    Evaluate this codebase and return:
    1. Architectural scores (0-100) for maintainability, coupling risk, and testability.
    2. A sharp, technical code roast describing top architectural flaws and suggested refactoring fixes.
    3. Three specific technical interview questions based on actual files and structural patterns found in this code.
    """

    # Use explicitly routed LiteLLM model identifier
    model_name = os.getenv("GEMINI_MODEL", "gemini/gemini-2.5-flash")

    try:
        response: InspectionReport = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": "You are a senior codebase architect. Respond strictly with valid JSON matching the requested schema.",
                },
                {"role": "user", "content": prompt},
            ],
            response_model=InspectionReport,
            max_tokens=8192,
            temperature=0.2,
        )
        return {"report": response.model_dump()}
    except Exception as e:
        print(f"AI Evaluation Error: {e}")
        raise e


def build_inspection_workflow():
    """Builds and compiles the LangGraph state graph."""
    workflow = StateGraph(WorkflowState)
    workflow.add_node("evaluate", evaluate_architecture_node)
    workflow.set_entry_point("evaluate")
    workflow.add_edge("evaluate", END)
    return workflow.compile()


inspection_graph = build_inspection_workflow()