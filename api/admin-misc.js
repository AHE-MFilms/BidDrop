/**
 * BidDrop API — Print unlock, migration runner, campaigns, CompanyCam, QuickBooks
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
      case 'print-unlock': {
        // Charge 1 credit to unlock printing for an estimate (pay-once per estimate)
        const { estId: puEstId } = req.body;
        if (!puEstId) { res.status(400).json({ error: 'estId required' }); return; }
        // Check if already unlocked
        const puEstRes = await sbFetch(`estimates?id=eq.${puEstId}&select=id,account_id,print_paid`);
        if (!puEstRes.ok) { res.status(500).json({ error: 'Failed to fetch estimate' }); return; }
        const puEsts = await puEstRes.json();
        if (!puEsts.length) { res.status(404).json({ error: 'Estimate not found' }); return; }
        const puEst = puEsts[0];
        // Verify ownership
        if (puEst.account_id !== effectiveAccountId && !isSuperAdmin) {
          res.status(403).json({ error: 'Not your estimate' }); return;
        }
        // Already paid — allow free reprint
        if (puEst.print_paid) {
          res.status(200).json({ already_paid: true });
          return;
        }
        // Deduct 1 credit from the unified mailer_credits pool
        const PRINT_CREDITS = 1;
        const puAcctRes = await sbFetch(
          `accounts?id=eq.${effectiveAccountId}&select=id,mailer_credits&limit=1`
        );
        if (!puAcctRes.ok) { res.status(500).json({ error: 'Failed to fetch account' }); return; }
        const puAcctRows = await puAcctRes.json();
        if (!puAcctRows.length) { res.status(404).json({ error: 'Account not found' }); return; }
        const puAcct = puAcctRows[0];
        const puPaid = puAcct.mailer_credits || 0;
        if (puPaid < PRINT_CREDITS) {
          res.status(402).json({
            error: 'no_credits',
            message: 'Printing a quote costs 1 credit. You have no credits remaining.',
            credits_needed: PRINT_CREDITS,
            credits_available: puPaid
          });
          return;
        }
        // Deduct from mailer_credits
        await sbFetch(`accounts?id=eq.${effectiveAccountId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: puPaid - PRINT_CREDITS })
        });
        // Mark estimate as print_paid
        await sbFetch(`estimates?id=eq.${puEstId}`, {
          method: 'PATCH', headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ print_paid: true })
        });
        res.status(200).json({
          success: true,
          _credits: { paid_credits: puPaid - PRINT_CREDITS }
        });
        break;
      }
      case 'run-migration': {
        // One-time migration: add missing columns and performance indexes
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'super_admin only' });
        }
        // Extract the Supabase project ref from the URL
        // e.g. https://gtwbhxnrmfmdenogzuea.supabase.co  ->  gtwbhxnrmfmdenogzuea
        const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];
        // Run all DDL as a single batched query for efficiency
        const batchSql = [
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS photo_url TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS photo_data TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS pin_id TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS logo_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS headshot_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS review1_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS review2_data TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS headshot_pos REAL`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hook TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_why TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_quote TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_guarantee TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS rep_name TEXT`,
          `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_headline1 TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_headline2 TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_badge_text TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_badge_color TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_back_badge_text TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_back_badge_color TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_scan_cta TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_scan_sub TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_photo_layout TEXT DEFAULT 'single'`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_show_price BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_show_monthly BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_show_phone BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hl1_size INTEGER DEFAULT 160`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hl2_size INTEGER DEFAULT 160`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_hook_size INTEGER DEFAULT 36`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_why_size INTEGER DEFAULT 30`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_quote_size INTEGER DEFAULT 32`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_guar_size INTEGER DEFAULT 26`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_phone_size INTEGER DEFAULT 42`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_addr_size INTEGER DEFAULT 62`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS postcard_price_size INTEGER DEFAULT 78`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip2_headline TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip2_subtext TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip3_headline TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip3_subtext TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip4_headline TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drip4_subtext TEXT`,
          `CREATE INDEX IF NOT EXISTS idx_pins_account_created ON pins(account_id, created_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_pins_account_latlon  ON pins(account_id, lat, lng)`,
          `CREATE INDEX IF NOT EXISTS idx_queue_account_created ON queue(account_id, created_at DESC)`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slug TEXT`,
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug) WHERE slug IS NOT NULL`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS source TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_first_viewed_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_last_viewed_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_time_spent INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_mat_clicks JSONB`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_share_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_call_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS rep_video_url TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS page_enabled BOOLEAN DEFAULT TRUE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS estimate_page_expires_days INTEGER`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS estimate_page_countdown BOOLEAN DEFAULT FALSE`,
          `CREATE INDEX IF NOT EXISTS idx_estimates_account_saved ON estimates(account_id, saved_at DESC)`,
          `ALTER TABLE pins ADD COLUMN IF NOT EXISTS source TEXT`,
          `ALTER TABLE pins ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mailer_credits INTEGER DEFAULT 0`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS free_mailer_credits_used INTEGER DEFAULT 0`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS free_mailer_credits_reset DATE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS print_paid BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qr_scan_count INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qr_first_scanned_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qr_last_scanned_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS email TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
          `CREATE TABLE IF NOT EXISTS scan_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), estimate_id TEXT NOT NULL, account_id TEXT, scanned_at TIMESTAMPTZ DEFAULT NOW(), source TEXT DEFAULT 'qr', user_agent TEXT, referrer TEXT)`,
          `CREATE INDEX IF NOT EXISTS idx_scan_events_estimate ON scan_events(estimate_id, scanned_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_scan_events_account ON scan_events(account_id, scanned_at DESC)`,
          `CREATE TABLE IF NOT EXISTS postcard_scans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), queue_item_id TEXT, account_id TEXT, owner_name TEXT, address TEXT, estimate_id TEXT, scanned_at TIMESTAMPTZ DEFAULT NOW(), ip TEXT, user_agent TEXT)`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS estimate_id TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS queue_item_id TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS account_id TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS owner_name TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS address TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS ip TEXT`,
          `ALTER TABLE postcard_scans ADD COLUMN IF NOT EXISTS user_agent TEXT`,
          `CREATE INDEX IF NOT EXISTS idx_postcard_scans_account ON postcard_scans(account_id, scanned_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_postcard_scans_estimate ON postcard_scans(estimate_id, scanned_at DESC)`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS google_tag_id TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS google_place_id TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS booking_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS call_clicks INTEGER DEFAULT 0`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS source TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS drip_step INTEGER`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS drip_est_id TEXT`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS sig_name TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS offer_solar BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_steps JSONB`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_paused BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_cancelled BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS drip_cancelled_at TIMESTAMPTZ`,
          `CREATE TABLE IF NOT EXISTS campaign_targets (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            campaign_name TEXT,
            campaign_date DATE,
            lat DOUBLE PRECISION,
            lng DOUBLE PRECISION,
            radius_miles NUMERIC,
            pin_count INTEGER DEFAULT 0,
            mailer_count INTEGER DEFAULT 0,
            storm_ids JSONB,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )`,
          /* ── Trade system columns (Build 10) ── */
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trade_pricing_json JSONB`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trade_statuses_json JSONB`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trade_postcard_copy_json JSONB`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS companycam_key TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS qb_access_token TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS qb_refresh_token TEXT`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS qb_realm_id TEXT`,
          `ALTER TABLE pins ADD COLUMN IF NOT EXISTS ghl_synced_at TIMESTAMPTZ`,
          `ALTER TABLE pins ADD COLUMN IF NOT EXISTS ghl_sync_error TEXT`,
          `ALTER TABLE estimates ADD COLUMN IF NOT EXISTS qb_invoice_id TEXT`,
          `CREATE INDEX IF NOT EXISTS idx_pins_ghl_synced ON pins(account_id, ghl_synced_at DESC)`,
          `CREATE INDEX IF NOT EXISTS idx_estimates_qb ON estimates(account_id, qb_invoice_id)`,
          /* ── Solar overlay: store systemKw on pins for map overlay ── */
          `ALTER TABLE pins ADD COLUMN IF NOT EXISTS solar_kw NUMERIC`,
          `ALTER TABLE pins ADD COLUMN IF NOT EXISTS solar_potential TEXT`,
          /* ── mailer_log: tracks every physical mail send ── */
          `CREATE TABLE IF NOT EXISTS mailer_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id TEXT,
            sent_by TEXT,
            address TEXT,
            owner_name TEXT,
            estimate_total NUMERIC DEFAULT 0,
            lob_id TEXT,
            queue_item_id TEXT,
            company_name TEXT,
            mailer_type TEXT,
            credits_used INTEGER DEFAULT 1,
            sent_at TIMESTAMPTZ DEFAULT NOW()
          )`,
          `ALTER TABLE mailer_log ADD COLUMN IF NOT EXISTS mailer_type TEXT`,
          `ALTER TABLE mailer_log ADD COLUMN IF NOT EXISTS queue_item_id TEXT`,
          `ALTER TABLE mailer_log ADD COLUMN IF NOT EXISTS credits_used INTEGER DEFAULT 1`,
          `CREATE INDEX IF NOT EXISTS idx_mailer_log_account_sent ON mailer_log(account_id, sent_at DESC)`,
          /* ── Campaign send numbering (Build 12) ── */
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS send_num INTEGER DEFAULT 1`,
          `ALTER TABLE queue ADD COLUMN IF NOT EXISTS campaign_label TEXT`,
          /* ── Blitz Promo (platform-wide sale toggle) ── */
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS blitz_promo_enabled BOOLEAN DEFAULT FALSE`,
          `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS blitz_promo_config JSONB DEFAULT '{"buy":3,"get":5,"label":"Buy 3 Get 5 Total!"}'::jsonb`
        ].join('; ');
        const results = [];
        // Run each DDL statement individually via Supabase pg_meta API (uses SERVICE_KEY)
        const statements = batchSql.split('; ');
        // Append one-time data migration: backfill source='unlock' on existing unlock queue items
        statements.push(`UPDATE queue SET source = 'unlock' WHERE id LIKE 'mq_unlock_%' AND source IS NULL`);
        for (const stmt of statements) {
          if (!stmt.trim()) continue;
          try {
            const r = await fetch(
              `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
              {
                method: 'POST',
                headers: {
                  'apikey': SERVICE_KEY,
                  'Authorization': `Bearer ${SERVICE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sql: stmt })
              }
            );
            const body = await r.text();
            results.push({ sql: stmt.substring(0, 80), status: r.status, ok: r.ok });
          } catch (sqlErr) {
            results.push({ sql: stmt.substring(0, 80), status: 0, ok: false, body: sqlErr.message });
          }
        }
        // Reload PostgREST schema cache so new columns are immediately queryable
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/`, {
            method: 'GET',
            headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Accept-Profile': 'public' }
          });
        } catch(_){}
        return res.json({ results });
      }

      case 'unlock-pin': {
        // Unified pin unlock: 1 credit deducted, fires RentCast + Tracerfy in parallel,
        // saves all data to pin, marks pin unlocked, optionally queues a postcard.
        const { pinId: upPinId, address: upAddress, queuePostcard: upQueuePostcard } = req.body;
        if (!upPinId || !upAddress) { res.status(400).json({ error: 'pinId and address required' }); return; }
        const accountId = effectiveAccountId;
        if (!accountId) { res.status(401).json({ error: 'not authenticated' }); return; }

        // 1. Check if already unlocked (idempotent)
        const upPinRes = await sbFetch(`pins?id=eq.${upPinId}&select=id,unlocked_at,contact_data,estimate,status,account_id,photo_url,photo_data,all_photos&limit=1`);
        const upPinRows = upPinRes.ok ? await upPinRes.json() : [];
        let upPin = upPinRows[0];
        if (!upPin) {
          // Pin not in DB yet — upsert a minimal row so unlock can proceed.
          // This handles the case where pin was saved to localStorage but not yet synced to Supabase.
          console.log('[unlock-pin] pin not in DB, upserting minimal row:', upPinId);
          // Geocode the address so we don't store lat:0,lng:0 ("ocean pin" bug)
          let upLat = null, upLng = null;
          try {
            const MB_TOKEN = process.env.MAPBOX_TOKEN || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
            const geoRes = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(upAddress)}.json?country=us&types=address&limit=1&access_token=${MB_TOKEN}`);
            if (geoRes.ok) {
              const geoData = await geoRes.json();
              const feat = geoData && geoData.features && geoData.features[0];
              if (feat && feat.center) { upLng = feat.center[0]; upLat = feat.center[1]; }
            }
          } catch(geoErr){ console.warn('[unlock-pin] geocode failed:', geoErr.message); }
          const upsertRes = await sbFetch(`pins?on_conflict=id`, {
            method: 'POST',
            headers: { 'Prefer': 'return=representation,resolution=merge-duplicates', 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: upPinId, account_id: accountId, address: upAddress, status: 'pinned', lat: upLat, lng: upLng })
          });
          if (upsertRes.ok) {
            const rows = await upsertRes.json();
            upPin = Array.isArray(rows) ? rows[0] : rows;
          }
          if (!upPin) {
            const errBody = upsertRes ? await upsertRes.text().catch(()=>'') : '';
            console.error('[unlock-pin] pin upsert failed:', upsertRes?.status, errBody.slice(0,200));
            res.status(404).json({ error: 'pin not found' }); return;
          }
        }
        // Verify the pin belongs to the effective account (security check)
        // Super admins bypass this check so they can unlock on behalf of any account
        if (!isSuperAdmin && upPin.account_id && upPin.account_id !== accountId) {
          res.status(403).json({ error: 'pin does not belong to this account' }); return;
        }
        if (upPin.unlocked_at) {
          // Return existing contact_data so the client can fill fields without a separate fetch
          return res.json({ ok: true, already_unlocked: true, unlocked_at: upPin.unlocked_at, contact_data: upPin.contact_data || null });
        }

        // 2. Check credit balance
        const upAcctRes = await sbFetch(`accounts?id=eq.${accountId}&select=id,mailer_credits&limit=1`);
        const upAcctRows = upAcctRes.ok ? await upAcctRes.json() : [];
        const upAcct = upAcctRows[0];
        if (!upAcct) { res.status(404).json({ error: 'account not found' }); return; }
        const upBalance = upAcct.mailer_credits || 0;
        if (upBalance < 1) {
          return res.status(402).json({ error: 'no_credits', message: 'Not enough credits to unlock this lead. Purchase more credits to continue.' });
        }

        // 3. Deduct 1 credit immediately
        await sbFetch(`accounts?id=eq.${accountId}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ mailer_credits: upBalance - 1 })
        });

        // 4. Fire RentCast + Tracerfy in parallel
        const upUpdates = { unlocked_at: new Date().toISOString() };
        try {
          const [rcResult, tfResult] = await Promise.allSettled([
            // RentCast: owner name + equity
            (async () => {
              if (!RENTCAST_KEY) return null;
              const rcCtrl = new AbortController();
              const rcTimeout = setTimeout(() => rcCtrl.abort(), 8000);
              try {
                const r = await fetch(
                  `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(upAddress)}&limit=1`,
                  { headers: { 'X-Api-Key': RENTCAST_KEY }, signal: rcCtrl.signal }
                );
                clearTimeout(rcTimeout);
                if (r.ok) {
                  const d = await r.json();
                  return Array.isArray(d) ? d[0] : (d.properties && d.properties[0]) || d;
                }
              } catch(e) { clearTimeout(rcTimeout); }
              return null;
            })(),
            // Tracerfy: phone + email (always run when key is available)
            (async () => {
              if (!TRACERFY_KEY) return null;
              const existingOwner = (upPin.estimate && upPin.estimate.owner) || '';
              const tfParts = existingOwner.trim().split(/\s+/);
              const tfPayload = {
                address: upAddress,
                ...(tfParts[0] && { first_name: tfParts[0] }),
                ...(tfParts.slice(1).join(' ') && { last_name: tfParts.slice(1).join(' ') }),
              };
              const tfRes = await fetch('https://www.tracerfy.com/v1/api/trace/lookup/', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TRACERFY_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(tfPayload)
              });
              if (tfRes.ok) return await tfRes.json();
              return null;
            })()
          ]);

          if (rcResult.status === 'fulfilled' && rcResult.value) {
            const rcData = rcResult.value;
            const ownerName = [rcData.ownerFirstName, rcData.ownerLastName].filter(Boolean).join(' ') || rcData.owner || '';
            upUpdates.equity_data = {
              estValue: rcData.estimatedValue || null,
              mortgageBalance: rcData.mortgageBalance || null,
              equity: rcData.equity || null,
              yearBuilt: rcData.yearBuilt || null,
              bedrooms: rcData.bedrooms || null,
              bathrooms: rcData.bathrooms || null,
              lastSaleDate: rcData.lastSaleDate || null,
              lastSalePrice: rcData.lastSalePrice || null
            };
            const existingEst = upPin.estimate || {};
            if (ownerName && !existingEst.owner) {
              upUpdates.estimate = { ...existingEst, owner: ownerName };
            }
          }

          if (tfResult.status === 'fulfilled' && tfResult.value) {
            const tfData = tfResult.value;
            const persons = tfData.persons || tfData.results || [];
            if (persons.length > 0) {
              const best = persons[0];
              const phones = (best.phones || []).map(p => ({ number: p.number || p, type: p.type || 'mobile', dnc: p.dnc || false }));
              const emails = (best.emails || []).map(e => typeof e === 'string' ? e : (e.email || e.address || ''));
              upUpdates.contact_data = { phones, emails, ownerName: best.full_name || best.name || '' };
            }
          }
        } catch(parallelErr) {
          console.warn('[unlock-pin] parallel lookup error:', parallelErr.message);
        }

        // 5. Save all data + mark unlocked
        await sbFetch(`pins?id=eq.${upPinId}`, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify(upUpdates)
        });

        // 6. Optionally queue a postcard
        let upQueueItemId = null;
        const upOwnerName = (upUpdates.estimate && upUpdates.estimate.owner) || (upPin.estimate && upPin.estimate.owner) || '';
        if (upQueuePostcard) {
          upQueueItemId = 'mq_unlock_' + upPinId + '_' + Date.now();
          // Resolve best photo from pin: prefer a URL (publicly accessible), fall back to data URL
          const upPhotoUrl  = upPin.photo_url  || null;
          const upPhotoData = (!upPhotoUrl && upPin.photo_data) ? upPin.photo_data : null;
          // Also check all_photos.front[0] if no direct photo
          const upAllPhotos = upPin.all_photos || null;
          const upFrontPhoto = (!upPhotoUrl && !upPhotoData && upAllPhotos && upAllPhotos.front && upAllPhotos.front[0]) ? upAllPhotos.front[0] : null;
          const upBestPhotoUrl  = upPhotoUrl  || (upFrontPhoto && upFrontPhoto.startsWith('http')  ? upFrontPhoto : null) || null;
          const upBestPhotoData = upPhotoData || (upFrontPhoto && !upFrontPhoto.startsWith('http') ? upFrontPhoto : null) || null;
          const queueItem = {
            id: upQueueItemId,
            account_id: accountId,
            pin_id: upPinId,
            addr: upAddress,
            owner: upOwnerName,
            status: 'needs_approval',
            source: 'unlock',
            created_at: new Date().toISOString(),
            ...(upBestPhotoUrl  ? { photo_url:  upBestPhotoUrl  } : {}),
            ...(upBestPhotoData ? { photo_data: upBestPhotoData } : {})
          };
          // Write to 'queue' table (the table the client reads from)
          await sbFetch('queue', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
            body: JSON.stringify(queueItem)
          }).catch((e) => { console.warn('[unlock-pin] queue insert error:', e); });
          await sbFetch(`pins?id=eq.${upPinId}`, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({ unlock_queued_postcard: true })
          }).catch(() => {});
        }

        return res.json({
          ok: true,
          unlocked_at: upUpdates.unlocked_at,
          owner: upOwnerName || null,
          equity_data: upUpdates.equity_data || null,
          contact_data: upUpdates.contact_data || null,
          postcard_queued: !!upQueuePostcard,
          queue_item_id: upQueueItemId,
          queue_item_addr: upAddress,
          queue_item_owner: upOwnerName,
          _credits: { paid_credits: upBalance - 1 }
        });
      }

      case 'tracerfy': {
        // Skip-trace a homeowner by name + address using Tracerfy API
        // Returns phones (with DNC flag) and emails for the property owner
        const { ownerName, address: tfAddress, city: tfCity, state: tfState, zip: tfZip, pinId: tfPinId, viewingAccountId: tfViewingAccountId } = req.body;
        if (!tfAddress) { res.status(400).json({ error: 'address required' }); return; }
        // Super admins may have null account_id in their profile — use viewingAccountId from client or skip dedup
        const tfAccountId = effectiveAccountId;
        if (!tfAccountId && !isSuperAdmin) { res.status(401).json({ error: 'not authenticated' }); return; }
        // SERVER-SIDE DEDUP: if this pin already has contact_data saved, return it without hitting Tracerfy
        if (tfPinId && tfAccountId) {
          const { data: existingPin } = await sbFetch(`pins?select=contact_data&id=eq.${tfPinId}&account_id=eq.${tfAccountId}&limit=1`);
          const existing = existingPin && existingPin[0];
          if (existing && existing.contact_data &&
              ((existing.contact_data.phones||[]).length + (existing.contact_data.emails||[]).length) > 0) {
            console.log('[BidDrop] Tracerfy dedup: returning cached contact_data for pin', tfPinId);
            return res.json({ _cached: true, persons: [{ phones: existing.contact_data.phones||[], emails: existing.contact_data.emails||[], full_name: existing.contact_data.ownerName||'' }] });
          }
        }
        // Parse owner name into first/last
        let tfFirst = '';
        let tfLast  = '';
        if (ownerName) {
          const parts = ownerName.trim().split(/\s+/);
          tfFirst = parts[0] || '';
          tfLast  = parts.slice(1).join(' ') || '';
        }
        const tfPayload = {
          address: tfAddress,
          ...(tfCity  && { city:  tfCity  }),
          ...(tfState && { state: tfState }),
          ...(tfZip   && { zip:   tfZip   }),
          ...(tfFirst && { first_name: tfFirst }),
          ...(tfLast  && { last_name:  tfLast  }),
        };
        const tfRes = await fetch('https://www.tracerfy.com/v1/api/trace/lookup/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${TRACERFY_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(tfPayload)
        });
        const tfData = await tfRes.json();
        return res.status(tfRes.status).json(tfData);
      }
      case 'campaign-save': {
        // Save a new campaign record to campaign_targets table
        const { campaign } = req.body;
        if (!campaign || !campaign.id) { res.status(400).json({ error: 'campaign object with id required' }); return; }
        const r = await sbFetch('campaign_targets', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify(campaign)
        });
        const body = await r.text();
        // Gracefully handle missing table (migration not yet run)
        if (!r.ok && (body.includes('campaign_targets') || body.includes('PGRST205'))) {
          return res.status(200).json({ ok: false, migrationNeeded: true, message: 'campaign_targets table not yet created — run /api/migrate' });
        }
        return res.status(r.ok ? 200 : r.status).json({ ok: r.ok, status: r.status, body: body.substring(0, 200) });
      }
      case 'campaign-update': {
        // Update an existing campaign record (e.g. postcards_sent, ghl_pushed)
        const { campaignId, updates } = req.body;
        if (!campaignId || !updates) { res.status(400).json({ error: 'campaignId and updates required' }); return; }
        const r = await sbFetch(`campaign_targets?id=eq.${campaignId}`, {
          method: 'PATCH',
          body: JSON.stringify(updates)
        });
        return res.status(r.ok ? 200 : r.status).json({ ok: r.ok });
      }
      case 'campaign-list': {
        // List campaigns for an account, most recent first
        // Super admins can pass targetAccountId to view any account's campaigns
        const { targetAccountId } = req.body || {};
        const listAcctId = effectiveAccountId;
        if (!listAcctId) { res.status(401).json({ error: 'auth required' }); return; }
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const r = await sbFetch(`campaign_targets?account_id=eq.${listAcctId}&order=campaign_date.desc&limit=${limit}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!r.ok) {
          const errText = await r.text();
          // Gracefully return empty list if table doesn't exist yet
          if (errText.includes('campaign_targets') || errText.includes('PGRST205')) {
            return res.status(200).json({ campaigns: [], migrationNeeded: true });
          }
          return res.status(200).json({ campaigns: [] });
        }
        const data = await r.json();
        return res.status(200).json({ campaigns: Array.isArray(data) ? data : [] });
      }
      case 'notify-approval': {
        // Send email to account admin when needs_approval items land in mail queue
        const { count: approvalCount, accountId: notifyAcctId } = req.body;
        if (!notifyAcctId) { res.status(400).json({ error: 'accountId required' }); return; }
        // Fetch the account's admin email
        const acctR = await sbFetch(`accounts?id=eq.${notifyAcctId}&select=company_name,lead_alert_email`, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!acctR.ok) { res.status(200).json({ sent: false, reason: 'account not found' }); return; }
        const [acctData] = await acctR.json();
        const alertEmail = acctData?.lead_alert_email;
        if (!alertEmail) { res.status(200).json({ sent: false, reason: 'no alert email configured' }); return; }
        const companyName = acctData?.company_name || 'BidDrop';
        const appUrl = (process.env.APP_URL || 'https://biddrop.americashomeexperts.com').trim();
        const approvalEmailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;color:#111"><div style="background:#111;padding:28px 32px;border-radius:10px 10px 0 0"><span style="font-size:26px;font-weight:900;color:#fff">Bid<span style="color:#F97316">Drop</span></span></div><div style="padding:36px 32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 10px 10px"><h1 style="font-size:22px;font-weight:800;margin:0 0 12px">&#128274; ${approvalCount} Postcard${approvalCount!==1?'s':''} Waiting for Approval</h1><p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">${approvalCount} postcard${approvalCount!==1?'s':''} in your <strong>${companyName}</strong> mail queue need${approvalCount===1?'s':''} your approval before they can be sent.</p><a href="${appUrl}" style="display:block;background:#F97316;color:#fff;text-decoration:none;text-align:center;padding:16px 24px;border-radius:8px;font-size:17px;font-weight:800;margin-bottom:24px">Review &amp; Approve &#8594;</a><p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin:0">Go to Mail Queue tab in BidDrop to approve or reject items. For help, contact <a href="mailto:support@biddrop.io" style="color:#F97316">support@biddrop.io</a></p></div></div>`;
        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) { res.status(200).json({ sent: false, reason: 'no RESEND_API_KEY' }); return; }
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'BidDrop <noreply@biddrop.io>', to: [alertEmail], subject: `${approvalCount} Postcard${approvalCount!==1?'s':''} Waiting for Approval — ${companyName}`, html: approvalEmailHtml })
        });
        const emailData = await emailRes.json().catch(()=>({}));
        res.status(200).json({ sent: emailRes.ok, id: emailData.id });
        break;
      }
      case 'companycam-photos': {
        // Proxy CompanyCam API — fetch photos for a property address
        const { address: ccAddr, apiKey: ccKey } = req.body;
        if (!ccKey) { res.status(400).json({ error: 'apiKey required' }); return; }
        if (!ccAddr) { res.status(400).json({ error: 'address required' }); return; }
        // Search CompanyCam for projects matching the address
        const ccRes = await fetch(`https://api.companycam.com/v2/projects?query=${encodeURIComponent(ccAddr)}&per_page=10`, {
          headers: { 'Authorization': `Bearer ${ccKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });
        if (!ccRes.ok) {
          const errBody = await ccRes.text();
          return res.status(ccRes.status).json({ error: 'CompanyCam API error', details: errBody.substring(0, 200) });
        }
        const ccData = await ccRes.json();
        const projects = Array.isArray(ccData) ? ccData : (ccData.projects || []);
        // Fetch photos for each project (up to 3 projects)
        const photos = [];
        for (const proj of projects.slice(0, 3)) {
          const phRes = await fetch(`https://api.companycam.com/v2/projects/${proj.id}/photos?per_page=20`, {
            headers: { 'Authorization': `Bearer ${ccKey}`, 'Accept': 'application/json' }
          });
          if (phRes.ok) {
            const phData = await phRes.json();
            const phList = Array.isArray(phData) ? phData : (phData.photos || []);
            phList.forEach(p => {
              const uri = p.uris && (p.uris.find(u => u.type === 'original') || p.uris[0]);
              if (uri) photos.push({ id: p.id, url: uri.uri, thumb: (p.uris.find(u => u.type === 'thumb') || uri).uri, takenAt: p.captured_at, projectName: proj.name });
            });
          }
        }
        return res.status(200).json({ photos, projectCount: projects.length });
      }
      case 'qb-create-invoice': {
        // Create a QuickBooks invoice from an estimate
        const { accessToken: qbToken, realmId: qbRealm, estimate: qbEst } = req.body;
        if (!qbToken || !qbRealm || !qbEst) { res.status(400).json({ error: 'accessToken, realmId, and estimate required' }); return; }
        // Build QB invoice payload
        const qbPayload = {
          Line: (qbEst.structures || []).map((s, i) => ({
            Amount: Math.round((s.total || 0) * 100) / 100,
            DetailType: 'SalesItemLineDetail',
            Description: s.name || `Structure ${i + 1}`,
            SalesItemLineDetail: { Qty: 1, UnitPrice: Math.round((s.total || 0) * 100) / 100 }
          })).filter(l => l.Amount > 0),
          CustomerRef: { name: qbEst.owner || 'Homeowner' },
          BillAddr: { Line1: qbEst.addr || '' },
          DocNumber: `BD-${qbEst.id ? qbEst.id.slice(-6).toUpperCase() : Date.now().toString().slice(-6)}`
        };
        if (!qbPayload.Line.length) { res.status(400).json({ error: 'No line items with value > 0' }); return; }
        const qbRes = await fetch(`https://quickbooks.api.intuit.com/v3/company/${qbRealm}/invoice?minorversion=65`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${qbToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ Invoice: qbPayload })
        });
        const qbData = await qbRes.json();
        if (!qbRes.ok) { return res.status(qbRes.status).json({ error: 'QuickBooks API error', details: qbData }); }
        const invoiceId = qbData.Invoice && qbData.Invoice.Id;
        return res.status(200).json({ ok: true, invoiceId, invoice: qbData.Invoice });
      }
      case 'get-contact-data': {
        // Fetch contact_data for an already-unlocked pin (no credit cost)
        const { pinId: gcdPinId } = req.body;
        if (!gcdPinId) { res.status(400).json({ error: 'pinId required' }); return; }
        const gcdRes = await sbFetch(`pins?id=eq.${gcdPinId}&account_id=eq.${effectiveAccountId}&select=id,contact_data,unlocked_at&limit=1`);
        const gcdRows = gcdRes.ok ? await gcdRes.json() : [];
        const gcdPin = gcdRows[0];
        if (!gcdPin) { res.status(404).json({ error: 'pin not found' }); return; }
        if (!gcdPin.unlocked_at) { res.status(403).json({ error: 'pin not unlocked' }); return; }
        return res.json({ ok: true, contact_data: gcdPin.contact_data || null });
      }

    default:
      return false;
  }
  return true;
}

module.exports = { handle };
