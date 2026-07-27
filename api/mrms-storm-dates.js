// api/mrms-storm-dates.js
// Returns distinct storm dates with max hail size and cell count.
// Uses the get_mrms_storm_dates() Supabase RPC function which does a
// server-side GROUP BY — bypasses the 1,000-row REST API limit.
//
// Query params:
//   days  — how many days back to look (default: 30, max: 90)
//
// Returns JSON array sorted newest-first:
//   [{ date: "2026-07-24", maxSize: 2.12, label: "Baseball+", cellCount: 4821 }, ...]

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function hailLabel(sizeIn) {
  if (sizeIn >= 2.00) return 'Baseball+';
  if (sizeIn >= 1.50) return 'Golf Ball';
  if (sizeIn >= 1.00) return 'Quarter';
  if (sizeIn >= 0.75) return 'Penny';
  return 'Dime';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });
  }

  // Default 30 days — fast enough (~5s). Cap at 90 days.
  const daysBack = Math.min(Math.max(parseInt(req.query.days || '30') || 30, 1), 90);

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_mrms_storm_dates`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ days_back: daysBack }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[mrms-storm-dates] RPC error:', resp.status, err);
      return res.status(502).json({ error: 'Database query failed', detail: err });
    }

    const rows = await resp.json();

    if (!Array.isArray(rows)) {
      return res.status(502).json({ error: 'Unexpected response from database', detail: rows });
    }

    // Map to our output format
    const result = rows.map(r => ({
      date: r.event_date,
      maxSize: Math.round(parseFloat(r.max_size) * 100) / 100,
      label: hailLabel(parseFloat(r.max_size)),
      cellCount: parseInt(r.cell_count),
    }));

    // Cache for 15 minutes — data only changes once per day
    res.setHeader('Cache-Control', 'public, max-age=900, stale-while-revalidate=1800');
    return res.status(200).json(result);

  } catch (err) {
    console.error('[mrms-storm-dates] Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
