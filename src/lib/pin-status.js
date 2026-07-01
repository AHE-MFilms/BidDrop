/**
 * BidDrop — Pin status helpers
 * No DOM, no S object, no window, no fetch.
 * Safe to import in Node.js tests.
 *
 * Source: state.js (PIN_STATUSES, sColor, sLabel, sEmoji)
 */

'use strict';

const PIN_STATUSES = [
  { v: 'pinned',         label: 'Pinned',         color: '#6B7280', emoji: '📍' },
  { v: 'mailed',         label: 'Mailed',          color: '#3B82F6', emoji: '📬' },
  { v: 'emailed',        label: 'Emailed',         color: '#A855F7', emoji: '📧' },
  { v: 'called',         label: 'Called',          color: '#EAB308', emoji: '📞' },
  { v: 'responded',      label: 'Responded',       color: '#F59E0B', emoji: '💬' },
  { v: 'quoted',         label: 'Quoted',          color: '#0EA5E9', emoji: '📋' },
  { v: 'signed',         label: 'Signed',          color: '#22C55E', emoji: '✅' },
  { v: 'not_interested', label: 'Not Interested',  color: '#3D5269', emoji: '❌' },
];

const PIPELINE_ACTIVE   = new Set(['pinned', 'mailed', 'emailed', 'called', 'responded', 'quoted']);
const PIPELINE_WON      = new Set(['signed']);
const PIPELINE_ARCHIVED = new Set(['not_interested']);

/**
 * Return the hex color for a pin status string.
 * Falls back to legacy status names for backward compatibility.
 * @param {string} s
 * @returns {string}
 */
function sColor(s) {
  const found = PIN_STATUSES.find(p => p.v === s);
  if (found) return found.color;
  // Legacy fallbacks
  return {
    needs_roof: '#F25C05', interested: '#6B7280', contacted: '#EAB308',
    converted: '#22C55E', bid_sent: '#3B82F6', lost: '#3D5269'
  }[s] || '#6B7280';
}

/**
 * Return the human-readable label for a pin status string.
 * @param {string} s
 * @returns {string}
 */
function sLabel(s) {
  const found = PIN_STATUSES.find(p => p.v === s);
  if (found) return found.label;
  // Legacy fallbacks
  return {
    needs_roof: 'Pinned', interested: 'Pinned', contacted: 'Called',
    converted: 'Signed', bid_sent: 'Mailed', lost: 'Not Interested'
  }[s] || s;
}

/**
 * Return the emoji for a pin status string.
 * @param {string} s
 * @returns {string}
 */
function sEmoji(s) {
  const found = PIN_STATUSES.find(p => p.v === s);
  return found ? found.emoji : '📍';
}

/**
 * Return true if the status is in the active pipeline (not won or archived).
 * @param {string} s
 * @returns {boolean}
 */
function isActivePipelineStatus(s) {
  return PIPELINE_ACTIVE.has(s);
}

/**
 * Return true if the status represents a won deal.
 * @param {string} s
 * @returns {boolean}
 */
function isWonStatus(s) {
  return PIPELINE_WON.has(s);
}

// CommonJS export for Node.js test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PIN_STATUSES, PIPELINE_ACTIVE, PIPELINE_WON, PIPELINE_ARCHIVED, sColor, sLabel, sEmoji, isActivePipelineStatus, isWonStatus };
}
