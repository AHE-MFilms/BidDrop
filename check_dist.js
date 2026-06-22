const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf8');
const scripts = [];
const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  if (m[1].trim().length > 50) scripts.push(m[1]);
}
console.log('Script blocks found:', scripts.length);
let hasError = false;
for (let i = 0; i < scripts.length; i++) {
  try {
    new Function(scripts[i]);
    console.log('Block', i+1, ': OK (', scripts[i].length, 'chars)');
  } catch(e) {
    hasError = true;
    console.log('Block', i+1, ': SYNTAX ERROR -', e.message.slice(0,120));
    console.log('  First 300 chars:', scripts[i].slice(0,300));
  }
}
if (!hasError) console.log('\nAll blocks OK!');
process.exit(hasError ? 1 : 0);
