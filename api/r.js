/**
 * BidDrop QR Code Redirect + Tracking
 * Route: /r/:id  (rewritten from vercel.json)
 *
 * Logs the scan to the postcard_scans table, then redirects to the booking URL.
 * No auth required — this is a public endpoint hit by homeowners scanning the postcard.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
    ...opts.headers
  };
  return fetch(url, { ...opts, headers });
}

export default async function handler(req, res) {
  // Extract the queue item ID from the URL path (/r/q1234567890)
  const id = req.url.split('/r/')[1]?.split('?')[0]?.trim();

  if (!id) {
    res.status(400).send('Missing ID');
    return;
  }

  // Look up the queue item to get the booking URL and account info
  let bookingUrl = null;
  let accountId  = null;
  let ownerName  = null;
  let addr       = null;

  try {
    const r = await sbFetch(`queue?id=eq.${encodeURIComponent(id)}&select=id,addr,owner,account_id`);
    if (r.ok) {
      const rows = await r.json();
      if (rows && rows[0]) {
        accountId = rows[0].account_id;
        ownerName = rows[0].owner;
        addr      = rows[0].addr;
      }
    }
  } catch (e) {
    console.error('[r] queue lookup error:', e);
  }

  // Get the booking URL from the account config
  if (accountId) {
    try {
      const r = await sbFetch(`accounts?id=eq.${encodeURIComponent(accountId)}&select=booking_url`);
      if (r.ok) {
        const rows = await r.json();
        if (rows && rows[0]) bookingUrl = rows[0].booking_url;
      }
    } catch (e) {
      console.error('[r] account lookup error:', e);
    }
  }

  // Log the scan
  try {
    await sbFetch('postcard_scans', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        queue_item_id: id,
        account_id:    accountId,
        owner_name:    ownerName,
        address:       addr,
        scanned_at:    new Date().toISOString(),
        ip:            req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        user_agent:    req.headers['user-agent'] || null
      })
    });
  } catch (e) {
    console.error('[r] scan log error:', e);
  }

  // Redirect to booking URL or a fallback
  const dest = bookingUrl || 'https://biddrop.americashomeexperts.com';
  res.setHeader('Location', dest);
  res.status(302).end();
}
