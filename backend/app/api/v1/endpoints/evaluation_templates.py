from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.evaluation_template import (
    EvaluationTemplateCreate,
    EvaluationTemplateListItem,
    EvaluationTemplatePreviewResponse,
    EvaluationTemplateRead,
    EvaluationTemplateStatusUpdate,
    EvaluationTemplateUpdate,
)
from app.services.evaluation_template_service import EvaluationTemplateService


router = APIRouter()


@router.get("", response_model=list[EvaluationTemplateListItem])
def list_templates(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[EvaluationTemplateListItem]:
    return EvaluationTemplateService(db).list_templates()


@router.get("/{template_id}", response_model=EvaluationTemplateRead)
def get_template(
    template_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> EvaluationTemplateRead:
    return EvaluationTemplateService(db).get_template(template_id)


@router.post("", response_model=EvaluationTemplateRead)
def create_template(
    payload: EvaluationTemplateCreate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> EvaluationTemplateRead:
    return EvaluationTemplateService(db).create_template(payload)


@router.put("/{template_id}", response_model=EvaluationTemplateRead)
def update_template(
    template_id: int,
    payload: EvaluationTemplateUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> EvaluationTemplateRead:
    return EvaluationTemplateService(db).update_template(template_id, payload)


@router.patch("/{template_id}/status", response_model=EvaluationTemplateRead)
def set_template_status(
    template_id: int,
    payload: EvaluationTemplateStatusUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> EvaluationTemplateRead:
    return EvaluationTemplateService(db).set_template_status(template_id, payload)


@router.post("/{template_id}/preview", response_model=EvaluationTemplatePreviewResponse)
def preview_template(
    template_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> EvaluationTemplatePreviewResponse:
    return EvaluationTemplateService(db).preview_template(template_id)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    EvaluationTemplateService(db).delete_template(template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
