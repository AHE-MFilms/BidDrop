/**
 * BidDrop Default Email Templates
 * Used as fallback when no DB override exists for a given template key.
 * Each template supports {{variable}} substitution via replaceVars().
 */

const BRAND_HEADER = `<div style="background:#111;padding:24px 32px;border-radius:10px 10px 0 0;"><span style="font-size:24px;font-weight:900;color:#fff;">Bid<span style="color:#F97316;">Drop</span></span></div>`;
const BRAND_FOOTER = `<p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0;">Questions? <a href="mailto:support@biddrop.io" style="color:#F97316;">support@biddrop.io</a></p>`;
const WRAP_START   = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">` + BRAND_HEADER + `<div style="padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;">`;
const WRAP_END     = BRAND_FOOTER + `</div></div>`;
const CTA_BTN      = (url, label) => `<a href="${url}" style="display:block;background:#F97316;color:#fff;text-decoration:none;text-align:center;padding:14px 24px;border-radius:8px;font-size:16px;font-weight:700;margin-bottom:24px;">${label}</a>`;

const DEFAULT_TEMPLATES = {

  welcome_payg: {
    subject: 'Welcome to BidDrop! 🎉',
    html: WRAP_START +
      `<h2 style="color:#111;margin:0 0 12px 0;">Welcome to BidDrop, {{company_name}}!</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">Your account is ready. You're on the <strong>Pay-as-you-go plan</strong> — purchase credits whenever you need to send postcards.</p>` +
      `<p style="color:#333;margin:0 0 8px 0;"><strong>Your login:</strong></p>` +
      `<ul style="color:#333;margin:0 0 24px 0;padding-left:20px;line-height:1.8;">` +
        `<li>Email: <strong>{{email}}</strong></li>` +
        `<li>Temporary password: <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">{{temp_password}}</code></li>` +
      `</ul>` +
      `<p style="color:#333;margin:0 0 24px 0;">Change your password after first login. Questions? Reply to this email.</p>` +
      CTA_BTN('https://biddrop.us', 'Open BidDrop →') +
      WRAP_END,
    text: `Welcome to BidDrop, {{company_name}}!\n\nYour account is ready on the Pay-as-you-go plan.\n\nEmail: {{email}}\nTemp password: {{temp_password}}\n\nChange your password after first login.\n\nhttps://biddrop.us`,
  },

  welcome_monthly: {
    subject: '🎉 Welcome to BidDrop Monthly!',
    html: WRAP_START +
      `<h2 style="color:#111;margin:0 0 12px 0;">Welcome to BidDrop Monthly, {{company_name}}!</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">Your account is ready. Here's what's included with your <strong>Monthly Plan ($99/mo)</strong>:</p>` +
      `<ul style="color:#333;margin:0 0 16px 0;padding-left:20px;line-height:1.8;">` +
        `<li><strong>40 free postcard credits</strong> every month</li>` +
        `<li>Unlimited canvassing pins</li>` +
        `<li>Full estimate builder with satellite data</li>` +
        `<li>Priority support</li>` +
      `</ul>` +
      `<p style="color:#333;margin:0 0 8px 0;"><strong>Your login:</strong></p>` +
      `<ul style="color:#333;margin:0 0 24px 0;padding-left:20px;line-height:1.8;">` +
        `<li>Email: <strong>{{email}}</strong></li>` +
        `<li>Temporary password: <code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;">{{temp_password}}</code></li>` +
      `</ul>` +
      CTA_BTN('https://biddrop.us', 'Open BidDrop →') +
      WRAP_END,
    text: `Welcome to BidDrop Monthly, {{company_name}}!\n\nYour account includes 40 credits/month, unlimited pins, and satellite data.\n\nEmail: {{email}}\nTemp password: {{temp_password}}\n\nhttps://biddrop.us`,
  },

  plan_upgraded: {
    subject: `🎉 You've upgraded to BidDrop Monthly!`,
    html: WRAP_START +
      `<h2 style="color:#111;margin:0 0 12px 0;">🎉 Welcome to BidDrop Monthly!</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">You've successfully upgraded to the <strong>Monthly Plan ($99/mo)</strong>. Here's what's included:</p>` +
      `<ul style="color:#333;margin:0 0 24px 0;padding-left:20px;line-height:1.8;">` +
        `<li><strong>40 free postcard credits</strong> every month</li>` +
        `<li>Unlimited canvassing pins</li>` +
        `<li>Full estimate builder with satellite data</li>` +
        `<li>Priority support</li>` +
      `</ul>` +
      `<p style="color:#333;margin:0 0 24px 0;">Your credits refresh on your billing date each month. Questions? Reply to this email or visit biddrop.us.</p>` +
      CTA_BTN('https://biddrop.us', 'Open BidDrop →') +
      WRAP_END,
    text: `You've upgraded to BidDrop Monthly ($99/mo)!\n\nIncludes 40 credits/month, unlimited pins, satellite data, and priority support.\n\nhttps://biddrop.us`,
  },

  plan_downgraded: {
    subject: 'Your BidDrop plan has been updated',
    html: WRAP_START +
      `<h2 style="color:#111;margin:0 0 12px 0;">Your plan has been updated</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">You've switched to the <strong>Pay-as-you-go plan</strong>. Your monthly subscription has been cancelled.</p>` +
      `<p style="color:#333;margin:0 0 16px 0;">You can still use BidDrop — just purchase credits when you need to send postcards ($4.00 each, volume discounts available).</p>` +
      `<p style="color:#333;margin:0 0 24px 0;">Any remaining credits in your account are yours to keep and use anytime.</p>` +
      CTA_BTN('https://biddrop.us', 'Open BidDrop →') +
      WRAP_END,
    text: `Your BidDrop plan has been updated to Pay-as-you-go.\n\nYou can still use BidDrop — purchase credits as needed ($4.00 each).\nYour existing credits are safe.\n\nhttps://biddrop.us`,
  },

  payment_failed: {
    subject: '⚠️ BidDrop payment failed — action required',
    html: WRAP_START +
      `<h2 style="color:#dc2626;margin:0 0 12px 0;">⚠️ Payment failed</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">Hey {{company_name}}, we weren't able to process your BidDrop subscription payment.</p>` +
      `<p style="color:#333;margin:0 0 24px 0;">Please update your payment method to keep your account active. Your data is safe — we'll retry the charge automatically.</p>` +
      CTA_BTN('https://biddrop.us', 'Update Payment Method →') +
      WRAP_END,
    text: `BidDrop payment failed.\n\nHey {{company_name}}, we couldn't process your subscription payment. Please update your payment method at https://biddrop.us`,
  },

  low_credits: {
    subject: `⚠️ BidDrop: Only {{credits_left}} credit{{credits_plural}} left — top up now`,
    html: WRAP_START +
      `<h2 style="color:#dc2626;margin:0 0 12px 0;">⚠️ You're running low on credits</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">Hey {{company_name}}, you have <strong>{{credits_left}} credit{{credits_plural}} remaining</strong> in your BidDrop account.</p>` +
      `<p style="color:#333;margin:0 0 24px 0;">Each postcard costs 1 credit ($4.00). Top up now so your follow-up campaigns keep running without interruption.</p>` +
      CTA_BTN('https://biddrop.us', 'Buy More Credits →') +
      WRAP_END,
    text: `You're running low on BidDrop credits.\n\nHey {{company_name}}, you have {{credits_left}} credit{{credits_plural}} remaining.\n\nBuy more at https://biddrop.us`,
  },

  trial_ending_10: {
    subject: '⏳ Your BidDrop trial ends in 10 days',
    html: WRAP_START +
      `<h2 style="color:#111;margin:0 0 12px 0;">Your trial ends soon</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">Hey {{company_name}}, your BidDrop free trial ends in about <strong>10 days</strong>.</p>` +
      `<p style="color:#333;margin:0 0 24px 0;">Upgrade to keep access to your pins, estimates, and campaigns. Monthly plan is $99/mo with 40 free postcard credits.</p>` +
      CTA_BTN('https://biddrop.us', 'Upgrade Now →') +
      WRAP_END,
    text: `Your BidDrop trial ends in 10 days.\n\nHey {{company_name}}, upgrade to keep your pins, estimates, and campaigns.\n\nhttps://biddrop.us`,
  },

  trial_ending_2: {
    subject: '🚨 Your BidDrop trial ends in 2 days',
    html: WRAP_START +
      `<h2 style="color:#dc2626;margin:0 0 12px 0;">🚨 Trial ending in 2 days</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">Hey {{company_name}}, your BidDrop trial expires in <strong>2 days</strong>. Don't lose your data.</p>` +
      `<p style="color:#333;margin:0 0 24px 0;">Upgrade now to keep everything — your pins, estimates, campaigns, and rep profiles.</p>` +
      CTA_BTN('https://biddrop.us', 'Upgrade Before It Expires →') +
      WRAP_END,
    text: `Your BidDrop trial expires in 2 days.\n\nHey {{company_name}}, upgrade now to keep your pins, estimates, and campaigns.\n\nhttps://biddrop.us`,
  },

  trial_expired_admin: {
    subject: '🔔 BidDrop trial expired: {{company_name}}',
    html: WRAP_START +
      `<h2 style="color:#111;margin:0 0 12px 0;">Trial expired: {{company_name}}</h2>` +
      `<p style="color:#333;margin:0 0 16px 0;">Account <strong>{{company_name}}</strong> ({{email}}) trial has expired and they have not upgraded.</p>` +
      `<p style="color:#333;margin:0 0 24px 0;">Consider reaching out to convert them.</p>` +
      WRAP_END,
    text: `Trial expired: {{company_name}} ({{email}}) has not upgraded. Consider reaching out.`,
  },

  new_signup_alert: {
    subject: '🎉 New BidDrop signup: {{company_name}}',
    html: WRAP_START +
      `<h2 style="color:#111;margin:0 0 12px 0;">New signup!</h2>` +
      `<p style="color:#333;margin:0 0 8px 0;"><strong>Company:</strong> {{company_name}}</p>` +
      `<p style="color:#333;margin:0 0 8px 0;"><strong>Email:</strong> {{email}}</p>` +
      `<p style="color:#333;margin:0 0 8px 0;"><strong>Plan:</strong> {{plan}}</p>` +
      `<p style="color:#333;margin:0 0 24px 0;"><strong>Signed up:</strong> {{signed_up_at}}</p>` +
      WRAP_END,
    text: `New BidDrop signup!\n\nCompany: {{company_name}}\nEmail: {{email}}\nPlan: {{plan}}\nSigned up: {{signed_up_at}}`,
  },

};

/**
 * Replace {{variable}} placeholders in a template string.
 */
function replaceVars(str, vars = {}) {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] !== undefined ? vars[k] : '');
}

/**
 * Fetch a template from the DB, falling back to the hardcoded default.
 * Returns { subject, html, text } with vars already substituted.
 */
async function getEmailTemplate(key, vars = {}, sbFetchFn) {
  let tpl = DEFAULT_TEMPLATES[key];
  // Try DB override
  if (sbFetchFn) {
    try {
      const r = await sbFetchFn(`email_templates?key=eq.${encodeURIComponent(key)}&select=subject,html_body,text_body&limit=1`);
      if (r.ok) {
        const rows = await r.json();
        if (rows && rows[0]) {
          tpl = { subject: rows[0].subject, html: rows[0].html_body, text: rows[0].text_body || '' };
        }
      }
    } catch (_) { /* fall through to default */ }
  }
  if (!tpl) return null;
  return {
    subject: replaceVars(tpl.subject, vars),
    html:    replaceVars(tpl.html,    vars),
    text:    replaceVars(tpl.text || '', vars),
  };
}

module.exports = { DEFAULT_TEMPLATES, getEmailTemplate, replaceVars };
