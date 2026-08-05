from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.evaluation_session import EvaluationSession
from app.models.evaluation_session_question import EvaluationSessionQuestion
from app.models.evaluation_session_section import EvaluationSessionSection
from app.models.question import Question


class EvaluationSessionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, session_id: int) -> EvaluationSession | None:
        statement = (
            select(EvaluationSession)
            .where(EvaluationSession.id == session_id)
            .options(
                selectinload(EvaluationSession.candidate),
                selectinload(EvaluationSession.access_code),
                selectinload(EvaluationSession.evaluation_template),
                selectinload(EvaluationSession.sections)
                .selectinload(EvaluationSessionSection.questions)
                .selectinload(EvaluationSessionQuestion.question)
                .selectinload(Question.options),
                selectinload(EvaluationSession.sections)
                .selectinload(EvaluationSessionSection.questions)
                .selectinload(EvaluationSessionQuestion.question)
                .selectinload(Question.category),
                selectinload(EvaluationSession.sections)
                .selectinload(EvaluationSessionSection.questions)
                .selectinload(EvaluationSessionQuestion.question)
                .selectinload(Question.excel_exercise),
                selectinload(EvaluationSession.sections).selectinload(
                    EvaluationSessionSection.template_section
                ),
            )
        )
        return self.db.scalar(statement)

    def find_resumable(
        self,
        *,
        access_code_id: int,
        candidate_id: int,
    ) -> EvaluationSession | None:
        statement = (
            select(EvaluationSession)
            .where(
                EvaluationSession.access_code_id == access_code_id,
                EvaluationSession.candidate_id == candidate_id,
                EvaluationSession.status.in_(["pending", "in_progress"]),
            )
            .order_by(EvaluationSession.started_at.desc())
            .options(
                selectinload(EvaluationSession.candidate),
                selectinload(EvaluationSession.access_code),
                selectinload(EvaluationSession.evaluation_template),
                selectinload(EvaluationSession.sections)
                .selectinload(EvaluationSessionSection.questions)
                .selectinload(EvaluationSessionQuestion.question)
                .selectinload(Question.options),
                selectinload(EvaluationSession.sections)
                .selectinload(EvaluationSessionSection.questions)
                .selectinload(EvaluationSessionQuestion.question)
                .selectinload(Question.category),
                selectinload(EvaluationSession.sections)
                .selectinload(EvaluationSessionSection.questions)
                .selectinload(EvaluationSessionQuestion.question)
                .selectinload(Question.excel_exercise),
                selectinload(EvaluationSession.sections).selectinload(
                    EvaluationSessionSection.template_section
                ),
            )
        )
        return self.db.scalar(statement)

    def list_all_for_dashboard(self) -> list[EvaluationSession]:
        statement = (
            select(EvaluationSession)
            .order_by(EvaluationSession.started_at.desc())
            .options(
                selectinload(EvaluationSession.candidate),
                selectinload(EvaluationSession.evaluation_template),
                selectinload(EvaluationSession.sections)
                .selectinload(EvaluationSessionSection.questions)
                .selectinload(EvaluationSessionQuestion.question)
                .selectinload(Question.category),
            )
        )
        return list(self.db.scalars(statement).all())

    def add(self, session: EvaluationSession) -> EvaluationSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def commit(self) -> None:
        self.db.commit()
