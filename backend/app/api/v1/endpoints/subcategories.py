from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.question_bank import (
    SubcategoryCreate,
    SubcategoryRead,
    SubcategoryStatusUpdate,
    SubcategoryUpdate,
)
from app.services.question_bank_service import QuestionBankService


router = APIRouter()


@router.get("", response_model=list[SubcategoryRead])
def list_subcategories(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SubcategoryRead]:
    return QuestionBankService(db).list_subcategories()


@router.post("", response_model=SubcategoryRead)
def create_subcategory(
    payload: SubcategoryCreate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SubcategoryRead:
    return QuestionBankService(db).create_subcategory(payload)


@router.put("/{subcategory_id}", response_model=SubcategoryRead)
def update_subcategory(
    subcategory_id: int,
    payload: SubcategoryUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SubcategoryRead:
    return QuestionBankService(db).update_subcategory(subcategory_id, payload)


@router.patch("/{subcategory_id}/status", response_model=SubcategoryRead)
def set_subcategory_status(
    subcategory_id: int,
    payload: SubcategoryStatusUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SubcategoryRead:
    return QuestionBankService(db).set_subcategory_status(
        subcategory_id,
        payload.is_active,
    )


@router.delete("/{subcategory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subcategory(
    subcategory_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    QuestionBankService(db).delete_subcategory(subcategory_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
