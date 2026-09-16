import os
from pathlib import Path
from dotenv import load_dotenv

# Path calculation: app/main.py -> app (parent) -> backend (parent.parent) -> reposeer (parent.parent.parent)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_PATH = REPO_ROOT / ".env"

# Load .env explicitly from reposeer/.env
load_dotenv(dotenv_path=ENV_PATH)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat, inspect, interview

app = FastAPI(
    title="Reposeer Studio API",
    description="AST parsing, dependency graph analysis, and LLM codebase evaluation.",
    version="1.0.0",
)

# Enable CORS for the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount inspection routes
app.include_router(inspect.router, prefix="/api/inspect", tags=["Inspection"])
app.include_router(chat.router, prefix="/api/seer", tags=["Casual Chat"])
app.include_router(interview.router, prefix="/api/interview", tags=["Interview"])


@app.get("/")
def read_root():
    return {"status": "ok", "service": "Reposeer Backend"}