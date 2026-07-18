/**
 * BidDrop — Credit math utilities
 * No DOM, no S object, no window, no fetch.
 * Safe to import in Node.js tests.
 *
 * Sources: credits.js (updateCreditBadge logic), api/admin-users.js (credit deduction)
 */

'use strict';

/** Cost per mailer in credits (1 credit = $4 = 1 postcard) */
const CREDIT_COST_POSTCARD = 1;

/** Cost per homeowner name lookup in credits */
const CREDIT_COST_LOOKUP = 0.25;

/** Plan → free monthly credits map
 * New system: monthly ($99/mo, 20 credits via mailerCredits top-up) vs payg ($0/mo, 0 free)
 * Legacy plan names kept for backwards compatibility.
 */
const PLAN_FREE_CREDITS = {
  payg:       0,
  monthly:    0,
  // legacy
  starter:    0,
  pro:        0,
  agency:     0,
  enterprise: 0,
};

/**
 * Calculate the total available credits for an account.
 * @param {{ plan?: string, mailerCredits?: number, freeMailerCreditsUsed?: number }} cfg
 * @returns {{ freeLeft: number, paid: number, total: number }}
 */
function calcAvailableCredits(cfg) {
  const plan = (cfg.plan || 'payg').toLowerCase();
  const freeLimit = PLAN_FREE_CREDITS[plan] ?? 0;
  const freeLeft = Math.max(0, freeLimit - (cfg.freeMailerCreditsUsed || 0));
  const paid = cfg.mailerCredits || 0;
  const total = freeLeft + paid;
  return { freeLeft, paid, total };
}

/**
 * Return true if the account has enough credits to send `count` postcards.
 * @param {{ plan?: string, mailerCredits?: number, freeMailerCreditsUsed?: number }} cfg
 * @param {number} [count=1]
 * @returns {boolean}
 */
function hasEnoughCredits(cfg, count) {
  const n = count ?? 1;
  const { total } = calcAvailableCredits(cfg);
  return total >= n * CREDIT_COST_POSTCARD;
}

/**
 * Deduct credits for sending postcards. Returns the updated cfg (does not mutate).
 * Deducts from free credits first, then paid credits.
 * @param {{ plan?: string, mailerCredits?: number, freeMailerCreditsUsed?: number }} cfg
 * @param {number} [count=1]
 * @returns {{ mailerCredits: number, freeMailerCreditsUsed: number }}
 */
function deductCredits(cfg, count) {
  const n = count ?? 1;
  const plan = (cfg.plan || 'payg').toLowerCase();
  const freeLimit = PLAN_FREE_CREDITS[plan] ?? 0;
  let freeUsed = cfg.freeMailerCreditsUsed || 0;
  let paid = cfg.mailerCredits || 0;

  let remaining = n * CREDIT_COST_POSTCARD;

  // Deduct from free first
  const freeAvail = Math.max(0, freeLimit - freeUsed);
  const freeDeduct = Math.min(freeAvail, remaining);
  freeUsed += freeDeduct;
  remaining -= freeDeduct;

  // Deduct remainder from paid
  paid = Math.max(0, paid - remaining);

  return { mailerCredits: paid, freeMailerCreditsUsed: freeUsed };
}

/**
 * Calculate the dollar cost of a credit bundle.
 * Pricing: $4 per credit (single), $12 for 4 credits (buy 3 get 1 free).
 * @param {number} credits
 * @returns {number} dollar amount
 */
function creditBundleCost(credits) {
  const bundles4 = Math.floor(credits / 4);
  const singles  = credits % 4;
  return bundles4 * 12 + singles * 4;
}

// CommonJS export for Node.js test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CREDIT_COST_POSTCARD, CREDIT_COST_LOOKUP, PLAN_FREE_CREDITS,
    calcAvailableCredits, hasEnoughCredits, deductCredits, creditBundleCost
  };
}
