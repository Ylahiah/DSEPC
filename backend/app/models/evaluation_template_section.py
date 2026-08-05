from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class EvaluationTemplateSection(Base):
    __tablename__ = "evaluation_template_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    evaluation_template_id: Mapped[int] = mapped_column(
        ForeignKey("evaluation_templates.id"),
        index=True,
    )
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    subcategory_id: Mapped[int | None] = mapped_column(
        ForeignKey("subcategories.id"),
        nullable=True,
        index=True,
    )
    difficulty: Mapped[str | None] = mapped_column(String(30), nullable=True)
    question_count: Mapped[int] = mapped_column(Integer, default=1)
    time_limit_seconds: Mapped[int] = mapped_column(Integer, default=60)
    weight_override: Mapped[float | None] = mapped_column(Float, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=1)

    evaluation_template = relationship("EvaluationTemplate", back_populates="sections")
    category = relationship("Category")
    subcategory = relationship("Subcategory")
