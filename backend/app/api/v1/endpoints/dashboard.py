from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.admin_dashboard import AdminDashboardCleanupRead, AdminDashboardRead
from app.services.admin_dashboard_service import AdminDashboardService


router = APIRouter()


@router.get("", response_model=AdminDashboardRead)
def get_admin_dashboard_summary(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminDashboardRead:
    return AdminDashboardService(db).get_dashboard_summary()


@router.post("/cleanup-test-data", response_model=AdminDashboardCleanupRead)
def cleanup_test_data(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminDashboardCleanupRead:
    return AdminDashboardService(db).cleanup_test_data()
