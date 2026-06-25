// api/canvas.js — Canvas Templates CRUD endpoint
// Actions: list, get, save, delete, publish, unpublish, reorder

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

function sbFetch(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=representation',
      ...(opts.headers || {})
    }
  });
}

function uid() {
  return 'ct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  // ── LIST: GET /api/canvas?action=list[&published_only=1] ──────────────────
  if (action === 'list') {
    let url = 'canvas_templates?select=id,name,description,trade,thumbnail_url,is_published,is_locked,editable_fields,sort_order,created_at,updated_at,front_json,back_json&order=sort_order.asc,created_at.asc';
    if (req.query.published_only === '1') url += '&is_published=eq.true';
    const r = await sbFetch(url);
    const data = await r.json();
    return res.status(r.status).json(data);
  }

  // ── GET: GET /api/canvas?action=get&id=ct_xxx ─────────────────────────────
  if (action === 'get') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await sbFetch(`canvas_templates?id=eq.${id}&select=*`);
    const data = await r.json();
    if (!data || !data.length) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(data[0]);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  // ── SAVE: POST /api/canvas { action:'save', template:{...} } ──────────────
  if (action === 'save') {
    const { template } = body;
    if (!template) return res.status(400).json({ error: 'template required' });

    const now = new Date().toISOString();
    const isNew = !template.id;
    const id = template.id || uid();

    const payload = {
      id,
      name: template.name || 'Untitled Template',
      description: template.description || null,
      trade: template.trade || 'roofing',
      front_json: template.front_json || null,
      back_json: template.back_json || null,
      thumbnail_url: template.thumbnail_url || null,
      is_published: template.is_published ?? false,
      is_locked: template.is_locked ?? true,
      editable_fields: template.editable_fields || [],
      sort_order: template.sort_order ?? 0,
      created_by: template.created_by || null,
      updated_at: now,
      ...(isNew ? { created_at: now } : {})
    };

    let r;
    if (isNew) {
      r = await sbFetch('canvas_templates', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } else {
      r = await sbFetch(`canvas_templates?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    }
    const data = await r.json();
    return res.status(r.status).json(Array.isArray(data) ? data[0] : data);
  }

  // ── DELETE: POST /api/canvas?action=delete { id } ────────────────────────
  if (action === 'delete') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await sbFetch(`canvas_templates?id=eq.${id}`, { method: 'DELETE' });
    return res.status(r.status).json({ ok: r.ok });
  }

  // ── PUBLISH / UNPUBLISH ───────────────────────────────────────────────────
  if (action === 'publish' || action === 'unpublish') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const r = await sbFetch(`canvas_templates?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_published: action === 'publish', updated_at: new Date().toISOString() })
    });
    const data = await r.json();
    return res.status(r.status).json(Array.isArray(data) ? data[0] : data);
  }

  // ── REORDER: POST /api/canvas?action=reorder { ids: ['ct_a','ct_b',...] } ─
  if (action === 'reorder') {
    const { ids } = body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    const results = [];
    for (let i = 0; i < ids.length; i++) {
      const r = await sbFetch(`canvas_templates?id=eq.${ids[i]}`, {
        method: 'PATCH',
        body: JSON.stringify({ sort_order: i, updated_at: new Date().toISOString() })
      });
      results.push({ id: ids[i], status: r.status });
    }
    return res.status(200).json({ results });
  }

  // ── SEED: POST /api/canvas?action=seed (super admin only — inserts default templates) ──
  if (action === 'seed') {
    const { templates } = body;
    // Verify caller is super_admin by looking up their profile in the DB
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer /i, '');
    if (!token) return res.status(403).json({ error: 'forbidden: no token' });
    // Get user ID from JWT
    const verifyResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!verifyResp.ok) return res.status(403).json({ error: 'forbidden: invalid token' });
    const verifyData = await verifyResp.json();
    const userId = verifyData?.id;
    if (!userId) return res.status(403).json({ error: 'forbidden: could not identify user' });
    // Look up role in profiles table (role is stored there, not in JWT metadata)
    const profileResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role&limit=1`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    const profiles = profileResp.ok ? await profileResp.json() : [];
    const role = profiles[0]?.role || '';
    if (role !== 'super_admin') return res.status(403).json({ error: 'forbidden: super_admin only' });
    if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates array required' });
    const inserted = [];
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const row = {
        id: uid(),
        name: t.name || 'Untitled',
        description: t.description || '',
        trade: t.trade || 'roofing',
        front_json: t.front_json || null,
        back_json: t.back_json || null,
        thumbnail_url: t.thumbnail_url || null,
        is_published: t.published !== false,
        is_locked: true,
        editable_fields: t.editable_fields || [],
        sort_order: i,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const r = await sbFetch('canvas_templates', {
        method: 'POST',
        body: JSON.stringify(row),
      });
      const data = await r.json();
      inserted.push(Array.isArray(data) ? data[0] : data);
    }
    return res.status(200).json({ inserted: inserted.length, templates: inserted });
  }

  return res.status(400).json({ error: 'unknown action' });
}
