/**
 * One-time migration endpoint — DELETE AFTER USE
 * Adds missing columns to estimates and accounts tables
 * Call: GET /api/migrate?token=biddrop-migrate-2026
 */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Security check - require a secret token
  const token = req.query.token || req.headers['x-migrate-token'];
  if (token !== 'biddrop-migrate-2026') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const results = [];

  // Step 1: Create the run_ddl helper function via the Supabase pg endpoint
  const createFnSql = `CREATE OR REPLACE FUNCTION public.run_ddl(ddl text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN EXECUTE ddl; END; $$;`;
  try {
    const r = await fetch(`${SUPABASE_URL}/pg`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: createFnSql })
    });
    results.push({ step: 'create_run_ddl', status: r.status, body: (await r.text()).substring(0, 100) });
  } catch (e) {
    results.push({ step: 'create_run_ddl', error: e.message });
  }

  const migrations = [
    {
      name: 'estimates.ice_water_shield',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='estimates' AND column_name='ice_water_shield'",
      sql: "ALTER TABLE estimates ADD COLUMN IF NOT EXISTS ice_water_shield boolean DEFAULT false"
    },
    {
      name: 'accounts.rep_video_url_default',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='rep_video_url_default'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS rep_video_url_default text"
    },
    {
      name: 'accounts.offer_solar',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='offer_solar'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS offer_solar boolean DEFAULT false"
    },
    {
      name: 'accounts.cost_solar_per_watt',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='cost_solar_per_watt'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS cost_solar_per_watt numeric DEFAULT 3.50"
    },
    {
      name: 'accounts.tax_rate',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='tax_rate'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tax_rate numeric DEFAULT 0"
    },
    {
      name: 'accounts.jobber_api_key',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='jobber_api_key'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS jobber_api_key text"
    },
    {
      name: 'accounts.webhook_url',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='webhook_url'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS webhook_url text"
    },
    {
      name: 'accounts.enabled_trades',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='enabled_trades'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS enabled_trades text[] DEFAULT ARRAY['roofing']"
    },
    {
      name: 'pins.equity_data',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='pins' AND column_name='equity_data'",
      sql: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS equity_data jsonb"
    },
    {
      name: 'pins.campaign_target',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='pins' AND column_name='campaign_target'",
      sql: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS campaign_target boolean DEFAULT false"
    },
    {
      name: 'pins.campaign_id',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='pins' AND column_name='campaign_id'",
      sql: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS campaign_id text"
    },
    {
      name: 'accounts.drip_steps_json',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='drip_steps_json'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip_steps_json jsonb"
    },
    {
      name: 'accounts.postcard_designs_json',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='postcard_designs_json'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_designs_json jsonb"
    },
    {
      name: 'estimates.signed_at',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='estimates' AND column_name='signed_at'",
      sql: "ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signed_at timestamptz"
    },
    {
      name: 'estimates.sig_name',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='estimates' AND column_name='sig_name'",
      sql: "ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sig_name text"
    },
    {
      name: 'accounts.drip_enabled',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='drip_enabled'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip_enabled boolean DEFAULT false"
    },
    {
      name: 'accounts.company_bio',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='company_bio'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS company_bio text"
    },
    {
      name: 'accounts.jn_api_key',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='jn_api_key'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS jn_api_key text"
    },
    {
      name: 'accounts.jn_record_type',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='jn_record_type'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS jn_record_type text"
    },
    {
      name: 'accounts.jn_status',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='jn_status'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS jn_status text"
    },
    // ── Build 10: Trade system + QB/CompanyCam + solar overlay ──
    {
      name: 'accounts.trade_pricing_json',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='trade_pricing_json'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trade_pricing_json jsonb"
    },
    {
      name: 'accounts.trade_statuses_json',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='trade_statuses_json'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trade_statuses_json jsonb"
    },
    {
      name: 'accounts.trade_postcard_copy_json',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='trade_postcard_copy_json'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trade_postcard_copy_json jsonb"
    },
    {
      name: 'accounts.companycam_key',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='companycam_key'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS companycam_key text"
    },
    {
      name: 'accounts.qb_access_token',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='qb_access_token'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS qb_access_token text"
    },
    {
      name: 'accounts.qb_refresh_token',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='qb_refresh_token'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS qb_refresh_token text"
    },
    {
      name: 'accounts.qb_realm_id',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='qb_realm_id'",
      sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS qb_realm_id text"
    },
    {
      name: 'pins.ghl_synced_at',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='pins' AND column_name='ghl_synced_at'",
      sql: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS ghl_synced_at timestamptz"
    },
    {
      name: 'pins.ghl_sync_error',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='pins' AND column_name='ghl_sync_error'",
      sql: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS ghl_sync_error text"
    },
    {
      name: 'pins.solar_kw',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='pins' AND column_name='solar_kw'",
      sql: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS solar_kw numeric"
    },
    {
      name: 'pins.solar_potential',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='pins' AND column_name='solar_potential'",
      sql: "ALTER TABLE pins ADD COLUMN IF NOT EXISTS solar_potential text"
    },
    {
      name: 'estimates.qb_invoice_id',
      check: "SELECT column_name FROM information_schema.columns WHERE table_name='estimates' AND column_name='qb_invoice_id'",
      sql: "ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qb_invoice_id text"
    },
    // ── Build 11: Postcard template designer fields ──
    { name: 'accounts.tpl_headline1',   sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_headline1 text" },
    { name: 'accounts.tpl_headline2',   sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_headline2 text" },
    { name: 'accounts.tpl_subhead',     sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_subhead text" },
    { name: 'accounts.tpl_bullet1',     sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_bullet1 text" },
    { name: 'accounts.tpl_bullet2',     sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_bullet2 text" },
    { name: 'accounts.tpl_bullet3',     sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_bullet3 text" },
    { name: 'accounts.tpl_cta_label',   sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_cta_label text" },
    { name: 'accounts.tpl_accent_color',sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_accent_color text" },
    { name: 'accounts.tpl_hero_url',    sql: "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tpl_hero_url text" },
    {
      name: 'campaign_targets_table',
      check: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='campaign_targets'",
      sql: `CREATE TABLE IF NOT EXISTS campaign_targets (
        id text PRIMARY KEY,
        account_id text NOT NULL,
        source_pin_id text,
        source_address text,
        campaign_date timestamptz DEFAULT now(),
        rep_email text,
        pin_ids text[],
        home_count integer DEFAULT 0,
        postcards_sent integer DEFAULT 0,
        ghl_pushed integer DEFAULT 0,
        status text DEFAULT 'active',
        created_at timestamptz DEFAULT now()
      )`
    },
  ];

  // Try to run DDL via rpc/exec_sql
  for (const m of migrations) {
    try {
      const r = await sbFetch('rpc/exec_sql', {
        method: 'POST',
        body: JSON.stringify({ sql: m.sql })
      });
      const body = await r.text();
      results.push({ name: m.name, status: r.status, body: body.substring(0, 100) });
    } catch (e) {
      results.push({ name: m.name, error: e.message });
    }
  }

  // Step 3: Verify columns/tables exist
  const checks = [];
  for (const m of migrations) {
    const parts = m.name.split('.');
    const table = parts[0];
    const col = parts[1] || null;
    try {
      // For table-level migrations (no column), check the table directly
      const selectField = col || 'id';
      const r = await sbFetch(`${table}?select=${selectField}&limit=1`);
      checks.push({ name: m.name, exists: r.status === 200, status: r.status });
    } catch (e) {
      checks.push({ name: m.name, exists: false, error: e.message });
    }
  }

  res.status(200).json({ results, checks, serviceKeyPresent: !!SERVICE_KEY });
}
