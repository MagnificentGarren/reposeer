import os
from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types
from app.models.schemas import SeerChatRequest, SeerChatResponse

router = APIRouter()

# Initialize Google GenAI client (uses GEMINI_API_KEY environment variable)
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


@router.post("/chat", response_model=SeerChatResponse)
async def seer_casual_chat(payload: SeerChatRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    context = payload.report_context or {}

    # Extract metrics matching your InspectionReport schema structure
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

    # Formulate System Instruction tailored for casual mode
    system_instruction = (
        "You are Reposeer Casual Assistant, an executive AI software architect explaining repository structures "
        "and architectural health to product managers, tech leads, and non-technical stakeholders.\n"
        "Your tone is clear, engaging, professional, and direct. Avoid unnecessary technical jargon unless "
        "you explain it simply using analogies. Prioritise maintainability, business risks, modularity, and actionable takeaways.\n\n"
        "CURRENT REPOSITORY CONTEXT:\n"
        f"- Total Files Parsed: {files_analyzed}\n"
        f"- Maintainability Score: {maintainability}/100\n"
        f"- Coupling Risk Score: {coupling_risk}/100\n"
        f"- Testability Score: {testability}/100\n"
        f"- Executive Overview: {summary_roast}\n"
        f"- Key Architectural Flaws Identified: {', '.join(key_flaws) if key_flaws else 'None reported'}\n"
        f"- Sample High-Level Modules: {', '.join(sample_files) if sample_files else 'Not specified'}\n\n"
        "Answer the user's prompt using the context above. If they ask about risks, focus on coupling and testability scores. "
        "If they ask for high-level summaries, focus on overall system maintainability."
    )

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=payload.query,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
            ),
        )

        return SeerChatResponse(
            response=response.text or "I wasn't able to generate a response based on the current context."
        )

    except Exception as e:
        print(f"[Reposeer Chat Error]: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process query with Gemini API: {str(e)}"
        )