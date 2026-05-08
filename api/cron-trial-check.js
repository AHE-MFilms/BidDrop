/**
 * BidDrop Trial Expiry Cron — Vercel Serverless Function
 *
 * Runs daily at 9 AM ET (13:00 UTC).
 * Finds accounts whose trial has expired (trial_ends_at < now) and are still active.
 * - Sets active = false on expired accounts
 * - Sends an email notification to the admin (john@americashomeexperts.com)
 *
 * Required Vercel env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   SENDGRID_API_KEY  (or SMTP credentials — uses same mailer as signup-webhook)
 *   CRON_SECRET       (optional — set to secure this endpoint)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;
const ADMIN_EMAIL  = 'john@americashomeexperts.com';
const FROM_EMAIL   = 'noreply@americashomeexperts.com';

function sb(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {})
    }
  });
}

async function sendEmail(to, subject, html) {
  if (!SENDGRID_KEY) {
    console.log('[cron-trial-check] No SENDGRID_API_KEY — skipping email');
    return;
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: FROM_EMAIL, name: 'BidDrop' },
      subject,
      content: [{ type: 'text/html', value: html }]
    })
  });
  if (!res.ok) {
    const d = await res.text();
    console.error('[cron-trial-check] SendGrid error:', d);
  }
}

export default async function handler(req, res) {
  // Verify cron secret if set
  if (CRON_SECRET) {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const now = new Date().toISOString();

  // Find accounts where trial has expired and still active
  const r = await sb(
    `accounts?trial_ends_at=lt.${now}&active=eq.true&select=id,company_name,plan,trial_ends_at,stripe_subscription_id`
  );
  if (!r.ok) {
    const err = await r.text();
    console.error('[cron-trial-check] Failed to fetch expired accounts:', err);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }

  const expired = await r.json();
  console.log(`[cron-trial-check] Found ${expired.length} expired trial accounts`);

  if (expired.length === 0) {
    return res.status(200).json({ ok: true, expired: 0, locked: 0 });
  }

  const locked = [];
  const errors = [];

  for (const acct of expired) {
    try {
      // Deactivate the account
      const upd = await sb(`accounts?id=eq.${acct.id}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ active: false })
      });
      if (!upd.ok) {
        const e = await upd.text();
        errors.push({ id: acct.id, name: acct.company_name, error: e });
        continue;
      }
      locked.push(acct);
      console.log(`[cron-trial-check] Locked account: ${acct.company_name} (trial ended ${acct.trial_ends_at})`);
    } catch (e) {
      errors.push({ id: acct.id, name: acct.company_name, error: e.message });
    }
  }

  // Send admin notification email
  if (locked.length > 0) {
    const rows = locked.map(a =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${a.company_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${a.plan}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${new Date(a.trial_ends_at).toLocaleDateString()}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${a.stripe_subscription_id ? '✅ Has Stripe sub' : '⚠️ No Stripe sub'}</td>
      </tr>`
    ).join('');

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#F25C05;">⏰ BidDrop Trial Expiry Report</h2>
        <p>${locked.length} account(s) had their trial expire and have been <strong>automatically deactivated</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;text-align:left;">Company</th>
              <th style="padding:8px 12px;text-align:left;">Plan</th>
              <th style="padding:8px 12px;text-align:left;">Trial Ended</th>
              <th style="padding:8px 12px;text-align:left;">Stripe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:20px;color:#666;">
          These accounts are now locked. If a client converts, reactivate them in the 
          <a href="https://biddrop.americashomeexperts.com" style="color:#F25C05;">Admin Panel</a>.
        </p>
        ${errors.length > 0 ? `<p style="color:red;">⚠️ ${errors.length} error(s) occurred: ${errors.map(e => e.name + ': ' + e.error).join(', ')}</p>` : ''}
      </div>
    `;

    await sendEmail(
      ADMIN_EMAIL,
      `⏰ BidDrop: ${locked.length} Trial(s) Expired — Action Required`,
      html
    );
  }

  return res.status(200).json({
    ok: true,
    expired: expired.length,
    locked: locked.length,
    errors: errors.length,
    accounts: locked.map(a => ({ id: a.id, name: a.company_name, plan: a.plan }))
  });
}
