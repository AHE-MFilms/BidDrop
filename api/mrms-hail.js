// api/mrms-hail.js
// Returns NOAA MRMS radar hail events for a given bounding box and date range.
// Used by the BidDrop storm layer to show radar-grade hail swaths on the map.
//
// Query params:
//   swLat, swLng, neLat, neLng  — bounding box (required)
//   days                        — how many days back to query (default: 90, max: 365)
//   minSize                     — minimum hail size in inches (default: 0.5)
//
// Returns JSON array of hail events:
//   [{ event_date, lat, lon, hail_size_in }, ...]
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_ANON_KEY  (read-only, safe for this endpoint)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TABLE = 'mrms_hail_events';

// Max rows to return per request (prevents massive payloads)
const MAX_ROWS = 5000;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { swLat, swLng, neLat, neLng, days = '90', minSize = '0.5' } = req.query;

  // Validate bounding box
  const sw_lat = parseFloat(swLat);
  const sw_lng = parseFloat(swLng);
  const ne_lat = parseFloat(neLat);
  const ne_lng = parseFloat(neLng);

  if ([sw_lat, sw_lng, ne_lat, ne_lng].some(isNaN)) {
    return res.status(400).json({ error: 'Invalid bounding box. Provide swLat, swLng, neLat, neLng.' });
  }

  // Clamp days to 1–365
  const daysBack = Math.min(Math.max(parseInt(days) || 90, 1), 365);
  const minSizeIn = Math.max(parseFloat(minSize) || 0.5, 0.1);

  // Calculate cutoff date
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

  if (!SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'SUPABASE_ANON_KEY not configured' });
  }

  // Build Supabase REST query
  // Filter: event_date >= cutoff AND lat BETWEEN sw_lat AND ne_lat
  //         AND lon BETWEEN sw_lng AND ne_lng AND hail_size_in >= minSizeIn
  const params = new URLSearchParams({
    select: 'event_date,lat,lon,hail_size_in',
    event_date: `gte.${cutoffStr}`,
    lat: `gte.${sw_lat}`,
    // Additional lat filter handled below via and= param
    hail_size_in: `gte.${minSizeIn}`,
    order: 'event_date.desc',
    limit: String(MAX_ROWS),
  });

  // Supabase REST doesn't support BETWEEN directly — use two separate filters
  // via the `and` query param
  const andFilter = `lat.lte.${ne_lat},lon.gte.${sw_lng},lon.lte.${ne_lng}`;

  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?${params.toString()}&and=(${encodeURIComponent(andFilter)})`;

  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
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
