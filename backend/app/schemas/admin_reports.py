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
    assistance_level: str = "none"
    assistance_notes: str | None = None


class AdminReportsSummaryRead(BaseModel):
    generated_at: datetime
    evaluated_candidates_count: int
    total_finished_sessions: int
    average_score_percentage: float
    average_time_seconds: float
    sessions: list[ReportSessionItemRead]


class ReportQuestionResultRead(BaseModel):
    session_question_id: int | None = None
    question_id: int | None = None
    sort_order: int
    category_name: str
    question_type: str = "multiple_choice"
    statement: str
    selected_answer: str | None
    correct_answer: str | None
    result_label: str
    time_spent_seconds: int
    has_practical_submission: bool = False
    practical_submission_filename: str | None = None


class ReportCategoryMetricRead(BaseModel):
    category_name: str
    total_questions: int
    answered_questions: int
    omitted_questions: int
    correct_questions: int
    incorrect_questions: int
    score_percentage: float


class ReportSessionDetailRead(BaseModel):
    session_id: int
    candidate_name: str
    template_name: str
    status: str
    score_percentage: float
    precision_percentage: float
    consumed_time_seconds: int
    started_at: datetime
    submitted_at: datetime | None
    assistance_level: str = "none"
    assistance_notes: str | None = None
    categories: list[ReportCategoryMetricRead]
    questions: list[ReportQuestionResultRead]


class SessionAssistanceUpdateRequest(BaseModel):
    assistance_level: str = "none"  # "none", "partial", "full"
    assistance_notes: str | None = None
