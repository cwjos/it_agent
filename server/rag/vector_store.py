from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from util.config_handler import chroma_conf
from model.factory import embed_model
from util.logger_handler import logger
from sqlalchemy.orm import Session
from models import KbArticle
from util.path_tool import get_abs_path

class VectorStoreService(object):
    def __init__(self):
        # 使用绝对路径
        persist_dir = get_abs_path(chroma_conf["persist_directory"])
        self.vector_store = Chroma(
            collection_name=chroma_conf["collection_name"],
            embedding_function=embed_model,
            persist_directory=persist_dir,
        )
        self.spliter = RecursiveCharacterTextSplitter(
            chunk_size=chroma_conf["chunk_size"],
            chunk_overlap=chroma_conf["chunk_overlap"],
            separators=chroma_conf["separators"],
            length_function=len,
        )

    def get_retriever(self):
        # 返回向量检索器，方便加入chain
        return self.vector_store.as_retriever(search_kargs={"k":chroma_conf["k"]})

    def load_from_db(self, db: Session):
        """从数据库同步所有已发布文章到向量库"""
        articles = db.query(KbArticle).filter(KbArticle.status == 'published').all()
        if not articles:
            logger.warning("没有已发布的文章可同步，跳过")
            return

        docs = []
        for art in articles:
            metadata = {
                "article_id": art.id,
                "title": art.title,
                "category_id": art.category_id,
                "tags": ",".join(art.tags or []),
                "source": "db",
            }
            content = f"{art.title}\n{art.summary or ''}\n{art.content}"
            docs.append(Document(page_content=content, metadata=metadata))

        split_docs = self.spliter.split_documents(docs)
        if not split_docs:
            logger.warning("分片后没有有效文档，跳过同步")
            return

        # 先删除旧 collection（如果存在）
        try:
            self.vector_store._client.delete_collection(
                chroma_conf["collection_name"]
            )
            logger.info(f"删除旧 collection: {chroma_conf['collection_name']}")
        except Exception as e:
            logger.warning(f"删除旧 collection 失败（可能不存在）: {e}")

        # 重新创建 Chroma 实例并填充数据
        self.vector_store = Chroma.from_documents(
            documents=split_docs,
            embedding=embed_model,
            collection_name=chroma_conf["collection_name"],
            persist_directory=chroma_conf["persist_directory"],
        )
        logger.info(f"同步 {len(split_docs)} 个文档片段到向量库")



if __name__ == '__main__':
    vs = VectorStoreService()
    # vs.load_document()

    retriever = vs.get_retriever()
    res = retriever.invoke("")
    for r in res:
        print(r.page_content)
        print("*"*30)
