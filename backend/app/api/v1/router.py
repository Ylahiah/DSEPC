from fastapi import APIRouter

from app.api.v1.endpoints import (
    access_codes,
    auth,
    candidate_access,
    candidate_sessions,
    categories,
    dashboard,
    excel_exercises,
    evaluation_templates,
    health,
    questions,
    reports,
    subcategories,
)


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(access_codes.router, prefix="/access-codes", tags=["access-codes"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(
    excel_exercises.router,
    prefix="/excel-exercises",
    tags=["excel-exercises"],
)
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(
    subcategories.router,
    prefix="/subcategories",
    tags=["subcategories"],
)
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(
    evaluation_templates.router,
    prefix="/evaluation-templates",
    tags=["evaluation-templates"],
)
api_router.include_router(
    candidate_access.router,
    prefix="/candidate/access-code",
    tags=["candidate-access"],
)
api_router.include_router(
    candidate_sessions.router,
    prefix="/candidate/sessions",
    tags=["candidate-sessions"],
)
