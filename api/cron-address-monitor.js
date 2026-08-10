/**
 * BidDrop Address Monitor Cron
 * Runs every 15 minutes via Vercel cron
 * Checks MRMS hail data for each watched address
 * Sends email alert within 15 minutes of hail detection
 *
 * GET /api/cron-address-monitor (called by Vercel cron)
 * Monthly + Omnipresent plans only
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

async function supabaseFetch(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      ...(opts.headers || {})
    }
  });
  if (r.status === 204 || r.headers.get('content-length') === '0') return null;
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Haversine distance in miles
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buildAddressAlertEmail({ address, label, hailSize, hailDate, company, appUrl }) {
  const lbl = hailSize >= 2.75 ? 'Baseball+ 🔴' : hailSize >= 1.75 ? 'Baseball 🟠' : hailSize >= 1.0 ? 'Golf Ball 🟡' : 'Quarter 🔵';
  const displayAddr = label ? `${label} — ${address}` : address;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#111827;padding:20px 24px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
      <td style="font-size:32px;width:48px;">📍</td>
      <td>
        <div style="font-size:16px;font-weight:800;color:#818cf8;">ADDRESS HAIL ALERT</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:2px;">${company} · BidDrop Address Monitoring</div>
      </td>
    </tr></table>
  </div>

  <!-- Body -->
  <div style="padding:20px 24px;">
    <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 6px;">
      Hail detected at a monitored address!
    </p>
    <p style="font-size:13px;color:#374151;margin:0 0 16px;line-height:1.6;background:#f3f4f6;border-radius:8px;padding:10px 14px;">
      📍 <b>${displayAddr}</b>
    </p>

    <!-- Stats table -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#fef3c7;border-radius:8px;padding:14px 8px;text-align:center;width:48%;">
          <div style="font-size:26px;font-weight:800;color:#d97706;line-height:1.2;">${hailSize.toFixed(2)}"</div>
          <div style="font-size:10px;font-weight:700;color:#92400e;letter-spacing:.06em;margin-top:4px;">HAIL SIZE</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#ede9fe;border-radius:8px;padding:14px 8px;text-align:center;width:48%;">
          <div style="font-size:18px;font-weight:800;color:#7c3aed;line-height:1.2;">${lbl.split(' ')[0]}</div>
          <div style="font-size:10px;font-weight:700;color:#5b21b6;letter-spacing:.06em;margin-top:4px;">CATEGORY</div>
        </td>
      </tr>
    </table>

    <p style="font-size:12px;color:#6b7280;margin:0 0 20px;line-height:1.6;">
      NOAA MRMS radar confirmed <b>${lbl}</b> hail at this address on <b>${hailDate}</b>. 
      Be the first to call — open BidDrop to view the storm map and get leads.
    </p>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${appUrl}" style="display:inline-block;background:#818cf8;color:#fff;text-decoration:none;border-radius:8px;padding:13px 28px;font-size:14px;font-weight:700;">
        📍 Open BidDrop → View Storm Map
      </a>
    </div>

    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">
      Open BidDrop → Storm Intelligence → ② MAP → pick ${hailDate} to see the full hail swath.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:14px 24px;text-align:center;border-top:1px solid #e5e7eb;">
    <div style="font-size:11px;color:#9ca3af;">
      You're receiving this because address monitoring is enabled for ${company}.
      <a href="${appUrl}" style="color:#818cf8;text-decoration:none;">Manage in BidDrop Storm Intelligence</a>
    </div>
  </div>

</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  // Verify cron secret
  if (!CRON_SECRET) { return res.status(500).json({ error: 'CRON_SECRET not configured' }); }
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const querySecret = req.query.secret || '';
  if (token !== CRON_SECRET && querySecret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Get today's date (MRMS data is for today)
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  // Also check yesterday in case cron runs early
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  console.log(`[addr-monitor] Running for ${todayStr}`);

  // Get all active watched addresses (only for monthly/omnipresent accounts)
  const watched = await supabaseFetch(
    `watched_addresses?alert_enabled=eq.true&select=id,account_id,address,label,lat,lon,min_hail_size,last_alert_sent_at,last_hail_date`
  );

  if (!watched || !watched.length) {
    return res.status(200).json({ message: 'No active watched addresses', date: todayStr });
  }

  console.log(`[addr-monitor] Checking ${watched.length} watched addresses`);

  // Get recent MRMS hail events (today + yesterday)
  const hailRows = await supabaseFetch(
    `mrms_hail_events?event_date=in.(${todayStr},${yesterdayStr})&select=lat,lon,hail_size_in,event_date&limit=10000`
  );

  if (!hailRows || !hailRows.length) {
    return res.status(200).json({ message: `No MRMS hail data for ${todayStr}/${yesterdayStr}`, date: todayStr });
  }

  const results = [];
  const now = new Date();

  for (const wa of watched) {
    // Skip if we already sent an alert for this address today
    if (wa.last_hail_date === todayStr || wa.last_hail_date === yesterdayStr) {
      // Check if last alert was within the last 24 hours
      if (wa.last_alert_sent_at) {
        const lastSent = new Date(wa.last_alert_sent_at);
        const hoursSince = (now - lastSent) / (1000 * 60 * 60);
        if (hoursSince < 20) {
          results.push({ address: wa.address, skipped: true, reason: 'already alerted today' });
          continue;
        }
      }
    }

    const minSize = parseFloat(wa.min_hail_size || 1.0);
    const searchRadius = 0.5; // ~0.5 degree = ~35 miles, but we want tight — use 0.05 deg (~3 miles)

    // Find hail events within ~3 miles of this address
    const nearby = hailRows.filter(e => {
      if (e.hail_size_in < minSize) return false;
      return distanceMiles(wa.lat, wa.lon, e.lat, e.lon) <= 3;
    });

    if (!nearby.length) {
      results.push({ address: wa.address, hits: 0, sent: false });
      continue;
    }

    const maxHail = Math.max(...nearby.map(e => e.hail_size_in));
    const hailDate = nearby[0].event_date;

    // Get account info and admin emails
    const accountRows = await supabaseFetch(
      `accounts?id=eq.${wa.account_id}&select=id,name,plan`
    );
    const account = accountRows?.[0];

    // Only send for monthly/omnipresent plans
    if (!account || !['monthly', 'omnipresent'].includes(account.plan)) {
      results.push({ address: wa.address, skipped: true, reason: `plan: ${account?.plan || 'unknown'}` });
      continue;
    }

    const admins = await supabaseFetch(
      `user_profiles?account_id=eq.${wa.account_id}&role=in.(admin,owner)&select=email`
    );
    const emails = (admins || []).map(a => a.email).filter(Boolean);

    if (!emails.length) {
      results.push({ address: wa.address, hits: nearby.length, sent: false, reason: 'no admin email' });
      continue;
    }

    const html = buildAddressAlertEmail({
      address: wa.address,
      label: wa.label,
      hailSize: maxHail,
      hailDate,
      company: account.name || 'Your Company',
      appUrl: 'https://biddrop.us'
    });

    const subject = `📍 Hail Alert: ${maxHail.toFixed(2)}" hail at ${wa.label || wa.address.split(',')[0]}`;

    try {
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'BidDrop Address Monitor <support@biddrop.io>', to: emails, subject, html })
      });
      if (!resendResp.ok) throw new Error(`Resend error: ${resendResp.status}`);

      // Update last alert info
      await supabaseFetch(`watched_addresses?id=eq.${wa.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          last_alert_sent_at: now.toISOString(),
          last_hail_date: hailDate,
          last_hail_size: maxHail
        })
      });

      results.push({ address: wa.address, hits: nearby.length, sent: true, emails, max_hail: maxHail });
      console.log(`[addr-monitor] Alert sent: ${wa.address} → ${emails.join(', ')} (${maxHail.toFixed(2)}")`);
    } catch(e) {
      results.push({ address: wa.address, hits: nearby.length, sent: false, error: e.message });
    }
  }

  return res.status(200).json({
    date: todayStr,
    watched_count: watched.length,
    hail_events_checked: hailRows.length,
    results
  });
}
