#!/usr/bin/env node
// validate-build.js — Post-build safety checks for BidDrop
// Run automatically after build.js to catch structural issues before deploy.
// Exit code 0 = pass, 1 = fail (blocks commit/deploy).

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist', 'index.html');
const SRC_JS = path.join(__dirname, 'src');
const SRC_HTML = path.join(__dirname, 'src', 'html');

let errors = [];
let warnings = [];

function fail(msg) { errors.push('  ✗ ' + msg); }
function warn(msg) { warnings.push('  ⚠ ' + msg); }
function pass(msg) { console.log('  ✓ ' + msg); }

console.log('\n🔍 BidDrop Build Validator\n');

// ── 1. dist/index.html exists ────────────────────────────────────────────────
if (!fs.existsSync(DIST)) {
  fail('dist/index.html does not exist — build may have failed');
  report();
  process.exit(1);
}
const html = fs.readFileSync(DIST, 'utf8');
pass(`dist/index.html exists (${Math.round(html.length / 1024)} KB)`);

// ── 2. No unresolved partials ────────────────────────────────────────────────
const unresolvedPartials = (html.match(/@@PARTIAL:/g) || []).length;
if (unresolvedPartials > 0) {
  fail(`${unresolvedPartials} unresolved @@PARTIAL markers in dist/index.html`);
} else {
  pass('No unresolved @@PARTIAL markers');
}

// ── 3. Balanced <div> tags ───────────────────────────────────────────────────
const divOpens = (html.match(/<div[\s>]/g) || []).length;
const divCloses = (html.match(/<\/div>/g) || []).length;
if (divOpens !== divCloses) {
  fail(`Unbalanced <div> tags: ${divOpens} opens vs ${divCloses} closes (diff: ${divOpens - divCloses > 0 ? '+' : ''}${divOpens - divCloses})`);
} else {
  pass(`Balanced <div> tags (${divOpens} pairs)`);
}

// ── 4. Required tab IDs present ─────────────────────────────────────────────
const requiredIds = [
  'tab-map', 'tab-estimate', 'tab-estimates', 'tab-campaigns',
  'tab-designs', 'tab-settings', 'tab-agency', 'tab-admin',
  'tab-drip', 'tab-contacts', 'tab-hotleads', 'tab-mailqueue',
  'tab-leaderboard', 'tab-territory', 'tab-dashboard',
];
const missingIds = requiredIds.filter(id => !html.includes(`id="${id}"`));
if (missingIds.length > 0) {
  fail(`Missing required tab IDs: ${missingIds.join(', ')}`);
} else {
  pass(`All ${requiredIds.length} required tab IDs present`);
}

// ── 5. Required modal IDs present ───────────────────────────────────────────
// m-campaign-postcard is injected at runtime by photo.js, not in dist HTML
const requiredModals = [
  'add-design-modal', 'm-postcard-preview', 'm-send-postcard',
];
const missingModals = requiredModals.filter(id => !html.includes(`id="${id}"`));
if (missingModals.length > 0) {
  fail(`Missing required modal IDs: ${missingModals.join(', ')}`);
} else {
  pass(`All ${requiredModals.length} required modal IDs present`);
}

// ── 6. No broken template literals (backtick imbalance) ─────────────────────
// Check each src/*.js file for unclosed template literals
const jsFiles = fs.readdirSync(SRC_JS).filter(f => f.endsWith('.js'));
let tlIssues = [];
for (const fname of jsFiles) {
  const src = fs.readFileSync(path.join(SRC_JS, fname), 'utf8');
  // Count backticks not in comments or strings — rough heuristic
  // Skip trades.js which has intentional inline function strings
  // Skip the original monolithic files that have been split into parts
  const skipFiles = new Set(['trades.js', 'mail-queue.js', 'homeowner-quote.js']);
  if (skipFiles.has(fname)) continue;
  const backticks = (src.match(/`/g) || []).length;
  if (backticks % 2 !== 0) {
    tlIssues.push(fname);
  }
}
if (tlIssues.length > 0) {
  fail(`Odd backtick count (possible unclosed template literal) in: ${tlIssues.join(', ')}`);
} else {
  pass(`No unclosed template literals detected in ${jsFiles.length} JS files`);
}

// ── 7. Key functions referenced in HTML are defined in JS ───────────────────
const criticalFunctions = [
  'loadCampaignsTab', 'loadHotLeads', 'renderEstimatesTab',
  'renderQueue', 'openAddDesignModal', 'saveNewDesign',
  'launchNearbyCampaign', 'renderCustomBackCanvas',
  'haversineM', 'switchAccount',
];
const allSrcJs = jsFiles.map(f => fs.readFileSync(path.join(SRC_JS, f), 'utf8')).join('\n');
const allSrcHtml = fs.readdirSync(SRC_HTML)
  .filter(f => f.endsWith('.html'))
  .map(f => fs.readFileSync(path.join(SRC_HTML, f), 'utf8')).join('\n');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const allSource = allSrcJs + '\n' + allSrcHtml + '\n' + indexHtml;

let missingFns = [];
for (const fn of criticalFunctions) {
  const defPattern = new RegExp(`function ${fn}\\s*\\(|${fn}\\s*=\\s*(async\\s*)?function|${fn}\\s*=\\s*(async\\s*)?\\(`);
  if (!defPattern.test(allSource)) {
    missingFns.push(fn);
  }
}
if (missingFns.length > 0) {
  fail(`Critical functions not defined anywhere: ${missingFns.join(', ')}`);
} else {
  pass(`All ${criticalFunctions.length} critical functions are defined`);
}

// ── 8. onclick / event-handler linkage check ───────────────────────────────
// Every function called from onclick="fnName()" must be defined in src/ files.
// This catches the "button silently does nothing" class of bugs at build time.
{
  const calledFns = new Set();
  const EVENT_ATTRS = ['onclick','onchange','onsubmit','oninput','onkeyup','onkeydown','onfocus','onblur'];
  for (const evt of EVENT_ATTRS) {
    const re = new RegExp(evt + '="([^"]+)"', 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      const val = m[1].trim();
      const fnMatch = val.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[(;]/);
      if (fnMatch) calledFns.add(fnMatch[1]);
    }
  }

  // Collect definitions from all src/*.js and src/html/*.html script blocks
  const definedFns = new Set();
  function _extractFns(src) {
    const defRe = /(?:^|[\n;{(,])\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm;
    let dm;
    while ((dm = defRe.exec(src)) !== null) definedFns.add(dm[1]);
  }
  for (const fname of jsFiles) _extractFns(fs.readFileSync(path.join(SRC_JS, fname), 'utf8'));
  for (const fname of fs.readdirSync(SRC_HTML).filter(f => f.endsWith('.html'))) {
    const src = fs.readFileSync(path.join(SRC_HTML, fname), 'utf8');
    const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let sm;
    while ((sm = scriptRe.exec(src)) !== null) _extractFns(sm[1]);
  }
  _extractFns(indexHtml);

  const SKIP_FNS = new Set([
    'if','document','this','window','event','return','void',
    'setTimeout','setInterval','clearTimeout','clearInterval',
    'parseInt','parseFloat','isNaN','isFinite',
    'encodeURIComponent','decodeURIComponent',
    'JSON','Math','Object','Array','String','Boolean','Number',
    'Promise','fetch','console','alert','confirm','location',
  ]);
  const missingLinks = [...calledFns].filter(f => !definedFns.has(f) && !SKIP_FNS.has(f)).sort();
  if (missingLinks.length > 0) {
    fail(`${missingLinks.length} event-handler function(s) called in HTML but not defined in src/: ${missingLinks.join(', ')}`);
  } else {
    pass(`All ${calledFns.size} event-handler functions are defined in src/`);
  }
}

// ── 9. dist file size sanity check ──────────────────────────────────────────
const sizeKB = Math.round(html.length / 1024);
if (sizeKB < 400) {
  fail(`dist/index.html is suspiciously small (${sizeKB} KB) — build may be incomplete`);
} else if (sizeKB > 2000) {
  warn(`dist/index.html is very large (${sizeKB} KB) — consider further optimization`);
} else {
  pass(`dist/index.html size is reasonable (${sizeKB} KB)`);
}

// ── Report ───────────────────────────────────────────────────────────────────
function report() {
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(w));
  }
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(e));
    console.log(`\nBuild validation FAILED (${errors.length} error${errors.length > 1 ? 's' : ''})\n`);
  } else {
    console.log(`\n✅ Build validation PASSED${warnings.length > 0 ? ' (with warnings)' : ''}\n`);
  }
}

report();
process.exit(errors.length > 0 ? 1 : 0);
