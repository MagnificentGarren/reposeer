import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from app.models.schemas import SeerChatRequest

router = APIRouter()


def get_gemini_client() -> genai.Client:
    """Lazily initializes the Gemini client to ensure environment variables are loaded."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY environment variable is missing on the server.",
        )
    return genai.Client(api_key=api_key)


@router.post("/chat")
async def seer_casual_chat(payload: SeerChatRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    gemini_client = get_gemini_client()
    context = payload.report_context or {}

    files_analyzed = context.get("files_analyzed", 0)
    graph_data = context.get("dependency_graph") or {}
    scores = graph_data.get("scores") or {}

    ast_summary = context.get("ast_summary") or []
    repository_files = context.get("repository_files") or []
    repository_context = []
    for file in repository_files[:20]:
        if not isinstance(file, dict) or not file.get("relative_path"):
            continue
        repository_context.append(
            f"FILE: {file['relative_path']}\n{str(file.get('code', ''))[:8000]}"
        )

    if not repository_context:
        repository_context = [
            f"FILE: {file.get('file_path', 'unknown')}\n"
            f"Classes: {file.get('classes', [])}\n"
            f"Functions: {file.get('functions', [])}\n"
            f"Imports: {file.get('imports', [])}"
            for file in ast_summary[:20]
            if isinstance(file, dict)
        ]

    system_instruction = (
        "You are Reposeer Casual Assistant, an executive AI software architect explaining repository structures "
        "and architectural health to product managers, tech leads, and non-technical stakeholders.\n"
        "Your tone is clear, engaging, professional, and direct. Avoid unnecessary technical jargon unless "
        "you explain it simply using analogies. Prioritise maintainability, business risks, modularity, and actionable takeaways.\n\n"
        "STRICT LANGUAGE AND FORMATTING RULES:\n"
        "1. You MUST use standard UK English spelling and vocabulary throughout (e.g., summarise, initialise, analyse, organisation, prioritisation, colour).\n"
        "2. Do NOT output dense walls of text.\n"
        "3. Ensure EVERY paragraph, recommendation, and list item is separated by a DOUBLE newline (\\n\\n).\n"
        "4. Place blank space between introductory sentences, bullet points, and concluding points.\n\n"
        "CURRENT REPOSITORY CONTEXT:\n"
        f"- Total Files Parsed: {files_analyzed}\n"
        f"- Overall Architecture Score: {scores.get('overall', 'N/A')}/100\n"
        f"- Maintainability: {scores.get('maintainability', 'N/A')}/100\n"
        f"- Testability: {scores.get('testability', 'N/A')}/100\n"
        f"- Dependency Health: {scores.get('dependency_health', 'N/A')}/100\n"
        "\nSOURCE AND STRUCTURAL REPOSITORY CONTEXT:\n"
        f"{chr(10).join(repository_context) or 'No repository context was provided.'}\n\n"
        "Answer the user's prompt using the repository context above. Do not claim to have inspected files "
        "that are not present in that context."
    )

    def event_generator():
        try:
            response = gemini_client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=payload.query,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.3,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    )
                ),
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            print(f"[Reposeer Chat Streaming Error]: {str(e)}")
            yield "\n\nAn error occurred while streaming response telemetry."

    return StreamingResponse(event_generator(), media_type="text/event-stream")