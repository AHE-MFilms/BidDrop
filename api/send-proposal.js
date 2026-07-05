/**
 * BidDrop — Send Proposal Email
 * Route: POST /api/send-proposal
 *
 * Sends a polished HTML proposal to the homeowner via Resend.
 * Body: { to, subject, html, ownerName, accountId }
 *
 * Auth: requires a valid Supabase JWT in Authorization: Bearer <token>
 */
const RESEND_KEY    = process.env.RESEND_API_KEY;
const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // ── Auth guard: require valid Supabase JWT ────────────────────────────────
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const verifyR = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!verifyR.ok) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { to, subject, html, ownerName } = req.body || {};

  if (!to || !html) {
    res.status(400).json({ error: 'Missing required fields: to, html' });
    return;
  }

  if (!RESEND_KEY) {
    res.status(500).json({ error: 'Resend API key not configured' });
    return;
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'BidDrop Proposals <proposals@biddrop.us>',
        to: [to],
        subject: subject || `Your Roofing Proposal from BidDrop`,
        html
      })
    });

    const data = await r.json();

    if (!r.ok) {
      console.error('[send-proposal] Resend error:', data);
      res.status(r.status).json({ error: data.message || 'Resend error', details: data });
      return;
    }

    res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('[send-proposal] Exception:', e);
    res.status(500).json({ error: e.message });
  }
}
