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

const SUPABASE_URL      = process.env.SUPABASE_URL  || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_KEY;
const AGENCY_ACCOUNT_ID = process.env.AGENCY_ACCOUNT_ID;

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


// ── Silent GHL sync helper ────────────────────────────────────────────────
// Silently upserts a contact + opportunity in GHL using the account's API key.
// Never throws — any error is logged and swallowed so the main flow is unaffected.
async function syncLeadToGHL({ apiKey, locationId, pipelineId, pipelineStageId, existingContactId, firstName, lastName, email, phone, address, estimateTotal, estimateId, extraTags }) {
  if (!apiKey || !locationId) return; // GHL not configured — skip silently
  // Normalize phone to E.164 format (GHL requires +1XXXXXXXXXX for US numbers)
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) phone = '+1' + digits;
    else if (digits.length === 11 && digits[0] === '1') phone = '+' + digits;
  }
  const BASE = 'https://services.leadconnectorhq.com';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Version': '2021-07-28',
  };
  try {
    // 1. Upsert contact
    let contactId = null;
    const baseTags = ['biddrop-lead', 'canvass'];
    const allTags = extraTags && extraTags.length ? [...baseTags, ...extraTags] : baseTags;
    const contactBody = {
      locationId,
      firstName: firstName || undefined,
      lastName:  lastName  || undefined,
      email:     email     || undefined,
      phone:     phone     || undefined,
      address1:  address   || undefined,
      source:    'BidDrop',
      tags:      allTags,
    };
    // PRIORITY 1: Use the stored GHL contact ID from the pin (avoids duplicate creation)
    if (existingContactId) {
      contactId = existingContactId;
      console.log('[GHL sync] PUT contact', contactId, 'body=', JSON.stringify(contactBody));
      const putRes = await fetch(`${BASE}/contacts/${contactId}`, {
        method: 'PUT', headers,
        body: JSON.stringify(contactBody),
      });
      const putText = await putRes.text();
      console.log('[GHL sync] PUT response', putRes.status, putText.slice(0, 300));
    } else {
      // PRIORITY 2: Search by email or phone to find an existing contact
      const searchParam = email
        ? `email=${encodeURIComponent(email)}`
        : (phone ? `phone=${encodeURIComponent(phone)}` : null);
      if (searchParam) {
        const searchRes = await fetch(`${BASE}/contacts/search/duplicate?${searchParam}&locationId=${locationId}`, { headers });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          contactId = searchData?.contact?.id || null;
        }
      }
      if (contactId) {
        // Update existing contact found by email/phone
        await fetch(`${BASE}/contacts/${contactId}`, {
          method: 'PUT', headers,
          body: JSON.stringify(contactBody),
        });
      } else {
        // Create new contact
        const createRes = await fetch(`${BASE}/contacts/`, {
          method: 'POST', headers,
          body: JSON.stringify(contactBody),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          contactId = created?.contact?.id || null;
        }
      }
    }
    // 2. Create opportunity in pipeline (if pipeline is configured and we have a contactId)
    if (contactId && pipelineId) {
      const oppBody = {
        pipelineId,
        locationId,
        name:    `${[firstName, lastName].filter(Boolean).join(' ') || 'Homeowner'} — ${address || 'Roof Estimate'}`,
        status:  'open',
        source:  'BidDrop',
        contactId,
        monetaryValue: estimateTotal ? Math.round(estimateTotal) : undefined,
        customFields: [
          { key: 'biddrop_estimate_id', field_value: estimateId || '' },
          { key: 'property_address',    field_value: address    || '' },
        ],
      };
      if (pipelineStageId) oppBody.pipelineStageId = pipelineStageId;
      await fetch(`${BASE}/opportunities/`, {
        method: 'POST', headers,
        body: JSON.stringify(oppBody),
      });
    }
    console.log('[GHL sync] Lead synced — contactId:', contactId, 'pipelineId:', pipelineId);
    return contactId; // Return so callers can save it back to the pin
  } catch (e) {
    console.warn('[GHL sync] Silent error (non-fatal):', e.message);
    return null;
  }
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

      // Fetch estimate row — try with price_override first, fall back if column not yet migrated
      let estRows = null;
      const estR1 = await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}&select=id,account_id,pin_id,addr,owner,email,phone,total,price_override,sqft,mat,structures,photo_url,photo_data,all_photos,damage_photos,skylight,skylight_qty,chimney,gutters,gutter_lf,saved_at,source,page_views,page_first_viewed_at,page_last_viewed_at,page_time_spent,page_mat_clicks,page_share_clicks,page_call_clicks,expires_at,rep_video_url,page_enabled,rep,version,deleted_at,is_revision,inspection_note,sig_name,signed_at,offer_solar`);
      if (estR1.ok) {
        estRows = await estR1.json();
      } else {
        // Fallback: column may not exist yet — query without price_override
        const estR2 = await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}&select=id,account_id,pin_id,addr,owner,email,phone,total,sqft,mat,structures,photo_url,photo_data,all_photos,damage_photos,skylight,skylight_qty,chimney,gutters,gutter_lf,saved_at,source,page_views,page_first_viewed_at,page_last_viewed_at,page_time_spent,page_mat_clicks,page_share_clicks,page_call_clicks,expires_at,rep_video_url,page_enabled,rep,version,deleted_at,is_revision,inspection_note`);
        estRows = await estR2.json();
      }
      if (!estRows || !estRows.length) { res.status(404).json({ error: 'Estimate not found' }); return; }
      const est = estRows[0];

      // Guard: deleted or disabled
      if (est.deleted_at || est.page_enabled === false) {
        res.status(404).json({ error: 'Estimate not available' }); return;
      }

      // Fetch account config
      const acctR = await sbFetch(`accounts?id=eq.${encodeURIComponent(est.account_id)}&select=id,company_name,company_phone,company_addr,brand_color,logo_data,headshot,rep_name,rep_title,booking_url,diff1,diff2,diff3,diff4,diff5,diff6,years_in_business,warranty_years,financing_enabled,financing_apr,financing_term,financing_down,cost_architectural,cost_3tab,cost_designer,cost_tearoff,cost_ice_water,cost_felts,cost_dumpster,overhead,margin,estimate_page_expires_days,estimate_page_countdown,active,company_bio,pricing_config_json`);

      // Fetch global content defaults from agency account (SuperAdmin CMS)
      let globalContent = {};
      if (AGENCY_ACCOUNT_ID) {
        try {
          const gcdR = await sbFetch(`accounts?id=eq.${encodeURIComponent(AGENCY_ACCOUNT_ID)}&select=global_content_defaults&limit=1`);
          if (gcdR.ok) {
            const gcdRows = await gcdR.json();
            globalContent = (gcdRows[0] && gcdRows[0].global_content_defaults) || {};
          }
        } catch (e) { /* non-fatal — fall back to built-in defaults */ }
      }
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

      // Unpack pricing_config_json (saved by Settings → Pricing) into acct fields
      const pcfg = (typeof acct.pricing_config_json === 'string'
        ? JSON.parse(acct.pricing_config_json || '{}')
        : acct.pricing_config_json) || {};
      // Merge: pricing_config_json takes priority over individual columns
      const pricingMode  = pcfg.pricingMode  || 'detailed';
      const ppsArch      = parseFloat(pcfg.ppsArchitectural) || parseFloat(acct.cost_architectural) || 450;
      const ppsDes       = parseFloat(pcfg.ppsDesigner)      || parseFloat(acct.cost_designer)      || 580;
      const ppsImpact    = parseFloat(pcfg.ppsImpact)        || parseFloat(acct.cost_impact)        || 520;
      const ppsMetal     = parseFloat(pcfg.ppsMetal)         || parseFloat(acct.cost_metal)         || 950;
      const ppsFlat      = parseFloat(pcfg.ppsFlat)          || parseFloat(acct.cost_flat)          || 400;
      const ppsTile      = parseFloat(pcfg.ppsTile)          || parseFloat(acct.cost_tile)          || 1400;
      const ppsMap = { '1.0': ppsArch, '1.3': ppsArch, '1.8': ppsDes, '1.5': ppsImpact, '2.5': ppsMetal, '0.9': ppsFlat, '3.2': ppsTile };

      // Compute per-material prices server-side — raw cost/overhead/margin never sent to browser
      function serverComputePrice(structures, matKey) {
        if (!structures || !structures.length) return 0;
        const stMult = 1; // stories multiplier (default 1 for homeowner page)
        if (pricingMode === 'per_square') {
          // Per-square mode: Squares × $/sq (matches estimator exactly)
          let total = 0;
          structures.forEach(s => {
            const sqft = parseFloat(s.sqft) || 0; if (!sqft) return;
            const pitchMult = parseFloat(s.pitch) || 1.118;
            const complexity = parseFloat(s.complexity) || 1.12;
            const sq = sqft / 100 * 1.10 * pitchMult;
            const pps = ppsMap[matKey] || ppsArch;
            total += Math.round(sq * pps * stMult * complexity);
          });
          return total;
        }
        // Detailed line-item mode
        const costMap = {
          '1.0': parseFloat(pcfg.cost3Tab)          || parseFloat(acct.cost_3tab)          || 220,
          '1.3': parseFloat(pcfg.costArchitectural) || parseFloat(acct.cost_architectural) || 300,
          '1.8': parseFloat(pcfg.costDesigner)      || parseFloat(acct.cost_designer)      || 420,
          '1.5': parseFloat(pcfg.costImpact)        || parseFloat(acct.cost_impact)        || 380,
          '2.5': parseFloat(pcfg.costMetal)         || parseFloat(acct.cost_metal)         || 680,
          '0.9': parseFloat(pcfg.costFlat)          || parseFloat(acct.cost_flat)          || 320,
          '3.2': parseFloat(pcfg.costTile)          || parseFloat(acct.cost_tile)          || 950,
        };
        const matCost  = costMap[matKey] || costMap['1.3'];
        const tearoff  = parseFloat(pcfg.costTearoff)  || parseFloat(acct.cost_tearoff)  || 75;
        const felts    = parseFloat(pcfg.costFelts)    || parseFloat(acct.cost_felts)    || 22;
        const dumpster = parseFloat(pcfg.costDumpster) || parseFloat(acct.cost_dumpster) || 450;
        const overhead = (parseFloat(pcfg.overhead) || parseFloat(acct.overhead) || 15) / 100;
        const margin   = (parseFloat(pcfg.margin)   || parseFloat(acct.margin)   || 20) / 100;
        let subtotal = dumpster;
        structures.forEach(s => {
          const sqft = parseFloat(s.sqft) || 0; if (!sqft) return;
          const pitchMult = parseFloat(s.pitch) || 1.118;
          const complexity = parseFloat(s.complexity) || 1.12;
          const sq = sqft / 100 * 1.10 * pitchMult;
          subtotal += sq * (matCost + tearoff + felts) * complexity;
        });
        return Math.round(subtotal * (1 + overhead) * (1 + margin));
      }
      const structuresForCalc = (typeof est.structures === 'string' ? JSON.parse(est.structures || '[]') : est.structures) || [];
      const serverPrices = {
        '1.0': serverComputePrice(structuresForCalc, '1.0'),
        '1.3': serverComputePrice(structuresForCalc, '1.3'),
        '1.5': serverComputePrice(structuresForCalc, '1.5'),
        '1.8': serverComputePrice(structuresForCalc, '1.8'),
        '2.5': serverComputePrice(structuresForCalc, '2.5'),
        '0.9': serverComputePrice(structuresForCalc, '0.9'),
        '3.2': serverComputePrice(structuresForCalc, '3.2'),
      };

      res.json({
        estimate: {
          id:          est.id,
          addr:        est.addr,
          owner:       est.owner,
          email:       est.email  || '',
          phone:       est.phone  || '',
          total:       est.price_override || est.total,
          priceOverride: est.price_override || null,
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
          // Server-computed per-material prices — raw cost/overhead/margin NOT sent to browser
          prices:            serverPrices,
          estimatePageCountdown: acct.estimate_page_countdown || false,
          estimatePageExpiresDays: acct.estimate_page_expires_days || null,
          companyBio: acct.company_bio || '',
        },
        // Global content defaults from SuperAdmin CMS — estimate page uses these as site-wide fallbacks
        globalContent,
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

      // Fetch current row — include contact/account fields for GHL sync
      const curR = await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}&select=account_id,pin_id,owner,email,phone,addr,page_views,page_first_viewed_at,page_time_spent`);
      const curRows = await curR.json();
      if (!curRows || !curRows.length) { res.status(404).json({ error: 'Not found' }); return; }
      const cur = curRows[0];

      const isFirstView = !cur.page_first_viewed_at;
      const updates = {
        page_views: (cur.page_views || 0) + 1,
        page_last_viewed_at: now,
        page_time_spent: (cur.page_time_spent || 0) + secs,
      };
      if (isFirstView) updates.page_first_viewed_at = now;

      await sbFetch(`estimates?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
        headers: { 'Prefer': 'return=minimal' }
      });

      // ── GHL sync: tag contact as "homeowner-viewed-estimate" on first view ──
      // On every subsequent view, still sync email/phone in case they were updated via gate form.
      if (cur.account_id) {
        try {
          // Look up GHL credentials for this account
          const acctR = await sbFetch(`accounts?id=eq.${encodeURIComponent(cur.account_id)}&select=ghl_api_key,ghl_location_id,ghl_pipeline_id,ghl_stage_id,ghl_oauth_access_token,ghl_oauth_location_id`);
          const acctRows = acctR.ok ? await acctR.json() : [];
          const ag = acctRows[0] || {};
          const ghlApiKey     = ag.ghl_oauth_access_token || ag.ghl_api_key || null;
          const ghlLocationId = ag.ghl_oauth_location_id  || ag.ghl_location_id || null;

          if (ghlApiKey && ghlLocationId) {
            // Look up the pin's stored GHL contact ID
            let existingGhlContactId = null;
            if (cur.pin_id) {
              const pinR = await sbFetch(`pins?id=eq.${encodeURIComponent(cur.pin_id)}&select=ghl_contact_id`);
              if (pinR.ok) {
                const pinRows = await pinR.json();
                existingGhlContactId = pinRows?.[0]?.ghl_contact_id || null;
              }
            }

            // Parse owner name into first/last
            const ownerParts = (cur.owner || '').trim().split(' ');
            const firstName = ownerParts[0] || undefined;
            const lastName  = ownerParts.slice(1).join(' ') || undefined;

            // Always add the viewed tag; only add first-view tag on first view
            const extraTags = ['homeowner-viewed-estimate'];
            if (isFirstView) extraTags.push('homeowner-first-view');

            const returnedContactId = await syncLeadToGHL({
              apiKey:            ghlApiKey,
              locationId:        ghlLocationId,
              pipelineId:        ag.ghl_pipeline_id  || null,
              pipelineStageId:   ag.ghl_stage_id     || null,
              existingContactId: existingGhlContactId,
              firstName,
              lastName,
              email:   cur.email   || undefined,
              phone:   cur.phone   || undefined,
              address: cur.addr    || undefined,
              estimateId: id,
              extraTags,
            });
            // Save the GHL contact ID back to the pin so future calls update instead of duplicate
            if (returnedContactId && !existingGhlContactId && cur.pin_id) {
              await sbFetch(`pins?id=eq.${encodeURIComponent(cur.pin_id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ ghl_contact_id: returnedContactId }),
                headers: { 'Prefer': 'return=minimal' }
              });
              console.log('[track_view] Saved GHL contact ID to pin:', cur.pin_id, returnedContactId);
            }
          }
        } catch (ghlErr) {
          console.warn('[track_view] GHL sync error (non-fatal):', ghlErr.message);
        }
      }

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

      // Get the estimate + account_id + address + total
      const estR = await sbFetch(`estimates?id=eq.${encodeURIComponent(estimate_id)}&select=id,pin_id,account_id,addr,total`);
      const estRows = await estR.json();
      if (!estRows || !estRows.length) { res.status(404).json({ error: 'Estimate not found' }); return; }
      const est = estRows[0];

      const now = new Date().toISOString();
      const fullName = [first_name, last_name].filter(Boolean).join(' ');

      // Update the estimate with lead info
      const patchBody = {
        page_first_viewed_at: now,
      };
      if (fullName) patchBody.owner = fullName;
      if (email)    patchBody.email = email;
      if (phone)    patchBody.phone = phone;
      console.log('[capture_lead] PATCH estimates id=', estimate_id, 'body=', JSON.stringify(patchBody));
      const patchR = await sbFetch(`estimates?id=eq.${encodeURIComponent(estimate_id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patchBody),
        headers: { 'Prefer': 'return=minimal' }
      });
      if (!patchR.ok) {
        const patchErr = await patchR.text();
        console.error('[capture_lead] PATCH failed:', patchR.status, patchErr);
      } else {
        console.log('[capture_lead] PATCH ok — email:', email, 'phone:', phone);
      }

      // Read the pin's stored ghl_contact_id so we can update (not duplicate) in GHL
      // NOTE: owner_phone / owner_email / owner_name columns do not exist on the pins table;
      //       contact info is stored on the estimate row instead (already patched above).
      let existingGhlContactId = null;
      if (est.pin_id) {
        try {
          const pinReadR = await sbFetch(`pins?id=eq.${encodeURIComponent(est.pin_id)}&select=ghl_contact_id`);
          if (pinReadR.ok) {
            const pinRows = await pinReadR.json();
            existingGhlContactId = pinRows?.[0]?.ghl_contact_id || null;
          }
        } catch (pinErr) {
          console.warn('[capture_lead] Could not read pin ghl_contact_id:', pinErr.message);
        }
      }

      // ── GHL sync — awaited so Vercel does not kill the function before it completes ──
      // Pass existingGhlContactId so syncLeadToGHL updates the contact instead of creating a duplicate
      if (est.account_id) {
        try {
          const acctGhlR = await sbFetch(`accounts?id=eq.${encodeURIComponent(est.account_id)}&select=ghl_api_key,ghl_location_id,ghl_pipeline_id,ghl_stage_id,ghl_oauth_access_token,ghl_oauth_location_id`);
          const acctGhlRows = acctGhlR.ok ? await acctGhlR.json() : [];
          const ag = acctGhlRows[0] || {};
          // Prefer OAuth token over manual API key; prefer OAuth location over manual
          const ghlApiKey     = ag.ghl_oauth_access_token || ag.ghl_api_key || null;
          const ghlLocationId = ag.ghl_oauth_location_id  || ag.ghl_location_id || null;
          const newContactId = await syncLeadToGHL({
            apiKey:             ghlApiKey,
            locationId:         ghlLocationId,
            pipelineId:         ag.ghl_pipeline_id   || null,
            pipelineStageId:    ag.ghl_stage_id      || null,
            existingContactId:  existingGhlContactId,
            firstName:          first_name,
            lastName:           last_name,
            email,
            phone,
            address:            est.addr,
            estimateTotal:      est.total,
            estimateId:         estimate_id,
          });
          // Save the GHL contact ID back to the pin so track_view and future syncs update instead of duplicate
          if (newContactId && !existingGhlContactId && est.pin_id) {
            await sbFetch(`pins?id=eq.${encodeURIComponent(est.pin_id)}`, {
              method: 'PATCH',
              body: JSON.stringify({ ghl_contact_id: newContactId }),
              headers: { 'Prefer': 'return=minimal' }
            });
            console.log('[capture_lead] Saved GHL contact ID to pin:', est.pin_id, newContactId);
          }
        } catch (ghlErr) {
          // GHL errors are non-fatal — log but do not fail the response
          console.warn('[capture_lead] GHL sync error (non-fatal):', ghlErr.message);
        }
      }

      // ── Lead Alert Notification Email (fire-and-forget) ─────────────────────
      // Send roofer an immediate alert with homeowner name, address, phone, email
      if (est.account_id) {
        try {
          const alertAcctR = await sbFetch(`accounts?id=eq.${encodeURIComponent(est.account_id)}&select=email,lead_alert_email,company_name`);
          const alertAcctRows = alertAcctR.ok ? await alertAcctR.json() : [];
          const alertAcct = alertAcctRows[0] || {};
          const alertTo = (alertAcct.lead_alert_email || alertAcct.email || '').trim();
          const resendKey = process.env.RESEND_API_KEY;
          if (alertTo && resendKey) {
            const toList = alertTo.split(',').map(e => e.trim()).filter(Boolean);
            const scanTime = new Date().toLocaleString('en-US', {
              timeZone: 'America/Detroit', weekday: 'short', month: 'short',
              day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
            });
            const fmtPhone = phone ? phone.replace(/\D/g,'').replace(/(\d{3})(\d{3})(\d{4})/,'($1) $2-$3') : null;
            const slugName = (alertAcct.company_name||'roofing').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
            const estLink = `https://biddrop.us/${slugName}/${estimate_id}`;
            const rows = [
              `<tr><td style="padding:7px 0;color:#6b7280;font-size:14px;width:80px;">Name</td><td style="padding:7px 0;font-size:14px;font-weight:600;color:#111827;">${fullName||'—'}</td></tr>`,
              `<tr><td style="padding:7px 0;color:#6b7280;font-size:14px;">Address</td><td style="padding:7px 0;font-size:14px;color:#111827;">${est.addr||'—'}</td></tr>`,
              fmtPhone ? `<tr><td style="padding:7px 0;color:#6b7280;font-size:14px;">Phone</td><td style="padding:7px 0;font-size:14px;"><a href="tel:${fmtPhone}" style="color:#f97316;font-weight:700;text-decoration:none;">${fmtPhone}</a></td></tr>` : '',
              email ? `<tr><td style="padding:7px 0;color:#6b7280;font-size:14px;">Email</td><td style="padding:7px 0;font-size:14px;"><a href="mailto:${email}" style="color:#f97316;text-decoration:none;">${email}</a></td></tr>` : '',
              est.total ? `<tr><td style="padding:7px 0;color:#6b7280;font-size:14px;">Estimate</td><td style="padding:7px 0;font-size:14px;font-weight:700;color:#111827;">$${Number(est.total).toLocaleString()}</td></tr>` : '',
            ].join('');
            const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);"><tr><td style="background:#111827;padding:22px 32px;"><p style="margin:0;color:#f97316;font-size:20px;font-weight:700;">BidDrop</p><p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">New Lead Alert</p></td></tr><tr><td style="padding:32px;"><p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827;">🎯 ${fullName||'A homeowner'} just unlocked their estimate!</p><p style="margin:0 0 24px;font-size:15px;color:#6b7280;">They filled out their contact info at <strong>${scanTime}</strong>. Reach out now while they're reviewing their quote.</p><table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;"><tr><td colspan="2" style="padding:0 0 8px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Homeowner Info</td></tr>${rows}</table><a href="${estLink}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">View Their Estimate →</a><p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">This alert was sent because a homeowner filled out their contact info on a BidDrop estimate page linked to your account.</p></td></tr><tr><td style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;">BidDrop · <a href="https://biddrop.us" style="color:#9ca3af;">biddrop.us</a></p></td></tr></table></td></tr></table></body></html>`;
            fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'BidDrop Alerts <alerts@biddrop.io>',
                to: toList,
                subject: `🎯 ${fullName||'New lead'} filled out their estimate — ${est.addr||'address on file'}`,
                html
              })
            }).then(r => { if (!r.ok) r.text().then(t => console.error('[capture_lead] alert email failed:', r.status, t)); else console.log('[capture_lead] alert email sent to', toList.join(', ')); })
            .catch(e => console.error('[capture_lead] alert email error:', e.message));
          }
        } catch (alertErr) {
          console.warn('[capture_lead] lead alert email error (non-fatal):', alertErr.message);
        }
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
