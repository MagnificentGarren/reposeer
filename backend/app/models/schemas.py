from pydantic import BaseModel, Field
from typing import Dict, Any, Optional


class ArchitecturalScore(BaseModel):
    maintainability: int = Field(..., ge=0, le=100, description="Score from 0-100 reflecting modularity and code clarity.")
    coupling_risk: int = Field(..., ge=0, le=100, description="Score from 0-100 indicating degree of tight coupling or circular imports.")
    testability: int = Field(..., ge=0, le=100, description="Score from 0-100 for separation of concerns and interface isolation.")


class CodeRoast(BaseModel):
    summary: str = Field(..., description="A sharp, witty 2-sentence summary roasting the codebase architectural anti-patterns.")
    key_flaws: list[str] = Field(..., description="List of top structural flaws (e.g., missing exception handling, monolithic files).")
    suggested_fix: str = Field(..., description="Actionable refactoring advice to fix the primary architectural bottleneck.")


class InterviewQuestion(BaseModel):
    id: str = Field(..., description="Unique string identifier for the question.")
    title: str = Field(..., description="Short title describing the target architectural or code challenge.")
    difficulty: str = Field(..., description="Difficulty level: Easy, Medium, or Hard.")
    category: str = Field(..., description="Category, e.g., System Design, Concurrency, Error Handling, Optimization.")
    question_text: str = Field(..., description="The main interview question prompt based on actual AST parsing context.")
    target_file: str = Field(..., description="Relative path of the source file this question targets.")
    rubric: list[str] = Field(..., description="Evaluation criteria for scoring candidate answers.")


class InspectionReport(BaseModel):
    scores: ArchitecturalScore
    roast: CodeRoast
    interview_questions: list[InterviewQuestion]

class SeerChatRequest(BaseModel):
    query: str
    report_context: Optional[Dict[str, Any]] = None

class SeerChatResponse(BaseModel):
    response: str