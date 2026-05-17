#!/usr/bin/env node
/**
 * BidDrop Build Script
 * Extracts inline <script> blocks from index.html, estimate.html, and signup.html,
 * obfuscates the JavaScript, and writes the output to the dist/ directory.
 * The dist/ directory is what Vercel serves.
 */

const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,        // keep false — too slow on large files
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,         // keep console.log for error tracking
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,                // keep false — breaks window.* globals
  rotateStringArray: true,
  selfDefending: false,                // keep false — causes issues with CSP
  shuffleStringArray: true,
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,
  transformObjectKeys: false,          // keep false — breaks dynamic key access
};

const FILES = ['index.html', 'estimate.html', 'signup.html', 'open.html', 'privacy.html'];

// Ensure dist directory exists
if (!fs.existsSync('dist')) fs.mkdirSync('dist');

// Copy all non-HTML files to dist
const allFiles = fs.readdirSync('.');
for (const file of allFiles) {
  if (file === 'dist' || file === 'node_modules' || file === '.git' || file === 'build.js') continue;
  if (file.startsWith('.')) continue;
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    // Copy api/ and supabase/ directories
    if (file === 'api' || file === 'supabase') {
      copyDir(file, path.join('dist', file));
    }
    continue;
  }
  if (!FILES.includes(file)) {
    fs.copyFileSync(file, path.join('dist', file));
  }
}

// Process HTML files
let totalScriptChars = 0;
let obfuscatedCount = 0;

for (const htmlFile of FILES) {
  if (!fs.existsSync(htmlFile)) continue;
  console.log(`Processing ${htmlFile}...`);
  
  let html = fs.readFileSync(htmlFile, 'utf8');
  
  // Replace each inline <script> block (no src attribute) with obfuscated version
  html = html.replace(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi, (match, scriptContent) => {
    const trimmed = scriptContent.trim();
    if (!trimmed || trimmed.length < 50) return match; // skip tiny/empty scripts
    
    try {
      totalScriptChars += trimmed.length;
      const result = JavaScriptObfuscator.obfuscate(trimmed, OBFUSCATOR_OPTIONS);
      const obfuscated = result.getObfuscatedCode();
      obfuscatedCount++;
      // Preserve the opening tag attributes
      const openTag = match.match(/<script[^>]*>/i)[0];
      return `${openTag}${obfuscated}</script>`;
    } catch (err) {
      console.warn(`  ⚠️  Could not obfuscate a script block in ${htmlFile}: ${err.message.slice(0, 80)}`);
      return match; // return original if obfuscation fails
    }
  });
  
  fs.writeFileSync(path.join('dist', htmlFile), html, 'utf8');
  console.log(`  ✓ Written to dist/${htmlFile}`);
}

console.log(`\n✅ Build complete — obfuscated ${obfuscatedCount} script blocks (${Math.round(totalScriptChars/1024)}KB of JS)`);
console.log('   Output → dist/');

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
