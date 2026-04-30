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
const SUPABASE_PAT   = process.env.SUPABASE_PAT || 'sbp_145c8823fe7d9132f688eb40484dee8670e10393';

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
  if (!token) { console.log('[auth] no token'); return null; }
  console.log('[auth] token prefix:', token.substring(0, 20), 'len:', token.length);
  console.log('[auth] SERVICE_KEY defined:', !!SERVICE_KEY, 'len:', SERVICE_KEY ? SERVICE_KEY.length : 0);
  console.log('[auth] SUPABASE_URL:', SUPABASE_URL);
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  console.log('[auth] supabase verify status:', r.status);
  if (!r.ok) {
    const body = await r.text();
    console.log('[auth] supabase verify error body:', body);
    return null;
  }
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

      // ── Update a user's auth email/password (super_admin only) ─────────────
      case 'update-user': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { userId: updateUserId, updates: userUpdates } = req.body;
        if (!updateUserId || !userUpdates) { res.status(400).json({ error: 'userId and updates required' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${updateUserId}`, {
          method: 'PUT',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(userUpdates)
        });
        if (!r.ok) { const d = await r.json(); res.status(r.status).json({ error: d.message || 'Update failed' }); return; }
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
        const { select = 'id,name,company_name,company_phone,company_addr,notes,plan,active,mailer_rate,created_at,ghl_api_key,ghl_location_id,ghl_pipeline_id' } = req.query;
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
          sbFetch('accounts?select=id,name,company_name,company_phone,company_addr,notes,plan,active,mailer_rate,created_at,enable_postcard,enable_letter,lookup_credits,free_lookups_used,free_lookups_reset,free_lookups_limit,slug,ghl_api_key,ghl_location_id,ghl_pipeline_id&order=created_at.asc'),
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
        const POSTCARD_CREDITS = 1; // 1 credit = $4.00 = 1 postcard
        const { payload } = req.body;
        if (!payload) { res.status(400).json({ error: 'payload required' }); return; }
        // Enforce credit balance — fetch free + paid totals
        const pcAcctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=id,lookup_credits,free_lookups_used,free_lookups_reset,free_lookups_limit`
        );
        if (!pcAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account credits' }); return; }
        const pcAcctRows = await pcAcctRes.json();
        if (!pcAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const pcAcct = pcAcctRows[0];
        // Monthly reset for free credits
        const pcToday = new Date().toISOString().slice(0, 10);
        if ((pcAcct.free_lookups_reset || '').slice(0, 7) !== pcToday.slice(0, 7)) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ free_lookups_used: 0, free_lookups_reset: pcToday })
          });
          pcAcct.free_lookups_used = 0;
        }
        const pcFreeLimit = pcAcct.free_lookups_limit ?? 20;
        const pcFreeLeft  = Math.max(0, pcFreeLimit - (pcAcct.free_lookups_used || 0));
        const pcPaid      = pcAcct.lookup_credits || 0;
        const pcTotal     = pcFreeLeft + pcPaid;
        if (pcTotal < POSTCARD_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending a postcard costs ${POSTCARD_CREDITS} credit ($4.00). You have ${pcTotal} credits (${pcFreeLeft} free + ${pcPaid} paid). Please purchase more credits to continue.`,
            credits_needed: POSTCARD_CREDITS,
            credits_available: pcTotal
          });
          return;
        }
        // Deduct credits BEFORE sending — use free first, then paid
        const pcFreeToUse = Math.min(pcFreeLeft, POSTCARD_CREDITS);
        const pcPaidToUse = POSTCARD_CREDITS - pcFreeToUse;
        const pcUpdates = {};
        if (pcFreeToUse > 0) pcUpdates.free_lookups_used = (pcAcct.free_lookups_used || 0) + pcFreeToUse;
        if (pcPaidToUse > 0) pcUpdates.lookup_credits = pcPaid - pcPaidToUse;
        await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(pcUpdates)
        });
        // Send the postcard
        const lobRes = await fetch('https://api.lob.com/v1/postcards', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const lobData = await lobRes.json();
        // If Lob failed, refund the credits
        if (!lobRes.ok) {
          const pcRefund = {};
          if (pcFreeToUse > 0) pcRefund.free_lookups_used = pcAcct.free_lookups_used || 0;
          if (pcPaidToUse > 0) pcRefund.lookup_credits = pcPaid;
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify(pcRefund)
          });
        }
        const pcNewPaid     = lobRes.ok ? pcPaid - pcPaidToUse : pcPaid;
        const pcNewFreeUsed = lobRes.ok ? (pcAcct.free_lookups_used || 0) + pcFreeToUse : (pcAcct.free_lookups_used || 0);
        if (lobRes.ok) {
          res.status(200).json({
            ...lobData,
            _credits: { paid_credits: pcNewPaid, free_used: pcNewFreeUsed, free_limit: pcFreeLimit }
          });
        } else {
          res.status(200).json({
            error: lobData.error || lobData,
            _lobStatus: lobRes.status,
            _credits: { paid_credits: pcPaid, free_used: pcAcct.free_lookups_used || 0, free_limit: pcFreeLimit }
          });
        }
        break;
      }

      // ── Lob letter proxy ──────────────────────────────────────────────────
      case 'lob-letter': {
        const LETTER_CREDITS = 1; // 1 credit = $4.00 = 1 letter
        const { payload: ltPayload } = req.body;
        if (!ltPayload) { res.status(400).json({ error: 'payload required' }); return; }
        // Enforce credit balance — fetch free + paid totals
        const ltAcctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=id,lookup_credits,free_lookups_used,free_lookups_reset,free_lookups_limit`
        );
        if (!ltAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account credits' }); return; }
        const ltAcctRows = await ltAcctRes.json();
        if (!ltAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const ltAcct = ltAcctRows[0];
        // Monthly reset for free credits
        const ltToday = new Date().toISOString().slice(0, 10);
        if ((ltAcct.free_lookups_reset || '').slice(0, 7) !== ltToday.slice(0, 7)) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ free_lookups_used: 0, free_lookups_reset: ltToday })
          });
          ltAcct.free_lookups_used = 0;
        }
        const ltFreeLimit = ltAcct.free_lookups_limit ?? 20;
        const ltFreeLeft  = Math.max(0, ltFreeLimit - (ltAcct.free_lookups_used || 0));
        const ltPaid      = ltAcct.lookup_credits || 0;
        const ltTotal     = ltFreeLeft + ltPaid;
        if (ltTotal < LETTER_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending a letter costs ${LETTER_CREDITS} credit ($4.00). You have ${ltTotal} credits (${ltFreeLeft} free + ${ltPaid} paid). Please purchase more credits to continue.`,
            credits_needed: LETTER_CREDITS,
            credits_available: ltTotal
          });
          return;
        }
        // Deduct credits BEFORE sending — use free first, then paid
        const ltFreeToUse = Math.min(ltFreeLeft, LETTER_CREDITS);
        const ltPaidToUse = LETTER_CREDITS - ltFreeToUse;
        const ltUpdates = {};
        if (ltFreeToUse > 0) ltUpdates.free_lookups_used = (ltAcct.free_lookups_used || 0) + ltFreeToUse;
        if (ltPaidToUse > 0) ltUpdates.lookup_credits = ltPaid - ltPaidToUse;
        await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(ltUpdates)
        });
        // Send the letter
        const ltLobRes = await fetch('https://api.lob.com/v1/letters', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(ltPayload)
        });
        const ltLobData = await ltLobRes.json();
        // If Lob failed, refund the credits
        if (!ltLobRes.ok) {
          const ltRefund = {};
          if (ltFreeToUse > 0) ltRefund.free_lookups_used = ltAcct.free_lookups_used || 0;
          if (ltPaidToUse > 0) ltRefund.lookup_credits = ltPaid;
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify(ltRefund)
          });
        }
        const ltNewPaid     = ltLobRes.ok ? ltPaid - ltPaidToUse : ltPaid;
        const ltNewFreeUsed = ltLobRes.ok ? (ltAcct.free_lookups_used || 0) + ltFreeToUse : (ltAcct.free_lookups_used || 0);
        if (ltLobRes.ok) {
          res.status(200).json({
            ...ltLobData,
            _credits: { paid_credits: ltNewPaid, free_used: ltNewFreeUsed, free_limit: ltFreeLimit }
          });
        } else {
          res.status(200).json({
            error: ltLobData.error || ltLobData,
            _lobStatus: ltLobRes.status,
            _credits: { paid_credits: ltPaid, free_used: ltAcct.free_lookups_used || 0, free_limit: ltFreeLimit }
          });
        }
        break;
      }

      // ── RentCast proxy (with credit enforcement) ─────────────────────────
      case 'rentcast': {
        const { address } = req.query;
        if (!address) { res.status(400).json({ error: 'address required' }); return; }

        // Fetch the account's current credit state (including per-account free limit)
        const acctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=id,lookup_credits,free_lookups_used,free_lookups_reset,free_lookups_limit`
        );
        if (!acctRes.ok) { res.status(500).json({ error: 'Failed to fetch account credits' }); return; }
        const acctRows = await acctRes.json();
        if (!acctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        let acct = acctRows[0];
        const FREE_LOOKUPS_PER_MONTH = acct.free_lookups_limit ?? 20;

        // Check if free lookup counter needs monthly reset
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const resetDate = acct.free_lookups_reset;
        const resetMonth = resetDate ? resetDate.slice(0, 7) : '';
        const thisMonth  = today.slice(0, 7);
        if (resetMonth !== thisMonth) {
          // Reset free lookups for the new month
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ free_lookups_used: 0, free_lookups_reset: today })
          });
          acct.free_lookups_used = 0;
        }

        // Determine credit type to use
        let creditType = null;
        if (acct.free_lookups_used < FREE_LOOKUPS_PER_MONTH) {
          creditType = 'free';
        } else if (acct.lookup_credits > 0) {
          creditType = 'paid';
        } else {
          // No credits available
          res.status(402).json({
            error: 'no_credits',
            message: `You have used all ${FREE_LOOKUPS_PER_MONTH} free lookups this month. Purchase credits to continue.`,
            free_used: acct.free_lookups_used,
            paid_credits: acct.lookup_credits
          });
          return;
        }

        // Call RentCast
        const rcRes = await fetch(
          `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`,
          { headers: { 'X-Api-Key': RENTCAST_KEY } }
        );
        const rcData = await rcRes.json();

        // Only deduct credits on a successful lookup (200 with data)
        if (rcRes.status === 200 && Array.isArray(rcData) && rcData.length > 0) {
          if (creditType === 'free') {
            await sbFetch(`accounts?id=eq.${profile.account_id}`, {
              method: 'PATCH',
              body: JSON.stringify({ free_lookups_used: acct.free_lookups_used + 1 })
            });
          } else {
            await sbFetch(`accounts?id=eq.${profile.account_id}`, {
              method: 'PATCH',
              body: JSON.stringify({ lookup_credits: acct.lookup_credits - 1 })
            });
          }
          // Log the lookup
          await sbFetch('lookup_log', {
            method: 'POST',
            body: JSON.stringify({
              account_id: profile.account_id,
              user_id:    caller.id,
              address,
              credit_type: creditType
            })
          });
        }

        // Return data with credit state so the UI can update
        const newFreeUsed    = creditType === 'free' ? acct.free_lookups_used + 1 : acct.free_lookups_used;
        const newPaidCredits = creditType === 'paid' ? acct.lookup_credits - 1   : acct.lookup_credits;
        res.status(rcRes.status).json({
          ...( Array.isArray(rcData) ? { properties: rcData } : rcData ),
          _credits: {
            free_used:    newFreeUsed,
            free_limit:   FREE_LOOKUPS_PER_MONTH,
            paid_credits: newPaidCredits
          }
        });
        break;
      }

      case 'upload-photo': {
        // Upload a photo to Supabase Storage using service key (bypasses RLS)
        // Accepts: { path: string, dataUrl: string, mimeType: string }
        const { path: uploadPath, dataUrl, mimeType: uploadMime } = req.body;
        if (!uploadPath || !dataUrl) { res.status(400).json({ error: 'path and dataUrl required' }); return; }
        // Convert base64 data URL to buffer
        const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const contentType = uploadMime || 'image/jpeg';
        // Upload to Supabase Storage using service key
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/pin-photos/${uploadPath}`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': contentType,
            'x-upsert': 'true'
          },
          body: buffer
        });
        if (!uploadRes.ok) {
          const errBody = await uploadRes.text();
          return res.status(uploadRes.status).json({ error: errBody });
        }
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/pin-photos/${uploadPath}`;
        return res.json({ url: publicUrl });
      }

      case 'create-bucket': {
        // Create the pin-photos storage bucket with public read + authenticated write
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'super_admin only' });
        }
        // Create bucket
        const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: 'pin-photos',
            name: 'pin-photos',
            public: true,
            file_size_limit: 10485760, // 10MB
            allowed_mime_types: ['image/jpeg','image/png','image/webp','image/gif']
          })
        });
        const bucketBody = await bucketRes.json();
        return res.json({ bucket_status: bucketRes.status, bucket: bucketBody });
      }

      case 'fix-storage-policy': {
        // Fix RLS policies on pin-photos bucket to allow authenticated uploads
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'super_admin only' });
        }
        // Use Supabase Management API to add storage policies
        const policyResults = [];
        const policies = [
          { name: 'Allow authenticated uploads', definition: `(bucket_id = 'pin-photos' AND auth.role() = 'authenticated')`, operation: 'INSERT' },
          { name: 'Allow authenticated updates', definition: `(bucket_id = 'pin-photos' AND auth.role() = 'authenticated')`, operation: 'UPDATE' },
          { name: 'Allow public reads', definition: `(bucket_id = 'pin-photos')`, operation: 'SELECT' },
          { name: 'Allow authenticated deletes', definition: `(bucket_id = 'pin-photos' AND auth.role() = 'authenticated')`, operation: 'DELETE' }
        ];
        for (const policy of policies) {
          const pr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `CREATE POLICY IF NOT EXISTS "${policy.name}" ON storage.objects FOR ${policy.operation} USING ${policy.operation === 'INSERT' ? 'true' : `(${policy.definition})`} WITH CHECK (${policy.definition})` })
          });
          const prBody = await pr.text();
          policyResults.push({ policy: policy.name, status: pr.status, body: prBody.substring(0, 200) });
        }
        return res.json({ policyResults });
      }

      case 'print-unlock': {
        // Charge 1 credit to unlock printing for an estimate (pay-once per estimate)
        const { estId: puEstId } = req.body;
        if (!puEstId) { res.status(400).json({ error: 'estId required' }); return; }
        // Check if already unlocked
        const puEstRes = await sbFetch(`estimates?id=eq.${puEstId}&select=id,account_id,print_paid`);
        if (!puEstRes.ok) { res.status(500).json({ error: 'Failed to fetch estimate' }); return; }
        const puEsts = await puEstRes.json();
        if (!puEsts.length) { res.status(404).json({ error: 'Estimate not found' }); return; }
        const puEst = puEsts[0];
        // Verify ownership
        if (puEst.account_id !== profile.account_id && !isSuperAdmin) {
          res.status(403).json({ error: 'Not your estimate' }); return;
        }
        // Already paid — allow free reprint
        if (puEst.print_paid) {
          res.status(200).json({ already_paid: true });
          return;
        }
        // Deduct 1 credit — use free first, then paid
        const PRINT_CREDITS = 1;
        const puAcctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=id,lookup_credits,free_lookups_used,free_lookups_reset,free_lookups_limit`
        );
        if (!puAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account' }); return; }
        const puAcctRows = await puAcctRes.json();
        if (!puAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const puAcct = puAcctRows[0];
        // Monthly reset
        const puToday = new Date().toISOString().slice(0, 10);
        if ((puAcct.free_lookups_reset || '').slice(0, 7) !== puToday.slice(0, 7)) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ free_lookups_used: 0, free_lookups_reset: puToday })
          });
          puAcct.free_lookups_used = 0;
        }
        const puFreeLimit = puAcct.free_lookups_limit ?? 20;
        const puFreeLeft  = Math.max(0, puFreeLimit - (puAcct.free_lookups_used || 0));
        const puPaid      = puAcct.lookup_credits || 0;
        const puTotal     = puFreeLeft + puPaid;
        if (puTotal < PRINT_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: 'Printing a quote costs 1 credit. You have no credits remaining.',
            credits_needed: PRINT_CREDITS,
            credits_available: puTotal
          });
          return;
        }
        // Deduct
        const puFreeToUse = Math.min(puFreeLeft, PRINT_CREDITS);
        const puPaidToUse = PRINT_CREDITS - puFreeToUse;
        const puUpdates = {};
        if (puFreeToUse > 0) puUpdates.free_lookups_used = (puAcct.free_lookups_used || 0) + puFreeToUse;
        if (puPaidToUse > 0) puUpdates.lookup_credits = puPaid - puPaidToUse;
        await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(puUpdates)
        });
        // Mark estimate as print_paid
        await sbFetch(`estimates?id=eq.${puEstId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ print_paid: true })
        });
        const puNewPaid     = puPaid - puPaidToUse;
        const puNewFreeUsed = (puAcct.free_lookups_used || 0) + puFreeToUse;
        res.status(200).json({
          success: true,
          _credits: { paid_credits: puNewPaid, free_used: puNewFreeUsed, free_limit: puFreeLimit }
        });
        break;
      }
      case 'run-migration': {
        // One-time migration: add missing columns and performance indexes
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'super_admin only' });
        }
        // Extract the Supabase project ref from the URL
        // e.g. https://gtwbhxnrmfmdenogzuea.supabase.co  ->  gtwbhxnrmfmdenogzuea
        const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
        // Run all DDL as a single batched query for efficiency
        const batchSql = [
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS photo_url TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS photo_data TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS pin_id TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS logo_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS headshot_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS review1_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS review2_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS headshot_pos REAL`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hook TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_why TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_quote TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_guarantee TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip2_headline TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip2_subtext TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip3_headline TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip3_subtext TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip4_headline TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip4_subtext TEXT`,
          `CREATE INDEX IF NOT EXISTS idx_pins_account_created ON pins(account_id, created_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_pins_account_latlon  ON pins(account_id, lat, lng)`,
          `CREATE INDEX IF NOT EXISTS idx_queue_account_created ON queue(account_id, created_at DESC)`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slug TEXT`,
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug) WHERE slug IS NOT NULL`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS source TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_first_viewed_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_last_viewed_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_time_spent INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_mat_clicks JSONB`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_share_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_call_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS rep_video_url TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_enabled BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS estimate_page_expires_days INTEGER`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS estimate_page_countdown BOOLEAN DEFAULT FALSE`,
          `CREATE INDEX IF NOT EXISTS idx_estimates_account_saved ON estimates(account_id, saved_at DESC)`,
          `ALTER TABLE pins ADD COLUMN IF NOT EXISTS source TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mailer_credits INTEGER DEFAULT 0`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS free_mailer_credits_used INTEGER DEFAULT 0`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS free_mailer_credits_reset DATE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS print_paid BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qr_scan_count INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qr_first_scanned_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qr_last_scanned_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS email TEXT`,
          `CREATE TABLE IF NOT EXISTS scan_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), estimate_id TEXT NOT NULL, account_id TEXT, scanned_at TIMESTAMPTZ DEFAULT NOW(), source TEXT DEFAULT 'qr', user_agent TEXT, referrer TEXT)`,
          `CREATE INDEX IF NOT EXISTS idx_scan_events_estimate ON scan_events(estimate_id, scanned_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_scan_events_account ON scan_events(account_id, scanned_at DESC)`,
          `CREATE TABLE IF NOT EXISTS postcard_scans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), queue_item_id TEXT, account_id TEXT, owner_name TEXT, address TEXT, estimate_id TEXT, scanned_at TIMESTAMPTZ DEFAULT NOW(), ip TEXT, user_agent TEXT)`,
          `CREATE INDEX IF NOT EXISTS idx_postcard_scans_account ON postcard_scans(account_id, scanned_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_postcard_scans_estimate ON postcard_scans(estimate_id, scanned_at DESC)`
        ].join('; ');
        const results = [];
        // Run each DDL statement individually via Supabase pg_meta API (uses SERVICE_KEY)
        const statements = batchSql.split('; ');
        for (const stmt of statements) {
          if (!stmt.trim()) continue;
          try {
            const r = await fetch(
              `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
              {
                method: 'POST',
                headers: {
                  'apikey': SERVICE_KEY,
                  'Authorization': `Bearer ${SERVICE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql: stmt })
              }
            );
            const body = await r.text();
            results.push({ sql: stmt.substring(0, 80), status: r.status, ok: r.ok });
          } catch (sqlErr) {
            results.push({ sql: stmt.substring(0, 80), status: 0, ok: false, body: sqlErr.message });
          }
        }
        return res.json({ results });
      }

      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[BidDrop API]', err);
    res.status(500).json({ error: err.message });
  }
}
