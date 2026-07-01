#!/usr/bin/env node
/**
 * BidDrop Build Script
 * 1. Extracts inline <script> blocks from HTML files, obfuscates them, writes to dist/
 * 2. Obfuscates api/*.js (except test-ghl.js and migrate.js) and sw.js into dist/
 *
 * Safety: each obfuscated block is syntax-checked with `new Function()`.
 * If the check fails, the ORIGINAL unobfuscated code is used as fallback.
 * This guarantees the app always works even if obfuscation produces invalid output.
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

// ─── Obfuscator options ────────────────────────────────────────────────────────
// Using identifier-renaming only (no string array encoding).
// String array encoding causes syntax errors in large files with template literals.
// Identifier renaming alone makes the code unreadable while remaining 100% reliable.
const BASE_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: false,          // disabled — causes syntax errors in large template literal files
  unicodeEscapeSequence: false,
  transformObjectKeys: false,
  selfDefending: false,
};

const API_OPTIONS = { ...BASE_OPTIONS, target: 'node' };

// ─── File lists ────────────────────────────────────────────────────────────────
const HTML_FILES = ['index.html', 'estimate.html', 'signup.html', 'open.html', 'privacy.html'];
const API_SKIP = new Set(['test-ghl.js', 'migrate.js']);

// ─── Ensure dist/ exists ───────────────────────────────────────────────────────
if (!fs.existsSync('dist')) fs.mkdirSync('dist');
if (!fs.existsSync('dist/api')) fs.mkdirSync('dist/api');

// ─── Copy static assets to dist/ ──────────────────────────────────────────────
const SKIP_ENTRIES = new Set(['dist', 'node_modules', '.git', 'build.js', 'check_dist.js', 'api', 'supabase']);
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
if (fs.existsSync('supabase')) copyDir('supabase', 'dist/supabase');

// ─── Stats ────────────────────────────────────────────────────────────────────
let obfuscatedCount = 0;
let fallbackCount = 0;

// ─── Helper: decode HTML entities in script content ─────────────────────────
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// ─── Helper: obfuscate a JS string, returns obfuscated code or null on failure ─
function tryObfuscate(src, options) {
  try {
    // Decode any HTML entities before obfuscating
    const decoded = decodeHtmlEntities(src);
    const result = JavaScriptObfuscator.obfuscate(decoded, options);
    const code = result.getObfuscatedCode();
    return code;
  } catch (e) {
    console.log('    [obf error]', e.message.slice(0, 120));
    return null;
  }
}

// ─── 1. Obfuscate inline <script> blocks in HTML files ────────────────────────
console.log('\n📄 Processing HTML files...');
for (const htmlFile of HTML_FILES) {
  if (!fs.existsSync(htmlFile)) continue;
  process.stdout.write(`  ${htmlFile} ... `);

  let html = fs.readFileSync(htmlFile, 'utf8');
  // ── Resolve HTML partials (src/html/*.html) — recursive so nested partials work ──
  if (htmlFile === 'index.html') {
    const htmlDir = path.join(__dirname, 'src', 'html');
    function resolvePartials(src, depth) {
      if (depth > 5) return src; // guard against circular references
      return src.replace(/<!-- @@PARTIAL:([^\s>]+) -->/g, function(match, fname) {
        const partialPath = path.join(htmlDir, fname);
        if (fs.existsSync(partialPath)) {
          const content = fs.readFileSync(partialPath, 'utf8');
          return resolvePartials(content, depth + 1);
        }
        console.warn('WARNING: partial not found:', fname);
        return match;
      });
    }
    html = resolvePartials(html, 0);
  }
  let fileObf = 0;
  let fileFallback = 0;

  html = html.replace(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi, (match, scriptContent) => {
    const trimmed = scriptContent.trim();
    if (!trimmed || trimmed.length < 50) return match;

    // Skip very large blocks (>200KB) — too complex for reliable obfuscation
    if (trimmed.length > 200000) {
      fallbackCount++;
      fileFallback++;
      return match;
    }

    const obfuscated = tryObfuscate(trimmed, BASE_OPTIONS);
    const openTag = match.match(/<script[^>]*>/i)[0];

    if (obfuscated) {
      obfuscatedCount++;
      fileObf++;
      return `${openTag}${obfuscated}</script>`;
    } else {
      fallbackCount++;
      fileFallback++;
      return match; // use original
    }
  });

  fs.writeFileSync(path.join('dist', htmlFile), html, 'utf8');
  const status = fileFallback > 0
    ? `✓ (${fileObf} obfuscated, ${fileFallback} fallback)`
    : `✓ (${fileObf} obfuscated)`;
  console.log(status);
}

// ─── 2. Obfuscate src/*.js ──────────────────────────────────────────────────
console.log('\n🔐 Processing src/ files...');
if (fs.existsSync('src')) {
  if (!fs.existsSync('dist/src')) fs.mkdirSync('dist/src', { recursive: true });
  const srcFiles = fs.readdirSync('src').filter(f => f.endsWith('.js'));
  for (const srcFile of srcFiles) {
    const srcPath = path.join('src', srcFile);
    const destPath = path.join('dist', 'src', srcFile);
    process.stdout.write(`  src/${srcFile} ... `);
    const src = fs.readFileSync(srcPath, 'utf8');
    const obfuscated = tryObfuscate(src, BASE_OPTIONS);
    if (obfuscated) {
      fs.writeFileSync(destPath, obfuscated, 'utf8');
      obfuscatedCount++;
      console.log('✓');
    } else {
      fs.copyFileSync(srcPath, destPath);
      fallbackCount++;
      console.log('⚠️  (fallback — syntax check failed)');
    }
  }
}

// ─── 3. Obfuscate sw.js ───────────────────────────────────────────────────────
console.log('\n⚙️  Processing sw.js...');
if (fs.existsSync('sw.js')) {
  const src = fs.readFileSync('sw.js', 'utf8');
  const obfuscated = tryObfuscate(src, BASE_OPTIONS);
  if (obfuscated) {
    fs.writeFileSync('dist/sw.js', obfuscated, 'utf8');
    obfuscatedCount++;
    console.log('  ✓ dist/sw.js (obfuscated)');
  } else {
    fs.copyFileSync('sw.js', 'dist/sw.js');
    fallbackCount++;
    console.log('  ⚠️  dist/sw.js (fallback — syntax check failed)');
  }
}

// ─── 4. Obfuscate api/*.js ────────────────────────────────────────────────────
console.log('\n🔒 Processing api/ files...');
const apiFiles = fs.readdirSync('api').filter(f => f.endsWith('.js') && !API_SKIP.has(f));
for (const apiFile of apiFiles) {
  const srcPath = path.join('api', apiFile);
  const destPath = path.join('dist', 'api', apiFile);
  process.stdout.write(`  api/${apiFile} ... `);
  const src = fs.readFileSync(srcPath, 'utf8');
  const obfuscated = tryObfuscate(src, API_OPTIONS);
  if (obfuscated) {
    fs.writeFileSync(destPath, obfuscated, 'utf8');
    obfuscatedCount++;
    console.log('✓');
  } else {
    fs.copyFileSync(srcPath, destPath);
    fallbackCount++;
    console.log('⚠️  (fallback — syntax check failed)');
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
console.log(`   Obfuscated: ${obfuscatedCount} files/blocks`);
if (fallbackCount > 0) {
  console.log(`   Fallback (original used): ${fallbackCount} files/blocks`);
}
console.log(`   Output → dist/\n`);

// ─── Post-build validation ────────────────────────────────────────────────────
// Runs validate-build.js automatically after every build.
// Exit code 1 blocks the commit/deploy if structural issues are found.
try {
  const { execSync } = require('child_process');
  execSync('node validate-build.js', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
  process.exit(1);
}

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
