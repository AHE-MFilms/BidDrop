/**
 * BidDrop Pixel API — /api/pixel
 *
 * Handles two actions:
 *  POST { action:'hit', pixelId, sessionSeconds, pageUrl, referrer }
 *    → Looks up account by pixel_id, logs the hit to pixel_hits table.
 *      Returns a 1x1 transparent GIF so it can also be called as an img src.
 *
 *  GET  ?action=list&accountId=xxx&limit=50&offset=0
 *    → Returns pixel_hits for the account (requires Authorization header with user JWT).
 *
 *  POST { action:'dismiss', id }
 *    → Sets resolution_status = 'dismissed' on a hit.
 *      Requires Authorization header; verifies hit belongs to caller's account.
 *
 *  POST { action:'queue_postcard', id }
 *    → Sets postcard_queued = true on a hit.
 *      Requires Authorization header; verifies hit belongs to caller's account.
 *
 *  POST { action:'generate_pixel_id', accountId }
 *    → Generates and saves a new pixel_id for the account.
 *      Requires Authorization header; verifies accountId matches caller's account.
 *
 *  POST { action:'save_resolution_key', accountId, key }
 *    → Saves the identity resolution API key for the account.
 *      Requires Authorization header; verifies accountId matches caller's account.
 */

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...opts.headers
  };
  return fetch(url, { ...opts, headers });
}

function uid() {
  return 'px_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function pixelIdFromRandom() {
  // 12-char alphanumeric, URL-safe
  return Array.from({ length: 12 }, () =>
    'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]
  ).join('');
}

// Lightweight JWT decode (no signature verification — we trust Supabase-issued tokens)
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch { return null; }
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Verify the caller's JWT and return their account_id from user_profiles.
 * Returns null if the token is missing, expired, or the profile is not found.
 */
async function getCallerAccountId(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const payload = decodeJwt(token);
  if (!payload || !payload.sub) return null;

  // Check token expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  // Look up the user's account_id in user_profiles
  const profileRes = await sbFetch(
    `user_profiles?id=eq.${encodeURIComponent(payload.sub)}&select=account_id&limit=1`
  );
  if (!profileRes.ok) return null;
  const profiles = await profileRes.json();
  return profiles?.[0]?.account_id || null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.method === 'GET'
    ? req.query?.action
    : (req.body?.action || req.query?.action);

  // ── HIT (pixel fire from homeowner browser — no auth required) ───────────
  if (action === 'hit' || !action) {
    const pixelId   = req.body?.pixelId || req.query?.p;
    const sessionSec = parseInt(req.body?.sessionSeconds || req.query?.s || '0', 10);
    const pageUrl   = req.body?.pageUrl || req.query?.u || '';
    const referrer  = req.body?.referrer || req.headers['referer'] || '';

    if (!pixelId) {
      // Return transparent GIF even on error so img tags don't break
      res.setHeader('Content-Type', 'image/gif');
      return res.status(200).send(TRANSPARENT_GIF);
    }

    // Look up account by pixel_id
    const acctRes = await sbFetch(`accounts?pixel_id=eq.${encodeURIComponent(pixelId)}&select=id&limit=1`);
    const accts = await acctRes.json();
    if (!accts?.length) {
      res.setHeader('Content-Type', 'image/gif');
      return res.status(200).send(TRANSPARENT_GIF);
    }
    const accountId = accts[0].id;

    // Only log if session >= 20 seconds (filters bounces)
    if (sessionSec >= 20) {
      const ip = getClientIp(req);
      const hit = {
        id: uid(),
        account_id: accountId,
        pixel_id: pixelId,
        ip,
        user_agent: (req.headers['user-agent'] || '').substring(0, 300),
        referrer: referrer.substring(0, 500),
        page_url: pageUrl.substring(0, 500),
        session_seconds: sessionSec,
        resolution_status: 'pending',
        postcard_queued: false,
        created_at: new Date().toISOString()
      };
      await sbFetch('pixel_hits', {
        method: 'POST',
        body: JSON.stringify(hit)
      });
    }

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(TRANSPARENT_GIF);
  }

  // ── All actions below require a valid JWT ─────────────────────────────────
  const callerAccountId = await getCallerAccountId(req);
  if (!callerAccountId) {
    return res.status(401).json({ error: 'Unauthorized — valid session required' });
  }

  // ── LIST hits for an account (authenticated) ─────────────────────────────
  if (action === 'list') {
    const accountId = req.query?.accountId;
    const limit  = Math.min(parseInt(req.query?.limit  || '50', 10), 200);
    const offset = parseInt(req.query?.offset || '0', 10);
    const status = req.query?.status; // optional filter: pending|resolved|dismissed

    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    // Enforce ownership — caller can only list their own account's hits
    if (accountId !== callerAccountId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let path = `pixel_hits?account_id=eq.${encodeURIComponent(accountId)}&order=created_at.desc&limit=${limit}&offset=${offset}`;
    if (status) path += `&resolution_status=eq.${encodeURIComponent(status)}`;

    const r = await sbFetch(path, {
      headers: { 'Prefer': 'count=exact' }
    });
    const data = await r.json();
    const total = parseInt(r.headers?.get?.('content-range')?.split('/')[1] || '0', 10);
    return res.status(200).json({ hits: data, total });
  }

  // ── DISMISS a hit ─────────────────────────────────────────────────────────
  if (action === 'dismiss') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    // Verify the hit belongs to the caller's account before mutating
    const hitRes = await sbFetch(`pixel_hits?id=eq.${encodeURIComponent(id)}&select=account_id&limit=1`);
    const hits = hitRes.ok ? await hitRes.json() : [];
    if (!hits.length) return res.status(404).json({ error: 'Hit not found' });
    if (hits[0].account_id !== callerAccountId) return res.status(403).json({ error: 'Forbidden' });

    await sbFetch(`pixel_hits?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_status: 'dismissed' })
    });
    return res.status(200).json({ ok: true });
  }

  // ── QUEUE POSTCARD for a hit ──────────────────────────────────────────────
  if (action === 'queue_postcard') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });

    // Verify the hit belongs to the caller's account before mutating
    const hitRes = await sbFetch(`pixel_hits?id=eq.${encodeURIComponent(id)}&select=account_id&limit=1`);
    const hits = hitRes.ok ? await hitRes.json() : [];
    if (!hits.length) return res.status(404).json({ error: 'Hit not found' });
    if (hits[0].account_id !== callerAccountId) return res.status(403).json({ error: 'Forbidden' });

    await sbFetch(`pixel_hits?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ postcard_queued: true, resolution_status: 'queued' })
    });
    return res.status(200).json({ ok: true });
  }

  // ── GENERATE pixel_id for account ────────────────────────────────────────
  if (action === 'generate_pixel_id') {
    const { accountId } = req.body || {};
    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    // Enforce ownership
    if (accountId !== callerAccountId) return res.status(403).json({ error: 'Forbidden' });

    const newPixelId = pixelIdFromRandom();
    await sbFetch(`accounts?id=eq.${encodeURIComponent(accountId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ pixel_id: newPixelId })
    });
    return res.status(200).json({ ok: true, pixelId: newPixelId });
  }

  // ── SAVE resolution API key ───────────────────────────────────────────────
  if (action === 'save_resolution_key') {
    const { accountId, key } = req.body || {};
    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    // Enforce ownership
    if (accountId !== callerAccountId) return res.status(403).json({ error: 'Forbidden' });

    await sbFetch(`accounts?id=eq.${encodeURIComponent(accountId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ pixel_resolution_key: key || null })
    });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
