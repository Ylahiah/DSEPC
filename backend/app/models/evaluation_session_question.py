from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EvaluationSessionQuestion(Base):
    __tablename__ = "evaluation_session_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evaluation_session_section_id: Mapped[int] = mapped_column(
        ForeignKey("evaluation_session_sections.id"),
        index=True,
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=1)
    selected_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_answered: Mapped[bool] = mapped_column(Boolean, default=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0)
    was_omitted: Mapped[bool] = mapped_column(Boolean, default=False)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    practical_submission_filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    practical_submission_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    practical_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    evaluation_session_section = relationship(
        "EvaluationSessionSection",
        back_populates="questions",
    )
    question = relationship("Question")
