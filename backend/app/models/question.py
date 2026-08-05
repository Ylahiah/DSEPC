from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    subcategory_id: Mapped[int] = mapped_column(ForeignKey("subcategories.id"), index=True)
    excel_exercise_id: Mapped[int | None] = mapped_column(
        ForeignKey("excel_exercises.id"),
        nullable=True,
        index=True,
    )
    difficulty: Mapped[str] = mapped_column(String(30), default="basic")
    question_type: Mapped[str] = mapped_column(String(30), default="multiple_choice")
    statement: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_time_seconds: Mapped[int] = mapped_column(Integer, default=60)
    score: Mapped[float] = mapped_column(Float, default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    category = relationship("Category", back_populates="questions")
    subcategory = relationship("Subcategory", back_populates="questions")
    excel_exercise = relationship("ExcelExercise")
    options = relationship(
        "QuestionOption",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="QuestionOption.option_order",
    )
