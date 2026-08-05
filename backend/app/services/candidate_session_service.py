from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from random import SystemRandom
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.candidate import Candidate
from app.models.candidate_access_code import CandidateAccessCode
from app.models.evaluation_session import EvaluationSession
from app.models.evaluation_session_question import EvaluationSessionQuestion
from app.models.evaluation_session_section import EvaluationSessionSection
from app.models.evaluation_template import EvaluationTemplate
from app.models.evaluation_template_section import EvaluationTemplateSection
from app.models.excel_exercise import ExcelExercise
from app.models.question import Question
from app.repositories.candidate_access_code_repository import CandidateAccessCodeRepository
from app.repositories.candidate_repository import CandidateRepository
from app.repositories.evaluation_session_repository import EvaluationSessionRepository
from app.repositories.question_repository import QuestionRepository
from app.schemas.candidate_session import (
    CandidateAnswerUpsertRequest,
    CandidateCategoryResultRead,
    CandidateExamExcelExerciseRead,
    CandidateExamOptionRead,
    CandidateExamQuestionRead,
    CandidateExamSectionRead,
    CandidateExcelSubmissionResponse,
    CandidateInfoRead,
    CandidateSessionCompletionResponse,
    CandidateSessionHeartbeatRequest,
    CandidateSessionProgressRead,
    CandidateSessionRead,
    CandidateSessionResultSummaryRead,
    CandidateSessionStartRequest,
)
from app.services.excel_exercise_service import ExcelExerciseService
from app.services.evaluation_template_service import EvaluationTemplateService


class CandidateSessionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.random = SystemRandom()
        self.settings = get_settings()
        self.access_code_repository = CandidateAccessCodeRepository(db)
        self.candidate_repository = CandidateRepository(db)
        self.session_repository = EvaluationSessionRepository(db)
        self.question_repository = QuestionRepository(db)
        self.template_service = EvaluationTemplateService(db)
        self.excel_exercise_service = ExcelExerciseService(db)

    def start_session(self, payload: CandidateSessionStartRequest) -> CandidateSessionRead:
        access_code = self._get_valid_access_code(payload.access_code)
        template = access_code.evaluation_template
        assert template is not None

        candidate = self._get_or_create_candidate(payload)
        resumable_session = self.session_repository.find_resumable(
            access_code_id=access_code.id,
            candidate_id=candidate.id,
        )
        if resumable_session:
            self._refresh_status_if_expired(resumable_session)
            if resumable_session.status in {"pending", "in_progress"}:
                return self._build_candidate_session_read(resumable_session)

        generated_session = self._generate_session(
            access_code=access_code,
            template=template,
            candidate=candidate,
        )
        created_session = self.session_repository.add(generated_session)
        hydrated_session = self.session_repository.get_by_id(created_session.id)
        if not hydrated_session:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No fue posible recuperar la sesion recien creada.",
            )
        return self._build_candidate_session_read(hydrated_session)

    def get_session(self, session_id: int) -> CandidateSessionRead:
        session = self._get_session_or_404(session_id)
        self._refresh_status_if_expired(session)
        hydrated_session = self._get_session_or_404(session_id)
        return self._build_candidate_session_read(hydrated_session)

    def save_answer(
        self,
        session_id: int,
        payload: CandidateAnswerUpsertRequest,
    ) -> CandidateSessionProgressRead:
        session = self._get_session_or_404(session_id)
        self._ensure_session_is_writable(session)

        session_question = self._find_session_question(session, payload.question_id)
        if session_question.question.question_type != "multiple_choice":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta pregunta debe resolverse cargando el archivo del ejercicio practico.",
            )
        selected_answer = payload.selected_answer.strip()
        valid_answers = {option.option_text for option in session_question.question.options}
        if selected_answer not in valid_answers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La respuesta enviada no corresponde a una opcion valida.",
            )

        self._apply_time_tracking(
            session=session,
            session_question=session_question,
            time_spent_seconds=payload.time_spent_seconds,
            current_section_index=payload.current_section_index,
            current_question_index=payload.current_question_index,
        )

        now = datetime.now(timezone.utc)
        if session_question.started_at is None:
            session_question.started_at = now
        if session_question.first_answered_at is None:
            session_question.first_answered_at = now

        session_question.selected_answer = selected_answer
        session_question.is_answered = True
        session_question.was_omitted = False
        session_question.is_correct = (
            selected_answer.lower() == session_question.question.correct_answer.strip().lower()
        )
        session_question.answered_at = now
        session_question.last_answered_at = now
        if session.status == "pending":
            session.status = "in_progress"

        self._update_section_completion(session)
        self._recalculate_session_metrics(session)
        if self._session_time_exhausted(session):
            self._finalize_session(session, due_to_timeout=True)

        self.session_repository.commit()
        hydrated_session = self._get_session_or_404(session_id)
        return self._build_progress_read(hydrated_session)

    def heartbeat(
        self,
        session_id: int,
        payload: CandidateSessionHeartbeatRequest,
    ) -> CandidateSessionProgressRead:
        session = self._get_session_or_404(session_id)
        self._ensure_session_is_writable(session)

        session_question = self._find_session_question(session, payload.question_id)
        self._apply_time_tracking(
            session=session,
            session_question=session_question,
            time_spent_seconds=payload.time_spent_seconds,
            current_section_index=payload.current_section_index,
            current_question_index=payload.current_question_index,
        )

        if payload.mark_question_omitted and not session_question.is_answered:
            session_question.was_omitted = True

        if session.status == "pending":
            session.status = "in_progress"

        self._update_section_completion(session)
        self._recalculate_session_metrics(session)
        if self._session_time_exhausted(session):
            self._finalize_session(session, due_to_timeout=True)

        self.session_repository.commit()
        hydrated_session = self._get_session_or_404(session_id)
        return self._build_progress_read(hydrated_session)

    def complete_session(self, session_id: int) -> CandidateSessionCompletionResponse:
        session = self._get_session_or_404(session_id)
        self._ensure_session_is_writable(session)

        self._finalize_session(session, due_to_timeout=False)
        self.session_repository.commit()
        hydrated_session = self._get_session_or_404(session_id)
        metrics = self._calculate_metrics(hydrated_session)

        return CandidateSessionCompletionResponse(
            session_id=hydrated_session.id,
            status=hydrated_session.status,
            answered_questions=metrics["answered_questions"],
            total_questions=metrics["total_questions"],
            omitted_questions=metrics["omitted_questions"],
            correct_questions=metrics["correct_questions"],
            incorrect_questions=metrics["incorrect_questions"],
            consumed_time_seconds=hydrated_session.consumed_time_seconds,
            average_time_per_question_seconds=metrics["average_time_per_question_seconds"],
            total_score=hydrated_session.total_score
            if hydrated_session.evaluation_template.show_result_to_candidate
            else None,
            show_result_to_candidate=hydrated_session.evaluation_template.show_result_to_candidate,
            message=(
                "Evaluacion cerrada por tiempo agotado."
                if hydrated_session.completed_by_timeout
                else (
                    "Evaluacion finalizada. Tu resultado ya esta disponible."
                    if hydrated_session.evaluation_template.show_result_to_candidate
                    else "Evaluacion finalizada correctamente."
                )
            ),
            category_results=metrics["category_results"],
        )

    def get_result_summary(self, session_id: int) -> CandidateSessionResultSummaryRead:
        session = self._get_session_or_404(session_id)
        self._refresh_status_if_expired(session)
        hydrated_session = self._get_session_or_404(session_id)
        metrics = self._calculate_metrics(hydrated_session)

        return CandidateSessionResultSummaryRead(
            session_id=hydrated_session.id,
            status=hydrated_session.status,
            completed_by_timeout=hydrated_session.completed_by_timeout,
            answered_questions=metrics["answered_questions"],
            total_questions=metrics["total_questions"],
            omitted_questions=metrics["omitted_questions"],
            correct_questions=metrics["correct_questions"],
            incorrect_questions=metrics["incorrect_questions"],
            consumed_time_seconds=hydrated_session.consumed_time_seconds,
            total_time_seconds=hydrated_session.total_time_seconds,
            average_time_per_question_seconds=metrics["average_time_per_question_seconds"],
            total_score=hydrated_session.total_score
            if hydrated_session.evaluation_template.show_result_to_candidate
            else None,
            show_result_to_candidate=hydrated_session.evaluation_template.show_result_to_candidate,
            category_results=metrics["category_results"],
        )

    def download_excel_exercise(
        self,
        session_id: int,
        session_question_id: int,
    ) -> tuple[BytesIO, str]:
        session = self._get_session_or_404(session_id)
        session_question = self._find_session_question(session, session_question_id)
        excel_exercise = self._get_excel_exercise_for_question(session_question)
        return self.excel_exercise_service.get_download_for_exercise(excel_exercise)

    def submit_excel_exercise(
        self,
        session_id: int,
        session_question_id: int,
        workbook: UploadFile,
        *,
        time_spent_seconds: int,
        current_section_index: int,
        current_question_index: int,
    ) -> CandidateSessionProgressRead:
        session = self._get_session_or_404(session_id)
        self._ensure_session_is_writable(session)

        session_question = self._find_session_question(session, session_question_id)
        excel_exercise = self._get_excel_exercise_for_question(session_question)

        workbook_bytes = workbook.file.read()
        if not workbook_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo enviado esta vacio.",
            )

        self._apply_time_tracking(
            session=session,
            session_question=session_question,
            time_spent_seconds=time_spent_seconds,
            current_section_index=current_section_index,
            current_question_index=current_question_index,
        )

        is_valid, validation_message = self.excel_exercise_service.validate_submission(
            excel_exercise,
            workbook_bytes,
        )
        stored_path = self._store_submission_file(
            session_id=session.id,
            session_question_id=session_question.id,
            filename=workbook.filename or excel_exercise.workbook_filename,
            workbook_bytes=workbook_bytes,
            previous_path=session_question.practical_submission_path,
        )

        now = datetime.now(timezone.utc)
        if session_question.started_at is None:
            session_question.started_at = now
        if session_question.first_answered_at is None:
            session_question.first_answered_at = now

        session_question.selected_answer = "Archivo validado" if is_valid else "Archivo con observaciones"
        session_question.is_answered = True
        session_question.was_omitted = False
        session_question.is_correct = is_valid
        session_question.practical_submission_filename = workbook.filename or excel_exercise.workbook_filename
        session_question.practical_submission_path = str(stored_path)
        session_question.practical_feedback = validation_message
        session_question.answered_at = now
        session_question.last_answered_at = now
        if session.status == "pending":
            session.status = "in_progress"

        self._update_section_completion(session)
        self._recalculate_session_metrics(session)
        if self._session_time_exhausted(session):
            self._finalize_session(session, due_to_timeout=True)

        self.session_repository.commit()
        hydrated_session = self._get_session_or_404(session_id)
        return self._build_progress_read(hydrated_session)

    def _get_valid_access_code(self, raw_code: str) -> CandidateAccessCode:
        normalized_code = raw_code.strip().upper()
        access_code = self.access_code_repository.get_by_code(normalized_code)
        if not access_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El codigo de evaluacion no existe.",
            )

        if not access_code.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El codigo de evaluacion esta inactivo.",
            )

        if access_code.expires_at and self._normalize_datetime(access_code.expires_at) < datetime.now(
            timezone.utc
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El codigo de evaluacion ha expirado.",
            )

        if not access_code.evaluation_template or not access_code.evaluation_template.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El codigo no esta vinculado a una plantilla activa.",
            )

        template_preview = self.template_service.preview_template(
            access_code.evaluation_template.id
        )
        if not template_preview.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La plantilla asociada al codigo no esta lista para aplicarse.",
            )

        return access_code

    def _get_or_create_candidate(self, payload: CandidateSessionStartRequest) -> Candidate:
        candidate = self.candidate_repository.find_existing(
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
        )
        if candidate:
            candidate.phone = payload.phone
            candidate.employee_reference = payload.employee_reference
            self.db.commit()
            self.db.refresh(candidate)
            return candidate

        return self.candidate_repository.add(
            Candidate(
                first_name=payload.first_name,
                last_name=payload.last_name,
                email=payload.email,
                phone=payload.phone,
                employee_reference=payload.employee_reference,
            )
        )

    def _generate_session(
        self,
        *,
        access_code: CandidateAccessCode,
        template: EvaluationTemplate,
        candidate: Candidate,
    ) -> EvaluationSession:
        all_questions = self.question_repository.list_all()
        remaining_questions = list(all_questions)
        session_sections: list[EvaluationSessionSection] = []
        total_time_seconds = 0
        started_at = datetime.now(timezone.utc)

        for section in sorted(template.sections, key=lambda current: current.sort_order):
            matching_questions = self._filter_questions_for_section(remaining_questions, section)
            if len(matching_questions) < section.question_count:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No hay suficientes preguntas activas para generar esta evaluacion.",
                )

            selected_questions = self._select_questions(
                matching_questions,
                section.question_count,
                randomize=template.randomize_question_order,
            )
            assigned_ids = {question.id for question in selected_questions}
            remaining_questions = [
                question for question in remaining_questions if question.id not in assigned_ids
            ]

            session_section = EvaluationSessionSection(
                template_section_id=section.id,
                title=self._build_section_title(section),
                sort_order=section.sort_order,
                time_limit_seconds=section.time_limit_seconds,
                started_at=started_at if section.sort_order == 1 else None,
                questions=[
                    EvaluationSessionQuestion(
                        question_id=question.id,
                        sort_order=index + 1,
                        started_at=started_at
                        if section.sort_order == 1 and index == 0
                        else None,
                    )
                    for index, question in enumerate(selected_questions)
                ],
            )

            session_sections.append(session_section)
            total_time_seconds += section.time_limit_seconds

        expires_at = started_at + timedelta(seconds=total_time_seconds)

        return EvaluationSession(
            access_code_id=access_code.id,
            evaluation_template_id=template.id,
            candidate_id=candidate.id,
            status="pending",
            started_at=started_at,
            expires_at=expires_at,
            total_time_seconds=total_time_seconds,
            consumed_time_seconds=0,
            completed_by_timeout=False,
            answered_questions_count=0,
            omitted_questions_count=0,
            current_section_index=0,
            current_question_index=0,
            sections=session_sections,
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

    def _select_questions(
        self,
        questions: list[Question],
        count: int,
        *,
        randomize: bool,
    ) -> list[Question]:
        if randomize:
            return self.random.sample(questions, count)

        ordered_questions = sorted(questions, key=lambda question: question.id)
        return ordered_questions[:count]

    def _build_section_title(self, section: EvaluationTemplateSection) -> str:
        title = section.category.name
        if section.subcategory:
            title = f"{title} / {section.subcategory.name}"
        if section.difficulty:
            title = f"{title} / {section.difficulty}"
        return title

    def _find_session_question(
        self,
        session: EvaluationSession,
        question_id: int,
    ) -> EvaluationSessionQuestion:
        for section in session.sections:
            for session_question in section.questions:
                if session_question.id == question_id:
                    return session_question

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La pregunta de la sesion no existe.",
        )

    def _get_excel_exercise_for_question(
        self,
        session_question: EvaluationSessionQuestion,
    ) -> ExcelExercise:
        question = session_question.question
        if question.question_type != "excel_practical" or question.excel_exercise is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La pregunta seleccionada no esta configurada como ejercicio practico de Excel.",
            )
        return question.excel_exercise

    def _ensure_session_is_writable(self, session: EvaluationSession) -> None:
        self._refresh_status_if_expired(session)

        if session.status == "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sesion ya fue completada.",
            )

        if session.status == "expired":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La sesion ha expirado.",
            )

    def _apply_time_tracking(
        self,
        *,
        session: EvaluationSession,
        session_question: EvaluationSessionQuestion,
        time_spent_seconds: int,
        current_section_index: int,
        current_question_index: int,
    ) -> None:
        tracked_seconds = max(0, int(time_spent_seconds))
        remaining_seconds = max(0, session.total_time_seconds - session.consumed_time_seconds)
        tracked_seconds = min(tracked_seconds, remaining_seconds)

        target_section = session.sections[current_section_index]
        if target_section.started_at is None:
            target_section.started_at = datetime.now(timezone.utc)

        target_question = target_section.questions[current_question_index]
        if target_question.started_at is None:
            target_question.started_at = datetime.now(timezone.utc)

        if session_question.started_at is None:
            session_question.started_at = datetime.now(timezone.utc)

        session.consumed_time_seconds += tracked_seconds
        session.current_section_index = current_section_index
        session.current_question_index = current_question_index
        session_question.time_spent_seconds += tracked_seconds
        session_question.evaluation_session_section.consumed_time_seconds += tracked_seconds

    def _update_section_completion(self, session: EvaluationSession) -> None:
        now = datetime.now(timezone.utc)
        for section in session.sections:
            if section.started_at is None and (
                section.sort_order == session.current_section_index + 1
            ):
                section.started_at = now

            if section.questions and all(
                question.is_answered or question.was_omitted for question in section.questions
            ):
                if section.completed_at is None:
                    section.completed_at = now

    def _finalize_session(
        self,
        session: EvaluationSession,
        *,
        due_to_timeout: bool,
    ) -> None:
        now = datetime.now(timezone.utc)
        for section in session.sections:
            if section.started_at is None:
                continue
            if section.completed_at is None:
                section.completed_at = now
            for session_question in section.questions:
                if not session_question.is_answered:
                    session_question.was_omitted = True

        self._recalculate_session_metrics(session)
        session.status = "completed" if not due_to_timeout else "expired"
        session.completed_by_timeout = due_to_timeout
        session.submitted_at = now
        session.total_score = round(
            sum(
                session_question.question.score
                for section in session.sections
                for session_question in section.questions
                if session_question.is_correct
            ),
            2,
        )

    def _recalculate_session_metrics(self, session: EvaluationSession) -> None:
        answered_questions = 0
        omitted_questions = 0

        for section in session.sections:
            for session_question in section.questions:
                if session_question.is_answered:
                    answered_questions += 1
                elif session_question.was_omitted:
                    omitted_questions += 1

        session.answered_questions_count = answered_questions
        session.omitted_questions_count = omitted_questions

    def _calculate_metrics(self, session: EvaluationSession) -> dict[str, object]:
        total_questions = 0
        answered_questions = 0
        omitted_questions = 0
        correct_questions = 0
        incorrect_questions = 0
        category_metrics: dict[str, dict[str, float | int | str]] = {}

        for section in session.sections:
            for session_question in section.questions:
                question = session_question.question
                category_name = question.category.name
                total_questions += 1

                if category_name not in category_metrics:
                    category_metrics[category_name] = {
                        "category_name": category_name,
                        "total_questions": 0,
                        "answered_questions": 0,
                        "omitted_questions": 0,
                        "correct_questions": 0,
                        "incorrect_questions": 0,
                        "score_obtained": 0.0,
                        "score_possible": 0.0,
                    }

                metrics = category_metrics[category_name]
                metrics["total_questions"] += 1
                metrics["score_possible"] += question.score

                if session_question.is_answered:
                    answered_questions += 1
                    metrics["answered_questions"] += 1
                    if session_question.is_correct:
                        correct_questions += 1
                        metrics["correct_questions"] += 1
                        metrics["score_obtained"] += question.score
                    else:
                        incorrect_questions += 1
                        metrics["incorrect_questions"] += 1
                elif session_question.was_omitted:
                    omitted_questions += 1
                    metrics["omitted_questions"] += 1

        average_time = (
            round(session.consumed_time_seconds / total_questions, 2) if total_questions else 0.0
        )

        category_results = [
            CandidateCategoryResultRead(
                category_name=str(metrics["category_name"]),
                total_questions=int(metrics["total_questions"]),
                answered_questions=int(metrics["answered_questions"]),
                omitted_questions=int(metrics["omitted_questions"]),
                correct_questions=int(metrics["correct_questions"]),
                incorrect_questions=int(metrics["incorrect_questions"]),
                score_obtained=round(float(metrics["score_obtained"]), 2),
                score_possible=round(float(metrics["score_possible"]), 2),
            )
            for _, metrics in sorted(category_metrics.items())
        ]

        return {
            "total_questions": total_questions,
            "answered_questions": answered_questions,
            "omitted_questions": omitted_questions,
            "correct_questions": correct_questions,
            "incorrect_questions": incorrect_questions,
            "average_time_per_question_seconds": average_time,
            "category_results": category_results,
        }

    def _session_time_exhausted(self, session: EvaluationSession) -> bool:
        return session.consumed_time_seconds >= session.total_time_seconds

    def _refresh_status_if_expired(self, session: EvaluationSession) -> None:
        if session.status in {"completed", "expired"}:
            return

        expires_at = self._normalize_datetime(session.expires_at)
        if expires_at <= datetime.now(timezone.utc):
            self._finalize_session(session, due_to_timeout=True)
            self.session_repository.commit()

    def _normalize_datetime(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    def _store_submission_file(
        self,
        *,
        session_id: int,
        session_question_id: int,
        filename: str,
        workbook_bytes: bytes,
        previous_path: str | None,
    ) -> Path:
        storage_dir = self.settings.excel_submission_storage_dir / str(session_id)
        storage_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(filename).suffix.lower() or ".xlsx"
        stored_path = storage_dir / f"{session_question_id}_{uuid4().hex}{suffix}"
        stored_path.write_bytes(workbook_bytes)

        if previous_path:
            previous_file = Path(previous_path)
            if previous_file.exists():
                previous_file.unlink()

        return stored_path

    def _build_candidate_session_read(self, session: EvaluationSession) -> CandidateSessionRead:
        metrics = self._calculate_metrics(session)
        return CandidateSessionRead(
            id=session.id,
            status=session.status,
            started_at=self._normalize_datetime(session.started_at),
            submitted_at=self._normalize_datetime(session.submitted_at)
            if session.submitted_at
            else None,
            expires_at=self._normalize_datetime(session.expires_at),
            total_time_seconds=session.total_time_seconds,
            consumed_time_seconds=session.consumed_time_seconds,
            completed_by_timeout=session.completed_by_timeout,
            current_section_index=session.current_section_index,
            current_question_index=session.current_question_index,
            answered_questions_count=session.answered_questions_count,
            omitted_questions_count=session.omitted_questions_count,
            correct_questions_count=metrics["correct_questions"],
            incorrect_questions_count=metrics["incorrect_questions"],
            average_time_per_question_seconds=metrics["average_time_per_question_seconds"],
            total_score=session.total_score
            if session.evaluation_template.show_result_to_candidate
            and session.status in {"completed", "expired"}
            else None,
            show_result_to_candidate=session.evaluation_template.show_result_to_candidate,
            template_name=session.evaluation_template.name,
            candidate=CandidateInfoRead.model_validate(session.candidate),
            sections=[
                CandidateExamSectionRead(
                    id=section.id,
                    title=section.title,
                    sort_order=section.sort_order,
                    time_limit_seconds=section.time_limit_seconds,
                    consumed_time_seconds=section.consumed_time_seconds,
                    questions=[
                        CandidateExamQuestionRead(
                            id=session_question.id,
                            question_id=session_question.question_id,
                            category_name=session_question.question.category.name,
                            question_type=session_question.question.question_type,
                            statement=session_question.question.statement,
                            difficulty=session_question.question.difficulty,
                            max_time_seconds=session_question.question.max_time_seconds,
                            score=session_question.question.score,
                            selected_answer=session_question.selected_answer,
                            is_answered=session_question.is_answered,
                            was_omitted=session_question.was_omitted,
                            time_spent_seconds=session_question.time_spent_seconds,
                            sort_order=session_question.sort_order,
                            practical_submission_filename=session_question.practical_submission_filename,
                            practical_feedback=session_question.practical_feedback,
                            excel_exercise=(
                                CandidateExamExcelExerciseRead(
                                    id=session_question.question.excel_exercise.id,
                                    name=session_question.question.excel_exercise.name,
                                    instructions=session_question.question.excel_exercise.instructions,
                                    workbook_filename=session_question.question.excel_exercise.workbook_filename,
                                )
                                if session_question.question.excel_exercise
                                else None
                            ),
                            options=[
                                CandidateExamOptionRead(
                                    id=option.id,
                                    option_text=option.option_text,
                                    option_order=option.option_order,
                                )
                                for option in session_question.question.options
                            ],
                        )
                        for session_question in section.questions
                    ],
                )
                for section in session.sections
            ],
            category_results=metrics["category_results"],
        )

    def _build_progress_read(self, session: EvaluationSession) -> CandidateSessionProgressRead:
        metrics = self._calculate_metrics(session)
        return CandidateSessionProgressRead(
            session_id=session.id,
            status=session.status,
            answered_questions=metrics["answered_questions"],
            total_questions=metrics["total_questions"],
            omitted_questions=metrics["omitted_questions"],
            correct_questions=metrics["correct_questions"],
            incorrect_questions=metrics["incorrect_questions"],
            current_section_index=session.current_section_index,
            current_question_index=session.current_question_index,
            consumed_time_seconds=session.consumed_time_seconds,
            average_time_per_question_seconds=metrics["average_time_per_question_seconds"],
            total_score=round(
                sum(
                    session_question.question.score
                    for section in session.sections
                    for session_question in section.questions
                    if session_question.is_correct
                ),
                2,
            )
            if session.evaluation_template.show_result_to_candidate
            else None,
        )

    def _get_session_or_404(self, session_id: int) -> EvaluationSession:
        session = self.session_repository.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La sesion no existe.",
            )
        return session
