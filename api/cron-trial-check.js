/**
 * BidDrop Trial Expiry Cron — Vercel Serverless Function
 *
 * Runs daily at 9 AM ET (13:00 UTC).
 * 1. Sends warning emails to users whose trial ends in ~10 days (day 50) or ~2 days (day 58)
 * 2. Finds accounts whose trial has expired (trial_ends_at < now) and are still active.
 *    - Sets active = false on expired accounts
 *    - Sends an email notification to the admin (support@biddrop.io)
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
const ADMIN_EMAIL  = 'support@biddrop.io';
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

async function sendEmail(toEmail, subject, html) {
  if (RESEND_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [toEmail], subject, html }),
    });
    if (!r.ok) console.error('[cron-trial-check] Resend email error to', toEmail, ':', await r.text());
    else console.log('[cron-trial-check] Email sent to', toEmail, 'via Resend');
  } else if (SENDGRID_KEY) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SENDGRID_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: 'noreply@biddrop.io', name: 'BidDrop' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (!r.ok) console.error('[cron-trial-check] SendGrid email error to', toEmail, ':', await r.text());
    else console.log('[cron-trial-check] Email sent to', toEmail, 'via SendGrid');
  } else {
    console.warn('[cron-trial-check] No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY missing)');
  }
}

// Lookup the admin user's email for a given account_id
async function getAccountAdminEmail(accountId) {
  try {
    const profileRes = await sbFetch(
      `user_profiles?account_id=eq.${accountId}&role=eq.admin&select=id&limit=1`
    );
    if (!profileRes.ok) return null;
    const profiles = await profileRes.json();
    if (!profiles.length) return null;
    const userId = profiles[0].id;
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    if (!authRes.ok) return null;
    const authUser = await authRes.json();
    return authUser.email || null;
  } catch (e) {
    console.warn('[cron-trial-check] getAccountAdminEmail error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  // Only allow GET (Vercel cron) or POST with authorization
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now    = new Date();
  const nowIso = now.toISOString();

  // ── Step 1: Send warning emails to accounts approaching trial end ─────────
  // We look for accounts whose trial ends between now and 11 days from now.
  // Then we split by daysLeft: 9–11 days → day-50 warning, 1–3 days → day-58 warning.
  const warnCutoff = new Date(now.getTime() + 11 * 86400000).toISOString();
  const warnRes = await sbFetch(
    `accounts?trial_ends_at=gte.${encodeURIComponent(nowIso)}&trial_ends_at=lte.${encodeURIComponent(warnCutoff)}&active=eq.true&select=id,company_name,plan,trial_ends_at,stripe_subscription_id`
  );

  let warningsSent = 0;
  if (warnRes.ok) {
    const warnAccounts = await warnRes.json();
    const planNames = { starter: 'Starter ($97/mo)', pro: 'Pro ($197/mo)', agency: 'Agency ($397/mo)', enterprise: 'Enterprise ($797/mo)' };

    for (const acct of warnAccounts) {
      const trialEnd = new Date(acct.trial_ends_at);
      const daysLeft = Math.round((trialEnd - now) / 86400000);

      // Day-50 window: ~10 days left (9–11 days)
      // Day-58 window: ~2 days left (1–3 days)
      const isDay50Window = daysLeft >= 9 && daysLeft <= 11;
      const isDay58Window = daysLeft >= 1 && daysLeft <= 3;
      if (!isDay50Window && !isDay58Window) continue;

      // Skip if they already have a Stripe subscription (they've already converted)
      if (acct.stripe_subscription_id) continue;

      const userEmail = await getAccountAdminEmail(acct.id);
      if (!userEmail) {
        console.warn(`[cron-trial-check] No admin email found for account ${acct.company_name}`);
        continue;
      }

      const trialEndFormatted = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const planName = planNames[(acct.plan || 'starter').toLowerCase()] || acct.plan;
      const isUrgent = isDay58Window;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:#111;padding:24px 32px;border-radius:10px 10px 0 0;">
            <span style="font-size:24px;font-weight:900;color:#fff;">Bid<span style="color:#F97316;">Drop</span></span>
          </div>
          <div style="padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;">
            <h2 style="color:#111;margin:0 0 12px 0;">
              ${isUrgent ? `⚠️ ${daysLeft} Day${daysLeft > 1 ? 's' : ''} Left — Your Trial Expires ${trialEndFormatted}` : `⏰ 10 Days Left on Your BidDrop Trial`}
            </h2>
            <p style="color:#333;margin:0 0 16px 0;">
              Hi ${acct.company_name},<br><br>
              Your BidDrop <strong>${planName}</strong> trial ${isUrgent ? 'is expiring very soon' : 'ends in about 10 days'}.
              To keep access to your account, pins, estimates, and mail queue — subscribe before your trial expires on <strong>${trialEndFormatted}</strong>.
            </p>
            <div style="background:${isUrgent ? '#fef2f2' : '#fff7ed'};border:1px solid ${isUrgent ? '#fecaca' : '#fed7aa'};border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0;font-size:15px;color:${isUrgent ? '#dc2626' : '#9a3412'};font-weight:700;">
                ${isUrgent ? `⚠️ Only ${daysLeft} day${daysLeft > 1 ? 's' : ''} remaining!` : '⏰ 10 days remaining'}
              </p>
              <p style="margin:6px 0 0 0;font-size:13px;color:${isUrgent ? '#dc2626' : '#9a3412'};">
                Trial expires: <strong>${trialEndFormatted}</strong>
              </p>
            </div>
            <p style="color:#333;margin:0 0 20px 0;">
              Log in to your account and click <strong>"Manage Subscription"</strong> in Settings to subscribe and keep your data.
            </p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${(process.env.APP_URL || 'https://biddrop.us').trim()}" style="background:#F97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
                Log In &amp; Subscribe Now →
              </a>
            </div>
            <p style="font-size:12px;color:#999;margin:20px 0 0 0;text-align:center;">
              Questions? Email us at <a href="mailto:support@biddrop.io" style="color:#F97316;">support@biddrop.io</a>
            </p>
          </div>
        </div>
      `;

      const subject = isUrgent
        ? `⚠️ BidDrop: Your trial expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''} — Subscribe to keep access`
        : `⏰ BidDrop: Your trial ends in 10 days — Don't lose your data`;

      await sendEmail(userEmail, subject, html);
      warningsSent++;
      console.log(`[cron-trial-check] Warning email sent to ${userEmail} (${acct.company_name}), ${daysLeft} days left`);
    }
  }

  // ── Step 2: Lock expired accounts ─────────────────────────────────────────
  const r = await sbFetch(
    `accounts?trial_ends_at=lt.${encodeURIComponent(nowIso)}&active=eq.true&select=id,company_name,plan,trial_ends_at,stripe_subscription_id`
  );
  if (!r.ok) {
    const err = await r.text();
    console.error('[cron-trial-check] Failed to fetch expired accounts:', err);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }

  const expired = await r.json();
  console.log(`[cron-trial-check] Found ${expired.length} expired trial accounts`);

  if (expired.length === 0) {
    return res.status(200).json({ ok: true, expired: 0, locked: 0, warnings_sent: warningsSent });
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
              reactivate them in the <a href="${(process.env.APP_URL || 'https://biddrop.us').trim()}" style="color:#F97316;">Admin Panel</a> 
              and confirm their Stripe subscription is active.
            </p>
          </div>
          ${errors.length > 0 ? `<p style="color:#dc2626;margin-top:16px;font-size:13px;">⚠️ ${errors.length} error(s): ${errors.map(e => e.name + ': ' + e.error).join('; ')}</p>` : ''}
        </div>
      </div>
    `;

    await sendEmail(
      ADMIN_EMAIL,
      `⏰ BidDrop: ${locked.length} Trial${locked.length > 1 ? 's' : ''} Expired — Action Required`,
      html
    );
  }

  return res.status(200).json({
    ok: true,
    expired: expired.length,
    locked: locked.length,
    errors: errors.length,
    warnings_sent: warningsSent,
    accounts: locked.map(a => ({ id: a.id, name: a.company_name, plan: a.plan }))
  });
}
