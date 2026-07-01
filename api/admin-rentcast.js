/**
 * BidDrop API — RentCast property lookup and nearby search
 * Sub-module of admin.js, called by the main router.
 */
'use strict';
const { SUPABASE_URL, SERVICE_KEY, LOB_KEY, RENTCAST_KEY, AGENCY_ACCT_ID,
  STRIPE_SECRET_KEY, SUPABASE_PAT, TRACERFY_KEY, _checkRate, _checkIdem, sbFetch } = require('./_admin-shared');

/**
 * Handle actions for this module.
 * Returns true if the action was handled, false if unknown (caller should try next module).
 */
async function handle(action, req, res, ctx) {
  const { profile, isSuperAdmin, isAdmin, effectiveAccountId, caller } = ctx;
  switch (action) {
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
        if (!_checkRate(`rentcast:${effectiveAccountId}`, 3, 10000)) {
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

    default:
      return false;
  }
  return true;
}

module.exports = { handle };
