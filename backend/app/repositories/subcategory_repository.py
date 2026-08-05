from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.subcategory import Subcategory


class SubcategoryRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[Subcategory]:
        statement = select(Subcategory).order_by(Subcategory.name.asc())
        return list(self.db.scalars(statement).all())

    def get_by_id(self, subcategory_id: int) -> Subcategory | None:
        statement = select(Subcategory).where(Subcategory.id == subcategory_id)
        return self.db.scalar(statement)

    def get_by_name_in_category(self, *, category_id: int, name: str) -> Subcategory | None:
        statement = select(Subcategory).where(
            Subcategory.category_id == category_id,
            func.lower(Subcategory.name) == name.strip().lower(),
        )
        return self.db.scalar(statement)

    def add(self, subcategory: Subcategory) -> Subcategory:
        self.db.add(subcategory)
        self.db.commit()
        self.db.refresh(subcategory)
        return subcategory

    def commit(self) -> None:
        self.db.commit()
