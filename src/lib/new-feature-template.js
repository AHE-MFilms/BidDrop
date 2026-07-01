/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW FEATURE TEMPLATE — copy this file, rename it, fill in the sections below
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CONVENTIONS FOR NEW CODE IN BidDrop
 * ─────────────────────────────────────
 *
 * 1. PURE LOGIC → src/lib/<name>.js
 *    Any function that takes inputs and returns outputs without touching the DOM,
 *    the global S object, or fetch() belongs in src/lib/. It must be exported
 *    as a CommonJS module so it can be tested with `node tests/unit.test.js`.
 *
 *    Example:
 *      // src/lib/my-feature.js
 *      function calcSomething(a, b) { return a + b; }
 *      module.exports = { calcSomething };
 *
 * 2. DOM INTERACTION → src/<name>.js
 *    Functions that read/write DOM elements belong in a regular src/ file.
 *    Always use optional chaining when accessing elements:
 *      const el = document.getElementById('my-id');
 *      if (!el) return;           // ← guard before any property access
 *      el.innerHTML = buildHtml();
 *
 * 3. API CALLS → src/<name>.js or api/admin-<name>.js
 *    All privileged API keys (Lob, RentCast, GHL, Stripe) must stay server-side
 *    in api/admin-*.js. The frontend calls /api/admin?action=<name>.
 *    Never put secret keys in src/ files.
 *
 * 4. GLOBAL STATE → read from S, write via supabase-sync.js helpers
 *    Read:  S.pins, S.estimates, S.queue, S.profile, S.cfg
 *    Write: use the existing helpers (savePinToDb, saveEstimateToDb, etc.)
 *    Never assign directly to S.pins = [...] — use the array mutation helpers.
 *
 * 5. EVENT HANDLERS → use onclick="myFunction()" in HTML partials
 *    The function must be globally available (defined at the top level of a
 *    src/ file, not inside another function or an IIFE).
 *    After adding a new onclick handler, run `node build.js` — the linkage
 *    validator (check #9) will confirm the function is reachable.
 *
 * 6. TESTS → tests/unit.test.js
 *    Every function in src/lib/ must have at least 3 test cases:
 *      - Happy path
 *      - Edge case (empty/null/zero input)
 *      - Boundary condition
 *    Run tests with: npm test
 *
 * 7. MIGRATIONS → api/migrate.js
 *    New DB columns or indexes go in the migrations array at the bottom of
 *    migrate.js under a new "── Build N: <description> ──" comment block.
 *    Use IF NOT EXISTS / IF NOT EXISTS for all DDL so re-running is safe.
 *    After adding, visit /api/migrate?token=biddrop-migrate-2026 in production.
 *
 * 8. CHANGELOG → CHANGELOG.md
 *    Add an entry under a new [Build N] heading for every production deploy.
 *    Use Added / Changed / Fixed / Removed sections.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPLATE STARTS BELOW — delete everything above this line in your new file
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Pure logic (goes in src/lib/) ────────────────────────────────────────────

/**
 * One-line description of what this function does.
 *
 * @param {string} input - Description of the parameter
 * @returns {string} Description of the return value
 *
 * @example
 *   myPureFunction('hello') // → 'HELLO'
 */
function myPureFunction(input) {
  if (!input) return '';
  return input.toUpperCase();
}

// Export for tests (CommonJS — required by node tests/unit.test.js)
if (typeof module !== 'undefined') {
  module.exports = { myPureFunction };
}

// ── DOM interaction (goes in src/) ───────────────────────────────────────────

/**
 * Renders something into the DOM.
 * Always guards against missing elements.
 */
function renderMyFeature(data) {
  const container = document.getElementById('my-feature-container');
  if (!container) return; // guard — element may not exist on this page

  container.innerHTML = data.map(item => `
    <div class="item" onclick="handleMyFeatureClick('${item.id}')">
      ${item.label}
    </div>
  `).join('');
}

/**
 * Handles a click from the rendered list.
 * Must be a top-level function (not nested) so onclick= can find it.
 */
function handleMyFeatureClick(id) {
  const item = S.myFeatureItems?.find(i => i.id === id);
  if (!item) return;
  // ... do something with item
}

// ── API call pattern ──────────────────────────────────────────────────────────

/**
 * Calls the server-side admin endpoint for a privileged action.
 * Never put API keys here — they live in api/admin-*.js.
 */
async function fetchMyFeatureData(accountId) {
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${S.session?.access_token}` },
      body: JSON.stringify({ action: 'my-feature-action', accountId })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[my-feature] fetchMyFeatureData failed:', err);
    showToast('Failed to load data. Please try again.', 'error');
    return null;
  }
}
