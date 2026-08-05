from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100), index=True)
    last_name: Mapped[str] = mapped_column(String(100), index=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    employee_reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    sessions = relationship("EvaluationSession", back_populates="candidate")
