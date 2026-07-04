/**
 * BidDrop Secure API — Vercel Serverless Function
 *
 * Thin router: authenticates the caller, then delegates to sub-modules.
 * All privileged keys are in sub-modules via _admin-shared.js.
 */
'use strict';
const { SUPABASE_URL, SERVICE_KEY, sbFetch } = require('./_admin-shared');
const users    = require('./admin-users');
const ghl      = require('./admin-ghl');
const lob      = require('./admin-lob');
const rentcast = require('./admin-rentcast');
const storage  = require('./admin-storage');
const misc     = require('./admin-misc');

const MODULES = [users, ghl, lob, rentcast, storage, misc];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function verifyCallerJwt(req) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return await r.json();
}

async function getCallerProfile(userId) {
  const r = await sbFetch(`user_profiles?id=eq.${userId}&select=id,role,account_id`);
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const { action } = req.query;

  // Public actions — no auth required
  if (action === 'get-blitz-promo') {
    const { SUPABASE_URL, SERVICE_KEY, AGENCY_ACCT_ID } = require('./_admin-shared');
    const gbpRes = await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${AGENCY_ACCT_ID}&select=blitz_promo_enabled,blitz_promo_config&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
    if (!gbpRes.ok) { return res.json({ enabled: false, config: { buy: 3, get: 5, label: 'Buy 3 Get 5 Total!' } }); }
    const rows = await gbpRes.json();
    const row = rows[0] || {};
    return res.json({ enabled: row.blitz_promo_enabled || false, config: row.blitz_promo_config || { buy: 3, get: 5, label: 'Buy 3 Get 5 Total!' } });
  }

  const caller = await verifyCallerJwt(req);
  if (!caller) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const profile = await getCallerProfile(caller.id);
  if (!profile) { res.status(403).json({ error: 'No profile found' }); return; }
  const isSuperAdmin = profile.role === 'super_admin';
  const isAdmin      = profile.role === 'admin' || isSuperAdmin;
  const viewingAccountId = req.body?.viewingAccountId || null;
  const effectiveAccountId = (isSuperAdmin && viewingAccountId) ? viewingAccountId : profile.account_id;
  const ctx = { profile, isSuperAdmin, isAdmin, effectiveAccountId, caller };
  try {
    for (const mod of MODULES) {
      const handled = await mod.handle(action, req, res, ctx);
      if (handled) return;
    }
    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[BidDrop API]', err);
    res.status(500).json({ error: err.message });
  }
};
