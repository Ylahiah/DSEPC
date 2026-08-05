from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserRead
from app.services.auth_service import AuthService


router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    return AuthService(db).authenticate_admin(
        username=form_data.username,
        password=form_data.password,
    )


@router.get("/me", response_model=UserRead)
def read_current_user(
    current_user: Annotated[User, Depends(get_current_admin)],
) -> UserRead:
    return AuthService.get_current_user_profile(current_user)
