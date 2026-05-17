#!/usr/bin/env node
/**
 * BidDrop Build Script
 * 1. Extracts inline <script> blocks from HTML files, obfuscates them, writes to dist/
 * 2. Obfuscates api/*.js (except test-ghl.js and migrate.js) and sw.js into dist/
 * Source repo stays readable; deployed code is obfuscated.
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

// ─── Obfuscator options ────────────────────────────────────────────────────────
const BASE_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,   // too slow on large files
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,    // keep console.log for error tracking
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,           // breaks window.* globals in browser context
  rotateStringArray: true,
  selfDefending: false,           // causes issues with some CSP policies
  shuffleStringArray: true,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
  transformObjectKeys: false,     // breaks dynamic key access patterns
};

// API files get slightly different options (no window.* globals concern)
const API_OPTIONS = {
  ...BASE_OPTIONS,
  renameGlobals: false,           // still false — module.exports etc. must stay
  target: 'node',
};

// ─── File lists ────────────────────────────────────────────────────────────────
const HTML_FILES = ['index.html', 'estimate.html', 'signup.html', 'open.html', 'privacy.html'];

// API files to obfuscate (skip dev/utility files)
const API_SKIP = new Set(['test-ghl.js', 'migrate.js']);

// ─── Ensure dist/ exists ───────────────────────────────────────────────────────
if (!fs.existsSync('dist')) fs.mkdirSync('dist');
if (!fs.existsSync('dist/api')) fs.mkdirSync('dist/api');

// ─── Copy static assets to dist/ ──────────────────────────────────────────────
const SKIP_ENTRIES = new Set(['dist', 'node_modules', '.git', 'build.js', 'api', 'supabase']);
for (const file of fs.readdirSync('.')) {
  if (SKIP_ENTRIES.has(file) || file.startsWith('.')) continue;
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    copyDir(file, path.join('dist', file));
    continue;
  }
  if (!HTML_FILES.includes(file) && file !== 'sw.js') {
    fs.copyFileSync(file, path.join('dist', file));
  }
}

// ─── Copy supabase/ directory as-is ───────────────────────────────────────────
if (fs.existsSync('supabase')) copyDir('supabase', 'dist/supabase');

// ─── Stats ────────────────────────────────────────────────────────────────────
let totalChars = 0;
let obfuscatedCount = 0;

// ─── 1. Obfuscate inline <script> blocks in HTML files ────────────────────────
console.log('\n📄 Processing HTML files...');
for (const htmlFile of HTML_FILES) {
  if (!fs.existsSync(htmlFile)) continue;
  process.stdout.write(`  ${htmlFile} ... `);

  let html = fs.readFileSync(htmlFile, 'utf8');
  let fileCount = 0;

  html = html.replace(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi, (match, scriptContent) => {
    const trimmed = scriptContent.trim();
    if (!trimmed || trimmed.length < 50) return match;
    try {
      totalChars += trimmed.length;
      const result = JavaScriptObfuscator.obfuscate(trimmed, BASE_OPTIONS);
      obfuscatedCount++;
      fileCount++;
      const openTag = match.match(/<script[^>]*>/i)[0];
      return `${openTag}${result.getObfuscatedCode()}</script>`;
    } catch (err) {
      console.warn(`\n  ⚠️  Script block error in ${htmlFile}: ${err.message.slice(0, 80)}`);
      return match;
    }
  });

  fs.writeFileSync(path.join('dist', htmlFile), html, 'utf8');
  console.log(`✓ (${fileCount} block${fileCount !== 1 ? 's' : ''} obfuscated)`);
}

// ─── 2. Obfuscate sw.js ───────────────────────────────────────────────────────
console.log('\n⚙️  Processing sw.js...');
if (fs.existsSync('sw.js')) {
  const src = fs.readFileSync('sw.js', 'utf8');
  try {
    totalChars += src.length;
    const result = JavaScriptObfuscator.obfuscate(src, BASE_OPTIONS);
    fs.writeFileSync('dist/sw.js', result.getObfuscatedCode(), 'utf8');
    obfuscatedCount++;
    console.log('  ✓ dist/sw.js');
  } catch (err) {
    console.warn(`  ⚠️  sw.js error: ${err.message.slice(0, 80)}`);
    fs.copyFileSync('sw.js', 'dist/sw.js');
  }
}

// ─── 3. Obfuscate api/*.js ────────────────────────────────────────────────────
console.log('\n🔒 Processing api/ files...');
const apiFiles = fs.readdirSync('api').filter(f => f.endsWith('.js') && !API_SKIP.has(f));
for (const apiFile of apiFiles) {
  const srcPath = path.join('api', apiFile);
  const destPath = path.join('dist', 'api', apiFile);
  process.stdout.write(`  api/${apiFile} ... `);
  const src = fs.readFileSync(srcPath, 'utf8');
  try {
    totalChars += src.length;
    const result = JavaScriptObfuscator.obfuscate(src, API_OPTIONS);
    fs.writeFileSync(destPath, result.getObfuscatedCode(), 'utf8');
    obfuscatedCount++;
    console.log('✓');
  } catch (err) {
    console.warn(`\n  ⚠️  api/${apiFile} error: ${err.message.slice(0, 80)}`);
    fs.copyFileSync(srcPath, destPath); // fallback: copy unobfuscated
  }
}

// Copy skipped API files as-is
for (const skipped of API_SKIP) {
  const srcPath = path.join('api', skipped);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join('dist', 'api', skipped));
    console.log(`  api/${skipped} ... copied (skipped)`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n✅ Build complete`);
console.log(`   Obfuscated: ${obfuscatedCount} files/blocks (${Math.round(totalChars / 1024)} KB of JS)`);
console.log(`   Output → dist/\n`);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
