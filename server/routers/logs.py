from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import OperationLog
from schemas import OperationLogOut
from auth import get_current_user

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/", response_model=List[OperationLogOut])
def list_logs(limit: int = Query(50), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(OperationLog).order_by(OperationLog.created_at.desc()).limit(limit).all()