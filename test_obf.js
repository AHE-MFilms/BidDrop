const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');

// Extract the main script block from source index.html
const html = fs.readFileSync('index.html', 'utf8');
const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
const scripts = [];
while ((m = re.exec(html)) !== null) {
  if (m[1].trim().length > 50) scripts.push(m[1]);
}
console.log('Source blocks:', scripts.length, 'sizes:', scripts.map(s => s.length));

// Try lighter options - no stringArray, just identifier renaming
const LIGHT = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  stringArray: false,
  unicodeEscapeSequence: false,
  transformObjectKeys: false,
};

for (let i = 0; i < scripts.length; i++) {
  console.log(`\nTesting block ${i+1} (${scripts[i].length} chars)...`);
  try {
    const result = JavaScriptObfuscator.obfuscate(scripts[i], LIGHT);
    const code = result.getObfuscatedCode();
    console.log('  Obfuscated length:', code.length);
    try {
      new Function(code);
      console.log('  Syntax: OK');
    } catch(e) {
      console.log('  Syntax: ERROR -', e.message.slice(0, 100));
    }
  } catch(e) {
    console.log('  Obfuscation failed:', e.message.slice(0, 100));
  }
}
