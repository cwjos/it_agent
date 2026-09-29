# IT 智能客服平台

基于 React + FastAPI + LangChain/LangGraph + Chroma + MySQL 的企业 IT 运维智能客服平台。

## 功能
- 智能问答：RAG + ReAct Agent
- 工单管理：创建、流转、关闭
- 知识库：文档上传、自动向量化、检索
- 权限控制：JWT + RBAC
- 统计看板

## 技术栈
- 前端：React、TypeScript、Ant Design、ECharts
- 后端：FastAPI、LangChain、LangGraph、Chroma、MySQL
## 数据大屏
<img width="1683" height="860" alt="dashboard" src="https://github.com/user-attachments/assets/cc64e593-434e-4a1c-8bc6-9c59a911d970" />


## 快速开始
### 后端
```bash
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload
