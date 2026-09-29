/*
# IT Operations Customer Service Platform - Core Schema

Complete schema for an enterprise IT operations management platform.
Tables: departments, employees, kb_categories, kb_articles, tickets,
ticket_records, conversations, messages, operation_logs, system_settings.
RLS enabled on all tables with authenticated CRUD access.
Note: tickets and conversations have a circular FK, so the cross-references
are added via ALTER TABLE after both tables exist.
*/

-- ============================================================
-- DEPARTMENTS
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
-- EMPLOYEES
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
-- KNOWLEDGE BASE CATEGORIES
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
-- KNOWLEDGE BASE ARTICLES
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
-- TICKETS (no conversation_id FK yet - added later)
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
-- CONVERSATIONS (no ticket_id FK yet - added later)
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

-- Now add the circular FKs
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
-- MESSAGES
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
-- TICKET RECORDS
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
-- OPERATION LOGS
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
-- SYSTEM SETTINGS
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
-- UPDATED_AT triggers
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
