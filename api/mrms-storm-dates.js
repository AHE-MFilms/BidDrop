// api/mrms-storm-dates.js
// Returns distinct storm dates with max hail size and cell count.
//
// Strategy:
//   1. Try to read from mrms_storm_dates_cache (refreshed daily by cron-refresh-storm-dates)
//   2. Fall back to STATIC_DATES embedded at build time if cache is unavailable
//
// The static fallback ensures the picker always works even if the cache table
// doesn't exist yet or the cron hasn't run.
//
// Last static build: 2026-08-04

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Static fallback — embedded at build time, refreshed by running build_storm_dates_api.py
const STATIC_DATES = [
  {"date": "2026-08-03", "label": "Baseball+", "maxSize": 3.59, "cellCount": 14025},
  {"date": "2026-08-02", "label": "Baseball+", "maxSize": 6.7, "cellCount": 15385},
  {"date": "2026-08-01", "label": "Baseball+", "maxSize": 3.68, "cellCount": 8771},
  {"date": "2026-07-31", "label": "Baseball+", "maxSize": 7.29, "cellCount": 24607},
  {"date": "2026-07-30", "label": "Baseball+", "maxSize": 3.63, "cellCount": 47023},
  {"date": "2026-07-29", "label": "Baseball+", "maxSize": 4.96, "cellCount": 29790},
  {"date": "2026-07-28", "label": "Baseball+", "maxSize": 5.74, "cellCount": 42847},
  {"date": "2026-07-27", "label": "Baseball+", "maxSize": 5, "cellCount": 96033},
  {"date": "2026-07-26", "label": "Baseball+", "maxSize": 4.69, "cellCount": 32236},
  {"date": "2026-07-25", "label": "Baseball+", "maxSize": 4.19, "cellCount": 31324},
  {"date": "2026-07-24", "label": "Baseball+", "maxSize": 3.45, "cellCount": 28655},
  {"date": "2026-07-23", "label": "Baseball+", "maxSize": 4.15, "cellCount": 18724},
  {"date": "2026-07-22", "label": "Baseball+", "maxSize": 5.81, "cellCount": 9743},
  {"date": "2026-07-21", "label": "Baseball+", "maxSize": 4.49, "cellCount": 40595},
  {"date": "2026-07-20", "label": "Baseball+", "maxSize": 3.59, "cellCount": 58649},
  {"date": "2026-07-19", "label": "Baseball+", "maxSize": 5.47, "cellCount": 53841},
  {"date": "2026-07-18", "label": "Baseball+", "maxSize": 3.76, "cellCount": 39946},
  {"date": "2026-07-17", "label": "Baseball+", "maxSize": 8.82, "cellCount": 35576},
  {"date": "2026-07-16", "label": "Baseball+", "maxSize": 6.2, "cellCount": 19438},
  {"date": "2026-07-15", "label": "Baseball+", "maxSize": 3.88, "cellCount": 31641},
  {"date": "2026-07-14", "label": "Baseball+", "maxSize": 5.04, "cellCount": 38866},
  {"date": "2026-07-13", "label": "Baseball+", "maxSize": 3.52, "cellCount": 54778},
  {"date": "2026-07-12", "label": "Baseball+", "maxSize": 3.55, "cellCount": 96796},
  {"date": "2026-07-11", "label": "Baseball+", "maxSize": 2.85, "cellCount": 42509},
  {"date": "2026-07-10", "label": "Baseball+", "maxSize": 3.44, "cellCount": 70004},
  {"date": "2026-07-09", "label": "Baseball+", "maxSize": 9.87, "cellCount": 71686},
  {"date": "2026-07-08", "label": "Baseball+", "maxSize": 4.82, "cellCount": 44868},
  {"date": "2026-07-07", "label": "Baseball+", "maxSize": 3.15, "cellCount": 44805},
  {"date": "2026-07-06", "label": "Baseball+", "maxSize": 3.95, "cellCount": 89801},
  {"date": "2026-07-05", "label": "Baseball+", "maxSize": 7.96, "cellCount": 99861},
  {"date": "2026-07-04", "label": "Baseball+", "maxSize": 6.41, "cellCount": 125979},
  {"date": "2026-07-03", "label": "Baseball+", "maxSize": 6.32, "cellCount": 118479},
  {"date": "2026-07-02", "label": "Baseball+", "maxSize": 3.69, "cellCount": 97453},
  {"date": "2026-07-01", "label": "Baseball+", "maxSize": 3.48, "cellCount": 81810},
  {"date": "2026-06-30", "label": "Baseball+", "maxSize": 3.14, "cellCount": 108518},
  {"date": "2026-06-29", "label": "Baseball+", "maxSize": 5.74, "cellCount": 106383},
  {"date": "2026-06-28", "label": "Baseball+", "maxSize": 3.43, "cellCount": 83850},
  {"date": "2026-06-27", "label": "Baseball+", "maxSize": 3.62, "cellCount": 67670},
  {"date": "2026-06-26", "label": "Baseball+", "maxSize": 3.42, "cellCount": 35820},
  {"date": "2026-06-25", "label": "Baseball+", "maxSize": 5.7, "cellCount": 72347},
  {"date": "2026-06-24", "label": "Baseball+", "maxSize": 4.33, "cellCount": 48994},
  {"date": "2026-06-23", "label": "Baseball+", "maxSize": 4.08, "cellCount": 64753},
  {"date": "2026-06-22", "label": "Baseball+", "maxSize": 16.86, "cellCount": 61641},
  {"date": "2026-06-21", "label": "Baseball+", "maxSize": 4.37, "cellCount": 64128},
  {"date": "2026-06-20", "label": "Baseball+", "maxSize": 4.36, "cellCount": 42739},
  {"date": "2026-06-19", "label": "Baseball+", "maxSize": 6.79, "cellCount": 45847},
  {"date": "2026-06-18", "label": "Baseball+", "maxSize": 3.35, "cellCount": 22545},
  {"date": "2026-06-17", "label": "Baseball+", "maxSize": 6.83, "cellCount": 34725},
  {"date": "2026-06-16", "label": "Baseball+", "maxSize": 3.72, "cellCount": 20994},
  {"date": "2026-06-15", "label": "Baseball+", "maxSize": 2.64, "cellCount": 6744},
  {"date": "2026-06-14", "label": "Baseball+", "maxSize": 2.85, "cellCount": 38367}
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const daysBack = Math.min(Math.max(parseInt(req.query.days || '30') || 30, 1), 120);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let result = null;

  // Try to read from the live cache table first
  if (SUPABASE_KEY) {
    try {
      const cacheResp = await fetch(
        `${SUPABASE_URL}/rest/v1/mrms_storm_dates_cache?id=eq.latest&select=data,updated_at`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (cacheResp.ok) {
        const rows = await cacheResp.json();
        if (rows && rows.length > 0 && Array.isArray(rows[0].data)) {
          result = rows[0].data;
        }
      }
    } catch (e) {
      // Cache unavailable — fall through to static
      console.warn('[mrms-storm-dates] Cache read failed:', e.message);
    }
  }

  // Fall back to embedded static data
  if (!result) {
    result = STATIC_DATES;
  }

  // Filter to requested window
  const filtered = result.filter(d => d.date >= cutoffStr);

  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
  return res.status(200).json(filtered);
}
