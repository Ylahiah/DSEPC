from pydantic import BaseModel, ConfigDict, EmailStr


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    email: EmailStr
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
