// /api/signup.js
// Creates a Stripe Checkout session for new BidDrop signups.
// 60-day free trial — $0 due today, card charged after trial ends.
// Stores customer info in Stripe metadata for webhook to use.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs for each plan (monthly recurring).
// Enterprise is custom/contact-us only — no Stripe price ID.
const PRICE_IDS = {
  starter:    process.env.STRIPE_PRICE_STARTER,
  pro:        process.env.STRIPE_PRICE_PRO,
  agency:     process.env.STRIPE_PRICE_AGENCY,
};

// Monthly mailer credits per plan (given on signup as bonus)
const PLAN_MAILER_CREDITS = {
  starter: 10,
  pro: 25,
  agency: 50,
  enterprise: 100,
};

// Max reps per plan
const PLAN_MAX_REPS = {
  starter: 1,
  pro: 3,
  agency: 10,
  enterprise: 999,
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
    state,
    plan,
    planName,
    planPrice,
  } = req.body;

  // Basic validation
  if (!firstName || !lastName || !companyName || !email || !phone || !state || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Enterprise is custom — not available via self-serve checkout
  if (plan === 'enterprise') {
    return res.status(400).json({
      error: 'enterprise_contact',
      message: 'Enterprise is a custom plan. Please contact us at support@biddrop.io to get started.',
    });
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return res.status(400).json({ error: `Unknown plan: ${plan}. Please contact support.` });
  }

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
          state,
          plan,
          plan_name: planName,
          plan_price: String(planPrice),
          signup_source: 'signup_page',
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
          state,
          plan,
          plan_name: planName,
          plan_price: String(planPrice),
          signup_source: 'signup_page',
        },
      });
    }

    // Create Stripe Checkout Session
    // trial_period_days = 60 means $0 today, first charge in 60 days
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
        trial_period_days: 60,
        metadata: {
          company_name: companyName,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          state,
          plan,
          plan_name: planName,
          plan_price: String(planPrice),
          mailer_credits: String(PLAN_MAILER_CREDITS[plan] || 10),
          max_reps: String(PLAN_MAX_REPS[plan] || 1),
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
