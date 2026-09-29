from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func
from database import get_db
from models import Ticket, TicketRecord, Conversation, Message, Employee
from schemas import (TicketCreate, TicketUpdate, TicketOut, TicketRecordCreate,TicketRecordCreateRequest,
                     TicketRecordOut, MessageOut,CloseTicketRequest)
from auth import get_current_user
import uuid

router = APIRouter(prefix="/tickets", tags=["tickets"])

@router.get("/", response_model=List[TicketOut])
def list_tickets(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    query = db.query(Ticket)
    # 非管理员只能看到自己创建或自己被指派的工单
    if current_user.role != "admin":
        query = query.filter(
            (Ticket.creator_id == current_user.id) |
            (Ticket.assignee_id == current_user.id)
        )
    return query.order_by(Ticket.created_at.desc()).all()


@router.post("/", response_model=TicketOut)
def create_ticket(data: TicketCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    new_ticket = Ticket(
        id=str(uuid.uuid4()),
        ticket_no=data.ticket_no,
        title=data.title,
        description=data.description,
        category=data.category,
        priority=data.priority,
        status=data.status,
        source=data.source,
        creator_id=data.creator_id or current_user.id,
        assignee_id=data.assignee_id,
        conversation_id=data.conversation_id,
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    return new_ticket


# def get_ticket(ticket_id: str, db: Session = Depends(get_db)):
#     ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
#     if not ticket:
#         raise HTTPException(status_code=404, detail="Ticket not found")
#     return ticket
@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: str, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    # 非管理员只能查看自己相关的工单
    if current_user.role != "admin" and ticket.creator_id != current_user.id and ticket.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return ticket

@router.put("/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: str,
    data: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: Employee = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    # 非管理员只能修改自己创建的或被指派的工单（可适当放宽）
    if current_user.role != "admin" and ticket.creator_id != current_user.id and ticket.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(ticket, key, val)
    db.commit()
    db.refresh(ticket)
    return ticket
# def update_ticket(ticket_id: str, data: TicketUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
#     ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
#     if not ticket:
#         raise HTTPException(status_code=404, detail="Ticket not found")
#     for key, val in data.dict(exclude_unset=True).items():
#         setattr(ticket, key, val)
#     db.commit()
#     db.refresh(ticket)
#     return ticket

@router.get("/{ticket_id}/records", response_model=List[TicketRecordOut])
def get_records(ticket_id: str, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    # 检查权限（可选）
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role != "admin" and ticket.creator_id != current_user.id and ticket.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return db.query(TicketRecord).filter(TicketRecord.ticket_id == ticket_id).order_by(TicketRecord.created_at).all()


@router.post("/{ticket_id}/records", response_model=TicketRecordOut)
def add_record(
        ticket_id: str,
        data: TicketRecordCreateRequest,
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user)):

    record = TicketRecord(
        id=str(uuid.uuid4()),
        ticket_id=ticket_id,
        action=data.action,
        from_status=data.from_status,
        to_status=data.to_status,
        comment=data.comment,
        operator_id=data.operator_id or current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@router.get("/{ticket_id}/messages", response_model=List[MessageOut])
def get_conversation_messages(ticket_id: str, db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket or not ticket.conversation_id:
        return []
    if current_user.role != "admin" and ticket.creator_id != current_user.id and ticket.assignee_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    messages = db.query(Message).filter(Message.conversation_id == ticket.conversation_id).order_by(Message.created_at).all()
    return messages


@router.post("/{ticket_id}/close", response_model=TicketOut)
def close_ticket(
        ticket_id: str,
        data: CloseTicketRequest,
        db: Session = Depends(get_db),
        current_user: Employee = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if current_user.role != "admin" and ticket.assignee_id != current_user.id and ticket.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="只有工单创建者、处理人或管理员才能关闭工单")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="工单已关闭")

    # 🔑 关键逻辑：如果处理人为空，则设置为当前用户（关闭者）
    if not ticket.assignee_id:
        ticket.assignee_id = current_user.id

    ticket.status = "closed"
    ticket.solution = data.solution
    ticket.resolved_at = func.now()
    db.commit()
    db.refresh(ticket)
    return ticket