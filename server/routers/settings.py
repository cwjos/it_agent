from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import SystemSetting
from schemas import SystemSettingOut
from auth import get_current_user
import uuid

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("/", response_model=List[SystemSettingOut])
def list_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(SystemSetting).all()

@router.put("/{key}", response_model=SystemSettingOut)
def update_setting(key: str, value: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if not setting:
        setting = SystemSetting(key=key, value=value, updated_by=current_user.id)
        db.add(setting)
    else:
        setting.value = value
        setting.updated_by = current_user.id
    db.commit()
    db.refresh(setting)
    return setting