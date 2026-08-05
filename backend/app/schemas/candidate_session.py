from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class CandidateSessionStartRequest(BaseModel):
    access_code: str = Field(min_length=6, max_length=32)
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    employee_reference: str | None = Field(default=None, max_length=100)

    @field_validator("access_code", "first_name", "last_name", "phone", "employee_reference")
    @classmethod
    def normalize_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.strip()


class CandidateInfoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str
    last_name: str
    email: EmailStr | None
    phone: str | None
    employee_reference: str | None


class CandidateExamOptionRead(BaseModel):
    id: int
    option_text: str
    option_order: int


class CandidateExamExcelExerciseRead(BaseModel):
    id: int
    name: str
    instructions: str | None
    workbook_filename: str


class CandidateExamQuestionRead(BaseModel):
    id: int
    question_id: int
    category_name: str
    question_type: str
    statement: str
    difficulty: str
    max_time_seconds: int
    score: float
    selected_answer: str | None
    is_answered: bool
    was_omitted: bool
    time_spent_seconds: int
    sort_order: int
    practical_submission_filename: str | None
    practical_feedback: str | None
    excel_exercise: CandidateExamExcelExerciseRead | None
    options: list[CandidateExamOptionRead]


class CandidateExamSectionRead(BaseModel):
    id: int
    title: str
    sort_order: int
    time_limit_seconds: int
    consumed_time_seconds: int
    questions: list[CandidateExamQuestionRead]


class CandidateCategoryResultRead(BaseModel):
    category_name: str
    total_questions: int
    answered_questions: int
    omitted_questions: int
    correct_questions: int
    incorrect_questions: int
    score_obtained: float
    score_possible: float


class CandidateSessionRead(BaseModel):
    id: int
    status: str
    started_at: datetime
    submitted_at: datetime | None
    expires_at: datetime
    total_time_seconds: int
    consumed_time_seconds: int
    completed_by_timeout: bool
    current_section_index: int
    current_question_index: int
    answered_questions_count: int
    omitted_questions_count: int
    correct_questions_count: int
    incorrect_questions_count: int
    average_time_per_question_seconds: float
    total_score: float | None
    show_result_to_candidate: bool
    template_name: str
    candidate: CandidateInfoRead
    sections: list[CandidateExamSectionRead]
    category_results: list[CandidateCategoryResultRead]


class CandidateAnswerUpsertRequest(BaseModel):
    question_id: int
    selected_answer: str = Field(min_length=1)
    time_spent_seconds: int = Field(ge=0)
    current_section_index: int = Field(ge=0)
    current_question_index: int = Field(ge=0)

    @field_validator("selected_answer")
    @classmethod
    def normalize_answer(cls, value: str) -> str:
        return value.strip()


class CandidateSessionHeartbeatRequest(BaseModel):
    question_id: int
    time_spent_seconds: int = Field(ge=0)
    current_section_index: int = Field(ge=0)
    current_question_index: int = Field(ge=0)
    mark_question_omitted: bool = False


class CandidateSessionProgressRead(BaseModel):
    session_id: int
    status: str
    answered_questions: int
    total_questions: int
    omitted_questions: int
    correct_questions: int
    incorrect_questions: int
    current_section_index: int
    current_question_index: int
    consumed_time_seconds: int
    average_time_per_question_seconds: float
    total_score: float | None


class CandidateSessionCompletionResponse(BaseModel):
    session_id: int
    status: str
    answered_questions: int
    total_questions: int
    omitted_questions: int
    correct_questions: int
    incorrect_questions: int
    consumed_time_seconds: int
    average_time_per_question_seconds: float
    total_score: float | None
    show_result_to_candidate: bool
    message: str
    category_results: list[CandidateCategoryResultRead]


class CandidateSessionResultSummaryRead(BaseModel):
    session_id: int
    status: str
    completed_by_timeout: bool
    answered_questions: int
    total_questions: int
    omitted_questions: int
    correct_questions: int
    incorrect_questions: int
    consumed_time_seconds: int
    total_time_seconds: int
    average_time_per_question_seconds: float
    total_score: float | None
    show_result_to_candidate: bool
    category_results: list[CandidateCategoryResultRead]


class CandidateExcelSubmissionResponse(BaseModel):
    message: str
    session: CandidateSessionRead
