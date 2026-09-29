from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Department
from schemas import DepartmentCreate, DepartmentOut
from auth import get_current_user
import uuid

router = APIRouter(prefix="/departments", tags=["departments"])

@router.get("/", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.sort_order).all()

@router.post("/", response_model=DepartmentOut)
def create_department(data: DepartmentCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    new_dept = Department(
        id=str(uuid.uuid4()),
        name=data.name,
        code=data.code,
        description=data.description,
        parent_id=data.parent_id,
        sort_order=data.sort_order,
    )
    db.add(new_dept)
    db.commit()
    db.refresh(new_dept)
    return new_dept