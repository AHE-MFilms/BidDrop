/**
 * BidDrop — Drip scheduling utilities
 * No DOM, no S object, no window, no fetch.
 * Safe to import in Node.js tests.
 *
 * Sources: init.js (startDripSequence date math), photo.js (getDripStepMessage)
 */

'use strict';

/**
 * Default drip step messages (used when no custom config is set).
 * Keys are step numbers (2–4).
 */
const DRIP_DEFAULTS = {
  2: { headline: 'Still thinking it over?',    subtext: "Your estimate is still valid. We'd love to help." },
  3: { headline: 'Storm season is coming.',     subtext: "Now's the time to protect your home. Call us today." },
  4: { headline: 'Final notice.',               subtext: 'Your estimate expires soon. Secure your spot before prices rise.' },
};

/**
 * Return the headline and subtext for a drip step.
 * Uses custom config values if provided, otherwise falls back to defaults.
 *
 * @param {number} step  — step number (2, 3, 4, …)
 * @param {object} [cfg] — optional S.cfg-like object with drip2Headline, drip2Subtext, etc.
 * @returns {{ headline: string, subtext: string }}
 */
function getDripStepMessage(step, cfg) {
  const c = cfg || {};
  const d = DRIP_DEFAULTS[step] || { headline: 'Follow-Up', subtext: '' };
  return {
    headline: c['drip' + step + 'Headline'] || d.headline,
    subtext:  c['drip' + step + 'Subtext']  || d.subtext,
  };
}

/**
 * Calculate the ISO send date for a drip step given a base date and a delay in days.
 * Handles month-boundary and leap-year edge cases correctly.
 *
 * @param {Date|string} baseDate — the estimate save date (or any reference date)
 * @param {number} delayDays     — number of days after baseDate to send
 * @returns {string} ISO 8601 date string (e.g. "2025-03-15T00:00:00.000Z")
 */
function calcDripSendDate(baseDate, delayDays) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + delayDays);
  return d.toISOString();
}

/**
 * Build the full drip schedule for an estimate given step delays.
 * Returns an array of step objects with sendAt dates.
 *
 * @param {Date|string} baseDate
 * @param {number[]} delayDays — array of delays for steps 2, 3, 4, …
 * @param {object} [cfg]       — optional S.cfg for custom messages
 * @returns {Array<{ step: number, sendAt: string, headline: string, subtext: string }>}
 */
function buildDripSchedule(baseDate, delayDays, cfg) {
  return delayDays.map((delay, i) => {
    const step = i + 2; // steps start at 2
    const msg = getDripStepMessage(step, cfg);
    return {
      step,
      sendAt: calcDripSendDate(baseDate, delay),
      headline: msg.headline,
      subtext: msg.subtext,
    };
  });
}

/**
 * Return true if a drip queue item is due to be sent.
 * @param {{ status: string, scheduled_send_at: string|null }} item
 * @param {Date} [now]
 * @returns {boolean}
 */
function isDripItemDue(item, now) {
  const n = now || new Date();
  return (
    item.drip_step &&
    item.status === 'pending' &&
    item.scheduled_send_at &&
    new Date(item.scheduled_send_at) <= n
  );
}

/**
 * Return true if a scheduled drip item should be promoted to 'pending'.
 * @param {{ status: string, scheduled_send_at: string|null }} item
 * @param {Date} [now]
 * @returns {boolean}
 */
function shouldPromoteToPending(item, now) {
  const n = now || new Date();
  return (
    item.status === 'scheduled' &&
    !!item.scheduled_send_at &&
    new Date(item.scheduled_send_at) <= n
  );
}

// CommonJS export for Node.js test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DRIP_DEFAULTS, getDripStepMessage, calcDripSendDate, buildDripSchedule, isDripItemDue, shouldPromoteToPending };
}
