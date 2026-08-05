from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.admin_reports import AdminReportsSummaryRead
from app.services.admin_reports_service import AdminReportsService


router = APIRouter()


@router.get("/summary", response_model=AdminReportsSummaryRead)
def get_admin_reports_summary(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminReportsSummaryRead:
    return AdminReportsService(db).get_reports_summary()


@router.get("/general.xlsx")
def download_general_excel_report(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = AdminReportsService(db).build_general_excel()
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/general.pdf")
def download_general_pdf_report(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = AdminReportsService(db).build_general_pdf()
    return StreamingResponse(
        file_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sessions/{session_id}.xlsx")
def download_session_excel_report(
    session_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = AdminReportsService(db).build_session_excel(session_id)
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/sessions/{session_id}.pdf")
def download_session_pdf_report(
    session_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = AdminReportsService(db).build_session_pdf(session_id)
    return StreamingResponse(
        file_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
