from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import List

from database import get_db
from models import Ticket, Conversation, Employee
from schemas import DashboardStats, TrendPoint
from auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

STATUS_ACTIVE = ["pending", "in_progress", "assigned"]
STATUS_RESOLVED = ["closed", "resolved"]


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    total_tickets = db.query(Ticket).count()
    resolved = db.query(Ticket).filter(Ticket.status.in_(STATUS_RESOLVED)).count()
    active = db.query(Ticket).filter(Ticket.status.in_(STATUS_ACTIVE)).count()
    conversations = db.query(Conversation).count()
    online_agents = db.query(Employee).filter(
        Employee.role.in_(["admin", "agent"]),
        Employee.status == "active",
    ).count()

    # 真实计算平均处理时长（小时），仅统计有 resolved_at 的工单
    avg_hours: float | None = None
    closed_rows = db.query(Ticket.created_at, Ticket.resolved_at).filter(
        Ticket.resolved_at.isnot(None),
    ).all()
    if closed_rows:
        total_seconds = 0.0
        for created_at, resolved_at in closed_rows:
            if created_at and resolved_at:
                delta = resolved_at - created_at
                total_seconds += delta.total_seconds()
        if total_seconds > 0:
            avg_hours = (total_seconds / len(closed_rows)) / 3600.0

    if avg_hours is None:
        avg_response = "-"
    elif avg_hours < 1:
        avg_response = f"{(avg_hours * 60):.0f}分钟"
    else:
        avg_response = f"{avg_hours:.1f}小时"

    return {
        "totalConversations": conversations,
        "resolvedTickets": resolved,
        "totalTickets": total_tickets,
        "activeTickets": active,
        "avgResponseTime": avg_response,
        "onlineAgents": online_agents,
    }


@router.get("/trend", response_model=List[TrendPoint])
def get_trend(days: int = Query(7, ge=1, le=90), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    start_date = datetime.now() - timedelta(days=days - 1)

    # 🔧 修改点：使用 DATE(created_at) 替代 date_trunc
    # 按天聚合对话创建量
    conv_rows = db.query(
        func.DATE(Conversation.created_at).label("day"),
        func.count(Conversation.id).label("count"),
    ).filter(Conversation.created_at >= start_date).group_by("day").all()
    conv_map = {(row.day if row.day else None): row.count for row in conv_rows}

    # 按天聚合工单创建量
    ticket_created_rows = db.query(
        func.DATE(Ticket.created_at).label("day"),
        func.count(Ticket.id).label("count"),
    ).filter(Ticket.created_at >= start_date).group_by("day").all()
    ticket_created_map = {(row.day if row.day else None): row.count for row in ticket_created_rows}

    # 按天聚合工单解决量
    ticket_resolved_rows = db.query(
        func.DATE(Ticket.resolved_at).label("day"),
        func.count(Ticket.id).label("count"),
    ).filter(Ticket.resolved_at.isnot(None), Ticket.resolved_at >= start_date).group_by("day").all()
    ticket_resolved_map = {(row.day if row.day else None): row.count for row in ticket_resolved_rows}

    result = []
    for i in range(days - 1, -1, -1):
        day = (datetime.now() - timedelta(days=i)).date()
        result.append({
            "date": day.strftime("%m-%d"),
            "count": conv_map.get(day, 0),
            "resolved": ticket_resolved_map.get(day, 0),
            "created": ticket_created_map.get(day, 0),
        })
    return result


@router.get("/fault-distribution")
def get_fault_distribution(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = db.query(
        Ticket.category,
        func.count(Ticket.id).label("count"),
    ).group_by(Ticket.category).all()
    result = []
    for row in rows:
        name = row.category or "其他"
        result.append({"name": name, "value": row.count})
    return result


@router.get("/status-distribution")
def get_status_distribution(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    rows = db.query(
        Ticket.status,
        func.count(Ticket.id).label("count"),
    ).group_by(Ticket.status).all()
    label_map = {
        "open": "待处理",
        "pending": "待受理",
        "in_progress": "处理中",
        "assigned": "已分配",
        "pending_review": "待回访",
        "resolved": "已解决",
        "closed": "已关闭",
    }
    result = []
    for row in rows:
        label = label_map.get(row.status, row.status)
        result.append({"name": label, "value": row.count})
    return result