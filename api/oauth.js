/**
 * BidDrop GHL OAuth 2.0 Handler — Vercel Serverless Function
 *
 * Routes:
 *   GET  /api/oauth?action=connect&accountId=xxx   → redirect to GHL OAuth consent
 *   GET  /api/oauth/callback?code=xxx&state=xxx    → exchange code for tokens, save to DB
 *   POST /api/oauth?action=refresh&accountId=xxx   → refresh expired access token
 *   POST /api/oauth?action=disconnect&accountId=xxx → remove tokens from DB
 *   GET  /api/oauth?action=status&accountId=xxx    → check connection status
 */

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const GHL_CLIENT_ID     = process.env.GHL_CLIENT_ID     || '69f796d2528efc733a30a9ab-moq4vxxq';
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET || 'dbc9f4c7-ca65-425d-800b-b43ec6a82643';
const REDIRECT_URI  = 'https://biddrop.americashomeexperts.com/api/oauth/callback';
const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const GHL_INSTALL_BASE = 'https://marketplace.leadconnectorhq.com/v2/oauth/chooselocation';

const GHL_SCOPES = [
  'contacts.readonly','contacts.write',
  'opportunities.readonly','opportunities.write',
  'conversations.readonly','conversations.write',
  'conversations/message.readonly','conversations/message.write',
  'locations.readonly','locations/customValues.readonly','locations/customValues.write',
  'locations/tags.readonly','locations/tags.write',
  'locations/customFields.readonly','locations/customFields.write'
].join(' ');

// ── CORS helper ───────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...opts.headers
  };
  return fetch(url, { ...opts, headers });
}

// ── Verify caller JWT ─────────────────────────────────────────────────────────
async function verifyCallerJwt(req) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return null;
  const user = await r.json();
  // Fetch account profile
  const pr = await sbFetch(`accounts?user_id=eq.${user.id}&select=id,role,account_id`);
  if (!pr.ok) return null;
  const rows = await pr.json();
  return rows[0] || null;
}

// ── Exchange auth code for tokens ─────────────────────────────────────────────
async function exchangeCode(code) {
  const params = new URLSearchParams({
    client_id:     GHL_CLIENT_ID,
    client_secret: GHL_CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  REDIRECT_URI
  });
  const r = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || JSON.stringify(data));
  return data;
}

// ── Refresh access token ──────────────────────────────────────────────────────
async function refreshToken(refreshTok) {
  const params = new URLSearchParams({
    client_id:     GHL_CLIENT_ID,
    client_secret: GHL_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: refreshTok
  });
  const r = await fetch(GHL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || data.error || JSON.stringify(data));
  return data;
}

// ── Save tokens to Supabase ───────────────────────────────────────────────────
async function saveTokens(accountId, tokenData) {
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString();
  const patch = {
    ghl_oauth_access_token:  tokenData.access_token,
    ghl_oauth_refresh_token: tokenData.refresh_token,
    ghl_oauth_expires_at:    expiresAt,
    ghl_oauth_location_id:   tokenData.locationId || tokenData.location_id || null,
    // Also update ghl_location_id for backward compat with existing GHL proxy code
    ...(tokenData.locationId ? { ghl_location_id: tokenData.locationId } : {}),
    ...(tokenData.location_id ? { ghl_location_id: tokenData.location_id } : {})
  };
  const r = await sbFetch(`accounts?id=eq.${accountId}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify(patch)
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error('Failed to save tokens: ' + err);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Handle OAuth callback from GHL (GET /api/oauth/callback)
  const isCallback = req.url.includes('/callback') || req.query.code;
  if (isCallback && req.method === 'GET') {
    const { code, state, error } = req.query;
    if (error) {
      return res.redirect(`/?ghl_error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }
    try {
      // Decode state to get accountId
      let accountId = null;
      try { accountId = state ? JSON.parse(Buffer.from(state, 'base64').toString()).accountId : null; } catch(e) {}

      const tokenData = await exchangeCode(code);
      console.log('[GHL OAuth] token exchange success, locationId:', tokenData.locationId);

      if (accountId) {
        await saveTokens(accountId, tokenData);
        // Redirect back to BidDrop with success
        return res.redirect(`/?ghl_connected=1&location=${encodeURIComponent(tokenData.locationId || '')}`);
      } else {
        // No accountId in state — redirect with token data as query params so frontend can save it
        return res.redirect(
          `/?ghl_connected=1` +
          `&access_token=${encodeURIComponent(tokenData.access_token)}` +
          `&refresh_token=${encodeURIComponent(tokenData.refresh_token)}` +
          `&expires_in=${tokenData.expires_in || 86400}` +
          `&location_id=${encodeURIComponent(tokenData.locationId || tokenData.location_id || '')}`
        );
      }
    } catch (e) {
      console.error('[GHL OAuth] callback error:', e.message);
      return res.redirect(`/?ghl_error=${encodeURIComponent(e.message)}`);
    }
  }

  const { action } = req.query;

  // ── action=connect — build and return the GHL OAuth URL ───────────────────
  if (action === 'connect') {
    const { accountId } = req.query;
    const state = Buffer.from(JSON.stringify({ accountId })).toString('base64');
    const url = `${GHL_INSTALL_BASE}?` + new URLSearchParams({
      response_type: 'code',
      redirect_uri:  REDIRECT_URI,
      client_id:     GHL_CLIENT_ID,
      scope:         GHL_SCOPES,
      state
    }).toString();
    // For GET requests, redirect directly
    if (req.method === 'GET') return res.redirect(url);
    // For POST requests, return the URL
    return res.json({ url });
  }

  // ── action=refresh — refresh an expired token ─────────────────────────────
  if (action === 'refresh') {
    const profile = await verifyCallerJwt(req);
    if (!profile) return res.status(401).json({ error: 'Unauthorized' });
    const accountId = req.body?.accountId || profile.account_id;
    const acctRes = await sbFetch(`accounts?id=eq.${accountId}&select=ghl_oauth_refresh_token`);
    const acctRows = await acctRes.json();
    const refreshTok = acctRows[0]?.ghl_oauth_refresh_token;
    if (!refreshTok) return res.status(400).json({ error: 'No refresh token stored' });
    try {
      const tokenData = await refreshToken(refreshTok);
      await saveTokens(accountId, tokenData);
      return res.json({ success: true, expires_in: tokenData.expires_in });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── action=disconnect — remove tokens ─────────────────────────────────────
  if (action === 'disconnect') {
    const profile = await verifyCallerJwt(req);
    if (!profile) return res.status(401).json({ error: 'Unauthorized' });
    const accountId = req.body?.accountId || profile.account_id;
    await sbFetch(`accounts?id=eq.${accountId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        ghl_oauth_access_token:  null,
        ghl_oauth_refresh_token: null,
        ghl_oauth_expires_at:    null,
        ghl_oauth_location_id:   null
      })
    });
    return res.json({ success: true });
  }

  // ── action=status — check if connected ────────────────────────────────────
  if (action === 'status') {
    const profile = await verifyCallerJwt(req);
    if (!profile) return res.status(401).json({ error: 'Unauthorized' });
    const accountId = req.query.accountId || profile.account_id;
    const acctRes = await sbFetch(`accounts?id=eq.${accountId}&select=ghl_oauth_access_token,ghl_oauth_expires_at,ghl_oauth_location_id,ghl_location_id`);
    const acctRows = await acctRes.json();
    const acct = acctRows[0];
    const connected = !!(acct?.ghl_oauth_access_token);
    const expired = connected && acct.ghl_oauth_expires_at && new Date(acct.ghl_oauth_expires_at) < new Date();
    return res.json({
      connected,
      expired,
      locationId: acct?.ghl_oauth_location_id || acct?.ghl_location_id || null,
      expiresAt: acct?.ghl_oauth_expires_at || null
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
