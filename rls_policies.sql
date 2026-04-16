-- ═══════════════════════════════════════════════════════════════════
-- BidDrop RLS Policies
-- Enables Row-Level Security on all public tables and adds policies
-- so users only see their own company's data.
--
-- Architecture notes:
--   • The anon key is used client-side (Supabase JS SDK)
--   • The service_role key is used server-side (/api/admin.js) — bypasses RLS
--   • super_admin users have account_id = NULL in user_profiles
--   • Regular users have account_id set to their company's account
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Helper: a function to get the current user's account_id
-- (avoids repeated subqueries and prevents recursion in RLS)
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth.user_account_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT account_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────
-- TABLE: user_profiles
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first
DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON public.user_profiles;

-- SELECT: users can see their own row + all rows in their account;
--         super_admins (account_id IS NULL) can see all rows
CREATE POLICY "user_profiles_select" ON public.user_profiles
  FOR SELECT USING (
    auth.uid() = id                                          -- own row
    OR account_id = auth.user_account_id()                   -- same account
    OR auth.user_role() = 'super_admin'                      -- super admin sees all
  );

-- INSERT: only super_admin or server-side (service_role bypasses RLS)
-- Client-side inserts only happen for the super_admin self-seeding case
CREATE POLICY "user_profiles_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id                                          -- inserting own row
    OR auth.user_role() = 'super_admin'
  );

-- UPDATE: users can update their own row; admins can update rows in their account;
--         super_admins can update all
CREATE POLICY "user_profiles_update" ON public.user_profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR (account_id = auth.user_account_id() AND auth.user_role() IN ('admin','super_admin'))
    OR auth.user_role() = 'super_admin'
  );

-- DELETE: admins can delete rows in their account; super_admins can delete all
CREATE POLICY "user_profiles_delete" ON public.user_profiles
  FOR DELETE USING (
    (account_id = auth.user_account_id() AND auth.user_role() IN ('admin','super_admin'))
    OR auth.user_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- TABLE: accounts
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounts_select" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete" ON public.accounts;

-- SELECT: users can read their own account; super_admins read all
CREATE POLICY "accounts_select" ON public.accounts
  FOR SELECT USING (
    id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

-- INSERT: super_admin only (client-side account creation)
CREATE POLICY "accounts_insert" ON public.accounts
  FOR INSERT WITH CHECK (
    auth.user_role() = 'super_admin'
  );

-- UPDATE: admins can update their own account; super_admins update all
CREATE POLICY "accounts_update" ON public.accounts
  FOR UPDATE USING (
    id = auth.user_account_id() AND auth.user_role() IN ('admin','super_admin')
    OR auth.user_role() = 'super_admin'
  );

-- DELETE: super_admin only
CREATE POLICY "accounts_delete" ON public.accounts
  FOR DELETE USING (
    auth.user_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- TABLE: pins
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pins_select" ON public.pins;
DROP POLICY IF EXISTS "pins_insert" ON public.pins;
DROP POLICY IF EXISTS "pins_update" ON public.pins;
DROP POLICY IF EXISTS "pins_delete" ON public.pins;

CREATE POLICY "pins_select" ON public.pins
  FOR SELECT USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "pins_insert" ON public.pins
  FOR INSERT WITH CHECK (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "pins_update" ON public.pins
  FOR UPDATE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "pins_delete" ON public.pins
  FOR DELETE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- TABLE: queue
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "queue_select" ON public.queue;
DROP POLICY IF EXISTS "queue_insert" ON public.queue;
DROP POLICY IF EXISTS "queue_update" ON public.queue;
DROP POLICY IF EXISTS "queue_delete" ON public.queue;

CREATE POLICY "queue_select" ON public.queue
  FOR SELECT USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "queue_insert" ON public.queue
  FOR INSERT WITH CHECK (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "queue_update" ON public.queue
  FOR UPDATE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "queue_delete" ON public.queue
  FOR DELETE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- TABLE: mailer_log
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.mailer_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mailer_log_select" ON public.mailer_log;
DROP POLICY IF EXISTS "mailer_log_insert" ON public.mailer_log;
DROP POLICY IF EXISTS "mailer_log_update" ON public.mailer_log;
DROP POLICY IF EXISTS "mailer_log_delete" ON public.mailer_log;

CREATE POLICY "mailer_log_select" ON public.mailer_log
  FOR SELECT USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "mailer_log_insert" ON public.mailer_log
  FOR INSERT WITH CHECK (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "mailer_log_update" ON public.mailer_log
  FOR UPDATE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "mailer_log_delete" ON public.mailer_log
  FOR DELETE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- TABLE: activity
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_select" ON public.activity;
DROP POLICY IF EXISTS "activity_insert" ON public.activity;
DROP POLICY IF EXISTS "activity_delete" ON public.activity;

CREATE POLICY "activity_select" ON public.activity
  FOR SELECT USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "activity_insert" ON public.activity
  FOR INSERT WITH CHECK (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "activity_delete" ON public.activity
  FOR DELETE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- TABLE: canvass_zones
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.canvass_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canvass_zones_select" ON public.canvass_zones;
DROP POLICY IF EXISTS "canvass_zones_insert" ON public.canvass_zones;
DROP POLICY IF EXISTS "canvass_zones_update" ON public.canvass_zones;
DROP POLICY IF EXISTS "canvass_zones_delete" ON public.canvass_zones;

CREATE POLICY "canvass_zones_select" ON public.canvass_zones
  FOR SELECT USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "canvass_zones_insert" ON public.canvass_zones
  FOR INSERT WITH CHECK (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "canvass_zones_update" ON public.canvass_zones
  FOR UPDATE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

CREATE POLICY "canvass_zones_delete" ON public.canvass_zones
  FOR DELETE USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────
-- TABLE: postcard_scans
-- INSERT is public (QR code scans come from unauthenticated homeowners)
-- SELECT is restricted to account members + super_admin
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.postcard_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "postcard_scans_select" ON public.postcard_scans;
DROP POLICY IF EXISTS "postcard_scans_insert" ON public.postcard_scans;

-- Anyone can INSERT a scan (homeowner scans QR code — no auth)
CREATE POLICY "postcard_scans_insert" ON public.postcard_scans
  FOR INSERT WITH CHECK (true);

-- Only account members and super_admin can read scans
CREATE POLICY "postcard_scans_select" ON public.postcard_scans
  FOR SELECT USING (
    account_id = auth.user_account_id()
    OR auth.user_role() = 'super_admin'
  );
