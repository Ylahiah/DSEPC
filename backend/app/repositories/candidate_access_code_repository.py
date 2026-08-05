from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.candidate_access_code import CandidateAccessCode


class CandidateAccessCodeRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_code(self, code: str) -> CandidateAccessCode | None:
        statement = (
            select(CandidateAccessCode)
            .where(CandidateAccessCode.code == code)
            .options(selectinload(CandidateAccessCode.evaluation_template))
        )
        return self.db.scalar(statement)

    def get_by_id(self, access_code_id: int) -> CandidateAccessCode | None:
        statement = (
            select(CandidateAccessCode)
            .where(CandidateAccessCode.id == access_code_id)
            .options(selectinload(CandidateAccessCode.evaluation_template))
        )
        return self.db.scalar(statement)

    def list_all(self) -> list[CandidateAccessCode]:
        statement = (
            select(CandidateAccessCode)
            .options(selectinload(CandidateAccessCode.evaluation_template))
            .order_by(CandidateAccessCode.created_at.desc(), CandidateAccessCode.id.desc())
        )
        return list(self.db.scalars(statement).all())

    def create(self, *, code: str, evaluation_template_id: int | None = None) -> CandidateAccessCode:
        access_code = CandidateAccessCode(
            code=code,
            evaluation_template_id=evaluation_template_id,
        )
        self.db.add(access_code)
        self.db.commit()
        self.db.refresh(access_code)
        return access_code

    def commit_and_refresh(self, access_code: CandidateAccessCode) -> CandidateAccessCode:
        self.db.commit()
        self.db.refresh(access_code)
        return access_code

    def commit(self) -> None:
        self.db.commit()
