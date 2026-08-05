from datetime import datetime, timezone

# pyrefly: ignore [missing-import]
from sqlalchemy import Boolean, DateTime, Integer, String, Text
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ExcelExercise(Base):
    __tablename__ = "excel_exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    workbook_filename: Mapped[str] = mapped_column(String(255))
    workbook_storage_path: Mapped[str] = mapped_column(String(500))
    solution_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    solution_storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_sheet_name: Mapped[str] = mapped_column(String(120), default="BaseDatos")
    task_sheet_name: Mapped[str] = mapped_column(String(120), default="RealizaEjercicio")
    expected_summary_json: Mapped[str] = mapped_column(Text)
    pivot_table_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
