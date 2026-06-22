const fs = require('fs');
const html = fs.readFileSync('dist/index.html', 'utf8');
const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
  const t = m[1].trim();
  if (t.length < 10) continue;
  i++;
  console.log(`Block ${i}: len=${t.length}`);
  console.log(`  First 120 chars: ${JSON.stringify(t.slice(0, 120))}`);
  console.log();
}
