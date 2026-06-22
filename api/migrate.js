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
