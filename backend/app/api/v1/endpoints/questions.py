from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.question_bank import (
    QuestionCreate,
    QuestionImportSummary,
    QuestionListItem,
    QuestionRead,
    QuestionStatusUpdate,
    QuestionUpdate,
)
from app.services.question_bank_service import QuestionBankService


router = APIRouter()


@router.get("", response_model=list[QuestionListItem])
def list_questions(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    category_id: int | None = Query(default=None),
    subcategory_id: int | None = Query(default=None),
    difficulty: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    search: str | None = Query(default=None),
) -> list[QuestionListItem]:
    return QuestionBankService(db).list_questions(
        category_id=category_id,
        subcategory_id=subcategory_id,
        difficulty=difficulty,
        is_active=is_active,
        search=search,
    )


@router.get("/import-template")
def download_question_import_template(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer = QuestionBankService(db).build_question_import_template()
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="plantilla_preguntas_dsepc.xlsx"'},
    )


@router.post("/import", response_model=QuestionImportSummary)
def import_questions(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
) -> QuestionImportSummary:
    return QuestionBankService(db).import_questions_from_excel(file)


@router.get("/{question_id}", response_model=QuestionRead)
def get_question(
    question_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> QuestionRead:
    return QuestionBankService(db).get_question(question_id)


@router.post("", response_model=QuestionRead)
def create_question(
    payload: QuestionCreate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> QuestionRead:
    return QuestionBankService(db).create_question(payload)


@router.put("/{question_id}", response_model=QuestionRead)
def update_question(
    question_id: int,
    payload: QuestionUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> QuestionRead:
    return QuestionBankService(db).update_question(question_id, payload)


@router.patch("/{question_id}/status", response_model=QuestionRead)
def set_question_status(
    question_id: int,
    payload: QuestionStatusUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> QuestionRead:
    return QuestionBankService(db).set_question_status(question_id, payload.is_active)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    QuestionBankService(db).delete_question(question_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
