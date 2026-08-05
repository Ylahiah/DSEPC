from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.candidate import (
    AccessCodeCreate,
    AccessCodeRead,
    AccessCodeStatusUpdate,
    AccessCodeUpdate,
)
from app.services.candidate_access_service import CandidateAccessService


router = APIRouter()


@router.get("", response_model=list[AccessCodeRead])
def list_access_codes(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AccessCodeRead]:
    return CandidateAccessService(db).list_access_codes()


@router.post("", response_model=AccessCodeRead)
def create_access_code(
    payload: AccessCodeCreate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AccessCodeRead:
    return CandidateAccessService(db).create_access_code(payload)


@router.put("/{access_code_id}", response_model=AccessCodeRead)
def update_access_code(
    access_code_id: int,
    payload: AccessCodeUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AccessCodeRead:
    return CandidateAccessService(db).update_access_code(access_code_id, payload)


@router.patch("/{access_code_id}/status", response_model=AccessCodeRead)
def set_access_code_status(
    access_code_id: int,
    payload: AccessCodeStatusUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> AccessCodeRead:
    return CandidateAccessService(db).set_access_code_status(access_code_id, payload.is_active)


@router.delete("/{access_code_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_access_code(
    access_code_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    CandidateAccessService(db).delete_access_code(access_code_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
