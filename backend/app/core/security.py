from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str:
    settings = get_settings()

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        subject = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar el token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return subject


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    username = decode_access_token(token)
    user = UserRepository(db).get_by_username(username)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no disponible.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No cuentas con permisos para esta accion.",
        )

    return current_user
