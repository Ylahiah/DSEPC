from pydantic import BaseModel, ConfigDict, Field


class SystemSettingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_name: str
    welcome_message: str
    primary_color: str
    logo_filename: str | None


class SystemSettingUpdate(BaseModel):
    company_name: str = Field(min_length=1, max_length=150)
    welcome_message: str = Field(min_length=1)
    primary_color: str = Field(min_length=7, max_length=7)
