from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.question_bank import ALLOWED_DIFFICULTIES


class EvaluationTemplateSectionBase(BaseModel):
    category_id: int
    subcategory_id: int | None = None
    difficulty: str | None = None
    question_count: int = Field(gt=0)
    time_limit_seconds: int = Field(gt=0)
    weight_override: float | None = Field(default=None, gt=0)
    sort_order: int = Field(gt=0)

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None

        normalized_value = value.strip().lower()
        if normalized_value not in ALLOWED_DIFFICULTIES:
            raise ValueError("La dificultad no es valida.")

        return normalized_value


class EvaluationTemplateSectionCreate(EvaluationTemplateSectionBase):
    pass


class EvaluationTemplateSectionUpdate(EvaluationTemplateSectionBase):
    pass


class EvaluationTemplateBase(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    description: str | None = None
    instructions: str | None = None
    passing_score_percentage: float = Field(default=80.0, ge=0.0, le=100.0)
    show_result_to_candidate: bool = False
    randomize_question_order: bool = True
    sections: list[EvaluationTemplateSectionCreate]

    @field_validator("name", "description", "instructions")
    @classmethod
    def normalize_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.strip()

    @model_validator(mode="after")
    def validate_sections(self):
        if not self.sections:
            raise ValueError("La plantilla debe incluir al menos una seccion.")
        return self


class EvaluationTemplateCreate(EvaluationTemplateBase):
    pass


class EvaluationTemplateUpdate(EvaluationTemplateBase):
    sections: list[EvaluationTemplateSectionUpdate]


class EvaluationTemplateStatusUpdate(BaseModel):
    is_active: bool


class EvaluationTemplateSectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    category_name: str
    subcategory_id: int | None
    subcategory_name: str | None
    difficulty: str | None
    question_count: int
    time_limit_seconds: int
    weight_override: float | None
    sort_order: int


class EvaluationTemplateListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_active: bool
    passing_score_percentage: float
    show_result_to_candidate: bool
    randomize_question_order: bool
    created_at: datetime
    section_count: int
    total_question_count: int
    total_time_seconds: int
    is_valid: bool
    validation_message: str


class EvaluationTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    instructions: str | None
    is_active: bool
    passing_score_percentage: float
    show_result_to_candidate: bool
    randomize_question_order: bool
    created_at: datetime
    sections: list[EvaluationTemplateSectionRead]
    is_valid: bool
    validation_message: str
    total_question_count: int
    total_time_seconds: int


class TemplatePreviewSection(BaseModel):
    section_id: int | None = None
    category_id: int
    category_name: str
    subcategory_id: int | None
    subcategory_name: str | None
    difficulty: str | None
    requested_question_count: int
    available_question_count: int
    sufficient: bool
    time_limit_seconds: int
    estimated_score: float
    warning: str | None = None


class EvaluationTemplatePreviewResponse(BaseModel):
    template_id: int | None = None
    template_name: str
    total_sections: int
    total_requested_questions: int
    total_available_questions: int
    total_time_seconds: int
    estimated_total_score: float
    is_valid: bool
    validation_message: str
    sections: list[TemplatePreviewSection]
