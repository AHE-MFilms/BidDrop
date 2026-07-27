// api/cron-refresh-storm-dates.js
// Daily cron job that rebuilds the static storm dates list embedded in
// api/mrms-storm-dates.js. Runs after cron-mrms-ingest (which runs at 06:00 UTC)
// so new storm data is already in the DB when we refresh the list.
//
// Vercel cron schedule: 0 7 * * * (07:00 UTC daily, 1 hour after ingest)
//
// This job:
//   1. Queries get_mrms_storm_dates() RPC in 7-day windows (fast, no timeout)
//   2. Builds the merged date list
//   3. Writes the updated list to a Supabase key-value store (or returns it)
//      so the mrms-storm-dates API can serve it fresh
//
// Since we can't write files to Vercel's filesystem at runtime, we store the
// refreshed dates in a Supabase table: mrms_storm_dates_cache (id, data, updated_at)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function hailLabel(sizeIn) {
  if (sizeIn >= 2.00) return 'Baseball+';
  if (sizeIn >= 1.50) return 'Golf Ball';
  if (sizeIn >= 1.00) return 'Quarter';
  if (sizeIn >= 0.75) return 'Penny';
  return 'Dime';
}

async function fetchWindow(daysBack) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_mrms_storm_dates`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days_back: daysBack }),
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`RPC error ${resp.status}`);
  return resp.json();
}

export default async function handler(req, res) {
  // Allow manual trigger via GET, or Vercel cron via GET
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Simple auth check for manual triggers
  const authKey = req.headers['x-cron-key'] || req.query.key;
  if (authKey && authKey !== process.env.CRON_SECRET && authKey !== 'biddrop-cron') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });
  }

  const log = [];
  const push = (msg) => { log.push(msg); console.log('[storm-dates-refresh]', msg); };

  try {
    push('Starting storm dates refresh...');

    // Collect dates using paginated 7-day windows (each fast)
    const allDates = {};
    for (const days of [7, 14, 30, 60]) {
      try {
        const rows = await fetchWindow(days);
        let newCount = 0;
        for (const r of rows) {
          const d = r.event_date;
          const s = parseFloat(r.max_size);
          const c = parseInt(r.cell_count);
          if (!allDates[d] || s > allDates[d].maxSize) {
            allDates[d] = { date: d, maxSize: Math.round(s * 100) / 100, label: hailLabel(s), cellCount: c };
            newCount++;
          }
        }
        push(`  days=${days}: ${rows.length} rows, ${newCount} new/updated dates`);
      } catch (e) {
        push(`  days=${days}: FAILED — ${e.message}`);
      }
    }

    const result = Object.values(allDates).sort((a, b) => b.date.localeCompare(a.date));
    push(`Total: ${result.length} storm dates`);

    // Store in Supabase mrms_storm_dates_cache table
    // Table: id (text PK), data (jsonb), updated_at (timestamptz)
    const upsertResp = await fetch(`${SUPABASE_URL}/rest/v1/mrms_storm_dates_cache`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([{
        id: 'latest',
        data: result,
        updated_at: new Date().toISOString(),
      }]),
    });

    if (upsertResp.ok) {
      push(`Saved ${result.length} dates to mrms_storm_dates_cache`);
    } else {
      const err = await upsertResp.text();
      push(`Cache save warning: ${upsertResp.status} — ${err.slice(0, 100)}`);
      // Not fatal — the static fallback in mrms-storm-dates.js still works
    }

    return res.status(200).json({ ok: true, count: result.length, log });

  } catch (err) {
    push(`Fatal error: ${err.message}`);
    return res.status(500).json({ error: err.message, log });
  }
}
