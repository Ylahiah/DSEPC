from sqlalchemy.orm import Session

from app.models.system_setting import SystemSetting


class SystemSettingRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_settings(self) -> SystemSetting:
        settings = self.db.query(SystemSetting).first()
        if not settings:
            settings = SystemSetting()
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def commit(self) -> None:
        self.db.commit()
