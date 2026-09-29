from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import Employee,OperationLog, Ticket
from schemas import EmployeeCreate, EmployeeUpdate, EmployeeOut,BatchStatusUpdateRequest, BatchDeleteRequest
from auth import get_current_user, get_password_hash   # 从 auth 导入
from fastapi import Request
import uuid

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/", response_model=List[EmployeeOut])
def list_employees(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    return db.query(Employee).all()


@router.post("/", response_model=EmployeeOut)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    emp_no = data.employee_no or f"EMP{str(uuid.uuid4())[:8].upper()}"
    new_emp = Employee(
        id=str(uuid.uuid4()),
        employee_no=emp_no,
        name=data.name,
        email=data.email,
        phone=data.phone,
        department_id=data.department_id,
        role=data.role,
        status=data.status,
        title=data.title,
        password_hash=get_password_hash(data.password),  # 关键：哈希密码
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return new_emp


@router.put("/{emp_id}", response_model=EmployeeOut)
def update_employee(emp_id: str, data: EmployeeUpdate, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    if current_user.role != "admin" and current_user.id != emp_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(emp, key, val)
    db.commit()
    db.refresh(emp)
    return emp

@router.delete("/{emp_id}")
def delete_employee(emp_id: str, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(emp)
    db.commit()
    return {"message": "Deleted"}


@router.patch("/batch/status")
def batch_update_status(
        data: BatchStatusUpdateRequest,
        request: Request,
        db: Session = Depends(get_db),
        current_user: Employee = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    # 执行更新
    updated_count = db.query(Employee).filter(Employee.id.in_(data.ids)).update(
        {"status": data.status}, synchronize_session=False
    )

    # 记录操作日志
    log = OperationLog(
        id=str(uuid.uuid4()),
        operator_id=current_user.id,
        operator_name=current_user.name,
        module="Employee",
        action="batch_update_status",
        target=f"ids: {data.ids}",
        detail=f"将 {updated_count} 个用户状态改为 {data.status}",
        ip_address=request.client.host if request.client else None
    )
    db.add(log)
    db.commit()
    return {"message": f"成功更新 {updated_count} 个用户状态"}


@router.delete("/batch")
def batch_delete_employees(
        data: BatchDeleteRequest,
        request: Request,
        db: Session = Depends(get_db),
        current_user: Employee = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    # 检查是否有未完结工单关联这些用户
    open_tickets = db.query(Ticket).filter(
        Ticket.assignee_id.in_(data.ids),
        Ticket.status != "closed"
    ).count()
    if open_tickets > 0:
        raise HTTPException(
            status_code=400,
            detail=f"有 {open_tickets} 个未完结工单指派给这些用户，请先处理"
        )

    # 执行删除
    deleted_count = db.query(Employee).filter(Employee.id.in_(data.ids)).delete(
        synchronize_session=False
    )

    # 记录操作日志
    log = OperationLog(
        id=str(uuid.uuid4()),
        operator_id=current_user.id,
        operator_name=current_user.name,
        module="Employee",
        action="batch_delete",
        target=f"ids: {data.ids}",
        detail=f"删除了 {deleted_count} 个用户",
        ip_address=request.client.host if request.client else None
    )
    db.add(log)
    db.commit()
    return {"message": f"成功删除 {deleted_count} 个用户"}