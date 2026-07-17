// /api/signup.js
// Creates a Stripe Checkout session for new BidDrop signups.
// 30-day free trial — $0 due today, card charged after trial ends.
// Stores customer info in Stripe metadata for webhook to use.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs for each plan (monthly recurring).
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_1TuE9ZACMaED04opUcqpS98m',
  // payg has no Stripe price — free account, no subscription
};

// Monthly mailer credits per plan (given on signup as bonus)
const PLAN_MAILER_CREDITS = {
  monthly: 40,
  payg: 0,
};

// Max users per plan — must match PLAN_MAX_REPS_INV in admin-users.js
const PLAN_MAX_REPS = {
  monthly: 10,
  payg: 1,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    firstName,
    lastName,
    companyName,
    email,
    phone,
    streetAddress,
    city,
    zip,
    state,
    plan,
    planName,
    planPrice,
    // Brand & Pricing (Step 3 — all optional)
    brandColor,
    licenseNum,
    tradeType,
    pricePerSquare,
    costGutter,
    offerGutters,
    // Logo is base64 — too large for Stripe metadata, handled post-account-creation
  } = req.body;

  // Basic validation
  if (!firstName || !lastName || !companyName || !email || !phone || !state || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate plan
  if (!['monthly', 'payg'].includes(plan)) {
    return res.status(400).json({ error: `Unknown plan: ${plan}. Please contact support.` });
  }

  const priceId = PRICE_IDS[plan]; // undefined for payg — handled below (no Stripe checkout)

  try {
    // Create or retrieve Stripe customer
    // Check if customer already exists by email to avoid duplicates
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];

      // Check if they already have an active or trialing subscription
      // to prevent duplicate signups on the same account
      const existingSubs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 10,
      });
      const activeSub = existingSubs.data.find(s =>
        ['active', 'trialing', 'past_due'].includes(s.status)
      );
      if (activeSub) {
        return res.status(409).json({
          error: 'active_subscription',
          message: 'An active subscription already exists for this email address. Please log in to your existing BidDrop account, or contact support if you need help.',
        });
      }

      // Update metadata in case they're re-signing up
      customer = await stripe.customers.update(customer.id, {
        name: `${firstName} ${lastName}`,
        phone,
        metadata: {
          company_name: companyName,
          first_name: firstName,
          last_name: lastName,
          street_address: streetAddress || '',
          city: city || '',
          zip: zip || '',
          state,
          plan,
          plan_name: planName,
          plan_price: String(planPrice),
          signup_source: 'signup_page',
          brand_color: brandColor || '',
          license_num: licenseNum || '',
          trade_type: tradeType || 'roofing',
          price_per_square: pricePerSquare ? String(pricePerSquare) : '',
          cost_gutter: costGutter ? String(costGutter) : '',
          offer_gutters: offerGutters ? '1' : '0',
        },
      });
    } else {
      customer = await stripe.customers.create({
        email,
        name: `${firstName} ${lastName}`,
        phone,
        metadata: {
          company_name: companyName,
          first_name: firstName,
          last_name: lastName,
          street_address: streetAddress || '',
          city: city || '',
          zip: zip || '',
          state,
          plan,
          plan_name: planName,
          plan_price: String(planPrice),
          signup_source: 'signup_page',
          brand_color: brandColor || '',
          license_num: licenseNum || '',
          trade_type: tradeType || 'roofing',
          price_per_square: pricePerSquare ? String(pricePerSquare) : '',
          cost_gutter: costGutter ? String(costGutter) : '',
          offer_gutters: offerGutters ? '1' : '0',
        },
      });
    }

    // ── Pay-as-you-go: no Stripe checkout needed — create account directly ──
    if (plan === 'payg') {
      // Create the Supabase account directly via the signup-webhook logic
      // by calling the internal account creation endpoint
      const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
      const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + Date.now().toString(36);
      const accountRecord = {
        name: companyName,
        company_name: companyName,
        company_phone: phone || null,
        company_addr: [streetAddress, city, state, zip].filter(Boolean).join(', ') || null,
        plan: 'payg',
        active: true,
        mailer_credits: 0,
        mailer_rate: 4.00,
        slug,
        stripe_customer_id: customer.id,
        stripe_subscription_id: null,
        trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: `Signed up via BidDrop signup page. Plan: Pay-as-you-go. Stripe customer: ${customer.id}.`,
        ...(brandColor    ? { brand_color: brandColor }             : {}),
        ...(licenseNum    ? { license_num: licenseNum }             : {}),
        ...(pricePerSquare ? { cost_architectural: pricePerSquare } : {}),
        ...(costGutter    ? { cost_gutter: costGutter }             : {}),
        offer_gutters: offerGutters || false,
      };
      const createResp = await fetch(`${SUPABASE_URL}/rest/v1/accounts`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(accountRecord),
      });
      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error('[signup/payg] Supabase insert error:', errText);
        return res.status(500).json({ error: 'Failed to create account. Please contact support@biddrop.io.' });
      }
      const [newAccount] = await createResp.json();
      // Provision Supabase auth user and send welcome email via admin endpoint
      // (same flow as signup-webhook does for monthly)
      // For now return success — admin will provision credentials manually or via webhook
      return res.status(200).json({ success: true, account_id: newAccount?.id });
    }

    // ── Monthly plan: create Stripe Checkout Session ──
    // trial_period_days = 30 means $0 today, first charge after trial ends
    // IMPORTANT: When `customer` is set, `customer_email` must be completely omitted
    // (not just undefined) — Stripe rejects requests that include both.
    const sessionParams = {
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          company_name: companyName,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          street_address: streetAddress || '',
          city: city || '',
          zip: zip || '',
          state,
          plan,
          plan_name: planName,
          plan_price: String(planPrice),
          mailer_credits: String(PLAN_MAILER_CREDITS[plan] || 10),
          max_reps: String(PLAN_MAX_REPS[plan] || 1),
          brand_color: brandColor || '',
          license_num: licenseNum || '',
          trade_type: tradeType || 'roofing',
          price_per_square: pricePerSquare ? String(pricePerSquare) : '',
          cost_gutter: costGutter ? String(costGutter) : '',
          offer_gutters: offerGutters ? '1' : '0',
        },
      },
      success_url: `${(process.env.APP_URL || 'https://biddrop.us').trim()}/signup?success=1`,
      cancel_url: `${(process.env.APP_URL || 'https://biddrop.us').trim()}/signup`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        company_name: companyName,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        street_address: streetAddress || '',
        city: city || '',
        zip: zip || '',
        state,
        plan,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[signup] Stripe error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
