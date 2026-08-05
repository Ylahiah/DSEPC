from typing import Annotated

from fastapi import APIRouter, Depends
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.candidate import (
    CandidateAccessCodeValidationRequest,
    CandidateAccessCodeValidationResponse,
)
from app.services.candidate_access_service import CandidateAccessService


router = APIRouter()


@router.post("/validate", response_model=CandidateAccessCodeValidationResponse)
def validate_access_code(
    payload: CandidateAccessCodeValidationRequest,
    db: Annotated[Session, Depends(get_db)],
) -> CandidateAccessCodeValidationResponse:
    return CandidateAccessService(db).validate_code(payload.code)

@router.get("/active", response_model=list[str])
def get_active_access_codes(
    db: Annotated[Session, Depends(get_db)],
) -> list[str]:
    return CandidateAccessService(db).list_active_codes()
