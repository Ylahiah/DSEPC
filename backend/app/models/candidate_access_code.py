from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class CandidateAccessCode(Base):
    __tablename__ = "candidate_access_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    evaluation_template_id: Mapped[int | None] = mapped_column(
        ForeignKey("evaluation_templates.id"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    evaluation_template = relationship("EvaluationTemplate", back_populates="access_codes")
