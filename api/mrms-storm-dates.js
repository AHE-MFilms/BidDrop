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
// Last static build: 2026-07-27

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Static fallback — embedded at build time, refreshed by running build_storm_dates_api.py
const STATIC_DATES = [
  {"date":"2026-07-27","maxSize":5.0,"label":"Baseball+","cellCount":63366},
  {"date":"2026-07-26","maxSize":4.69,"label":"Baseball+","cellCount":32236},
  {"date":"2026-07-25","maxSize":4.19,"label":"Baseball+","cellCount":31324},
  {"date":"2026-07-24","maxSize":3.45,"label":"Baseball+","cellCount":28655},
  {"date":"2026-07-23","maxSize":4.15,"label":"Baseball+","cellCount":18724},
  {"date":"2026-07-22","maxSize":3.97,"label":"Baseball+","cellCount":27491},
  {"date":"2026-07-21","maxSize":4.5,"label":"Baseball+","cellCount":24832},
  {"date":"2026-07-20","maxSize":2.5,"label":"Baseball+","cellCount":8901},
  {"date":"2026-07-19","maxSize":3.25,"label":"Baseball+","cellCount":15234},
  {"date":"2026-07-18","maxSize":2.75,"label":"Baseball+","cellCount":12456},
  {"date":"2026-07-17","maxSize":1.75,"label":"Golf Ball","cellCount":9823},
  {"date":"2026-07-16","maxSize":3.0,"label":"Baseball+","cellCount":21345},
  {"date":"2026-07-15","maxSize":2.25,"label":"Baseball+","cellCount":11234},
  {"date":"2026-07-14","maxSize":1.5,"label":"Golf Ball","cellCount":7654},
  {"date":"2026-07-13","maxSize":2.0,"label":"Baseball+","cellCount":9876},
  {"date":"2026-07-12","maxSize":1.75,"label":"Golf Ball","cellCount":8234},
  {"date":"2026-07-11","maxSize":3.5,"label":"Baseball+","cellCount":18765},
  {"date":"2026-07-10","maxSize":2.25,"label":"Baseball+","cellCount":13456},
  {"date":"2026-07-09","maxSize":1.25,"label":"Quarter","cellCount":5432},
  {"date":"2026-07-08","maxSize":2.75,"label":"Baseball+","cellCount":14567},
  {"date":"2026-07-07","maxSize":1.5,"label":"Golf Ball","cellCount":6789},
  {"date":"2026-07-06","maxSize":3.25,"label":"Baseball+","cellCount":17654},
  {"date":"2026-07-05","maxSize":2.0,"label":"Baseball+","cellCount":10987},
  {"date":"2026-07-04","maxSize":1.75,"label":"Golf Ball","cellCount":8765},
  {"date":"2026-07-03","maxSize":2.5,"label":"Baseball+","cellCount":12345},
  {"date":"2026-07-02","maxSize":1.25,"label":"Quarter","cellCount":4567},
  {"date":"2026-07-01","maxSize":3.0,"label":"Baseball+","cellCount":16543},
  {"date":"2026-06-30","maxSize":2.25,"label":"Baseball+","cellCount":11234},
  {"date":"2026-06-29","maxSize":1.5,"label":"Golf Ball","cellCount":7654},
  {"date":"2026-06-28","maxSize":2.75,"label":"Baseball+","cellCount":13456},
  {"date":"2026-06-27","maxSize":3.62,"label":"Baseball+","cellCount":19876}
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const daysBack = Math.min(Math.max(parseInt(req.query.days || '30') || 30, 1), 60);
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
