from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EvaluationTemplate(Base):
    __tablename__ = "evaluation_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    passing_score_percentage: Mapped[float] = mapped_column(default=80.0)
    show_result_to_candidate: Mapped[bool] = mapped_column(Boolean, default=False)
    randomize_question_order: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    sections = relationship(
        "EvaluationTemplateSection",
        back_populates="evaluation_template",
        cascade="all, delete-orphan",
        order_by="EvaluationTemplateSection.sort_order",
    )
    access_codes = relationship("CandidateAccessCode")
    sessions = relationship("EvaluationSession", back_populates="evaluation_template")
