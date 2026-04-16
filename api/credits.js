/**
 * BidDrop Credits API — Vercel Serverless Function
 *
 * Handles:
 *  - POST ?action=checkout  → Create Stripe Checkout session for a credit pack
 *  - POST ?action=webhook   → Stripe webhook to fulfil credit purchases
 */

import Stripe from 'stripe';

// Vercel: disable body parsing so we get the raw body for Stripe webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body from Vercel request
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const APP_URL      = process.env.APP_URL || 'https://biddrop.americashomeexperts.com';

// Credit packs: { id, credits, amount_cents, label }
const CREDIT_PACKS = {
  pack_50:   { credits: 50,   amount_cents: 1250, label: '50 Lookup Credits'    },
  pack_200:  { credits: 200,  amount_cents: 5000, label: '200 Lookup Credits'   },
  pack_500:  { credits: 500,  amount_cents: 12500, label: '500 Lookup Credits'  },
  pack_1000: { credits: 1000, amount_cents: 25000, label: '1,000 Lookup Credits' },
};

// ── CORS helper ───────────────────────────────────────────────────────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Supabase REST helper ──────────────────────────────────────────────────────
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

// ── Verify caller JWT ─────────────────────────────────────────────────────────
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

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { action } = req.query;

  // ── Stripe Webhook (no auth — verified by signature) ─────────────────────
  if (action === 'webhook') {
    if (req.method !== 'POST') { res.status(405).end(); return; }

    const stripe = new Stripe(STRIPE_KEY);
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      const rawBody = await getRawBody(req);
      event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
    } catch (err) {
      console.error('[webhook] signature verification failed:', err.message);
      res.status(400).json({ error: `Webhook error: ${err.message}` });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const accountId = session.metadata?.account_id;
      const packId    = session.metadata?.pack_id;
      const pack      = CREDIT_PACKS[packId];

      if (!accountId || !pack) {
        console.error('[webhook] missing metadata', session.metadata);
        res.status(200).json({ received: true }); // Still 200 to prevent retries
        return;
      }

      // Mark purchase as completed
      await sbFetch(
        `credit_purchases?stripe_session_id=eq.${session.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'completed',
            stripe_payment_id: session.payment_intent,
            completed_at: new Date().toISOString()
          })
        }
      );

      // Add credits to account
      // Use a safe increment: fetch current, add, update
      const acctRes = await sbFetch(`accounts?id=eq.${accountId}&select=id,lookup_credits`);
      if (acctRes.ok) {
        const accts = await acctRes.json();
        if (accts.length) {
          const current = accts[0].lookup_credits || 0;
          await sbFetch(`accounts?id=eq.${accountId}`, {
            method: 'PATCH',
            body: JSON.stringify({ lookup_credits: current + pack.credits })
          });
          console.log(`[webhook] Added ${pack.credits} credits to account ${accountId}`);
        }
      }
    }

    res.status(200).json({ received: true });
    return;
  }

  // ── All other actions require authentication ──────────────────────────────
  const caller = await verifyCallerJwt(req);
  if (!caller) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const profile = await getCallerProfile(caller.id);
  if (!profile) { res.status(403).json({ error: 'No profile found' }); return; }

  const stripe = new Stripe(STRIPE_KEY);

  try {
    switch (action) {

      // ── Create Stripe Checkout session ──────────────────────────────────
      case 'checkout': {
        if (req.method !== 'POST') { res.status(405).end(); return; }

        const { pack_id } = req.body;
        const pack = CREDIT_PACKS[pack_id];
        if (!pack) { res.status(400).json({ error: 'Invalid pack_id' }); return; }

        // Create a pending purchase record
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

        // Create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: `BidDrop — ${pack.label}`,
                description: `Homeowner lookup credits for BidDrop. $0.25 per lookup.`,
              },
              unit_amount: pack.amount_cents,
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${APP_URL}?credits_success=1&pack=${pack_id}`,
          cancel_url:  `${APP_URL}?credits_cancelled=1`,
          metadata: {
            account_id:  profile.account_id,
            pack_id,
            purchase_id: String(purchaseId || ''),
          },
        });

        // Update purchase record with session ID
        if (purchaseId) {
          await sbFetch(`credit_purchases?id=eq.${purchaseId}`, {
            method: 'PATCH',
            body: JSON.stringify({ stripe_session_id: session.id })
          });
        }

        res.status(200).json({ checkout_url: session.url });
        break;
      }

      // ── Get current credit balance ───────────────────────────────────────
      case 'balance': {
        const acctRes = await sbFetch(
          `accounts?id=eq.${profile.account_id}&select=lookup_credits,free_lookups_used,free_lookups_reset`
        );
        if (!acctRes.ok) { res.status(500).json({ error: 'Failed to fetch balance' }); return; }
        const accts = await acctRes.json();
        if (!accts.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const acct = accts[0];

        // Check if free lookups need monthly reset
        const today = new Date().toISOString().slice(0, 10);
        const resetMonth = (acct.free_lookups_reset || '').slice(0, 7);
        const thisMonth  = today.slice(0, 7);
        let freeUsed = acct.free_lookups_used;
        if (resetMonth !== thisMonth) {
          await sbFetch(`accounts?id=eq.${profile.account_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ free_lookups_used: 0, free_lookups_reset: today })
          });
          freeUsed = 0;
        }

        res.status(200).json({
          paid_credits:  acct.lookup_credits,
          free_used:     freeUsed,
          free_limit:    10,
          free_remaining: Math.max(0, 10 - freeUsed),
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
