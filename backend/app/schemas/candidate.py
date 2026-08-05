from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class CandidateAccessCodeValidationRequest(BaseModel):
    code: str = Field(min_length=6, max_length=32)


class CandidateAccessCodeValidationResponse(BaseModel):
    valid: bool
    message: str
    template_name: str | None = None
    show_result_to_candidate: bool | None = None


class AccessCodeStatusUpdate(BaseModel):
    is_active: bool


class AccessCodeCreate(BaseModel):
    code: str = Field(min_length=6, max_length=50)
    evaluation_template_id: int | None = None
    expires_at: datetime | None = None
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class AccessCodeUpdate(BaseModel):
    code: str = Field(min_length=6, max_length=50)
    evaluation_template_id: int | None = None
    expires_at: datetime | None = None
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class AccessCodeRead(BaseModel):
    id: int
    code: str
    evaluation_template_id: int | None
    evaluation_template_name: str | None
    template_is_active: bool | None
    template_is_valid: bool | None
    template_validation_message: str | None
    expires_at: datetime | None
    is_active: bool
    created_at: datetime
