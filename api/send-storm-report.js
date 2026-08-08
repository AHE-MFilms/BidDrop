/**
 * BidDrop — Send Storm Report API
 * Generates a branded storm impact report for a property and sends it via
 * Resend email and/or SMS (via GHL).
 *
 * POST /api/send-storm-report
 * Body: {
 *   pin_id, address, lat, lon,
 *   homeowner_name, homeowner_email, homeowner_phone,
 *   send_email, send_sms,
 *   account_id   (to pull company branding)
 * }
 */

import { Resend } from 'resend';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const resend = new Resend(process.env.RESEND_API_KEY);

// Fetch account branding
async function getAccount(accountId) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${accountId}&select=name,phone,logo_url,slug`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    const rows = await r.json();
    return rows[0] || {};
  } catch { return {}; }
}

// Fetch storm data for the property
async function getStormData(lat, lon) {
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://biddrop.us';
    const r = await fetch(`${base}/api/storm-report?lat=${lat}&lon=${lon}&days=365`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Build the branded HTML report
function buildReportHtml({ address, lat, lon, homeownerName, account, stormData }) {
  const company = account.name || 'Your Roofing Contractor';
  const phone = account.phone || '';
  const logoUrl = account.logo_url || '';
  const slug = account.slug || '';
  const estimateUrl = slug ? `https://biddrop.us/q/${slug}` : 'https://biddrop.us';

  const mrms = stormData?.mrms_hail || [];
  const spcHail = stormData?.spc_hail_spotters || [];
  const spcWind = stormData?.spc_wind || [];
  const warnings = stormData?.nws_warnings || [];
  const summary = stormData?.summary || {};

  // Group MRMS by date
  const byDate = {};
  mrms.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = { max: 0, count: 0 };
    if (e.hail_size_in > byDate[e.date].max) byDate[e.date].max = e.hail_size_in;
    byDate[e.date].count++;
  });
  const hailDates = Object.keys(byDate).sort((a,b) => b.localeCompare(a)).slice(0, 10);

  const hailRowsHtml = hailDates.length ? hailDates.map(date => {
    const d = byDate[date];
    const lbl = d.max >= 2.75 ? 'Baseball+' : d.max >= 1.75 ? 'Baseball' : d.max >= 1.0 ? 'Golf Ball' : 'Quarter';
    const color = d.max >= 2.75 ? '#dc2626' : d.max >= 1.75 ? '#ea580c' : d.max >= 1.0 ? '#ca8a04' : '#2563eb';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;font-weight:700;color:${color};">${d.max.toFixed(2)}"</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${lbl}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="3" style="padding:12px;text-align:center;color:#9ca3af;font-size:13px;">No MRMS hail events in the last 12 months</td></tr>`;

  const spotterHtml = spcHail.slice(0, 5).map(e =>
    `<li style="margin-bottom:4px;font-size:12px;color:#374151;">${e.date || ''} — <b>${e.size_in ? e.size_in.toFixed(2)+'"' : '?'}</b> hail${e.comments ? ` — "${e.comments.slice(0,80)}"` : ''}</li>`
  ).join('');

  const windHtml = spcWind.slice(0, 3).map(e =>
    `<li style="margin-bottom:4px;font-size:12px;color:#374151;">${e.date || ''} — <b>${e.speed_mph ? e.speed_mph+' mph' : 'Unknown speed'}</b> wind${e.comments ? ` — "${e.comments.slice(0,60)}"` : ''}</li>`
  ).join('');

  const warningHtml = warnings.slice(0, 3).map(w =>
    `<li style="margin-bottom:4px;font-size:12px;color:#374151;"><b>${w.event}</b>${w.onset ? ' — ' + new Date(w.onset).toLocaleDateString() : ''}</li>`
  ).join('');

  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const greeting = homeownerName ? `Hi ${homeownerName},` : 'Hello,';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Storm Impact Report — ${address}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#111827;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" style="height:40px;object-fit:contain;margin-bottom:8px;display:block;" alt="${company}">` : `<div style="font-size:18px;font-weight:800;color:#fff;">${company}</div>`}
      <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Storm Impact Report · ${today}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;color:#9ca3af;">Powered by</div>
      <div style="font-size:14px;font-weight:800;color:#F25C05;">BidDrop</div>
    </div>
  </div>

  <!-- Property banner -->
  <div style="background:#F25C05;padding:16px 28px;">
    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:.5px;margin-bottom:4px;">PROPERTY ADDRESS</div>
    <div style="font-size:17px;font-weight:800;color:#fff;line-height:1.3;">${address}</div>
  </div>

  <!-- Greeting -->
  <div style="padding:24px 28px 0;">
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">${greeting}</p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">
      We've pulled the official NOAA storm data for your property. Based on radar and storm spotter records, here's what we found:
    </p>
  </div>

  <!-- Summary badges -->
  <div style="padding:0 28px 20px;display:flex;gap:12px;flex-wrap:wrap;">
    <div style="flex:1;min-width:120px;background:#fef3c7;border-radius:8px;padding:12px 14px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#d97706;">${summary.max_hail_in ? summary.max_hail_in.toFixed(2)+'"' : '—'}</div>
      <div style="font-size:10px;font-weight:700;color:#92400e;margin-top:2px;">MAX HAIL SIZE</div>
    </div>
    <div style="flex:1;min-width:120px;background:#fee2e2;border-radius:8px;padding:12px 14px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#dc2626;">${hailDates.length}</div>
      <div style="font-size:10px;font-weight:700;color:#991b1b;margin-top:2px;">STORM DATES</div>
    </div>
    <div style="flex:1;min-width:120px;background:#dbeafe;border-radius:8px;padding:12px 14px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#1d4ed8;">${spcHail.length + spcWind.length}</div>
      <div style="font-size:10px;font-weight:700;color:#1e3a8a;margin-top:2px;">SPOTTER REPORTS</div>
    </div>
  </div>

  <!-- Hail history table -->
  <div style="padding:0 28px 20px;">
    <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #F25C05;">🌧 Radar-Confirmed Hail Events (Last 12 Months)</div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.4px;">DATE</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.4px;">SIZE</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:.4px;">CATEGORY</th>
        </tr>
      </thead>
      <tbody>${hailRowsHtml}</tbody>
    </table>
  </div>

  ${spotterHtml ? `
  <div style="padding:0 28px 20px;">
    <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #3b82f6;">👤 Storm Spotter Reports Nearby</div>
    <ul style="margin:0;padding-left:16px;">${spotterHtml}</ul>
  </div>` : ''}

  ${windHtml ? `
  <div style="padding:0 28px 20px;">
    <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #10b981;">💨 Wind Damage Reports Nearby</div>
    <ul style="margin:0;padding-left:16px;">${windHtml}</ul>
  </div>` : ''}

  ${warningHtml ? `
  <div style="padding:0 28px 20px;">
    <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #f59e0b;">⚠️ Official NWS Warnings Issued</div>
    <ul style="margin:0;padding-left:16px;">${warningHtml}</ul>
  </div>` : ''}

  <!-- CTA -->
  <div style="padding:20px 28px 28px;">
    <div style="background:#111827;border-radius:10px;padding:20px 24px;text-align:center;">
      <div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:8px;">Ready to get your free inspection?</div>
      <div style="font-size:13px;color:#9ca3af;margin-bottom:16px;">Storm damage isn't always visible from the ground. A quick roof inspection can save you thousands.</div>
      <a href="${estimateUrl}" style="display:inline-block;background:#F25C05;color:#fff;text-decoration:none;border-radius:8px;padding:12px 28px;font-size:14px;font-weight:700;">Schedule Free Inspection →</a>
      ${phone ? `<div style="font-size:12px;color:#9ca3af;margin-top:12px;">Or call us: <a href="tel:${phone}" style="color:#F25C05;text-decoration:none;font-weight:700;">${phone}</a></div>` : ''}
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #e5e7eb;">
    <div style="font-size:11px;color:#9ca3af;">Storm data sourced from NOAA MRMS Radar, SPC Storm Reports, and NWS Alerts. Data is for informational purposes only.</div>
    <div style="font-size:11px;color:#9ca3af;margin-top:4px;">Report generated by <a href="https://biddrop.us" style="color:#F25C05;text-decoration:none;">BidDrop</a></div>
  </div>

</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    address, lat, lon,
    homeowner_name, homeowner_email, homeowner_phone,
    send_email = true, send_sms = false,
    account_id
  } = req.body || {};

  if (!address || !lat || !lon) {
    return res.status(400).json({ error: 'address, lat, lon are required' });
  }

  // Fetch account branding + storm data in parallel
  const [account, stormData] = await Promise.all([
    account_id ? getAccount(account_id) : Promise.resolve({}),
    getStormData(lat, lon)
  ]);

  const html = buildReportHtml({
    address, lat, lon,
    homeownerName: homeowner_name,
    account,
    stormData
  });

  const results = { email_sent: false, sms_sent: false };

  // Send email
  if (send_email && homeowner_email) {
    try {
      const subject = `Storm Impact Report — ${address.split(',')[0]}`;
      await resend.emails.send({
        from: 'BidDrop Storm Reports <support@biddrop.io>',
        to: homeowner_email,
        subject,
        html
      });
      results.email_sent = true;
    } catch(e) {
      results.email_error = e.message;
    }
  }

  // Send SMS via GHL (if phone provided)
  if (send_sms && homeowner_phone) {
    try {
      const ghlToken = process.env.GHL_API_KEY;
      const ghlLocation = process.env.GHL_LOCATION_ID || 'PcQ4U8L1v2pcvQnref8e';
      if (ghlToken) {
        const estimateUrl = account.slug ? `https://biddrop.us/q/${account.slug}` : 'https://biddrop.us';
        const smsBody = `Hi${homeowner_name ? ' ' + homeowner_name.split(' ')[0] : ''}! ${account.name || 'Your roofer'} pulled the storm history for ${address.split(',')[0]}. Your property was hit by hail — see the full report and schedule a free inspection: ${estimateUrl}`;
        await fetch('https://services.leadconnectorhq.com/conversations/messages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ghlToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-04-15'
          },
          body: JSON.stringify({
            type: 'SMS',
            locationId: ghlLocation,
            contactId: null,
            phone: homeowner_phone,
            message: smsBody
          })
        });
        results.sms_sent = true;
      }
    } catch(e) {
      results.sms_error = e.message;
    }
  }

  // Always return the HTML so the frontend can preview it
  return res.status(200).json({
    ...results,
    report_html: html,
    address,
    storm_summary: stormData?.summary || {}
  });
}
