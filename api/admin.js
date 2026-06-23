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
const RENTCAST_KEY   = process.env.RENTCAST_API_KEY; // updated key
const AGENCY_ACCT_ID = process.env.AGENCY_ACCOUNT_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_PAT   = process.env.SUPABASE_PAT;
const TRACERFY_KEY   = process.env.TRACERFY_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjozMjUwNTk2MTEzLCJpYXQiOjE3ODE3OTYxMTMsImp0aSI6ImFhYmIyYjc1OWE2MzQ3NjViNDVhZWFjMTA3ZmFhYzI3IiwidXNlcl9pZCI6ODI2OH0.ymqyjLor60uQpotAKibSzV5XMYeOG_CsmkGzGMDARLo';

/// ── In-memory rate limiter (per account_id, resets each serverless instance) ──
// Limits: max 3 Lob sends per 5 seconds per account, max 2 RentCast calls per 3s
const _rateBuckets = new Map();
function _checkRate(key, maxCalls, windowMs) {
  const now = Date.now();
  let bucket = _rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { windowStart: now, count: 0 };
    _rateBuckets.set(key, bucket);
  }
  bucket.count++;
  return bucket.count <= maxCalls;
}

// ── Idempotency store — prevents double-sends on rapid retaps ─────────────────
// Key: `${account_id}:${idempotency_key}`, TTL: 30 seconds
const _idemStore = new Map();
function _checkIdem(key) {
  const now = Date.now();
  // Purge expired entries
  for (const [k, ts] of _idemStore) { if (now - ts > 30000) _idemStore.delete(k); }
  if (_idemStore.has(key)) return false; // duplicate
  _idemStore.set(key, now);
  return true; // first time
}

// ── CORS helper ─────────────────────────────────────────────────────────────
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
module.exports = async function handler(req, res) {
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

      // ── Invite a rep (admin or super_admin) — creates auth user + profile + sends email ──
      case 'invite-rep': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { email: invEmail, name: invName, role: invRole } = req.body;
        if (!invEmail || !invName) { res.status(400).json({ error: 'email and name required' }); return; }
        const repRole = ['rep', 'admin'].includes(invRole) ? invRole : 'rep';
        // Check plan rep limit
        const PLAN_MAX_REPS_INV = { starter: 1, pro: 3, agency: 10, enterprise: 999 };
        const acctRespInv = await sbFetch(`accounts?id=eq.${profile.account_id}&select=plan,company_name`);
        const acctsInv = acctRespInv.ok ? await acctRespInv.json() : [];
        const acctInv = acctsInv[0] || {};
        const maxRepsInv = PLAN_MAX_REPS_INV[acctInv.plan] ?? 1;
        if (maxRepsInv !== 999) {
          const repCountResp = await sbFetch(`user_profiles?account_id=eq.${profile.account_id}&select=id`);
          const repRows = repCountResp.ok ? await repCountResp.json() : [];
          if (repRows.length >= maxRepsInv) {
            res.status(403).json({ error: `Your ${acctInv.plan || 'current'} plan allows up to ${maxRepsInv} team member(s). Upgrade to add more reps.` }); return;
          }
        }
        // Generate temp password
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let tempPw = '';
        for (let i = 0; i < 8; i++) tempPw += chars[Math.floor(Math.random() * chars.length)];
        // Create Supabase auth user
        const authRespInv = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: invEmail, password: tempPw, email_confirm: true, user_metadata: { name: invName } })
        });
        const authDataInv = await authRespInv.json();
        if (!authRespInv.ok) { res.status(authRespInv.status).json({ error: authDataInv.message || 'Failed to create user' }); return; }
        const newUserId = authDataInv.id;
        // Create user_profiles row
        await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ id: newUserId, account_id: profile.account_id, role: repRole, name: invName, email: invEmail, must_change_password: true })
        }).catch(e => console.error('[invite-rep] profile insert error:', e));
        // Send invite email via Resend
        const invLoginUrl = (process.env.APP_URL || 'https://biddrop.americashomeexperts.com').trim();
        const invEmailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;color:#111"><div style="background:#111;padding:28px 32px;border-radius:10px 10px 0 0"><span style="font-size:26px;font-weight:900;color:#fff">Bid<span style="color:#F97316">Drop</span></span></div><div style="padding:36px 32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px"><h1 style="font-size:24px;font-weight:800;margin:0 0 12px">You've been added to ${acctInv.company_name || 'BidDrop'} &#127881;</h1><p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">You've been invited to join the BidDrop team for <strong>${acctInv.company_name || 'your company'}</strong> as a <strong>${repRole === 'admin' ? 'Team Admin' : 'Field Rep'}</strong>.</p><div style="background:#f8f8f8;border:1px solid #e0e0e0;border-left:4px solid #F97316;border-radius:8px;padding:24px;margin-bottom:24px"><p style="font-size:12px;color:#666;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Your Login Credentials</p><p style="margin:0 0 10px;font-size:15px"><strong>Email:</strong> ${invEmail}</p><p style="margin:0 0 10px;font-size:15px"><strong>Temp Password:</strong> <span style="color:#F97316;font-size:20px;font-weight:800;letter-spacing:1px">${tempPw}</span></p><p style="font-size:13px;color:#666;margin:12px 0 0">You'll be prompted to change your password after logging in.</p></div><a href="${invLoginUrl}" style="display:block;background:#F97316;color:#fff;text-decoration:none;text-align:center;padding:16px 24px;border-radius:8px;font-size:17px;font-weight:800;margin-bottom:24px">Log In to BidDrop &#8594;</a><p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0">For help, contact <a href="mailto:support@biddrop.io" style="color:#F97316">support@biddrop.io</a></p></div></div>`;
        const resendKeyInv = process.env.RESEND_API_KEY;
        if (resendKeyInv) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKeyInv}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'BidDrop <noreply@biddrop.io>', to: [invEmail], subject: `You've been added to ${acctInv.company_name || 'BidDrop'} on BidDrop`, html: invEmailHtml })
          }).catch(e => console.error('[invite-rep] email send error:', e));
        }
        res.status(200).json({ success: true, userId: newUserId, tempPassword: tempPw });
        break;
      }

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

      // ── Cancel a Stripe subscription (super_admin only) ─────────────────────
      case 'cancel-stripe-subscription': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { accountId: cancelAcctId } = req.body;
        if (!cancelAcctId) { res.status(400).json({ error: 'accountId required' }); return; }
        // Fetch the stripe_subscription_id from the account
        const acctRes = await sbFetch(`accounts?id=eq.${cancelAcctId}&select=stripe_subscription_id,stripe_customer_id,company_name`);
        if (!acctRes.ok) { res.status(500).json({ error: 'Failed to fetch account' }); return; }
        const accts = await acctRes.json();
        if (!accts.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const acct = accts[0];
        const subId = acct.stripe_subscription_id;
        if (!subId) {
          // No subscription to cancel — just return success
          res.status(200).json({ success: true, message: 'No Stripe subscription found — nothing to cancel.' });
          return;
        }
        // Cancel the subscription immediately via Stripe API
        const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(STRIPE_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        const stripeData = await stripeRes.json();
        if (!stripeRes.ok) {
          console.error('[cancel-stripe-subscription] Stripe error:', stripeData);
          res.status(stripeRes.status).json({ error: stripeData.error?.message || 'Stripe cancellation failed' });
          return;
        }
        console.log(`[cancel-stripe-subscription] Cancelled sub ${subId} for ${acct.company_name}`);
        res.status(200).json({ success: true, subscription_id: subId, status: stripeData.status });
        break;
      }

      // ── Delete a Supabase auth user (super_admin only) ────────────────────
      // Option A: reassign all data to account owner, preserve rep_name for tracking
      case 'delete-user': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { userId } = req.body;
        if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

        // 1. Look up the profile of the user being deleted to get their account_id and name
        const profResp = await sbFetch(`user_profiles?id=eq.${userId}&select=id,account_id,name,email`);
        const profData = await profResp.json();
        if (!profResp.ok || !profData.length) {
          res.status(404).json({ error: 'User profile not found' }); return;
        }
        const delProfile = profData[0];
        const accountId = delProfile.account_id;
        const repName = delProfile.name || delProfile.email || 'Former Rep';

        // 2. Find the account owner (the admin user for this account)
        const ownerResp = await sbFetch(`user_profiles?account_id=eq.${accountId}&role=eq.admin&select=id&limit=1`);
        const ownerData = await ownerResp.json();
        const ownerId = ownerData?.[0]?.id || null;

        if (ownerId && ownerId !== userId) {
          // 3a. Reassign pins: update created_by to owner, preserve rep_name snapshot
          await sbFetch(`pins?created_by=eq.${userId}&account_id=eq.${accountId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ created_by: ownerId, rep_name: repName })
          }).catch(e => console.warn('[delete-user] pins reassign failed:', e.message));

          // 3b. Reassign estimates by account_id + rep field match (rep is a text snapshot, no FK)
          // Note: estimates table does not have a created_by FK — rep name is already stored as text snapshot
          // No reassignment needed; rep name is preserved as-is on each estimate record

          // 3c. Reassign queue items: update created_by to owner, preserve rep_name snapshot
          await sbFetch(`queue?created_by=eq.${userId}&account_id=eq.${accountId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ created_by: ownerId })
          }).catch(e => console.warn('[delete-user] queue reassign failed (non-fatal):', e.message));
        }

        // 3d. Soft-delete the profile row (keep for historical rep name lookups)
        // Always attempt this regardless of whether ownerId was found
        await sbFetch(`user_profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ role: 'deleted' })
        }).catch(e => console.warn('[delete-user] profile soft-delete failed (non-fatal):', e.message));

        // 4. Delete the Supabase Auth user (revokes login)
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        if (!r.ok) { const d = await r.json(); res.status(r.status).json({ error: d.message || 'Delete failed' }); return; }

        res.status(200).json({
          success: true,
          reassigned: !!ownerId,
          repName,
          message: ownerId
            ? `Deleted ${repName}. All their pins, estimates, and mailers have been reassigned to the account owner. Rep name is preserved on each record for tracking.`
            : `Deleted ${repName}. No account owner found to reassign data to.`
        });
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
          sbFetch('accounts?select=id,name,company_name,company_phone,company_addr,notes,plan,active,mailer_rate,mailer_credits,created_at,enable_postcard,enable_letter,lookup_credits,free_lookups_used,free_lookups_reset,free_lookups_limit,slug,ghl_api_key,ghl_location_id,ghl_pipeline_id,enabled_trades,tracerfy_enabled&order=created_at.asc'),
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
      case 'ghl-oauth-status': {
        // Return OAuth connection status for the caller's account
        const oauthAcctRes = await sbFetch(`accounts?id=eq.${profile.account_id}&select=ghl_oauth_access_token,ghl_oauth_expires_at,ghl_oauth_location_id,ghl_location_id`);
        const oauthAcctRows = await oauthAcctRes.json();
        const oauthAcct = oauthAcctRows[0];
        const connected = !!(oauthAcct?.ghl_oauth_access_token);
        const expired = connected && oauthAcct.ghl_oauth_expires_at && new Date(oauthAcct.ghl_oauth_expires_at) < new Date();
        res.json({
          connected,
          expired,
          locationId: oauthAcct?.ghl_oauth_location_id || oauthAcct?.ghl_location_id || null,
          expiresAt: oauthAcct?.ghl_oauth_expires_at || null
        });
        break;
      }
      case 'ghl-oauth-save': {
        // Save OAuth tokens returned from the callback (when no accountId was in state)
        const { access_token, refresh_token, expires_in, location_id } = req.body;
        if (!access_token) { res.status(400).json({ error: 'access_token required' }); return; }
        const expiresAt = new Date(Date.now() + (parseInt(expires_in) || 86400) * 1000).toISOString();
        const saveRes = await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            ghl_oauth_access_token:  access_token,
            ghl_oauth_refresh_token: refresh_token || null,
            ghl_oauth_expires_at:    expiresAt,
            ghl_oauth_location_id:   location_id || null,
            ...(location_id ? { ghl_location_id: location_id } : {})
          })
        });
        if (!saveRes.ok) { const e = await saveRes.text(); res.status(500).json({ error: e }); return; }
        res.json({ success: true });
        break;
      }
      case 'ghl-oauth-disconnect': {
        // Remove OAuth tokens from the account
        await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            ghl_oauth_access_token:  null,
            ghl_oauth_refresh_token: null,
            ghl_oauth_expires_at:    null,
            ghl_oauth_location_id:   null
          })
        });
        res.json({ success: true });
        break;
      }
      case 'ghl': {
        const { path, method: ghlMethod = 'GET', body: ghlBody, accountId: ghlAcctId } = req.body;
        if (!path) { res.status(400).json({ error: 'path required' }); return; }
        // Safety guard: BidDrop must never delete anything in GHL
        if (ghlMethod && ghlMethod.toUpperCase() === 'DELETE') {
          res.status(403).json({ error: 'DELETE operations are not permitted via the BidDrop GHL proxy.' });
          return;
        }

        // Resolve which account to use
        const acctId = ghlAcctId || profile.account_id;
        if (!acctId) { res.status(400).json({ error: 'accountId required' }); return; }

        // Fetch the account's GHL credentials - prefer OAuth token, fall back to manual API key
        const acctRes = await sbFetch(`accounts?id=eq.${acctId}&select=ghl_api_key,ghl_oauth_access_token,ghl_oauth_refresh_token,ghl_oauth_expires_at`);
        const acctRows = await acctRes.json();
        const acct = acctRows[0];
        let ghlToken = acct?.ghl_oauth_access_token || acct?.ghl_api_key;
        if (!ghlToken) { res.status(400).json({ error: 'No GHL API key or OAuth connection configured for this account' }); return; }

        // Auto-refresh OAuth token if expired (within 5 min buffer)
        if (acct?.ghl_oauth_access_token && acct?.ghl_oauth_expires_at) {
          const expiresAt = new Date(acct.ghl_oauth_expires_at);
          const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
          if (expiresAt < fiveMinFromNow && acct.ghl_oauth_refresh_token) {
            try {
              const GHL_CLIENT_ID     = process.env.GHL_CLIENT_ID     || '69f796d2528efc733a30a9ab-moq4vxxq';
              const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET || 'dbc9f4c7-ca65-425d-800b-b43ec6a82643';
              const refreshParams = new URLSearchParams({
                client_id: GHL_CLIENT_ID, client_secret: GHL_CLIENT_SECRET,
                grant_type: 'refresh_token', refresh_token: acct.ghl_oauth_refresh_token
              });
              const refreshRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: refreshParams.toString()
              });
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 86400) * 1000).toISOString();
                await sbFetch(`accounts?id=eq.${acctId}`, {
                  method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
                  body: JSON.stringify({
                    ghl_oauth_access_token: refreshData.access_token,
                    ghl_oauth_refresh_token: refreshData.refresh_token || acct.ghl_oauth_refresh_token,
                    ghl_oauth_expires_at: newExpiresAt
                  })
                });
                ghlToken = refreshData.access_token;
              }
            } catch (refreshErr) {
              console.error('[GHL proxy] token refresh failed:', refreshErr.message);
            }
          }
        }

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
        const { payload, idempotency_key: pcIdemKey } = req.body;
        if (!payload) { res.status(400).json({ error: 'payload required' }); return; }
        // Rate limit: max 5 postcards per 10 seconds per account
        if (!_checkRate(`lob:${profile.account_id}`, 5, 10000)) {
          res.status(429).json({ error: 'rate_limited', message: 'Too many postcard requests. Please wait a moment and try again.' }); return;
        }
        // Idempotency: reject duplicate sends within 30 seconds
        if (pcIdemKey && !_checkIdem(`${profile.account_id}:${pcIdemKey}`)) {
          res.status(200).json({ _duplicate: true, message: 'Duplicate request ignored.' }); return;
        }
        // Enforce credit balance — uses only mailer_credits (no free credits system)
        const pcAcctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=id,plan,mailer_credits`
        );
        if (!pcAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account credits' }); return; }
        const pcAcctRows = await pcAcctRes.json();
        if (!pcAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const pcAcct = pcAcctRows[0];
        const pcPaid  = pcAcct.mailer_credits || 0;
        const pcTotal = pcPaid;
        if (pcTotal < POSTCARD_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending a postcard costs ${POSTCARD_CREDITS} credit ($4.00). You have ${pcTotal} credits. Please purchase more credits to continue.`,
            credits_needed: POSTCARD_CREDITS,
            credits_available: pcTotal
          });
          return;
        }
        // Deduct 1 credit BEFORE sending
        await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: pcPaid - POSTCARD_CREDITS })
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
        // If Lob failed, refund the credit
        if (!lobRes.ok) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: pcPaid })
          });
        }
        const pcNewPaid = lobRes.ok ? pcPaid - POSTCARD_CREDITS : pcPaid;
        if (lobRes.ok) {
          res.status(200).json({
            ...lobData,
            _credits: { paid_credits: pcNewPaid }
          });
        } else {
          res.status(200).json({
            error: lobData.error || lobData,
            _lobStatus: lobRes.status,
            _credits: { paid_credits: pcPaid }
          });
        }
        break;
      }

      // ── Lob campaign postcard (Circle of Influence) ─────────────────────
      case 'lob-postcard-campaign': {
        const CAMPAIGN_CREDITS = 1; // 1 credit = $4.00 = 1 postcard
        const { toAddr, toName, photoDataUrl, headline, subtext, pinId, idempotency_key: cpIdemKey } = req.body;
        if (!toAddr || !photoDataUrl) { res.status(400).json({ error: 'toAddr and photoDataUrl required' }); return; }
        // Rate limit: max 5 campaign postcards per 10 seconds per account
        if (!_checkRate(`lob:${profile.account_id}`, 5, 10000)) {
          res.status(429).json({ error: 'rate_limited', message: 'Too many postcard requests. Please wait a moment and try again.' }); return;
        }
        // Idempotency: reject duplicate sends within 30 seconds (prevents double-tap)
        if (cpIdemKey && !_checkIdem(`${profile.account_id}:${cpIdemKey}`)) {
          res.status(200).json({ _duplicate: true, message: 'Duplicate request ignored.' }); return;
        }

        // Enforce credit balance
        const cpAcctRes = await sbFetch(`accounts?id=eq.${profile.account_id}&select=id,mailer_credits,company_name,company_addr,company_phone,logo_data`);
        if (!cpAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account' }); return; }
        const cpAcctRows = await cpAcctRes.json();
        if (!cpAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const cpAcct = cpAcctRows[0];
        const cpCredits = cpAcct.mailer_credits || 0;
        if (cpCredits < CAMPAIGN_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending a postcard costs ${CAMPAIGN_CREDITS} credit ($4.00). You have ${cpCredits} credits.`,
            credits_needed: CAMPAIGN_CREDITS,
            credits_available: cpCredits
          });
          return;
        }

        // Parse addresses
        const tp = toAddr.split(',').map(s => s.trim());
        const toLine1 = tp[0] || '';
        const toCity = tp[1] || '';
        let toState = tp[2] || 'MI';
        let toZip = tp[3] || '';
        if ((!toZip || toZip === '00000') && toState && toState.includes(' ')) {
          const parts = toState.split(' '); toZip = parts.pop(); toState = parts.join(' ');
        }
        if (!toZip) toZip = '00000';
        // Normalize state abbreviation
        const stateMap = {'Michigan':'MI','Ohio':'OH','Indiana':'IN','Illinois':'IL','Wisconsin':'WI','Minnesota':'MN','Florida':'FL','Georgia':'GA','Texas':'TX','California':'CA','New York':'NY','Pennsylvania':'PA','North Carolina':'NC','Virginia':'VA','Tennessee':'TN','Arizona':'AZ','Colorado':'CO','Washington':'WA','Oregon':'OR','Nevada':'NV','Utah':'UT','Missouri':'MO','Iowa':'IA','Kansas':'KS','Nebraska':'NE','Oklahoma':'OK','Arkansas':'AR','Louisiana':'LA','Mississippi':'MS','Alabama':'AL','South Carolina':'SC','Kentucky':'KY','West Virginia':'WV','Maryland':'MD','Delaware':'DE','New Jersey':'NJ','Connecticut':'CT','Massachusetts':'MA','Rhode Island':'RI','Vermont':'VT','New Hampshire':'NH','Maine':'ME'};
        if (stateMap[toState]) toState = stateMap[toState];

        const fromRaw = cpAcct.company_addr || '123 Main St, Detroit, MI, 48000';
        const fp = fromRaw.split(',').map(s => s.trim());
        let fromCity = fp[1] || 'Detroit';
        let fromState = fp[2] || 'MI';
        let fromZip = fp[3] || '48000';
        if ((!fromZip || fromZip === '00000') && fromState && fromState.includes(' ')) {
          const parts = fromState.split(' '); fromZip = parts.pop(); fromState = parts.join(' ');
        }
        if (stateMap[fromState]) fromState = stateMap[fromState];

        // Build campaign postcard front HTML (photo background + headline + subtext)
        const safeHeadline = (headline || 'We just finished a project in your neighborhood!').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const safeSubtext = (subtext || 'Your neighbors love the results. Want a free quote?').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const co = cpAcct.company_name || 'Your Company';
        const ph = cpAcct.company_phone || '';
        const frontHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,sans-serif;position:relative;background:#1a2333}.bg-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;z-index:0}.overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(to bottom,rgba(0,0,0,.2) 0%,rgba(0,0,0,.05) 40%,rgba(0,0,0,.7) 75%,rgba(0,0,0,.88) 100%);z-index:1}.c{position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:40px 44px}.hl{font-size:36px;font-weight:900;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.8);line-height:1.15;margin-bottom:10px}.sub{font-size:18px;color:rgba(255,255,255,.9);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:16px;font-weight:500}.co{font-size:15px;color:rgba(255,255,255,.8);font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.6)}</style></head><body><img class="bg-img" src="${photoDataUrl}" alt=""><div class="overlay"></div><div class="c"><div class="hl">${safeHeadline}</div><div class="sub">${safeSubtext}</div><div class="co">${co.replace(/</g,'&lt;')}${ph?' · '+ph.replace(/</g,'&lt;'):''}</div></div></body></html>`;

        // Build standard back HTML
        const backHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,sans-serif;background:#fff;position:relative}.indicia{position:absolute;top:32px;right:32px;width:100px;height:60px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;text-align:center;line-height:1.3}.return-addr{position:absolute;top:32px;left:32px;font-size:10px;color:#333;line-height:1.6}.to-addr{position:absolute;bottom:80px;left:50%;transform:translateX(-50%);text-align:center;font-size:13px;color:#222;line-height:1.8;font-weight:600}.co-name{font-size:14px;font-weight:800;color:#111}</style></head><body><div class="indicia">PRESORTED<br>FIRST CLASS<br>U.S. POSTAGE<br>PAID<br>LOB.COM</div><div class="return-addr"><div class="co-name">${co.replace(/</g,'&lt;')}</div><div>${(fp[0]||'').replace(/</g,'&lt;')}</div><div>${fromCity.replace(/</g,'&lt;')}, ${fromState} ${fromZip}</div></div><div class="to-addr"><div>${(toName||'Neighbor').replace(/</g,'&lt;')}</div><div>${toLine1.replace(/</g,'&lt;')}</div><div>${toCity.replace(/</g,'&lt;')}, ${toState} ${toZip}</div></div></body></html>`;

        // Deduct credit BEFORE sending
        await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: cpCredits - CAMPAIGN_CREDITS })
        });

        // Send via Lob
        const cpLobRes = await fetch('https://api.lob.com/v1/postcards', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: 'Circle of Influence Campaign — ' + toAddr,
            to: { name: toName || 'Neighbor', address_line1: toLine1, address_city: toCity, address_state: toState, address_zip: toZip, address_country: 'US' },
            from: { name: co, address_line1: fp[0] || '123 Main St', address_city: fromCity, address_state: fromState, address_zip: fromZip, address_country: 'US' },
            front: '<html>' + frontHtml,
            back: '<html>' + backHtml,
            size: '6x9',
            use_type: 'marketing'
          })
        });
        const cpLobData = await cpLobRes.json();

        // Refund if Lob failed
        if (!cpLobRes.ok) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: cpCredits })
          });
          res.status(200).json({ error: cpLobData.error || cpLobData, _lobStatus: cpLobRes.status });
          return;
        }

        // Log to mailer_log
        const mlRes = await sbFetch('mailer_log', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            account_id: profile.account_id,
            sent_by: profile.id || null,
            address: toAddr,
            owner_name: toName || 'Neighbor',
            estimate_total: 0,
            lob_id: cpLobData.id,
            company_name: co,
            mailer_type: 'campaign-postcard',
            sent_at: new Date().toISOString()
          })
        });

        res.status(200).json({
          ...cpLobData,
          _credits: { paid_credits: cpCredits - CAMPAIGN_CREDITS }
        });
        break;
      }
      // ── Lob letter proxy ──────────────────────────────────────────────────
      case 'lob-letter': {
        const LETTER_CREDITS = 1; // 1 credit = $4.00 = 1 letter
        const { payload: ltPayload } = req.body;
        if (!ltPayload) { res.status(400).json({ error: 'payload required' }); return; }
        // Enforce credit balance — uses only mailer_credits (no free credits system)
        const ltAcctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=id,plan,mailer_credits`
        );
        if (!ltAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account credits' }); return; }
        const ltAcctRows = await ltAcctRes.json();
        if (!ltAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const ltAcct = ltAcctRows[0];
        const ltPaid  = ltAcct.mailer_credits || 0;
        const ltTotal = ltPaid;
        if (ltTotal < LETTER_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending a letter costs ${LETTER_CREDITS} credit ($4.00). You have ${ltTotal} credits. Please purchase more credits to continue.`,
            credits_needed: LETTER_CREDITS,
            credits_available: ltTotal
          });
          return;
        }
        // Deduct 1 credit BEFORE sending
        await sbFetch(`accounts?id=eq.${profile.account_id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: ltPaid - LETTER_CREDITS })
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
        // If Lob failed, refund the credit
        if (!ltLobRes.ok) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: ltPaid })
          });
        }
        const ltNewPaid = ltLobRes.ok ? ltPaid - LETTER_CREDITS : ltPaid;
        if (ltLobRes.ok) {
          res.status(200).json({
            ...ltLobData,
            _credits: { paid_credits: ltNewPaid }
          });
        } else {
          res.status(200).json({
            error: ltLobData.error || ltLobData,
            _lobStatus: ltLobRes.status,
            _credits: { paid_credits: ltPaid }
          });
        }
        break;
      }

      // ── RentCast proxy (with credit enforcement) ─────────────────────────
      case 'rentcast': {
        // Homeowner lookups are free — no credit gate
        const { address } = req.query;
        if (!address) { res.status(400).json({ error: 'address required' }); return; }
        // Call RentCast with a hard 8s timeout to prevent 504 gateway timeouts
        const rcCtrl = new AbortController();
        const rcTimeout = setTimeout(() => rcCtrl.abort(), 8000);
        try {
          const rcRes = await fetch(
            `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`,
            { headers: { 'X-Api-Key': RENTCAST_KEY }, signal: rcCtrl.signal }
          );
          clearTimeout(rcTimeout);
          // Return 200 with notFound:true for 404s — address not in RentCast DB is expected, not an error
          if (rcRes.status === 404) { res.status(200).json({ notFound: true, properties: [] }); return; }
          const rcData = await rcRes.json();
          res.status(rcRes.status).json(
            Array.isArray(rcData) ? { properties: rcData } : rcData
          );
        } catch (rcErr) {
          clearTimeout(rcTimeout);
          if (rcErr.name === 'AbortError') {
            return res.status(408).json({ error: 'rentcast_timeout', message: 'RentCast lookup timed out' });
          }
          throw rcErr;
        }
        break;
      }

      case 'rentcast-nearby': {
        // Find real neighboring homes by lat/lng radius using RentCast /properties
        const { lat: rcLat, lng: rcLng, radius: rcRadius, limit: rcLimit } = req.query;
        if (!rcLat || !rcLng) { res.status(400).json({ error: 'lat and lng required' }); return; }
        // Rate limit: max 3 RentCast calls per 10 seconds per account
        if (!_checkRate(`rentcast:${profile.account_id}`, 3, 10000)) {
          res.status(429).json({ error: 'rate_limited', message: 'Too many nearby searches. Please wait a moment and try again.' }); return;
        }
        const radiusMiles = parseFloat(rcRadius) || 0.1; // default 0.1 miles (~528 ft)
        const limitNum = Math.min(parseInt(rcLimit) || 100, 500);
        const rcCtrl2 = new AbortController();
        const rcTimeout2 = setTimeout(() => rcCtrl2.abort(), 10000);
        try {
          const rcRes2 = await fetch(
            `https://api.rentcast.io/v1/properties?latitude=${rcLat}&longitude=${rcLng}&radius=${radiusMiles}&propertyType=Single+Family&limit=${limitNum}&status=Active`,
            { headers: { 'X-Api-Key': RENTCAST_KEY }, signal: rcCtrl2.signal }
          );
          clearTimeout(rcTimeout2);
          const rcData2 = await rcRes2.json();
          res.status(rcRes2.status).json(
            Array.isArray(rcData2) ? { properties: rcData2 } : rcData2
          );
        } catch (rcErr2) {
          clearTimeout(rcTimeout2);
          if (rcErr2.name === 'AbortError') {
            return res.status(408).json({ error: 'rentcast_timeout', message: 'RentCast nearby search timed out' });
          }
          throw rcErr2;
        }
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
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS rep_name TEXT`,
          `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_headline1 TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_headline2 TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_badge_text TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_badge_color TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_back_badge_text TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_back_badge_color TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_scan_cta TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_scan_sub TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_photo_layout TEXT DEFAULT 'single'`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_show_price BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_show_monthly BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_show_phone BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hl1_size INTEGER DEFAULT 160`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hl2_size INTEGER DEFAULT 160`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hook_size INTEGER DEFAULT 36`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_why_size INTEGER DEFAULT 30`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_quote_size INTEGER DEFAULT 32`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_guar_size INTEGER DEFAULT 26`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_phone_size INTEGER DEFAULT 42`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_addr_size INTEGER DEFAULT 62`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_price_size INTEGER DEFAULT 78`,
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
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
          `CREATE TABLE IF NOT EXISTS scan_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), estimate_id TEXT NOT NULL, account_id TEXT, scanned_at TIMESTAMPTZ DEFAULT NOW(), source TEXT DEFAULT 'qr', user_agent TEXT, referrer TEXT)`,
          `CREATE INDEX IF NOT EXISTS idx_scan_events_estimate ON scan_events(estimate_id, scanned_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_scan_events_account ON scan_events(account_id, scanned_at DESC)`,
          `CREATE TABLE IF NOT EXISTS postcard_scans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), queue_item_id TEXT, account_id TEXT, owner_name TEXT, address TEXT, estimate_id TEXT, scanned_at TIMESTAMPTZ DEFAULT NOW(), ip TEXT, user_agent TEXT)`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS estimate_id TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS queue_item_id TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS account_id TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS owner_name TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS address TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS ip TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS user_agent TEXT`,
          `CREATE INDEX IF NOT EXISTS idx_postcard_scans_account ON postcard_scans(account_id, scanned_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_postcard_scans_estimate ON postcard_scans(estimate_id, scanned_at DESC)`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS google_tag_id TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS google_place_id TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS booking_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS call_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS drip_step INTEGER`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS drip_est_id TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sig_name TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS offer_solar BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_steps JSONB`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_paused BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_cancelled BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_cancelled_at TIMESTAMPTZ`,
          `CREATE TABLE IF NOT EXISTS campaign_targets (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            campaign_name TEXT,
            campaign_date DATE,
            lat DOUBLE PRECISION,
            lng DOUBLE PRECISION,
            radius_miles NUMERIC,
            pin_count INTEGER DEFAULT 0,
            mailer_count INTEGER DEFAULT 0,
            storm_ids JSONB,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )`
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

      case 'tracerfy': {
        // Skip-trace a homeowner by name + address using Tracerfy API
        // Returns phones (with DNC flag) and emails for the property owner
        const { ownerName, address: tfAddress, city: tfCity, state: tfState, zip: tfZip, pinId: tfPinId } = req.body;
        if (!tfAddress) { res.status(400).json({ error: 'address required' }); return; }
        // SERVER-SIDE DEDUP: if this pin already has contact_data saved, return it without hitting Tracerfy
        if (tfPinId && accountId) {
          const { data: existingPin } = await sbFetch(`pins?select=contact_data&id=eq.${tfPinId}&account_id=eq.${accountId}&limit=1`);
          const existing = existingPin && existingPin[0];
          if (existing && existing.contact_data &&
              ((existing.contact_data.phones||[]).length + (existing.contact_data.emails||[]).length) > 0) {
            console.log('[BidDrop] Tracerfy dedup: returning cached contact_data for pin', tfPinId);
            return res.json({ _cached: true, persons: [{ phones: existing.contact_data.phones||[], emails: existing.contact_data.emails||[], full_name: existing.contact_data.ownerName||'' }] });
          }
        }
        // Parse owner name into first/last
        let tfFirst = '';
        let tfLast  = '';
        if (ownerName) {
          const parts = ownerName.trim().split(/\s+/);
          tfFirst = parts[0] || '';
          tfLast  = parts.slice(1).join(' ') || '';
        }
        const tfPayload = {
          address: tfAddress,
          ...(tfCity  && { city:  tfCity  }),
          ...(tfState && { state: tfState }),
          ...(tfZip   && { zip:   tfZip   }),
          ...(tfFirst && { first_name: tfFirst }),
          ...(tfLast  && { last_name:  tfLast  }),
        };
        const tfRes = await fetch('https://www.tracerfy.com/v1/api/trace/lookup/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TRACERFY_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(tfPayload)
        });
        const tfData = await tfRes.json();
        return res.status(tfRes.status).json(tfData);
      }
      case 'campaign-save': {
        // Save a new campaign record to campaign_targets table
        const { campaign } = req.body;
        if (!campaign || !campaign.id) { res.status(400).json({ error: 'campaign object with id required' }); return; }
        const r = await sbFetch('campaign_targets', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(campaign)
        });
        const body = await r.text();
        // Gracefully handle missing table (migration not yet run)
        if (!r.ok && (body.includes('campaign_targets') || body.includes('PGRST205'))) {
          return res.status(200).json({ ok: false, migrationNeeded: true, message: 'campaign_targets table not yet created — run /api/migrate' });
        }
        return res.status(r.ok ? 200 : r.status).json({ ok: r.ok, status: r.status, body: body.substring(0, 200) });
      }
      case 'campaign-update': {
        // Update an existing campaign record (e.g. postcards_sent, ghl_pushed)
        const { campaignId, updates } = req.body;
        if (!campaignId || !updates) { res.status(400).json({ error: 'campaignId and updates required' }); return; }
        const r = await sbFetch(`campaign_targets?id=eq.${campaignId}`, {
          method: 'PATCH',
          body: JSON.stringify(updates)
        });
        return res.status(r.ok ? 200 : r.status).json({ ok: r.ok });
      }
      case 'campaign-list': {
        // List campaigns for an account, most recent first
        const listAcctId = profile.account_id;
        if (!listAcctId) { res.status(401).json({ error: 'auth required' }); return; }
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const r = await sbFetch(`campaign_targets?account_id=eq.${listAcctId}&order=campaign_date.desc&limit=${limit}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!r.ok) {
          const errText = await r.text();
          // Gracefully return empty list if table doesn't exist yet
          if (errText.includes('campaign_targets') || errText.includes('PGRST205')) {
            return res.status(200).json({ campaigns: [], migrationNeeded: true });
          }
          return res.status(200).json({ campaigns: [] });
        }
        const data = await r.json();
        return res.status(200).json({ campaigns: Array.isArray(data) ? data : [] });
      }
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[BidDrop API]', err);
    res.status(500).json({ error: err.message });
  }
}
