// BidDrop password recovery — generates a Supabase recovery link and sends it through Resend.
// This keeps customer login recovery on the verified support@biddrop.io delivery path.
'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const APP_URL = (process.env.APP_URL || 'https://biddrop.us').trim();
const buckets = new Map();

function allowed(key) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.started > 15 * 60 * 1000) {
    buckets.set(key, { started: now, count: 1 });
    return true;
  }
  existing.count += 1;
  return existing.count <= 3;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const generic = { ok: true, message: 'If this email has a BidDrop account, a reset link has been sent.' };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(200).json(generic);
  if (!allowed(`${ip}:${email}`)) return res.status(200).json(generic);
  if (!SERVICE_KEY || !RESEND_KEY) {
    console.error('[auth-reset] Required email configuration is missing');
    return res.status(503).json({ error: 'Password reset is temporarily unavailable. Please contact support@biddrop.io.' });
  }

  try {
    const linkResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'recovery', email, options: { redirectTo: APP_URL } }),
    });
    const linkText = await linkResponse.text();
    if (!linkResponse.ok) {
      console.warn('[auth-reset] Recovery link not generated:', linkResponse.status);
      return res.status(200).json(generic);
    }
    const linkData = linkText ? JSON.parse(linkText) : {};
    const actionLink = linkData?.properties?.action_link || linkData?.action_link || linkData?.properties?.email_action_link;
    if (!actionLink) {
      console.warn('[auth-reset] Recovery link response had no action link');
      return res.status(200).json(generic);
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'BidDrop Support <support@biddrop.io>',
        to: [email],
        subject: 'Reset your BidDrop password',
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111"><div style="background:#111827;padding:26px 30px;border-radius:10px 10px 0 0"><span style="font-size:26px;font-weight:800;color:#fff">Bid<span style="color:#f97316">Drop</span></span></div><div style="border:1px solid #e5e7eb;border-top:none;padding:32px 30px;border-radius:0 0 10px 10px"><h1 style="font-size:22px;margin:0 0 14px">Reset your password</h1><p style="font-size:15px;line-height:1.6">We received a request to reset the password for <strong>${email}</strong>.</p><p style="margin:26px 0"><a href="${actionLink}" style="background:#f97316;color:#fff;text-decoration:none;padding:13px 18px;border-radius:7px;font-weight:700">Reset My Password</a></p><p style="font-size:13px;line-height:1.5;color:#666">If you did not request this, you can ignore this email. For help, contact <a href="mailto:support@biddrop.io" style="color:#f97316">support@biddrop.io</a>.</p></div></div>`,
      }),
    });
    if (!emailResponse.ok) console.error('[auth-reset] Resend delivery failed:', emailResponse.status);
  } catch (error) {
    console.error('[auth-reset] Unexpected error:', error.message);
  }
  return res.status(200).json(generic);
};
