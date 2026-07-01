/**
 * BidDrop Unit Tests
 * Run with: node tests/unit.test.js
 *
 * Tests cover the four highest-risk pure-logic functions:
 *  1. Credit math (cost calculation per plan tier)
 *  2. Address parsing (lob-postcard-campaign address splitter)
 *  3. haversineM (distance calculation for Nearby Campaign)
 *  4. Drip scheduler date arithmetic
 */

'use strict';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function assertApprox(actual, expected, tolerance, label) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✓ ${label} (got ${actual.toFixed(2)}, expected ${expected.toFixed(2)} ±${tolerance})`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got ${actual}, expected ${expected} ±${tolerance}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREDIT MATH
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n1. Credit math (cost per postcard by plan tier)');

// Extracted from admin-lob.js — the actual pricing table
const CREDIT_COST = { starter: 1.25, pro: 1.10, agency: 0.95, enterprise: 0.85 };

function calcCreditCost(plan, qty) {
  const rate = CREDIT_COST[plan] || CREDIT_COST.starter;
  return Math.round(rate * qty * 100) / 100;
}

assert(calcCreditCost('starter', 1)    === 1.25,  'starter: 1 postcard = $1.25');
assert(calcCreditCost('pro', 1)        === 1.10,  'pro: 1 postcard = $1.10');
assert(calcCreditCost('agency', 1)     === 0.95,  'agency: 1 postcard = $0.95');
assert(calcCreditCost('enterprise', 1) === 0.85,  'enterprise: 1 postcard = $0.85');
assert(calcCreditCost('starter', 10)   === 12.50, 'starter: 10 postcards = $12.50');
assert(calcCreditCost('pro', 100)      === 110.00,'pro: 100 postcards = $110.00');
assert(calcCreditCost('unknown', 5)    === 6.25,  'unknown plan falls back to starter rate');

// Credit balance after deduction
function deductCredits(balance, cost) {
  if (balance < cost) return null; // insufficient
  return Math.round((balance - cost) * 100) / 100;
}

assert(deductCredits(10.00, 1.25) === 8.75,  'deduct $1.25 from $10.00 = $8.75');
assert(deductCredits(1.00, 1.25)  === null,  'insufficient balance returns null');
assert(deductCredits(1.25, 1.25)  === 0.00,  'exact balance deducts to $0.00');

// ─────────────────────────────────────────────────────────────────────────────
// 2. ADDRESS PARSING
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Address parsing (Lob postcard address splitter)');

// Extracted from admin-lob.js — parses "123 Main St, Springfield, IL 62701"
function parseAddress(fullAddr) {
  if (!fullAddr) return null;
  // Attempt to split "street, city, state zip" or "street, city, state, zip"
  const parts = fullAddr.split(',').map(s => s.trim());
  if (parts.length < 3) return null;
  const street = parts[0];
  const city   = parts[1];
  // Last part: "IL 62701" or "IL" and "62701" as separate parts
  const stateZip = parts.slice(2).join(' ').trim();
  const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!stateZipMatch) return null;
  return { street, city, state: stateZipMatch[1], zip: stateZipMatch[2] };
}

const a1 = parseAddress('123 Main St, Springfield, IL 62701');
assert(a1 !== null,                    'parses standard US address');
assert(a1?.street === '123 Main St',   'extracts street correctly');
assert(a1?.city   === 'Springfield',   'extracts city correctly');
assert(a1?.state  === 'IL',            'extracts state correctly');
assert(a1?.zip    === '62701',         'extracts zip correctly');

const a2 = parseAddress('456 Oak Ave, Dallas, TX 75201-1234');
assert(a2?.zip === '75201-1234',       'handles ZIP+4 format');

const a3 = parseAddress('789 Elm Blvd, Miami, FL, 33101');
assert(a3 !== null,                    'handles comma-separated state and zip');

assert(parseAddress('') === null,      'empty string returns null');
assert(parseAddress(null) === null,    'null input returns null');
assert(parseAddress('No City') === null, 'insufficient parts returns null');

// ─────────────────────────────────────────────────────────────────────────────
// 3. HAVERSINE DISTANCE
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. haversineM (great-circle distance in meters)');

// Exact copy from src/campaign.js
function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Same point → 0 meters
assertApprox(haversineM(40.7128, -74.0060, 40.7128, -74.0060), 0, 0.001,
  'same point = 0 m');

// NYC to LA ≈ 3,940,000 m (known value)
assertApprox(haversineM(40.7128, -74.0060, 34.0522, -118.2437), 3940000, 10000,
  'NYC to LA ≈ 3,940 km');

// 1 mile ≈ 1609 m — test a roughly 1-mile offset
// Moving ~0.01449° north ≈ 1 mile at mid-latitudes
assertApprox(haversineM(30.0, -90.0, 30.01449, -90.0), 1609, 20,
  '~1 mile north offset ≈ 1609 m');

// Nearby Campaign radius filter: 0.25 miles = 402 m
const nearbyThreshold = 0.25 * 1609.34;
const distClose = haversineM(30.0, -90.0, 30.002, -90.0);
const distFar   = haversineM(30.0, -90.0, 30.01, -90.0);
assert(distClose < nearbyThreshold, 'close point is within 0.25 mile radius');
assert(distFar   > nearbyThreshold, 'far point is outside 0.25 mile radius');

// ─────────────────────────────────────────────────────────────────────────────
// 4. DRIP SCHEDULER DATE ARITHMETIC
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. Drip scheduler date arithmetic');

// Extracted from src/init.js — calculates the send date for a drip step
function calcDripSendDate(startDateMs, delayDays) {
  const d = new Date(startDateMs);
  d.setDate(d.getDate() + delayDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

const base = new Date('2026-01-01').getTime();
assert(calcDripSendDate(base, 0)  === '2026-01-01', 'day 0 = same day');
assert(calcDripSendDate(base, 1)  === '2026-01-02', 'day 1 = next day');
assert(calcDripSendDate(base, 7)  === '2026-01-08', 'day 7 = one week later');
assert(calcDripSendDate(base, 30) === '2026-01-31', 'day 30 = Jan 31');
assert(calcDripSendDate(base, 31) === '2026-02-01', 'day 31 crosses month boundary');

// Month-end edge cases
const endOfFeb = new Date('2026-02-28').getTime();
assert(calcDripSendDate(endOfFeb, 1) === '2026-03-01', 'Feb 28 + 1 day = Mar 1 (non-leap year)');

const leapFeb = new Date('2024-02-28').getTime();
assert(calcDripSendDate(leapFeb, 1) === '2024-02-29', 'Feb 28 + 1 day = Feb 29 (leap year)');

// Step number to delay mapping (from drip config)
function getDripStepDelay(stepNum, steps) {
  const step = steps.find(s => s.step === stepNum);
  return step ? step.delayDays : null;
}

const defaultSteps = [
  { step: 1, delayDays: 0 },
  { step: 2, delayDays: 7 },
  { step: 3, delayDays: 21 },
];

assert(getDripStepDelay(1, defaultSteps) === 0,    'step 1 delay = 0 days');
assert(getDripStepDelay(2, defaultSteps) === 7,    'step 2 delay = 7 days');
assert(getDripStepDelay(3, defaultSteps) === 21,   'step 3 delay = 21 days');
assert(getDripStepDelay(4, defaultSteps) === null, 'missing step returns null');

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} tests passed`);
}
