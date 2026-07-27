// api/mrms-storm-dates.js
// Returns distinct storm dates from the MRMS database for the past N days,
// with max hail size per date. Used to populate the Storm Date Picker.
//
// Query params:
//   days  — how many days back to look (default: 90, max: 365)
//
// Returns JSON array sorted newest-first:
//   [{ date: "2026-07-24", maxSize: 2.12, label: "Baseball+", cellCount: 4821 }, ...]

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TABLE = 'mrms_hail_events';

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

  const daysBack = Math.min(Math.max(parseInt(req.query.days || '90') || 90, 1), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Fetch all distinct dates with max hail size — use a large limit since
  // there are at most ~365 distinct dates and we need to aggregate client-side
  // (Supabase REST doesn't support GROUP BY natively)
  const params = new URLSearchParams({
    select: 'event_date,hail_size_in',
    event_date: `gte.${cutoffStr}`,
    order: 'event_date.desc',
    limit: '500000', // enough to cover all cells across 90 days
  });

  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?${params.toString()}`;

  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
        // Use CSV for faster transfer — we only need 2 columns
        'Accept-Profile': 'public',
      },
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('[mrms-storm-dates] Supabase error:', resp.status, err);
      return res.status(502).json({ error: 'Database query failed', detail: err });
    }

    const rows = await resp.json();

    // Aggregate: group by event_date, find max hail_size_in and count cells
    const byDate = {};
    for (const row of rows) {
      const d = row.event_date;
      const s = parseFloat(row.hail_size_in);
      if (!byDate[d]) {
        byDate[d] = { date: d, maxSize: s, cellCount: 1 };
      } else {
        if (s > byDate[d].maxSize) byDate[d].maxSize = s;
        byDate[d].cellCount++;
      }
    }

    // Sort newest first, add human label
    const result = Object.values(byDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(d => ({
        date: d.date,
        maxSize: Math.round(d.maxSize * 100) / 100,
        label: hailLabel(d.maxSize),
        cellCount: d.cellCount,
      }));

    // Cache for 30 minutes — data only changes once per day
    res.setHeader('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
    return res.status(200).json(result);

  } catch (err) {
    console.error('[mrms-storm-dates] Fetch error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
