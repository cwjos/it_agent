from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from database import get_db
from models import Employee
from schemas import LoginRequest, RegisterRequest, EmployeeOut
from auth import verify_password, get_password_hash, create_access_token,get_current_user
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.email == req.email).first()
    if not employee:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    if not employee.password_hash:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if not verify_password(req.password, employee.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    if employee.status != "active":
        raise HTTPException(status_code=400, detail="Account is not active")

    employee.last_login_at = func.now()
    db.commit()

    access_token = create_access_token(data={"sub": employee.id})
    return {"token": access_token, "employee": employee}

@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(Employee).filter(Employee.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    emp_no = f"EMP{str(uuid.uuid4())[:8].upper()}"
    hashed = get_password_hash(req.password)
    new_emp = Employee(
        id=str(uuid.uuid4()),
        employee_no=emp_no,
        name=req.name,
        email=req.email,
        password_hash=hashed,
        role="user",
        status="active"
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return {"message": "Registration successful", "employee": new_emp}

@router.get("/me", response_model=EmployeeOut)
def get_me(current_user: Employee = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout():
    return {"message": "Logged out"}