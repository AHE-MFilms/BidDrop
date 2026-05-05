/**
 * BidDrop Drip Cron — Vercel Cron Function
 *
 * Runs daily at 9:00 AM UTC (configured in vercel.json).
 * Finds all queue items with status='scheduled' and scheduled_send_at <= now(),
 * builds the drip postcard HTML, sends via Lob, deducts credits, and marks sent.
 *
 * Security: requires Authorization: Bearer <CRON_SECRET> header (set by Vercel cron).
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const LOB_KEY      = process.env.LOB_API_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;

// ── Supabase REST helper ──────────────────────────────────────────────────────
async function sb(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...opts.headers
  };
  return fetch(url, { ...opts, headers });
}

// ── State abbreviation helper ─────────────────────────────────────────────────
const STATE_MAP = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS',
  'Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA',
  'Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT',
  'Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM',
  'New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK',
  'Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC',
  'South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT',
  'Virginia':'VA','Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};
function toStateAbbr(s) {
  if (!s) return 'MI';
  const t = s.trim();
  if (t.length === 2) return t.toUpperCase();
  return STATE_MAP[t] || t.toUpperCase().slice(0, 2);
}

// ── HTML escape ───────────────────────────────────────────────────────────────
function escH(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Build drip postcard front HTML ────────────────────────────────────────────
function buildDripFront({ photoUrl, headline, subtext, companyName, estimateTotal, address, phone, logoUrl, brandColor, financingEnabled, financingApr, financingTerm, financingDown }) {
  const color = brandColor || '#F25C05';
  const co    = companyName || 'Your Roofing Co';
  const ph    = phone || '(000) 000-0000';
  const total = estimateTotal || 0;
  const parts = (address || '').split(',');
  const shortAddr = parts[0] ? parts[0].trim() : (address || '');
  const cityState = parts.slice(1, 3).map(s => s.trim()).join(', ');
  const photoStyle = photoUrl
    ? `background-image:url('${escH(photoUrl)}');background-size:cover;background-position:center;`
    : `background:#1a2333;`;
  let finMo = 0;
  if (financingEnabled !== false && total) {
    const loan = total * (1 - (financingDown || 0) / 100);
    const r = (financingApr || 9.99) / 100 / 12;
    const n = financingTerm || 60;
    finMo = r === 0 ? Math.round(loan / n) : Math.round(loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=864">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;position:relative;}
  .photo-bg{position:absolute;inset:0;${photoStyle}}
  .photo-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.25) 0%,rgba(0,0,0,.1) 40%,rgba(0,0,0,.65) 75%,rgba(0,0,0,.85) 100%);}
  .content{position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:34px 38px;}
  .top-bar{display:flex;justify-content:space-between;align-items:flex-start;}
  .logo-wrap img{max-height:53px;max-width:192px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6));}
  .logo-wrap .co-name{font-size:22px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);letter-spacing:1px;}
  .badge{background:${color};color:#fff;font-size:13px;font-weight:800;padding:8px 18px;border-radius:30px;letter-spacing:.5px;text-transform:uppercase;box-shadow:0 3px 12px rgba(0,0,0,.4);white-space:nowrap;}
  .bottom{}
  .headline{font-size:38px;font-weight:900;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.8);line-height:1.1;margin-bottom:10px;letter-spacing:-0.5px;}
  .subtext-line{font-size:16px;color:rgba(255,255,255,.9);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:14px;font-weight:500;line-height:1.4;}
  .addr-line{font-size:16px;color:rgba(255,255,255,.85);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:14px;font-weight:600;}
  .price-strip{background:${color};display:inline-flex;align-items:center;gap:20px;padding:12px 24px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.5);}
  .price-main{font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;}
  .price-label{font-size:11px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.5px;line-height:1.3;}
  .price-divider{width:1px;height:36px;background:rgba(255,255,255,.3);}
  .phone-line{margin-top:14px;font-size:16px;color:rgba(255,255,255,.85);font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.6);letter-spacing:.3px;}
</style>
</head>
<body>
  <div class="photo-bg"></div>
  <div class="content">
    <div class="top-bar">
      <div class="logo-wrap">
        ${logoUrl ? `<img src="${escH(logoUrl)}" alt="${escH(co)}">` : `<div class="co-name">${escH(co)}</div>`}
      </div>
      <div class="badge">Follow-Up</div>
    </div>
    <div class="bottom">
      <div class="headline">${escH(headline)}</div>
      <div class="subtext-line">${escH(subtext)}</div>
      <div class="addr-line">&#128205; ${escH(shortAddr)}${cityState ? ', ' + escH(cityState) : ''}</div>
      ${total ? `<div class="price-strip">
        <div>
          <div class="price-label">Your Estimate</div>
          <div class="price-main">$${Number(total).toLocaleString()}</div>
        </div>
        ${finMo ? `<div class="price-divider"></div><div><div class="price-label">As Low As</div><div class="price-main">$${finMo.toLocaleString()}<span style="font-size:16px;font-weight:600;">/mo</span></div></div>` : ''}
      </div>` : ''}
      <div class="phone-line">&#128222; ${escH(ph)}</div>
    </div>
  </div>
</body>
</html>`;
}

// ── Build postcard back HTML ──────────────────────────────────────────────────
function buildPostcardBack({ toName, toAddr, fromName, fromAddr, fromCity, fromPhone, logoUrl }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:6in;height:4in;font-family:Arial,sans-serif;background:#fff;display:flex;overflow:hidden;}
  .left{width:3.5in;height:4in;border-right:1px solid #ccc;padding:0.25in;display:flex;flex-direction:column;justify-content:space-between;}
  .right{width:2.5in;height:4in;padding:0.25in;display:flex;flex-direction:column;justify-content:space-between;}
  .return-addr{font-size:8pt;color:#333;line-height:1.5;}
  .return-addr .co{font-weight:700;font-size:9pt;}
  .logo{max-width:1.2in;max-height:0.5in;object-fit:contain;margin-bottom:6px;}
  .indicia{border:1px solid #333;padding:4px 8px;text-align:center;font-size:7pt;color:#333;line-height:1.4;width:1.1in;align-self:flex-end;}
  .indicia strong{display:block;font-size:9pt;}
  .to-addr{font-size:10pt;line-height:1.6;color:#111;}
  .to-addr .name{font-weight:700;font-size:11pt;}
  .barcode-area{border-top:1px dashed #ccc;padding-top:6px;font-size:7pt;color:#aaa;text-align:center;letter-spacing:2px;}
  .divider{border:none;border-top:1px solid #e0e0e0;margin:6px 0;}
</style>
</head>
<body>
  <div class="left">
    <div>
      ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo">` : ''}
      <div class="return-addr">
        <div class="co">${fromName}</div>
        <div>${fromAddr}</div>
        <div>${fromCity}</div>
        ${fromPhone ? `<div>${fromPhone}</div>` : ''}
      </div>
    </div>
    <div class="barcode-area">|||||||||||||||||||||||||||||||||||||||</div>
  </div>
  <div class="right">
    <div class="indicia">
      <strong>PRSRT STD</strong>
      U.S. POSTAGE<br>PAID<br>PERMIT #000
    </div>
    <div class="to-addr">
      <div class="name">${toName}</div>
      <hr class="divider">
      ${toAddr.split(',').map(l => `<div>${l.trim()}</div>`).join('')}
    </div>
    <div class="barcode-area" style="font-size:6pt;">DELIVERY POINT BARCODE</div>
  </div>
</body>
</html>`;
}

// ── Get drip step message defaults ────────────────────────────────────────────
function getDripStepMessage(step, cfg) {
  const defaults = {
    2: { headline: 'Still thinking it over?',           subtext: "Your estimate is still valid. We'd love to help." },
    3: { headline: 'Storm season is coming.',            subtext: "Now's the time to protect your home. Call us today." },
    4: { headline: 'Final notice.',                      subtext: 'Your estimate expires soon. Secure your spot before prices rise.' }
  };
  const d = defaults[step] || defaults[2];
  return {
    headline: cfg[`drip${step}_headline`] || d.headline,
    subtext:  cfg[`drip${step}_subtext`]  || d.subtext
  };
}

// ── Credit deduction helper ───────────────────────────────────────────────────
const PC_PLAN_FREE = { starter: 5, pro: 15, agency: 30, enterprise: 60 };

async function deductCredit(accountId) {
  const acctRes = await sb(`accounts?id=eq.${accountId}&select=id,plan,mailer_credits,free_mailer_credits_used,free_mailer_credits_reset`);
  if (!acctRes.ok) throw new Error('Failed to fetch account');
  const rows = await acctRes.json();
  if (!rows.length) throw new Error('Account not found');
  const acct = rows[0];

  // Monthly reset
  const today = new Date().toISOString().slice(0, 10);
  if ((acct.free_mailer_credits_reset || '').slice(0, 7) !== today.slice(0, 7)) {
    await sb(`accounts?id=eq.${accountId}`, {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ free_mailer_credits_used: 0, free_mailer_credits_reset: today })
    });
    acct.free_mailer_credits_used = 0;
  }

  const plan      = (acct.plan || 'starter').toLowerCase();
  const freeLimit = PC_PLAN_FREE[plan] || PC_PLAN_FREE.starter;
  const freeLeft  = Math.max(0, freeLimit - (acct.free_mailer_credits_used || 0));
  const paid      = acct.mailer_credits || 0;
  const total     = freeLeft + paid;
  if (total < 1) throw new Error('no_credits');

  const freeToUse = Math.min(freeLeft, 1);
  const paidToUse = 1 - freeToUse;
  const updates = {};
  if (freeToUse > 0) updates.free_mailer_credits_used = (acct.free_mailer_credits_used || 0) + freeToUse;
  if (paidToUse > 0) updates.mailer_credits = paid - paidToUse;
  await sb(`accounts?id=eq.${accountId}`, {
    method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify(updates)
  });
  return { acct, freeToUse, paidToUse, paid };
}

async function refundCredit(accountId, acct, freeToUse, paidToUse) {
  const refund = {};
  if (freeToUse > 0) refund.free_mailer_credits_used = acct.free_mailer_credits_used || 0;
  if (paidToUse > 0) refund.mailer_credits = acct.mailer_credits || 0;
  if (Object.keys(refund).length) {
    await sb(`accounts?id=eq.${accountId}`, {
      method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(refund)
    });
  }
}

// ── Main cron handler ─────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Security: verify cron secret
  if (CRON_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  console.log('[cron-drip] Starting drip cron at', new Date().toISOString());

  // 1. Find all scheduled queue items due to send
  const now = new Date().toISOString();
  const qRes = await sb(
    `queue?status=eq.scheduled&scheduled_send_at=lte.${now}&select=*&order=scheduled_send_at.asc&limit=100`
  );
  if (!qRes.ok) {
    const err = await qRes.text();
    console.error('[cron-drip] Failed to fetch queue:', err);
    return res.status(500).json({ error: 'Failed to fetch queue' });
  }
  const items = await qRes.json();
  console.log(`[cron-drip] Found ${items.length} scheduled items due`);

  if (!items.length) {
    return res.status(200).json({ ok: true, sent: 0, message: 'No items due' });
  }

  const results = [];

  for (const item of items) {
    const accountId = item.account_id;
    const step = item.drip_step || 2;
    console.log(`[cron-drip] Processing item ${item.id} step ${step} for ${item.addr}`);

    try {
      // 2. Fetch account config (branding, company info, drip messages)
      const cfgRes = await sb(
        `accounts?id=eq.${accountId}&select=plan,mailer_credits,free_mailer_credits_used,free_mailer_credits_reset,` +
        `company_name,company_addr,company_phone,brand_color,logo_data,financing_enabled,financing_apr,financing_term,financing_down,` +
        `drip2_headline,drip2_subtext,drip3_headline,drip3_subtext,drip4_headline,drip4_subtext`
      );
      if (!cfgRes.ok) throw new Error('Failed to fetch account config');
      const cfgRows = await cfgRes.json();
      if (!cfgRows.length) throw new Error('Account not found');
      const cfg = cfgRows[0];

      // 3. Deduct credit
      const { acct, freeToUse, paidToUse } = await deductCredit(accountId);

      // 4. Build postcard HTML
      const msg = getDripStepMessage(step, cfg);
      const fromRaw = cfg.company_addr || '123 Main St, Detroit, MI, 48000';
      const fp = fromRaw.split(',').map(s => s.trim());

      // Extract photo_url from structures _meta
      let photoUrl = null;
      if (item.structures && Array.isArray(item.structures)) {
        const meta = item.structures.find(s => s && s.id === '_meta');
        if (meta) photoUrl = meta.photo_url || meta.photo_data || null;
      }

      const frontHtml = buildDripFront({
        photoUrl,
        headline: msg.headline,
        subtext:  msg.subtext,
        companyName: cfg.company_name || 'Your Roofing Co',
        estimateTotal: item.total || 0,
        address: item.addr || '',
        phone: cfg.company_phone || '',
        logoUrl: cfg.logo_data || '',
        brandColor: cfg.brand_color || '#F25C05',
        financingEnabled: cfg.financing_enabled !== false,
        financingApr:  parseFloat(cfg.financing_apr)  || 9.99,
        financingTerm: parseInt(cfg.financing_term)   || 60,
        financingDown: parseFloat(cfg.financing_down) || 0
      });

      const tp = (item.addr || '').split(',').map(s => s.trim());
      let toState = tp[2] || 'MI';
      let toZip   = tp[3] || '';
      if ((!toZip || toZip === '00000') && toState && toState.includes(' ')) {
        const parts = toState.split(' '); toZip = parts.pop(); toState = parts.join(' ');
      }
      if (!toZip) toZip = '00000';

      const backHtml = buildPostcardBack({
        fromName:  cfg.company_name  || 'Your Roofing Co',
        fromAddr:  fp[0] || '123 Main St',
        fromCity:  [fp[1], fp[2], fp[3]].filter(Boolean).join(', '),
        fromPhone: cfg.company_phone || '',
        logoUrl:   cfg.logo_data     || '',
        toName:    item.owner || 'Homeowner',
        toAddr:    item.addr  || ''
      });

      // 5. Send via Lob
      const lobPayload = {
        description: `Drip Step ${step} — ${item.addr}`,
        to: {
          name: item.owner || 'Homeowner',
          address_line1: tp[0] || '',
          address_city:  tp[1] || '',
          address_state: toStateAbbr(toState),
          address_zip:   toZip,
          address_country: 'US'
        },
        from: {
          name: cfg.company_name || 'Your Roofing Co',
          address_line1: fp[0] || '123 Main St',
          address_city:  fp[1] || 'Detroit',
          address_state: toStateAbbr(fp[2] || 'MI'),
          address_zip:   fp[3] || '48000',
          address_country: 'US'
        },
        front: frontHtml,
        back:  backHtml,
        size:  '6x9',
        use_type: 'marketing'
      };

      const lobRes = await fetch('https://api.lob.com/v1/postcards', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(lobPayload)
      });
      const lobData = await lobRes.json();

      if (!lobRes.ok) {
        // Refund credit on Lob failure
        await refundCredit(accountId, acct, freeToUse, paidToUse);
        console.error(`[cron-drip] Lob failed for ${item.id}:`, lobData.error?.message);
        // Mark as failed so it doesn't retry endlessly
        await sb(`queue?id=eq.${item.id}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ status: 'failed' })
        });
        results.push({ id: item.id, status: 'lob_failed', error: lobData.error?.message });
        continue;
      }

      // 6. Mark queue item as sent
      const sentAt = new Date().toISOString();
      await sb(`queue?id=eq.${item.id}`, {
        method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'sent', lob_id: lobData.id, mailed_at: sentAt })
      });

      // 7. Log to mailer_log
      await sb('mailer_log', {
        method: 'POST', headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          account_id:     accountId,
          sent_by:        null, // cron-triggered, no user
          address:        item.addr,
          owner_name:     item.owner,
          estimate_total: item.total || 0,
          lob_id:         lobData.id,
          queue_item_id:  item.id,
          company_name:   cfg.company_name || '',
          sent_at:        sentAt
        })
      });

      console.log(`[cron-drip] ✅ Sent step ${step} to ${item.addr} — Lob ID: ${lobData.id}`);
      results.push({ id: item.id, status: 'sent', lob_id: lobData.id, addr: item.addr, step });

    } catch (err) {
      console.error(`[cron-drip] Error processing ${item.id}:`, err.message);
      results.push({ id: item.id, status: 'error', error: err.message });
    }
  }

  const sent  = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status !== 'sent').length;
  console.log(`[cron-drip] Done. Sent: ${sent}, Failed/Errors: ${failed}`);
  return res.status(200).json({ ok: true, sent, failed, results });
}
