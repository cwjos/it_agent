from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import auth, employees, departments, kb, tickets, conversations, settings, logs, dashboard
from rag.vector_store import VectorStoreService
from database import get_db
from util.logger_handler import logger
from contextlib import asynccontextmanager
# 创建数据库表
Base.metadata.create_all(bind=engine)
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("应用启动，开始初始化向量库...")
    vs = VectorStoreService()
    try:
        db = next(get_db())
        vs.load_from_db(db)
        db.close()
        logger.info("向量库初始化成功")
    except Exception as e:
        logger.error(f"向量库初始化失败，RAG 功能将不可用: {e}", exc_info=True)
        # 这里可以选择是否让应用崩溃，取决于您是否必须依赖 RAG
    yield
    logger.info("应用关闭")

# ===== 临时诊断 =====
from rag.vector_store import VectorStoreService
from database import get_db
from util.logger_handler import logger
from util.config_handler import chroma_conf

print("=" * 60)
print("【诊断】chroma_conf =", chroma_conf)
print("【诊断】persist_directory =", chroma_conf.get("persist_directory"))
print("【诊断】collection_name =", chroma_conf.get("collection_name"))
print("=" * 60)

try:
    vs = VectorStoreService()
    print("【诊断】VectorStoreService 构造成功")
    print("【诊断】现有 collections:", vs.vector_store._client.list_collections())
except Exception as e:
    print("【诊断】VectorStoreService 构造失败:", e)
    import traceback; traceback.print_exc()

try:
    db = next(get_db())
    from models import KbArticle
    count = db.query(KbArticle).filter(KbArticle.status == 'published').count()
    print(f"【诊断】已发布文章数量: {count}")
    db.close()
except Exception as e:
    print("【诊断】查询已发布文章失败:", e)
    import traceback; traceback.print_exc()
# ===== 临时诊断结束 =====

app = FastAPI(lifespan=lifespan)
# app = FastAPI(title="IT客服平台API", version="1.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境限制域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api")

app.include_router(employees.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(kb.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(conversations.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "IT客服平台 API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)