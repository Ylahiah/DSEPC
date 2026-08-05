from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

class ExcelExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    instructions: str | None
    workbook_filename: str
    solution_filename: str | None
    source_sheet_name: str
    task_sheet_name: str
    target_cells_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ExcelExerciseStatusUpdate(BaseModel):
    is_active: bool


class ExcelExerciseForm(BaseModel):
    name: str = Field(min_length=3, max_length=180)
    description: str | None = None
    instructions: str | None = None
    source_sheet_name: str = Field(min_length=1, max_length=120)
    task_sheet_name: str = Field(min_length=1, max_length=120)
    is_active: bool = True

    @field_validator("name", "description", "instructions", "source_sheet_name", "task_sheet_name")
    @classmethod
    def normalize_text(cls, value: str | None) -> str | None:
        if value is None:
            return value
        return value.strip()
