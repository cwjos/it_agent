/*
# Role-Based Access Control + Ticket System Enhancements

## Purpose
1. Add an `is_admin()` SQL helper that checks the current user's role.
2. Tighten RLS policies so only admins can INSERT/UPDATE/DELETE on:
   - kb_articles, kb_categories (knowledge base management)
   - employees (user management)
   - system_settings (system configuration)
   All authenticated users retain SELECT access.
3. Add new columns to the `tickets` table:
   - `solution` (text) — the resolution / fix description filled in when a ticket is closed.
   - `related_article_ids` (uuid[]) — KB article IDs referenced during resolution.
4. Add a `kb_articles_from_ticket` column to track which tickets a KB article was generated from (optional, nullable).
5. Update ticket status flow to support: pending → in_progress → pending_review → closed.

## Security Changes
- `is_admin()` helper function (SECURITY DEFINER, STABLE) returns true if the
  authenticated user's employee row has role = 'admin'.
- kb_articles: SELECT for authenticated; INSERT/UPDATE/DELETE for admin only.
- kb_categories: same pattern.
- employees: SELECT for authenticated; INSERT/UPDATE/DELETE for admin only.
- system_settings: SELECT for authenticated; INSERT/UPDATE/DELETE for admin only.
- Users can still UPDATE their OWN employee row (self-profile editing in Settings).

## New Columns
- tickets.solution (text, nullable)
- tickets.related_article_ids (uuid[], default '{}')
*/

-- ============================================================
-- 1. is_admin() helper function
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees
    WHERE auth_id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 2. Update RLS on kb_articles — admin-only writes
-- ============================================================
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kba_select" ON kb_articles;
CREATE POLICY "kba_select" ON kb_articles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "kba_insert" ON kb_articles;
CREATE POLICY "kba_insert" ON kb_articles FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "kba_update" ON kb_articles;
CREATE POLICY "kba_update" ON kb_articles FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "kba_delete" ON kb_articles;
CREATE POLICY "kba_delete" ON kb_articles FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- 3. Update RLS on kb_categories — admin-only writes
-- ============================================================
ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbc_select" ON kb_categories;
CREATE POLICY "kbc_select" ON kb_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "kbc_insert" ON kb_categories;
CREATE POLICY "kbc_insert" ON kb_categories FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "kbc_update" ON kb_categories;
CREATE POLICY "kbc_update" ON kb_categories FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "kbc_delete" ON kb_categories;
CREATE POLICY "kbc_delete" ON kb_categories FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- 4. Update RLS on employees — admin-only writes + self-update
-- ============================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_select" ON employees;
CREATE POLICY "emp_select" ON employees FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "emp_insert" ON employees;
CREATE POLICY "emp_insert" ON employees FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "emp_update" ON employees;
-- Admins can update anyone; users can update only their own row (self-profile)
CREATE POLICY "emp_update" ON employees FOR UPDATE
  TO authenticated
  USING (is_admin() OR auth_id = auth.uid())
  WITH CHECK (is_admin() OR auth_id = auth.uid());

DROP POLICY IF EXISTS "emp_delete" ON employees;
CREATE POLICY "emp_delete" ON employees FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- 5. Update RLS on system_settings — admin-only writes
-- ============================================================
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "set_select" ON system_settings;
CREATE POLICY "set_select" ON system_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "set_insert" ON system_settings;
CREATE POLICY "set_insert" ON system_settings FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "set_update" ON system_settings;
CREATE POLICY "set_update" ON system_settings FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "set_delete" ON system_settings;
CREATE POLICY "set_delete" ON system_settings FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- 6. Add new columns to tickets table
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'solution'
  ) THEN
    ALTER TABLE tickets ADD COLUMN solution text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'related_article_ids'
  ) THEN
    ALTER TABLE tickets ADD COLUMN related_article_ids uuid[] DEFAULT '{}';
  END IF;
END $$;

-- ============================================================
-- 7. Update ticket status constraints via a CHECK constraint
--    New flow: pending → in_progress → pending_review → closed
--    (also allow legacy statuses for backward compatibility)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tickets' AND constraint_name = 'tickets_status_check'
  ) THEN
    ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
    CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed',
                      'pending', 'pending_review'));
  END IF;
END $$;
