from io import BytesIO
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.excel_generator import (
    AssignExerciseToTemplateRequest,
    AssignExerciseToTemplateResponse,
    BlueprintRead,
    GenerateExerciseRequest,
    GeneratedExerciseSummaryRead,
)
from app.services.excel_generator_service import ExcelGeneratorService

router = APIRouter()


@router.get(
    "/blueprints",
    response_model=list[BlueprintRead],
    summary="Listar blueprints de ejercicios Excel disponibles",
)
def list_blueprints(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
) -> list[BlueprintRead]:
    return ExcelGeneratorService(db).list_blueprints()


@router.get(
    "/preview",
    summary="Descargar vista previa de ejercicio o solución generado en vivo",
)
def preview_exercise_download(
    blueprint_id: str = Query(..., description="ID del Blueprint a generar"),
    title: str = Query("Ejercicio_Practico_Muestra", description="Título del ejercicio"),
    industry_id: str = Query("pharma", description="ID de la industria/giro"),
    row_count: int = Query(150, ge=30, le=1000, description="Cantidad de filas sintéticas"),
    difficulty: str = Query("intermediate", description="Nivel de dificultad: basic, intermediate, advanced"),
    variant: str = Query("candidate", description="'candidate' para el ejercicio o 'solution' para la solución"),
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
) -> StreamingResponse:
    file_buffer, filename = ExcelGeneratorService(db).generate_preview_bytes(
        blueprint_id=blueprint_id,
        title=title,
        industry_id=industry_id,
        row_count=row_count,
        difficulty=difficulty,
        variant_type=variant,
    )
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post(
    "/generate",
    response_model=GeneratedExerciseSummaryRead,
    summary="Generar ejercicio práctico y guardarlo en la plataforma",
)
def generate_and_save_exercise(
    payload: GenerateExerciseRequest,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
) -> GeneratedExerciseSummaryRead:
    return ExcelGeneratorService(db).create_and_save_exercise(payload)


@router.post(
    "/assign-to-template",
    response_model=AssignExerciseToTemplateResponse,
    summary="Asignar un ejercicio práctico a una plantilla de evaluación",
)
def assign_exercise_to_template(
    payload: AssignExerciseToTemplateRequest,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_admin),
) -> AssignExerciseToTemplateResponse:
    return ExcelGeneratorService(db).assign_exercise_to_template(payload)
