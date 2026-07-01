-- GHL OAuth 2.0 token storage
-- Run this in Supabase SQL Editor

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS ghl_oauth_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS ghl_oauth_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS ghl_oauth_expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ghl_oauth_location_id   TEXT;

-- Index for quick lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_ghl_oauth_location
  ON accounts (ghl_oauth_location_id)
  WHERE ghl_oauth_location_id IS NOT NULL;

COMMENT ON COLUMN public.accounts.ghl_oauth_access_token  IS 'GHL OAuth 2.0 access token (24h TTL, auto-refreshed)';
COMMENT ON COLUMN public.accounts.ghl_oauth_refresh_token IS 'GHL OAuth 2.0 refresh token (long-lived)';
COMMENT ON COLUMN public.accounts.ghl_oauth_expires_at    IS 'When the access token expires';
COMMENT ON COLUMN public.accounts.ghl_oauth_location_id   IS 'GHL location ID from OAuth token response';
