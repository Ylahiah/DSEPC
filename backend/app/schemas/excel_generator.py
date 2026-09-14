from typing import Any
from pydantic import BaseModel, Field


class BlueprintParameterOption(BaseModel):
    id: str
    label: str
    description: str | None = None


class BlueprintRead(BaseModel):
    id: str
    title: str
    description: str
    category: str
    difficulty: str  # basic, intermediate, advanced
    skills_tested: list[str]
    supported_industries: list[BlueprintParameterOption]
    default_rows: int = 150
    icon: str  # Lucide icon identifier


class GenerateExerciseRequest(BaseModel):
    blueprint_id: str
    title: str = Field(..., min_length=3, max_length=180)
    description: str | None = None
    industry_id: str = "pharma"
    difficulty: str = "intermediate"
    row_count: int = Field(150, ge=30, le=1000)
    save_to_question_bank: bool = False
    category_id: int | None = None
    subcategory_id: int | None = None
    assign_to_template_id: int | None = None
    template_section_mode: str | None = "new_section"  # new_section, existing_section
    target_section_id: int | None = None
    section_time_limit_seconds: int | None = None
    section_weight: float | None = None


class GeneratedExerciseSummaryRead(BaseModel):
    exercise_id: int | None = None
    question_id: int | None = None
    name: str
    blueprint_id: str
    industry: str
    difficulty: str
    row_count: int
    source_sheet_name: str
    task_sheet_name: str
    instructions: str
    criteria_count: int
    total_target_cells: int
    sample_metrics: dict[str, Any]
    category_id: int | None = None
    category_name: str | None = None
    subcategory_id: int | None = None
    subcategory_name: str | None = None
    template_id: int | None = None
    template_name: str | None = None
    assigned_to_template: bool = False


class AssignExerciseToTemplateRequest(BaseModel):
    question_id: int
    template_id: int
    mode: str = "new_section"  # new_section or existing_section
    section_id: int | None = None
    time_limit_seconds: int = 900
    weight_override: float | None = None


class AssignExerciseToTemplateResponse(BaseModel):
    success: bool
    message: str
    template_id: int
    template_name: str
    section_id: int
