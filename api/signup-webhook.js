// /api/signup-webhook.js
// Stripe webhook handler for new BidDrop signups.
// Triggered by: checkout.session.completed
//
// What this does on successful signup:
// 1. Extracts customer info from Stripe metadata
// 2. Creates a Supabase auth user (email + temp password)
// 3. Creates an account record in the `accounts` table
// 4. Sends a welcome email with login credentials
// 5. (GHL placeholder) — ready to add when BidDrop GHL account is set up
//
// Required Vercel env vars:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET_SIGNUP  (separate from credits webhook secret)
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//   SENDGRID_API_KEY  (or use Resend — see below)
//   APP_URL  (e.g. https://biddrop.americashomeexperts.com)

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Plan config — must match api/signup.js
const PLAN_CONFIG = {
  starter: {
    name: 'Starter',
    price: 97,
    mailer_credits: 10,
    max_reps: 1,
    max_pins_per_month: 250,
    offer_ghl: false,
    offer_estimate_pages: false,
    offer_analytics: false,
    offer_solar: false,
    offer_multi_rep: false,
    offer_white_label: false,
  },
  pro: {
    name: 'Pro',
    price: 197,
    mailer_credits: 25,
    max_reps: 3,
    max_pins_per_month: 1000,
    offer_ghl: true,
    offer_estimate_pages: true,
    offer_analytics: true,
    offer_solar: true,
    offer_multi_rep: false,
    offer_white_label: false,
  },
  agency: {
    name: 'Agency',
    price: 397,
    mailer_credits: 50,
    max_reps: 10,
    max_pins_per_month: null, // unlimited
    offer_ghl: true,
    offer_estimate_pages: true,
    offer_analytics: true,
    offer_solar: true,
    offer_multi_rep: true,
    offer_white_label: false,
  },
  enterprise: {
    name: 'Enterprise',
    price: 797,
    mailer_credits: 100,
    max_reps: null, // unlimited
    max_pins_per_month: null, // unlimited
    offer_ghl: true,
    offer_estimate_pages: true,
    offer_analytics: true,
    offer_solar: true,
    offer_multi_rep: true,
    offer_white_label: true,
  },
};

// Generate a random secure password
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

// Generate a unique account slug from company name
function generateSlug(companyName) {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) + '-' + Math.random().toString(36).slice(2, 7);
}

// Send welcome email via Resend (or swap for SendGrid)
// Uses Resend API — add RESEND_API_KEY to Vercel env vars
// Alternatively, set SENDGRID_API_KEY and swap the fetch call
async function sendWelcomeEmail({ email, firstName, companyName, planName, tempPassword, loginUrl }) {
  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  const subject = `Welcome to BidDrop — Your Account Is Ready 🎉`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px 32px; border-radius: 12px;">
      <div style="margin-bottom: 32px;">
        <span style="font-size: 28px; font-weight: 900; color: #ffffff;">Bid<span style="color: #F97316;">Drop</span></span>
      </div>
      <h1 style="font-size: 28px; font-weight: 800; margin-bottom: 16px; color: #ffffff;">
        You're in, ${firstName}! 🎉
      </h1>
      <p style="font-size: 16px; color: #aaaaaa; line-height: 1.6; margin-bottom: 24px;">
        Your BidDrop account for <strong style="color: #ffffff;">${companyName}</strong> is ready to go. 
        You're on the <strong style="color: #F97316;">${planName} Plan</strong> with a 60-day free trial — 
        no charge until your trial ends.
      </p>
      
      <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 24px; margin-bottom: 28px;">
        <p style="font-size: 14px; color: #888; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Your Login Credentials</p>
        <p style="margin-bottom: 8px;"><strong style="color: #888;">Email:</strong> <span style="color: #ffffff;">${email}</span></p>
        <p style="margin-bottom: 8px;"><strong style="color: #888;">Temp Password:</strong> <span style="color: #F97316; font-size: 18px; font-weight: 800; letter-spacing: 1px;">${tempPassword}</span></p>
        <p style="font-size: 13px; color: #555; margin-top: 12px;">You can change your password after logging in.</p>
      </div>

      <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); border-radius: 10px; padding: 16px 20px; margin-bottom: 28px;">
        <p style="font-size: 14px; color: #22c55e; font-weight: 700; margin-bottom: 4px;">✓ 10 Free Mailer Credits Added</p>
        <p style="font-size: 13px; color: #aaa;">Your account has been loaded with 10 free mailer credits to get you started right away.</p>
      </div>

      <a href="${loginUrl}" style="display: block; background: #F97316; color: #ffffff; text-decoration: none; text-align: center; padding: 16px 24px; border-radius: 10px; font-size: 18px; font-weight: 800; margin-bottom: 24px;">
        Log In to BidDrop →
      </a>

      <p style="font-size: 13px; color: #555; line-height: 1.6;">
        Questions? Reply to this email or contact us at 
        <a href="mailto:support@biddrop.io" style="color: #F97316;">support@biddrop.io</a>
      </p>
    </div>
  `;

  if (resendKey) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BidDrop <noreply@biddrop.io>',
        to: [email],
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[signup-webhook] Resend email error:', err);
    }
  } else if (sendgridKey) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: 'noreply@biddrop.io', name: 'BidDrop' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[signup-webhook] SendGrid email error:', err);
    }
  } else {
    console.warn('[signup-webhook] No email provider configured (RESEND_API_KEY or SENDGRID_API_KEY missing)');
  }
}

// ============================================================
// GHL — Create contact in BidDrop sub-account on signup
// Uses GHL API v2 with Private Integration token
// Env vars: GHL_API_KEY, GHL_LOCATION_ID
// ============================================================
async function createGHLContact({ firstName, lastName, email, phone, companyName, planName }) {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.warn('[signup-webhook] GHL not configured — skipping contact creation');
    return null;
  }
  try {
    const resp = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: firstName || '',
        lastName: lastName || '',
        email,
        phone: phone || '',
        companyName: companyName || '',
        locationId: GHL_LOCATION_ID,
        tags: ['biddrop - signup', `plan-${planName.toLowerCase()}`, 'trial-60-day'],
        source: 'BidDrop Signup Page',
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('[signup-webhook] GHL contact creation failed:', resp.status, JSON.stringify(data));
      return null;
    }
    console.log('[signup-webhook] GHL contact created:', data?.contact?.id);
    return data?.contact?.id || null;
  } catch (err) {
    console.error('[signup-webhook] GHL contact creation error:', err.message);
    return null;
  }
}
// ============================================================

// Vercel: disable default body parsing so we get the raw buffer for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to collect raw body buffer
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Stripe webhook signature
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SIGNUP;

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[signup-webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature error: ${err.message}` });
  }

  // Only handle checkout.session.completed
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;

  // Only handle sessions from signup page
  if (session.metadata?.signup_source !== 'signup_page' && 
      !session.metadata?.company_name) {
    return res.status(200).json({ received: true, skipped: true });
  }

  const {
    company_name: companyName,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    state,
    plan,
    plan_name: planName,
  } = session.metadata || {};

  // Fallback to customer email if metadata email missing
  const customerEmail = email || session.customer_details?.email;

  if (!customerEmail || !plan) {
    console.error('[signup-webhook] Missing required metadata:', session.metadata);
    return res.status(200).json({ received: true, error: 'Missing metadata' });
  }

  const planConfig = PLAN_CONFIG[plan] || PLAN_CONFIG.starter;

  try {
    // ---- 1. Check if account already exists (idempotency) ----
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (existingAccount) {
      console.log('[signup-webhook] Account already exists for:', customerEmail);
      return res.status(200).json({ received: true, skipped: 'already_exists' });
    }

    // ---- 2. Create Supabase auth user ----
    const tempPassword = generatePassword(12);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true, // auto-confirm so they can log in immediately
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        plan,
      },
    });

    if (authError) {
      // If user already exists in auth, try to get their ID
      if (authError.message?.includes('already registered')) {
        console.warn('[signup-webhook] Auth user already exists:', customerEmail);
      } else {
        throw new Error(`Auth user creation failed: ${authError.message}`);
      }
    }

    const authUserId = authData?.user?.id;

    // ---- 3. Create account record in Supabase ----
    const slug = generateSlug(companyName || firstName + '-' + lastName);
    const accountSlug = slug;

    const accountRecord = {
      // Core info
      company_name: companyName || `${firstName} ${lastName}`,
      email: customerEmail,
      phone: phone || null,
      state: state || null,
      slug: accountSlug,

      // Plan info
      plan: plan,
      plan_name: planConfig.name,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,

      // Trial
      trial_ends_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      is_trial: true,

      // Credits — 10 free mailers on signup (NOT the monthly plan credits)
      mailer_credits: 10, // signup bonus
      free_mailer_credits_used: 0,
      lookup_credits: 0,
      free_lookups_used: 0,

      // Plan limits
      max_reps: planConfig.max_reps,
      max_pins_per_month: planConfig.max_pins_per_month,

      // Feature flags
      offer_ghl: planConfig.offer_ghl,
      offer_estimate_pages: planConfig.offer_estimate_pages,
      offer_analytics: planConfig.offer_analytics,
      offer_solar: planConfig.offer_solar,
      offer_multi_rep: planConfig.offer_multi_rep,
      offer_white_label: planConfig.offer_white_label,

      // Auth
      auth_user_id: authUserId || null,

      // Meta
      trade: 'roofing',
      signup_source: 'signup_page',
      created_at: new Date().toISOString(),
      is_active: true,
    };

    const { data: newAccount, error: accountError } = await supabase
      .from('accounts')
      .insert(accountRecord)
      .select()
      .single();

    if (accountError) {
      throw new Error(`Account creation failed: ${accountError.message}`);
    }

    console.log('[signup-webhook] Account created:', newAccount.id, customerEmail, plan);

    // ---- 4. Send welcome email ----
    const loginUrl = process.env.APP_URL || 'https://biddrop.americashomeexperts.com';
    await sendWelcomeEmail({
      email: customerEmail,
      firstName: firstName || 'there',
      companyName: companyName || 'your company',
      planName: planConfig.name,
      tempPassword,
      loginUrl,
    });

    // ---- 5. GHL — Create contact in BidDrop sub-account ----
    const ghlContactId = await createGHLContact({
      firstName,
      lastName,
      email: customerEmail,
      phone,
      companyName,
      planName: planConfig.name,
    });
    // Optionally store ghl_contact_id on the account record
    if (ghlContactId && newAccount?.id) {
      await supabase
        .from('accounts')
        .update({ ghl_contact_id: ghlContactId })
        .eq('id', newAccount.id);
    }

    return res.status(200).json({ received: true, success: true, accountId: newAccount.id });

  } catch (err) {
    console.error('[signup-webhook] Error provisioning account:', err.message);
    // Return 200 to Stripe so it doesn't retry — log the error for manual review
    return res.status(200).json({ received: true, error: err.message });
  }
}
