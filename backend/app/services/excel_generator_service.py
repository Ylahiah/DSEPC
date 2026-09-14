import json
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.category import Category
from app.models.evaluation_template import EvaluationTemplate
from app.models.evaluation_template_section import EvaluationTemplateSection
from app.models.excel_exercise import ExcelExercise
from app.models.question import Question
from app.models.question_option import QuestionOption
from app.models.subcategory import Subcategory
from app.schemas.excel_generator import (
    AssignExerciseToTemplateRequest,
    AssignExerciseToTemplateResponse,
    BlueprintParameterOption,
    BlueprintRead,
    GenerateExerciseRequest,
    GeneratedExerciseSummaryRead,
)
from app.services.excel_generator.blueprints import (
    BLUEPRINTS,
    get_instructions_for_blueprint,
)
from app.services.excel_generator.builder import WorkbookBuilder
from app.services.excel_generator.synthesizer import DataSynthesizer


class ExcelGeneratorService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()

    def list_blueprints(self) -> list[BlueprintRead]:
        results: list[BlueprintRead] = []
        for bp in BLUEPRINTS.values():
            results.append(
                BlueprintRead(
                    id=bp.id,
                    title=bp.title,
                    description=bp.description,
                    category=bp.category,
                    difficulty=bp.difficulty,
                    skills_tested=bp.skills_tested,
                    supported_industries=[
                        BlueprintParameterOption(
                            id=ind["id"],
                            label=ind["label"],
                            description=ind.get("description"),
                        )
                        for ind in bp.supported_industries
                    ],
                    default_rows=bp.default_rows,
                    icon=bp.icon,
                )
            )
        return results

    def generate_preview_bytes(
        self,
        blueprint_id: str,
        title: str,
        industry_id: str = "pharma",
        row_count: int = 150,
        difficulty: str = "intermediate",
        variant_type: str = "candidate",  # "candidate" or "solution"
    ) -> tuple[BytesIO, str]:
        if blueprint_id not in BLUEPRINTS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El blueprint '{blueprint_id}' no existe en el catálogo.",
            )

        data = DataSynthesizer.generate_dataset_for_blueprint(
            blueprint_id=blueprint_id,
            industry_id=industry_id,
            row_count=row_count,
        )

        candidate_bytes, solution_bytes, _ = (
            WorkbookBuilder.build_candidate_and_solution_workbooks(
                blueprint_id=blueprint_id,
                title=title,
                data=data,
                difficulty=difficulty,
            )
        )

        clean_filename = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
        if variant_type == "solution":
            return BytesIO(solution_bytes), f"{clean_filename}_{difficulty.upper()}_SOLUCION.xlsx"
        return BytesIO(candidate_bytes), f"{clean_filename}_{difficulty.upper()}_EJERCICIO.xlsx"

    def create_and_save_exercise(
        self,
        payload: GenerateExerciseRequest,
    ) -> GeneratedExerciseSummaryRead:
        if payload.blueprint_id not in BLUEPRINTS:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El blueprint '{payload.blueprint_id}' no existe.",
            )

        bp = BLUEPRINTS[payload.blueprint_id]
        diff = payload.difficulty or bp.difficulty
        
        # Check name uniqueness
        existing = self.db.scalar(select(ExcelExercise).where(ExcelExercise.name == payload.title.strip()))
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un ejercicio práctico con el nombre '{payload.title.strip()}'. Elige otro título.",
            )

        # 1. Synthesize Data
        data = DataSynthesizer.generate_dataset_for_blueprint(
            blueprint_id=payload.blueprint_id,
            industry_id=payload.industry_id,
            row_count=payload.row_count,
        )

        # 2. Build Workbooks & Solution Matrix with difficulty
        candidate_bytes, solution_bytes, expected_summary = (
            WorkbookBuilder.build_candidate_and_solution_workbooks(
                blueprint_id=payload.blueprint_id,
                title=payload.title,
                data=data,
                difficulty=diff,
            )
        )

        # 3. Store in storage/excel_exercises/
        storage_dir = self.settings.excel_exercise_storage_dir
        storage_dir.mkdir(parents=True, exist_ok=True)
        
        candidate_path = storage_dir / f"{uuid4().hex}.xlsx"
        candidate_path.write_bytes(candidate_bytes)

        solution_path = storage_dir / f"{uuid4().hex}.xlsx"
        solution_path.write_bytes(solution_bytes)

        clean_filename = "".join(c for c in payload.title if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
        
        criteria_mapping = expected_summary.get("__criteria__", {})
        total_target_cells = len([k for k in expected_summary if k != "__criteria__"])
        instructions_content = get_instructions_for_blueprint(payload.blueprint_id, diff)

        # 4. Save ExcelExercise DB Record
        exercise = ExcelExercise(
            name=payload.title.strip(),
            description=payload.description or bp.description,
            instructions=instructions_content,
            workbook_filename=f"{clean_filename}_EJERCICIO.xlsx",
            workbook_storage_path=str(candidate_path),
            solution_filename=f"{clean_filename}_SOLUCION.xlsx",
            solution_storage_path=str(solution_path),
            source_sheet_name=bp.source_sheet_name,
            task_sheet_name=bp.task_sheet_name,
            expected_summary_json=json.dumps(expected_summary, ensure_ascii=False),
            pivot_table_count=1 if payload.blueprint_id == "pivot_sales_fulfillment" else 0,
            is_active=True,
        )
        self.db.add(exercise)
        self.db.commit()
        self.db.refresh(exercise)

        question_id: int | None = None
        category_name: str | None = None
        subcategory_name: str | None = None
        assigned_template_id: int | None = None
        assigned_template_name: str | None = None

        # 5. Optionally create Question Bank Question
        if payload.save_to_question_bank or payload.assign_to_template_id:
            category_id = payload.category_id
            subcategory_id = payload.subcategory_id

            if category_id:
                cat = self.db.scalar(select(Category).where(Category.id == category_id))
            else:
                cat = self.db.scalar(select(Category).where(Category.name.ilike("%Ejercicios practicos%")))
                if not cat:
                    cat = self.db.scalar(select(Category).where(Category.name.ilike("%Excel%")))
                if not cat:
                    cat = self.db.scalar(select(Category).where(Category.is_active == True))
                if not cat:
                    cat = Category(
                        code="CAT-EXCEL",
                        name="Ejercicios Prácticos Excel",
                        description="Evaluación de competencias prácticas en hojas de cálculo y análisis de datos.",
                        weight=1.0,
                        is_active=True,
                    )
                    self.db.add(cat)
                    self.db.commit()
                    self.db.refresh(cat)

            category_id = cat.id
            category_name = cat.name

            if subcategory_id:
                sub = self.db.scalar(
                    select(Subcategory).where(
                        Subcategory.id == subcategory_id,
                        Subcategory.category_id == category_id,
                    )
                )
                if not sub:
                    sub = self.db.scalar(select(Subcategory).where(Subcategory.id == subcategory_id))
            else:
                sub = self.db.scalar(select(Subcategory).where(Subcategory.category_id == category_id))
                if not sub:
                    sub = Subcategory(
                        category_id=category_id,
                        code="SUB-EXCEL-01",
                        name="Prácticas Automatizadas",
                        description="Ejercicios prácticos generados por motor algorítmico.",
                        is_active=True,
                    )
                    self.db.add(sub)
                    self.db.commit()
                    self.db.refresh(sub)

            subcategory_id = sub.id if sub else None
            subcategory_name = sub.name if sub else None

            max_time = 600 if payload.difficulty == "basic" else 900 if payload.difficulty == "intermediate" else 1200

            question = Question(
                category_id=category_id,
                subcategory_id=subcategory_id,
                excel_exercise_id=exercise.id,
                difficulty=payload.difficulty or bp.difficulty,
                question_type="excel_practical",
                statement=f"Descarga el archivo de Excel '{exercise.name}', sigue las instrucciones indicadas en la hoja '{exercise.task_sheet_name}' y sube tu entrega resuelta para calificar.",
                correct_answer="Solución validada contra matriz algorítmica de control.",
                feedback="Ejercicio práctico calificado automáticamente mediante validación de fórmulas, tablas dinámicas y celdas de control.",
                max_time_seconds=max_time,
                score=10.0,
                is_active=True,
            )
            self.db.add(question)
            self.db.commit()
            self.db.refresh(question)
            question_id = question.id

            # 6. Optionally assign to Evaluation Template
            if payload.assign_to_template_id:
                assign_res = self.assign_exercise_to_template(
                    AssignExerciseToTemplateRequest(
                        question_id=question.id,
                        template_id=payload.assign_to_template_id,
                        mode=payload.template_section_mode or "new_section",
                        section_id=payload.target_section_id,
                        time_limit_seconds=payload.section_time_limit_seconds or max_time,
                        weight_override=payload.section_weight or 10.0,
                    )
                )
                assigned_template_id = assign_res.template_id
                assigned_template_name = assign_res.template_name

        return GeneratedExerciseSummaryRead(
            exercise_id=exercise.id,
            question_id=question_id,
            name=exercise.name,
            blueprint_id=payload.blueprint_id,
            industry=payload.industry_id,
            difficulty=payload.difficulty or bp.difficulty,
            row_count=payload.row_count,
            source_sheet_name=exercise.source_sheet_name,
            task_sheet_name=exercise.task_sheet_name,
            instructions=exercise.instructions or "",
            criteria_count=len(criteria_mapping),
            total_target_cells=total_target_cells,
            sample_metrics={k: v for k, v in expected_summary.items() if k != "__criteria__"},
            category_id=payload.category_id,
            category_name=category_name,
            subcategory_id=payload.subcategory_id,
            subcategory_name=subcategory_name,
            template_id=assigned_template_id,
            template_name=assigned_template_name,
            assigned_to_template=assigned_template_id is not None,
        )

    def assign_exercise_to_template(
        self,
        payload: AssignExerciseToTemplateRequest,
    ) -> AssignExerciseToTemplateResponse:
        question = self.db.scalar(select(Question).where(Question.id == payload.question_id))
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La pregunta con ID {payload.question_id} no existe en el banco de preguntas.",
            )

        template = self.db.scalar(
            select(EvaluationTemplate).where(EvaluationTemplate.id == payload.template_id)
        )
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"La plantilla de evaluación con ID {payload.template_id} no existe.",
            )

        target_section_id: int | None = None

        if payload.mode == "existing_section" and payload.section_id:
            section = self.db.scalar(
                select(EvaluationTemplateSection).where(
                    EvaluationTemplateSection.id == payload.section_id,
                    EvaluationTemplateSection.evaluation_template_id == template.id,
                )
            )
            if not section:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"La sección con ID {payload.section_id} no pertenece a la plantilla '{template.name}'.",
                )
            
            section.category_id = question.category_id
            section.subcategory_id = question.subcategory_id
            section.difficulty = question.difficulty
            section.question_type = "excel_practical"
            if payload.time_limit_seconds:
                section.time_limit_seconds = payload.time_limit_seconds
            if payload.weight_override:
                section.weight_override = payload.weight_override
            
            target_section_id = section.id
        else:
            # Mode "new_section"
            max_sort = self.db.scalar(
                select(func.max(EvaluationTemplateSection.sort_order)).where(
                    EvaluationTemplateSection.evaluation_template_id == template.id
                )
            ) or 0

            new_section = EvaluationTemplateSection(
                evaluation_template_id=template.id,
                category_id=question.category_id,
                subcategory_id=question.subcategory_id,
                difficulty=question.difficulty,
                question_type="excel_practical",
                question_count=1,
                time_limit_seconds=payload.time_limit_seconds or question.max_time_seconds or 900,
                weight_override=payload.weight_override or 10.0,
                sort_order=max_sort + 1,
            )
            self.db.add(new_section)
            self.db.flush()
            target_section_id = new_section.id

        self.db.commit()

        return AssignExerciseToTemplateResponse(
            success=True,
            message=f"Ejercicio '{question.statement[:40]}...' asignado exitosamente a la plantilla '{template.name}'.",
            template_id=template.id,
            template_name=template.name,
            section_id=target_section_id or 0,
        )
