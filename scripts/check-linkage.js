#!/usr/bin/env node
// scripts/check-linkage.js
// Verifies that every function called from an event handler attribute in the
// built HTML (onclick, onchange, etc.) is defined somewhere in the src/ files.
//
// Run: node scripts/check-linkage.js
// Exit 0 = all linked, Exit 1 = broken buttons found.

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const DIST_HTML  = path.join(ROOT, 'dist', 'index.html');
const SRC_DIR    = path.join(ROOT, 'src');
const SRC_HTML   = path.join(ROOT, 'src', 'html');
const INDEX_HTML = path.join(ROOT, 'index.html');

// ── 1. Collect all function names called from event handler attributes ────────
const distHtml = fs.readFileSync(DIST_HTML, 'utf8');
const calledFns = new Set();
const EVENT_ATTRS = ['onclick','onchange','onsubmit','oninput','onkeyup','onkeydown','onfocus','onblur'];

for (const evt of EVENT_ATTRS) {
  const re = new RegExp(evt + '="([^"]+)"', 'g');
  let m;
  while ((m = re.exec(distHtml)) !== null) {
    const val = m[1].trim();
    // Match the leading function name: fnName( or fnName;
    const fnMatch = val.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[(\;]/);
    if (fnMatch) calledFns.add(fnMatch[1]);
  }
}

// ── 2. Collect all top-level function definitions from source files ───────────
const defined = new Set();

function extractFunctions(src) {
  // Matches: function name(  |  async function name(
  const defRe = /(?:^|[\n;{(,])\s*(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm;
  let dm;
  while ((dm = defRe.exec(src)) !== null) defined.add(dm[1]);
  // Also matches: window.name = function(  |  window.name = async function(
  const winRe = /window\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?function\s*\(/gm;
  let wm;
  while ((wm = winRe.exec(src)) !== null) defined.add(wm[1]);
}

// Scan src/*.js
for (const fname of fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.js'))) {
  extractFunctions(fs.readFileSync(path.join(SRC_DIR, fname), 'utf8'));
}

// Scan src/html/*.html — extract <script> block content
for (const fname of fs.readdirSync(SRC_HTML).filter(f => f.endsWith('.html'))) {
  const src = fs.readFileSync(path.join(SRC_HTML, fname), 'utf8');
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = scriptRe.exec(src)) !== null) extractFunctions(sm[1]);
}

// Scan index.html inline scripts
{
  const src = fs.readFileSync(INDEX_HTML, 'utf8');
  const scriptRe = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sm;
  while ((sm = scriptRe.exec(src)) !== null) extractFunctions(sm[1]);
}

// ── 3. Browser built-ins and non-function patterns to ignore ─────────────────
const SKIP = new Set([
  'if','document','this','window','event','return','void',
  'setTimeout','setInterval','clearTimeout','clearInterval',
  'parseInt','parseFloat','isNaN','isFinite',
  'encodeURIComponent','decodeURIComponent',
  'JSON','Math','Object','Array','String','Boolean','Number',
  'Promise','fetch','console','alert','confirm','location',
]);

// ── 4. Report ─────────────────────────────────────────────────────────────────
const missing = [...calledFns].filter(f => !defined.has(f) && !SKIP.has(f)).sort();

console.log(`\n🔗 BidDrop Onclick Linkage Check`);
console.log(`   Event-handler functions in built HTML : ${calledFns.size}`);
console.log(`   Top-level functions defined in src/   : ${defined.size}`);

if (missing.length === 0) {
  console.log(`\n✅ All ${calledFns.size} event-handler functions are defined.\n`);
  process.exit(0);
} else {
  console.log(`\n❌ ${missing.length} function(s) called from HTML but NOT defined in src/:\n`);
  missing.forEach(f => console.log(`   - ${f}`));
  console.log(`\nThese buttons/inputs will silently do nothing in production.\n`);
  process.exit(1);
}
