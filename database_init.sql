-- ============================================================
-- IT智能客服平台 - 完整数据库脚本
-- ============================================================
-- 使用方法：
--   1. 在 Supabase 项目中打开 SQL Editor
--   2. 将本文件全部内容粘贴进去执行
--   3. 或在本地 PostgreSQL 中执行（需先启用 pgcrypto 扩展）
--
-- 包含内容：
--   - 10 张业务表（部门、员工、知识库分类、知识库文章、
--     工单、工单记录、对话、消息、操作日志、系统设置）
--   - 行级安全策略（RLS）
--   - 自动更新时间触发器
--   - 初始数据（5个部门、5个知识库分类、11项系统设置）
--   - 20篇IT故障知识库文章
-- ============================================================

-- 确保有 gen_random_uuid() 支持
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. 部门表 departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  parent_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dept_select" ON departments;
CREATE POLICY "dept_select" ON departments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dept_insert" ON departments;
CREATE POLICY "dept_insert" ON departments FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dept_update" ON departments;
CREATE POLICY "dept_update" ON departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "dept_delete" ON departments;
CREATE POLICY "dept_delete" ON departments FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 2. 员工表 employees
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_no text NOT NULL UNIQUE,
  name text NOT NULL,
  email text UNIQUE,
  phone text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'agent',
  status text NOT NULL DEFAULT 'active',
  title text,
  avatar_url text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emp_select" ON employees;
CREATE POLICY "emp_select" ON employees FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "emp_insert" ON employees;
CREATE POLICY "emp_insert" ON employees FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "emp_update" ON employees;
CREATE POLICY "emp_update" ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "emp_delete" ON employees;
CREATE POLICY "emp_delete" ON employees FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. 知识库分类表 kb_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES kb_categories(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kbc_select" ON kb_categories;
CREATE POLICY "kbc_select" ON kb_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kbc_insert" ON kb_categories;
CREATE POLICY "kbc_insert" ON kb_categories FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "kbc_update" ON kb_categories;
CREATE POLICY "kbc_update" ON kb_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "kbc_delete" ON kb_categories;
CREATE POLICY "kbc_delete" ON kb_categories FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 4. 知识库文章表 kb_articles
-- ============================================================
CREATE TABLE IF NOT EXISTS kb_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category_id uuid REFERENCES kb_categories(id) ON DELETE SET NULL,
  content text NOT NULL,
  summary text,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'published',
  view_count int NOT NULL DEFAULT 0,
  helpful_count int NOT NULL DEFAULT 0,
  author_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kba_select" ON kb_articles;
CREATE POLICY "kba_select" ON kb_articles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kba_insert" ON kb_articles;
CREATE POLICY "kba_insert" ON kb_articles FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "kba_update" ON kb_articles;
CREATE POLICY "kba_update" ON kb_articles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "kba_delete" ON kb_articles;
CREATE POLICY "kba_delete" ON kb_articles FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON kb_articles(category_id);

-- ============================================================
-- 5. 工单表 tickets
--    conversation_id 的外键稍后通过 ALTER TABLE 添加
--    （因为 conversations 表尚未创建，存在循环依赖）
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  category text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  source text NOT NULL DEFAULT 'manual',
  creator_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  conversation_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_select" ON tickets;
CREATE POLICY "ticket_select" ON tickets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ticket_insert" ON tickets;
CREATE POLICY "ticket_insert" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_update" ON tickets;
CREATE POLICY "ticket_update" ON tickets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ticket_delete" ON tickets;
CREATE POLICY "ticket_delete" ON tickets FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee_id);

-- ============================================================
-- 6. 对话表 conversations
--    ticket_id 的外键稍后通过 ALTER TABLE 添加
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  user_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  message_count int NOT NULL DEFAULT 0,
  ticket_id uuid,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conv_select" ON conversations;
CREATE POLICY "conv_select" ON conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "conv_insert" ON conversations;
CREATE POLICY "conv_insert" ON conversations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "conv_update" ON conversations;
CREATE POLICY "conv_update" ON conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "conv_delete" ON conversations;
CREATE POLICY "conv_delete" ON conversations FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 添加循环外键约束（tickets <-> conversations）
-- ============================================================
DO $fkc$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tickets_conversation_id_fkey' AND table_name = 'tickets'
  ) THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL;
  END IF;
END $fkc$;

DO $fkc$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'conversations_ticket_id_fkey' AND table_name = 'conversations'
  ) THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;
  END IF;
END $fkc$;

-- ============================================================
-- 7. 消息表 messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  thinking text,
  tool_calls jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_select" ON messages;
CREATE POLICY "msg_select" ON messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "msg_insert" ON messages;
CREATE POLICY "msg_insert" ON messages FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "msg_update" ON messages;
CREATE POLICY "msg_update" ON messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "msg_delete" ON messages;
CREATE POLICY "msg_delete" ON messages FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- ============================================================
-- 8. 工单处理记录表 ticket_records
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  comment text,
  operator_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ticket_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tr_select" ON ticket_records;
CREATE POLICY "tr_select" ON ticket_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tr_insert" ON ticket_records;
CREATE POLICY "tr_insert" ON ticket_records FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "tr_update" ON ticket_records;
CREATE POLICY "tr_update" ON ticket_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tr_delete" ON ticket_records;
CREATE POLICY "tr_delete" ON ticket_records FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ticket_records_ticket ON ticket_records(ticket_id);

-- ============================================================
-- 9. 操作日志表 operation_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  operator_name text,
  module text NOT NULL,
  action text NOT NULL,
  target text,
  detail text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "log_select" ON operation_logs;
CREATE POLICY "log_select" ON operation_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "log_insert" ON operation_logs;
CREATE POLICY "log_insert" ON operation_logs FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "log_update" ON operation_logs;
CREATE POLICY "log_update" ON operation_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "log_delete" ON operation_logs;
CREATE POLICY "log_delete" ON operation_logs FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_operation_logs_created ON operation_logs(created_at DESC);

-- ============================================================
-- 10. 系统设置表 system_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_by uuid REFERENCES employees(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "set_select" ON system_settings;
CREATE POLICY "set_select" ON system_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "set_insert" ON system_settings;
CREATE POLICY "set_insert" ON system_settings FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "set_update" ON system_settings;
CREATE POLICY "set_update" ON system_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "set_delete" ON system_settings;
CREATE POLICY "set_delete" ON system_settings FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 11. 自动更新 updated_at 触发器
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $trig$ BEGIN
  CREATE TRIGGER departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $trig$;

DO $trig$ BEGIN
  CREATE TRIGGER employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $trig$;

DO $trig$ BEGIN
  CREATE TRIGGER kb_categories_updated_at BEFORE UPDATE ON kb_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $trig$;

DO $trig$ BEGIN
  CREATE TRIGGER kb_articles_updated_at BEFORE UPDATE ON kb_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $trig$;

DO $trig$ BEGIN
  CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $trig$;

DO $trig$ BEGIN
  CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $trig$;

-- ============================================================
-- 12. 初始数据 - 部门
-- ============================================================
INSERT INTO departments (name, code, description, sort_order) VALUES
  ('IT运维部', 'IT', '负责IT基础设施运维与技术支持', 1),
  ('人力资源部', 'HR', '负责人员招聘、培训与绩效管理', 2),
  ('财务部', 'FIN', '负责公司财务、预算与报销', 3),
  ('运营部', 'OPS', '负责日常业务运营', 4),
  ('研发部', 'RD', '负责产品研发与技术创新', 5)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 13. 初始数据 - 知识库分类
-- ============================================================
INSERT INTO kb_categories (name, sort_order, description) VALUES
  ('网络故障', 1, '网络连接、VPN、带宽等网络相关问题'),
  ('硬件设备', 2, '电脑、打印机、服务器等硬件设备问题'),
  ('软件应用', 3, '办公软件、业务系统、工具软件问题'),
  ('账号权限', 4, '账号登录、权限申请、密码重置等'),
  ('安全防护', 5, '病毒查杀、安全策略、数据保护')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 14. 初始数据 - 系统设置
-- ============================================================
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

-- ============================================================
-- 15. 初始数据 - 知识库文章（20篇IT故障文章）
-- ============================================================
INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  'VPN客户端提示错误代码808，无法建立连接',
  c.id,
  '## 症状
用户反馈 VPN 连接失败，客户端显示错误代码 808。

## 常见原因
- 本地网络无法访问 VPN 服务器（如防火墙屏蔽）
- 用户账号在系统中被禁用（Disabled）
- VPN 服务器 IP（如 10.0.0.1）不可达
- 客户端证书过期或无效

## 排查步骤
1. 检查用户本地网络连通性：ping 8.8.8.8 或公司内网地址，确认是否正常。
2. 检查 VPN 服务器 IP 是否可 ping 通；若不通，检查路由器和防火墙策略。
3. 在用户管理系统中查询该账号状态，若为 Disabled，执行解锁操作。
4. 验证客户端证书有效期，如过期则重新颁发。
5. 重启 VPN 客户端和本地网络设备（路由器/光猫）后重试。

## 解决方案
通常解锁账号或调整防火墙策略后可恢复；若服务器不可达，需联系网络管理员检查 VPN 网关。',
  'VPN错误代码808的排查与解决方案',
  ARRAY['VPN', '错误代码808', '连接失败'],
  'published'
FROM kb_categories c WHERE c.name = '网络故障'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  'VPN频繁掉线，每几分钟断开一次',
  c.id,
  '## 症状
用户反映 VPN 连接不稳定，频繁断开。

## 常见原因
- 本地网络不稳定（丢包率高）
- VPN 服务器负载过高
- 客户端超时设置过短
- 运营商对 VPN 协议进行干扰

## 排查步骤
1. 使用 ping -t 持续测试本地到 VPN 服务器的延迟和丢包率。
2. 检查 VPN 服务器 CPU/内存使用率，若过高则考虑扩容或分流。
3. 调整客户端超时重试参数（如 DPD 间隔）。
4. 尝试更换 VPN 协议（如从 UDP 切换为 TCP）或更换端口。
5. 联系网络服务商确认是否存在 QoS 限制。

## 解决方案
优化网络质量、调整超时参数或切换协议后可改善。',
  'VPN频繁掉线的排查与解决方案',
  ARRAY['VPN', '掉线', '网络不稳定'],
  'published'
FROM kb_categories c WHERE c.name = '网络故障'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  'Outlook无法收发邮件，提示服务器连接失败或邮箱已满',
  c.id,
  '## 症状
用户无法通过 Outlook 发送或接收邮件，收到相关错误提示。

## 常见原因
- Exchange 服务器地址配置错误
- 邮箱存储空间达到上限
- Outlook 配置文件损坏
- 代理服务器设置错误

## 排查步骤
1. 检查邮箱剩余容量，若已满，指导用户清理"已删除邮件"和"发送邮件"中的大附件。
2. 验证 Exchange 服务器地址（如 outlook.office365.com）是否可解析。
3. 检查 Outlook 的代理设置（控制面板 → Internet 选项 → 连接），确保未错误配置。
4. 新建 Outlook 配置文件（控制面板 → 邮件 → 显示配置文件），重新添加账户测试。
5. 若使用缓存模式，尝试关闭缓存或重建 OST 文件。

## 解决方案
清理邮箱空间或修正服务器地址后通常恢复；配置文件损坏则重建。',
  'Outlook邮件收发故障排查',
  ARRAY['Outlook', '邮件', 'Exchange'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '打印机无法连接，提示IP冲突或脱机',
  c.id,
  '## 症状
用户无法打印，打印机状态显示脱机或 IP 冲突。

## 常见原因
- 打印机 IP 地址与网络中其他设备冲突
- 打印机驱动程序损坏或版本不兼容
- 网络打印机所在网段发生变化
- 打印机硬件故障（如网口损坏）

## 排查步骤
1. Ping 打印机的 IP 地址（如 192.168.1.100），检查是否响应。
2. 进入打印机面板打印配置页，确认当前 IP 和 MAC 地址。
3. 若 IP 冲突，重新分配静态 IP（建议在 DHCP 中做绑定）。
4. 卸载原驱动程序，从官网下载最新驱动重新安装。
5. 检查打印机是否处于"暂停打印"状态（Windows 打印机管理）。

## 解决方案
重新分配可用 IP 并更新驱动后可恢复。',
  '打印机IP冲突或脱机故障排查',
  ARRAY['打印机', 'IP冲突', '脱机'],
  'published'
FROM kb_categories c WHERE c.name = '硬件设备'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '无法访问公司内部网站或业务系统，其他网站正常',
  c.id,
  '## 症状
用户能访问外网，但打不开内网门户或业务系统。

## 常见原因
- 内部 DNS 解析故障
- 浏览器代理设置错误
- 公司防火墙策略误拦截（如 IP 被误封）
- 目标服务器维护中或宕机

## 排查步骤
1. 使用 nslookup 检查内部域名解析是否正确。
2. 检查浏览器是否配置了代理（设置 → 网络代理），如有则清空或设为自动。
3. 尝试使用 IP 直接访问，若可访问则问题在 DNS，若不可访问则检查防火墙。
4. 查看公司内部系统状态公告，确认是否计划维护。
5. 在服务器端检查服务进程和端口监听状态。

## 解决方案
修复 DNS 解析或调整防火墙策略；若服务器故障则通知运维重启服务。',
  '内网系统访问故障排查',
  ARRAY['内网访问', 'DNS', '防火墙'],
  'published'
FROM kb_categories c WHERE c.name = '网络故障'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  'Windows系统蓝屏，错误代码0x0000007E或0x00000050',
  c.id,
  '## 症状
电脑出现蓝屏死机，并显示错误代码。

## 常见原因
- 驱动程序冲突或不兼容
- 内存条故障或接触不良
- 系统文件损坏或病毒感染
- 硬件过热

## 排查步骤
1. 记录蓝屏错误代码和文件名（如 ntoskrnl.exe）。
2. 重启进入安全模式，卸载最近安装的驱动程序或软件。
3. 运行内存诊断工具（Windows 内置）检查内存完整性。
4. 检查 CPU/GPU 温度，清理机箱灰尘。
5. 使用系统还原点恢复到正常状态，或使用 SFC /SCANNOW 修复系统文件。

## 解决方案
卸载冲突驱动、更换内存或恢复系统可解决。',
  'Windows蓝屏故障排查',
  ARRAY['蓝屏', 'Windows', '驱动冲突'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '安装公司内部软件时提示缺少依赖项或权限不足',
  c.id,
  '## 症状
安装包运行失败，提示缺少运行库或没有管理员权限。

## 常见原因
- 未以管理员身份运行安装包
- 缺少必要的 .NET Framework / VC++ 运行库
- 系统磁盘空间不足
- 杀毒软件误拦截安装文件

## 排查步骤
1. 右键安装包，选择"以管理员身份运行"。
2. 检查是否已安装目标运行库（如 .NET 4.8），若缺失则从官方下载安装。
3. 检查系统盘剩余空间，清理临时文件（使用磁盘清理工具）。
4. 暂时禁用杀毒软件或添加安装目录到白名单。
5. 查看安装日志（如 %TEMP% 下的日志文件）获取具体错误信息。

## 解决方案
以管理员运行并安装依赖库后即可正常安装。',
  '软件安装依赖缺失排查',
  ARRAY['软件安装', '依赖项', '权限'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '无法访问网络共享文件夹，提示找不到网络路径或访问被拒绝',
  c.id,
  '## 症状
用户通过 \\主机名\共享名 无法访问共享资源。

## 常见原因
- 共享文件夹所在电脑未开机或未共享
- 网络发现功能未开启
- 用户权限不足（未加入该共享的访问列表）
- 防火墙拦截 SMB 协议（端口 445）

## 排查步骤
1. 确认共享主机是否在线（ping 主机名或 IP）。
2. 在共享主机上检查文件夹共享属性，确保"共享"选项卡中设置了正确的用户。
3. 开启网络发现（控制面板 → 网络和共享中心 → 高级共享设置）。
4. 检查本地防火墙入站规则是否允许文件和打印机共享。
5. 尝试使用 IP 路径访问（如 \\192.168.1.10\share）替代计算机名。

## 解决方案
开启网络发现、配置共享权限并放行防火墙端口后恢复。',
  '网络共享文件夹访问故障',
  ARRAY['共享文件夹', 'SMB', '网络发现'],
  'published'
FROM kb_categories c WHERE c.name = '网络故障'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '网页无法打开但能通过IP访问，提示DNS_PROBE_FINISHED_NXDOMAIN',
  c.id,
  '## 症状
浏览器无法解析域名，但直接输入 IP 地址可以访问。

## 常见原因
- 本地 DNS 缓存错误
- 首选 DNS 服务器故障
- hosts 文件被恶意修改
- 域名过期或未备案

## 排查步骤
1. 在命令行执行 ipconfig /flushdns 清空 DNS 缓存。
2. 尝试更换 DNS 服务器（如 8.8.8.8 或 114.114.114.114）临时测试。
3. 检查 C:\Windows\System32\drivers\etc\hosts 文件，移除无关条目。
4. 使用 nslookup 查询该域名，确认解析服务器是否返回正确记录。
5. 若域名解析正常但仍访问不了，检查浏览器代理设置。

## 解决方案
刷新 DNS 缓存或更换 DNS 服务器后解决；若 hosts 被篡改则清理。',
  'DNS解析故障排查',
  ARRAY['DNS', '域名解析', 'NXDOMAIN'],
  'published'
FROM kb_categories c WHERE c.name = '网络故障'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  'Windows Update失败，错误代码0x80070005或0x80244018',
  c.id,
  '## 症状
系统更新下载或安装失败，并报特定错误码。

## 常见原因
- 系统更新服务未启动
- Windows 更新临时文件夹权限不足
- 网络代理或防火墙阻止更新下载
- 系统日期时间不正确

## 排查步骤
1. 检查 Windows Update 服务（wuauserv）是否已启动，未启动则手动启动。
2. 清空 C:\Windows\SoftwareDistribution\Download 文件夹内容。
3. 确保系统时间与互联网时间同步（设置 → 时间与语言）。
4. 检查 Internet 选项中的代理设置，确保未启用代理。
5. 运行 Windows 更新疑难解答工具（设置 → 更新与安全 → 疑难解答）。

## 解决方案
重置更新组件、同步时间、关闭代理后更新即可恢复。',
  'Windows系统更新失败排查',
  ARRAY['Windows Update', '系统更新', '错误代码'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '电脑开机无显示，电源灯亮但屏幕黑屏',
  c.id,
  '## 症状
按下电源键后，风扇转动，电源指示灯亮，但显示器无任何显示。

## 常见原因
- 内存条接触不良或氧化
- 显卡故障或连接线松动
- 主板供电异常
- 显示器信号源选择错误

## 排查步骤
1. 检查显示器电源线和信号线（HDMI/VGA）是否插紧，并切换输入源。
2. 拔掉内存条，用橡皮擦擦拭金手指后重新插入。
3. 若为独立显卡，拔插显卡并检查 PCI-E 插槽。
4. 清除 CMOS（拔掉主板电池或短接跳线）恢复默认 BIOS 设置。
5. 若以上无效，尝试替换电源或主板测试。

## 解决方案
通常重插内存或显卡可解决；若硬件损坏需更换。',
  '电脑开机黑屏硬件故障排查',
  ARRAY['黑屏', '内存条', '显卡', '硬件'],
  'published'
FROM kb_categories c WHERE c.name = '硬件设备'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '登录公司系统提示账号已锁定或密码过期',
  c.id,
  '## 症状
用户尝试登录域或业务系统时，提示账户被锁定或密码已过期。

## 常见原因
- 多次输入错误密码导致账户锁定
- 密码超过有效期（如 90 天）
- AD 域控同步延迟
- 账号被管理员手动禁用

## 排查步骤
1. 在域控管理工具中查看用户状态，若锁定则解锁。
2. 若密码过期，引导用户通过自助重置或联系管理员重置。
3. 强制同步 AD（执行 repadmin /syncall）。
4. 检查用户是否在正确的 OU 下，且组策略未限制登录时间。

## 解决方案
解锁账户或重置密码即可恢复。',
  '账号锁定或密码过期排查',
  ARRAY['账号锁定', '密码过期', 'AD域控'],
  'published'
FROM kb_categories c WHERE c.name = '账号权限'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '笔记本电脑无法连接公司WiFi，提示无法连接到此网络',
  c.id,
  '## 症状
无线网络搜索到 SSID，但连接失败。

## 常见原因
- WiFi 密码变更未同步
- 无线网卡驱动过时
- MAC 地址过滤未添加
- DHCP 地址池已满

## 排查步骤
1. 检查无线网卡驱动是否最新（设备管理器 → 网络适配器）。
2. 删除该 WiFi 网络配置，重新输入密码连接。
3. 确认 AP 管理后台中 MAC 地址过滤规则是否允许该设备。
4. 查看 DHCP 地址池剩余 IP 数量，若不足则扩大地址池。
5. 尝试使用 5GHz 频段或更换无线信道。

## 解决方案
更新驱动、重新配置或调整 AP 设置后可恢复。',
  'WiFi连接故障排查',
  ARRAY['WiFi', '无线网络', 'DHCP'],
  'published'
FROM kb_categories c WHERE c.name = '网络故障'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '公司内部业务系统（如ERP）启动后闪退或无响应',
  c.id,
  '## 症状
打开业务软件后立即关闭或长时间卡顿。

## 常见原因
- Java 环境变量配置错误
- 应用程序配置文件损坏
- 内存不足或 CPU 占用过高
- 依赖的服务未启动（如数据库）

## 排查步骤
1. 查看应用程序日志（如 Windows 事件查看器）获取崩溃异常。
2. 检查系统内存和 CPU 使用率，关闭非必要进程。
3. 验证依赖服务（如 Oracle/MySQL 服务）是否运行正常。
4. 备份并重置应用程序配置文件（如 .conf 或 .xml）。
5. 重新安装或更新应用程序版本。

## 解决方案
修复配置、启动依赖服务或增加资源后恢复。',
  '业务系统闪退故障排查',
  ARRAY['ERP', '应用崩溃', 'Java'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '用户文件无法备份到公司NAS，提示空间不足或权限不足',
  c.id,
  '## 症状
备份操作失败，提示空间或权限问题。

## 常见原因
- NAS 存储配额已满
- 用户没有写入该共享目录的权限
- 网络传输中断（大文件）
- 备份软件配置错误

## 排查步骤
1. 检查 NAS 总容量和剩余空间，若满则清理过期备份或扩容。
2. 确认用户的 AD 组是否被授予该目录的写权限。
3. 尝试以管理员身份运行备份软件。
4. 拆分大文件或使用压缩工具分批备份。

## 解决方案
清理空间或分配权限后备份可正常进行。',
  'NAS备份故障排查',
  ARRAY['NAS', '数据备份', '存储'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '杀毒软件误报公司内部工具为病毒，导致无法运行',
  c.id,
  '## 症状
运行内部工具时被安全软件拦截并隔离。

## 常见原因
- 启发式扫描误报
- 工具没有数字签名
- 病毒库定义过于严格

## 排查步骤
1. 将误报文件添加到杀毒软件的白名单/排除列表。
2. 联系安全团队对该文件进行签名或提交样本分析。
3. 临时关闭实时防护（谨慎操作）。

## 解决方案
添加白名单后可恢复使用。',
  '杀毒软件误报排查',
  ARRAY['杀毒软件', '误报', '白名单'],
  'published'
FROM kb_categories c WHERE c.name = '安全防护'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '无法通过RDP连接到公司内网电脑，提示远程桌面服务当前正忙',
  c.id,
  '## 症状
远程桌面连接失败，提示服务忙。

## 常见原因
- 远程桌面连接数已达到上限
- 目标电脑未开启远程桌面
- 防火墙未放行 3389 端口
- 用户无远程登录权限

## 排查步骤
1. 在目标电脑上确认"远程桌面"功能已启用（设置 → 系统 → 远程桌面）。
2. 检查本地防火墙入站规则是否允许远程桌面（TCP 3389）。
3. 在服务器上查看当前 RDP 会话数，若满则强制断开空闲会话（使用 mstsc /admin）。
4. 确认用户账号在"远程桌面用户"组中。

## 解决方案
增加最大连接数或清理空闲会话，开启防火墙端口后即可连接。',
  'RDP远程桌面连接故障',
  ARRAY['RDP', '远程桌面', '3389'],
  'published'
FROM kb_categories c WHERE c.name = '网络故障'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '电脑系统时间错误，导致SSL证书验证失败或文件时间戳异常',
  c.id,
  '## 症状
系统时间明显偏离实际时间，访问 HTTPS 网站提示证书无效。

## 常见原因
- CMOS 电池耗尽
- NTP 服务器不可达
- 时区设置错误

## 排查步骤
1. 手动设置正确时间和日期。
2. 更换 CMOS 电池（若每次开机时间都重置）。
3. 配置 NTP 客户端同步至公司时间服务器（如 time.windows.com）。
4. 检查 Windows Time 服务是否启动。

## 解决方案
同步时间服务器或更换电池可解决。',
  '系统时间同步故障排查',
  ARRAY['时间同步', 'NTP', 'SSL证书'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  'C盘空间不足，系统运行缓慢或无法保存文件',
  c.id,
  '## 症状
系统盘可用空间几乎为零，电脑卡顿，保存文件失败。

## 常见原因
- 大量临时文件和下载文件堆积
- 回收站未清理
- 系统还原点占用过多空间
- 应用程序缓存过大

## 排查步骤
1. 运行磁盘清理（右键 C 盘 → 属性 → 磁盘清理）。
2. 清理回收站、下载文件夹和 Temp 目录。
3. 关闭或减少系统还原点所占空间。
4. 将非系统文件迁移到其他分区。

## 解决方案
释放磁盘空间后系统恢复正常。',
  'C盘空间不足排查',
  ARRAY['C盘', '磁盘空间', '磁盘清理'],
  'published'
FROM kb_categories c WHERE c.name = '硬件设备'
ON CONFLICT DO NOTHING;

INSERT INTO kb_articles (title, category_id, content, summary, tags, status)
SELECT
  '浏览器打开网页缓慢或显示异常，清除缓存后短暂恢复',
  c.id,
  '## 症状
网页加载缓慢或渲染错乱，清空缓存后暂时好转。

## 常见原因
- 浏览器缓存和 Cookie 过多
- 扩展程序冲突
- 硬件加速导致渲染问题
- DNS 预加载失败

## 排查步骤
1. 清除浏览器缓存、Cookie 和历史记录。
2. 禁用所有扩展程序，逐个启用排查冲突项。
3. 关闭硬件加速（设置 → 高级设置）。
4. 重置浏览器设置到默认状态。

## 解决方案
清除缓存和禁用冲突扩展后恢复正常。',
  '浏览器缓慢或显示异常排查',
  ARRAY['浏览器', '缓存', '扩展程序'],
  'published'
FROM kb_categories c WHERE c.name = '软件应用'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 脚本执行完毕
-- 数据库已包含：
--   10 张表 + RLS 策略 + 触发器
--   5 个部门、5 个知识库分类、11 项系统设置、20 篇知识库文章
-- ============================================================
