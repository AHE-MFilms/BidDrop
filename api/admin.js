/**
 * BidDrop Secure API — Vercel Serverless Function
 *
 * All operations that require privileged keys (Supabase service role,
 * GHL API token, Lob, RentCast) are handled here server-side.
 * The frontend NEVER sees these keys.
 *
 * Auth model:
 *  - Every request must carry the caller's Supabase JWT in Authorization header.
 *  - Super-admin-only actions additionally verify the caller's role from the DB.
 *  - GHL calls use the account's own token stored in the DB (never a global env var).
 */

const SUPABASE_URL   = process.env.SUPABASE_URL    || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const LOB_KEY        = process.env.LOB_API_KEY;
const RENTCAST_KEY   = process.env.RENTCAST_API_KEY;
const AGENCY_ACCT_ID = process.env.AGENCY_ACCOUNT_ID;

// ── CORS helper ───────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
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

// ── Verify caller JWT and return user object ──────────────────────────────────
async function verifyCallerJwt(req) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return await r.json(); // { id, email, ... }
}

// ── Get caller's profile (role, account_id) from DB ──────────────────────────
async function getCallerProfile(userId) {
  const r = await sbFetch(`user_profiles?id=eq.${userId}&select=id,role,account_id`);
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action } = req.query;

  // Every request must be authenticated
  const caller = await verifyCallerJwt(req);
  if (!caller) { res.status(401).json({ error: 'Unauthorized' }); return; }

  // Fetch caller profile for role-gated actions
  const profile = await getCallerProfile(caller.id);
  if (!profile) { res.status(403).json({ error: 'No profile found' }); return; }

  const isSuperAdmin = profile.role === 'super_admin';
  const isAdmin      = profile.role === 'admin' || isSuperAdmin;

  try {
    switch (action) {

      // ── Create Supabase auth user (super_admin or admin) ──────────────────
      case 'create-user': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { email, password, name } = req.body;
        if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } })
        });
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'Create user failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Reset a user's password (super_admin only) ────────────────────────
      case 'reset-password': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { userId, password } = req.body;
        if (!userId || !password) { res.status(400).json({ error: 'userId and password required' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, email_confirm: true })
        });
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'Reset failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Delete a Supabase auth user (super_admin only) ────────────────────
      case 'delete-user': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { userId } = req.body;
        if (!userId) { res.status(400).json({ error: 'userId required' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        if (!r.ok) { const d = await r.json(); res.status(r.status).json({ error: d.message || 'Delete failed' }); return; }
        res.status(200).json({ success: true });
        break;
      }

      // ── List all auth users (super_admin only) ────────────────────────────
      case 'list-users': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'List failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Patch an account row (super_admin, or admin patching their own account) ─
      case 'patch-account': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { accountId, updates } = req.body;
        if (!accountId || !updates) { res.status(400).json({ error: 'accountId and updates required' }); return; }
        // Non-super-admins can only patch their own account
        if (!isSuperAdmin && profile.account_id !== accountId) {
          res.status(403).json({ error: 'Cannot modify another account' }); return;
        }
        const r = await sbFetch(`accounts?id=eq.${accountId}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(updates)
        });
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'Patch failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Fetch all accounts (super_admin only) ─────────────────────────────
      case 'list-accounts': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { select = 'id,name,company_name,plan,active,mailer_rate,created_at' } = req.query;
        const r = await sbFetch(`accounts?select=${select}&order=created_at.asc`);
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'List accounts failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Agency view bulk fetch (super_admin only) ─────────────────────────
      case 'agency-data': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const [acctRes, profRes, pinsRes, logRes] = await Promise.all([
          sbFetch('accounts?select=id,name,company_name,plan,active,mailer_rate,created_at&order=created_at.asc'),
          sbFetch('user_profiles?select=id,account_id,name,email,role'),
          sbFetch('pins?select=id,account_id,status,created_at,rep_name'),
          sbFetch('mailer_log?select=*&order=sent_at.desc&limit=500')
        ]);
        const [accounts, profiles, pins, mailerLog] = await Promise.all([
          acctRes.json(), profRes.json(), pinsRes.json(), logRes.json()
        ]);
        res.status(200).json({ accounts, profiles, pins, mailerLog });
        break;
      }

      // ── Confirm master keys exist (returns booleans only, never the keys) ──
      case 'get-master-keys': {
        res.status(200).json({
          hasLobKey: !!LOB_KEY,
          hasRentcastKey: !!RENTCAST_KEY
        });
        break;
      }

      // ── GHL proxy — uses the account's own token from the DB ─────────────
      case 'ghl': {
        const { path, method: ghlMethod = 'GET', body: ghlBody, accountId: ghlAcctId } = req.body;
        if (!path) { res.status(400).json({ error: 'path required' }); return; }

        // Resolve which account to use
        const acctId = ghlAcctId || profile.account_id;
        if (!acctId) { res.status(400).json({ error: 'accountId required' }); return; }

        // Fetch the account's GHL API key from DB
        const acctRes = await sbFetch(`accounts?id=eq.${acctId}&select=ghl_api_key`);
        const acctRows = await acctRes.json();
        const ghlToken = acctRows[0]?.ghl_api_key;
        if (!ghlToken) { res.status(400).json({ error: 'No GHL API key configured for this account' }); return; }

        const ghlRes = await fetch(`https://services.leadconnectorhq.com${path}`, {
          method: ghlMethod,
          headers: {
            'Authorization': `Bearer ${ghlToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          },
          ...(ghlBody ? { body: JSON.stringify(ghlBody) } : {})
        });
        const ghlData = await ghlRes.json();
        res.status(ghlRes.status).json(ghlData);
        break;
      }

      // ── Lob postcard proxy ────────────────────────────────────────────────
      case 'lob-postcard': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { payload } = req.body;
        if (!payload) { res.status(400).json({ error: 'payload required' }); return; }
        const lobRes = await fetch('https://api.lob.com/v1/postcards', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const lobData = await lobRes.json();
        res.status(lobRes.status).json(lobData);
        break;
      }

      // ── Lob letter proxy ──────────────────────────────────────────────────
      case 'lob-letter': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { payload } = req.body;
        if (!payload) { res.status(400).json({ error: 'payload required' }); return; }
        const lobRes = await fetch('https://api.lob.com/v1/letters', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const lobData = await lobRes.json();
        res.status(lobRes.status).json(lobData);
        break;
      }

      // ── RentCast proxy ────────────────────────────────────────────────────
      case 'rentcast': {
        const { address } = req.query;
        if (!address) { res.status(400).json({ error: 'address required' }); return; }
        const rcRes = await fetch(
          `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`,
          { headers: { 'X-Api-Key': RENTCAST_KEY } }
        );
        const rcData = await rcRes.json();
        res.status(rcRes.status).json(rcData);
        break;
      }

      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[BidDrop API]', err);
    res.status(500).json({ error: err.message });
  }
}
