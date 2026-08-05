from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_DIFFICULTIES = {"basic", "intermediate", "advanced"}
ALLOWED_QUESTION_TYPES = {"multiple_choice", "excel_practical"}


class CategoryBase(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=3, max_length=120)
    description: str | None = None
    weight: float = Field(gt=0)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(CategoryBase):
    pass


class CategoryStatusUpdate(BaseModel):
    is_active: bool


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    subcategory_count: int = 0
    question_count: int = 0


class SubcategoryBase(BaseModel):
    category_id: int
    name: str = Field(min_length=3, max_length=120)
    description: str | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class SubcategoryCreate(SubcategoryBase):
    pass


class SubcategoryUpdate(SubcategoryBase):
    pass


class SubcategoryStatusUpdate(BaseModel):
    is_active: bool


class SubcategoryRead(SubcategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    created_at: datetime
    category_name: str
    question_count: int = 0


class QuestionOptionWrite(BaseModel):
    option_text: str = Field(min_length=1, max_length=500)

    @field_validator("option_text")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return value.strip()


class QuestionOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    option_text: str
    option_order: int


class QuestionBase(BaseModel):
    category_id: int
    subcategory_id: int
    excel_exercise_id: int | None = None
    difficulty: str
    question_type: str
    statement: str = Field(min_length=10)
    correct_answer: str = Field(min_length=1)
    feedback: str | None = None
    max_time_seconds: int = Field(gt=0)
    score: float = Field(gt=0)
    options: list[QuestionOptionWrite]

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, value: str) -> str:
        normalized_value = value.strip().lower()
        if normalized_value not in ALLOWED_DIFFICULTIES:
            raise ValueError("La dificultad no es valida.")
        return normalized_value

    @field_validator("question_type")
    @classmethod
    def validate_question_type(cls, value: str) -> str:
        normalized_value = value.strip().lower()
        if normalized_value not in ALLOWED_QUESTION_TYPES:
            raise ValueError("El tipo de pregunta no es valido.")
        return normalized_value

    @field_validator("statement", "correct_answer", "feedback")
    @classmethod
    def normalize_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.strip()


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(QuestionBase):
    pass


class QuestionStatusUpdate(BaseModel):
    is_active: bool


class QuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    category_name: str
    subcategory_id: int
    subcategory_name: str
    excel_exercise_id: int | None
    excel_exercise_name: str | None
    difficulty: str
    question_type: str
    statement: str
    correct_answer: str
    feedback: str | None
    max_time_seconds: int
    score: float
    is_active: bool
    created_at: datetime
    options: list[QuestionOptionRead]


class QuestionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    category_name: str
    subcategory_id: int
    subcategory_name: str
    excel_exercise_id: int | None
    excel_exercise_name: str | None
    difficulty: str
    question_type: str
    statement: str
    max_time_seconds: int
    score: float
    is_active: bool
    option_count: int
    created_at: datetime


class QuestionImportRowError(BaseModel):
    row_number: int
    message: str


class QuestionImportSummary(BaseModel):
    created_categories: int
    created_subcategories: int
    created_questions: int
    errors: list[QuestionImportRowError] = []
