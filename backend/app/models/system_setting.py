from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_name: Mapped[str] = mapped_column(String(150), default="DSEPC")
    welcome_message: Mapped[str] = mapped_column(Text, default="Plataforma de evaluacion de candidatos")
    primary_color: Mapped[str] = mapped_column(String(7), default="#0f172a")
    logo_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
