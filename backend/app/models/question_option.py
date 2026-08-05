from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    option_text: Mapped[str] = mapped_column(Text)
    option_order: Mapped[int] = mapped_column(Integer, default=1)

    question = relationship("Question", back_populates="options")
