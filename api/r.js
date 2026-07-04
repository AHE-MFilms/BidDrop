/**
 * BidDrop QR Code Redirect + Tracking
 * Route: /r/:id  (rewritten from vercel.json)
 *
 * Logs the scan to the postcard_scans table, then redirects to:
 *   1. /e/[estimate-id]  — if an estimate exists for this address (personalized estimate page)
 *   2. booking URL       — if no estimate but booking URL is set
 *   3. fallback homepage — otherwise
 *
 * Also sends a real-time notification email to the roofer (account owner) with
 * the homeowner's name, address, and email so they can follow up immediately.
 *
 * No auth required — this is a public endpoint hit by homeowners scanning the postcard.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;

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

async function sendScanNotification({ toEmail, repName, ownerName, ownerEmail, addr, estimateId, companySlug, scanTime }) {
  if (!RESEND_KEY || !toEmail) return;

  const estimateLink = estimateId
    ? `https://biddrop.us/${companySlug}/${estimateId}`
    : null;

  const scanTimeFormatted = new Date(scanTime).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });

  const homeownerLine = ownerName ? `<strong>${ownerName}</strong>` : 'A homeowner';
  const emailLine = ownerEmail
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Email</td><td style="padding:6px 0;font-size:14px;">${ownerEmail}</td></tr>`
    : '';
  const estimateLine = estimateLink
    ? `<p style="margin:20px 0 0;"><a href="${estimateLink}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">View Their Estimate →</a></p>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:#111827;padding:24px 32px;">
          <p style="margin:0;color:#f97316;font-size:20px;font-weight:700;letter-spacing:-0.3px;">BidDrop</p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">Postcard Scan Alert</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">🔔 Someone scanned your postcard!</p>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">${homeownerLine} just scanned your QR code at <strong>${scanTimeFormatted}</strong>. They're looking at their estimate right now — reach out while you're top of mind.</p>

          <!-- Homeowner details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            <tr><td colspan="2" style="padding:0 0 10px;font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Homeowner Info</td></tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:14px;width:80px;">Name</td>
              <td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${ownerName || '—'}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:14px;">Address</td>
              <td style="padding:6px 0;font-size:14px;color:#111827;">${addr || '—'}</td>
            </tr>
            ${emailLine}
          </table>

          ${estimateLine}

          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">This notification was sent because a homeowner scanned a BidDrop postcard QR code linked to your account.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">BidDrop · <a href="https://biddrop.us" style="color:#9ca3af;">biddrop.us</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'BidDrop Alerts <alerts@biddrop.io>',
        to: [toEmail],
        subject: `🔔 ${ownerName || 'A homeowner'} scanned your postcard — ${addr || 'address on file'}`,
        html
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('[r] scan notification email failed:', resp.status, err);
    } else {
      console.log('[r] scan notification sent to', toEmail);
    }
  } catch (e) {
    console.error('[r] scan notification email error:', e.message);
  }
}

export default async function handler(req, res) {
  // Extract the queue item ID from the URL path (/r/q1234567890)
  const id = req.url.split('/r/')[1]?.split('?')[0]?.trim();

  if (!id) {
    res.status(400).send('Missing ID');
    return;
  }

  // Look up the queue item to get the address, homeowner info, and account info
  let bookingUrl    = null;
  let accountId     = null;
  let ownerName     = null;
  let ownerEmail    = null;
  let addr          = null;
  let estimateId    = null;

  try {
    const r = await sbFetch(`queue?id=eq.${encodeURIComponent(id)}&select=id,addr,owner,email,account_id,estimate_id`);
    if (r.ok) {
      const rows = await r.json();
      if (rows && rows[0]) {
        accountId  = rows[0].account_id;
        ownerName  = rows[0].owner;
        ownerEmail = rows[0].email || null;
        addr       = rows[0].addr;
        estimateId = rows[0].estimate_id || null;
      }
    }
  } catch (e) {
    console.error('[r] queue lookup error:', e);
  }

  // Get the booking URL, company name, and account owner email from the account config
  let companySlug  = 'roofing';
  let accountEmail = null;
  let repName      = null;

  if (accountId) {
    try {
      const r = await sbFetch(`accounts?id=eq.${encodeURIComponent(accountId)}&select=booking_url,company_name,email,rep_name`);
      if (r.ok) {
        const rows = await r.json();
        if (rows && rows[0]) {
          bookingUrl   = rows[0].booking_url;
          accountEmail = rows[0].email || null;
          repName      = rows[0].rep_name || null;
          if (rows[0].company_name) {
            companySlug = rows[0].company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'roofing';
          }
        }
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
  const now = new Date().toISOString();
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
        scanned_at:    now,
        ip:            req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        user_agent:    req.headers['user-agent'] || null
      })
    });
  } catch (e) {
    console.error('[r] scan log error:', e);
  }

  // Update qr_scan_count on the estimate and insert into scan_events
  if (estimateId) {
    try {
      const curR = await sbFetch(`estimates?id=eq.${encodeURIComponent(estimateId)}&select=qr_scan_count,qr_first_scanned_at`);
      if (curR.ok) {
        const curRows = await curR.json();
        const cur = (curRows && curRows[0]) || {};
        const updates = { qr_scan_count: (cur.qr_scan_count || 0) + 1, qr_last_scanned_at: now };
        if (!cur.qr_first_scanned_at) updates.qr_first_scanned_at = now;
        await sbFetch(`estimates?id=eq.${encodeURIComponent(estimateId)}`, {
          method: 'PATCH', body: JSON.stringify(updates), headers: { 'Prefer': 'return=minimal' }
        });
        await sbFetch('scan_events', {
          method: 'POST',
          body: JSON.stringify({ estimate_id: estimateId, account_id: accountId || null, source: 'qr_postcard', user_agent: (req.headers['user-agent'] || '').substring(0, 300) }),
          headers: { 'Prefer': 'return=minimal' }
        });
      }
    } catch (e) {
      console.error('[r] estimate scan update error:', e);
    }
  }

  // Send real-time notification email to the roofer (fire-and-forget, non-blocking)
  if (accountEmail) {
    sendScanNotification({
      toEmail:    accountEmail,
      repName,
      ownerName,
      ownerEmail,
      addr,
      estimateId,
      companySlug,
      scanTime:   now
    }).catch(e => console.error('[r] sendScanNotification unhandled:', e));
  }

  // Redirect priority:
  //   1. Personalized estimate page on biddrop.us/[company-slug]/[id]?src=qr
  //   2. Booking URL (Calendly, etc.)
  //   3. Fallback homepage
  let dest;
  if (estimateId) {
    dest = `https://biddrop.us/${companySlug}/${estimateId}?src=qr`;
  } else if (bookingUrl) {
    dest = bookingUrl;
  } else {
    dest = 'https://biddrop.us';
  }

  res.setHeader('Location', dest);
  res.status(302).end();
}
