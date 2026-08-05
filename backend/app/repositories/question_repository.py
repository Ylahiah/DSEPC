from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.question import Question


class QuestionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[Question]:
        statement = (
            select(Question)
            .options(
                selectinload(Question.options),
                selectinload(Question.category),
                selectinload(Question.subcategory),
                selectinload(Question.excel_exercise),
            )
            .order_by(Question.created_at.desc())
        )
        return list(self.db.scalars(statement).all())

    def get_by_id(self, question_id: int) -> Question | None:
        statement = (
            select(Question)
            .where(Question.id == question_id)
            .options(
                selectinload(Question.options),
                selectinload(Question.category),
                selectinload(Question.subcategory),
                selectinload(Question.excel_exercise),
            )
        )
        return self.db.scalar(statement)

    def add(self, question: Question) -> Question:
        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)
        return question

    def commit(self) -> None:
        self.db.commit()
