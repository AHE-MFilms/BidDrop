/**
 * BidDrop Credits API — Vercel Serverless Function
 *
 * Handles:
 *  - POST ?action=checkout  → Create Stripe Checkout session for a credit pack
 *  - POST ?action=webhook   → Stripe webhook to fulfil credit purchases
 *  - GET  ?action=balance   → Return current credit balance
 *
 * Credit model: 1 credit = $4.00 = 1 postcard mailed
 * Bulk packs give more credits for less money (volume discount).
 */
import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const SUPABASE_URL   = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const STRIPE_KEY     = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const APP_URL        = process.env.APP_URL || 'https://biddrop.americashomeexperts.com';

// 1 credit = $4.00 = 1 postcard mailed. Volume discounts at 100+ credits.
const CREDIT_PACKS = {
  pack_10:  { credits:    10, amount_cents:   4000, label: '10 Credits',    description: '10 postcards — $4.00 each',                              savings: null   },
  pack_50:  { credits:    50, amount_cents:  20000, label: '50 Credits',    description: '50 postcards — $4.00 each',                              savings:     0  },
  pack_100: { credits:   100, amount_cents:  38000, label: '100 Credits',   description: '100 postcards — $3.80 each — Save $20 (5% off)',         savings:  2000  },
  pack_500: { credits:   500, amount_cents: 180000, label: '500 Credits',   description: '500 postcards — $3.60 each — Save $200 (10% off)',       savings: 20000  },
  pack_1k:  { credits:  1000, amount_cents: 340000, label: '1,000 Credits', description: '1,000 postcards — $3.40 each — Save $600 (15% off)',     savings: 60000  },
};

// Free mailer credits per month by plan
const PLAN_FREE_CREDITS = { starter: 5, pro: 15, agency: 30, enterprise: 60 };

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...opts.headers
  };
  return fetch(url, { ...opts, headers });
}

async function verifyCallerJwt(req) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return await r.json();
}

async function getCallerProfile(userId) {
  const r = await sbFetch(`user_profiles?id=eq.${userId}&select=id,role,account_id`);
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const { action } = req.query;

  // ── Stripe Webhook ────────────────────────────────────────────────────────
  if (action === 'webhook') {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    const rawBody = await getRawBody(req);
    const stripe = new Stripe(STRIPE_KEY);
    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error('[webhook] Signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { account_id, pack_id, purchase_id } = session.metadata || {};
      const pack = CREDIT_PACKS[pack_id];
      if (!pack || !account_id) {
        console.error('[webhook] Missing metadata', session.metadata);
        res.status(200).json({ received: true });
        return;
      }
      if (purchase_id) {
        await sbFetch(`credit_purchases?id=eq.${purchase_id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            stripe_payment_id: session.payment_intent,
            completed_at: new Date().toISOString()
          })
        });
      }
      // Add mailer credits to account
      const acctRes = await sbFetch(`accounts?id=eq.${account_id}&select=id,mailer_credits`);
      if (acctRes.ok) {
        const accts = await acctRes.json();
        if (accts.length) {
          const current = accts[0].mailer_credits || 0;
          await sbFetch(`accounts?id=eq.${account_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ mailer_credits: current + pack.credits })
          });
          console.log(`[webhook] Added ${pack.credits} mailer credits to account ${account_id}`);
        }
      }
    }
    res.status(200).json({ received: true });
    return;
  }

  // ── Authenticated actions ─────────────────────────────────────────────────
  const caller = await verifyCallerJwt(req);
  if (!caller) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const profile = await getCallerProfile(caller.id);
  if (!profile) { res.status(403).json({ error: 'No profile found' }); return; }
  const stripe = new Stripe(STRIPE_KEY);

  try {
    switch (action) {

      case 'checkout': {
        if (req.method !== 'POST') { res.status(405).end(); return; }
        const { pack_id } = req.body;
        const pack = CREDIT_PACKS[pack_id];
        if (!pack) { res.status(400).json({ error: 'Invalid pack_id' }); return; }
        const purchaseRes = await sbFetch('credit_purchases', {
          method: 'POST',
          body: JSON.stringify({
            account_id:        profile.account_id,
            credits_purchased: pack.credits,
            amount_cents:      pack.amount_cents,
            status:            'pending'
          })
        });
        const purchaseRows = await purchaseRes.json();
        const purchaseId = purchaseRows[0]?.id;
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: { name: `BidDrop — ${pack.label}`, description: pack.description },
              unit_amount: pack.amount_cents,
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${APP_URL}?credits_success=1&pack=${pack_id}`,
          cancel_url:  `${APP_URL}?credits_cancelled=1`,
          metadata: { account_id: profile.account_id, pack_id, purchase_id: String(purchaseId || '') },
        });
        if (purchaseId) {
          await sbFetch(`credit_purchases?id=eq.${purchaseId}`, {
            method: 'PATCH',
            body: JSON.stringify({ stripe_session_id: session.id })
          });
        }
        res.status(200).json({ checkout_url: session.url });
        break;
      }

      case 'balance': {
        const acctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=mailer_credits,free_mailer_credits_used,free_mailer_credits_reset,plan`
        );
        if (!acctRes.ok) { res.status(500).json({ error: 'Failed to fetch balance' }); return; }
        const accts = await acctRes.json();
        if (!accts.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const acct = accts[0];
        const plan = (acct.plan || 'starter').toLowerCase();
        const freeLimit = PLAN_FREE_CREDITS[plan] || PLAN_FREE_CREDITS.starter;
        const today = new Date().toISOString().slice(0, 10);
        const resetMonth = (acct.free_mailer_credits_reset || '').slice(0, 7);
        const thisMonth  = today.slice(0, 7);
        let freeUsed = acct.free_mailer_credits_used || 0;
        if (resetMonth !== thisMonth) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ free_mailer_credits_used: 0, free_mailer_credits_reset: today })
          });
          freeUsed = 0;
        }
        res.status(200).json({
          paid_credits:   acct.mailer_credits || 0,
          free_used:      freeUsed,
          free_limit:     freeLimit,
          free_remaining: Math.max(0, freeLimit - freeUsed),
          plan,
          packs: CREDIT_PACKS
        });
        break;
      }

      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
    }
  } catch (err) {
    console.error('[BidDrop Credits API]', err);
    res.status(500).json({ error: err.message });
  }
}
