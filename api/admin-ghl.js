/**
 * BidDrop API — GoHighLevel OAuth and CRM push
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
      case 'ghl-oauth-status': {
        // Return OAuth connection status for the caller's account
        const oauthAcctRes = await sbFetch(`accounts?id=eq.${effectiveAccountId}&select=ghl_oauth_access_token,ghl_oauth_expires_at,ghl_oauth_location_id,ghl_location_id`);
        const oauthAcctRows = await oauthAcctRes.json();
        const oauthAcct = oauthAcctRows[0];
        const connected = !!(oauthAcct?.ghl_oauth_access_token);
        const expired = connected && oauthAcct.ghl_oauth_expires_at && new Date(oauthAcct.ghl_oauth_expires_at) < new Date();
        res.json({
          connected,
          expired,
          locationId: oauthAcct?.ghl_oauth_location_id || oauthAcct?.ghl_location_id || null,
          expiresAt: oauthAcct?.ghl_oauth_expires_at || null
        });
        break;
      }
      case 'ghl-oauth-save': {
        // Save OAuth tokens returned from the callback (when no accountId was in state)
        const { access_token, refresh_token, expires_in, location_id } = req.body;
        if (!access_token) { res.status(400).json({ error: 'access_token required' }); return; }
        const expiresAt = new Date(Date.now() + (parseInt(expires_in) || 86400) * 1000).toISOString();
        const saveRes = await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            ghl_oauth_access_token:  access_token,
            ghl_oauth_refresh_token: refresh_token || null,
            ghl_oauth_expires_at:    expiresAt,
            ghl_oauth_location_id:   location_id || null,
            ...(location_id ? { ghl_location_id: location_id } : {})
          })
        });
        if (!saveRes.ok) { const e = await saveRes.text(); res.status(500).json({ error: e }); return; }
        res.json({ success: true });
        break;
      }
      case 'ghl-oauth-disconnect': {
        // Remove OAuth tokens from the account
        await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            ghl_oauth_access_token:  null,
            ghl_oauth_refresh_token: null,
            ghl_oauth_expires_at:    null,
            ghl_oauth_location_id:   null
          })
        });
        res.json({ success: true });
        break;
      }
      case 'ghl': {
        const { path, method: ghlMethod = 'GET', body: ghlBody, accountId: ghlAcctId } = req.body;
        if (!path) { res.status(400).json({ error: 'path required' }); return; }
        // Safety guard: BidDrop must never delete anything in GHL
        if (ghlMethod && ghlMethod.toUpperCase() === 'DELETE') {
          res.status(403).json({ error: 'DELETE operations are not permitted via the BidDrop GHL proxy.' });
          return;
        }

        // Resolve which account to use
        const acctId = ghlAcctId || effectiveAccountId;
        if (!acctId) { res.status(400).json({ error: 'accountId required' }); return; }

        // Fetch the account's GHL credentials - prefer OAuth token, fall back to manual API key
        const acctRes = await sbFetch(`accounts?id=eq.${acctId}&select=ghl_api_key,ghl_oauth_access_token,ghl_oauth_refresh_token,ghl_oauth_expires_at`);
        const acctRows = await acctRes.json();
        const acct = acctRows[0];
        let ghlToken = acct?.ghl_oauth_access_token || acct?.ghl_api_key;
        if (!ghlToken) { res.status(400).json({ error: 'No GHL API key or OAuth connection configured for this account' }); return; }

        // Auto-refresh OAuth token if expired (within 5 min buffer)
        if (acct?.ghl_oauth_access_token && acct?.ghl_oauth_expires_at) {
          const expiresAt = new Date(acct.ghl_oauth_expires_at);
          const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
          if (expiresAt < fiveMinFromNow && acct.ghl_oauth_refresh_token) {
            try {
              const GHL_CLIENT_ID     = process.env.GHL_CLIENT_ID     || '69f796d2528efc733a30a9ab-moq4vxxq';
              const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET || 'dbc9f4c7-ca65-425d-800b-b43ec6a82643';
              const refreshParams = new URLSearchParams({
                client_id: GHL_CLIENT_ID, client_secret: GHL_CLIENT_SECRET,
                grant_type: 'refresh_token', refresh_token: acct.ghl_oauth_refresh_token
              });
              const refreshRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: refreshParams.toString()
              });
              if (refreshRes.ok) {
                const refreshData = await refreshRes.json();
                const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 86400) * 1000).toISOString();
                await sbFetch(`accounts?id=eq.${acctId}`, {
                  method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
                  body: JSON.stringify({
                    ghl_oauth_access_token: refreshData.access_token,
                    ghl_oauth_refresh_token: refreshData.refresh_token || acct.ghl_oauth_refresh_token,
                    ghl_oauth_expires_at: newExpiresAt
                  })
                });
                ghlToken = refreshData.access_token;
              }
            } catch (refreshErr) {
              console.error('[GHL proxy] token refresh failed:', refreshErr.message);
            }
          }
        }

        const ghlRes = await fetch(`https://services.leadconnectorhq.com${path}`, {
          method: ghlMethod,
          headers: {
            'Authorization': `Bearer ${ghlToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          },
          ...(ghlBody ? { body: JSON.stringify(ghlBody) } : {})
        });
        const ghlData = await ghlRes.json();
        res.status(ghlRes.status).json(ghlData);
        break;
      }

      // ── Lob postcard proxy ────────────────────────────────────────────────
    default:
      return false;
  }
  return true;
}

module.exports = { handle };
