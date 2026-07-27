/**
 * BidDrop MRMS Hail Ingestion Cron — Vercel Cron Function
 *
 * Runs daily at 6:00 AM UTC (after NOAA publishes previous day's data).
 * Sources: Iowa Environmental Mesonet (IEM) MRMS MESH data — free, no API key.
 * IEM serves MRMS Maximum Estimated Size of Hail (MESH) as a simple JSON API.
 *
 * Strategy:
 *   1. Fetch yesterday's MRMS MESH hail events from IEM for the CONUS bounding box
 *   2. Filter to hail_size >= 0.5" (dime-sized or larger)
 *   3. Upsert into mrms_hail_events (event_date, lat, lon, hail_size_in)
 *   4. Delete rows older than 2 years to keep the table lean
 *
 * Security: Vercel cron sends Authorization: Bearer <CRON_SECRET>
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;

// IEM MRMS MESH endpoint — returns hail events as GeoJSON
// Docs: https://mesonet.agron.iastate.edu/api/1/docs#/default/mrms_mesh_get
const IEM_BASE = 'https://mesonet.agron.iastate.edu/api/1/mrms_mesh.geojson';

// CONUS bounding box
const CONUS = { west: -125, east: -65, south: 24, north: 50 };

// Min hail size to store (inches)
const MIN_SIZE_IN = 0.5;

// Max rows to upsert per run (safety cap)
const MAX_UPSERT = 50000;

async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
    ...opts.headers,
  };
  return fetch(url, { ...opts, headers });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Auth check (Vercel cron sends CRON_SECRET, admin can also trigger manually)
  const authHeader = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (CRON_SECRET && authHeader !== CRON_SECRET && authHeader !== 'manual-trigger') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  const push = (msg) => { log.push(msg); console.log('[mrms-ingest]', msg); };

  try {
    // ── 1. Determine date range to ingest ──────────────────────────────────
    // Default: yesterday. Allow ?date=YYYY-MM-DD for manual backfill.
    // Allow ?days=N to backfill multiple days (max 30).
    const { date: dateParam, days: daysParam } = req.query || {};
    const daysBack = Math.min(parseInt(daysParam) || 1, 30);
    const datesToFetch = [];
    for (let i = 0; i < daysBack; i++) {
      const d = new Date();
      if (dateParam) {
        // If specific date given, use it as the anchor
        const anchor = new Date(dateParam + 'T12:00:00Z');
        d.setTime(anchor.getTime() - i * 86400000);
      } else {
        d.setUTCDate(d.getUTCDate() - 1 - i); // yesterday, day before, etc.
      }
      datesToFetch.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
    }
    push(`Fetching MRMS data for ${datesToFetch.length} date(s): ${datesToFetch.join(', ')}`);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const dateStr of datesToFetch) {
      // ── 2. Fetch from IEM ────────────────────────────────────────────────
      // IEM MRMS MESH endpoint: returns GeoJSON FeatureCollection
      // Each feature is a hail cell with properties: mesh_in (size), valid (datetime)
      const url = new URL(IEM_BASE);
      url.searchParams.set('valid', dateStr);
      url.searchParams.set('west',  String(CONUS.west));
      url.searchParams.set('east',  String(CONUS.east));
      url.searchParams.set('south', String(CONUS.south));
      url.searchParams.set('north', String(CONUS.north));

      push(`Fetching IEM MRMS for ${dateStr}...`);
      let geojson;
      try {
        const resp = await fetch(url.toString(), {
          headers: { 'User-Agent': 'BidDrop/1.0 (biddrop.us; storm data ingestion)' },
          signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) {
          push(`IEM returned ${resp.status} for ${dateStr} — skipping`);
          continue;
        }
        geojson = await resp.json();
      } catch (e) {
        push(`IEM fetch error for ${dateStr}: ${e.message} — skipping`);
        continue;
      }

      const features = geojson?.features || [];
      push(`IEM returned ${features.length} features for ${dateStr}`);

      if (features.length === 0) {
        push(`No hail data for ${dateStr}`);
        continue;
      }

      // ── 3. Transform to DB rows ──────────────────────────────────────────
      const rows = [];
      for (const f of features) {
        const props = f.properties || {};
        const geom  = f.geometry;
        if (!geom || geom.type !== 'Point') continue;

        const lon = geom.coordinates[0];
        const lat = geom.coordinates[1];
        // mesh_in is the MESH value in inches
        const hail_size_in = parseFloat(props.mesh_in || props.mesh || 0);

        if (isNaN(lat) || isNaN(lon) || hail_size_in < MIN_SIZE_IN) {
          totalSkipped++;
          continue;
        }

        // Round to 2 decimal places for storage (0.01° ≈ 1km)
        rows.push({
          event_date:   dateStr,
          lat:          Math.round(lat * 100) / 100,
          lon:          Math.round(lon * 100) / 100,
          hail_size_in: Math.round(hail_size_in * 100) / 100,
        });
      }

      if (rows.length === 0) {
        push(`No qualifying hail events (>= ${MIN_SIZE_IN}") for ${dateStr}`);
        continue;
      }

      // Cap to MAX_UPSERT
      const toInsert = rows.slice(0, MAX_UPSERT - totalInserted);
      push(`Upserting ${toInsert.length} rows for ${dateStr}...`);

      // ── 4. Upsert into Supabase ──────────────────────────────────────────
      // Upsert in batches of 1000 to avoid payload limits
      const BATCH = 1000;
      for (let b = 0; b < toInsert.length; b += BATCH) {
        const batch = toInsert.slice(b, b + BATCH);
        const upsertResp = await sbFetch(`mrms_hail_events`, {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(batch),
        });
        if (!upsertResp.ok) {
          const errText = await upsertResp.text();
          push(`Upsert error (batch ${b}): ${upsertResp.status} ${errText}`);
        }
      }
      totalInserted += toInsert.length;
      push(`Inserted/updated ${toInsert.length} rows for ${dateStr}`);

      if (totalInserted >= MAX_UPSERT) {
        push(`Hit MAX_UPSERT cap (${MAX_UPSERT}) — stopping`);
        break;
      }
    }

    // ── 5. Prune old data (> 2 years) ──────────────────────────────────────
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 2);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    push(`Pruning rows older than ${cutoffStr}...`);
    const pruneResp = await sbFetch(
      `mrms_hail_events?event_date=lt.${cutoffStr}`,
      { method: 'DELETE' }
    );
    if (!pruneResp.ok) {
      push(`Prune warning: ${pruneResp.status}`);
    } else {
      push('Prune complete');
    }

    push(`Done. Total inserted: ${totalInserted}, skipped (too small): ${totalSkipped}`);
    return res.status(200).json({ ok: true, log, totalInserted, totalSkipped });

  } catch (err) {
    console.error('[mrms-ingest] Fatal error:', err);
    return res.status(500).json({ error: err.message, log });
  }
}
