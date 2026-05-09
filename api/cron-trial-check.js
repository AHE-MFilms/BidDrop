/**
 * BidDrop Trial Expiry Cron — Vercel Serverless Function
 *
 * Runs daily at 9 AM ET (13:00 UTC).
 * Finds accounts whose trial has expired (trial_ends_at < now) and are still active.
 * - Sets active = false on expired accounts
 * - Sends an email notification to the admin (john@americashomeexperts.com)
 *
 * Uses Resend as primary email provider (same as signup-webhook.js).
 * Falls back to SendGrid if RESEND_API_KEY is not set.
 *
 * Required Vercel env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   RESEND_API_KEY  (primary) or SENDGRID_API_KEY (fallback)
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const ADMIN_EMAIL  = 'john@americashomeexperts.com';
const FROM_EMAIL   = 'BidDrop <noreply@biddrop.io>';

function sbFetch(path, opts = {}) {
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

async function sendAdminEmail(subject, html) {
  if (RESEND_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[cron-trial-check] Resend email error:', err);
    } else {
      console.log('[cron-trial-check] Admin email sent via Resend');
    }
  } else if (SENDGRID_KEY) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ADMIN_EMAIL }] }],
        from: { email: 'noreply@biddrop.io', name: 'BidDrop' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[cron-trial-check] SendGrid email error:', err);
    } else {
      console.log('[cron-trial-check] Admin email sent via SendGrid');
    }
  } else {
    console.warn('[cron-trial-check] No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY missing)');
  }
}

export default async function handler(req, res) {
  // Only allow GET (Vercel cron) or POST with authorization
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = new Date().toISOString();

  // Find accounts where trial has expired and still active
  const r = await sbFetch(
    `accounts?trial_ends_at=lt.${encodeURIComponent(now)}&active=eq.true&select=id,company_name,plan,trial_ends_at,stripe_subscription_id`
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
      const upd = await sbFetch(`accounts?id=eq.${acct.id}`, {
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
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-transform:capitalize;">${a.plan}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${new Date(a.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${a.stripe_subscription_id ? '✅ Has sub' : '⚠️ No sub'}</td>
      </tr>`
    ).join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#111;padding:24px 32px;border-radius:10px 10px 0 0;">
          <span style="font-size:24px;font-weight:900;color:#fff;">Bid<span style="color:#F97316;">Drop</span></span>
        </div>
        <div style="padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;">
          <h2 style="color:#111;margin:0 0 12px 0;">⏰ Trial Expiry Report</h2>
          <p style="color:#333;margin:0 0 20px 0;">
            <strong>${locked.length} account${locked.length > 1 ? 's' : ''}</strong> had their 60-day trial expire and 
            ${locked.length > 1 ? 'have' : 'has'} been automatically <strong style="color:#dc2626;">deactivated</strong>.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px 12px;text-align:left;font-weight:700;">Company</th>
                <th style="padding:8px 12px;text-align:left;font-weight:700;">Plan</th>
                <th style="padding:8px 12px;text-align:left;font-weight:700;">Trial Ended</th>
                <th style="padding:8px 12px;text-align:left;font-weight:700;">Stripe</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div style="margin-top:24px;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
            <p style="margin:0;font-size:14px;color:#9a3412;">
              <strong>Action needed:</strong> If any of these clients want to continue, 
              reactivate them in the <a href="https://biddrop.americashomeexperts.com" style="color:#F97316;">Admin Panel</a> 
              and confirm their Stripe subscription is active.
            </p>
          </div>
          ${errors.length > 0 ? `<p style="color:#dc2626;margin-top:16px;font-size:13px;">⚠️ ${errors.length} error(s): ${errors.map(e => e.name + ': ' + e.error).join('; ')}</p>` : ''}
        </div>
      </div>
    `;

    await sendAdminEmail(
      `⏰ BidDrop: ${locked.length} Trial${locked.length > 1 ? 's' : ''} Expired — Action Required`,
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
