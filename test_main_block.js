const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
const scripts = [];
while ((m = re.exec(html)) !== null) {
  if (m[1].trim().length > 50) scripts.push(m[1]);
}

console.log('Source blocks:', scripts.length, 'sizes:', scripts.map(s => s.length));

const OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: false,
  unicodeEscapeSequence: false,
  transformObjectKeys: false,
  selfDefending: false,
};

// Test block 1 (main app)
console.log('\nTesting main block (', scripts[0].length, 'chars)...');
const start = Date.now();
try {
  const result = JavaScriptObfuscator.obfuscate(scripts[0], OPTIONS);
  const code = result.getObfuscatedCode();
  console.log('Success! Time:', Date.now() - start, 'ms, output size:', code.length);
  // Check first 200 chars
  console.log('First 200 chars:', code.slice(0, 200));
} catch(e) {
  console.log('FAILED after', Date.now() - start, 'ms:', e.message.slice(0, 200));
}
