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
// NOTE: mailer_credits here is the TRIAL starting amount (10 for all plans).
// Monthly credit allotments only apply after the trial ends and billing begins.
const PLAN_CONFIG = {
  starter: {
    name: 'Starter',
    price: 97,
    mailer_credits: 10,  // trial start credits
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
    mailer_credits: 10,  // trial start credits (25/mo kicks in after trial)
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
    mailer_credits: 10,  // trial start credits (50/mo kicks in after trial)
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
    mailer_credits: 10,  // trial start credits (100/mo kicks in after trial)
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
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; color: #111111;">
      <!-- Header -->
      <div style="background: #111111; padding: 28px 32px; border-radius: 10px 10px 0 0;">
        <span style="font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">Bid<span style="color: #F97316;">Drop</span></span>
      </div>
      <!-- Body -->
      <div style="padding: 36px 32px; background: #ffffff; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h1 style="font-size: 26px; font-weight: 800; margin: 0 0 12px 0; color: #111111;">
          You're in, ${firstName}! 🎉
        </h1>
        <p style="font-size: 16px; color: #333333; line-height: 1.6; margin: 0 0 28px 0;">
          Your BidDrop account for <strong style="color: #111111;">${companyName}</strong> is ready to go.
          You're on the <strong style="color: #F97316;">${planName} Plan</strong> with a 60-day free trial —
          no charge until your trial ends.
        </p>

        <!-- Credentials Box -->
        <div style="background: #f8f8f8; border: 1px solid #e0e0e0; border-left: 4px solid #F97316; border-radius: 8px; padding: 24px; margin-bottom: 28px;">
          <p style="font-size: 12px; color: #666666; margin: 0 0 14px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700;">Your Login Credentials</p>
          <p style="margin: 0 0 10px 0; font-size: 15px; color: #111111;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0 0 10px 0; font-size: 15px; color: #111111;"><strong>Temp Password:</strong> <span style="color: #F97316; font-size: 20px; font-weight: 800; letter-spacing: 1px;">${tempPassword}</span></p>
          <p style="font-size: 13px; color: #666666; margin: 12px 0 0 0;">You'll be prompted to change your password after logging in.</p>
        </div>

        <!-- Credits Badge -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 28px;">
          <p style="font-size: 14px; color: #16a34a; font-weight: 700; margin: 0 0 4px 0;">✓ 10 Free Mailer Credits Added</p>
          <p style="font-size: 13px; color: #333333; margin: 0;">Your account has been loaded with 10 free mailer credits to get you started right away.</p>
        </div>

        <!-- CTA Button -->
        <a href="${loginUrl}" style="display: block; background: #F97316; color: #ffffff; text-decoration: none; text-align: center; padding: 16px 24px; border-radius: 8px; font-size: 17px; font-weight: 800; margin-bottom: 28px;">
          Log In to BidDrop →
        </a>

        <p style="font-size: 12px; color: #999999; line-height: 1.6; margin: 0; border-top: 1px solid #eeeeee; padding-top: 20px;">
          This is a no-reply email — please do not reply directly to this message.<br>
          For help, contact us at <a href="mailto:support@biddrop.io" style="color: #F97316;">support@biddrop.io</a>
        </p>
      </div>
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_SIGNUP || process.env.STRIPE_WEBHOOK_SECRET;

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

  // Retrieve the full session with subscription expanded so we can access
  // subscription metadata (set via subscription_data.metadata in signup.js)
  let fullSession = session;
  try {
    fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['subscription', 'customer'],
    });
  } catch (err) {
    console.warn('[signup-webhook] Could not expand session:', err.message);
  }

  // Metadata can live in 3 places — check all of them in priority order:
  // 1. session.metadata (set directly on checkout session)
  // 2. subscription.metadata (set via subscription_data.metadata)
  // 3. customer.metadata (set on the Stripe customer object)
  const sessionMeta = fullSession.metadata || {};
  const subMeta = fullSession.subscription?.metadata || {};
  const customerMeta = fullSession.customer?.metadata || {};

  const meta = { ...customerMeta, ...subMeta, ...sessionMeta };

  console.log('[signup-webhook] Combined metadata:', JSON.stringify(meta));

  // Only handle sessions from signup page — check all metadata sources
  if (!meta.company_name && !meta.signup_source) {
    console.log('[signup-webhook] Skipping — no signup metadata found');
    return res.status(200).json({ received: true, skipped: true });
  }

  const companyName = meta.company_name;
  const firstName   = meta.first_name;
  const lastName    = meta.last_name;
  const email       = meta.email;
  const phone       = meta.phone;
  const state       = meta.state;
  const plan        = meta.plan;
  const planName    = meta.plan_name;

  // Fallback to customer email if metadata email missing
  const customerEmail = email || fullSession.customer_details?.email || fullSession.customer?.email;

  if (!customerEmail || !plan) {
    console.error('[signup-webhook] Missing required metadata. Combined meta:', JSON.stringify(meta));
    return res.status(200).json({ received: true, error: 'Missing metadata', meta });
  }

  const planConfig = PLAN_CONFIG[plan] || PLAN_CONFIG.starter;

  try {
    // ---- 1. Check if account already exists (idempotency) ----
    // Check user_profiles table by email since accounts table has no email column.
    // IMPORTANT: Ignore soft-deleted profiles (role='deleted') — these are from
    // accounts that were deleted. Also verify the linked account actually exists.
    const { data: existingProfiles } = await supabase
      .from('user_profiles')
      .select('id, account_id, role')
      .eq('email', customerEmail);
    // Find a non-deleted profile that has a valid account
    // NOTE: user_profiles has no deleted_at column — soft-delete is role='deleted'
    let existingProfile = null;
    let activeAccountExists = false;
    if (existingProfiles && existingProfiles.length > 0) {
      for (const p of existingProfiles) {
        // Skip soft-deleted profiles (role='deleted' is the soft-delete marker)
        if (p.role === 'deleted') continue;
        if (p.account_id) {
          // Verify the account actually exists in the accounts table
          const { data: acct } = await supabase
            .from('accounts')
            .select('id')
            .eq('id', p.account_id)
            .maybeSingle();
          if (acct) {
            existingProfile = p;
            activeAccountExists = true;
            break;
          }
        } else {
          // Profile exists but no account linked — use this auth user ID
          existingProfile = p;
        }
      }
    }
    if (activeAccountExists) {
      console.log('[signup-webhook] Active account already exists for:', customerEmail);
      return res.status(200).json({ received: true, skipped: 'already_exists' });
    }

    // ---- 2. Create Supabase auth user ----
    const tempPassword = generatePassword(12);
    let authUserId = null;

    // Always try to create the auth user fresh.
    // If the account was previously deleted, the auth user may or may not still exist.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        plan,
      },
    });

    if (authError) {
      // Auth user already exists — look them up by email and reuse their ID
      console.warn('[signup-webhook] Auth user creation error:', authError.message, '— looking up existing user');
      const { data: existingAuthList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const existingAuthUser = existingAuthList?.users?.find(u => u.email?.toLowerCase() === customerEmail.toLowerCase());
      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        // Reset their password so the welcome email credentials work
        await supabase.auth.admin.updateUserById(existingAuthUser.id, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName, company_name: companyName, plan },
        }).catch(e => console.warn('[signup-webhook] Could not update existing auth user:', e.message));
        console.log('[signup-webhook] Reusing existing auth user:', authUserId);
      } else {
        // Auth user doesn't exist but createUser failed for another reason — hard fail
        throw new Error(`Auth user creation failed: ${authError.message}`);
      }
    } else {
      authUserId = authData?.user?.id;
      console.log('[signup-webhook] New auth user created:', authUserId);
    }

    // ---- 3. Create account record using the REAL schema ----
    // accounts table columns: name, company_name, company_phone, plan, active,
    // mailer_credits, mailer_rate, lookup_credits, slug, notes
    const slug = generateSlug(companyName || `${firstName}-${lastName}`);

    // mailer_rate by plan (cost per mailer to the account)
    const mailerRateByPlan = { starter: 2.50, pro: 2.50, agency: 2.50, enterprise: 2.50 };

    const stripeCustomerId = fullSession.customer?.id || session.customer || null;
    const stripeSubscriptionId = fullSession.subscription?.id || fullSession.subscription || null;

    const accountRecord = {
      name: companyName || `${firstName} ${lastName}`,
      company_name: companyName || `${firstName} ${lastName}`,
      company_phone: phone || null,
      plan: plan,
      active: true,
      mailer_credits: planConfig.mailer_credits || 10,
      mailer_rate: mailerRateByPlan[plan] || 2.50,
      lookup_credits: 0,
      free_lookups_used: 0,
      slug: slug,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      trial_ends_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      notes: `Signed up via BidDrop signup page. Plan: ${planConfig.name}. Stripe customer: ${stripeCustomerId}. Trial ends: ${new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString()}.`,
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

    // ---- 4. Create user_profile record linking auth user to account ----
    // Use upsert so that if a soft-deleted profile row already exists for this
    // auth user ID (primary key conflict), it gets updated instead of failing.
    if (authUserId) {
      const profileData = {
        id: authUserId,
        account_id: newAccount.id,
        role: 'admin',
        name: `${firstName || ''} ${lastName || ''}`.trim() || companyName,
        email: customerEmail,
        phone: phone || null,
        must_change_password: true,
        // NOTE: user_profiles has no deleted_at column — do not include it
      };
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(profileData, { onConflict: 'id' });
      if (profileError) {
        // This is FATAL — without a profile row the user cannot log in
        throw new Error(`user_profiles upsert failed: ${profileError.message}`);
      }
      console.log('[signup-webhook] user_profiles row created/updated for:', authUserId);
    }

    // ---- 5. Send welcome email ----
    const loginUrl = (process.env.APP_URL || 'https://biddrop.americashomeexperts.com').trim();
    await sendWelcomeEmail({
      email: customerEmail,
      firstName: firstName || 'there',
      companyName: companyName || 'your company',
      planName: planConfig.name,
      tempPassword,
      loginUrl,
    });

    // ---- 6. GHL — Create contact in BidDrop sub-account ----
    const ghlContactId = await createGHLContact({
      firstName,
      lastName,
      email: customerEmail,
      phone,
      companyName,
      planName: planConfig.name,
    });

    return res.status(200).json({ received: true, success: true, accountId: newAccount.id });

  } catch (err) {
    console.error('[signup-webhook] Error provisioning account:', err.message, err.stack);
    // Return 200 to Stripe so it doesn't retry — log the error for manual review
    return res.status(200).json({ received: true, error: err.message });
  }
}
