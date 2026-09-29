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
## 客服对话
<img width="1707" height="826" alt="chat" src="https://github.com/user-attachments/assets/3b512f11-edf9-45fd-a575-07d48b5c0ed2" />
## 用户管理
<img width="1690" height="562" alt="user" src="https://github.com/user-attachments/assets/9da372f9-8f8a-42bf-842c-fe9d9280613e" />
## 工单管理
<img width="1702" height="826" alt="tickets" src="https://github.com/user-attachments/assets/e68f1836-cb92-42f9-b0cc-ba9abbe18ea8" />
## 知识库
<img width="1710" height="857" alt="knowledge" src="https://github.com/user-attachments/assets/cac8c176-72ec-437d-a8ef-8710b1d936cd" />


## 快速开始
### 后端
```bash
cd server
uvicorn main:app --reload --port 3000
### 前端
cd src
npm run dev

