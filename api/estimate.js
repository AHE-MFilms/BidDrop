/**
 * BidDrop Public Estimate Page API — Vercel Serverless Function
 *
 * No authentication required. Used by the homeowner-facing estimate page at /e/[id].
 *
 * Actions:
 *  GET  ?action=get&id=est_123          → returns full estimate + account config (public-safe)
 *  POST { action:'track_view', id, seconds }  → increments view count, updates time spent
 *  POST { action:'track_event', id, event, data } → logs mat_click / share / call events
 */

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const action = req.method === 'GET' ? req.query.action : req.body?.action;

    // ── GET estimate + account config ─────────────────────────────────────────
    if (action === 'get') {
      const id = (req.query.id || '').trim();
      if (!id) { res.status(400).json({ error: 'id required' }); return; }

      // Fetch estimate row
      const estR = await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}&select=id,account_id,pin_id,addr,owner,email,phone,total,sqft,mat,structures,photo_url,photo_data,all_photos,damage_photos,skylight,skylight_qty,chimney,gutters,gutter_lf,saved_at,source,page_views,page_first_viewed_at,page_last_viewed_at,page_time_spent,page_mat_clicks,page_share_clicks,page_call_clicks,expires_at,rep_video_url,page_enabled,rep,version,deleted_at,is_revision,inspection_note`);
      const estRows = await estR.json();
      if (!estRows || !estRows.length) { res.status(404).json({ error: 'Estimate not found' }); return; }
      const est = estRows[0];

      // Guard: deleted or disabled
      if (est.deleted_at || est.page_enabled === false) {
        res.status(404).json({ error: 'Estimate not available' }); return;
      }

      // Fetch account config
      const acctR = await sbFetch(`accounts?id=eq.${encodeURIComponent(est.account_id)}&select=id,company_name,company_phone,company_addr,brand_color,logo_data,headshot,rep_name,rep_title,booking_url,diff1,diff2,diff3,diff4,diff5,diff6,years_in_business,warranty_years,financing_enabled,financing_apr,financing_term,financing_down,cost_architectural,cost_3tab,cost_designer,cost_metal,cost_tearoff,cost_ice_water,cost_felts,cost_dumpster,overhead,margin,estimate_page_expires_days,estimate_page_countdown,active,company_bio`);
      const acctRows = await acctR.json();
      if (!acctRows || !acctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
      const acct = acctRows[0];
      if (!acct.active) { res.status(403).json({ error: 'Account inactive' }); return; }

      // Parse structures JSON if stored as string
      let structures = est.structures;
      if (typeof structures === 'string') {
        try { structures = JSON.parse(structures); } catch { structures = []; }
      }

      // Parse all_photos
      let allPhotos = est.all_photos;
      if (typeof allPhotos === 'string') {
        try { allPhotos = JSON.parse(allPhotos); } catch { allPhotos = null; }
      }

      // Parse damage_photos
      let damagePhotos = est.damage_photos;
      if (typeof damagePhotos === 'string') {
        try { damagePhotos = JSON.parse(damagePhotos); } catch { damagePhotos = null; }
      }

      res.json({
        estimate: {
          id:          est.id,
          addr:        est.addr,
          owner:       est.owner,
          total:       est.total,
          sqft:        est.sqft,
          structures:  structures || [],
          photoUrl:    est.photo_url || null,
          allPhotos:   allPhotos || null,
          damagePhotos: damagePhotos || null,
          skylight:    est.skylight || false,
          skylightQty: est.skylight_qty || 1,
          chimney:     est.chimney || false,
          gutters:     est.gutters || false,
          gutterLf:    est.gutter_lf || 120,
          savedAt:     est.saved_at,
          expiresAt:   est.expires_at || null,
          repVideoUrl: est.rep_video_url || null,
          rep:         est.rep || '',
          pageViews:   est.page_views || 0,
          pageTimeSpent: est.page_time_spent || 0,
          pageMatClicks: est.page_mat_clicks || {},
          pageShareClicks: est.page_share_clicks || 0,
          pageCallClicks:  est.page_call_clicks  || 0,
          pageFirstViewedAt: est.page_first_viewed_at || null,
          inspectionNote: est.inspection_note || null,
        },
        account: {
          companyName:   acct.company_name  || 'Your Roofing Co',
          companyPhone:  acct.company_phone || '',
          companyAddr:   acct.company_addr  || '',
          brandColor:    acct.brand_color   || '#F25C05',
          logoData:      acct.logo_data     || null,
          headshot:      acct.headshot      || null,
          repName:       acct.rep_name      || '',
          repTitle:      acct.rep_title     || 'Roofing Specialist',
          bookingUrl:    acct.booking_url   || '',
          yearsInBusiness: acct.years_in_business || '5+',
          warrantyYears: acct.warranty_years || '10',
          diff1: acct.diff1 || 'Licensed, Bonded & Insured',
          diff2: acct.diff2 || 'Manufacturer Certified',
          diff3: acct.diff3 || 'Itemized Pricing',
          diff4: acct.diff4 || 'Workmanship Warranty',
          diff5: acct.diff5 || 'Financing Available',
          diff6: acct.diff6 || 'Local Crews',
          financingEnabled: acct.financing_enabled !== false,
          financingApr:  acct.financing_apr  || 9.99,
          financingTerm: acct.financing_term || 60,
          financingDown: acct.financing_down || 0,
          costArchitectural: acct.cost_architectural || 450,
          cost3Tab:          acct.cost_3tab           || 350,
          costDesigner:      acct.cost_designer       || 620,
          costMetal:         acct.cost_metal          || 950,
          costTearoff:       acct.cost_tearoff        || 75,
          costIceWater:      acct.cost_ice_water      || 42,
          costFelts:         acct.cost_felts          || 22,
          costDumpster:      acct.cost_dumpster       || 450,
          overhead:          acct.overhead            || 15,
          margin:            acct.margin              || 20,
          estimatePageCountdown: acct.estimate_page_countdown || false,
          estimatePageExpiresDays: acct.estimate_page_expires_days || null,
          companyBio: acct.company_bio || '',
        }
      });
      return;
    }

    // ── GET reviews proxy ─────────────────────────────────────────────────────
    if (action === 'reviews') {
      const placeId = (req.query.place_id || '').trim();
      if (!placeId) { res.status(400).json({ error: 'place_id required' }); return; }
      const GKEY = process.env.GOOGLE_PLACES_KEY || '';
      if (!GKEY) { res.json({ reviews: [], rating: null, user_ratings_total: 0 }); return; }
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total,reviews&key=${GKEY}`;
      const gr = await fetch(url);
      const gd = await gr.json();
      const result = gd.result || {};
      res.json({
        reviews: (result.reviews || []).filter(r => r.rating >= 4).slice(0, 5),
        rating: result.rating || null,
        user_ratings_total: result.user_ratings_total || 0,
      });
      return;
    }

    // ── POST track_view ────────────────────────────────────────────────────────
    if (action === 'track_view') {
      const { id, seconds } = req.body || {};
      if (!id) { res.status(400).json({ error: 'id required' }); return; }

      const now = new Date().toISOString();
      const secs = parseInt(seconds) || 0;

      // Fetch current row to get existing values
      const curR = await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}&select=page_views,page_first_viewed_at,page_time_spent`);
      const curRows = await curR.json();
      if (!curRows || !curRows.length) { res.status(404).json({ error: 'Not found' }); return; }
      const cur = curRows[0];

      const updates = {
        page_views: (cur.page_views || 0) + 1,
        page_last_viewed_at: now,
        page_time_spent: (cur.page_time_spent || 0) + secs,
      };
      if (!cur.page_first_viewed_at) updates.page_first_viewed_at = now;

      await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: { 'Prefer': 'return=minimal' }
      });

      res.json({ ok: true });
      return;
    }

    // ── POST track_event ───────────────────────────────────────────────────────
    if (action === 'track_event') {
      const { id, event, data } = req.body || {};
      if (!id || !event) { res.status(400).json({ error: 'id and event required' }); return; }

      // Fetch current row
      const curR = await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}&select=page_mat_clicks,page_share_clicks,page_call_clicks`);
      const curRows = await curR.json();
      if (!curRows || !curRows.length) { res.status(404).json({ error: 'Not found' }); return; }
      const cur = curRows[0];

      const updates = {};

      if (event === 'mat_click') {
        const matKey = data?.mat || 'unknown';
        const existing = (typeof cur.page_mat_clicks === 'object' && cur.page_mat_clicks) ? cur.page_mat_clicks : {};
        existing[matKey] = (existing[matKey] || 0) + 1;
        updates.page_mat_clicks = existing;
      } else if (event === 'share') {
        updates.page_share_clicks = (cur.page_share_clicks || 0) + 1;
      } else if (event === 'call') {
        updates.page_call_clicks = (cur.page_call_clicks || 0) + 1;
      }

      if (Object.keys(updates).length) {
        await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
          headers: { 'Prefer': 'return=minimal' }
        });
      }

      res.json({ ok: true });
      return;
    }

    // ── POST track_qr_scan ────────────────────────────────────────────────────
    if (action === 'track_qr_scan') {
      const { id } = req.body || {};
      if (!id) { res.status(400).json({ error: 'id required' }); return; }
      const now = new Date().toISOString();
      const curR = await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}&select=account_id,qr_scan_count,qr_first_scanned_at`);
      const curRows = await curR.json();
      if (!curRows || !curRows.length) { res.status(404).json({ error: 'Not found' }); return; }
      const cur = curRows[0];
      const updates = { qr_scan_count: (cur.qr_scan_count || 0) + 1, qr_last_scanned_at: now };
      if (!cur.qr_first_scanned_at) updates.qr_first_scanned_at = now;
      await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH', body: JSON.stringify(updates), headers: { 'Prefer': 'return=minimal' }
      });
      const ua = (req.headers['user-agent'] || '').substring(0, 300);
      const ref = (req.headers['referer'] || '').substring(0, 300);
      await sbFetch('scan_events', {
        method: 'POST',
        body: JSON.stringify({ estimate_id: id, account_id: cur.account_id || null, source: 'qr', user_agent: ua, referrer: ref }),
        headers: { 'Prefer': 'return=minimal' }
      });
      res.json({ ok: true, scan_count: (cur.qr_scan_count || 0) + 1 });
      return;
    }
    // ── POST capture-lead ──────────────────────────────────────────────────────
    if (action === 'capture_lead' || action === 'capture-lead') {
      const { estimate_id, first_name, last_name, email, phone } = req.body || {};
      if (!estimate_id) { res.status(400).json({ error: 'estimate_id required' }); return; }

      // Get the pin_id from the estimate
      const estR = await sbFetch(`estimates?id=eq.${encodeURIComponent(estimate_id)}&select=id,pin_id,account_id`);
      const estRows = await estR.json();
      if (!estRows || !estRows.length) { res.status(404).json({ error: 'Estimate not found' }); return; }
      const est = estRows[0];

      const now = new Date().toISOString();
      const fullName = [first_name, last_name].filter(Boolean).join(' ');

      // Update the estimate with lead info
      await sbFetch(`estimates?id=eq.${encodeURIComponent(estimate_id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          owner: fullName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          page_first_viewed_at: now,
        }),
        headers: { 'Prefer': 'return=minimal' }
      });

      // Also update the pin with homeowner contact info if pin_id exists
      if (est.pin_id) {
        await sbFetch(`pins?id=eq.${encodeURIComponent(est.pin_id)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            owner_name: fullName || undefined,
            owner_email: email || undefined,
            owner_phone: phone || undefined,
          }),
          headers: { 'Prefer': 'return=minimal' }
        });
      }

      res.json({ ok: true });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[estimate API]', err);
    res.status(500).json({ error: err.message });
  }
}
