#!/usr/bin/env node
/**
 * Quick smoke test for the assembled estimate.html
 * Run: node test-estimate.js
 */
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'estimate.html'), 'utf8');
const dist = fs.readFileSync(path.join(__dirname, 'dist', 'estimate.html'), 'utf8');

let pass = 0, fail = 0;
function check(label, condition) {
  if (condition) { console.log('  ✓', label); pass++; }
  else           { console.error('  ✗', label); fail++; }
}

console.log('\n=== estimate.html (source) ===');

// HTML structure
check('Has <!DOCTYPE html>',    html.includes('<!DOCTYPE html>'));
check('Has </html>',            html.includes('</html>'));
check('Has </body>',            html.includes('</body>'));
check('Has <style> block',      html.includes('<style>'));
check('Has <script> block',     html.includes('<script>'));

// No noindex meta tag (word appears only in a JS comment)
const noindexMeta = html.match(/<meta[^>]+noindex/i);
check('No noindex meta tag',    !noindexMeta);

// Key DOM IDs
const ids = [
  'ep-loading', 'ep-error', 'ep-gate', 'ep-page',
  'ep-sticky-bar', 'ep-hero-headline', 'ep-price',
  'ep-mat-grid', 'ep-detail-grid', 'ep-gallery-section',
  'ep-video-section', 'ep-reviews-section', 'ep-cta-section',
  'ep-footer', 'ep-lightbox', 'ep-lightbox-img',
  'ep-lightbox-close', 'ep-lightbox-prev', 'ep-lightbox-next',
  'ep-gate-logo', 'ep-gate-title', 'ep-gate-sub',
  'ep-gate-address-box', 'g-first', 'g-last', 'g-phone', 'g-email',
  'ep-gate-btn', 'g-consent',
  'ep-co-name', 'ep-co-badge', 'ep-prop-row',
  'ep-hero-photo-wrap', 'ep-repbio-name', 'ep-repbio-notes',
  'ep-about-stats', 'ep-about-body', 'ep-creds',
  'ep-reviews-grid', 'ep-review-cta', 'ep-cta-btns',
  'ep-contact-strip', 'ep-footer-co', 'ep-legal-block',
];
ids.forEach(id => check('ID: ' + id, html.includes('id="' + id + '"')));

// Key JS functions
const fns = [
  'function init(', 'function showGate(', 'function submitGate(',
  'function buildPage(', 'function renderPhotos(', 'function loadReviews(',
  'function selectMat(', 'function trackView(', 'function firePixels(',
  'function shareEst(', 'function initFade(', 'function injectSEO(',
  'function closeLightbox(', 'function lbNav(', 'function openLBFlat(',
  'function applyGlobalContent(', 'function renderReviews(',
  'function renderFallbackReviews(', 'function renderReviewCTA(',
  'function fmtMo(', 'function fmt(', 'function pitchLabel(',
  'function computePrice(', 'function initials(', 'function fmtDate(',
  'function brandForDark(', 'function onGatePhoneInput(',
];
fns.forEach(fn => check('Function: ' + fn.replace('function ', '').replace('(', ''), html.includes(fn)));

// onclick handlers all have matching function definitions
const onclickMatches = [...html.matchAll(/onclick="([a-zA-Z_]+)\(/g)].map(m => m[1]);
const uniqueOnclicks = [...new Set(onclickMatches)];
uniqueOnclicks.forEach(fn => check('onclick handler defined: ' + fn, html.includes('function ' + fn + '(')));

// SEO / schema
check('injectSEO function present',      html.includes('function injectSEO('));
check('JSON-LD schema type present',     html.includes('LocalBusiness'));
check('Open Graph og:title present',     html.includes('og:title'));
check('Dynamic title logic present',     html.includes('document.title'));
check('Canonical link logic present',    html.includes('rel=\'canonical\'') || html.includes("rel='canonical'") || html.includes('rel="canonical"') || html.includes("canonical.href"));

// dist version
console.log('\n=== dist/estimate.html (obfuscated) ===');
check('dist exists and non-empty',       dist.length > 10000);
check('dist has <!DOCTYPE html>',        dist.includes('<!DOCTYPE html>'));
check('dist has </html>',               dist.includes('</html>'));
check('dist has ep-gate ID',            dist.includes('id="ep-gate"') || dist.includes("id='ep-gate'"));
check('dist has ep-page ID',            dist.includes('id="ep-page"') || dist.includes("id='ep-page'"));
check('dist has no noindex meta',       !dist.match(/<meta[^>]+noindex/i));
check('dist size > 50KB',               dist.length > 50000);

console.log('\n=== Summary ===');
console.log('  Passed:', pass);
console.log('  Failed:', fail);
if (fail === 0) console.log('\n✅ All checks passed — estimate.html is structurally sound.\n');
else            console.error('\n❌ ' + fail + ' check(s) failed.\n');
process.exit(fail > 0 ? 1 : 0);
