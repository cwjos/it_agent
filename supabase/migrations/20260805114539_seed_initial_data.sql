/*
# Seed Initial Data

Populates:
- Departments (IT, HR, Finance, Operations, R&D)
- Knowledge base categories (Network, Hardware, Software, Security, Account)
- System settings (model config, notifications)
- Default knowledge base articles from IT fault data
*/

-- Departments
INSERT INTO departments (name, code, description, sort_order) VALUES
  ('IT运维部', 'IT', '负责IT基础设施运维与技术支持', 1),
  ('人力资源部', 'HR', '负责人员招聘、培训与绩效管理', 2),
  ('财务部', 'FIN', '负责公司财务、预算与报销', 3),
  ('运营部', 'OPS', '负责日常业务运营', 4),
  ('研发部', 'RD', '负责产品研发与技术创新', 5)
ON CONFLICT (code) DO NOTHING;

-- KB Categories
INSERT INTO kb_categories (name, sort_order, description) VALUES
  ('网络故障', 1, '网络连接、VPN、带宽等网络相关问题'),
  ('硬件设备', 2, '电脑、打印机、服务器等硬件设备问题'),
  ('软件应用', 3, '办公软件、业务系统、工具软件问题'),
  ('账号权限', 4, '账号登录、权限申请、密码重置等'),
  ('安全防护', 5, '病毒查杀、安全策略、数据保护')
ON CONFLICT DO NOTHING;

-- System Settings
INSERT INTO system_settings (key, value, category, description) VALUES
  ('model_name', 'gpt-4o-mini', 'model', 'AI模型名称'),
  ('model_temperature', '0.7', 'model', '模型温度参数'),
  ('model_max_tokens', '2048', 'model', '最大生成token数'),
  ('model_api_url', '', 'model', '模型API地址(留空使用默认)'),
  ('notification_email_enabled', 'true', 'notification', '启用邮件通知'),
  ('notification_webhook_url', '', 'notification', 'Webhook通知地址'),
  ('notification_new_ticket', 'true', 'notification', '新工单通知'),
  ('notification_ticket_assigned', 'true', 'notification', '工单分配通知'),
  ('notification_ticket_resolved', 'false', 'notification', '工单解决通知'),
  ('system_name', 'IT智能客服平台', 'general', '系统名称'),
  ('system_logo', '', 'general', '系统Logo地址')
ON CONFLICT (key) DO NOTHING;
