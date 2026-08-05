from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_SQLITE_PATH = BASE_DIR / "dsepc.db"


class Settings(BaseSettings):
    app_name: str = "DSEPC API"
    api_v1_prefix: str = "/api/v1"
    debug: bool = True
    secret_key: str = "change-this-super-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    database_url: str = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
    frontend_origin: str = "http://127.0.0.1:5173"
    default_admin_username: str = "admin"
    default_admin_password: str = "Admin12345"
    default_admin_email: str = "admin@dsepc.mx"
    default_admin_full_name: str = "Administrador General"
    default_candidate_access_code: str = "EVAL-2026-DEMO"
    excel_exercise_storage_dir: Path = BASE_DIR / "storage" / "excel_exercises"
    excel_submission_storage_dir: Path = BASE_DIR / "storage" / "excel_submissions"

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
