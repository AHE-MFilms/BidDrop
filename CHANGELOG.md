# BidDrop Changelog

All notable changes to this project are documented here.
Format: `[Build N] YYYY-MM-DD — Description`

---

## [Build 15] 2026-07-01 — Architecture Hardening (Priority 4)

### Added
- **Performance indexes** on all high-query columns: `pins(account_id)`, `pins(account_id, status)`, `pins(campaign_id)`, `estimates(account_id)`, `estimates(pin_id)`, `queue(account_id)`, `queue(status)`, `queue(scheduled_send_at)` WHERE pending, `campaign_targets(account_id)`, `pixel_hits(account_id)`, `pixel_hits(resolution_status)`, `mailer_log(account_id)` — 13 indexes total
- **`src/lib/` pure logic layer** — 27 testable functions extracted into 5 CommonJS modules (`format.js`, `geo.js`, `pin-status.js`, `drip.js`, `credits.js`)
- **135 unit tests** covering all lib functions (up from 36)
- **`CHANGELOG.md`** — this file
- **`CONTRIBUTING.md`** — staging branch workflow and PR guidelines
- **`docs/lib-api.md`** — full API reference for `src/lib/`
- **`src/lib/new-feature-template.js`** — starter template for new features

---

## [Build 14] 2026-06-30 — Architecture Hardening (Priority 1–3)

### Added
- **onclick linkage validator** (check #9 in `validate-build.js`) — build fails if any HTML event handler calls a function not defined in `src/`
- **Global error boundary** — `window.onerror` + `window.onunhandledrejection` show toast instead of silent crash
- **57 null-safety guards** using optional chaining (`?.`) on high-risk DOM calls across 9 files
- **GitHub Actions CI** — runs `npm test` + `node build.js` on every push; blocks PRs to `main`/`staging` if checks fail
- **`staging` branch** + `staging.biddrop.us` Vercel preview environment
- **`src/estimator-accordion.js`** — extracted accordion/unlock functions from inline HTML partial

### Fixed
- **Hot Leads search/filter was silently broken** — `renderHotLeads()` was called but never defined; added client-side filter function with `_hlAllRows` cache
- **3 misplaced functions** (`toggleAccCard`, `estLookupContact`, `estUnlockPin`) moved from HTML partial to proper JS file with guaranteed load order

---

## [Build 13] 2026-06-30 — Codebase Refactor

### Changed
- **`index.html`** reduced from 6,087 lines to 1,376 lines — all inline JS extracted to `src/` files
- **`admin.js`** split from 1,622-line monolith into 6 focused route modules: `admin-users.js`, `admin-ghl.js`, `admin-lob.js`, `admin-rentcast.js`, `admin-storage.js`, `admin-misc.js`
- **`tab-settings.html`** split into 5 sub-partials: profile, pricing, marketing, integrations, billing
- **`mail-queue.js`** split into `mail-queue-estimates.js`, `mail-queue-lob.js`, `mail-queue-queue.js`
- **`homeowner-quote.js`** split into `homeowner-quote-page.js`, `homeowner-quote-modal.js`
- **Build system** upgraded to recursive partial resolution (depth-guarded to 5 levels)
- **Supabase anon key** now injected from `SUPABASE_ANON_KEY` env var at build time (no code change needed to rotate)
- **CSP header** added to `vercel.json` + X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **63 dev scripts** archived from root into `scripts/archive/`
- **`validate-build.js`** expanded to 8 checks; auto-runs at end of every build

---

## [Build 12] 2026-06-30 — Canvas Designer + Custom Back Artwork

### Added
- **Upload Own Back** — custom back artwork for postcard designs (fetch+blob download, correct Lob template zones)
- **Design back canvas** — dark/white split preview, QR → booking URL, all text editable per design
- **Edit Back button** on design cards — pre-fills upload modal with saved back overrides
- **4-Photo Grid** and **5-Photo Grid** canvas templates
- **`bdNoSelect` flag** to suppress selection handles on photo upload zones
- **Free Edit mode** — only unlocks text; photos/structural always stay locked

### Fixed
- QR/address/postage zone coordinates calibrated to measured 2775×1875 Lob template
- Fabric `setControlsVisibility` replaced with `_controlsVisibility` (Fabric 5 safe)
- `bdLock`/`bdZoneLabel`/`bdNoSelect` registered with Fabric so they survive `loadFromJSON`
- Duplicate `b1/b2/b3` variable declarations causing login `SyntaxError`
- `renderQueue` broken quote escaping in onclick handlers — use `data-id` attributes

---

## [Build 11] 2026-06-30 — Credit System + Mail Queue Overhaul

### Added
- **Follow-Up Blitz** — Buy 3 Get 5 bundle, credit unlock postcard, restored `m-drip` modal
- **Campaign numbering** — group Mail Queue by address, number each send (#1=Free Postcard, #2, #3…)
- **`mailer_log` table** — full audit trail for all postcard sends
- **Queue source tracking** — `source`, `drip_step`, `drip_est_id`, `scheduled_send_at` columns

### Changed
- **Unified credit pool** — `print-unlock` now deducts from `mailer_credits` (not `lookup_credits`)
- **Grandfather unlock logic removed** — all pins require explicit credit unlock
- **Unlock modal** updated: shows exactly what 1 credit unlocks

### Fixed
- `openSendPostcardModal` — robust fallback synthesizes estimate from queue item if no linked estimate found
- `0[object Object]` credits display bug
- Free postcard after unlock: writes to `queue` table, adds to `S.queue` in memory
- `connectivity probe` 401 error — now uses `/accounts?select=id&limit=0`

---

## [Build 10] 2026-06-29 — Trade System + QB/CompanyCam + Solar Overlay

### Added
- **Configurable Good/Better/Best tiers** in Settings Pricing tab (material $/sq selectors)
- **Fully sync pins and estimates** — delete/restore one cascades to the other
- **Duplicate detection** on `createAccount` — warns on matching company name or existing email
- **Bulk Purge All** button in Trash — permanently deletes selected estimates and their pins
- **Solar potential section** gated to solar trade view only

### Fixed
- `saveSettings` crashes with null read — null-safe `v/n/ck` helpers
- Credits display under company name — `updateCreditBadge` updates inline element after live balance fetch
- `autoFillOwnerIfEmpty` was falsely triggering grandfather unlock rule on new pins
- `effectiveAccountId` used for all super admin API calls
- `lookupContactInfo()` used for contact fill (same proven path as canvass map)
- 422 email-already-exists on `create-user` — recover existing auth user and upsert profile

---

## [Build 9] 2026-06-28 — Pin Pipeline + Estimator Accordion

### Added
- **Action-based pin pipeline** — pinned → mailed → emailed → called → responded → quoted → signed
- **Estimator accordion layout** — 4 collapsible cards + sticky total bar
- **Persistent Supabase `solar_cache`** — each address fetched once forever
- **Auto-pull homeowner name + equity** on pin save (non-blocking)
- **Unified 1-credit pin unlock system**

### Fixed
- Solar fetch restored on pin popup open — uses DB cache (free after first lookup)
- Phone/Email order in estimator; owner name in pin popup
- Graceful fallback when Google Solar API is unavailable
- Homeowner Phone field removed from Pin This Home modal
- `_mapboxToken` used for satellite measurement fetch

---

## [Build 8] 2026-06-26 — Canvas Designer Foundation

### Added
- Canvas designer with Fabric.js — photo upload zones, text editing, logo placement
- Template seeding endpoint — any authenticated user can seed canvas templates
- `estimate.biddrop.us` — public estimate page with API_BASE from `window.location.origin`

### Fixed
- Uploaded photos stay in fields panel; better photo/logo labels; white background
- Photo pan/scale in zone, white bg, photo4 z-order, logo adjustable
- Clip uploaded photos to zone bounds, lock movement, cover-fill scale

---

## [Build 7] 2026-06-25 — Nearby Campaign + RentCast Integration

### Added
- **Nearby Campaign** — RentCast property fetch within radius, haversine sort by distance, bulk postcard send
- **`campaign_targets` table** — persists campaign metadata with `design_id`, `design_name`, `design_url`
- **`pixel_hits` table** — tracks QR code scans and postcard pixel events
- **`canvas_templates` table** — stores reusable postcard design templates

### Fixed
- `haversineM` fix — correct great-circle distance calculation
- `launchNearbyCampaign` — correct use of `_nearbyFilteredHomes` → `_nearbyFetchedHomes` → fallback to existing pins

---

## [Build 6] 2026-06-24 — GHL Integration + Drip Scheduler

### Added
- **GHL OAuth** — connect GoHighLevel CRM, push contacts and estimates
- **Drip scheduler** — automated follow-up postcard sequence with configurable step delays
- **Queue source tracking** — free postcard with unlock, drip step attribution

---

## [Build 5] 2026-06-20 — Postcard Designer + Lob Integration

### Added
- **Postcard design library** — upload front/back, per-design text overrides
- **Lob postcard send** — 6×9 postcards via Lob API, address validation, credit deduction
- **Estimate reveal postcard** — send estimate as physical postcard
- **Print feature** — gated to Pro tier and above

---

## [Build 4] 2026-06-10 — Estimates + Trades

### Added
- **Estimates tab** — full estimator with Good/Better/Best pricing, material line items, digital signature
- **Trade system** — roofing, solar, gutters, siding, windows, painting, HVAC, landscaping
- **QuickBooks integration** — create QB invoices from estimates
- **CompanyCam integration** — attach job photos to estimates

---

## [Build 3] 2026-05-15 — Map Core + Pin Management

### Added
- **Interactive map** — Google Maps with pin placement, satellite view, roof measurement
- **Pin pipeline** — status tracking from pinned → signed
- **Homeowner lookup** — RentCast equity data, owner name auto-fill
- **Storm overlay** — NOAA hail/wind data on map

---

## [Build 2] 2026-04-15 — Auth + Multi-Tenant Accounts

### Added
- **Supabase auth** — email/password login, password reset, role-based access (`super_admin`, `admin`, `rep`)
- **Multi-tenant accounts** — agency model with sub-accounts
- **Team management** — invite reps, set roles, manage billing

---

## [Build 1] 2026-03-28 — Initial Release

### Added
- Initial BidDrop application — single `index.html` with Supabase backend
- Basic pin map, estimates, and postcard send functionality
