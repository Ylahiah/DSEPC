from fastapi import HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy import func, select
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from app.models.candidate_access_code import CandidateAccessCode
from app.models.evaluation_template import EvaluationTemplate
from app.models.evaluation_template_section import EvaluationTemplateSection
from app.models.evaluation_session import EvaluationSession
from app.models.question import Question
from app.models.subcategory import Subcategory
from app.repositories.category_repository import CategoryRepository
from app.repositories.evaluation_template_repository import EvaluationTemplateRepository
from app.repositories.question_repository import QuestionRepository
from app.repositories.subcategory_repository import SubcategoryRepository
from app.schemas.evaluation_template import (
    EvaluationTemplateCreate,
    EvaluationTemplateListItem,
    EvaluationTemplatePreviewResponse,
    EvaluationTemplateRead,
    EvaluationTemplateSectionRead,
    EvaluationTemplateStatusUpdate,
    EvaluationTemplateUpdate,
    TemplatePreviewSection,
)


class EvaluationTemplateService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.template_repository = EvaluationTemplateRepository(db)
        self.category_repository = CategoryRepository(db)
        self.subcategory_repository = SubcategoryRepository(db)
        self.question_repository = QuestionRepository(db)

    def list_templates(self) -> list[EvaluationTemplateListItem]:
        templates = self.template_repository.list_all()
        return [self._build_template_list_item(template) for template in templates]

    def get_template(self, template_id: int) -> EvaluationTemplateRead:
        template = self._get_template_or_404(template_id)
        return self._build_template_read(template)

    def create_template(self, payload: EvaluationTemplateCreate) -> EvaluationTemplateRead:
        self._ensure_unique_template_name(payload.name)
        self._validate_sections_payload(payload.sections)

        template = EvaluationTemplate(
            name=payload.name,
            description=payload.description,
            instructions=payload.instructions,
            passing_score_percentage=payload.passing_score_percentage,
            show_result_to_candidate=payload.show_result_to_candidate,
            randomize_question_order=payload.randomize_question_order,
            sections=self._build_section_models(payload.sections),
        )

        created_template = self.template_repository.add(template)
        return self._build_template_read(self._get_template_or_404(created_template.id))

    def update_template(
        self,
        template_id: int,
        payload: EvaluationTemplateUpdate,
    ) -> EvaluationTemplateRead:
        template = self._get_template_or_404(template_id)
        existing_template = self.template_repository.get_by_name(payload.name)
        if existing_template and existing_template.id != template_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una plantilla con ese nombre.",
            )

        self._validate_sections_payload(payload.sections)

        template.name = payload.name
        template.description = payload.description
        template.instructions = payload.instructions
        template.passing_score_percentage = payload.passing_score_percentage
        template.show_result_to_candidate = payload.show_result_to_candidate
        template.randomize_question_order = payload.randomize_question_order
        template.sections.clear()
        template.sections.extend(self._build_section_models(payload.sections))

        preview = self._build_preview(template)
        if template.is_active and not preview.is_valid:
            template.is_active = False

        self.template_repository.commit()
        return self._build_template_read(self._get_template_or_404(template_id))

    def set_template_status(
        self,
        template_id: int,
        payload: EvaluationTemplateStatusUpdate,
    ) -> EvaluationTemplateRead:
        template = self._get_template_or_404(template_id)
        preview = self._build_preview(template)

        if payload.is_active and not preview.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede activar una plantilla invalida. Revisa la disponibilidad de preguntas.",
            )

        template.is_active = payload.is_active
        self.template_repository.commit()
        return self._build_template_read(self._get_template_or_404(template_id))

    def preview_template(self, template_id: int) -> EvaluationTemplatePreviewResponse:
        template = self._get_template_or_404(template_id)
        return self._build_preview(template)

    def delete_template(self, template_id: int) -> None:
        template = self._get_template_or_404(template_id)

        linked_access_code_count = self.db.scalar(
            select(func.count(CandidateAccessCode.id)).where(
                CandidateAccessCode.evaluation_template_id == template_id
            )
        ) or 0
        if linked_access_code_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La plantilla no se puede eliminar porque tiene "
                    f"{linked_access_code_count} codigo(s) de acceso asociado(s). "
                    "Eliminalos o desvinculalos primero."
                ),
            )

        linked_session_count = self.db.scalar(
            select(func.count(EvaluationSession.id)).where(
                EvaluationSession.evaluation_template_id == template_id
            )
        ) or 0
        if linked_session_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La plantilla no se puede eliminar porque ya fue utilizada en "
                    f"{linked_session_count} evaluacion(es)."
                ),
            )

        self.db.delete(template)
        self.template_repository.commit()

    def _ensure_unique_template_name(self, name: str) -> None:
        if self.template_repository.get_by_name(name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una plantilla con ese nombre.",
            )

    def _validate_sections_payload(self, sections: list) -> None:
        if not sections:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La plantilla debe incluir al menos una seccion.",
            )

        seen_sort_orders: set[int] = set()
        for section in sections:
            category = self.category_repository.get_by_id(section.category_id)
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Una de las categorias seleccionadas no existe.",
                )

            if section.subcategory_id is not None:
                subcategory = self.subcategory_repository.get_by_id(section.subcategory_id)
                if not subcategory:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Una de las subcategorias seleccionadas no existe.",
                    )
                if subcategory.category_id != section.category_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La subcategoria no pertenece a la categoria seleccionada.",
                    )

            if section.sort_order in seen_sort_orders:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No puede haber secciones con el mismo orden.",
                )
            seen_sort_orders.add(section.sort_order)

    def _build_section_models(self, sections: list) -> list[EvaluationTemplateSection]:
        return [
            EvaluationTemplateSection(
                category_id=section.category_id,
                subcategory_id=section.subcategory_id,
                difficulty=section.difficulty,
                question_count=section.question_count,
                time_limit_seconds=section.time_limit_seconds,
                weight_override=section.weight_override,
                sort_order=section.sort_order,
            )
            for section in sorted(sections, key=lambda current: current.sort_order)
        ]

    def _build_preview(
        self,
        template: EvaluationTemplate,
    ) -> EvaluationTemplatePreviewResponse:
        remaining_questions = self.question_repository.list_all()
        preview_sections: list[TemplatePreviewSection] = []
        total_requested_questions = 0
        total_available_questions = 0
        total_time_seconds = 0
        estimated_total_score = 0.0
        has_invalid_section = False

        for section in sorted(template.sections, key=lambda current: current.sort_order):
            matching_questions = self._filter_questions_for_section(remaining_questions, section)
            available_question_count = len(matching_questions)
            requested_question_count = section.question_count
            sufficient = available_question_count >= requested_question_count
            total_requested_questions += requested_question_count
            total_available_questions += available_question_count
            total_time_seconds += section.time_limit_seconds

            average_score = (
                sum(question.score for question in matching_questions) / available_question_count
                if available_question_count
                else 0.0
            )
            estimated_score = round(average_score * requested_question_count, 2)
            estimated_total_score += estimated_score

            warning = None
            if not sufficient:
                warning = (
                    "No hay suficientes preguntas activas para cumplir con la cantidad solicitada."
                )
                has_invalid_section = True
            else:
                assigned_questions = matching_questions[:requested_question_count]
                assigned_ids = {question.id for question in assigned_questions}
                remaining_questions = [
                    question for question in remaining_questions if question.id not in assigned_ids
                ]

            category = section.category or self.category_repository.get_by_id(section.category_id)
            subcategory = (
                section.subcategory
                or (
                    self.subcategory_repository.get_by_id(section.subcategory_id)
                    if section.subcategory_id is not None
                    else None
                )
            )

            preview_sections.append(
                TemplatePreviewSection(
                    section_id=section.id,
                    category_id=section.category_id,
                    category_name=category.name if category else "Categoria no disponible",
                    subcategory_id=section.subcategory_id,
                    subcategory_name=subcategory.name if subcategory else None,
                    difficulty=section.difficulty,
                    requested_question_count=requested_question_count,
                    available_question_count=available_question_count,
                    sufficient=sufficient,
                    time_limit_seconds=section.time_limit_seconds,
                    estimated_score=estimated_score,
                    warning=warning,
                )
            )

        validation_message = (
            "La plantilla es valida y puede activarse."
            if not has_invalid_section
            else "La plantilla requiere ajustes porque una o mas secciones no cuentan con suficientes preguntas."
        )

        return EvaluationTemplatePreviewResponse(
            template_id=template.id,
            template_name=template.name,
            total_sections=len(template.sections),
            total_requested_questions=total_requested_questions,
            total_available_questions=total_available_questions,
            total_time_seconds=total_time_seconds,
            estimated_total_score=round(estimated_total_score, 2),
            is_valid=not has_invalid_section,
            validation_message=validation_message,
            sections=preview_sections,
        )

    def _filter_questions_for_section(
        self,
        questions: list[Question],
        section: EvaluationTemplateSection,
    ) -> list[Question]:
        matching_questions: list[Question] = []

        for question in questions:
            if not question.is_active:
                continue
            if not question.category.is_active:
                continue
            if not question.subcategory.is_active:
                continue
            if question.category_id != section.category_id:
                continue
            if section.subcategory_id is not None and question.subcategory_id != section.subcategory_id:
                continue
            if section.difficulty is not None and question.difficulty != section.difficulty:
                continue
            matching_questions.append(question)

        return matching_questions

    def _build_template_list_item(
        self,
        template: EvaluationTemplate,
    ) -> EvaluationTemplateListItem:
        preview = self._build_preview(template)
        return EvaluationTemplateListItem(
            id=template.id,
            name=template.name,
            description=template.description,
            is_active=template.is_active,
            passing_score_percentage=template.passing_score_percentage,
            show_result_to_candidate=template.show_result_to_candidate,
            randomize_question_order=template.randomize_question_order,
            created_at=template.created_at,
            section_count=len(template.sections),
            total_question_count=preview.total_requested_questions,
            total_time_seconds=preview.total_time_seconds,
            is_valid=preview.is_valid,
            validation_message=preview.validation_message,
        )

    def _build_template_read(self, template: EvaluationTemplate) -> EvaluationTemplateRead:
        preview = self._build_preview(template)
        return EvaluationTemplateRead(
            id=template.id,
            name=template.name,
            description=template.description,
            instructions=template.instructions,
            is_active=template.is_active,
            passing_score_percentage=template.passing_score_percentage,
            show_result_to_candidate=template.show_result_to_candidate,
            randomize_question_order=template.randomize_question_order,
            created_at=template.created_at,
            sections=[
                EvaluationTemplateSectionRead(
                    id=section.id,
                    category_id=section.category_id,
                    category_name=section.category.name,
                    subcategory_id=section.subcategory_id,
                    subcategory_name=section.subcategory.name if section.subcategory else None,
                    difficulty=section.difficulty,
                    question_count=section.question_count,
                    time_limit_seconds=section.time_limit_seconds,
                    weight_override=section.weight_override,
                    sort_order=section.sort_order,
                )
                for section in sorted(template.sections, key=lambda current: current.sort_order)
            ],
            is_valid=preview.is_valid,
            validation_message=preview.validation_message,
            total_question_count=preview.total_requested_questions,
            total_time_seconds=preview.total_time_seconds,
        )

    def _get_template_or_404(self, template_id: int) -> EvaluationTemplate:
        template = self.template_repository.get_by_id(template_id)
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La plantilla no existe.",
            )
        return template
