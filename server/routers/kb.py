import os
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
from models import KbCategory, KbArticle
from schemas import KbCategoryCreate, KbCategoryOut, KbArticleCreate, KbArticleUpdate, KbArticleOut
from auth import get_current_user
from rag.vector_store import VectorStoreService# 用于更新向量存储
import uuid
from util.logger_handler import logger
# 引入文档解析库
from pypdf import PdfReader
from docx import Document as DocxDocument

router = APIRouter(prefix="/kb", tags=["knowledge_base"])

# ----- 分类 -----
@router.get("/categories", response_model=List[KbCategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(KbCategory).order_by(KbCategory.sort_order).all()

@router.post("/categories", response_model=KbCategoryOut)
def create_category(data: KbCategoryCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    new_cat = KbCategory(
        id=str(uuid.uuid4()),
        name=data.name,
        parent_id=data.parent_id,
        sort_order=data.sort_order,
        description=data.description,
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.delete("/categories/{cat_id}")
def delete_category(cat_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cat = db.query(KbCategory).filter(KbCategory.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    # 删除分类，但保留文章（可将文章分类置空）
    db.query(KbArticle).filter(KbArticle.category_id == cat_id).update({"category_id": None})
    db.delete(cat)
    db.commit()
    return {"message": "Deleted"}

# ----- 文章 -----
@router.get("/articles", response_model=List[KbArticleOut])
def list_articles(status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(KbArticle)
    if status:
        q = q.filter(KbArticle.status == status)
    return q.order_by(KbArticle.updated_at.desc()).all()

@router.post("/articles", response_model=KbArticleOut)
def create_article(data: KbArticleCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    new_art = KbArticle(
        id=str(uuid.uuid4()),
        title=data.title,
        category_id=data.category_id,
        content=data.content,
        summary=data.summary,
        tags=data.tags,
        status=data.status,
        author_id=data.author_id or current_user.id,
    )
    db.add(new_art)
    db.commit()
    db.refresh(new_art)
    # 更新向量存储（可异步）
    # 此处可以触发重建向量库
    return new_art

@router.put("/articles/{art_id}", response_model=KbArticleOut)
def update_article(art_id: str, data: KbArticleUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    art = db.query(KbArticle).filter(KbArticle.id == art_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Article not found")
    for key, val in data.dict(exclude_unset=True).items():
        setattr(art, key, val)
    db.commit()
    db.refresh(art)
    return art

@router.delete("/articles/{art_id}")
def delete_article(art_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    art = db.query(KbArticle).filter(KbArticle.id == art_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Article not found")
    db.delete(art)
    db.commit()
    return {"message": "Deleted"}

@router.post("/articles/{art_id}/view")
def view_article(art_id: str, db: Session = Depends(get_db)):
    art = db.query(KbArticle).filter(KbArticle.id == art_id).first()
    if art:
        art.view_count += 1
        db.commit()
    return art

@router.post("/articles/{art_id}/helpful")
def helpful_article(art_id: str, db: Session = Depends(get_db)):
    art = db.query(KbArticle).filter(KbArticle.id == art_id).first()
    if art:
        art.helpful_count += 1
        db.commit()
    return art

@router.post("/sync-vector")
def sync_vector_store(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # 仅管理员可操作
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="权限不足")
    VectorStoreService().load_from_db(db)
    return {"message": "向量库同步成功"}


@router.post("/import-file", response_model=dict)
async def import_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    导入文件（支持 .txt, .docx, .pdf），自动解析内容并创建文章
    """
    # 检查文件扩展名
    filename = file.filename or "untitled"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ['.txt', '.docx', '.pdf']:
        raise HTTPException(status_code=400, detail="仅支持 .txt, .docx, .pdf 格式")

    # 读取文件内容
    try:
        content_bytes = await file.read()
    except Exception as e:
        logger.error(f"读取文件失败: {str(e)}")
        raise HTTPException(status_code=500, detail="文件读取失败")

    # 根据扩展名解析文本
    try:
        if ext == '.txt':
            text_content = content_bytes.decode('utf-8', errors='ignore')
        elif ext == '.docx':
            doc = DocxDocument(BytesIO(content_bytes))
            text_content = '\n'.join([para.text for para in doc.paragraphs])
        elif ext == '.pdf':
            reader = PdfReader(BytesIO(content_bytes))
            text_content = ''
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_content += page_text + '\n'
        else:
            raise HTTPException(status_code=400, detail="不支持的文件类型")
    except Exception as e:
        logger.error(f"解析文件内容失败: {str(e)}")
        raise HTTPException(status_code=500, detail="文件内容解析失败")

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="文件内容为空或无法提取有效文本")

    # 生成标题：使用文件名（不含扩展名）
    title = os.path.splitext(filename)[0]
    # 如果标题为空或过短，取内容前20个字符
    if not title or len(title) < 3:
        title = text_content[:20].strip()

    # 摘要：取前200字
    summary = text_content[:200] + '...' if len(text_content) > 200 else text_content

    # 检查是否已存在同名文章（防止重复导入）
    existing = db.query(KbArticle).filter(KbArticle.title == title).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"文章《{title}》已存在，请修改文件名后重试")

    # 创建文章记录
    new_article = KbArticle(
        id=str(uuid.uuid4()),
        title=title,
        content=text_content,
        summary=summary,
        tags=[],  # 可从文件名或内容提取，此处留空
        status='published',
        author_id=current_user.id,
        view_count=0,
        helpful_count=0,
    )
    db.add(new_article)
    db.commit()
    db.refresh(new_article)

    # 同步到向量库（全量刷新，小项目适用）
    try:
        VectorStoreService().load_from_db(db)
        logger.info(f"向量库同步成功，新增文章: {title}")
    except Exception as e:
        logger.error(f"向量库同步失败: {str(e)}")
        # 文章已入库，但向量同步失败，可返回警告信息

    return {
        "message": "导入成功",
        "article_id": new_article.id,
        "title": new_article.title,
        "content_length": len(text_content)
    }