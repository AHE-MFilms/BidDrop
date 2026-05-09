/**
 * BidDrop Billing Webhook — Vercel Serverless Function
 *
 * Triggered by Stripe: invoice.paid, invoice.payment_failed, customer.subscription.deleted
 *
 * What this does:
 *   invoice.paid:
 *     When a subscription invoice is paid (i.e., after the 60-day trial ends
 *     and every month thereafter), this webhook adds the plan's monthly credit
 *     allotment to the customer's BidDrop account in Supabase.
 *
 *   invoice.payment_failed:
 *     When a payment fails, marks the account as payment_failed=true and sends
 *     a warning email to the account owner so they can update their payment method.
 *
 *   customer.subscription.deleted:
 *     When a subscription is fully cancelled (period end reached), deactivates
 *     the BidDrop account and sends an admin notification.
 *
 * Monthly credit allotments (once billing starts):
 *   Starter:    25 credits/mo
 *   Pro:        50 credits/mo
 *   Agency:     100 credits/mo
 *   Enterprise: 200 credits/mo
 *
 * Required Vercel env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET_BILLING   (set this in Stripe dashboard for this endpoint)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   RESEND_API_KEY  (primary) or SENDGRID_API_KEY (fallback) — for payment failed emails
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const ADMIN_EMAIL  = 'john@americashomeexperts.com';
const FROM_EMAIL   = 'BidDrop <noreply@biddrop.io>';
const APP_URL      = (process.env.APP_URL || 'https://biddrop.americashomeexperts.com').trim();

// Monthly credit allotments per plan (after trial, once billing starts)
const PLAN_MONTHLY_CREDITS = {
  starter:    25,
  pro:        50,
  agency:     100,
  enterprise: 200,
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function sendEmail(toEmail, subject, html) {
  if (RESEND_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [toEmail], subject, html }),
    });
    if (!r.ok) console.error('[billing-webhook] Resend email error to', toEmail, ':', await r.text());
    else console.log('[billing-webhook] Email sent to', toEmail, 'via Resend');
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
    if (!r.ok) console.error('[billing-webhook] SendGrid email error to', toEmail, ':', await r.text());
    else console.log('[billing-webhook] Email sent to', toEmail, 'via SendGrid');
  } else {
    console.warn('[billing-webhook] No email provider configured — cannot send email to', toEmail);
  }
}

// Look up the admin user email for a given account_id
async function getAccountAdminEmail(accountId) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?account_id=eq.${accountId}&role=eq.admin&select=id&limit=1`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }
    });
    if (!r.ok) return null;
    const profiles = await r.json();
    if (!profiles.length) return null;
    const userId = profiles[0].id;
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    if (!authRes.ok) return null;
    const authUser = await authRes.json();
    return authUser.email || null;
  } catch (e) {
    console.warn('[billing-webhook] getAccountAdminEmail error:', e.message);
    return null;
  }
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Stripe signature
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_BILLING;

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[billing-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature failed: ${err.message}` });
  }

  console.log('[billing-webhook] Event received:', event.type, event.id);

  // ── invoice.paid ──────────────────────────────────────────────────────────
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;

    // Only process subscription invoices (not one-time credit purchases)
    if (!invoice.subscription) {
      console.log('[billing-webhook] Skipping non-subscription invoice:', invoice.id);
      return res.status(200).json({ received: true, skipped: 'not a subscription invoice' });
    }

    // Skip $0 invoices (e.g. trial period invoices)
    if (invoice.amount_paid === 0) {
      console.log('[billing-webhook] Skipping $0 invoice (trial):', invoice.id);
      return res.status(200).json({ received: true, skipped: 'zero amount invoice (trial)' });
    }

    const stripeCustomerId = invoice.customer;
    console.log('[billing-webhook] Processing paid invoice for customer:', stripeCustomerId, 'amount:', invoice.amount_paid);

    try {
      const { data: accounts, error: acctError } = await supabase
        .from('accounts')
        .select('id, name, plan, mailer_credits, stripe_customer_id, stripe_subscription_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .eq('active', true);

      if (acctError) throw new Error(`Supabase account lookup failed: ${acctError.message}`);

      if (!accounts || accounts.length === 0) {
        console.warn('[billing-webhook] No active BidDrop account found for Stripe customer:', stripeCustomerId);
        return res.status(200).json({ received: true, skipped: 'no matching account' });
      }

      const account = accounts[0];
      const plan = account.plan || 'starter';
      const creditsToAdd = PLAN_MONTHLY_CREDITS[plan] ?? PLAN_MONTHLY_CREDITS.starter;
      const newCredits = (account.mailer_credits || 0) + creditsToAdd;

      console.log(`[billing-webhook] Topping up account ${account.id} (${account.name}) plan=${plan}: +${creditsToAdd} credits (${account.mailer_credits} → ${newCredits})`);

      const { error: updateError } = await supabase
        .from('accounts')
        .update({ mailer_credits: newCredits, payment_failed: false })
        .eq('id', account.id);

      if (updateError) throw new Error(`Failed to update credits: ${updateError.message}`);

      console.log(`[billing-webhook] Credits updated successfully for account ${account.id}`);

      return res.status(200).json({
        received: true,
        account_id: account.id,
        account_name: account.name,
        plan,
        credits_added: creditsToAdd,
        new_balance: newCredits,
      });

    } catch (err) {
      console.error('[billing-webhook] Error processing invoice.paid:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── invoice.payment_failed ────────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    if (!invoice.subscription) {
      return res.status(200).json({ received: true, skipped: 'not a subscription invoice' });
    }

    const stripeCustomerId = invoice.customer;
    const attemptCount = invoice.attempt_count || 1;
    console.log(`[billing-webhook] Payment failed for customer ${stripeCustomerId}, attempt #${attemptCount}`);

    try {
      // Find the account
      const { data: accounts, error: acctError } = await supabase
        .from('accounts')
        .select('id, name, company_name, plan, stripe_customer_id')
        .eq('stripe_customer_id', stripeCustomerId);

      if (acctError) throw new Error(`Supabase account lookup failed: ${acctError.message}`);
      if (!accounts || accounts.length === 0) {
        console.warn('[billing-webhook] No BidDrop account found for failed payment, customer:', stripeCustomerId);
        return res.status(200).json({ received: true, skipped: 'no matching account' });
      }

      const account = accounts[0];

      // Mark payment_failed on the account
      await supabase
        .from('accounts')
        .update({ payment_failed: true })
        .eq('id', account.id);

      const companyName = account.company_name || account.name || 'your company';
      const planNames = { starter: 'Starter ($97/mo)', pro: 'Pro ($197/mo)', agency: 'Agency ($397/mo)', enterprise: 'Enterprise ($797/mo)' };
      const planName = planNames[(account.plan || 'starter').toLowerCase()] || account.plan;

      // Send warning email to the account owner
      const userEmail = await getAccountAdminEmail(account.id);
      if (userEmail) {
        const userHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
            <div style="background:#111;padding:24px 32px;border-radius:10px 10px 0 0;">
              <span style="font-size:24px;font-weight:900;color:#fff;">Bid<span style="color:#F97316;">Drop</span></span>
            </div>
            <div style="padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;">
              <h2 style="color:#dc2626;margin:0 0 12px 0;">⚠️ Payment Failed — Action Required</h2>
              <p style="color:#333;margin:0 0 16px 0;">
                Hi ${companyName},<br><br>
                We were unable to process your payment for your BidDrop <strong>${planName}</strong> subscription.
                This was attempt <strong>#${attemptCount}</strong>.
              </p>
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
                <p style="margin:0;font-size:15px;color:#dc2626;font-weight:700;">⚠️ Please update your payment method</p>
                <p style="margin:6px 0 0 0;font-size:13px;color:#dc2626;">
                  If payment is not resolved, your account may be suspended.
                </p>
              </div>
              <p style="color:#333;margin:0 0 20px 0;">
                Log in to your account and click <strong>"Manage Subscription"</strong> in Settings to update your payment method.
              </p>
              <div style="text-align:center;margin:24px 0;">
                <a href="${APP_URL}" style="background:#F97316;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block;">
                  Update Payment Method →
                </a>
              </div>
              <p style="font-size:12px;color:#999;margin:20px 0 0 0;text-align:center;">
                Questions? Email us at <a href="mailto:support@biddrop.io" style="color:#F97316;">support@biddrop.io</a>
              </p>
            </div>
          </div>
        `;
        await sendEmail(userEmail, `⚠️ BidDrop: Payment failed — please update your payment method`, userHtml);
      }

      // Also notify admin
      const adminHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:#111;padding:24px 32px;border-radius:10px 10px 0 0;">
            <span style="font-size:24px;font-weight:900;color:#fff;">Bid<span style="color:#F97316;">Drop</span></span>
          </div>
          <div style="padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;">
            <h2 style="color:#dc2626;margin:0 0 12px 0;">⚠️ Payment Failed — ${companyName}</h2>
            <p style="color:#333;margin:0 0 16px 0;">
              Payment attempt <strong>#${attemptCount}</strong> failed for:<br>
              <strong>${companyName}</strong> (${planName})<br>
              Stripe Customer: <code>${stripeCustomerId}</code><br>
              Invoice: <code>${invoice.id}</code>
            </p>
            <p style="color:#333;margin:0;">
              Stripe will automatically retry. If all retries fail, the subscription will be cancelled.
              The account has been flagged as <code>payment_failed=true</code> in the database.
            </p>
          </div>
        </div>
      `;
      await sendEmail(ADMIN_EMAIL, `⚠️ BidDrop: Payment failed — ${companyName} (attempt #${attemptCount})`, adminHtml);

      return res.status(200).json({
        received: true,
        account_id: account.id,
        account_name: companyName,
        attempt_count: attemptCount,
      });

    } catch (err) {
      console.error('[billing-webhook] Error processing invoice.payment_failed:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── customer.subscription.deleted ─────────────────────────────────────────
  // Fired when a subscription is fully cancelled (either immediately or at period end)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const stripeCustomerId = subscription.customer;
    console.log(`[billing-webhook] Subscription deleted for customer ${stripeCustomerId}`);

    try {
      const { data: accounts, error: acctError } = await supabase
        .from('accounts')
        .select('id, name, company_name, plan, stripe_customer_id')
        .eq('stripe_customer_id', stripeCustomerId);

      if (acctError) throw new Error(`Supabase account lookup failed: ${acctError.message}`);
      if (!accounts || accounts.length === 0) {
        console.warn('[billing-webhook] No BidDrop account found for deleted subscription, customer:', stripeCustomerId);
        return res.status(200).json({ received: true, skipped: 'no matching account' });
      }

      const account = accounts[0];
      const companyName = account.company_name || account.name || 'Unknown';

      // Deactivate the account
      await supabase
        .from('accounts')
        .update({ active: false, cancel_at_period_end: false })
        .eq('id', account.id);

      console.log(`[billing-webhook] Account deactivated after subscription deletion: ${companyName}`);

      // Notify admin
      const adminHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:#111;padding:24px 32px;border-radius:10px 10px 0 0;">
            <span style="font-size:24px;font-weight:900;color:#fff;">Bid<span style="color:#F97316;">Drop</span></span>
          </div>
          <div style="padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;">
            <h2 style="color:#111;margin:0 0 12px 0;">🔴 Subscription Cancelled — ${companyName}</h2>
            <p style="color:#333;margin:0 0 16px 0;">
              The Stripe subscription for <strong>${companyName}</strong> has been cancelled and their BidDrop account has been <strong style="color:#dc2626;">deactivated</strong>.
            </p>
            <p style="color:#333;margin:0;">
              Stripe Customer: <code>${stripeCustomerId}</code><br>
              Subscription: <code>${subscription.id}</code>
            </p>
          </div>
        </div>
      `;
      await sendEmail(ADMIN_EMAIL, `🔴 BidDrop: Subscription cancelled — ${companyName}`, adminHtml);

      return res.status(200).json({
        received: true,
        account_id: account.id,
        account_name: companyName,
        action: 'deactivated',
      });

    } catch (err) {
      console.error('[billing-webhook] Error processing subscription.deleted:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // All other event types — acknowledge and skip
  return res.status(200).json({ received: true, skipped: `event type ${event.type} not handled` });
}
