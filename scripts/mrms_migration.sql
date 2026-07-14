-- Migration: Create mrms_hail_events table for NOAA MRMS MESH radar hail data
-- Run this once in the Supabase SQL editor.
--
-- This table stores radar-estimated hail grid cells (1km resolution, ~0.001° precision)
-- ingested nightly from NOAA's free public S3 bucket (noaa-mrms-pds).
--
-- Columns:
--   event_date    DATE        — The date the hail occurred (UTC)
--   lat           NUMERIC     — Latitude of grid cell center (3 decimal places ≈ 111m)
--   lon           NUMERIC     — Longitude of grid cell center (3 decimal places ≈ 111m)
--   hail_size_in  NUMERIC     — Maximum estimated hail size in inches for this cell/date
--   created_at    TIMESTAMPTZ — Row insertion timestamp

CREATE TABLE IF NOT EXISTS mrms_hail_events (
  id            BIGSERIAL PRIMARY KEY,
  event_date    DATE        NOT NULL,
  lat           NUMERIC(8,3) NOT NULL,
  lon           NUMERIC(8,3) NOT NULL,
  hail_size_in  NUMERIC(5,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint enables upsert (ON CONFLICT DO UPDATE)
  UNIQUE (event_date, lat, lon)
);

-- Spatial index for fast bounding-box queries (lat/lon range scans)
CREATE INDEX IF NOT EXISTS idx_mrms_hail_lat_lon
  ON mrms_hail_events (lat, lon);

-- Date index for filtering by recency
CREATE INDEX IF NOT EXISTS idx_mrms_hail_date
  ON mrms_hail_events (event_date DESC);

-- Composite index for the most common query pattern: date range + bounding box
CREATE INDEX IF NOT EXISTS idx_mrms_hail_date_lat_lon
  ON mrms_hail_events (event_date DESC, lat, lon);

-- Row Level Security: allow public read (the API endpoint uses service key for writes)
ALTER TABLE mrms_hail_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of mrms_hail_events"
  ON mrms_hail_events
  FOR SELECT
  USING (true);

-- Only service role can insert/update/delete
CREATE POLICY "Service role can write mrms_hail_events"
  ON mrms_hail_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Optional: auto-delete data older than 2 years to keep table size manageable
-- (Run manually or via a pg_cron job if you have it enabled)
-- DELETE FROM mrms_hail_events WHERE event_date < NOW() - INTERVAL '2 years';
