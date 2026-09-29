"""
总结服务类：用户提问，搜索参考资料，将提问和参考资料提交给模型，让模型总结回复
"""
from langchain_core.documents import Document
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage
from rag.vector_store import VectorStoreService
from util.logger_handler import logger
from util.prompt_loader import load_rag_prompts
from model.factory import chat_model
from langchain_core.prompts import PromptTemplate

def print_prompt(prompt):
    print("*"*20)
    print(prompt.to_string())
    print("*"*20)
    return prompt

class RagSummarizeService(object):
    def __init__(self):
        self.vector_store = VectorStoreService()
        self.retriever = self.vector_store.get_retriever()
        self.prompt_text = load_rag_prompts()
        self.prompt_template = PromptTemplate.from_template(self.prompt_text)
        self.model =chat_model
        self.chain = self._init_chain()

    def _init_chain(self):
        chain = self.prompt_template | print_prompt | self.model | StrOutputParser()
        return chain

    def retriever_docs(self, query: str) -> list[Document]:
        try:
            return self.retriever.invoke(query)
        except Exception as e:
            msg = str(e)
            if "does not exist" in msg:
                logger.error(
                    f"向量库 collection 不存在，请先调用 load_document() 或 load_from_db() 初始化知识库{e}"
                )
            else:
                logger.warning(f"检索失败，返回空结果: {e}")
            return []


    def rag_summarize_stream(self, query: str):
        """流式生成回答，yield 每个 token 的文本内容"""
        context_docs = self.retriever_docs(query)
        context = ""
        for idx, doc in enumerate(context_docs, 1):
            context += f"【参考资料{idx}】：参考资料：{doc.page_content} | 参考元数据：{doc.metadata}\n"

        # 构造 prompt 字符串
        prompt_text = self.prompt_template.format(input=query, context=context)
        # 构造消息列表（ChatTongyi 需要 message 对象）
        messages = [HumanMessage(content=prompt_text)]

        # 使用模型流式输出
        for chunk in self.model.stream(messages):
            # chunk 是 BaseMessageChunk，提取 content 文本
            yield chunk.content  # 或 yield str(chunk.content)

    def rag_summarize(self, query: str) -> str:
        context_docs = self.retriever_docs(query)
        context = ""
        counter = 0
        for doc in context_docs:
            counter += 1
            context += f"【参考资料{counter}】：参考资料：{doc.page_content} | 参考元数据：{doc.metadata}\n"
        return self.chain.invoke(
            {
                "input": query,
                "context": context,
            }
        )

if __name__ == '__main__':
    rag = RagSummarizeService()
    print(rag.rag_summarize("WiFi连接失败"))