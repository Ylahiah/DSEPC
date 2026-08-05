from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EvaluationSessionSection(Base):
    __tablename__ = "evaluation_session_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evaluation_session_id: Mapped[int] = mapped_column(
        ForeignKey("evaluation_sessions.id"),
        index=True,
    )
    template_section_id: Mapped[int] = mapped_column(
        ForeignKey("evaluation_template_sections.id"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(150))
    sort_order: Mapped[int] = mapped_column(Integer, default=1)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=60)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consumed_time_seconds: Mapped[int] = mapped_column(Integer, default=0)

    evaluation_session = relationship("EvaluationSession", back_populates="sections")
    template_section = relationship("EvaluationTemplateSection")
    questions = relationship(
        "EvaluationSessionQuestion",
        back_populates="evaluation_session_section",
        cascade="all, delete-orphan",
        order_by="EvaluationSessionQuestion.sort_order",
    )
