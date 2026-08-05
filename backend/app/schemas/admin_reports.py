from datetime import datetime

from pydantic import BaseModel


class ReportSessionItemRead(BaseModel):
    session_id: int
    candidate_name: str
    template_name: str
    status: str
    total_score: float | None
    score_percentage: float
    answered_questions: int
    omitted_questions: int
    consumed_time_seconds: int
    started_at: datetime
    submitted_at: datetime | None
    completed_by_timeout: bool


class AdminReportsSummaryRead(BaseModel):
    generated_at: datetime
    evaluated_candidates_count: int
    total_finished_sessions: int
    average_score_percentage: float
    average_time_seconds: float
    sessions: list[ReportSessionItemRead]
