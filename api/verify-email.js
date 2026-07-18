/**
 * api/verify-email.js
 * 
 * Email verification for signup flow.
 * 
 * POST /api/verify-email  { action: 'send', email, name }
 *   → Generates a 6-digit code, stores it in Supabase email_verifications table
 *     (or in-memory if table doesn't exist), sends via Resend.
 *   → Returns { sent: true }
 * 
 * POST /api/verify-email  { action: 'check', email, code }
 *   → Validates the code. Returns { valid: true } or { valid: false, reason }
 *   → Marks code as used on success.
 * 
 * Codes expire after 15 minutes. Max 5 attempts per code.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY           = process.env.RESEND_API_KEY;
const FROM_EMAIL           = 'BidDrop <noreply@biddrop.io>';
const CODE_TTL_MS          = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS         = 5;

// In-memory fallback store (single-instance only — fine for Vercel serverless cold starts)
// Keyed by email, value: { code, expiresAt, attempts, used }
const memStore = new Map();

function supabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(email, name, code) {
  if (!RESEND_KEY) {
    console.warn('[verify-email] No RESEND_API_KEY — skipping email send');
    return;
  }
  const firstName = (name || '').split(' ')[0] || 'there';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;color:#111;">
      <div style="background:#111;padding:28px 32px;border-radius:10px 10px 0 0;">
        <span style="font-size:26px;font-weight:900;color:#fff;">Bid<span style="color:#F97316;">Drop</span></span>
      </div>
      <div style="padding:36px 32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px;">
        <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;">Verify your email address</h1>
        <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 28px;">
          Hi ${firstName}, enter the code below to verify your email and complete your BidDrop signup.
        </p>
        <div style="background:#f5f5f5;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
          <div style="font-size:42px;font-weight:900;letter-spacing:10px;color:#111;font-family:monospace;">${code}</div>
          <div style="font-size:13px;color:#888;margin-top:8px;">This code expires in 15 minutes.</div>
        </div>
        <p style="font-size:13px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0;">
          If you didn't sign up for BidDrop, you can safely ignore this email.<br>
          Questions? <a href="mailto:support@biddrop.io" style="color:#F97316;">support@biddrop.io</a>
        </p>
      </div>
    </div>
  `;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject: `${code} — Your BidDrop verification code`, html }),
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error('[verify-email] Resend error:', errText);
    throw new Error('Failed to send verification email');
  }
}

// Try to use Supabase email_verifications table; fall back to memStore
async function storeCode(email, code) {
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  try {
    const sb = supabase();
    // Upsert: replace any existing code for this email
    const { error } = await sb.from('email_verifications').upsert({
      email: email.toLowerCase(),
      code,
      expires_at: expiresAt,
      attempts: 0,
      used: false,
    }, { onConflict: 'email' });
    if (error) throw error;
  } catch (e) {
    // Table may not exist yet — use in-memory fallback
    console.warn('[verify-email] Supabase store failed, using memStore:', e.message);
    memStore.set(email.toLowerCase(), { code, expiresAt: Date.now() + CODE_TTL_MS, attempts: 0, used: false });
  }
}

async function validateCode(email, inputCode) {
  const key = email.toLowerCase();
  try {
    const sb = supabase();
    const { data, error } = await sb
      .from('email_verifications')
      .select('code, expires_at, attempts, used')
      .eq('email', key)
      .single();
    if (error || !data) throw new Error('not found');
    if (data.used) return { valid: false, reason: 'Code already used. Please request a new one.' };
    if (new Date(data.expires_at) < new Date()) return { valid: false, reason: 'Code expired. Please request a new one.' };
    if (data.attempts >= MAX_ATTEMPTS) return { valid: false, reason: 'Too many attempts. Please request a new code.' };
    // Increment attempts
    await sb.from('email_verifications').update({ attempts: data.attempts + 1 }).eq('email', key);
    if (data.code !== inputCode) return { valid: false, reason: 'Incorrect code.' };
    // Mark used
    await sb.from('email_verifications').update({ used: true }).eq('email', key);
    return { valid: true };
  } catch (e) {
    // Fall back to memStore
    const entry = memStore.get(key);
    if (!entry) return { valid: false, reason: 'No verification code found. Please request a new one.' };
    if (entry.used) return { valid: false, reason: 'Code already used. Please request a new one.' };
    if (Date.now() > entry.expiresAt) return { valid: false, reason: 'Code expired. Please request a new one.' };
    if (entry.attempts >= MAX_ATTEMPTS) return { valid: false, reason: 'Too many attempts. Please request a new code.' };
    entry.attempts++;
    if (entry.code !== inputCode) return { valid: false, reason: 'Incorrect code.' };
    entry.used = true;
    return { valid: true };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, name, code } = req.body || {};

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email is required' });
  }

  if (action === 'send') {
    try {
      const verifyCode = generateCode();
      await storeCode(email, verifyCode);
      await sendVerificationEmail(email, name || '', verifyCode);
      return res.status(200).json({ sent: true });
    } catch (err) {
      console.error('[verify-email] send error:', err);
      return res.status(500).json({ error: err.message || 'Failed to send verification email' });
    }
  }

  if (action === 'check') {
    if (!code) return res.status(400).json({ error: 'code is required' });
    const result = await validateCode(email, String(code).trim());
    return res.status(200).json(result);
  }

  return res.status(400).json({ error: 'Invalid action. Use "send" or "check".' });
}
