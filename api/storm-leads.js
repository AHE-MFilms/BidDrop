// api/storm-leads.js
// Storm Leads feature — two actions:
//
//  GET  ?action=swath&swLat=&swLng=&neLat=&neLng=&stormDate=&stormCity=
//    → Returns all Single Family homes in the bounding box from RentCast (free, no credit cost).
//    → Also creates/finds the storm campaign record for this date+city.
//
//  POST { action:'unlock', pinId, lat, lon, address, campaignId, stormDate, stormCity }
//    → Deducts 1 mailer credit, saves the pin to Supabase, adds it to the storm campaign.
//    → Returns { ok, pin, creditsRemaining }
//
// Auth: JWT in Authorization header (same as all admin-*.js routes)

const { SUPABASE_URL, SERVICE_KEY, RENTCAST_KEY, sbFetch } = require('./_admin-shared');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const MAX_HOMES = 200; // cap per swath pull to avoid huge RentCast bills

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Auth required' });
  let profile, accountId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    profile = decoded;
    accountId = decoded.account_id || decoded.accountId;
    if (!accountId) throw new Error('No account_id in token');
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token: ' + e.message });
  }

  const action = req.method === 'GET' ? req.query.action : (req.body?.action);

  // ── GET swath: pull addresses in bounding box (free) ─────────────────────
  if (req.method === 'GET' && action === 'swath') {
    const { swLat, swLng, neLat, neLng, stormDate, stormCity } = req.query;
    if (!swLat || !swLng || !neLat || !neLng) {
      return res.status(400).json({ error: 'swLat, swLng, neLat, neLng required' });
    }
    if (!RENTCAST_KEY) {
      return res.status(500).json({ error: 'RENTCAST_KEY not configured' });
    }

    // Center of bounding box
    const centerLat = (parseFloat(swLat) + parseFloat(neLat)) / 2;
    const centerLng = (parseFloat(swLng) + parseFloat(neLng)) / 2;
    // Radius: half the diagonal of the bounding box in miles
    const latDiff = parseFloat(neLat) - parseFloat(swLat);
    const lngDiff = parseFloat(neLng) - parseFloat(swLng);
    const radiusDeg = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) / 2;
    const radiusMiles = Math.min(radiusDeg * 69, 5); // cap at 5 miles

    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 12000);
      const rcRes = await fetch(
        `https://api.rentcast.io/v1/properties?latitude=${centerLat}&longitude=${centerLng}&radius=${radiusMiles.toFixed(2)}&propertyType=Single+Family&limit=${MAX_HOMES}`,
        { headers: { 'X-Api-Key': RENTCAST_KEY }, signal: ctrl.signal }
      );
      clearTimeout(timeout);

      if (!rcRes.ok) {
        const err = await rcRes.text();
        return res.status(rcRes.status).json({ error: 'RentCast error', detail: err.substring(0, 200) });
      }
      const rcData = await rcRes.json();
      const properties = Array.isArray(rcData) ? rcData : (rcData.properties || []);

      // Filter to only homes inside the actual bounding box
      const sw_lat = parseFloat(swLat), ne_lat = parseFloat(neLat);
      const sw_lng = parseFloat(swLng), ne_lng = parseFloat(neLng);
      const inBox = properties.filter(p =>
        p.latitude >= sw_lat && p.latitude <= ne_lat &&
        p.longitude >= sw_lng && p.longitude <= ne_lng
      );

      // Check which addresses are already unlocked by this account
      // (so we don't show them as locked if user already paid)
      const alreadyUnlocked = new Set();
      if (inBox.length > 0) {
        const addrList = inBox.map(p => p.formattedAddress || p.address || '').filter(Boolean);
        // Query pins table for already-unlocked storm leads
        const pinRes = await sbFetch(
          `pins?account_id=eq.${accountId}&storm_lead=eq.true&select=address&limit=500`
        );
        if (pinRes.ok) {
          const pins = await pinRes.json();
          pins.forEach(p => alreadyUnlocked.add((p.address || '').toLowerCase()));
        }
      }

      // Build campaign name
      const campaignName = stormDate && stormCity
        ? `${stormCity} Hail — ${stormDate}`
        : `Storm Leads — ${new Date().toISOString().slice(0, 10)}`;

      // Find or create campaign for this storm
      let campaignId = null;
      const campRes = await sbFetch(
        `campaign_targets?account_id=eq.${accountId}&source_address=eq.${encodeURIComponent(campaignName)}&limit=1`
      );
      if (campRes.ok) {
        const camps = await campRes.json();
        if (camps.length > 0) {
          campaignId = camps[0].id;
        }
      }
      if (!campaignId) {
        campaignId = 'storm-' + Date.now();
        const newCamp = {
          id: campaignId,
          account_id: accountId,
          source_address: campaignName,
          campaign_date: new Date().toISOString(),
          rep_email: profile.email || '',
          pin_ids: [],
          home_count: 0,
          postcards_sent: 0,
          ghl_pushed: 0,
          status: 'active',
          storm_lead: true,
        };
        await sbFetch('campaign_targets', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(newCamp),
        }).catch(() => {}); // non-fatal if campaign_targets table missing
      }

      const homes = inBox.map(p => ({
        id:       p.id || null,
        address:  p.formattedAddress || p.address || '',
        lat:      p.latitude,
        lon:      p.longitude,
        owner:    p.ownerName || null,
        yearBuilt: p.yearBuilt || null,
        sqft:     p.squareFootage || null,
        unlocked: alreadyUnlocked.has((p.formattedAddress || p.address || '').toLowerCase()),
      }));

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({
        homes,
        campaignId,
        campaignName,
        total: homes.length,
      });
    } catch (e) {
      if (e.name === 'AbortError') return res.status(408).json({ error: 'RentCast timed out' });
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST unlock: deduct 1 credit, save pin, add to campaign ──────────────
  if (req.method === 'POST' && action === 'unlock') {
    const { lat, lon, address, campaignId, stormDate, stormCity, hailSize, hailDate } = req.body;
    if (!lat || !lon || !address) {
      return res.status(400).json({ error: 'lat, lon, address required' });
    }

    // 1. Check credit balance
    const acctRes = await sbFetch(`accounts?id=eq.${accountId}&select=id,mailer_credits,plan&limit=1`);
    if (!acctRes.ok) return res.status(500).json({ error: 'Failed to fetch account' });
    const accts = await acctRes.json();
    if (!accts.length) return res.status(404).json({ error: 'Account not found' });
    const acct = accts[0];
    const credits = acct.mailer_credits || 0;
    if (credits < 1) {
      return res.status(402).json({ error: 'insufficient_credits', creditsRemaining: 0 });
    }

    // 2. Deduct 1 credit (atomic PATCH)
    const deductRes = await sbFetch(`accounts?id=eq.${accountId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ mailer_credits: credits - 1 }),
    });
    if (!deductRes.ok) return res.status(500).json({ error: 'Credit deduction failed' });

    // 3. Save pin to Supabase
    const pinId = 'p' + Date.now() + Math.floor(Math.random() * 1000);
    const pin = {
      id:          pinId,
      account_id:  accountId,
      lat:         parseFloat(lat),
      lng:         parseFloat(lon),
      address:     address,
      status:      'pinned',
      notes:       `Storm lead — ${hailSize ? hailSize + '" hail on ' + hailDate : 'MRMS radar hail'}`,
      rep:         profile.name || profile.email || 'Storm Lead',
      at:          new Date().toISOString(),
      storm_lead:  true,
      campaign_id: campaignId || null,
      campaign_target: campaignId ? true : false,
      paid_by_unlock: true,
    };

    const pinRes = await sbFetch('pins', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify(pin),
    });
    if (!pinRes.ok) {
      // Refund credit if pin save failed
      await sbFetch(`accounts?id=eq.${accountId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ mailer_credits: credits }),
      }).catch(() => {});
      const err = await pinRes.text();
      return res.status(500).json({ error: 'Pin save failed', detail: err.substring(0, 200) });
    }

    // 4. Update campaign pin_ids (best-effort)
    if (campaignId) {
      const campRes2 = await sbFetch(`campaign_targets?id=eq.${campaignId}&select=pin_ids,home_count&limit=1`);
      if (campRes2.ok) {
        const camps2 = await campRes2.json();
        if (camps2.length > 0) {
          const existingIds = camps2[0].pin_ids || [];
          await sbFetch(`campaign_targets?id=eq.${campaignId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              pin_ids: [...existingIds, pinId],
              home_count: (camps2[0].home_count || 0) + 1,
            }),
          }).catch(() => {});
        }
      }
    }

    return res.status(200).json({
      ok: true,
      pin,
      creditsRemaining: credits - 1,
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
