import uuid
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_no = Column(String(20), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    department_id = Column(String(36), ForeignKey("departments.id"), nullable=True)
    role = Column(String(20), default="agent")
    status = Column(String(20), default="active")
    title = Column(String(100), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    password_hash = Column(String(255), nullable=False)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class KbCategory(Base):
    __tablename__ = "kb_categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    parent_id = Column(String(36), ForeignKey("kb_categories.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class KbArticle(Base):
    __tablename__ = "kb_articles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    category_id = Column(String(36), ForeignKey("kb_categories.id"), nullable=True)
    content = Column(Text, nullable=False)
    summary = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    status = Column(String(20), default="published")
    view_count = Column(Integer, default=0)
    helpful_count = Column(Integer, default=0)
    author_id = Column(String(36), ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_no = Column(String(20), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="open")
    source = Column(String(20), default="manual")
    creator_id = Column(String(36), ForeignKey("employees.id"), nullable=True)
    assignee_id = Column(String(36), ForeignKey("employees.id"), nullable=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=True)
    solution = Column(Text, nullable=True)
    related_article_ids = Column(JSON, default=list)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TicketRecord(Base):
    __tablename__ = "ticket_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)
    from_status = Column(String(20), nullable=True)
    to_status = Column(String(20), nullable=True)
    comment = Column(Text, nullable=True)
    operator_id = Column(String(36), ForeignKey("employees.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=True)
    user_id = Column(String(36), ForeignKey("employees.id"), nullable=True)
    status = Column(String(20), default="active")
    message_count = Column(Integer, default=0)
    ticket_id = Column(String(36), ForeignKey("tickets.id"), nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    thinking = Column(Text, nullable=True)
    tool_calls = Column(JSON, nullable=True)
    # 关键修改：属性名改为 extra_data，但数据库列名仍为 metadata
    extra_data = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    category = Column(String(50), default="general")
    description = Column(Text, nullable=True)
    updated_by = Column(String(36), ForeignKey("employees.id"), nullable=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operator_id = Column(String(36), ForeignKey("employees.id"), nullable=True)
    operator_name = Column(String(100), nullable=True)
    module = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    target = Column(String(255), nullable=True)
    detail = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, server_default=func.now())