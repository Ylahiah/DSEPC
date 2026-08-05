from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EvaluationSession(Base):
    __tablename__ = "evaluation_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    access_code_id: Mapped[int] = mapped_column(ForeignKey("candidate_access_codes.id"), index=True)
    evaluation_template_id: Mapped[int] = mapped_column(
        ForeignKey("evaluation_templates.id"),
        index=True,
    )
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    total_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    consumed_time_seconds: Mapped[int] = mapped_column(Integer, default=0)
    completed_by_timeout: Mapped[bool] = mapped_column(Boolean, default=False)
    answered_questions_count: Mapped[int] = mapped_column(Integer, default=0)
    omitted_questions_count: Mapped[int] = mapped_column(Integer, default=0)
    current_section_index: Mapped[int] = mapped_column(Integer, default=0)
    current_question_index: Mapped[int] = mapped_column(Integer, default=0)
    total_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    access_code = relationship("CandidateAccessCode")
    evaluation_template = relationship("EvaluationTemplate", back_populates="sessions")
    candidate = relationship("Candidate", back_populates="sessions")
    sections = relationship(
        "EvaluationSessionSection",
        back_populates="evaluation_session",
        cascade="all, delete-orphan",
        order_by="EvaluationSessionSection.sort_order",
    )
