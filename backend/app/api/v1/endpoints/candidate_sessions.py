from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.candidate_session import (
    CandidateAnswerUpsertRequest,
    CandidateSessionCompletionResponse,
    CandidateSessionHeartbeatRequest,
    CandidateSessionProgressRead,
    CandidateSessionRead,
    CandidateSessionResultSummaryRead,
    CandidateSessionStartRequest,
)
from app.services.candidate_session_service import CandidateSessionService
from fastapi import File, Form, UploadFile
from fastapi.responses import StreamingResponse


router = APIRouter()


@router.post("/start", response_model=CandidateSessionRead)
def start_candidate_session(
    payload: CandidateSessionStartRequest,
    db: Annotated[Session, Depends(get_db)],
) -> CandidateSessionRead:
    return CandidateSessionService(db).start_session(payload)


@router.get("/{session_id}", response_model=CandidateSessionRead)
def get_candidate_session(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> CandidateSessionRead:
    return CandidateSessionService(db).get_session(session_id)


@router.post("/{session_id}/answers", response_model=CandidateSessionProgressRead)
def save_candidate_answer(
    session_id: int,
    payload: CandidateAnswerUpsertRequest,
    db: Annotated[Session, Depends(get_db)],
) -> CandidateSessionProgressRead:
    return CandidateSessionService(db).save_answer(session_id, payload)


@router.post("/{session_id}/heartbeat", response_model=CandidateSessionProgressRead)
def track_candidate_progress(
    session_id: int,
    payload: CandidateSessionHeartbeatRequest,
    db: Annotated[Session, Depends(get_db)],
) -> CandidateSessionProgressRead:
    return CandidateSessionService(db).heartbeat(session_id, payload)


@router.post("/{session_id}/complete", response_model=CandidateSessionCompletionResponse)
def complete_candidate_session(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> CandidateSessionCompletionResponse:
    return CandidateSessionService(db).complete_session(session_id)


@router.get("/{session_id}/result-summary", response_model=CandidateSessionResultSummaryRead)
def get_candidate_result_summary(
    session_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> CandidateSessionResultSummaryRead:
    return CandidateSessionService(db).get_result_summary(session_id)


@router.get("/{session_id}/questions/{question_id}/excel-download")
def download_candidate_excel_exercise(
    session_id: int,
    question_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = CandidateSessionService(db).download_excel_exercise(
        session_id=session_id,
        session_question_id=question_id,
    )
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



@router.post(
    "/{session_id}/questions/{question_id}/excel-submission",
    response_model=CandidateSessionProgressRead,
)
def submit_candidate_excel_exercise(
    session_id: int,
    question_id: int,
    workbook: Annotated[UploadFile, File(...)],
    time_spent_seconds: Annotated[int, Form(...)],
    current_section_index: Annotated[int, Form(...)],
    current_question_index: Annotated[int, Form(...)],
    db: Annotated[Session, Depends(get_db)],
) -> CandidateSessionProgressRead:
    return CandidateSessionService(db).submit_excel_exercise(
        session_id=session_id,
        session_question_id=question_id,
        workbook=workbook,
        time_spent_seconds=time_spent_seconds,
        current_section_index=current_section_index,
        current_question_index=current_question_index,
    )
