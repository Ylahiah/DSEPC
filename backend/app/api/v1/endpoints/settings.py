from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.security import get_current_admin
from app.db.session import get_db
from app.schemas.system_setting import SystemSettingRead, SystemSettingUpdate
from app.services.system_setting_service import SystemSettingService


router = APIRouter()


@router.get("/", response_model=SystemSettingRead)
def get_settings(db: Annotated[Session, Depends(get_db)]) -> SystemSettingRead:
    return SystemSettingService(db).get_settings()


@router.put("/", response_model=SystemSettingRead)
def update_settings(
    payload: SystemSettingUpdate,
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
) -> SystemSettingRead:
    return SystemSettingService(db).update_settings(payload)


@router.post("/logo", response_model=SystemSettingRead)
def update_logo(
    _: Annotated[object, Depends(get_current_admin)],
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile | None = None,
) -> SystemSettingRead:
    # Validate file type if present
    if file is not None and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen.",
        )
    return SystemSettingService(db).update_logo(file)


@router.get("/logo")
def get_logo(db: Annotated[Session, Depends(get_db)]):
    logo_path = SystemSettingService(db).get_logo_path()
    if not logo_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay logotipo configurado.",
        )
    return FileResponse(logo_path)
