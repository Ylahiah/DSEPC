from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.admin_reports import (
    AdminReportsSummaryRead,
    ReportSessionDetailRead,
    SessionAssistanceUpdateRequest,
)
from app.services.admin_reports_service import AdminReportsService


router = APIRouter()


@router.get("/summary", response_model=AdminReportsSummaryRead)
def get_admin_reports_summary(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminReportsSummaryRead:
    return AdminReportsService(db).get_reports_summary()


@router.get("/sessions/{session_id}/detail", response_model=ReportSessionDetailRead)
def get_session_detail(
    session_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> ReportSessionDetailRead:
    return AdminReportsService(db).get_session_detail(session_id)


@router.post("/sessions/{session_id}/assistance", response_model=ReportSessionDetailRead)
def update_session_assistance(
    session_id: int,
    payload: SessionAssistanceUpdateRequest,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> ReportSessionDetailRead:
    return AdminReportsService(db).update_session_assistance(
        session_id=session_id,
        assistance_level=payload.assistance_level,
        assistance_notes=payload.assistance_notes,
    )


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    return AdminReportsService(db).delete_session(session_id)


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


@router.get("/sessions/{session_id}/submissions/{session_question_id}")
def download_candidate_excel_submission(
    session_id: int,
    session_question_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = AdminReportsService(db).get_candidate_excel_submission(
        session_id=session_id,
        session_question_id=session_question_id,
    )
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

