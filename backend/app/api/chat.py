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
    ai_report = context.get("ai_report") or {}

    scores = ai_report.get("scores") or {}
    maintainability = scores.get("maintainability", "N/A")
    coupling_risk = scores.get("coupling_risk", "N/A")
    testability = scores.get("testability", "N/A")

    roast = ai_report.get("roast") or {}
    summary_roast = roast.get("summary", "No roast summary available.")
    key_flaws = roast.get("key_flaws", [])

    ast_summary = context.get("ast_summary") or []
    sample_files: list[str] = [
        str(f.get("relative_path"))
        for f in ast_summary[:10]
        if isinstance(f, dict) and f.get("relative_path") is not None
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
        f"- Maintainability Score: {maintainability}/100\n"
        f"- Coupling Risk Score: {coupling_risk}/100\n"
        f"- Testability Score: {testability}/100\n"
        f"- Executive Overview: {summary_roast}\n"
        f"- Key Architectural Flaws Identified: {', '.join(key_flaws) if key_flaws else 'None reported'}\n"
        f"- Sample High-Level Modules: {', '.join(sample_files) if sample_files else 'Not specified'}\n\n"
        "Answer the user's prompt using the context above."
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