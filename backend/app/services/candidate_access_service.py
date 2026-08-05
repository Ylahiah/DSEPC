from datetime import datetime, timezone

from fastapi import HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy import func, select
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from app.models.candidate_access_code import CandidateAccessCode
from app.models.evaluation_session import EvaluationSession
from app.repositories.candidate_access_code_repository import (
    CandidateAccessCodeRepository,
)
from app.schemas.candidate import (
    AccessCodeCreate,
    AccessCodeRead,
    AccessCodeUpdate,
    CandidateAccessCodeValidationResponse,
)
from app.services.evaluation_template_service import EvaluationTemplateService


class CandidateAccessService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = CandidateAccessCodeRepository(db)
        self.template_service = EvaluationTemplateService(db)

    def validate_code(self, code: str) -> CandidateAccessCodeValidationResponse:
        access_code = self.repository.get_by_code(code.strip().upper())

        if not access_code:
            return CandidateAccessCodeValidationResponse(
                valid=False,
                message="El codigo no existe o no esta asignado a una evaluacion activa.",
            )

        if not access_code.is_active:
            return CandidateAccessCodeValidationResponse(
                valid=False,
                message="El codigo se encuentra inactivo. Solicita uno nuevo al administrador.",
            )

        expires_at = access_code.expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at and expires_at < datetime.now(timezone.utc):
            return CandidateAccessCodeValidationResponse(
                valid=False,
                message="El codigo ha expirado. Solicita un nuevo acceso.",
            )

        if not access_code.evaluation_template or not access_code.evaluation_template.is_active:
            return CandidateAccessCodeValidationResponse(
                valid=False,
                message="El codigo no esta vinculado a una plantilla activa.",
            )

        template_preview = self.template_service.preview_template(
            access_code.evaluation_template.id
        )
        if not template_preview.is_valid:
            return CandidateAccessCodeValidationResponse(
                valid=False,
                message="La plantilla asociada al codigo requiere ajustes antes de poder aplicarse.",
                template_name=access_code.evaluation_template.name,
                show_result_to_candidate=access_code.evaluation_template.show_result_to_candidate,
            )

        return CandidateAccessCodeValidationResponse(
            valid=True,
            message="Codigo valido. Ya puedes capturar tus datos para iniciar la evaluacion.",
            template_name=access_code.evaluation_template.name,
            show_result_to_candidate=access_code.evaluation_template.show_result_to_candidate,
        )

    def list_access_codes(self) -> list[AccessCodeRead]:
        return [self._build_access_code_read(access_code) for access_code in self.repository.list_all()]

    def list_active_codes(self) -> list[str]:
        now = datetime.now(timezone.utc)
        codes = self.repository.list_all()
        active_codes = []
        for code in codes:
            if not code.is_active:
                continue
            
            expires_at = code.expires_at
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
                
            if expires_at and expires_at < now:
                continue
            if not code.evaluation_template or not code.evaluation_template.is_active:
                continue
            
            # Additional check: template must be valid
            template_preview = self.template_service.preview_template(code.evaluation_template.id)
            if not template_preview.is_valid:
                continue
                
            active_codes.append(code.code)
        return active_codes

    def create_access_code(self, payload: AccessCodeCreate) -> AccessCodeRead:
        self._ensure_code_is_unique(payload.code)
        self._ensure_template_exists(payload.evaluation_template_id)

        created_access_code = self.repository.create(
            code=payload.code,
            evaluation_template_id=payload.evaluation_template_id,
        )
        created_access_code.expires_at = self._normalize_datetime(payload.expires_at)
        created_access_code.is_active = payload.is_active
        self.repository.commit_and_refresh(created_access_code)
        return self._build_access_code_read(created_access_code)

    def update_access_code(self, access_code_id: int, payload: AccessCodeUpdate) -> AccessCodeRead:
        access_code = self._get_access_code_or_404(access_code_id)

        if access_code.code != payload.code:
            self._ensure_code_is_unique(payload.code)

        self._ensure_template_exists(payload.evaluation_template_id)

        access_code.code = payload.code
        access_code.evaluation_template_id = payload.evaluation_template_id
        access_code.expires_at = self._normalize_datetime(payload.expires_at)
        access_code.is_active = payload.is_active
        self.repository.commit_and_refresh(access_code)
        refreshed = self._get_access_code_or_404(access_code_id)
        return self._build_access_code_read(refreshed)

    def set_access_code_status(self, access_code_id: int, is_active: bool) -> AccessCodeRead:
        access_code = self._get_access_code_or_404(access_code_id)
        access_code.is_active = is_active
        self.repository.commit_and_refresh(access_code)
        refreshed = self._get_access_code_or_404(access_code_id)
        return self._build_access_code_read(refreshed)

    def delete_access_code(self, access_code_id: int) -> None:
        access_code = self._get_access_code_or_404(access_code_id)
        linked_session_count = self.db.scalar(
            select(func.count(EvaluationSession.id)).where(
                EvaluationSession.access_code_id == access_code_id
            )
        ) or 0
        if linked_session_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "El codigo no se puede eliminar porque ya fue utilizado en "
                    f"{linked_session_count} evaluacion(es)."
                ),
            )

        self.db.delete(access_code)
        self.repository.commit()

    def _ensure_code_is_unique(self, code: str) -> None:
        if self.repository.get_by_code(code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un codigo de evaluacion con ese valor.",
            )

    def _ensure_template_exists(self, evaluation_template_id: int | None) -> None:
        if evaluation_template_id is None:
            return

        template = self.template_service.get_template(evaluation_template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La plantilla seleccionada no existe.",
            )

    def _get_access_code_or_404(self, access_code_id: int) -> CandidateAccessCode:
        access_code = self.repository.get_by_id(access_code_id)
        if not access_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El codigo de evaluacion no existe.",
            )
        return access_code

    def _normalize_datetime(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    def _build_access_code_read(self, access_code: CandidateAccessCode) -> AccessCodeRead:
        template = access_code.evaluation_template
        template_preview = (
            self.template_service.preview_template(template.id)
            if template
            else None
        )
        expires_at = access_code.expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        return AccessCodeRead(
            id=access_code.id,
            code=access_code.code,
            evaluation_template_id=access_code.evaluation_template_id,
            evaluation_template_name=template.name if template else None,
            template_is_active=template.is_active if template else None,
            template_is_valid=template_preview.is_valid if template_preview else None,
            template_validation_message=(
                template_preview.validation_message if template_preview else None
            ),
            expires_at=expires_at,
            is_active=access_code.is_active,
            created_at=access_code.created_at,
        )
