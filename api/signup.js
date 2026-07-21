// /api/signup.js
// Creates a Stripe Checkout session for new BidDrop signups.
// Monthly: 30-day free trial via Stripe Checkout — $0 today, card charged after trial.
// Pay-as-you-go: requires card via Stripe SetupIntent (off_session), then creates account
//   with 2 welcome credits. No monthly charge — credits at $4 each when needed.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs for each plan (monthly recurring).
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_1TuE9ZACMaED04opUcqpS98m',
  // payg has no Stripe price — no subscription, card on file only
};

// Monthly mailer credits per plan (given on signup as bonus)
// Monthly accounts also receive their 20 included credits on first billing cycle via webhook.
const PLAN_MAILER_CREDITS = {
  monthly: 40,
  payg: 0,
};

// Welcome credits given to every new account on signup (both plans)
const WELCOME_CREDITS = 2;

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
    // PAYG card confirmation step
    setupIntentId,
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

  const priceId = PRICE_IDS[plan]; // undefined for payg

  try {
    // Create or retrieve Stripe customer
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    let customer;
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];

      // Check if they already have an active or trialing subscription
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

    // ── Pay-as-you-go: require card via Stripe SetupIntent ──
    if (plan === 'payg') {

      // ── Step 2: setupIntentId provided — card confirmed, create account ──
      if (setupIntentId) {
        // Verify the SetupIntent succeeded and belongs to this customer
        const si = await stripe.setupIntents.retrieve(setupIntentId);
        if (si.customer !== customer.id || si.status !== 'succeeded') {
          return res.status(400).json({ error: 'Card setup could not be verified. Please try again.' });
        }

        // Set the confirmed payment method as the customer default for future charges
        await stripe.customers.update(customer.id, {
          invoice_settings: { default_payment_method: si.payment_method },
        });

        // Create the Supabase account with 2 welcome credits
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
          mailer_credits: WELCOME_CREDITS,
          mailer_rate: 4.00,
          slug,
          stripe_customer_id: customer.id,
          stripe_payment_method_id: si.payment_method,
          stripe_subscription_id: null,
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          notes: `Signed up via BidDrop signup page. Plan: Pay-as-you-go. Stripe customer: ${customer.id}. Welcome credits: ${WELCOME_CREDITS}.`,
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

        // ── Post-signup: GHL contact, welcome email, John notification ──
        const RESEND_KEY = process.env.RESEND_API_KEY;
        const GHL_API_KEY = process.env.GHL_API_KEY;
        const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

        // 1. Create GHL contact (fire-and-forget)
        if (GHL_API_KEY && GHL_LOCATION_ID) {
          fetch('https://services.leadconnectorhq.com/contacts/', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${GHL_API_KEY}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28',
            },
            body: JSON.stringify({
              firstName: firstName || '',
              lastName: lastName || '',
              email: email,
              phone: phone || '',
              companyName: companyName || '',
              locationId: GHL_LOCATION_ID,
              tags: ['plan-payg', 'biddrop-signup'],
              customFields: [{ key: 'plan', field_value: 'Pay-as-you-go' }],
            }),
          }).catch(e => console.warn('[signup/payg] GHL contact failed:', e.message));
        }

        // 2. Send welcome email to client
        if (RESEND_KEY) {
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'BidDrop <noreply@biddrop.io>',
              to: [email],
              subject: 'Welcome to BidDrop — Your Account Is Ready 🎉',
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#F97316;">Welcome to BidDrop, ${firstName || companyName}!</h2>
                <p>Your free Pay-as-you-go account is ready. Log in at <a href="https://biddrop.us">biddrop.us</a> to get started.</p>
                <p>You have <strong>2 welcome credits</strong> to try the platform — credits are $4 each when you need more.</p>
                <p style="color:#6b7280;font-size:12px;">Questions? Reply to this email or visit biddrop.us.</p>
              </div>`,
            }),
          }).catch(e => console.warn('[signup/payg] Welcome email failed:', e.message));

          // 3. Notify John
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'BidDrop Alerts <alerts@biddrop.io>',
              to: ['john@mongoosefilms.com'],
              subject: `🟢 NEW SIGNUP (Free) — ${companyName || email}`,
              html: `<div style="font-family:sans-serif;max-width:600px;">
                <h2 style="color:#22c55e;">🟢 New BidDrop Signup (Pay-as-you-go)</h2>
                <p><strong>Company:</strong> ${companyName || '—'}</p>
                <p><strong>Name:</strong> ${firstName || ''} ${lastName || ''}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || '—'}</p>
                <p><strong>Plan:</strong> Pay-as-you-go (Free)</p>
                <p style="color:#6b7280;font-size:12px;">Account ID: ${newAccount?.id || '—'} | Stripe: ${customer.id}</p>
              </div>`,
            }),
          }).catch(e => console.warn('[signup/payg] John notify failed:', e.message));
        }

        return res.status(200).json({ success: true, account_id: newAccount?.id });
      }

      // ── Step 1: No setupIntentId yet — create SetupIntent and return client_secret ──
      // Frontend will mount Stripe Elements, collect card, confirm the SetupIntent,
      // then POST back to this endpoint with setupIntentId to complete account creation.
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        usage: 'off_session', // allows future charges without customer present
        metadata: {
          company_name: companyName,
          plan: 'payg',
          signup_source: 'signup_page',
        },
      });

      return res.status(200).json({
        requiresCard: true,
        setupIntentClientSecret: setupIntent.client_secret,
        customerId: customer.id,
      });
    }

    // ── Monthly plan: create Stripe Checkout Session ──
    // trial_period_days = 30 means $0 today, first charge after trial ends.
    // Monthly accounts get 2 welcome credits immediately via signup-webhook when
    // the subscription is created; the 40 included credits replenish each billing cycle.
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
          welcome_credits: String(WELCOME_CREDITS),
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
