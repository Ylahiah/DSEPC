from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.admin_dashboard import (
    AdminDashboardCleanupRead,
    AdminDashboardRead,
    DashboardRankingItemRead,
)
from app.services.admin_dashboard_service import AdminDashboardService


router = APIRouter()


@router.get("", response_model=AdminDashboardRead)
def get_admin_dashboard_summary(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminDashboardRead:
    return AdminDashboardService(db).get_dashboard_summary()


@router.get("/candidates", response_model=list[DashboardRankingItemRead])
def get_all_candidates_ranking(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[DashboardRankingItemRead]:
    return AdminDashboardService(db).get_all_candidates_ranking()


@router.get("/candidates/excel")
def download_candidates_excel(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = AdminDashboardService(db).build_candidates_excel()
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/cleanup-test-data", response_model=AdminDashboardCleanupRead)
def cleanup_test_data(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminDashboardCleanupRead:
    return AdminDashboardService(db).cleanup_test_data()
