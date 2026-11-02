import os
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

# Path calculation: app/main.py -> app (parent) -> backend (parent.parent) -> reposeer (parent.parent.parent)
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_PATH = REPO_ROOT / ".env"

# Load .env explicitly from reposeer/.env
load_dotenv(dotenv_path=ENV_PATH)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import chat, inspect, interview
from app.services.ingestion import MAX_ARCHIVE_SIZE_BYTES


def _configured_cors_origins() -> list[str]:
    configured_origins = os.getenv(
        "REPOSEER_CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001",
    )
    origins = [origin.strip().rstrip("/") for origin in configured_origins.split(",") if origin.strip()]
    if not origins or any("*" in origin for origin in origins):
        raise ValueError("REPOSEER_CORS_ORIGINS must contain explicit HTTP(S) origins; wildcards are not allowed.")

    for origin in origins:
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.username
            or parsed.password
            or parsed.path
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(
                f"Invalid CORS origin {origin!r}. Provide an origin such as https://app.example.com without a path."
            )
    return origins


MAX_REQUEST_SIZE_BYTES = MAX_ARCHIVE_SIZE_BYTES + 1024 * 1024

app = FastAPI(
    title="Reposeer Studio API",
    description="AST parsing, dependency graph analysis, and LLM codebase evaluation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_configured_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def enforce_request_size_limit(request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            request_size = int(content_length)
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header."})
        if request_size > MAX_REQUEST_SIZE_BYTES:
            limit_mb = MAX_ARCHIVE_SIZE_BYTES // (1024 * 1024)
            return JSONResponse(
                status_code=413,
                content={"detail": f"Request is too large. ZIP archives are limited to {limit_mb}MB."},
            )
    return await call_next(request)


# Mount inspection routes
app.include_router(inspect.router, prefix="/api/inspect", tags=["Inspection"])
app.include_router(chat.router, prefix="/api/seer", tags=["Casual Chat"])
app.include_router(interview.router, prefix="/api/interview", tags=["Interview"])


@app.get("/")
def read_root():
    return {"status": "ok", "service": "Reposeer Backend"}


@app.get("/health")
def read_health():
    return {"status": "ok", "service": "Reposeer Backend"}