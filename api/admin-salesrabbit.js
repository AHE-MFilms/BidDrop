/**
 * BidDrop SalesRabbit connection management.
 * Stores only a hash of the inbound webhook token; the raw URL is displayed once
 * when an account admin creates or rotates the connection.
 */
'use strict';
const crypto = require('crypto');
const { sbFetch } = require('./_admin-shared');

function esc(v) { return encodeURIComponent(String(v || '')); }
function hashSecret(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

async function handle(action, req, res, ctx) {
  const { isAdmin, effectiveAccountId } = ctx;
  if (!['salesrabbit-connection', 'salesrabbit-create-connection', 'salesrabbit-disable-connection', 'salesrabbit-map-user'].includes(action)) return false;
  if (!isAdmin) { res.status(403).json({ error: 'Account administrators only' }); return true; }
  if (!effectiveAccountId) { res.status(400).json({ error: 'No account selected' }); return true; }

  if (action === 'salesrabbit-connection') {
    const [acctR, teamR] = await Promise.all([
      sbFetch(`accounts?id=eq.${esc(effectiveAccountId)}&select=id,salesrabbit_enabled,salesrabbit_connection_id`),
      sbFetch(`user_profiles?account_id=eq.${esc(effectiveAccountId)}&select=id,name,email,role,salesrabbit_user_id&order=name.asc`)
    ]);
    if (!acctR.ok || !teamR.ok) { res.status(500).json({ error: 'Could not load SalesRabbit settings' }); return true; }
    const account = (await acctR.json())[0] || {};
    const team = await teamR.json();
    res.status(200).json({ ok: true, enabled: !!account.salesrabbit_enabled, connectionId: account.salesrabbit_connection_id || null, team });
    return true;
  }

  if (action === 'salesrabbit-create-connection') {
    const connectionId = crypto.randomUUID();
    const secret = crypto.randomBytes(32).toString('base64url');
    const patchR = await sbFetch(`accounts?id=eq.${esc(effectiveAccountId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        salesrabbit_enabled: true,
        salesrabbit_connection_id: connectionId,
        salesrabbit_webhook_secret_hash: hashSecret(secret)
      })
    });
    if (!patchR.ok) { res.status(500).json({ error: 'Could not create the SalesRabbit connection' }); return true; }
    const baseUrl = (process.env.APP_URL || 'https://biddrop.us').replace(/\/$/, '');
    res.status(200).json({
      ok: true,
      enabled: true,
      connectionId,
      webhookUrl: `${baseUrl}/api/salesrabbit-webhook?connection=${encodeURIComponent(connectionId)}&token=${encodeURIComponent(secret)}`
    });
    return true;
  }

  if (action === 'salesrabbit-disable-connection') {
    const patchR = await sbFetch(`accounts?id=eq.${esc(effectiveAccountId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ salesrabbit_enabled: false, salesrabbit_connection_id: null, salesrabbit_webhook_secret_hash: null })
    });
    if (!patchR.ok) { res.status(500).json({ error: 'Could not disable the SalesRabbit connection' }); return true; }
    res.status(200).json({ ok: true, enabled: false });
    return true;
  }

  const profileId = String(req.body?.profileId || '');
  const salesrabbitUserId = String(req.body?.salesrabbitUserId || '').trim() || null;
  if (!profileId) { res.status(400).json({ error: 'Team member is required' }); return true; }
  const profileR = await sbFetch(`user_profiles?id=eq.${esc(profileId)}&account_id=eq.${esc(effectiveAccountId)}&select=id`);
  if (!profileR.ok || !(await profileR.json()).length) { res.status(404).json({ error: 'Team member not found in this account' }); return true; }
  const mapR = await sbFetch(`user_profiles?id=eq.${esc(profileId)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ salesrabbit_user_id: salesrabbitUserId })
  });
  if (!mapR.ok) { res.status(500).json({ error: 'Could not save SalesRabbit user mapping' }); return true; }
  res.status(200).json({ ok: true, profileId, salesrabbitUserId });
  return true;
}

module.exports = { handle };
