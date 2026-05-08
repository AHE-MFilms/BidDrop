/**
 * BidDrop Billing Webhook — Vercel Serverless Function
 *
 * Triggered by Stripe: invoice.paid
 *
 * What this does:
 *   When a subscription invoice is paid (i.e., after the 60-day trial ends
 *   and every month thereafter), this webhook adds the plan's monthly credit
 *   allotment to the customer's BidDrop account in Supabase.
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
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Monthly credit allotments per plan (after trial, once billing starts)
const PLAN_MONTHLY_CREDITS = {
  starter:    25,
  pro:        50,
  agency:     100,
  enterprise: 200,
};

// Stripe price ID → plan name mapping
// These must match the price IDs in your Stripe dashboard.
// We also fall back to looking at the subscription metadata or product name.
const PRICE_TO_PLAN = {
  // Fill these in if you want hard-coded price ID → plan mapping.
  // e.g. 'price_1ABC123': 'pro',
  // If left empty, we detect plan from the subscription metadata.
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
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

  // Only handle invoice.paid
  if (event.type !== 'invoice.paid') {
    return res.status(200).json({ received: true, skipped: `event type ${event.type} not handled` });
  }

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
    // 1. Find the BidDrop account by stripe_customer_id
    const { data: accounts, error: acctError } = await supabase
      .from('accounts')
      .select('id, name, plan, mailer_credits, stripe_customer_id, stripe_subscription_id')
      .eq('stripe_customer_id', stripeCustomerId)
      .eq('active', true);

    if (acctError) {
      throw new Error(`Supabase account lookup failed: ${acctError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      console.warn('[billing-webhook] No active BidDrop account found for Stripe customer:', stripeCustomerId);
      return res.status(200).json({ received: true, skipped: 'no matching account' });
    }

    // Use the first matching account (should only be one)
    const account = accounts[0];
    const plan = account.plan || 'starter';
    const creditsToAdd = PLAN_MONTHLY_CREDITS[plan] ?? PLAN_MONTHLY_CREDITS.starter;
    const newCredits = (account.mailer_credits || 0) + creditsToAdd;

    console.log(`[billing-webhook] Topping up account ${account.id} (${account.name}) plan=${plan}: +${creditsToAdd} credits (${account.mailer_credits} → ${newCredits})`);

    // 2. Add credits to the account
    const { error: updateError } = await supabase
      .from('accounts')
      .update({ mailer_credits: newCredits })
      .eq('id', account.id);

    if (updateError) {
      throw new Error(`Failed to update credits: ${updateError.message}`);
    }

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
    // Return 500 so Stripe retries the webhook
    return res.status(500).json({ error: err.message });
  }
}
