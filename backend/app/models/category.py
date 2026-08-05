from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    subcategories = relationship(
        "Subcategory",
        back_populates="category",
        cascade="all, delete-orphan",
    )
    questions = relationship("Question", back_populates="category")
