/**
 * BidDrop API — Lob postcard sending (campaign, estimate reveal, letter)
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
      case 'lob-postcard': {
        const POSTCARD_CREDITS = 1; // 1 credit = $4.00 = 1 postcard
        const { payload, idempotency_key: pcIdemKey, paid_by_unlock: pcPaidByUnlock } = req.body;
        if (!payload) { res.status(400).json({ error: 'payload required' }); return; }
        // Rate limit: max 5 postcards per 10 seconds per account
        if (!_checkRate(`lob:${effectiveAccountId}`, 5, 10000)) {
          res.status(429).json({ error: 'rate_limited', message: 'Too many postcard requests. Please wait a moment and try again.' }); return;
        }
        // Idempotency: reject duplicate sends within 30 seconds
        if (pcIdemKey && !_checkIdem(`${effectiveAccountId}:${pcIdemKey}`)) {
          res.status(200).json({ _duplicate: true, message: 'Duplicate request ignored.' }); return;
        }
        // Fetch current credit balance
        const pcAcctRes = await sbFetch(
          `accounts?id=eq.${effectiveAccountId}&select=id,plan,mailer_credits`
        );
        if (!pcAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account credits' }); return; }
        const pcAcctRows = await pcAcctRes.json();
        if (!pcAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const pcAcct = pcAcctRows[0];
        const pcPaid  = pcAcct.mailer_credits || 0;
        // paid_by_unlock: postcard was pre-paid when the pin was unlocked — no additional credit deduction
        if (!pcPaidByUnlock) {
          if (pcPaid < POSTCARD_CREDITS) {
            res.status(402).json({
              error: 'no_credits',
              message: `Sending a postcard costs ${POSTCARD_CREDITS} credit ($4.00). You have ${pcPaid} credits. Please purchase more credits to continue.`,
              credits_needed: POSTCARD_CREDITS,
              credits_available: pcPaid
            });
            return;
          }
          // Deduct 1 credit BEFORE sending
          await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: pcPaid - POSTCARD_CREDITS })
          });
        }
        // Send the postcard — use multipart/form-data when front/back are base64 dataUrls
        // (LOB accepts: public URL, HTML string, or multipart file upload)
        const _lobAuth = 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64');
        let lobRes;
        try {
          const frontIsData = payload.front && payload.front.startsWith('data:');
          const backIsData  = payload.back  && payload.back.startsWith('data:');
          if (frontIsData || backIsData) {
            // Use multipart/form-data to send files directly
            const form = new FormData();
            // Add all non-file fields
            const { front: _f, back: _b, ...restPayload } = payload;
            // Flatten address objects into form fields
            const addFields = (prefix, obj) => {
              if (!obj || typeof obj !== 'object') return;
              Object.entries(obj).forEach(([k, v]) => form.append(`${prefix}[${k}]`, v || ''));
            };
            form.append('description', restPayload.description || '');
            form.append('size', restPayload.size || '6x9');
            if (restPayload.use_type) form.append('use_type', restPayload.use_type);
            addFields('to',   payload.to);
            addFields('from', payload.from);
            // Attach front
            if (frontIsData) {
              const buf = Buffer.from(_f.replace(/^data:[^;]+;base64,/, ''), 'base64');
              form.set('front', new Blob([buf], { type: 'image/jpeg' }), 'front.jpg');
            } else {
              form.append('front', _f);
            }
            // Attach back
            if (backIsData) {
              const buf = Buffer.from(_b.replace(/^data:[^;]+;base64,/, ''), 'base64');
              form.set('back', new Blob([buf], { type: 'image/jpeg' }), 'back.jpg');
            } else {
              form.append('back', _b);
            }
            lobRes = await fetch('https://api.lob.com/v1/postcards', {
              method: 'POST',
              headers: { 'Authorization': _lobAuth },
              body: form
            });
          } else {
            // Both are URLs or HTML — use JSON
            lobRes = await fetch('https://api.lob.com/v1/postcards', {
              method: 'POST',
              headers: { 'Authorization': _lobAuth, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }
        } catch (sendErr) {
          console.error('[Lob] send error:', sendErr.message);
          if (!pcPaidByUnlock) {
            await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
              method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
              body: JSON.stringify({ mailer_credits: pcPaid })
            });
          }
          return res.status(500).json({ error: 'Postcard send failed: ' + sendErr.message });
        }
        const lobData = await lobRes.json();
        if (!lobRes.ok) {
          console.error('[Lob] postcard error', lobRes.status, JSON.stringify(lobData).slice(0, 500));
        }
        // If Lob failed and we deducted a credit, refund it
        if (!lobRes.ok && !pcPaidByUnlock) {
          await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: pcPaid })
          });
        }
        const pcNewPaid = (lobRes.ok && !pcPaidByUnlock) ? pcPaid - POSTCARD_CREDITS : pcPaid;
        if (lobRes.ok) {
          res.status(200).json({
            ...lobData,
            _credits: { paid_credits: pcNewPaid }
          });
        } else {
          res.status(200).json({
            error: lobData.error || lobData,
            _lobStatus: lobRes.status,
            _credits: { paid_credits: pcPaid }
          });
        }
        break;
      }

      // ── Lob campaign postcard (Circle of Influence) ─────────────────────
      case 'lob-postcard-campaign': {
        const CAMPAIGN_CREDITS = 1; // 1 credit = $4.00 = 1 postcard
        const { toAddr, toName, photoDataUrl, headline, subtext, pinId, idempotency_key: cpIdemKey } = req.body;
        if (!toAddr || !photoDataUrl) { res.status(400).json({ error: 'toAddr and photoDataUrl required' }); return; }
        // Rate limit: max 5 campaign postcards per 10 seconds per account
        if (!_checkRate(`lob:${effectiveAccountId}`, 5, 10000)) {
          res.status(429).json({ error: 'rate_limited', message: 'Too many postcard requests. Please wait a moment and try again.' }); return;
        }
        // Idempotency: reject duplicate sends within 30 seconds (prevents double-tap)
        if (cpIdemKey && !_checkIdem(`${effectiveAccountId}:${cpIdemKey}`)) {
          res.status(200).json({ _duplicate: true, message: 'Duplicate request ignored.' }); return;
        }

        // Enforce credit balance
        const cpAcctRes = await sbFetch(`accounts?id=eq.${effectiveAccountId}&select=id,mailer_credits,company_name,company_addr,company_phone,logo_data`);
        if (!cpAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account' }); return; }
        const cpAcctRows = await cpAcctRes.json();
        if (!cpAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const cpAcct = cpAcctRows[0];
        const cpCredits = cpAcct.mailer_credits || 0;
        if (cpCredits < CAMPAIGN_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending a postcard costs ${CAMPAIGN_CREDITS} credit ($4.00). You have ${cpCredits} credits.`,
            credits_needed: CAMPAIGN_CREDITS,
            credits_available: cpCredits
          });
          return;
        }

        // Parse addresses
        const tp = toAddr.split(',').map(s => s.trim());
        const toLine1 = tp[0] || '';
        const toCity = tp[1] || '';
        let toState = tp[2] || 'MI';
        let toZip = tp[3] || '';
        if ((!toZip || toZip === '00000') && toState && toState.includes(' ')) {
          const parts = toState.split(' '); toZip = parts.pop(); toState = parts.join(' ');
        }
        if (!toZip) toZip = '00000';
        // Normalize state abbreviation
        const stateMap = {'Michigan':'MI','Ohio':'OH','Indiana':'IN','Illinois':'IL','Wisconsin':'WI','Minnesota':'MN','Florida':'FL','Georgia':'GA','Texas':'TX','California':'CA','New York':'NY','Pennsylvania':'PA','North Carolina':'NC','Virginia':'VA','Tennessee':'TN','Arizona':'AZ','Colorado':'CO','Washington':'WA','Oregon':'OR','Nevada':'NV','Utah':'UT','Missouri':'MO','Iowa':'IA','Kansas':'KS','Nebraska':'NE','Oklahoma':'OK','Arkansas':'AR','Louisiana':'LA','Mississippi':'MS','Alabama':'AL','South Carolina':'SC','Kentucky':'KY','West Virginia':'WV','Maryland':'MD','Delaware':'DE','New Jersey':'NJ','Connecticut':'CT','Massachusetts':'MA','Rhode Island':'RI','Vermont':'VT','New Hampshire':'NH','Maine':'ME'};
        if (stateMap[toState]) toState = stateMap[toState];

        const fromRaw = cpAcct.company_addr || '123 Main St, Detroit, MI, 48000';
        const fp = fromRaw.split(',').map(s => s.trim());
        let fromCity = fp[1] || 'Detroit';
        let fromState = fp[2] || 'MI';
        let fromZip = fp[3] || '48000';
        if ((!fromZip || fromZip === '00000') && fromState && fromState.includes(' ')) {
          const parts = fromState.split(' '); fromZip = parts.pop(); fromState = parts.join(' ');
        }
        if (stateMap[fromState]) fromState = stateMap[fromState];

        // Build campaign postcard front HTML (photo background + headline + subtext)
        const safeHeadline = (headline || 'We just finished a project in your neighborhood!').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const safeSubtext = (subtext || 'Your neighbors love the results. Want a free quote?').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const co = cpAcct.company_name || 'Your Company';
        const ph = cpAcct.company_phone || '';
        const frontHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,sans-serif;position:relative;background:#1a2333}.bg-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;z-index:0}.overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(to bottom,rgba(0,0,0,.2) 0%,rgba(0,0,0,.05) 40%,rgba(0,0,0,.7) 75%,rgba(0,0,0,.88) 100%);z-index:1}.c{position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:40px 44px}.hl{font-size:36px;font-weight:900;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.8);line-height:1.15;margin-bottom:10px}.sub{font-size:18px;color:rgba(255,255,255,.9);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:16px;font-weight:500}.co{font-size:15px;color:rgba(255,255,255,.8);font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.6)}</style></head><body><img class="bg-img" src="${photoDataUrl}" alt=""><div class="overlay"></div><div class="c"><div class="hl">${safeHeadline}</div><div class="sub">${safeSubtext}</div><div class="co">${co.replace(/</g,'&lt;')}${ph?' · '+ph.replace(/</g,'&lt;'):''}</div></div></body></html>`;

        // Build standard back HTML
        const backHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,sans-serif;background:#fff;position:relative}.indicia{position:absolute;top:32px;right:32px;width:100px;height:60px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;text-align:center;line-height:1.3}.return-addr{position:absolute;top:32px;left:32px;font-size:10px;color:#333;line-height:1.6}.to-addr{position:absolute;bottom:80px;left:50%;transform:translateX(-50%);text-align:center;font-size:13px;color:#222;line-height:1.8;font-weight:600}.co-name{font-size:14px;font-weight:800;color:#111}</style></head><body><div class="indicia">PRESORTED<br>FIRST CLASS<br>U.S. POSTAGE<br>PAID<br>LOB.COM</div><div class="return-addr"><div class="co-name">${co.replace(/</g,'&lt;')}</div><div>${(fp[0]||'').replace(/</g,'&lt;')}</div><div>${fromCity.replace(/</g,'&lt;')}, ${fromState} ${fromZip}</div></div><div class="to-addr"><div>${(toName||'Neighbor').replace(/</g,'&lt;')}</div><div>${toLine1.replace(/</g,'&lt;')}</div><div>${toCity.replace(/</g,'&lt;')}, ${toState} ${toZip}</div></div></body></html>`;

        // Deduct credit BEFORE sending
        await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: cpCredits - CAMPAIGN_CREDITS })
        });

        // Send via Lob
        const cpLobRes = await fetch('https://api.lob.com/v1/postcards', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: 'Circle of Influence Campaign — ' + toAddr,
            to: { name: toName || 'Neighbor', address_line1: toLine1, address_city: toCity, address_state: toState, address_zip: toZip, address_country: 'US' },
            from: { name: co, address_line1: fp[0] || '123 Main St', address_city: fromCity, address_state: fromState, address_zip: fromZip, address_country: 'US' },
            front: '<html>' + frontHtml,
            back: '<html>' + backHtml,
            size: '6x9',
            use_type: 'marketing'
          })
        });
        const cpLobData = await cpLobRes.json();

        // Refund if Lob failed
        if (!cpLobRes.ok) {
          await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: cpCredits })
          });
          res.status(200).json({ error: cpLobData.error || cpLobData, _lobStatus: cpLobRes.status });
          return;
        }

        // Log to mailer_log
        const mlRes = await sbFetch('mailer_log', {
          method: 'POST',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            account_id: effectiveAccountId,
            sent_by: profile.id || null,
            address: toAddr,
            owner_name: toName || 'Neighbor',
            estimate_total: 0,
            lob_id: cpLobData.id,
            company_name: co,
            mailer_type: 'campaign-postcard',
            sent_at: new Date().toISOString()
          })
        });

        res.status(200).json({
          ...cpLobData,
          _credits: { paid_credits: cpCredits - CAMPAIGN_CREDITS }
        });
        break;
      }
      // ── Estimate Reveal postcard ─────────────────────────────────────────────
      case 'send-estimate-reveal': {
        const ER_CREDITS = 1;
        const { homeowner_name, address_line1, address_city, address_state, address_zip,
                estimate_total, front_html, back_html, idem_key: erIdemKey } = req.body;
        if (!front_html) { res.status(400).json({ error: 'front_html required' }); return; }
        if (!_checkRate(`lob:${effectiveAccountId}`, 5, 10000)) {
          res.status(429).json({ error: 'rate_limited', message: 'Too many postcard requests. Please wait a moment.' }); return;
        }
        if (erIdemKey && !_checkIdem(`${effectiveAccountId}:${erIdemKey}`)) {
          res.status(200).json({ _duplicate: true, message: 'Duplicate request ignored.' }); return;
        }
        const erAcctRes = await sbFetch(`accounts?id=eq.${effectiveAccountId}&select=id,plan,mailer_credits,company_name,address,city,state,zip`);
        if (!erAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account' }); return; }
        const erAcctRows = await erAcctRes.json();
        if (!erAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const erAcct = erAcctRows[0];
        const erPaid = erAcct.mailer_credits || 0;
        if (erPaid < ER_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending an Estimate Reveal postcard costs ${ER_CREDITS} credit ($4.00). You have ${erPaid} credits.`,
            credits_needed: ER_CREDITS, credits_available: erPaid
          }); return;
        }
        // Deduct credit before send
        await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: erPaid - ER_CREDITS })
        });
        const fromParts = (erAcct.address || '').split(',');
        const erLobRes = await fetch('https://api.lob.com/v1/postcards', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: 'Estimate Reveal — ' + (homeowner_name || address_line1),
            to: {
              name: homeowner_name || 'Homeowner',
              address_line1, address_city, address_state, address_zip, address_country: 'US'
            },
            from: {
              name: erAcct.company_name || 'BidDrop Company',
              address_line1: fromParts[0] || '123 Main St',
              address_city: erAcct.city || 'City',
              address_state: erAcct.state || 'MI',
              address_zip: erAcct.zip || '48000',
              address_country: 'US'
            },
            front: '<html>' + front_html,
            back: '<html>' + (back_html || front_html),
            size: '6x9',
            use_type: 'marketing'
          })
        });
        const erLobData = await erLobRes.json();
        if (!erLobRes.ok) {
          // Refund credit
          await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: erPaid })
          });
          res.status(200).json({ error: erLobData.error || erLobData, _lobStatus: erLobRes.status }); return;
        }
        // Log to mailer_log
        await sbFetch('mailer_log', {
          method: 'POST', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            account_id: effectiveAccountId,
            sent_by: profile.id || null,
            address: `${address_line1}, ${address_city}, ${address_state} ${address_zip}`,
            owner_name: homeowner_name || 'Homeowner',
            estimate_total: estimate_total || 0,
            lob_id: erLobData.id,
            company_name: erAcct.company_name || '',
            mailer_type: 'estimate-reveal',
            sent_at: new Date().toISOString()
          })
        });
        res.status(200).json({ ...erLobData, _credits: { paid_credits: erPaid - ER_CREDITS } });
        break;
      }

      // ── Lob letter proxy ──────────────────────────────────────────────────
      case 'lob-letter': {
        const LETTER_CREDITS = 1; // 1 credit = $4.00 = 1 letter
        const { payload: ltPayload } = req.body;
        if (!ltPayload) { res.status(400).json({ error: 'payload required' }); return; }
        // Enforce credit balance — uses only mailer_credits (no free credits system)
        const ltAcctRes = await sbFetch(
          `accounts?id=eq.${effectiveAccountId}&select=id,plan,mailer_credits`
        );
        if (!ltAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account credits' }); return; }
        const ltAcctRows = await ltAcctRes.json();
        if (!ltAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const ltAcct = ltAcctRows[0];
        const ltPaid  = ltAcct.mailer_credits || 0;
        const ltTotal = ltPaid;
        if (ltTotal < LETTER_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: `Sending a letter costs ${LETTER_CREDITS} credit ($4.00). You have ${ltTotal} credits. Please purchase more credits to continue.`,
            credits_needed: LETTER_CREDITS,
            credits_available: ltTotal
          });
          return;
        }
        // Deduct 1 credit BEFORE sending
        await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: ltPaid - LETTER_CREDITS })
        });
        // Send the letter
        const ltLobRes = await fetch('https://api.lob.com/v1/letters', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(LOB_KEY + ':').toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(ltPayload)
        });
        const ltLobData = await ltLobRes.json();
        // If Lob failed, refund the credit
        if (!ltLobRes.ok) {
          await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
            method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ mailer_credits: ltPaid })
          });
        }
        const ltNewPaid = ltLobRes.ok ? ltPaid - LETTER_CREDITS : ltPaid;
        if (ltLobRes.ok) {
          res.status(200).json({
            ...ltLobData,
            _credits: { paid_credits: ltNewPaid }
          });
        } else {
          res.status(200).json({
            error: ltLobData.error || ltLobData,
            _lobStatus: ltLobRes.status,
            _credits: { paid_credits: ltPaid }
          });
        }
        break;
      }

      // ── RentCast proxy (with credit enforcement) ─────────────────────────
    default:
      return false;
  }
  return true;
}

module.exports = { handle };
