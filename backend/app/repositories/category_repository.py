from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category


class CategoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[Category]:
        statement = select(Category).order_by(Category.name.asc())
        return list(self.db.scalars(statement).all())

    def get_by_id(self, category_id: int) -> Category | None:
        statement = select(Category).where(Category.id == category_id)
        return self.db.scalar(statement)

    def get_by_name(self, name: str) -> Category | None:
        statement = select(Category).where(func.lower(Category.name) == name.strip().lower())
        return self.db.scalar(statement)

    def get_by_code(self, code: str) -> Category | None:
        statement = select(Category).where(func.upper(Category.code) == code.strip().upper())
        return self.db.scalar(statement)

    def add(self, category: Category) -> Category:
        self.db.add(category)
        self.db.commit()
        self.db.refresh(category)
        return category

    def commit(self) -> None:
        self.db.commit()
