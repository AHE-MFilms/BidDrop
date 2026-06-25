-- JobNimbus CRM integration columns
-- Run this in Supabase SQL Editor

-- Add JobNimbus API key and contact config to accounts table
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS jn_api_key     TEXT,
  ADD COLUMN IF NOT EXISTS jn_record_type TEXT DEFAULT 'Customer',
  ADD COLUMN IF NOT EXISTS jn_status      TEXT DEFAULT 'Lead';

-- Add JobNimbus contact ID to pins table (to avoid duplicate contact creation)
ALTER TABLE public.pins
  ADD COLUMN IF NOT EXISTS jn_contact_id TEXT;

-- Index for quick lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pins_jn_contact_id
  ON pins (jn_contact_id)
  WHERE jn_contact_id IS NOT NULL;

COMMENT ON COLUMN public.accounts.jn_api_key     IS 'JobNimbus API key (bearer token)';
COMMENT ON COLUMN public.accounts.jn_record_type IS 'JobNimbus contact record type name (e.g. Customer)';
COMMENT ON COLUMN public.accounts.jn_status      IS 'JobNimbus contact status name (e.g. Lead)';
COMMENT ON COLUMN public.pins.jn_contact_id      IS 'JobNimbus contact jnid — stored to avoid duplicate creation';
