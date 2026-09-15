from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import inspect
from app.api import chat

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

# Mount inspection routes under /api/inspect
app.include_router(inspect.router, prefix="/api/inspect", tags=["Inspection"])
app.include_router(chat.router, prefix="/api/seer", tags=["Casual Chat"])


@app.get("/")
def read_root():
    return {"status": "ok", "service": "Reposeer Backend"}