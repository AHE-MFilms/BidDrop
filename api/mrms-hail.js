// api/mrms-hail.js
// Returns NOAA MRMS radar hail events for a given bounding box and date range.
// Used by the BidDrop storm layer to show radar-grade hail swaths on the map.
//
// Query params:
//   swLat, swLng, neLat, neLng  — bounding box (required)
//   days                        — how many days back to query (default: 90, max: 365)
//   minSize                     — minimum hail size in inches (default: 0.5)
//   exactDate                   — YYYY-MM-DD: fetch ONLY this date (overrides days)
//                                 Uses higher row limit since it's a single day
//
// Returns JSON array of hail events:
//   [{ event_date, lat, lon, hail_size_in }, ...]

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TABLE = 'mrms_hail_events';

// Max rows for multi-day queries (prevents massive payloads)
const MAX_ROWS_MULTI = 20000;
// Max rows for single-day exact queries — one day can have up to ~65k cells
const MAX_ROWS_SINGLE = 80000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { swLat, swLng, neLat, neLng, days = '90', minSize = '0.5', exactDate } = req.query;

  // Validate bounding box
  const sw_lat = parseFloat(swLat);
  const sw_lng = parseFloat(swLng);
  const ne_lat = parseFloat(neLat);
  const ne_lng = parseFloat(neLng);

  if ([sw_lat, sw_lng, ne_lat, ne_lng].some(isNaN)) {
    return res.status(400).json({ error: 'Invalid bounding box. Provide swLat, swLng, neLat, neLng.' });
  }

  const minSizeIn = Math.max(parseFloat(minSize) || 0.5, 0.1);

  if (!SUPABASE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });
  }

  let dateFilter;
  let maxRows;

  if (exactDate && /^\d{4}-\d{2}-\d{2}$/.test(exactDate)) {
    // Single exact date — use eq filter and higher row limit
    dateFilter = { event_date: `eq.${exactDate}` };
    maxRows = MAX_ROWS_SINGLE;
  } else {
    // Date range — calculate cutoff
    const daysBack = Math.min(Math.max(parseInt(days) || 90, 1), 365);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    dateFilter = { event_date: `gte.${cutoffStr}` };
    maxRows = MAX_ROWS_MULTI;
  }

  // Build Supabase REST query
  // NOTE: Do NOT include limit= param — use Range header instead to override
  // Supabase's default 1,000-row cap. The limit= param takes precedence over Range.
  const params = new URLSearchParams({
    select: 'event_date,lat,lon,hail_size_in',
    ...dateFilter,
    lat: `gte.${sw_lat}`,
    hail_size_in: `gte.${minSizeIn}`,
    order: 'event_date.desc',
  });

  // Supabase REST doesn't support BETWEEN directly — use the `and` query param
  const andFilter = `lat.lte.${ne_lat},lon.gte.${sw_lng},lon.lte.${ne_lng}`;
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?${params.toString()}&and=(${encodeURIComponent(andFilter)})`;

  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
        // Range header overrides Supabase's default 1,000-row limit
        // For single-date: up to 80k rows; for multi-day: up to 20k rows
        'Range-Unit': 'items',
        'Range': `0-${maxRows - 1}`,
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[mrms-hail] Supabase error:', resp.status, err);
      return res.status(502).json({ error: 'Database query failed', detail: err });
    }

    const data = await resp.json();

    // Cache for 30 minutes — data only changes once per day
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
    return res.status(200).json(data);

  } catch (err) {
    console.error('[mrms-hail] Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
