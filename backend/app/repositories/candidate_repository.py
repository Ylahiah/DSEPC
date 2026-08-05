from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.candidate import Candidate


class CandidateRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def find_existing(
        self,
        *,
        first_name: str,
        last_name: str,
        email: str | None,
    ) -> Candidate | None:
        statement = select(Candidate).where(
            func.lower(Candidate.first_name) == first_name.strip().lower(),
            func.lower(Candidate.last_name) == last_name.strip().lower(),
        )

        if email:
            statement = statement.where(func.lower(Candidate.email) == email.strip().lower())
        else:
            statement = statement.where(Candidate.email.is_(None))

        return self.db.scalar(statement)

    def add(self, candidate: Candidate) -> Candidate:
        self.db.add(candidate)
        self.db.commit()
        self.db.refresh(candidate)
        return candidate
