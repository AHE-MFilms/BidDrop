-- ============================================================
-- BidDrop Supabase Performance Indexes
-- Run in Supabase SQL Editor to reduce Disk IO
-- ============================================================

-- ── pins table ──────────────────────────────────────────────
-- Most queries filter by account_id + deleted_at + created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pins_account_deleted_created
  ON pins (account_id, deleted_at, created_at DESC);

-- Viewport queries filter by lat/lng bounding box
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pins_account_lat_lng
  ON pins (account_id, lat, lng)
  WHERE deleted_at IS NULL;

-- GHL contact ID lookup (used by ghlUpsertContact Supabase-first path)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pins_id_ghl_contact
  ON pins (id, ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

-- Status filter (pipeline/archive views)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pins_account_status
  ON pins (account_id, status)
  WHERE deleted_at IS NULL;

-- ── estimates table ─────────────────────────────────────────
-- Primary load query: account_id + saved_at DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estimates_account_saved
  ON estimates (account_id, saved_at DESC)
  WHERE deleted_at IS NULL;

-- Analytics query: account_id + created_at (date range filter)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estimates_account_created
  ON estimates (account_id, created_at DESC);

-- Hot leads query: account_id + page_views > 0 + page_last_viewed_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estimates_account_pageviews
  ON estimates (account_id, page_last_viewed_at DESC)
  WHERE page_views > 0;

-- pin_id lookup (used when saving/linking estimates to pins)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_estimates_pin_id
  ON estimates (pin_id)
  WHERE pin_id IS NOT NULL;

-- ── queue table ─────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_queue_account_created
  ON queue (account_id, created_at DESC);

-- ── mailer_log table ────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mailer_log_account_sent
  ON mailer_log (account_id, sent_at DESC);

-- ── credit_purchases table ──────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_purchases_account_status
  ON credit_purchases (account_id, status, completed_at DESC);

-- ── user_profiles table ─────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_account
  ON user_profiles (account_id);

-- ── canvass_zones table ─────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_canvass_zones_account
  ON canvass_zones (account_id);

-- ── activity table ──────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_account_created
  ON activity (account_id, created_at DESC);
