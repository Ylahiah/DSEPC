import os
import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.repositories.system_setting_repository import SystemSettingRepository
from app.schemas.system_setting import SystemSettingRead, SystemSettingUpdate


class SystemSettingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = SystemSettingRepository(db)
        
        # Ensure the assets directory exists
        self.assets_dir = Path("storage/assets")
        self.assets_dir.mkdir(parents=True, exist_ok=True)

    def get_settings(self) -> SystemSettingRead:
        settings = self.repository.get_settings()
        return SystemSettingRead.model_validate(settings)

    def update_settings(self, payload: SystemSettingUpdate) -> SystemSettingRead:
        settings = self.repository.get_settings()
        settings.company_name = payload.company_name
        settings.welcome_message = payload.welcome_message
        settings.primary_color = payload.primary_color
        self.repository.commit()
        return SystemSettingRead.model_validate(settings)

    def update_logo(self, file: UploadFile | None) -> SystemSettingRead:
        settings = self.repository.get_settings()
        
        if file is None:
            # Delete existing logo if it exists
            if settings.logo_filename:
                old_logo_path = self.assets_dir / settings.logo_filename
                if old_logo_path.exists():
                    os.remove(old_logo_path)
            settings.logo_filename = None
        else:
            # Generate a random filename with the original extension
            extension = Path(file.filename or "").suffix
            if not extension:
                extension = ".png" # fallback
            
            new_filename = f"logo_{uuid.uuid4().hex}{extension}"
            file_path = self.assets_dir / new_filename
            
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            # Delete old logo
            if settings.logo_filename:
                old_logo_path = self.assets_dir / settings.logo_filename
                if old_logo_path.exists():
                    os.remove(old_logo_path)
                    
            settings.logo_filename = new_filename

        self.repository.commit()
        return SystemSettingRead.model_validate(settings)

    def get_logo_path(self) -> Path | None:
        settings = self.repository.get_settings()
        if settings.logo_filename:
            path = self.assets_dir / settings.logo_filename
            if path.exists():
                return path
        return None
