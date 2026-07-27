// api/mrms-storm-dates.js
// Returns distinct storm dates with max hail size and cell count.
//
// Strategy: The get_mrms_storm_dates() RPC times out on Vercel when querying
// 30+ days (too many rows). Instead, we fire multiple parallel 7-day window
// queries and merge the results. Each 7-day query completes in ~1-2s.
//
// Query params:
//   days  — how many days back to look (default: 30, max: 60)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function hailLabel(sizeIn) {
  if (sizeIn >= 2.00) return 'Baseball+';
  if (sizeIn >= 1.50) return 'Golf Ball';
  if (sizeIn >= 1.00) return 'Quarter';
  if (sizeIn >= 0.75) return 'Penny';
  return 'Dime';
}

async function fetchWindow(daysEnd, daysStart) {
  // daysEnd: how many days ago the window ENDS (closer to today)
  // daysStart: how many days ago the window STARTS (further from today)
  // e.g. daysEnd=0, daysStart=7 → last 7 days
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_mrms_storm_dates`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days_back: daysStart }),
    signal: AbortSignal.timeout(8000), // 8s per window
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`RPC error ${resp.status}: ${err.slice(0, 100)}`);
  }

  const rows = await resp.json();
  // Filter to only the rows within this window
  const today = new Date();
  const cutoffEnd = new Date(today);
  cutoffEnd.setDate(cutoffEnd.getDate() - daysEnd);
  const cutoffStart = new Date(today);
  cutoffStart.setDate(cutoffStart.getDate() - daysStart);

  return rows.filter(r => {
    const d = new Date(r.event_date + 'T12:00:00Z');
    return d >= cutoffStart && d <= cutoffEnd;
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });
  }

  const daysBack = Math.min(Math.max(parseInt(req.query.days || '30') || 30, 1), 60);

  try {
    // Fire parallel 7-day window queries
    // Window 1: days 0-7, Window 2: days 7-14, Window 3: days 14-21, Window 4: days 21-28, etc.
    const windowSize = 7;
    const numWindows = Math.ceil(daysBack / windowSize);
    const windowPromises = [];

    for (let i = 0; i < numWindows; i++) {
      const wEnd = i * windowSize;
      const wStart = Math.min((i + 1) * windowSize, daysBack);
      // Each window: fetch days 0..wStart and filter to wEnd..wStart
      windowPromises.push(
        fetchWindow(wEnd, wStart).catch(err => {
          console.warn(`[mrms-storm-dates] Window ${wEnd}-${wStart} failed:`, err.message);
          return []; // return empty on failure — don't break the whole response
        })
      );
    }

    const windowResults = await Promise.all(windowPromises);

    // Merge all windows, deduplicate by date (take max hail size)
    const byDate = {};
    for (const rows of windowResults) {
      for (const r of rows) {
        const d = r.event_date;
        const s = parseFloat(r.max_size);
        const c = parseInt(r.cell_count);
        if (!byDate[d] || s > byDate[d].maxSize) {
          byDate[d] = { date: d, maxSize: s, cellCount: c };
        }
      }
    }

    const result = Object.values(byDate)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(d => ({
        date: d.date,
        maxSize: Math.round(d.maxSize * 100) / 100,
        label: hailLabel(d.maxSize),
        cellCount: d.cellCount,
      }));

    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200');
    return res.status(200).json(result);

  } catch (err) {
    console.error('[mrms-storm-dates] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
