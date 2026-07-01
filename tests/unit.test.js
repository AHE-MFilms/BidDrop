/**
 * BidDrop — Unit Tests
 * Run with: node tests/unit.test.js
 * No external test framework required.
 *
 * Coverage:
 *  - src/lib/format.js   (formatPhone, timeAgo, fmtDate, applyFuTokens, normalizeAddr, toStateAbbr, parseAddr)
 *  - src/lib/geo.js      (haversineM, isPointInPolygon, calcPolygonSqFt, homeAgeColor, homeAgeLabel)
 *  - src/lib/pin-status.js (sColor, sLabel, sEmoji, isActivePipelineStatus, isWonStatus)
 *  - src/lib/drip.js     (getDripStepMessage, calcDripSendDate, buildDripSchedule, isDripItemDue, shouldPromoteToPending)
 *  - src/lib/credits.js  (calcAvailableCredits, hasEnoughCredits, deductCredits, creditBundleCost)
 *  - Legacy inline tests (credit math, address parsing, haversineM, drip scheduler)
 */

'use strict';

// ── Lib imports ──────────────────────────────────────────────────────────────
const fmt  = require('../src/lib/format.js');
const geo  = require('../src/lib/geo.js');
const ps   = require('../src/lib/pin-status.js');
const drip = require('../src/lib/drip.js');
const cred = require('../src/lib/credits.js');

// ── Minimal test harness ─────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + '\n  ' : '') +
      `Expected: ${JSON.stringify(expected)}\n  Got:      ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg ? msg + '\n  ' : '') +
    `Expected: ${b}\n  Got:      ${a}`);
}

function assertApprox(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error((msg ? msg + '\n  ' : '') +
      `Expected ~${expected} (±${tolerance}), got ${actual}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FORMAT — formatPhone
// ════════════════════════════════════════════════════════════════════════════
test('formatPhone: 10-digit string', () => {
  assertEqual(fmt.formatPhone('3135550100'), '(313) 555-0100');
});
test('formatPhone: 11-digit with leading 1', () => {
  assertEqual(fmt.formatPhone('13135550100'), '(313) 555-0100');
});
test('formatPhone: already formatted', () => {
  assertEqual(fmt.formatPhone('(313) 555-0100'), '(313) 555-0100');
});
test('formatPhone: with dashes', () => {
  assertEqual(fmt.formatPhone('313-555-0100'), '(313) 555-0100');
});
test('formatPhone: empty string', () => {
  assertEqual(fmt.formatPhone(''), '');
});
test('formatPhone: null returns empty', () => {
  assertEqual(fmt.formatPhone(null), '');
});
test('formatPhone: undefined returns empty', () => {
  assertEqual(fmt.formatPhone(undefined), '');
});
test('formatPhone: 7-digit returns unchanged', () => {
  assertEqual(fmt.formatPhone('5550100'), '5550100');
});

// ════════════════════════════════════════════════════════════════════════════
// FORMAT — timeAgo
// ════════════════════════════════════════════════════════════════════════════
test('timeAgo: null returns empty string', () => {
  assertEqual(fmt.timeAgo(null), '');
});
test('timeAgo: empty string returns empty', () => {
  assertEqual(fmt.timeAgo(''), '');
});
test('timeAgo: just now (< 1 min)', () => {
  const now = new Date(Date.now() - 30000).toISOString();
  assertEqual(fmt.timeAgo(now), 'just now');
});
test('timeAgo: minutes ago', () => {
  const ago = new Date(Date.now() - 5 * 60000).toISOString();
  assertEqual(fmt.timeAgo(ago), '5m ago');
});
test('timeAgo: hours ago', () => {
  const ago = new Date(Date.now() - 3 * 3600000).toISOString();
  assertEqual(fmt.timeAgo(ago), '3h ago');
});
test('timeAgo: days ago', () => {
  const ago = new Date(Date.now() - 2 * 86400000).toISOString();
  assertEqual(fmt.timeAgo(ago), '2d ago');
});

// ════════════════════════════════════════════════════════════════════════════
// FORMAT — fmtDate
// ════════════════════════════════════════════════════════════════════════════
test('fmtDate: null returns empty', () => {
  assertEqual(fmt.fmtDate(null), '');
});
test('fmtDate: formats ISO date includes year', () => {
  const result = fmt.fmtDate('2025-03-15T00:00:00.000Z');
  assert(result.includes('2025'), 'should include year');
});
test('fmtDate: formats ISO date includes day', () => {
  // Use noon UTC to avoid midnight UTC/local timezone boundary issues
  const result = fmt.fmtDate('2025-03-15T12:00:00.000Z');
  assert(result.includes('15'), 'should include day: got ' + result);
});

// ════════════════════════════════════════════════════════════════════════════
// FORMAT — applyFuTokens
// ════════════════════════════════════════════════════════════════════════════
test('applyFuTokens: replaces all tokens', () => {
  const tpl = 'Hi {name}, {rep} from {company} here. Re: {address}.';
  const result = fmt.applyFuTokens(tpl, 'John', 'Mike', 'BidDrop', '123 Main St');
  assertEqual(result, 'Hi John, Mike from BidDrop here. Re: 123 Main St.');
});
test('applyFuTokens: replaces multiple occurrences', () => {
  assertEqual(fmt.applyFuTokens('{name} is {name}', 'Alice', '', '', ''), 'Alice is Alice');
});
test('applyFuTokens: no tokens returns unchanged', () => {
  assertEqual(fmt.applyFuTokens('Hello world', 'A', 'B', 'C', 'D'), 'Hello world');
});
test('applyFuTokens: empty template', () => {
  assertEqual(fmt.applyFuTokens('', 'A', 'B', 'C', 'D'), '');
});

// ════════════════════════════════════════════════════════════════════════════
// FORMAT — normalizeAddr
// ════════════════════════════════════════════════════════════════════════════
test('normalizeAddr: null returns empty', () => {
  assertEqual(fmt.normalizeAddr(null), '');
});
test('normalizeAddr: empty returns empty', () => {
  assertEqual(fmt.normalizeAddr(''), '');
});
test('normalizeAddr: street → st', () => {
  assertEqual(fmt.normalizeAddr('123 Main Street'), '123 main st');
});
test('normalizeAddr: avenue → ave', () => {
  assertEqual(fmt.normalizeAddr('456 Oak Avenue'), '456 oak ave');
});
test('normalizeAddr: boulevard → blvd', () => {
  assertEqual(fmt.normalizeAddr('789 Sunset Boulevard'), '789 sunset blvd');
});
test('normalizeAddr: strips punctuation', () => {
  assert(!fmt.normalizeAddr('123 Main St., #4').includes('.'), 'should strip dots');
});
test('normalizeAddr: collapses whitespace', () => {
  assert(!/\s{2,}/.test(fmt.normalizeAddr('123   Main   St')), 'should collapse spaces');
});
test('normalizeAddr: same address normalizes to same string', () => {
  assertEqual(fmt.normalizeAddr('123 Main Street'), fmt.normalizeAddr('123 main st'));
});

// ════════════════════════════════════════════════════════════════════════════
// FORMAT — toStateAbbr
// ════════════════════════════════════════════════════════════════════════════
test('toStateAbbr: Michigan → MI', () => {
  assertEqual(fmt.toStateAbbr('Michigan'), 'MI');
});
test('toStateAbbr: case insensitive lower', () => {
  assertEqual(fmt.toStateAbbr('michigan'), 'MI');
});
test('toStateAbbr: case insensitive upper', () => {
  assertEqual(fmt.toStateAbbr('MICHIGAN'), 'MI');
});
test('toStateAbbr: already abbreviated', () => {
  assertEqual(fmt.toStateAbbr('MI'), 'MI');
});
test('toStateAbbr: null returns null', () => {
  assertEqual(fmt.toStateAbbr(null), null);
});
test('toStateAbbr: New York → NY', () => {
  assertEqual(fmt.toStateAbbr('New York'), 'NY');
});
test('toStateAbbr: West Virginia → WV', () => {
  assertEqual(fmt.toStateAbbr('West Virginia'), 'WV');
});
test('toStateAbbr: unknown returns trimmed input', () => {
  assertEqual(fmt.toStateAbbr('  Unknown  '), 'Unknown');
});

// ════════════════════════════════════════════════════════════════════════════
// FORMAT — parseAddr
// ════════════════════════════════════════════════════════════════════════════
test('parseAddr: standard format', () => {
  assertDeepEqual(
    fmt.parseAddr('123 Main St, Chicago, IL 60601'),
    { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' }
  );
});
test('parseAddr: ZIP+4', () => {
  const r = fmt.parseAddr('456 Oak Ave, Detroit, MI 48201-1234');
  assertEqual(r.state, 'MI');
  assertEqual(r.zip, '48201-1234');
});
test('parseAddr: missing zip', () => {
  const r = fmt.parseAddr('789 Elm St, Boston, MA');
  assertEqual(r.state, 'MA');
  assertEqual(r.zip, '');
});
test('parseAddr: empty string', () => {
  assertDeepEqual(fmt.parseAddr(''), { line1: '', city: '', state: '', zip: '' });
});
test('parseAddr: null', () => {
  assertDeepEqual(fmt.parseAddr(null), { line1: '', city: '', state: '', zip: '' });
});

// ════════════════════════════════════════════════════════════════════════════
// GEO — haversineM
// ════════════════════════════════════════════════════════════════════════════
test('haversineM: same point = 0', () => {
  assertEqual(geo.haversineM(40.7128, -74.0060, 40.7128, -74.0060), 0);
});
test('haversineM: NYC to LA ~3940 km', () => {
  assertApprox(geo.haversineM(40.7128, -74.0060, 34.0522, -118.2437), 3940000, 50000, 'NYC→LA');
});
test('haversineM: 1 mile north ~1609m', () => {
  assertApprox(geo.haversineM(42.0, -83.0, 42.01445, -83.0), 1609, 20, '1 mile north');
});
test('haversineM: Detroit to Ann Arbor ~60km', () => {
  const dist = geo.haversineM(42.3314, -83.0458, 42.2808, -83.7430);
  assert(dist > 50000 && dist < 80000, 'Detroit→Ann Arbor should be 50-80 km');
});
test('haversineM: symmetric', () => {
  const d1 = geo.haversineM(42.0, -83.0, 43.0, -84.0);
  const d2 = geo.haversineM(43.0, -84.0, 42.0, -83.0);
  assertApprox(d1, d2, 0.001, 'haversine should be symmetric');
});
test('haversineM: nearby radius filter 0.25mi', () => {
  const threshold = 0.25 * 1609.34;
  const close = geo.haversineM(30.0, -90.0, 30.002, -90.0);
  const far   = geo.haversineM(30.0, -90.0, 30.01,  -90.0);
  assert(close < threshold, 'close point within 0.25mi');
  assert(far   > threshold, 'far point outside 0.25mi');
});

// ════════════════════════════════════════════════════════════════════════════
// GEO — isPointInPolygon
// ════════════════════════════════════════════════════════════════════════════
const SQUARE_ZONE = {
  polygon: [
    { lat: 42.0, lng: -84.0 },
    { lat: 42.0, lng: -83.0 },
    { lat: 43.0, lng: -83.0 },
    { lat: 43.0, lng: -84.0 },
  ]
};

test('isPointInPolygon: center inside square', () => {
  assert(geo.isPointInPolygon({ lat: 42.5, lng: -83.5 }, SQUARE_ZONE));
});
test('isPointInPolygon: point below square = outside', () => {
  assert(!geo.isPointInPolygon({ lat: 41.0, lng: -83.5 }, SQUARE_ZONE));
});
test('isPointInPolygon: far point = outside', () => {
  assert(!geo.isPointInPolygon({ lat: 35.0, lng: -100.0 }, SQUARE_ZONE));
});
test('isPointInPolygon: empty polygon = false', () => {
  assert(!geo.isPointInPolygon({ lat: 42.5, lng: -83.5 }, { polygon: [] }));
});

// ════════════════════════════════════════════════════════════════════════════
// GEO — calcPolygonSqFt
// ════════════════════════════════════════════════════════════════════════════
test('calcPolygonSqFt: < 3 points returns 0', () => {
  assertEqual(geo.calcPolygonSqFt([{ lat: 42, lng: -83 }, { lat: 43, lng: -83 }]), 0);
});
test('calcPolygonSqFt: small polygon returns positive sqft', () => {
  const pts = [
    { lat: 42.3314, lng: -83.0458 },
    { lat: 42.3316, lng: -83.0458 },
    { lat: 42.3316, lng: -83.0454 },
    { lat: 42.3314, lng: -83.0454 },
  ];
  const sqft = geo.calcPolygonSqFt(pts);
  assert(sqft > 0 && sqft < 100000, 'reasonable sqft for small polygon');
});
test('calcPolygonSqFt: returns integer', () => {
  const pts = [
    { lat: 42.0, lng: -83.0 }, { lat: 42.001, lng: -83.0 },
    { lat: 42.001, lng: -83.001 }, { lat: 42.0, lng: -83.001 },
  ];
  const sqft = geo.calcPolygonSqFt(pts);
  assertEqual(sqft, Math.round(sqft), 'should be integer');
});

// ════════════════════════════════════════════════════════════════════════════
// GEO — homeAgeColor / homeAgeLabel
// ════════════════════════════════════════════════════════════════════════════
const CY = new Date().getFullYear();

test('homeAgeColor: null returns null', () => {
  assertEqual(geo.homeAgeColor(null), null);
});
test('homeAgeColor: new build < 10yr = green', () => {
  assertEqual(geo.homeAgeColor(CY - 5), '#22C55E');
});
test('homeAgeColor: 10-20yr = yellow', () => {
  assertEqual(geo.homeAgeColor(CY - 15), '#EAB308');
});
test('homeAgeColor: 20-30yr = orange', () => {
  assertEqual(geo.homeAgeColor(CY - 25), '#F97316');
});
test('homeAgeColor: >30yr = red', () => {
  assertEqual(geo.homeAgeColor(CY - 35), '#EF4444');
});
test('homeAgeLabel: null returns unknown string', () => {
  assertEqual(geo.homeAgeLabel(null), 'Build year unknown');
});
test('homeAgeLabel: includes year', () => {
  assert(geo.homeAgeLabel(2000).includes('2000'));
});
test('homeAgeLabel: includes age unit', () => {
  assert(geo.homeAgeLabel(2000).includes('yrs'));
});

// ════════════════════════════════════════════════════════════════════════════
// PIN STATUS — sColor / sLabel / sEmoji
// ════════════════════════════════════════════════════════════════════════════
test('sColor: pinned = gray', () => {
  assertEqual(ps.sColor('pinned'), '#6B7280');
});
test('sColor: signed = green', () => {
  assertEqual(ps.sColor('signed'), '#22C55E');
});
test('sColor: not_interested = dark', () => {
  assertEqual(ps.sColor('not_interested'), '#3D5269');
});
test('sColor: legacy needs_roof', () => {
  assertEqual(ps.sColor('needs_roof'), '#F25C05');
});
test('sColor: unknown returns a hex color', () => {
  assert(ps.sColor('unknown_xyz').startsWith('#'));
});
test('sLabel: pinned = Pinned', () => {
  assertEqual(ps.sLabel('pinned'), 'Pinned');
});
test('sLabel: signed = Signed', () => {
  assertEqual(ps.sLabel('signed'), 'Signed');
});
test('sLabel: legacy converted = Signed', () => {
  assertEqual(ps.sLabel('converted'), 'Signed');
});
test('sEmoji: pinned = 📍', () => {
  assertEqual(ps.sEmoji('pinned'), '📍');
});
test('sEmoji: signed = ✅', () => {
  assertEqual(ps.sEmoji('signed'), '✅');
});
test('sEmoji: unknown = 📍 fallback', () => {
  assertEqual(ps.sEmoji('unknown_xyz'), '📍');
});
test('isActivePipelineStatus: pinned = true', () => {
  assert(ps.isActivePipelineStatus('pinned'));
});
test('isActivePipelineStatus: signed = false', () => {
  assert(!ps.isActivePipelineStatus('signed'));
});
test('isActivePipelineStatus: not_interested = false', () => {
  assert(!ps.isActivePipelineStatus('not_interested'));
});
test('isWonStatus: signed = true', () => {
  assert(ps.isWonStatus('signed'));
});
test('isWonStatus: pinned = false', () => {
  assert(!ps.isWonStatus('pinned'));
});
test('PIN_STATUSES: has 8 entries', () => {
  assertEqual(ps.PIN_STATUSES.length, 8);
});
test('PIN_STATUSES: all entries have required fields', () => {
  ps.PIN_STATUSES.forEach(s => {
    assert(s.v, 'missing v on ' + JSON.stringify(s));
    assert(s.label, 'missing label on ' + s.v);
    assert(s.color && s.color.startsWith('#'), 'missing/invalid color on ' + s.v);
    assert(s.emoji, 'missing emoji on ' + s.v);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DRIP — getDripStepMessage
// ════════════════════════════════════════════════════════════════════════════
test('getDripStepMessage: step 2 default headline', () => {
  assertEqual(drip.getDripStepMessage(2).headline, 'Still thinking it over?');
});
test('getDripStepMessage: step 3 default headline', () => {
  assertEqual(drip.getDripStepMessage(3).headline, 'Storm season is coming.');
});
test('getDripStepMessage: step 4 default headline', () => {
  assertEqual(drip.getDripStepMessage(4).headline, 'Final notice.');
});
test('getDripStepMessage: custom cfg overrides headline', () => {
  assertEqual(drip.getDripStepMessage(2, { drip2Headline: 'Custom' }).headline, 'Custom');
});
test('getDripStepMessage: custom cfg overrides subtext', () => {
  assertEqual(drip.getDripStepMessage(2, { drip2Subtext: 'Custom sub' }).subtext, 'Custom sub');
});
test('getDripStepMessage: unknown step returns fallback', () => {
  const msg = drip.getDripStepMessage(99);
  assertEqual(msg.headline, 'Follow-Up');
  assertEqual(msg.subtext, '');
});

// ════════════════════════════════════════════════════════════════════════════
// DRIP — calcDripSendDate
// ════════════════════════════════════════════════════════════════════════════
test('calcDripSendDate: 7 days after Jan 1 = Jan 8', () => {
  assert(drip.calcDripSendDate('2025-01-01T00:00:00.000Z', 7).startsWith('2025-01-08'));
});
test('calcDripSendDate: month boundary Jan 28 + 7 = Feb 4', () => {
  assert(drip.calcDripSendDate('2025-01-28T00:00:00.000Z', 7).startsWith('2025-02-04'));
});
test('calcDripSendDate: non-leap Feb 22 + 7 = Mar 1', () => {
  assert(drip.calcDripSendDate('2025-02-22T00:00:00.000Z', 7).startsWith('2025-03-01'));
});
test('calcDripSendDate: leap year Feb 22 + 7 = Feb 29', () => {
  assert(drip.calcDripSendDate('2024-02-22T00:00:00.000Z', 7).startsWith('2024-02-29'));
});
test('calcDripSendDate: 0 days = same day', () => {
  assert(drip.calcDripSendDate('2025-06-15T00:00:00.000Z', 0).startsWith('2025-06-15'));
});

// ════════════════════════════════════════════════════════════════════════════
// DRIP — buildDripSchedule
// ════════════════════════════════════════════════════════════════════════════
test('buildDripSchedule: returns correct count', () => {
  assertEqual(drip.buildDripSchedule('2025-01-01T00:00:00.000Z', [7, 14, 21]).length, 3);
});
test('buildDripSchedule: steps numbered 2, 3, 4', () => {
  const s = drip.buildDripSchedule('2025-01-01T00:00:00.000Z', [7, 14, 21]);
  assertEqual(s[0].step, 2); assertEqual(s[1].step, 3); assertEqual(s[2].step, 4);
});
test('buildDripSchedule: sendAt dates correct', () => {
  const s = drip.buildDripSchedule('2025-01-01T00:00:00.000Z', [7, 14, 21]);
  assert(s[0].sendAt.startsWith('2025-01-08'));
  assert(s[1].sendAt.startsWith('2025-01-15'));
  assert(s[2].sendAt.startsWith('2025-01-22'));
});
test('buildDripSchedule: includes headline and subtext', () => {
  const s = drip.buildDripSchedule('2025-01-01T00:00:00.000Z', [7]);
  assert(s[0].headline && s[0].subtext);
});

// ════════════════════════════════════════════════════════════════════════════
// DRIP — isDripItemDue / shouldPromoteToPending
// ════════════════════════════════════════════════════════════════════════════
test('isDripItemDue: past item = true', () => {
  assert(drip.isDripItemDue({ drip_step: 2, status: 'pending', scheduled_send_at: '2020-01-01T00:00:00.000Z' }));
});
test('isDripItemDue: future item = false', () => {
  assert(!drip.isDripItemDue({ drip_step: 2, status: 'pending', scheduled_send_at: '2099-01-01T00:00:00.000Z' }));
});
test('isDripItemDue: sent status = false', () => {
  assert(!drip.isDripItemDue({ drip_step: 2, status: 'sent', scheduled_send_at: '2020-01-01T00:00:00.000Z' }));
});
test('shouldPromoteToPending: past scheduled = true', () => {
  assert(drip.shouldPromoteToPending({ status: 'scheduled', scheduled_send_at: '2020-01-01T00:00:00.000Z' }));
});
test('shouldPromoteToPending: future = false', () => {
  assert(!drip.shouldPromoteToPending({ status: 'scheduled', scheduled_send_at: '2099-01-01T00:00:00.000Z' }));
});
test('shouldPromoteToPending: already pending = false', () => {
  assert(!drip.shouldPromoteToPending({ status: 'pending', scheduled_send_at: '2020-01-01T00:00:00.000Z' }));
});

// ════════════════════════════════════════════════════════════════════════════
// CREDITS — calcAvailableCredits
// ════════════════════════════════════════════════════════════════════════════
test('calcAvailableCredits: paid credits only', () => {
  const r = cred.calcAvailableCredits({ plan: 'starter', mailerCredits: 10 });
  assertEqual(r.paid, 10); assertEqual(r.freeLeft, 0); assertEqual(r.total, 10);
});
test('calcAvailableCredits: zero credits', () => {
  assertEqual(cred.calcAvailableCredits({ plan: 'starter', mailerCredits: 0 }).total, 0);
});
test('calcAvailableCredits: undefined mailerCredits defaults to 0', () => {
  assertEqual(cred.calcAvailableCredits({}).total, 0);
});
test('calcAvailableCredits: 5 paid credits', () => {
  assertEqual(cred.calcAvailableCredits({ mailerCredits: 5 }).total, 5);
});

// ════════════════════════════════════════════════════════════════════════════
// CREDITS — hasEnoughCredits
// ════════════════════════════════════════════════════════════════════════════
test('hasEnoughCredits: 5 credits, send 1 = true', () => {
  assert(cred.hasEnoughCredits({ mailerCredits: 5 }, 1));
});
test('hasEnoughCredits: 0 credits, send 1 = false', () => {
  assert(!cred.hasEnoughCredits({ mailerCredits: 0 }, 1));
});
test('hasEnoughCredits: 3 credits, send 3 = true', () => {
  assert(cred.hasEnoughCredits({ mailerCredits: 3 }, 3));
});
test('hasEnoughCredits: 2 credits, send 3 = false', () => {
  assert(!cred.hasEnoughCredits({ mailerCredits: 2 }, 3));
});
test('hasEnoughCredits: default count is 1', () => {
  assert(cred.hasEnoughCredits({ mailerCredits: 1 }));
  assert(!cred.hasEnoughCredits({ mailerCredits: 0 }));
});

// ════════════════════════════════════════════════════════════════════════════
// CREDITS — deductCredits
// ════════════════════════════════════════════════════════════════════════════
test('deductCredits: deducts 1 from paid', () => {
  assertEqual(cred.deductCredits({ mailerCredits: 5 }, 1).mailerCredits, 4);
});
test('deductCredits: deducts 3 from paid', () => {
  assertEqual(cred.deductCredits({ mailerCredits: 10 }, 3).mailerCredits, 7);
});
test('deductCredits: does not go below 0', () => {
  assertEqual(cred.deductCredits({ mailerCredits: 1 }, 5).mailerCredits, 0);
});
test('deductCredits: does not mutate original cfg', () => {
  const cfg = { mailerCredits: 10 };
  cred.deductCredits(cfg, 3);
  assertEqual(cfg.mailerCredits, 10, 'original should be unchanged');
});

// ════════════════════════════════════════════════════════════════════════════
// CREDITS — creditBundleCost
// ════════════════════════════════════════════════════════════════════════════
test('creditBundleCost: 1 credit = $4', () => {
  assertEqual(cred.creditBundleCost(1), 4);
});
test('creditBundleCost: 4 credits = $12 (bundle)', () => {
  assertEqual(cred.creditBundleCost(4), 12);
});
test('creditBundleCost: 5 credits = $16 (1 bundle + 1 single)', () => {
  assertEqual(cred.creditBundleCost(5), 16);
});
test('creditBundleCost: 8 credits = $24 (2 bundles)', () => {
  assertEqual(cred.creditBundleCost(8), 24);
});
test('creditBundleCost: 0 credits = $0', () => {
  assertEqual(cred.creditBundleCost(0), 0);
});
test('creditBundleCost: 3 credits = $12 (3 singles)', () => {
  assertEqual(cred.creditBundleCost(3), 12);
});

// ════════════════════════════════════════════════════════════════════════════
// LEGACY INLINE TESTS (kept for backward compatibility)
// ════════════════════════════════════════════════════════════════════════════

// Legacy credit math (from original admin-lob.js pricing table)
const LEGACY_CREDIT_COST = { starter: 1.25, pro: 1.10, agency: 0.95, enterprise: 0.85 };
function legacyCalcCreditCost(plan, qty) {
  const rate = LEGACY_CREDIT_COST[plan] || LEGACY_CREDIT_COST.starter;
  return Math.round(rate * qty * 100) / 100;
}
test('legacy: starter 1 postcard = $1.25', () => assertEqual(legacyCalcCreditCost('starter', 1), 1.25));
test('legacy: pro 1 postcard = $1.10', () => assertEqual(legacyCalcCreditCost('pro', 1), 1.10));
test('legacy: agency 1 postcard = $0.95', () => assertEqual(legacyCalcCreditCost('agency', 1), 0.95));
test('legacy: enterprise 1 postcard = $0.85', () => assertEqual(legacyCalcCreditCost('enterprise', 1), 0.85));
test('legacy: starter 10 postcards = $12.50', () => assertEqual(legacyCalcCreditCost('starter', 10), 12.50));
test('legacy: unknown plan falls back to starter', () => assertEqual(legacyCalcCreditCost('unknown', 5), 6.25));

// Legacy address parsing
function legacyParseAddress(fullAddr) {
  if (!fullAddr) return null;
  const parts = fullAddr.split(',').map(s => s.trim());
  if (parts.length < 3) return null;
  const street = parts[0], city = parts[1];
  const stateZip = parts.slice(2).join(' ').trim();
  const m = stateZip.match(/^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!m) return null;
  return { street, city, state: m[1], zip: m[2] };
}
test('legacy addr: parses standard US address', () => assert(legacyParseAddress('123 Main St, Springfield, IL 62701') !== null));
test('legacy addr: extracts street', () => assertEqual(legacyParseAddress('123 Main St, Springfield, IL 62701')?.street, '123 Main St'));
test('legacy addr: extracts city', () => assertEqual(legacyParseAddress('123 Main St, Springfield, IL 62701')?.city, 'Springfield'));
test('legacy addr: extracts state', () => assertEqual(legacyParseAddress('123 Main St, Springfield, IL 62701')?.state, 'IL'));
test('legacy addr: extracts zip', () => assertEqual(legacyParseAddress('123 Main St, Springfield, IL 62701')?.zip, '62701'));
test('legacy addr: ZIP+4', () => assertEqual(legacyParseAddress('456 Oak Ave, Dallas, TX 75201-1234')?.zip, '75201-1234'));
test('legacy addr: empty = null', () => assertEqual(legacyParseAddress(''), null));
test('legacy addr: null = null', () => assertEqual(legacyParseAddress(null), null));

// ════════════════════════════════════════════════════════════════════════════
// Results
// ════════════════════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(54));
if (failures.length > 0) {
  console.log('FAILURES:');
  failures.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.error}`));
  console.log('─'.repeat(54));
}
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('✅ All ' + passed + ' tests passed');
  process.exit(0);
} else {
  console.error('❌ ' + failed + ' test(s) failed');
  process.exit(1);
}
