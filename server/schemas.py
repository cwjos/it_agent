from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

# ---------- 通用 ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

# ---------- 员工 ----------
class EmployeeBase(BaseModel):
    employee_no: Optional[str] = None
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[str] = None
    role: Optional[str] = "user"
    status: Optional[str] = "active"
    title: Optional[str] = None

class EmployeeCreate(EmployeeBase):
    password: str   # 新增

class EmployeeUpdate(EmployeeBase):
    pass

class EmployeeOut(EmployeeBase):
    id: str
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ---------- 批量操作 ----------
class BatchStatusUpdateRequest(BaseModel):
    ids: List[str]
    status: str

class BatchDeleteRequest(BaseModel):
    ids: List[str]

# ---------- 部门 ----------
class DepartmentBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    sort_order: int = 0

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- 知识库分类 ----------
class KbCategoryBase(BaseModel):
    name: str
    parent_id: Optional[str] = None
    sort_order: int = 0
    description: Optional[str] = None

class KbCategoryCreate(KbCategoryBase):
    pass

class KbCategoryOut(KbCategoryBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- 知识库文章 ----------
class KbArticleBase(BaseModel):
    title: str
    category_id: Optional[str] = None
    content: str
    summary: Optional[str] = None
    tags: List[str] = []
    status: str = "published"

class KbArticleCreate(KbArticleBase):
    author_id: Optional[str] = None

class KbArticleUpdate(KbArticleBase):
    pass

class KbArticleOut(KbArticleBase):
    id: str
    view_count: int
    helpful_count: int
    author_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- 工单 ----------
class TicketBase(BaseModel):
    ticket_no: str
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: str = "medium"
    status: str = "open"
    source: str = "manual"
    creator_id: Optional[str] = None
    assignee_id: Optional[str] = None
    conversation_id: Optional[str] = None
    solution: Optional[str] = None
    related_article_ids: List[str] = []

class TicketCreate(TicketBase):
    pass

class TicketUpdate(TicketBase):
    ticket_no: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    source: Optional[str] = None
    creator_id: Optional[str] = None
    assignee_id: Optional[str] = None
    conversation_id: Optional[str] = None
    solution: Optional[str] = None
    related_article_ids: Optional[List[str]] = None

class TicketOut(TicketBase):
    id: str
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- 工单记录 ----------
class TicketRecordBase(BaseModel):
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    comment: Optional[str] = None
    operator_id: Optional[str] = None

class TicketRecordCreate(TicketRecordBase):
    ticket_id: str

class TicketRecordCreateRequest(TicketRecordBase):
    """创建工单记录请求体（不包含 ticket_id，由路由从路径获取）"""
    pass

class TicketRecordOut(TicketRecordBase):
    id: str
    ticket_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class CloseTicketRequest(BaseModel):
    solution: str
# ---------- 对话 ----------
class ConversationBase(BaseModel):
    title: Optional[str] = None
    user_id: Optional[str] = None
    status: str = "active"
    message_count: int = 0
    ticket_id: Optional[str] = None
    summary: Optional[str] = None

class ConversationCreate(ConversationBase):
    pass

class ConversationUpdate(ConversationBase):
    pass

class ConversationOut(ConversationBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- 消息（关键修改） ----------
class MessageBase(BaseModel):
    role: str
    content: str
    thinking: Optional[str] = None
    tool_calls: Optional[Any] = None
    metadata: Optional[Any] = None   # 前端传入的字段名

class MessageCreate(MessageBase):
    conversation_id: str

class MessageOut(MessageBase):
    id: str
    conversation_id: str
    created_at: datetime
    # 覆盖 metadata，指定从模型的 extra_data 属性读取，输出时仍为 metadata
    metadata: Optional[Any] = Field(None, alias="extra_data")

    class Config:
        from_attributes = True
        populate_by_name = True   # 允许使用字段名或别名

# ---------- 系统设置 ----------
class SystemSettingBase(BaseModel):
    key: str
    value: str
    category: str = "general"
    description: Optional[str] = None

class SystemSettingOut(SystemSettingBase):
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- 操作日志 ----------
class OperationLogOut(BaseModel):
    id: str
    operator_id: Optional[str]
    operator_name: Optional[str]
    module: str
    action: str
    target: Optional[str]
    detail: Optional[str]
    ip_address: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ---------- 仪表盘 ----------
class DashboardStats(BaseModel):
    totalConversations: int
    resolvedTickets: int
    totalTickets: int
    activeTickets: int
    avgResponseTime: str
    onlineAgents: int

class TrendPoint(BaseModel):
    date: str
    count: int
    resolved: Optional[int] = None
    created: Optional[int] = None