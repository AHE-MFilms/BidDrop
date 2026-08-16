// /api/signup.js
// Creates a Stripe Checkout session for new BidDrop signups.
// Monthly: $99/mo — charged immediately on signup, no trial.
// Pay-as-you-go: requires card via Stripe SetupIntent (off_session), then creates account
//   with 2 welcome credits. No monthly charge — credits at $4 each when needed.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs for each plan (monthly recurring).
const PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_1TuE9ZACMaED04opUcqpS98m',
  omnipresent: process.env.STRIPE_PRICE_OMNIPRESENT || 'price_1U2ytFACMaED04opNATKiGUm',
  // payg has no Stripe price — no subscription, card on file only
};

// Monthly mailer credits per plan (given on signup as bonus)
// Monthly accounts also receive their 20 included credits on first billing cycle via webhook.
const PLAN_MAILER_CREDITS = {
  monthly: 40,
  omnipresent: 500,
  payg: 0,
};

// Welcome credits given to every new account on signup (both plans)
const WELCOME_CREDITS = 2;

// Max users per plan — must match PLAN_MAX_REPS_INV in admin-users.js
const PLAN_MAX_REPS = {
  monthly: 10,
  omnipresent: 10,
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
    aheInterest,
    // PAYG card confirmation step
    setupIntentId,
    // Password for immediate login
    password,
    // Logo is base64 — too large for Stripe metadata, handled post-account-creation
  } = req.body;

  const AHE_INTEREST_OPTIONS = new Set([
    'Contractor website',
    'Video and social visibility',
    'Local SEO and Google Business Profile',
    'Meta or Google lead generation',
    'Reputation management',
    'Full marketing strategy',
  ]);
  const aheInterestList = Array.isArray(aheInterest)
    ? aheInterest.filter(item => AHE_INTEREST_OPTIONS.has(item)).slice(0, 6)
    : [];
  const aheInterestText = aheInterestList.join(' | ');

  // Basic validation
  if (!firstName || !lastName || !companyName || !email || !phone || !state || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Validate plan
  if (!['monthly', 'payg', 'omnipresent'].includes(plan)) {
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
          notes: `Signed up via BidDrop signup page. Plan: Pay-as-you-go. Stripe customer: ${customer.id}. Welcome credits: ${WELCOME_CREDITS}.${aheInterestText ? ` AHE interest: ${aheInterestText}.` : ''}`,
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

        // ── Create Supabase auth user so they can log in immediately ──
        let authUserId = null;
        if (password && password.length >= 8) {
          try {
            // Check if auth user already exists
            const listResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
              headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
            });
            const listData = await listResp.json();
            const existingAuthUser = (listData.users || []).find(u => u.email === email);

            if (existingAuthUser) {
              // Update password for existing user
              authUserId = existingAuthUser.id;
              await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUserId}`, {
                method: 'PUT',
                headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
              });
            } else {
              // Create new auth user
              const authResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
                method: 'POST',
                headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email,
                  password,
                  email_confirm: true,
                  user_metadata: { first_name: firstName, last_name: lastName, company_name: companyName, plan: 'payg' },
                }),
              });
              const authData = await authResp.json();
              authUserId = authData.id;
            }

            // Create user_profile linking auth user to account
            if (authUserId) {
              await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
                method: 'POST',
                headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                  id: authUserId,
                  account_id: newAccount.id,
                  role: 'admin',
                  name: `${firstName} ${lastName}`.trim(),
                  email,
                }),
              });
            }
          } catch (authErr) {
            console.error('[signup/payg] Auth user creation error:', authErr.message);
            // Non-fatal — account was created, user can reset password
          }
        }

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
              tags: ['plan-payg', 'biddrop-signup'].concat(aheInterestList.length ? ['ahe-growth-interest'] : []),
              customFields: [{ key: 'plan', field_value: 'Pay-as-you-go' }],
            }),
          }).catch(e => console.warn('[signup/payg] GHL contact failed:', e.message));
        }

        // 2. Send welcome email to client
        if (RESEND_KEY) {
          const welcomeResult = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'BidDrop <support@biddrop.io>',
              to: [email],
              subject: 'Welcome to BidDrop — Your Account Is Ready 🎉',
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#F97316;">Welcome to BidDrop, ${firstName || companyName}!</h2>
                <p>Your BidDrop account is ready. Log in now at <a href="https://biddrop.us">biddrop.us</a> using your email and the password you created during signup.</p>
                <p>You have <strong>2 welcome credits</strong> to try the platform — credits are $4 each when you need more.</p>
                <p style="color:#6b7280;font-size:12px;">Questions? Reply to this email or visit biddrop.us.</p>
              </div>`,
            }),
          }).catch(e => { console.error('[signup/payg] Welcome email error:', e.message); return null; });
          if (welcomeResult && !welcomeResult.ok) {
            const errBody = await welcomeResult.text().catch(() => '');
            console.error('[signup/payg] Welcome email failed:', welcomeResult.status, errBody);
          }

          // 3. Notify BidDrop leadership after the account is fully provisioned.
          // Await this independent alert so Vercel does not end the function before
          // Resend receives it; alert failure never changes the customer signup result.
          const alertResult = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'BidDrop Alerts <support@biddrop.io>',
              to: ['john@americashomeexperts.com', 'steve@americashomeexperts.com'],
              subject: `🟢 NEW BIDDROP SIGNUP — ${companyName || email}`,
              html: `<div style="font-family:sans-serif;max-width:600px;">
                <h2 style="color:#22c55e;">🟢 New BidDrop Signup (Pay-as-you-go)</h2>
                <p><strong>Company:</strong> ${companyName || '—'}</p>
                <p><strong>Name:</strong> ${firstName || ''} ${lastName || ''}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || '—'}</p>
                <p><strong>Plan:</strong> Pay-as-you-go (Free)</p>
                ${aheInterestText ? `<p><strong>AHE interest:</strong> ${aheInterestText.replace(/ \| /g, ', ')}</p>` : ''}
                <p style="color:#6b7280;font-size:12px;">Account ID: ${newAccount?.id || '—'} | Stripe: ${customer.id}</p>
              </div>`,
            }),
          }).catch(e => { console.warn('[signup/payg] Signup alert failed:', e.message); return null; });
          if (alertResult && !alertResult.ok) {
            console.warn('[signup/payg] Signup alert rejected:', alertResult.status, await alertResult.text().catch(() => ''));
          }
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
    // No trial — charge starts immediately at $99/mo.
    // Monthly accounts get 2 welcome credits immediately via signup-webhook when
    // the subscription is created; the 20 included credits replenish each billing cycle.
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
        ahe_interest: aheInterestText,
      },
    };

    // ── Save password to pending_signups so webhook can use it ──
    // The user typed their password on BidDrop's form. We store it temporarily
    // in Supabase (service-role only, deleted after webhook uses it) so the
    // signup-webhook can create the auth user with the real password instead of
    // a random temp password.
    const SUPABASE_URL_M = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
    const SERVICE_KEY_M  = process.env.SUPABASE_SERVICE_KEY;
    if (password && password.length >= 8 && SERVICE_KEY_M) {
      try {
        await fetch(`${SUPABASE_URL_M}/rest/v1/pending_signups`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY_M,
            'Authorization': `Bearer ${SERVICE_KEY_M}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify({ stripe_customer_id: customer.id, password_hash: password }),
        });
        console.log('[signup/monthly] Saved pending password for customer:', customer.id);
      } catch (e) {
        console.warn('[signup/monthly] Could not save pending password:', e.message);
        // Non-fatal — webhook will fall back to temp password
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[signup] Stripe error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
