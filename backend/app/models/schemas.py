from pydantic import BaseModel, Field
from typing import Dict, Any, Optional


class InterviewQuestion(BaseModel):
    id: str = Field(..., description="Unique string identifier for the question.")
    title: str = Field(..., description="Short title describing the target architectural or code challenge.")
    difficulty: str = Field(..., description="Difficulty level: Easy, Medium, or Hard.")
    category: str = Field(..., description="Category, e.g., System Design, Concurrency, Error Handling, Optimization.")
    question_text: str = Field(..., description="The main interview question prompt based on actual AST parsing context.")
    target_file: str = Field(..., description="Relative path of the source file this question targets.")
    rubric: list[str] = Field(..., description="Evaluation criteria for scoring candidate answers.")


class SeerChatRequest(BaseModel):
    query: str
    report_context: Optional[Dict[str, Any]] = None

class SeerChatResponse(BaseModel):
    response: str