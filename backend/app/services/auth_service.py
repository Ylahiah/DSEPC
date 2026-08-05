from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import TokenResponse, UserRead


class AuthService:
    def __init__(self, db: Session) -> None:
        self.user_repository = UserRepository(db)

    def authenticate_admin(self, username: str, password: str) -> TokenResponse:
        user = self.user_repository.get_by_username(username)

        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales invalidas.",
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El usuario se encuentra inactivo.",
            )

        if user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo los administradores pueden iniciar sesion aqui.",
            )

        token = create_access_token(subject=user.username)
        return TokenResponse(access_token=token, user=UserRead.model_validate(user))

    @staticmethod
    def get_current_user_profile(user: User) -> UserRead:
        return UserRead.model_validate(user)
