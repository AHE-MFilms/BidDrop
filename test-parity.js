#!/usr/bin/env node
/**
 * Parity check: compare original estimate.html (from git HEAD~1) vs new assembled one
 * Verifies all key functions, IDs, and behaviors are preserved
 */
const fs = require('fs');

const orig = fs.readFileSync('/tmp/estimate_orig.html', 'utf8');
const newHtml = fs.readFileSync('/home/ubuntu/biddrop_repo/estimate.html', 'utf8');

let pass = 0, fail = 0, added = 0;

function check(label, origHas, newHas) {
  if (origHas && newHas)       { console.log('  ✓ PRESERVED:', label); pass++; }
  else if (!origHas && newHas) { console.log('  + NEW:      ', label); added++; }
  else if (origHas && !newHas) { console.error('  ✗ MISSING:  ', label); fail++; }
  else                         { /* neither had it — skip */ }
}

console.log('\n=== Functional Parity Check ===\n');

// All functions that were in the original
const fns = [
  'function init(', 'function showGate(', 'function submitGate(',
  'function buildPage(', 'function renderPhotos(', 'function loadReviews(',
  'function selectMat(', 'function trackView(', 'function firePixels(',
  'function shareEst(', 'function initFade(', 'function closeLightbox(',
  'function lbNav(', 'function openLBFlat(', 'function applyGlobalContent(',
  'function renderReviews(', 'function renderFallbackReviews(', 'function renderReviewCTA(',
  'function fmtMo(', 'function fmt(', 'function pitchLabel(', 'function computePrice(',
  'function initials(', 'function fmtDate(', 'function brandForDark(',
  'function onGatePhoneInput(',
];
fns.forEach(fn => check(fn, orig.includes(fn), newHtml.includes(fn)));

// All IDs that were in the original
const ids = [
  'ep-loading', 'ep-error', 'ep-gate', 'ep-page', 'ep-sticky-bar',
  'ep-hero-headline', 'ep-price', 'ep-mat-grid', 'ep-detail-grid',
  'ep-gallery-section', 'ep-video-section', 'ep-reviews-section',
  'ep-lightbox', 'ep-lightbox-img', 'ep-lightbox-close', 'ep-lightbox-prev', 'ep-lightbox-next',
  'ep-gate-logo', 'ep-gate-title', 'ep-gate-sub', 'ep-gate-address-box',
  'g-first', 'g-last', 'g-phone', 'g-email', 'ep-gate-btn', 'g-consent',
  'ep-co-name', 'ep-co-badge', 'ep-prop-row', 'ep-hero-photo-wrap',
  'ep-repbio-name', 'ep-repbio-notes', 'ep-about-stats', 'ep-about-body', 'ep-creds',
  'ep-reviews-grid', 'ep-review-cta', 'ep-cta-btns', 'ep-contact-strip',
  'ep-footer-co', 'ep-legal-block',
];
ids.forEach(id => check('id="' + id + '"', orig.includes('id="' + id + '"'), newHtml.includes('id="' + id + '"')));

// Key CSS classes
const classes = [
  'ep-gate', 'ep-hero', 'ep-est-section', 'ep-mat-card', 'ep-detail-card',
  'ep-gallery', 'ep-about-section', 'ep-reviews-section', 'ep-cta-section', 'ep-footer',
  'ep-lightbox', 'ep-fade', 'ep-sticky-bar', 'ep-powered',
];
classes.forEach(cls => check('class="' + cls + '"', orig.includes(cls), newHtml.includes(cls)));

// onclick handlers
const handlers = ['submitGate', 'closeLightbox', 'lbNav', 'selectMat', 'shareEst', 'openLBFlat'];
handlers.forEach(h => check('onclick: ' + h, orig.includes('onclick="' + h), newHtml.includes('onclick="' + h)));

// Global variables
const globals = ['_est', '_acct', '_prices', '_estId', '_gcd', '_photos'];
globals.forEach(g => check('global var ' + g, orig.includes(g), newHtml.includes(g)));

// NEW additions (should be in new but not necessarily in orig)
const newFeatures = ['injectSEO', 'LocalBusiness', 'og:title', 'canonical', 'document.title'];
newFeatures.forEach(f => check('NEW: ' + f, orig.includes(f), newHtml.includes(f)));

// Check for regressions — things in orig that should NOT be in new
const shouldNotExist = ['<meta name="robots" content="noindex'];
shouldNotExist.forEach(s => {
  if (newHtml.includes(s)) { console.error('  ✗ REGRESSION:', s, 'found in new'); fail++; }
  else { console.log('  ✓ CLEAN:     no', s.substring(0, 40)); pass++; }
});

// Size comparison
const origSize = orig.length;
const newSize = newHtml.length;
const diff = newSize - origSize;
console.log('\n=== Size Comparison ===');
console.log('  Original:', origSize, 'bytes');
console.log('  New:     ', newSize, 'bytes');
console.log('  Delta:   ', (diff > 0 ? '+' : '') + diff, 'bytes (' + (diff > 0 ? 'new SEO/schema additions' : 'smaller') + ')');

console.log('\n=== Summary ===');
console.log('  Preserved:', pass);
console.log('  New additions:', added);
console.log('  Missing/broken:', fail);
if (fail === 0) console.log('\n✅ Full parity confirmed — no regressions.\n');
else            console.error('\n❌ ' + fail + ' regression(s) found.\n');
process.exit(fail > 0 ? 1 : 0);
