import traceback

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from util.logger_handler import logger
from database import get_db
from models import Conversation, Message
from schemas import ConversationCreate, ConversationUpdate, ConversationOut, MessageCreate, MessageOut
from auth import get_current_user
import uuid
from rag.rag_service import RagSummarizeService
from pydantic import BaseModel
from agent.react_agent import ReactAgent

class AskRequest(BaseModel):
    content: str
router = APIRouter(prefix="/conversations", tags=["conversations"])

@router.get("/", response_model=List[ConversationOut])
def list_conversations(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return (db.query(Conversation)
            .filter(Conversation.user_id == current_user.id)
            .order_by(Conversation.updated_at.desc())
            .all())

@router.post("/", response_model=ConversationOut)
def create_conversation(data: ConversationCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    new_conv = Conversation(
        id=str(uuid.uuid4()),
        title=data.title,
        user_id=data.user_id or current_user.id,
        status=data.status,
        message_count=0,
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)
    return new_conv

@router.put("/{conv_id}", response_model=ConversationOut)
def update_conversation(conv_id: str, data: ConversationUpdate, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(conv, key, val)
    db.commit()
    db.refresh(conv)
    return conv

@router.delete("/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"message": "Deleted"}

@router.get("/{conv_id}/messages", response_model=List[MessageOut])
def get_messages(conv_id: str, db: Session = Depends(get_db)):
    return db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at).all()

@router.post("/{conv_id}/messages", response_model=MessageOut)
def add_message(conv_id: str, data: MessageCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        role=data.role,
        content=data.content,
        thinking=data.thinking,
        tool_calls=data.tool_calls,
        metadata=data.metadata,
    )
    db.add(msg)
    # 更新对话的消息计数
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if conv:
        conv.message_count += 1
    db.commit()
    db.refresh(msg)
    return msg

@router.post("/{conv_id}/ask")
def ask_question(
    conv_id: str,
    req: AskRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # 1. 检查会话是否存在
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "会话不存在")

    # 2. 保存用户消息
    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        role="user",
        content=req.content,
    )
    db.add(user_msg)
    conv.message_count += 1
    db.commit()

    # 3. 调用 RAG 服务生成回答
    rag = RagSummarizeService()
    answer = rag.rag_summarize(req.content)

    # 4. 保存 AI 消息（可选：保存 thinking 信息）
    ai_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        role="assistant",
        content=answer,
        thinking=None,  # 如果需要思考过程，可修改 rag_summarize 返回包含步骤
    )
    db.add(ai_msg)
    conv.message_count += 1
    db.commit()
    db.refresh(ai_msg)

    # 5. 返回两条消息（或只返回 AI 消息，前端自行添加用户消息）
    return {
        "user_message": user_msg,
        "ai_message": ai_msg
    }

# conversations.py 顶部添加导入
from fastapi.responses import StreamingResponse
import json

# conversations.py

@router.post("/{conv_id}/ask/stream")
def ask_question_stream(conv_id: str, req: AskRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # 1. 检查会话并保存用户消息（使用注入的会话）
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(404, "会话不存在")

    user_msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conv_id,
        role="user",
        content=req.content,
    )
    db.add(user_msg)
    conv.message_count += 1
    db.commit()
    db.refresh(user_msg)

    # 2. 定义流式生成器
    async def event_generator():
        # 创建独立会话用于后续保存 AI 消息（避免 DetachedInstanceError）
        db_gen = get_db()
        new_db = next(db_gen)

        try:
            yield f"data: {json.dumps({'event': 'start', 'user_message_id': user_msg.id})}\n\n"

            agent = ReactAgent()
            full_answer = ""
            async for chunk in agent.execute_stream_async(req.content):
                full_answer += chunk
                yield f"data: {json.dumps({'event': 'chunk', 'content': chunk})}\n\n"

            # 保存 AI 消息到数据库（使用新会话）
            ai_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conv_id,
                role="assistant",
                content=full_answer,
                thinking=None,
            )
            new_db.add(ai_msg)
            target_conv = new_db.query(Conversation).filter(Conversation.id == conv_id).first()
            if target_conv:
                target_conv.message_count += 1
            new_db.commit()
            new_db.refresh(ai_msg)

            yield f"data: {json.dumps({'event': 'done', 'ai_message': {'id': ai_msg.id, 'content': full_answer, 'created_at': ai_msg.created_at.isoformat()}})}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"
        finally:
            new_db.close()
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )