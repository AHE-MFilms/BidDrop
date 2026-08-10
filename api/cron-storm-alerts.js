/**
 * BidDrop Storm Alerts Cron
 * Runs daily at 10:00 UTC (6 AM EDT) — after MRMS ingest at 9:00 UTC
 * Checks each account's storm territory for new hail events yesterday
 * Sends email alert to account admin(s) if hail >= their min_size threshold
 *
 * GET /api/cron-storm-alerts (called by Vercel cron)
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

// Check if a lat/lon point is inside a territory definition
// territory: { type: 'radius', lat, lon, miles } | { type: 'zips', zips: [...] } | { type: 'bbox', north, south, east, west }
function pointInTerritory(lat, lon, territory) {
  if (!territory) return false;
  if (territory.type === 'radius') {
    const R = 3958.8;
    const dLat = (lat - territory.lat) * Math.PI / 180;
    const dLon = (lon - territory.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(territory.lat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return dist <= (territory.miles || 50);
  }
  if (territory.type === 'bbox') {
    return lat >= territory.south && lat <= territory.north && lon >= territory.west && lon <= territory.east;
  }
  // Default: use a 50-mile radius around territory center if no type
  if (territory.lat && territory.lon) {
    const R = 3958.8;
    const dLat = (lat - territory.lat) * Math.PI / 180;
    const dLon = (lon - territory.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(territory.lat*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin(dLon/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return dist <= 50;
  }
  return false;
}

function buildAlertEmail({ account, hailEvents, territory, date }) {
  const company = account.name || 'Your Company';
  const maxHail = Math.max(...hailEvents.map(e => e.hail_size_in));
  const lbl = maxHail >= 2.75 ? 'Baseball+ 🔴' : maxHail >= 1.75 ? 'Baseball 🟠' : maxHail >= 1.0 ? 'Golf Ball 🟡' : 'Quarter 🔵';
  const territoryLabel = territory?.label || territory?.city || 'your territory';
  const appUrl = 'https://biddrop.us';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Alert header -->
  <div style="background:#111827;padding:20px 24px;display:flex;align-items:center;gap:14px;">
    <div style="font-size:32px;">⚡</div>
    <div>
      <div style="font-size:16px;font-weight:800;color:#F25C05;">HAIL ALERT — ${date}</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:2px;">${company} · BidDrop Storm Intelligence</div>
    </div>
  </div>

  <!-- Summary -->
  <div style="padding:20px 24px;">
    <p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 8px;">
      Hail detected in ${territoryLabel} yesterday.
    </p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;line-height:1.6;">
      NOAA MRMS radar confirmed <b>${hailEvents.length} hail impact${hailEvents.length !== 1 ? 's' : ''}</b> in your territory on ${date}. 
      Max hail size: <b style="color:#F25C05;">${maxHail.toFixed(2)}" (${lbl})</b>
    </p>

    <!-- Stats row -->
    <!-- Stats row (table layout for email client compatibility) -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td style="background:#fef3c7;border-radius:8px;padding:14px 8px;text-align:center;width:33%;">
          <div style="font-size:22px;font-weight:800;color:#d97706;line-height:1.2;">${maxHail.toFixed(2)}"</div>
          <div style="font-size:10px;font-weight:700;color:#92400e;letter-spacing:.06em;margin-top:4px;">MAX HAIL</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#fee2e2;border-radius:8px;padding:14px 8px;text-align:center;width:33%;">
          <div style="font-size:22px;font-weight:800;color:#dc2626;line-height:1.2;">${hailEvents.length.toLocaleString()}</div>
          <div style="font-size:10px;font-weight:700;color:#991b1b;letter-spacing:.06em;margin-top:4px;">IMPACTS</div>
        </td>
        <td style="width:8px;"></td>
        <td style="background:#dbeafe;border-radius:8px;padding:14px 8px;text-align:center;width:33%;">
          <div style="font-size:22px;font-weight:800;color:#1d4ed8;line-height:1.2;">${lbl.split(' ')[0]}</div>
          <div style="font-size:10px;font-weight:700;color:#1e3a8a;letter-spacing:.06em;margin-top:4px;">CATEGORY</div>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${appUrl}" style="display:inline-block;background:#F25C05;color:#fff;text-decoration:none;border-radius:8px;padding:13px 28px;font-size:14px;font-weight:700;">
        ⚡ Open BidDrop → View Storm Map
      </a>
    </div>

    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">
      Open BidDrop → Storm Intelligence → ② MAP → pick ${date} to see the full hail swath and get leads.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:14px 24px;text-align:center;border-top:1px solid #e5e7eb;">
    <div style="font-size:11px;color:#9ca3af;">
      You're receiving this because storm alerts are enabled for ${company}.
      <a href="${appUrl}" style="color:#F25C05;text-decoration:none;">Manage alerts in BidDrop Settings</a>
    </div>
  </div>

</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  // Verify cron secret (same pattern as other BidDrop cron jobs)
  if (!CRON_SECRET) { return res.status(500).json({ error: 'CRON_SECRET not configured' }); }
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  // Also allow query param for manual testing
  const querySecret = req.query.secret || '';
  if (token !== CRON_SECRET && querySecret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  console.log(`[storm-alerts] Checking hail for ${dateStr}`);

  // Get all accounts with storm alerts enabled
  const accounts = await supabaseFetch(
    `accounts?storm_alert_enabled=eq.true&select=id,name,storm_territory_json,storm_alert_min_size,storm_alert_last_sent`
  );

  if (!accounts || !accounts.length) {
    return res.status(200).json({ message: 'No accounts with storm alerts enabled', date: dateStr });
  }

  console.log(`[storm-alerts] Checking ${accounts.length} accounts`);

  // Get yesterday's MRMS hail events
  const hailRows = await supabaseFetch(
    `mrms_hail_events?event_date=eq.${dateStr}&select=lat,lon,hail_size_in,event_date&limit=5000`
  );

  if (!hailRows || !hailRows.length) {
    return res.status(200).json({ message: `No MRMS hail events for ${dateStr}`, date: dateStr });
  }

  const results = [];

  for (const account of accounts) {
    const territory = account.storm_territory_json;
    const minSize = parseFloat(account.storm_alert_min_size || 1.0);

    if (!territory) continue;

    // Filter hail events inside this account's territory and above min size
    const hits = hailRows.filter(e =>
      e.hail_size_in >= minSize && pointInTerritory(e.lat, e.lon, territory)
    );

    if (!hits.length) {
      results.push({ account: account.name, hits: 0, sent: false });
      continue;
    }

    // Get admin email(s) for this account
    const admins = await supabaseFetch(
      `user_profiles?account_id=eq.${account.id}&role=in.(admin,owner)&select=email`
    );
    const emails = (admins || []).map(a => a.email).filter(Boolean);

    if (!emails.length) {
      results.push({ account: account.name, hits: hits.length, sent: false, reason: 'no admin email' });
      continue;
    }

    const html = buildAlertEmail({ account, hailEvents: hits, territory, date: dateStr });
    const maxHail = Math.max(...hits.map(e => e.hail_size_in));
    const subject = `⚡ Hail Alert: ${maxHail.toFixed(2)}" hail in your territory — ${dateStr}`;

    try {
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'BidDrop Storm Alerts <support@biddrop.io>', to: emails, subject, html })
      });
      if (!resendResp.ok) throw new Error(`Resend error: ${resendResp.status}`);

      // Update last_sent timestamp
      await supabaseFetch(`accounts?id=eq.${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ storm_alert_last_sent: new Date().toISOString() })
      });

      results.push({ account: account.name, hits: hits.length, sent: true, emails, max_hail: maxHail });
      console.log(`[storm-alerts] Sent alert to ${emails.join(', ')} for ${account.name}: ${hits.length} hits, max ${maxHail.toFixed(2)}"`);
    } catch(e) {
      results.push({ account: account.name, hits: hits.length, sent: false, error: e.message });
    }
  }

  return res.status(200).json({
    date: dateStr,
    accounts_checked: accounts.length,
    hail_events_total: hailRows.length,
    results
  });
}
