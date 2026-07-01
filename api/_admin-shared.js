/**
 * BidDrop Shared API Helpers
 * Used by all admin-*.js route modules.
 */
const SUPABASE_URL   = process.env.SUPABASE_URL    || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const LOB_KEY        = process.env.LOB_API_KEY;
const RENTCAST_KEY   = process.env.RENTCAST_API_KEY;
const AGENCY_ACCT_ID = process.env.AGENCY_ACCOUNT_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_PAT   = process.env.SUPABASE_PAT;
const TRACERFY_KEY   = process.env.TRACERFY_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjozMjUwNTk2MTEzLCJpYXQiOjE3ODE3OTYxMTMsImp0aSI6ImFhYmIyYjc1OWE2MzQ3NjViNDVhZWFjMTA3ZmFhYzI3IiwidXNlcl9pZCI6ODI2OH0.ymqyjLor60uQpotAKibSzV5XMYeOG_CsmkGzGMDARLo';

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

const _idemStore = new Map();
function _checkIdem(key) {
  const now = Date.now();
  for (const [k, ts] of _idemStore) { if (now - ts > 30000) _idemStore.delete(k); }
  if (_idemStore.has(key)) return false;
  _idemStore.set(key, now);
  return true;
}

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

module.exports = { SUPABASE_URL, SERVICE_KEY, LOB_KEY, RENTCAST_KEY, AGENCY_ACCT_ID,
  STRIPE_SECRET_KEY, SUPABASE_PAT, TRACERFY_KEY, _checkRate, _checkIdem, sbFetch };
