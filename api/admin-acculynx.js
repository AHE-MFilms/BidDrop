/**
 * BidDrop API — AccuLynx CRM Integration
 * Sub-module of admin.js, called by the main router.
 *
 * Handles:
 *   acculynx-save-key   — save API key to account (server-side only)
 *   acculynx-test       — test the API key by calling GET /api/v2/company/settings
 *   acculynx            — generic proxy: any AccuLynx REST API call
 *   acculynx-push-pin   — push a pin (lead) to AccuLynx as a Job + Contact
 */
'use strict';
const { sbFetch } = require('./_admin-shared');

const ACCULYNX_BASE = 'https://api.acculynx.com/api/v2';

/**
 * Make an authenticated AccuLynx REST API call.
 * @param {string} apiKey  - AccuLynx API key
 * @param {string} path    - relative path, e.g. '/company/settings'
 * @param {string} method  - HTTP method
 * @param {object} body    - optional request body
 */
async function acculynxFetch(apiKey, path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(`${ACCULYNX_BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch(e) { data = {}; }
  return { status: res.status, ok: res.ok, data };
}

async function handle(action, req, res, ctx) {
  const { effectiveAccountId, isSuperAdmin } = ctx;

  switch (action) {

    // ── Save AccuLynx API key ─────────────────────────────────────────────
    case 'acculynx-save-key': {
      const { apiKey } = req.body;
      if (typeof apiKey !== 'string') {
        res.status(400).json({ error: 'apiKey required' }); return true;
      }
      await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ acculynx_api_key: apiKey.trim() || null })
      });
      res.json({ success: true });
      return true;
    }

    // ── Test AccuLynx connection ──────────────────────────────────────────
    case 'acculynx-test': {
      const acctRes = await sbFetch(`accounts?id=eq.${effectiveAccountId}&select=acculynx_api_key`);
      const acctRows = await acctRes.json();
      const apiKey = acctRows[0]?.acculynx_api_key;
      if (!apiKey) { res.status(400).json({ error: 'No AccuLynx API key configured' }); return true; }
      const { status, ok, data } = await acculynxFetch(apiKey, '/company/settings');
      if (ok) {
        res.json({ success: true, company: data?.companyName || data?.name || 'Connected' });
      } else {
        res.status(status).json({ error: data?.message || 'AccuLynx API error', status });
      }
      return true;
    }

    // ── Generic AccuLynx proxy ────────────────────────────────────────────
    case 'acculynx': {
      const { path: alPath, method: alMethod = 'GET', body: alBody, accountId: alAcctId } = req.body;
      if (!alPath) { res.status(400).json({ error: 'path required' }); return true; }
      // SSRF guard
      if (typeof alPath !== 'string' || !alPath.startsWith('/') || /[\r\n]|:\/\//.test(alPath)) {
        res.status(400).json({ error: 'Invalid path' }); return true;
      }
      // Safety: never allow DELETE via proxy
      if (alMethod && alMethod.toUpperCase() === 'DELETE') {
        res.status(403).json({ error: 'DELETE not permitted via BidDrop AccuLynx proxy' }); return true;
      }
      const acctId = (isSuperAdmin && alAcctId) ? alAcctId : effectiveAccountId;
      const acctRes = await sbFetch(`accounts?id=eq.${acctId}&select=acculynx_api_key`);
      const acctRows = await acctRes.json();
      const apiKey = acctRows[0]?.acculynx_api_key;
      if (!apiKey) { res.status(400).json({ error: 'No AccuLynx API key configured' }); return true; }
      const { status, data } = await acculynxFetch(apiKey, alPath, alMethod, alBody || null);
      res.status(status).json(data);
      return true;
    }

    // ── Push pin as a Job + Contact to AccuLynx ───────────────────────────
    case 'acculynx-push-pin': {
      const { pinId, owner, address, phone, email, total, sqft, pitch, photoUrl, repName, accountId: pushAcctId } = req.body;
      const acctId = (isSuperAdmin && pushAcctId) ? pushAcctId : effectiveAccountId;

      // Fetch API key
      const acctRes = await sbFetch(`accounts?id=eq.${acctId}&select=acculynx_api_key,company_name`);
      const acctRows = await acctRes.json();
      const apiKey = acctRows[0]?.acculynx_api_key;
      if (!apiKey) { res.status(400).json({ error: 'No AccuLynx API key configured for this account' }); return true; }

      // Parse address into components (AccuLynx requires structured address)
      // Format: "123 Main St, Canton, MI 48188" or "123 Main St, Canton, Michigan 48188"
      let streetAddress = address || '';
      let city = '', state = '', zip = '';
      const addrMatch = address && address.match(/^(.+),\s*([^,]+),\s*([A-Z]{2}|[A-Za-z]+)\s+(\d{5}(?:-\d{4})?)$/);
      if (addrMatch) {
        streetAddress = addrMatch[1].trim();
        city          = addrMatch[2].trim();
        state         = addrMatch[3].trim();
        zip           = addrMatch[4].trim();
      }

      // Parse owner name into first/last
      const nameParts = (owner || 'Homeowner').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Homeowner';
      const lastName  = nameParts.slice(1).join(' ') || '';

      // 1. Create or find Contact
      let contactId = null;
      try {
        // Search for existing contact by address
        const searchRes = await acculynxFetch(apiKey, '/contacts/search', 'POST', {
          searchTerm: streetAddress,
          pageSize: 5,
          recordStartIndex: 0
        });
        if (searchRes.ok && searchRes.data?.items?.length > 0) {
          // Use first match
          contactId = searchRes.data.items[0].contactId || searchRes.data.items[0].id;
        }
      } catch(e) { /* search failed — will create new */ }

      if (!contactId) {
        // Create new contact
        const contactBody = {
          firstName,
          lastName,
          ...(email ? { emailAddresses: [{ emailAddress: email, isPrimary: true }] } : {}),
          ...(phone ? { phoneNumbers: [{ phoneNumber: phone, isPrimary: true }] } : {})
        };
        const createContactRes = await acculynxFetch(apiKey, '/contacts', 'POST', contactBody);
        if (!createContactRes.ok) {
          console.warn('[AccuLynx] Contact create failed:', createContactRes.data);
          // Non-fatal — continue to create job without contact
        } else {
          contactId = createContactRes.data?.contactId || createContactRes.data?.id;
        }
      }

      // 2. Create Job
      const jobBody = {
        jobAddress: {
          streetAddress,
          city,
          state,
          zip
        },
        ...(contactId ? { primaryContactId: contactId } : {}),
        leadSourceName: 'BidDrop',
        jobCategoryName: 'Roofing',
        ...(repName ? { salesRepName: repName } : {}),
        // Store BidDrop pin ID as external reference (set after job creation)
      };

      const createJobRes = await acculynxFetch(apiKey, '/jobs', 'POST', jobBody);
      if (!createJobRes.ok) {
        res.status(createJobRes.status).json({
          error: createJobRes.data?.message || 'Failed to create AccuLynx job',
          details: createJobRes.data
        });
        return true;
      }

      const jobId = createJobRes.data?.jobId || createJobRes.data?.id;

      // 3. Add external reference (BidDrop pin ID) for deduplication
      if (jobId && pinId) {
        acculynxFetch(apiKey, `/jobs/${jobId}/externalreferences`, 'POST', {
          externalId: pinId,
          externalSource: 'BidDrop'
        }).catch(e => console.warn('[AccuLynx] External ref failed:', e.message));
      }

      // 4. Add manual measurements if we have sqft/pitch
      if (jobId && sqft) {
        acculynxFetch(apiKey, `/jobs/${jobId}/measurements/manual`, 'POST', {
          roofingSquares: Math.round(sqft / 100 * 10) / 10, // convert sqft to squares
          ...(pitch ? { pitch } : {})
        }).catch(e => console.warn('[AccuLynx] Measurements failed:', e.message));
      }

      // 5. Add a job note with BidDrop estimate details
      if (jobId) {
        const noteLines = [
          '📋 BidDrop Estimate',
          `Address: ${address || 'N/A'}`,
          total ? `Estimate Total: $${Number(total).toLocaleString()}` : '',
          sqft  ? `Roof Area: ${sqft} sq ft` : '',
          pitch ? `Pitch: ${pitch}/12` : '',
          repName ? `Rep: ${repName}` : '',
          `Synced from BidDrop on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        ].filter(Boolean).join('\n');

        acculynxFetch(apiKey, `/jobs/${jobId}/messages`, 'POST', {
          message: noteLines
        }).catch(e => console.warn('[AccuLynx] Note failed:', e.message));
      }

      res.json({ success: true, jobId, contactId });
      return true;
    }

    default:
      return false;
  }
}

module.exports = { handle };
