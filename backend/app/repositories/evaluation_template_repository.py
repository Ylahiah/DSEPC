from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.evaluation_template import EvaluationTemplate
from app.models.evaluation_template_section import EvaluationTemplateSection


class EvaluationTemplateRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_all(self) -> list[EvaluationTemplate]:
        statement = (
            select(EvaluationTemplate)
            .options(
                selectinload(EvaluationTemplate.sections).selectinload(
                    EvaluationTemplateSection.category
                ),
                selectinload(EvaluationTemplate.sections).selectinload(
                    EvaluationTemplateSection.subcategory
                ),
            )
            .order_by(EvaluationTemplate.created_at.desc())
        )
        return list(self.db.scalars(statement).all())

    def get_by_id(self, template_id: int) -> EvaluationTemplate | None:
        statement = (
            select(EvaluationTemplate)
            .where(EvaluationTemplate.id == template_id)
            .options(
                selectinload(EvaluationTemplate.sections).selectinload(
                    EvaluationTemplateSection.category
                ),
                selectinload(EvaluationTemplate.sections).selectinload(
                    EvaluationTemplateSection.subcategory
                ),
            )
        )
        return self.db.scalar(statement)

    def get_by_name(self, name: str) -> EvaluationTemplate | None:
        statement = select(EvaluationTemplate).where(
            func.lower(EvaluationTemplate.name) == name.strip().lower()
        )
        return self.db.scalar(statement)

    def add(self, template: EvaluationTemplate) -> EvaluationTemplate:
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def commit(self) -> None:
        self.db.commit()
