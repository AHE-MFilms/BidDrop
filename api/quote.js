/**
 * BidDrop Public Quote API — Vercel Serverless Function
 *
 * No authentication required. Used by the homeowner-facing quote page at /q/[slug].
 *
 * Actions:
 *  - GET  ?action=account&slug=tmroofing  → returns public account config (no secrets)
 *  - POST { action:'submit_lead', slug, name, phone, email, address, sqft, total, lat, lon }
 *           → creates pin + estimate in Supabase, fires GHL contact
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
    const action = req.method === 'GET'
      ? req.query.action
      : (req.body?.action);

    // ── GET account config by slug ────────────────────────────────────────────
    if (action === 'account') {
      const slug = (req.query.slug || '').toLowerCase().trim();
      if (!slug) { res.status(400).json({ error: 'slug required' }); return; }

      const r = await sbFetch(`accounts?slug=eq.${encodeURIComponent(slug)}&select=id,company_name,company_phone,company_addr,brand_color,logo_data,headshot,booking_url,diff1,diff2,diff3,diff4,diff5,diff6,ghl_api_key,ghl_location_id,ghl_pipeline_id,ghl_stage_id,cost_architectural,cost_3tab,cost_designer,cost_metal,cost_tearoff,cost_ice_water,cost_felts,cost_dumpster,overhead,margin,financing_enabled,financing_apr,financing_term,financing_down,years_in_business,warranty_years,rep_name,rep_title,active`);
      const rows = await r.json();
      if (!rows || !rows.length) { res.status(404).json({ error: 'Account not found' }); return; }
      const acct = rows[0];
      if (!acct.active) { res.status(403).json({ error: 'Account inactive' }); return; }

      // Return public-safe fields only (no GHL key in response)
      res.json({
        id: acct.id,
        companyName:   acct.company_name  || 'Your Roofing Co',
        companyPhone:  acct.company_phone || '',
        companyAddr:   acct.company_addr  || '',
        brandColor:    acct.brand_color   || '#F25C05',
        logoData:      acct.logo_data     || null,
        headshot:      acct.headshot      || null,
        bookingUrl:    acct.booking_url   || '',
        repName:       acct.rep_name      || '',
        repTitle:      acct.rep_title     || '',
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
        // Pricing config for client-side estimate calc
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
        hasGhl: !!(acct.ghl_api_key),
      });
      return;
    }

    // ── POST submit_lead ──────────────────────────────────────────────────────
    if (action === 'submit_lead') {
      const { slug, name, phone, email, address, sqft, total, lat, lon, mat } = req.body;
      if (!slug || !address) { res.status(400).json({ error: 'slug and address required' }); return; }

      // Look up account
      const acctR = await sbFetch(`accounts?slug=eq.${encodeURIComponent(slug.toLowerCase())}&select=id,ghl_api_key,ghl_location_id,ghl_pipeline_id,ghl_stage_id,company_name`);
      const acctRows = await acctR.json();
      if (!acctRows || !acctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
      const acct = acctRows[0];
      const accountId = acct.id;
      const now = new Date().toISOString();
      const pinId = `web-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

      // Create pin
      const pinPayload = {
        id: pinId,
        account_id: accountId,
        address: address,
        lat: lat || null,
        lon: lon || null,
        status: 'needs_roof',
        rep: name || 'Web Lead',
        at: now,
        notes: `Web lead — submitted via quote page. Name: ${name||''} Phone: ${phone||''} Email: ${email||''}`,
        source: 'web_quote',
      };
      await sbFetch('pins', { method: 'POST', body: JSON.stringify(pinPayload) });

      // Create estimate
      const estId = `est-web-${Date.now()}`;
      const estPayload = {
        id: estId,
        account_id: accountId,
        pin_id: pinId,
        addr: address,
        owner: name || 'Homeowner',
        email: email || null,
        phone: phone || null,
        total: total || 0,
        sqft: sqft || 0,
        mat: mat || '1.3',
        saved_at: now,
        source: 'web_quote',
        structures: JSON.stringify([{
          id: 's1', name: 'Main Roof', sqft: sqft || 0,
          mat: mat || '1.3', pitch: 1.31, complexity: 1.12, stories: 1
        }]),
      };
      await sbFetch('estimates', { method: 'POST', body: JSON.stringify(estPayload) });

      // Fire GHL contact if configured
      let ghlContactId = null;
      if (acct.ghl_api_key && acct.ghl_location_id) {
        try {
          const ghlBody = {
            firstName: (name||'').split(' ')[0] || 'Homeowner',
            lastName:  (name||'').split(' ').slice(1).join(' ') || '',
            email:     email || undefined,
            phone:     phone || undefined,
            address1:  address,
            locationId: acct.ghl_location_id,
            tags: ['web-quote', 'biddrop'],
            customFields: [
              { key: 'roof_sqft',    field_value: String(sqft  || '') },
              { key: 'estimate_total', field_value: total ? `$${Number(total).toLocaleString()}` : '' },
              { key: 'source',       field_value: 'BidDrop Web Quote' },
            ],
          };
          if (acct.ghl_pipeline_id) {
            ghlBody.pipeline = { id: acct.ghl_pipeline_id, stageId: acct.ghl_stage_id || undefined };
          }
          const ghlRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${acct.ghl_api_key}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
            },
            body: JSON.stringify(ghlBody),
          });
          const ghlData = await ghlRes.json();
          ghlContactId = ghlData?.contact?.id || null;
        } catch (ghlErr) {
          console.warn('[quote] GHL push failed:', ghlErr.message);
        }
      }

      res.json({ ok: true, pinId, estId, ghlContactId });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('[quote API]', err);
    res.status(500).json({ error: err.message });
  }
}
