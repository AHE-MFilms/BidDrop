/**
 * BidDrop Trash Purge Cron — Vercel Cron Function
 *
 * Runs daily at 2:00 AM UTC.
 * Hard-deletes pins and estimates that have been in the trash (deleted_at IS NOT NULL)
 * for more than 30 days.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header (set by Vercel cron).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;

function sbFetch(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...opts.headers
    }
  });
}

export default async function handler(req, res) {
  // Verify cron secret — fail-closed (reject if CRON_SECRET not configured)
  if (!CRON_SECRET) { return res.status(500).json({ error: 'CRON_SECRET not configured' }); }
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${CRON_SECRET}`) { return res.status(401).json({ error: 'Unauthorized' }); }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const log = [];

  try {
    // ── 1. Hard-delete estimates trashed > 30 days ago ──────────────────────
    const estResp = await sbFetch(
      `estimates?deleted_at=lt.${encodeURIComponent(cutoff)}&deleted_at=not.is.null`,
      { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
    );
    const estCount = estResp.headers.get('content-range')
      ? parseInt((estResp.headers.get('content-range') || '').split('/')[1] || '0', 10)
      : 0;
    log.push(`estimates purged: ${estResp.ok ? (estCount || 'ok') : 'error ' + estResp.status}`);

    // ── 2. Hard-delete pins trashed > 30 days ago ───────────────────────────
    const pinResp = await sbFetch(
      `pins?deleted_at=lt.${encodeURIComponent(cutoff)}&deleted_at=not.is.null`,
      { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
    );
    const pinCount = pinResp.headers.get('content-range')
      ? parseInt((pinResp.headers.get('content-range') || '').split('/')[1] || '0', 10)
      : 0;
    log.push(`pins purged: ${pinResp.ok ? (pinCount || 'ok') : 'error ' + pinResp.status}`);

    console.log('[cron-purge-trash]', log.join(' | '), '| cutoff:', cutoff);
    return res.status(200).json({ ok: true, cutoff, log });

  } catch (err) {
    console.error('[cron-purge-trash] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
