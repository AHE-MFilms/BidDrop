/**
 * BidDrop MRMS Viewport API
 * Returns MRMS hail points within a map bounding box for a specific storm date.
 * Used by Storm Mode to render the hail intensity overlay on the canvass map.
 *
 * GET /api/mrms-viewport?date=2026-07-27&latMin=42.1&latMax=42.5&lonMin=-83.8&lonMax=-83.1
 * Returns: { date, points: [{lat, lon, hail_size_in}], count }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const MAX_POINTS   = 8000; // cap to keep response fast

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { date, latMin, latMax, lonMin, lonMax } = req.query;

  if (!date || !latMin || !latMax || !lonMin || !lonMax) {
    return res.status(400).json({ error: 'date, latMin, latMax, lonMin, lonMax are required' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD format' });
  }

  const lMin = parseFloat(latMin), lMax = parseFloat(latMax);
  const oMin = parseFloat(lonMin), oMax = parseFloat(lonMax);

  if (isNaN(lMin) || isNaN(lMax) || isNaN(oMin) || isNaN(oMax)) {
    return res.status(400).json({ error: 'Invalid bounding box coordinates' });
  }

  // Clamp bounding box to reasonable size (max ~200 mile square)
  const latSpan = Math.min(lMax - lMin, 3.0);
  const lonSpan = Math.min(oMax - oMin, 4.0);
  const clampedLatMax = lMin + latSpan;
  const clampedLonMax = oMin + lonSpan;

  try {
    const url = `${SUPABASE_URL}/rest/v1/mrms_hail_events` +
      `?event_date=eq.${date}` +
      `&lat=gte.${lMin}&lat=lte.${clampedLatMax}` +
      `&lon=gte.${oMin}&lon=lte.${clampedLonMax}` +
      `&order=hail_size_in.desc` +
      `&limit=${MAX_POINTS}` +
      `&select=lat,lon,hail_size_in`;

    const r = await fetch(url, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: 'Database error', detail: err });
    }

    const points = await r.json();

    // Cache aggressively — MRMS data for past dates never changes
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    return res.status(200).json({
      date,
      bounds: { latMin: lMin, latMax: clampedLatMax, lonMin: oMin, lonMax: clampedLonMax },
      count: points.length,
      points
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
