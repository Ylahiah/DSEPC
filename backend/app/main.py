from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from sqlalchemy import inspect, text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.base import CandidateAccessCode, EvaluationTemplate, User
from app.db.session import SessionLocal, engine
from app.models.base import Base


settings = get_settings()


def apply_schema_upgrades() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    schema_updates = {
        "candidate_access_codes": {
            "evaluation_template_id": "INTEGER",
        },
        "evaluation_sessions": {
            "total_time_seconds": "INTEGER DEFAULT 0",
            "consumed_time_seconds": "INTEGER DEFAULT 0",
            "completed_by_timeout": "BOOLEAN DEFAULT 0",
            "answered_questions_count": "INTEGER DEFAULT 0",
            "omitted_questions_count": "INTEGER DEFAULT 0",
        },
        "evaluation_session_sections": {
            "started_at": "DATETIME",
            "completed_at": "DATETIME",
            "consumed_time_seconds": "INTEGER DEFAULT 0",
        },
        "evaluation_session_questions": {
            "started_at": "DATETIME",
            "first_answered_at": "DATETIME",
            "last_answered_at": "DATETIME",
            "time_spent_seconds": "INTEGER DEFAULT 0",
            "was_omitted": "BOOLEAN DEFAULT 0",
            "practical_submission_filename": "TEXT",
            "practical_submission_path": "TEXT",
            "practical_feedback": "TEXT",
        },
        "questions": {
            "excel_exercise_id": "INTEGER",
        },
        "excel_exercises": {
            "solution_filename": "VARCHAR(255)",
            "solution_storage_path": "VARCHAR(500)",
        },
    }

    with engine.begin() as connection:
        for table_name, columns in schema_updates.items():
            if table_name not in table_names:
                continue

            existing_columns = {
                column["name"] for column in inspector.get_columns(table_name)
            }
            for column_name, column_definition in columns.items():
                if column_name in existing_columns:
                    continue

                connection.execute(
                    text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
                    )
                )


def seed_initial_data() -> None:
    db = SessionLocal()
    try:
        default_template = (
            db.query(EvaluationTemplate)
            .filter(EvaluationTemplate.is_active.is_(True))
            .order_by(EvaluationTemplate.id.asc())
            .first()
        )
        admin = db.query(User).filter(User.username == settings.default_admin_username).first()
        if not admin:
            db.add(
                User(
                    username=settings.default_admin_username,
                    full_name=settings.default_admin_full_name,
                    email=settings.default_admin_email,
                    hashed_password=get_password_hash(settings.default_admin_password),
                    role="admin",
                    is_active=True,
                )
            )
        else:
            admin.full_name = settings.default_admin_full_name
            admin.email = settings.default_admin_email
            admin.role = "admin"
            admin.is_active = True

        access_code = (
            db.query(CandidateAccessCode)
            .filter(CandidateAccessCode.code == settings.default_candidate_access_code)
            .first()
        )
        if not access_code:
            db.add(
                CandidateAccessCode(
                    code=settings.default_candidate_access_code,
                    evaluation_template_id=default_template.id if default_template else None,
                    is_active=True,
                )
            )
        else:
            if default_template and access_code.evaluation_template_id is None:
                access_code.evaluation_template_id = default_template.id
            access_code.is_active = True

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    apply_schema_upgrades()
    seed_initial_data()
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    with open("error.log", "a", encoding="utf-8") as f:
        f.write(f"\\n{'='*50}\\n")
        f.write(f"Error handling request: {request.method} {request.url}\\n")
        traceback.print_exc(file=f)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Revise error.log en backend."}
    )
