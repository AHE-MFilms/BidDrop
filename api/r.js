/**
 * BidDrop QR Code Redirect + Tracking
 * Route: /r/:id  (rewritten from vercel.json)
 *
 * Logs the scan to the postcard_scans table, then redirects to:
 *   1. /e/[estimate-id]  — if an estimate exists for this address (personalized estimate page)
 *   2. booking URL       — if no estimate but booking URL is set
 *   3. fallback homepage — otherwise
 *
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

  // Look up the queue item to get the address and account info
  let bookingUrl = null;
  let accountId  = null;
  let ownerName  = null;
  let addr       = null;
  let estimateId = null;

  try {
    const r = await sbFetch(`queue?id=eq.${encodeURIComponent(id)}&select=id,addr,owner,account_id,estimate_id`);
    if (r.ok) {
      const rows = await r.json();
      if (rows && rows[0]) {
        accountId  = rows[0].account_id;
        ownerName  = rows[0].owner;
        addr       = rows[0].addr;
        estimateId = rows[0].estimate_id || null;
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

    // If no estimate_id on the queue item, look up the most recent estimate for this address
    if (!estimateId && addr) {
      try {
        const r = await sbFetch(`estimates?account_id=eq.${encodeURIComponent(accountId)}&addr=eq.${encodeURIComponent(addr)}&select=id&order=saved_at.desc&limit=1`);
        if (r.ok) {
          const rows = await r.json();
          if (rows && rows[0]) estimateId = rows[0].id;
        }
      } catch (e) {
        console.error('[r] estimate lookup error:', e);
      }
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
        estimate_id:   estimateId || null,
        scanned_at:    new Date().toISOString(),
        ip:            req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        user_agent:    req.headers['user-agent'] || null
      })
    });
  } catch (e) {
    console.error('[r] scan log error:', e);
  }

  // Redirect priority:
  //   1. Personalized estimate page /e/[id]
  //   2. Booking URL (Calendly, etc.)
  //   3. Fallback homepage
  let dest;
  if (estimateId) {
    dest = `https://biddrop.americashomeexperts.com/e/${estimateId}`;
  } else if (bookingUrl) {
    dest = bookingUrl;
  } else {
    dest = 'https://biddrop.americashomeexperts.com';
  }

  res.setHeader('Location', dest);
  res.status(302).end();
}
