from io import BytesIO
import re
import unicodedata

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from openpyxl import Workbook
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.excel_exercise import ExcelExercise
from app.models.evaluation_template_section import EvaluationTemplateSection
from app.models.evaluation_session_question import EvaluationSessionQuestion
from app.models.question import Question
from app.models.question_option import QuestionOption
from app.models.subcategory import Subcategory
from app.repositories.category_repository import CategoryRepository
from app.repositories.question_repository import QuestionRepository
from app.repositories.subcategory_repository import SubcategoryRepository
from app.schemas.question_bank import (
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    QuestionCreate,
    QuestionListItem,
    QuestionImportRowError,
    QuestionImportSummary,
    QuestionOptionRead,
    QuestionRead,
    QuestionUpdate,
    SubcategoryCreate,
    SubcategoryRead,
    SubcategoryUpdate,
)


class QuestionBankService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.category_repository = CategoryRepository(db)
        self.subcategory_repository = SubcategoryRepository(db)
        self.question_repository = QuestionRepository(db)

    def list_categories(self) -> list[CategoryRead]:
        categories = self.category_repository.list_all()
        subcategories = self.subcategory_repository.list_all()
        questions = self.question_repository.list_all()

        subcategory_counts: dict[int, int] = {}
        question_counts: dict[int, int] = {}

        for subcategory in subcategories:
            subcategory_counts[subcategory.category_id] = (
                subcategory_counts.get(subcategory.category_id, 0) + 1
            )

        for question in questions:
            question_counts[question.category_id] = question_counts.get(question.category_id, 0) + 1

        return [
            CategoryRead(
                id=category.id,
                code=category.code,
                name=category.name,
                description=category.description,
                weight=category.weight,
                is_active=category.is_active,
                created_at=category.created_at,
                subcategory_count=subcategory_counts.get(category.id, 0),
                question_count=question_counts.get(category.id, 0),
            )
            for category in categories
        ]

    def create_category(self, payload: CategoryCreate) -> CategoryRead:
        self._ensure_unique_category_name(payload.name)
        self._ensure_unique_category_code(payload.code)

        category = Category(
            code=payload.code,
            name=payload.name,
            description=payload.description,
            weight=payload.weight,
        )
        created_category = self.category_repository.add(category)
        return self._build_category_read(created_category)

    def update_category(self, category_id: int, payload: CategoryUpdate) -> CategoryRead:
        category = self._get_category_or_404(category_id)

        existing_by_name = self.category_repository.get_by_name(payload.name)
        if existing_by_name and existing_by_name.id != category_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoria con ese nombre.",
            )

        existing_by_code = self.category_repository.get_by_code(payload.code)
        if existing_by_code and existing_by_code.id != category_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoria con ese codigo.",
            )

        category.code = payload.code
        category.name = payload.name
        category.description = payload.description
        category.weight = payload.weight
        self.category_repository.commit()
        return self._build_category_read(category)

    def set_category_status(self, category_id: int, is_active: bool) -> CategoryRead:
        category = self._get_category_or_404(category_id)
        category.is_active = is_active
        self.category_repository.commit()
        return self._build_category_read(category)

    def delete_category(self, category_id: int) -> None:
        category = self._get_category_or_404(category_id)
        subcategory_count = self.db.scalar(
            select(func.count(Subcategory.id)).where(Subcategory.category_id == category_id)
        ) or 0
        if subcategory_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La categoria no se puede eliminar porque aun tiene "
                    f"{subcategory_count} subcategoria(s) asociada(s)."
                ),
            )
        question_count = self.db.scalar(
            select(func.count(Question.id)).where(Question.category_id == category_id)
        ) or 0
        if question_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La categoria no se puede eliminar porque aun tiene "
                    f"{question_count} pregunta(s) asociada(s)."
                ),
            )

        linked_template_section_count = self.db.scalar(
            select(func.count(EvaluationTemplateSection.id)).where(
                EvaluationTemplateSection.category_id == category_id
            )
        ) or 0
        if linked_template_section_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La categoria no se puede eliminar porque aun se utiliza en "
                    f"{linked_template_section_count} seccion(es) de plantilla."
                ),
            )

        self.db.delete(category)
        self.category_repository.commit()

    def list_subcategories(self) -> list[SubcategoryRead]:
        subcategories = self.subcategory_repository.list_all()
        questions = self.question_repository.list_all()
        question_counts: dict[int, int] = {}

        for question in questions:
            question_counts[question.subcategory_id] = (
                question_counts.get(question.subcategory_id, 0) + 1
            )

        return [
            SubcategoryRead(
                id=subcategory.id,
                category_id=subcategory.category_id,
                category_name=subcategory.category.name,
                name=subcategory.name,
                description=subcategory.description,
                is_active=subcategory.is_active,
                created_at=subcategory.created_at,
                question_count=question_counts.get(subcategory.id, 0),
            )
            for subcategory in subcategories
        ]

    def create_subcategory(self, payload: SubcategoryCreate) -> SubcategoryRead:
        category = self._get_category_or_404(payload.category_id)
        self._ensure_unique_subcategory_name(payload.category_id, payload.name)

        subcategory = Subcategory(
            category_id=payload.category_id,
            name=payload.name,
            description=payload.description,
        )
        created_subcategory = self.subcategory_repository.add(subcategory)
        self.db.refresh(created_subcategory, attribute_names=["category"])
        return self._build_subcategory_read(created_subcategory, category_name=category.name)

    def update_subcategory(self, subcategory_id: int, payload: SubcategoryUpdate) -> SubcategoryRead:
        category = self._get_category_or_404(payload.category_id)
        subcategory = self._get_subcategory_or_404(subcategory_id)

        existing_subcategory = self.subcategory_repository.get_by_name_in_category(
            category_id=payload.category_id,
            name=payload.name,
        )
        if existing_subcategory and existing_subcategory.id != subcategory_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una subcategoria con ese nombre en la categoria seleccionada.",
            )

        subcategory.category_id = payload.category_id
        subcategory.name = payload.name
        subcategory.description = payload.description
        self.subcategory_repository.commit()
        return self._build_subcategory_read(subcategory, category_name=category.name)

    def set_subcategory_status(self, subcategory_id: int, is_active: bool) -> SubcategoryRead:
        subcategory = self._get_subcategory_or_404(subcategory_id)
        subcategory.is_active = is_active
        self.subcategory_repository.commit()
        return self._build_subcategory_read(
            subcategory,
            category_name=subcategory.category.name,
        )

    def delete_subcategory(self, subcategory_id: int) -> None:
        subcategory = self._get_subcategory_or_404(subcategory_id)
        question_count = self.db.scalar(
            select(func.count(Question.id)).where(Question.subcategory_id == subcategory_id)
        ) or 0
        if question_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La subcategoria no se puede eliminar porque aun tiene "
                    f"{question_count} pregunta(s) asociada(s)."
                ),
            )

        linked_template_section_count = self.db.scalar(
            select(func.count(EvaluationTemplateSection.id)).where(
                EvaluationTemplateSection.subcategory_id == subcategory_id
            )
        ) or 0
        if linked_template_section_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La subcategoria no se puede eliminar porque aun se utiliza en "
                    f"{linked_template_section_count} seccion(es) de plantilla."
                ),
            )

        self.db.delete(subcategory)
        self.subcategory_repository.commit()

    def list_questions(
        self,
        *,
        category_id: int | None = None,
        subcategory_id: int | None = None,
        difficulty: str | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> list[QuestionListItem]:
        questions = self.question_repository.list_all()
        filtered_questions = []

        for question in questions:
            if category_id is not None and question.category_id != category_id:
                continue
            if subcategory_id is not None and question.subcategory_id != subcategory_id:
                continue
            if difficulty and question.difficulty != difficulty.strip().lower():
                continue
            if is_active is not None and question.is_active != is_active:
                continue
            if search and search.strip().lower() not in question.statement.lower():
                continue
            filtered_questions.append(question)

        return [
            QuestionListItem(
                id=question.id,
                category_id=question.category_id,
                category_name=question.category.name,
                subcategory_id=question.subcategory_id,
                subcategory_name=question.subcategory.name,
                excel_exercise_id=question.excel_exercise_id,
                excel_exercise_name=question.excel_exercise.name if question.excel_exercise else None,
                difficulty=question.difficulty,
                question_type=question.question_type,
                statement=question.statement,
                max_time_seconds=question.max_time_seconds,
                score=question.score,
                is_active=question.is_active,
                option_count=len(question.options),
                created_at=question.created_at,
            )
            for question in filtered_questions
        ]

    def get_question(self, question_id: int) -> QuestionRead:
        question = self._get_question_or_404(question_id)
        return self._build_question_read(question)

    def create_question(self, payload: QuestionCreate) -> QuestionRead:
        category = self._get_category_or_404(payload.category_id)
        subcategory = self._get_subcategory_or_404(payload.subcategory_id)
        self._validate_subcategory_belongs_to_category(category, subcategory)
        self._validate_question_payload(payload)
        excel_exercise = self._validate_excel_exercise(payload.excel_exercise_id, payload.question_type)

        question = Question(
            category_id=payload.category_id,
            subcategory_id=payload.subcategory_id,
            excel_exercise_id=excel_exercise.id if excel_exercise else None,
            difficulty=payload.difficulty,
            question_type=payload.question_type,
            statement=payload.statement,
            correct_answer=payload.correct_answer,
            feedback=payload.feedback,
            max_time_seconds=payload.max_time_seconds,
            score=payload.score,
            options=[
                QuestionOption(option_text=option.option_text, option_order=index + 1)
                for index, option in enumerate(payload.options)
            ],
        )
        created_question = self.question_repository.add(question)
        hydrated_question = self._get_question_or_404(created_question.id)
        return self._build_question_read(hydrated_question)

    def import_questions_from_excel(self, file: UploadFile) -> QuestionImportSummary:
        if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo debe estar en formato Excel (.xlsx o .xlsm).",
            )

        try:
            workbook_bytes = file.file.read()
            dataframe = pd.read_excel(BytesIO(workbook_bytes), dtype=str).fillna("")
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fue posible leer el archivo Excel. Verifica que la plantilla sea valida.",
            ) from exc

        if dataframe.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo Excel no contiene registros para importar.",
            )

        normalized_headers = {
            self._normalize_header(str(column)): str(column) for column in dataframe.columns
        }
        required_headers = [
            "categoria",
            "subcategoria",
            "dificultad",
            "tipo_de_pregunta",
            "tiempo_maximo",
            "puntaje",
            "pregunta",
            "respuesta_correcta",
        ]
        missing_headers = [
            header for header in required_headers if header not in normalized_headers
        ]
        if missing_headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Faltan columnas obligatorias en la plantilla: "
                    + ", ".join(missing_headers)
                    + "."
                ),
            )

        option_columns = [
            original_header
            for normalized_header, original_header in normalized_headers.items()
            if normalized_header.startswith("opcion") or normalized_header.startswith("opciones")
        ]
        if len(option_columns) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La plantilla debe incluir al menos dos columnas de opciones.",
            )

        created_categories = 0
        created_subcategories = 0
        created_questions = 0
        errors: list[QuestionImportRowError] = []

        rows_to_create: list[Question] = []
        known_categories: dict[str, Category] = {
            self._normalize_name_key(category.name): category
            for category in self.category_repository.list_all()
        }
        known_subcategories: dict[tuple[int, str], Subcategory] = {
            (subcategory.category_id, self._normalize_name_key(subcategory.name)): subcategory
            for subcategory in self.subcategory_repository.list_all()
        }

        for dataframe_index, row in dataframe.iterrows():
            row_number = dataframe_index + 2
            try:
                category_name = str(row[normalized_headers["categoria"]]).strip()
                subcategory_name = str(row[normalized_headers["subcategoria"]]).strip()
                difficulty = self._map_difficulty(str(row[normalized_headers["dificultad"]]))
                question_type = self._map_question_type(
                    str(row[normalized_headers["tipo_de_pregunta"]])
                )
                max_time_seconds = self._parse_positive_int(
                    row[normalized_headers["tiempo_maximo"]],
                    field_name="tiempo maximo",
                )
                score = self._parse_positive_float(
                    row[normalized_headers["puntaje"]],
                    field_name="puntaje",
                )
                statement = str(row[normalized_headers["pregunta"]]).strip()
                correct_answer = str(row[normalized_headers["respuesta_correcta"]]).strip()
                feedback = (
                    str(row[normalized_headers["retroalimentacion"]]).strip()
                    if "retroalimentacion" in normalized_headers
                    else ""
                )

                option_values = [
                    str(row[column]).strip()
                    for column in option_columns
                    if str(row[column]).strip()
                ]

                if not category_name:
                    raise ValueError("La categoria es obligatoria.")
                if not subcategory_name:
                    raise ValueError("La subcategoria es obligatoria.")
                if len(statement) < 10:
                    raise ValueError("La pregunta debe tener al menos 10 caracteres.")
                if len(option_values) < 2:
                    raise ValueError("La pregunta debe incluir al menos dos opciones.")

                category_key = self._normalize_name_key(category_name)
                category = known_categories.get(category_key)
                if not category:
                    category = Category(
                        code=self._build_unique_category_code(category_name),
                        name=category_name,
                        description="Importada desde plantilla Excel.",
                        weight=1.0,
                        is_active=True,
                    )
                    self.db.add(category)
                    self.db.flush()
                    known_categories[category_key] = category
                    created_categories += 1

                subcategory_key = (category.id, self._normalize_name_key(subcategory_name))
                subcategory = known_subcategories.get(subcategory_key)
                if not subcategory:
                    subcategory = Subcategory(
                        category_id=category.id,
                        name=subcategory_name,
                        description="Importada desde plantilla Excel.",
                        is_active=True,
                    )
                    self.db.add(subcategory)
                    self.db.flush()
                    known_subcategories[subcategory_key] = subcategory
                    created_subcategories += 1

                normalized_option_texts = [option.strip() for option in option_values]
                if len(set(text.lower() for text in normalized_option_texts)) != len(
                    normalized_option_texts
                ):
                    raise ValueError("No puede haber opciones duplicadas en la misma fila.")

                normalized_correct_answer = self._resolve_correct_answer(
                    correct_answer,
                    normalized_option_texts,
                )

                rows_to_create.append(
                    Question(
                        category_id=category.id,
                        subcategory_id=subcategory.id,
                        difficulty=difficulty,
                        question_type=question_type,
                        statement=statement,
                        correct_answer=normalized_correct_answer,
                        feedback=feedback or None,
                        max_time_seconds=max_time_seconds,
                        score=score,
                        is_active=True,
                        options=[
                            QuestionOption(option_text=option_text, option_order=index + 1)
                            for index, option_text in enumerate(normalized_option_texts)
                        ],
                    )
                )
            except ValueError as exc:
                errors.append(QuestionImportRowError(row_number=row_number, message=str(exc)))

        if errors:
            self.db.rollback()
            return QuestionImportSummary(
                created_categories=0,
                created_subcategories=0,
                created_questions=0,
                errors=errors,
            )

        for question in rows_to_create:
            self.db.add(question)

        self.db.commit()
        created_questions = len(rows_to_create)

        return QuestionImportSummary(
            created_categories=created_categories,
            created_subcategories=created_subcategories,
            created_questions=created_questions,
            errors=[],
        )

    def build_question_import_template(self) -> BytesIO:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Preguntas"
        worksheet.append(
            [
                "Categoria",
                "Subcategoria",
                "Dificultad",
                "Tipo de pregunta",
                "Tiempo maximo",
                "Puntaje",
                "Pregunta",
                "Opcion 1",
                "Opcion 2",
                "Opcion 3",
                "Opcion 4",
                "Respuesta correcta",
                "Retroalimentacion",
            ]
        )
        worksheet.append(
            [
                "Comprension matematica",
                "Aritmetica basica",
                "Basica",
                "Opcion multiple",
                60,
                2,
                "En el almacen existen 780 envases de Acido Acetilsalicilico y 925 de Paracetamol. ¿Cuantos mas hay de Paracetamol?",
                "135",
                "140",
                "145",
                "150",
                "145",
                "Basico - suma, resta y conteo aplicado al almacen.",
            ]
        )

        output = BytesIO()
        workbook.save(output)
        output.seek(0)
        return output

    def update_question(self, question_id: int, payload: QuestionUpdate) -> QuestionRead:
        category = self._get_category_or_404(payload.category_id)
        subcategory = self._get_subcategory_or_404(payload.subcategory_id)
        question = self._get_question_or_404(question_id)

        self._validate_subcategory_belongs_to_category(category, subcategory)
        self._validate_question_payload(payload)
        excel_exercise = self._validate_excel_exercise(payload.excel_exercise_id, payload.question_type)

        question.category_id = payload.category_id
        question.subcategory_id = payload.subcategory_id
        question.excel_exercise_id = excel_exercise.id if excel_exercise else None
        question.difficulty = payload.difficulty
        question.question_type = payload.question_type
        question.statement = payload.statement
        question.correct_answer = payload.correct_answer
        question.feedback = payload.feedback
        question.max_time_seconds = payload.max_time_seconds
        question.score = payload.score
        question.options.clear()
        question.options.extend(
            QuestionOption(option_text=option.option_text, option_order=index + 1)
            for index, option in enumerate(payload.options)
        )

        self.question_repository.commit()
        hydrated_question = self._get_question_or_404(question.id)
        return self._build_question_read(hydrated_question)

    def set_question_status(self, question_id: int, is_active: bool) -> QuestionRead:
        question = self._get_question_or_404(question_id)
        question.is_active = is_active
        self.question_repository.commit()
        return self._build_question_read(self._get_question_or_404(question_id))

    def delete_question(self, question_id: int) -> None:
        question = self._get_question_or_404(question_id)
        usage_count = self.db.scalar(
            select(func.count(EvaluationSessionQuestion.id)).where(
                EvaluationSessionQuestion.question_id == question_id
            )
        ) or 0
        if usage_count:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La pregunta no se puede eliminar porque ya fue utilizada en "
                    f"{usage_count} registro(s) de evaluacion."
                ),
            )

        self.db.delete(question)
        self.question_repository.commit()

    def _ensure_unique_category_name(self, name: str) -> None:
        if self.category_repository.get_by_name(name):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoria con ese nombre.",
            )

    def _ensure_unique_category_code(self, code: str) -> None:
        if self.category_repository.get_by_code(code):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una categoria con ese codigo.",
            )

    def _ensure_unique_subcategory_name(self, category_id: int, name: str) -> None:
        if self.subcategory_repository.get_by_name_in_category(
            category_id=category_id,
            name=name,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una subcategoria con ese nombre en la categoria seleccionada.",
            )

    def _validate_subcategory_belongs_to_category(
        self,
        category: Category,
        subcategory: Subcategory,
    ) -> None:
        if subcategory.category_id != category.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La subcategoria no pertenece a la categoria seleccionada.",
            )

    def _validate_question_payload(self, payload: QuestionCreate | QuestionUpdate) -> None:
        if payload.question_type == "excel_practical":
            if payload.options:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Las preguntas practicas de Excel no deben incluir opciones.",
                )
            if payload.correct_answer.strip().lower() not in {"archivo validado", "excel validado"}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La respuesta correcta para el ejercicio Excel debe indicar archivo validado.",
                )
            return

        options = payload.options
        correct_answer = payload.correct_answer
        if len(options) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La pregunta debe tener al menos dos opciones.",
            )

        option_texts = [option.option_text.strip() for option in options if option.option_text.strip()]
        if len(option_texts) != len(options):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Todas las opciones deben contener texto.",
            )

        if len(set(text.lower() for text in option_texts)) != len(option_texts):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puede haber opciones duplicadas.",
            )

        if correct_answer.strip().lower() not in {text.lower() for text in option_texts}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La respuesta correcta debe existir dentro de las opciones.",
            )

    def _validate_excel_exercise(
        self,
        excel_exercise_id: int | None,
        question_type: str,
    ) -> ExcelExercise | None:
        if question_type != "excel_practical":
            return None

        if excel_exercise_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selecciona un ejercicio practico de Excel para este tipo de pregunta.",
            )

        exercise = self.db.get(ExcelExercise, excel_exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El ejercicio practico seleccionado no existe.",
            )

        return exercise

    def _normalize_header(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        normalized = "".join(char for char in normalized if not unicodedata.combining(char))
        normalized = normalized.strip().lower()
        normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
        return normalized.strip("_")

    def _normalize_name_key(self, value: str) -> str:
        return self._normalize_header(value)

    def _map_difficulty(self, raw_value: str) -> str:
        normalized = self._normalize_header(raw_value)
        difficulty_map = {
            "basica": "basic",
            "basic": "basic",
            "intermedia": "intermediate",
            "intermedio": "intermediate",
            "intermediate": "intermediate",
            "avanzada": "advanced",
            "avanzado": "advanced",
            "advanced": "advanced",
        }
        if normalized not in difficulty_map:
            raise ValueError("La dificultad no es valida.")
        return difficulty_map[normalized]

    def _map_question_type(self, raw_value: str) -> str:
        normalized = self._normalize_header(raw_value)
        type_map = {
            "opcion_multiple": "multiple_choice",
            "opciones_multiples": "multiple_choice",
            "multiple_choice": "multiple_choice",
            "multiple": "multiple_choice",
        }
        if normalized not in type_map:
            raise ValueError("El tipo de pregunta no es valido.")
        return type_map[normalized]

    def _parse_positive_int(self, raw_value: object, *, field_name: str) -> int:
        try:
            value = int(float(str(raw_value).strip()))
        except Exception as exc:
            raise ValueError(f"El campo {field_name} debe ser numerico.") from exc
        if value <= 0:
            raise ValueError(f"El campo {field_name} debe ser mayor que cero.")
        return value

    def _parse_positive_float(self, raw_value: object, *, field_name: str) -> float:
        normalized_value = str(raw_value).strip().replace(",", ".")
        try:
            value = float(normalized_value)
        except Exception as exc:
            raise ValueError(f"El campo {field_name} debe ser numerico.") from exc
        if value <= 0:
            raise ValueError(f"El campo {field_name} debe ser mayor que cero.")
        return value

    def _build_unique_category_code(self, category_name: str) -> str:
        base_code = self._normalize_header(category_name).replace("_", "").upper()[:10] or "CAT"
        candidate_code = base_code
        suffix = 1
        while self.category_repository.get_by_code(candidate_code):
            suffix += 1
            candidate_code = f"{base_code[: max(1, 10 - len(str(suffix)))]}{suffix}"
        return candidate_code

    def _resolve_correct_answer(self, correct_answer: str, options: list[str]) -> str:
        normalized_answer = correct_answer.strip()
        if not normalized_answer:
            raise ValueError("La respuesta correcta es obligatoria.")

        normalized_option_map = {option.lower(): option for option in options}
        direct_match = normalized_option_map.get(normalized_answer.lower())
        if direct_match:
            return direct_match

        letter_match = re.match(r"^([A-Za-z])[\)\.\-:\s]*(.+)$", normalized_answer)
        if letter_match:
            option_letter = letter_match.group(1).upper()
            option_index = ord(option_letter) - ord("A")
            if 0 <= option_index < len(options):
                return options[option_index]

        if len(normalized_answer) == 1 and normalized_answer.upper() in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            option_index = ord(normalized_answer.upper()) - ord("A")
            if 0 <= option_index < len(options):
                return options[option_index]

        raise ValueError("La respuesta correcta debe existir dentro de las opciones.")

    def _get_category_or_404(self, category_id: int) -> Category:
        category = self.category_repository.get_by_id(category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La categoria no existe.",
            )
        return category

    def _get_subcategory_or_404(self, subcategory_id: int) -> Subcategory:
        subcategory = self.subcategory_repository.get_by_id(subcategory_id)
        if not subcategory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La subcategoria no existe.",
            )
        return subcategory

    def _get_question_or_404(self, question_id: int) -> Question:
        question = self.question_repository.get_by_id(question_id)
        if not question:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La pregunta no existe.",
            )
        return question

    def _build_category_read(self, category: Category) -> CategoryRead:
        subcategory_count = len(category.subcategories)
        question_count = len(category.questions)
        return CategoryRead(
            id=category.id,
            code=category.code,
            name=category.name,
            description=category.description,
            weight=category.weight,
            is_active=category.is_active,
            created_at=category.created_at,
            subcategory_count=subcategory_count,
            question_count=question_count,
        )

    def _build_subcategory_read(
        self,
        subcategory: Subcategory,
        *,
        category_name: str | None = None,
    ) -> SubcategoryRead:
        resolved_category_name = category_name or subcategory.category.name
        question_count = len(subcategory.questions)
        return SubcategoryRead(
            id=subcategory.id,
            category_id=subcategory.category_id,
            category_name=resolved_category_name,
            name=subcategory.name,
            description=subcategory.description,
            is_active=subcategory.is_active,
            created_at=subcategory.created_at,
            question_count=question_count,
        )

    def _build_question_read(self, question: Question) -> QuestionRead:
        return QuestionRead(
            id=question.id,
            category_id=question.category_id,
            category_name=question.category.name,
            subcategory_id=question.subcategory_id,
            subcategory_name=question.subcategory.name,
            excel_exercise_id=question.excel_exercise_id,
            excel_exercise_name=question.excel_exercise.name if question.excel_exercise else None,
            difficulty=question.difficulty,
            question_type=question.question_type,
            statement=question.statement,
            correct_answer=question.correct_answer,
            feedback=question.feedback,
            max_time_seconds=question.max_time_seconds,
            score=question.score,
            is_active=question.is_active,
            created_at=question.created_at,
            options=[
                QuestionOptionRead(
                    id=option.id,
                    option_text=option.option_text,
                    option_order=option.option_order,
                )
                for option in question.options
            ],
        )
