from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.question_bank import (
    CategoryCreate,
    CategoryRead,
    CategoryStatusUpdate,
    CategoryUpdate,
)
from app.services.question_bank_service import QuestionBankService


router = APIRouter()


@router.get("", response_model=list[CategoryRead])
def list_categories(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[CategoryRead]:
    return QuestionBankService(db).list_categories()


@router.post("", response_model=CategoryRead)
def create_category(
    payload: CategoryCreate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> CategoryRead:
    return QuestionBankService(db).create_category(payload)


@router.put("/{category_id}", response_model=CategoryRead)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> CategoryRead:
    return QuestionBankService(db).update_category(category_id, payload)


@router.patch("/{category_id}/status", response_model=CategoryRead)
def set_category_status(
    category_id: int,
    payload: CategoryStatusUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> CategoryRead:
    return QuestionBankService(db).set_category_status(category_id, payload.is_active)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    QuestionBankService(db).delete_category(category_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
