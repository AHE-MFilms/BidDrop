/**
 * BidDrop API — User management, invites, Stripe, agency
 * Sub-module of admin.js, called by the main router.
 */
'use strict';
const { SUPABASE_URL, SERVICE_KEY, LOB_KEY, RENTCAST_KEY, AGENCY_ACCT_ID,
  STRIPE_SECRET_KEY, SUPABASE_PAT, TRACERFY_KEY, _checkRate, _checkIdem, sbFetch } = require('./_admin-shared');

/**
 * Handle actions for this module.
 * Returns true if the action was handled, false if unknown (caller should try next module).
 */
async function handle(action, req, res, ctx) {
  const { profile, isSuperAdmin, isAdmin, effectiveAccountId, caller } = ctx;
  switch (action) {
      case 'invite-rep': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { email: invEmail, name: invName, role: invRole } = req.body;
        if (!invEmail || !invName) { res.status(400).json({ error: 'email and name required' }); return; }
        const repRole = ['rep', 'admin'].includes(invRole) ? invRole : 'rep';
        // Check plan rep limit
        const PLAN_MAX_REPS_INV = { starter: 1, pro: 3, agency: 10, enterprise: 999 };
        const acctRespInv = await sbFetch(`accounts?id=eq.${effectiveAccountId}&select=plan,company_name`);
        const acctsInv = acctRespInv.ok ? await acctRespInv.json() : [];
        const acctInv = acctsInv[0] || {};
        const maxRepsInv = PLAN_MAX_REPS_INV[acctInv.plan] ?? 1;
        if (maxRepsInv !== 999) {
          const repCountResp = await sbFetch(`user_profiles?account_id=eq.${effectiveAccountId}&select=id`);
          const repRows = repCountResp.ok ? await repCountResp.json() : [];
          if (repRows.length >= maxRepsInv) {
            res.status(403).json({ error: `Your ${acctInv.plan || 'current'} plan allows up to ${maxRepsInv} team member(s). Upgrade to add more reps.` }); return;
          }
        }
        // Generate temp password
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let tempPw = '';
        for (let i = 0; i < 8; i++) tempPw += chars[Math.floor(Math.random() * chars.length)];
        // Create Supabase auth user
        const authRespInv = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: invEmail, password: tempPw, email_confirm: true, user_metadata: { name: invName } })
        });
        const authDataInv = await authRespInv.json();
        if (!authRespInv.ok) { res.status(authRespInv.status).json({ error: authDataInv.message || 'Failed to create user' }); return; }
        const newUserId = authDataInv.id;
        // Create user_profiles row
        await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ id: newUserId, account_id: effectiveAccountId, role: repRole, name: invName, email: invEmail, must_change_password: true })
        }).catch(e => console.error('[invite-rep] profile insert error:', e));
        // Send invite email via Resend
        const invLoginUrl = (process.env.APP_URL || 'https://biddrop.americashomeexperts.com').trim();
        const invEmailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;color:#111"><div style="background:#111;padding:28px 32px;border-radius:10px 10px 0 0"><span style="font-size:26px;font-weight:900;color:#fff">Bid<span style="color:#F97316">Drop</span></span></div><div style="padding:36px 32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px"><h1 style="font-size:24px;font-weight:800;margin:0 0 12px">You've been added to ${acctInv.company_name || 'BidDrop'} &#127881;</h1><p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">You've been invited to join the BidDrop team for <strong>${acctInv.company_name || 'your company'}</strong> as a <strong>${repRole === 'admin' ? 'Team Admin' : 'Field Rep'}</strong>.</p><div style="background:#f8f8f8;border:1px solid #e0e0e0;border-left:4px solid #F97316;border-radius:8px;padding:24px;margin-bottom:24px"><p style="font-size:12px;color:#666;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;font-weight:700">Your Login Credentials</p><p style="margin:0 0 10px;font-size:15px"><strong>Email:</strong> ${invEmail}</p><p style="margin:0 0 10px;font-size:15px"><strong>Temp Password:</strong> <span style="color:#F97316;font-size:20px;font-weight:800;letter-spacing:1px">${tempPw}</span></p><p style="font-size:13px;color:#666;margin:12px 0 0">You'll be prompted to change your password after logging in.</p></div><a href="${invLoginUrl}" style="display:block;background:#F97316;color:#fff;text-decoration:none;text-align:center;padding:16px 24px;border-radius:8px;font-size:17px;font-weight:800;margin-bottom:24px">Log In to BidDrop &#8594;</a><p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0">For help, contact <a href="mailto:support@biddrop.io" style="color:#F97316">support@biddrop.io</a></p></div></div>`;
        const resendKeyInv = process.env.RESEND_API_KEY;
        if (resendKeyInv) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${resendKeyInv}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: 'BidDrop <noreply@biddrop.io>', to: [invEmail], subject: `You've been added to ${acctInv.company_name || 'BidDrop'} on BidDrop`, html: invEmailHtml })
          }).catch(e => console.error('[invite-rep] email send error:', e));
        }
        res.status(200).json({ success: true, userId: newUserId, tempPassword: tempPw });
        break;
      }

      // ── Create Supabase auth user (super_admin or admin) ──────────────────
      case 'create-user': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { email, password, name } = req.body;
        if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name } })
        });
        const d = await r.json();
        // 422 = email already exists in Supabase Auth (e.g. previously deleted account re-registration)
        // Recover: find the existing auth user, reset their password, and return their record
        if (r.status === 422) {
          try {
            const listR = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
              headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
            });
            const listD = await listR.json();
            const existingUser = (listD.users || []).find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
            if (!existingUser) {
              res.status(422).json({ error: 'Email already registered in auth but could not be located. Please contact support.' }); return;
            }
            // Reset password so the new account can use it
            const resetR = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`, {
              method: 'PUT',
              headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ password, email_confirm: true, user_metadata: { name } })
            });
            const resetD = await resetR.json();
            if (!resetR.ok) { res.status(resetR.status).json({ error: resetD.message || 'Could not recover existing auth user' }); return; }
            console.log(`[create-user] Recovered existing auth user ${existingUser.id} for ${email}`);
            res.status(200).json(resetD);
            return;
          } catch (recoverErr) {
            res.status(422).json({ error: 'Email already registered. ' + (recoverErr.message || '') }); return;
          }
        }
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'Create user failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Reset a user's password (super_admin only) ────────────────────────
      case 'reset-password': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { userId, password } = req.body;
        if (!userId || !password) { res.status(400).json({ error: 'userId and password required' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'PUT',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, email_confirm: true })
        });
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'Reset failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Cancel a Stripe subscription (super_admin only) ─────────────────────
      case 'cancel-stripe-subscription': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { accountId: cancelAcctId } = req.body;
        if (!cancelAcctId) { res.status(400).json({ error: 'accountId required' }); return; }
        // Fetch the stripe_subscription_id from the account
        const acctRes = await sbFetch(`accounts?id=eq.${cancelAcctId}&select=stripe_subscription_id,stripe_customer_id,company_name`);
        if (!acctRes.ok) { res.status(500).json({ error: 'Failed to fetch account' }); return; }
        const accts = await acctRes.json();
        if (!accts.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const acct = accts[0];
        const subId = acct.stripe_subscription_id;
        if (!subId) {
          // No subscription to cancel — just return success
          res.status(200).json({ success: true, message: 'No Stripe subscription found — nothing to cancel.' });
          return;
        }
        // Cancel the subscription at period end (client keeps access until billing cycle ends)
        const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(STRIPE_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'cancel_at_period_end=true'
        });
        const stripeData = await stripeRes.json();
        if (!stripeRes.ok) {
          console.error('[cancel-stripe-subscription] Stripe error:', stripeData);
          res.status(stripeRes.status).json({ error: stripeData.error?.message || 'Stripe cancellation failed' });
          return;
        }
        console.log(`[cancel-stripe-subscription] Cancelled sub ${subId} for ${acct.company_name}`);
        res.status(200).json({ success: true, subscription_id: subId, status: stripeData.status });
        break;
      }

      // ── Delete a Supabase auth user (super_admin only) ────────────────────
      // Option A: reassign all data to account owner, preserve rep_name for tracking
      case 'delete-user': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { userId } = req.body;
        if (!userId) { res.status(400).json({ error: 'userId required' }); return; }

        // 1. Look up the profile of the user being deleted to get their account_id and name
        const profResp = await sbFetch(`user_profiles?id=eq.${userId}&select=id,account_id,name,email`);
        const profData = await profResp.json();
        if (!profResp.ok || !profData.length) {
          res.status(404).json({ error: 'User profile not found' }); return;
        }
        const delProfile = profData[0];
        const accountId = delProfile.account_id;
        const repName = delProfile.name || delProfile.email || 'Former Rep';

        // 2. Find the account owner (the admin user for this account)
        const ownerResp = await sbFetch(`user_profiles?account_id=eq.${accountId}&role=eq.admin&select=id&limit=1`);
        const ownerData = await ownerResp.json();
        const ownerId = ownerData?.[0]?.id || null;

        if (ownerId && ownerId !== userId) {
          // 3a. Reassign pins: update created_by to owner, preserve rep_name snapshot
          await sbFetch(`pins?created_by=eq.${userId}&account_id=eq.${accountId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ created_by: ownerId, rep_name: repName })
          }).catch(e => console.warn('[delete-user] pins reassign failed:', e.message));

          // 3b. Reassign estimates by account_id + rep field match (rep is a text snapshot, no FK)
          // Note: estimates table does not have a created_by FK — rep name is already stored as text snapshot
          // No reassignment needed; rep name is preserved as-is on each estimate record

          // 3c. Reassign queue items: update created_by to owner, preserve rep_name snapshot
          await sbFetch(`queue?created_by=eq.${userId}&account_id=eq.${accountId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ created_by: ownerId })
          }).catch(e => console.warn('[delete-user] queue reassign failed (non-fatal):', e.message));
        }

        // 3d. Soft-delete the profile row (keep for historical rep name lookups)
        // Always attempt this regardless of whether ownerId was found
        await sbFetch(`user_profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ role: 'deleted' })
        }).catch(e => console.warn('[delete-user] profile soft-delete failed (non-fatal):', e.message));

        // 4. Delete the Supabase Auth user (revokes login)
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        if (!r.ok) { const d = await r.json(); res.status(r.status).json({ error: d.message || 'Delete failed' }); return; }

        res.status(200).json({
          success: true,
          reassigned: !!ownerId,
          repName,
          message: ownerId
            ? `Deleted ${repName}. All their pins, estimates, and mailers have been reassigned to the account owner. Rep name is preserved on each record for tracking.`
            : `Deleted ${repName}. No account owner found to reassign data to.`
        });
        break;
      }

      // ── Update a user's auth email/password (super_admin only) ─────────────
      case 'update-user': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { userId: updateUserId, updates: userUpdates } = req.body;
        if (!updateUserId || !userUpdates) { res.status(400).json({ error: 'userId and updates required' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${updateUserId}`, {
          method: 'PUT',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(userUpdates)
        });
        if (!r.ok) { const d = await r.json(); res.status(r.status).json({ error: d.message || 'Update failed' }); return; }
        res.status(200).json({ success: true });
        break;
      }

      // ── List all auth users (super_admin only) ────────────────────────────
      case 'list-users': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
        });
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'List failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Patch an account row (super_admin, or admin patching their own account) ─
      case 'patch-account': {
        if (!isAdmin) { res.status(403).json({ error: 'Admins only' }); return; }
        const { accountId, updates } = req.body;
        if (!accountId || !updates) { res.status(400).json({ error: 'accountId and updates required' }); return; }
        // Non-super-admins can only patch their own account
        if (!isSuperAdmin && effectiveAccountId !== accountId) {
          res.status(403).json({ error: 'Cannot modify another account' }); return;
        }
        const r = await sbFetch(`accounts?id=eq.${accountId}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify(updates)
        });
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'Patch failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Fetch all accounts (super_admin only) ─────────────────────────────
      case 'list-accounts': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const { select = 'id,name,company_name,company_phone,company_addr,notes,plan,active,mailer_rate,created_at,ghl_api_key,ghl_location_id,ghl_pipeline_id' } = req.query;
        const r = await sbFetch(`accounts?select=${select}&order=created_at.asc`);
        const d = await r.json();
        if (!r.ok) { res.status(r.status).json({ error: d.message || 'List accounts failed' }); return; }
        res.status(200).json(d);
        break;
      }

      // ── Agency view bulk fetch (super_admin only) ─────────────────────────
      case 'agency-data': {
        if (!isSuperAdmin) { res.status(403).json({ error: 'Super admin only' }); return; }
        const [acctRes, profRes, pinsRes, logRes] = await Promise.all([
          sbFetch('accounts?select=id,name,company_name,company_phone,company_addr,notes,plan,active,mailer_rate,mailer_credits,created_at,enable_postcard,enable_letter,slug,ghl_api_key,ghl_location_id,ghl_pipeline_id,enabled_trades,tracerfy_enabled&order=created_at.asc'),
          sbFetch('user_profiles?select=id,account_id,name,email,role'),
          sbFetch('pins?select=id,account_id,status,created_at,rep_name'),
          sbFetch('mailer_log?select=*&order=sent_at.desc&limit=500')
        ]);
        const [accounts, profiles, pins, mailerLog] = await Promise.all([
          acctRes.json(), profRes.json(), pinsRes.json(), logRes.json()
        ]);
        res.status(200).json({ accounts, profiles, pins, mailerLog });
        break;
      }

      // ── Confirm master keys exist (returns booleans only, never the keys) ──
      case 'get-master-keys': {
        res.status(200).json({
          hasLobKey: !!LOB_KEY,
          hasRentcastKey: !!RENTCAST_KEY
        });
        break;
      }

    default:
      return false;
  }
  return true;
}

module.exports = { handle };
