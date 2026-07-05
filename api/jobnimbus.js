/**
 * BidDrop JobNimbus Proxy — Vercel Serverless Function
 *
 * Proxies calls to the JobNimbus API so the API key stays server-side.
 * Uses the JobNimbus legacy REST API: https://app.jobnimbus.com/api1
 *
 * POST /api/jobnimbus
 *   headers: Authorization: Bearer <supabase_jwt>
 *   body: { action, apiKey, ...params }
 *
 * Actions:
 *   create_contact  — POST /contacts
 *   update_contact  — PUT  /contacts/:jnid
 *   get_contact     — GET  /contacts/:jnid
 *   test_connection — GET  /contacts?size=1
 *
 * Required contact fields for POST:
 *   - first_name OR last_name OR display_name OR company (at least one)
 *   - record_type_name (workflow name, e.g. "Customer")
 *   - status_name (status within workflow, e.g. "Lead")
 *
 * Optional fields: address_line1, city, state_text, zip, phone (array), email (array),
 *                  source_name, tags, geo { lat, lon }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const JN_BASE      = 'https://app.jobnimbus.com/api1';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // ── Auth guard: require valid Supabase JWT ────────────────────────────────
  const jnToken = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!jnToken) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const jnVerify = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${jnToken}` }
  });
  if (!jnVerify.ok) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { action, apiKey, jnid, contactBody } = req.body || {};

  if (!apiKey) {
    res.status(400).json({ error: 'apiKey is required' });
    return;
  }

  const headers = {
    'Authorization': `bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    let jnRes, jnData;

    if (action === 'create_contact') {
      // POST /contacts — create a new contact
      if (!contactBody) {
        res.status(400).json({ error: 'contactBody is required for create_contact' });
        return;
      }
      jnRes = await fetch(`${JN_BASE}/contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(contactBody),
      });
      jnData = await jnRes.json();
      if (!jnRes.ok) {
        console.error('[JN proxy] create_contact failed:', jnRes.status, JSON.stringify(jnData));
        res.status(jnRes.status).json({ error: jnData?.message || jnData?.error || 'JobNimbus API error', raw: jnData });
        return;
      }
      res.status(200).json({ ok: true, contact: jnData });
      return;
    }

    if (action === 'update_contact') {
      // PUT /contacts/:jnid — update an existing contact
      if (!jnid) {
        res.status(400).json({ error: 'jnid is required for update_contact' });
        return;
      }
      if (!contactBody) {
        res.status(400).json({ error: 'contactBody is required for update_contact' });
        return;
      }
      jnRes = await fetch(`${JN_BASE}/contacts/${jnid}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(contactBody),
      });
      jnData = await jnRes.json();
      if (!jnRes.ok) {
        console.error('[JN proxy] update_contact failed:', jnRes.status, JSON.stringify(jnData));
        res.status(jnRes.status).json({ error: jnData?.message || jnData?.error || 'JobNimbus API error', raw: jnData });
        return;
      }
      res.status(200).json({ ok: true, contact: jnData });
      return;
    }

    if (action === 'get_contact') {
      // GET /contacts/:jnid — retrieve a contact
      if (!jnid) {
        res.status(400).json({ error: 'jnid is required for get_contact' });
        return;
      }
      jnRes = await fetch(`${JN_BASE}/contacts/${jnid}`, {
        method: 'GET',
        headers,
      });
      jnData = await jnRes.json();
      if (!jnRes.ok) {
        res.status(jnRes.status).json({ error: jnData?.message || jnData?.error || 'JobNimbus API error', raw: jnData });
        return;
      }
      res.status(200).json({ ok: true, contact: jnData });
      return;
    }

    if (action === 'test_connection') {
      // GET /contacts?count=1 — test that the API key works
      jnRes = await fetch(`${JN_BASE}/contacts?size=1`, {
        method: 'GET',
        headers,
      });
      jnData = await jnRes.json();
      if (!jnRes.ok) {
        res.status(jnRes.status).json({ ok: false, error: jnData?.message || jnData?.error || 'JobNimbus API error' });
        return;
      }
      res.status(200).json({ ok: true, message: 'JobNimbus connection successful', count: jnData?.count });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[JN proxy] error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
