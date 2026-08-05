from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.excel_exercise import ExcelExerciseForm, ExcelExerciseRead, ExcelExerciseStatusUpdate
from app.services.excel_exercise_service import ExcelExerciseService


router = APIRouter()


@router.get("", response_model=list[ExcelExerciseRead])
def list_excel_exercises(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ExcelExerciseRead]:
    return ExcelExerciseService(db).list_exercises()


@router.post("", response_model=ExcelExerciseRead, status_code=status.HTTP_201_CREATED)
def create_excel_exercise(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    name: str = Form(...),
    description: str | None = Form(default=None),
    instructions: str | None = Form(default=None),
    source_sheet_name: str = Form(default="BaseDatos"),
    task_sheet_name: str = Form(default="RealizaEjercicio"),
    is_active: bool = Form(default=True),
    workbook: UploadFile = File(...),
    solution_workbook: UploadFile = File(...),
) -> ExcelExerciseRead:
    payload = ExcelExerciseForm(
        name=name,
        description=description,
        instructions=instructions,
        source_sheet_name=source_sheet_name,
        task_sheet_name=task_sheet_name,
        is_active=is_active,
    )
    return ExcelExerciseService(db).create_exercise(payload, workbook, solution_workbook)


@router.put("/{exercise_id}", response_model=ExcelExerciseRead)
def update_excel_exercise(
    exercise_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    name: str = Form(...),
    description: str | None = Form(default=None),
    instructions: str | None = Form(default=None),
    source_sheet_name: str = Form(default="BaseDatos"),
    task_sheet_name: str = Form(default="RealizaEjercicio"),
    is_active: bool = Form(default=True),
    workbook: UploadFile | None = File(default=None),
    solution_workbook: UploadFile | None = File(default=None),
) -> ExcelExerciseRead:
    payload = ExcelExerciseForm(
        name=name,
        description=description,
        instructions=instructions,
        source_sheet_name=source_sheet_name,
        task_sheet_name=task_sheet_name,
        is_active=is_active,
    )
    return ExcelExerciseService(db).update_exercise(exercise_id, payload, workbook, solution_workbook)


@router.patch("/{exercise_id}/status", response_model=ExcelExerciseRead)
def set_excel_exercise_status(
    exercise_id: int,
    payload: ExcelExerciseStatusUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> ExcelExerciseRead:
    return ExcelExerciseService(db).set_status(exercise_id, payload.is_active)


@router.get("/{exercise_id}/download")
def download_excel_exercise(
    exercise_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    file_buffer, filename = ExcelExerciseService(db).get_download(exercise_id)
    return StreamingResponse(
        file_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_excel_exercise(
    exercise_id: int,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    ExcelExerciseService(db).delete_exercise(exercise_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
