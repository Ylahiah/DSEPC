from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Subcategory(Base):
    __tablename__ = "subcategories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    category = relationship("Category", back_populates="subcategories")
    questions = relationship("Question", back_populates="subcategory")
