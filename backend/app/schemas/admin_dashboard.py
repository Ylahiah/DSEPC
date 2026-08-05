from datetime import datetime

from pydantic import BaseModel, EmailStr


class DashboardCategoryAverageRead(BaseModel):
    category_name: str
    average_score_percentage: float
    average_time_seconds: float
    total_questions: int
    evaluated_sessions: int


class DashboardRankingItemRead(BaseModel):
    candidate_id: int
    candidate_name: str
    email: EmailStr | None
    attempts_count: int
    average_score_percentage: float
    best_score_percentage: float
    average_time_seconds: float
    last_template_name: str | None
    last_status: str | None
    last_submitted_at: datetime | None


class DashboardRecentSessionRead(BaseModel):
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


class AdminDashboardRead(BaseModel):
    evaluated_candidates_count: int
    total_sessions_count: int
    completed_sessions_count: int
    active_sessions_count: int
    average_score_percentage: float
    average_time_seconds: float
    best_candidate_name: str | None
    best_candidate_score_percentage: float | None
    category_averages: list[DashboardCategoryAverageRead]
    ranking: list[DashboardRankingItemRead]
    recent_sessions: list[DashboardRecentSessionRead]


class AdminDashboardCleanupRead(BaseModel):
    deleted_sessions_count: int
    deleted_active_sessions_count: int
    deleted_candidates_count: int
    message: str
