/**
 * BidDrop — Pure formatting utilities
 * No DOM, no S object, no window, no fetch.
 * Safe to import in Node.js tests.
 *
 * Sources: map-core.js (formatPhone), ui.js (timeAgo, fmtDate),
 *          follow-up.js (applyFuTokens), state.js (normalizeAddr)
 */

'use strict';

/**
 * Format a 10-digit phone number string to (XXX) XXX-XXXX.
 * Strips all non-digit characters first.
 * @param {string} raw
 * @returns {string}
 */
function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) {
    return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
  }
  if (digits.length === 11 && digits[0] === '1') {
    return '(' + digits.slice(1, 4) + ') ' + digits.slice(4, 7) + '-' + digits.slice(7);
  }
  return raw; // return unchanged if unrecognised format
}

/**
 * Return a human-readable relative time string (e.g. "3h ago").
 * @param {string|Date} iso
 * @returns {string}
 */
function timeAgo(iso) {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  const h = Math.floor(m / 60);
  const dy = Math.floor(h / 24);
  if (m < 1)  return 'just now';
  if (m < 60) return m + 'm ago';
  if (h < 24) return h + 'h ago';
  return dy + 'd ago';
}

/**
 * Format an ISO date string to "Jan 1, 2025".
 * @param {string|Date} iso
 * @returns {string}
 */
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Replace template tokens in a follow-up message.
 * Tokens: {name}, {rep}, {company}, {address}
 * @param {string} tpl
 * @param {string} name
 * @param {string} rep
 * @param {string} company
 * @param {string} addr
 * @returns {string}
 */
function applyFuTokens(tpl, name, rep, company, addr) {
  return tpl
    .replace(/\{name\}/g, name)
    .replace(/\{rep\}/g, rep)
    .replace(/\{company\}/g, company)
    .replace(/\{address\}/g, addr);
}

/**
 * Normalize a street address for fuzzy matching.
 * Expands abbreviations, strips punctuation, lowercases.
 * @param {string} addr
 * @returns {string}
 */
function normalizeAddr(addr) {
  if (!addr) return '';
  return addr.toLowerCase()
    .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd').replace(/\bboulevard\b/g, 'blvd').replace(/\bcourt\b/g, 'ct')
    .replace(/\blane\b/g, 'ln').replace(/\bplace\b/g, 'pl').replace(/\bcircle\b/g, 'cir')
    .replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert a US state full name to its 2-letter abbreviation.
 * Returns the input unchanged if already an abbreviation or unrecognised.
 * @param {string} s
 * @returns {string}
 */
function toStateAbbr(s) {
  if (!s) return s;
  const map = {
    'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
    'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
    'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS',
    'kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA',
    'michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT',
    'nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM',
    'new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK',
    'oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC',
    'south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT',
    'virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY'
  };
  const abbr = map[s.trim().toLowerCase()];
  return abbr || s.trim();
}

/**
 * Parse a full US address string into components.
 * Input: "123 Main St, Chicago, IL 60601"
 * Output: { line1, city, state, zip }
 * @param {string} full
 * @returns {{ line1: string, city: string, state: string, zip: string }}
 */
function parseAddr(full) {
  const parts = (full || '').split(',').map(s => s.trim());
  const line1 = parts[0] || '';
  const city  = parts[1] || '';
  const stateZip = (parts[2] || '').trim().split(/\s+/);
  const state = stateZip[0] || '';
  const zip   = stateZip[1] || '';
  return { line1, city, state, zip };
}

// CommonJS export for Node.js test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatPhone, timeAgo, fmtDate, applyFuTokens, normalizeAddr, toStateAbbr, parseAddr };
}
