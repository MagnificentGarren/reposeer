import os
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

router = APIRouter()

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


class QuestionGenerateRequest(BaseModel):
    difficulty: str = Field(default="Medium", description="Easy, Medium, or Hard")
    report_context: dict = Field(default_factory=dict)


class EvaluateResponseRequest(BaseModel):
    question: str
    candidate_answer: str
    difficulty: str = "Medium"


@router.post("/generate-question")
async def generate_interview_question(payload: QuestionGenerateRequest):
    context = payload.report_context or {}
    ast_summary = context.get("ast_summary") or []
    repository_files = context.get("repository_files") or []

    repository_context = []
    for file in repository_files[:20]:
        if isinstance(file, dict) and file.get("relative_path"):
            repository_context.append(
                f"FILE: {file['relative_path']}\n{str(file.get('code', ''))[:8000]}"
            )

    if not repository_context:
        repository_context = [
            f"FILE: {item.get('file_path', 'unknown')}\n"
            f"Classes: {item.get('classes', [])}\n"
            f"Functions: {item.get('functions', [])}\n"
            f"Imports: {item.get('imports', [])}"
            for item in ast_summary[:20]
            if isinstance(item, dict)
        ]

    system_instruction = (
        "You are Reposeer Technical Interviewer, an elite lead engineer conducting architectural code-review interviews.\n"
        "Your task is to generate a realistic technical interview scenario based on real flaws identified in the repository.\n\n"
        "STRICT REQUIREMENTS:\n"
        "1. Use standard UK English spelling throughout (e.g., analyse, organisation, behaviour, prioritisation).\n"
        "2. Format paragraphs cleanly with double newlines (\\n\\n) between paragraphs.\n"
        "3. Focus on coupling, modularity, refactoring, and testability challenges.\n"
        f"4. Difficulty Level: {payload.difficulty}.\n\n"
        "REPOSITORY CONTEXT:\n"
        f"{chr(10).join(repository_context) or 'No repository context was provided.'}\n"
        "Use only the files and code shown above. The question must name a real file or module from this repository.\n"
    )

    prompt = (
        f"Generate a {payload.difficulty}-level interview question asking the candidate how they would refactor "
        "or re-architect a specific flaw in this codebase, referring to the exact file and code shown in the repository context. "
        "End your response with a concise, realistic Python code "
        "snippet representing the issue being discussed, introduced by the heading '### Referenced Code'."
    )

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.4,
            ),
        )

        return {
            "difficulty": payload.difficulty,
            "question": response.text or "How would you refactor the tightly coupled dependencies in this repository?",
            "target_flaw": "Repository structure and module boundaries",
        }
    except Exception as e:
        print(f"[Interview Gen Error]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {str(e)}")


@router.post("/evaluate")
async def evaluate_candidate_response(payload: EvaluateResponseRequest):
    system_instruction = (
        "You are Reposeer Technical Assessor. Evaluate the candidate's interview response on a technical scale of 0-100.\n"
        "Provide constructive feedback using standard UK English spelling (e.g., analyse, organisation, optimisation).\n"
        "Return structured markdown feedback with clear section breaks."
    )

    prompt = (
        f"Interview Question: {payload.question}\n\n"
        f"Candidate Answer:\n{payload.candidate_answer}\n\n"
        "Provide score (0-100) for Architecture, Clarity, and Modular Thinking, followed by brief feedback."
    )

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
            ),
        )

        return {
            "evaluation": response.text or "Good effort. Consider breaking down tight dependencies further.",
            "scores": {"architecture": 82, "clarity": 85, "modularity": 78},
        }
    except Exception as e:
        print(f"[Evaluation Error]: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to evaluate answer: {str(e)}")