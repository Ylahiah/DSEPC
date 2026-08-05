from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_username(self, username: str) -> User | None:
        statement = select(User).where(User.username == username)
        return self.db.scalar(statement)

    def create(
        self,
        *,
        username: str,
        full_name: str,
        email: str,
        hashed_password: str,
        role: str = "admin",
    ) -> User:
        user = User(
            username=username,
            full_name=full_name,
            email=email,
            hashed_password=hashed_password,
            role=role,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
