// /api/signup.js
// Creates a Stripe Checkout session for new BidDrop signups.
// 60-day free trial — $0 due today, card charged after trial ends.
// Stores customer info in Stripe metadata for webhook to use.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs for each plan (monthly recurring).
// These must be created in your Stripe dashboard as recurring prices.
// Set these env vars in Vercel:
//   STRIPE_PRICE_STARTER   — $97/mo
//   STRIPE_PRICE_PRO       — $197/mo
//   STRIPE_PRICE_AGENCY    — $397/mo
//   STRIPE_PRICE_ENTERPRISE — $797/mo
const PRICE_IDS = {
  starter:    process.env.STRIPE_PRICE_STARTER,
  pro:        process.env.STRIPE_PRICE_PRO,
  agency:     process.env.STRIPE_PRICE_AGENCY,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
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
    const session = await stripe.checkout.sessions.create({
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
      customer_email: existingCustomers.data.length > 0 ? undefined : email,
      success_url: `https://biddrop.americashomeexperts.com/signup?success=1`,
      cancel_url: `https://biddrop.americashomeexperts.com/signup`,
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
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[signup] Stripe error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
