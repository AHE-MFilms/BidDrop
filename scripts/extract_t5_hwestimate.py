#!/usr/bin/env python3
"""Extract src/homeowner-estimate.js — /e/[id] homeowner estimate page (self-contained route)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═════════════════════════════════════════════════════════════════════════\n//  HOMEOWNER ESTIMATE PAGE  /e/[id]\n// ═════════════════════════════════════════════════════════════════════════\n'
# The section ends at the closing </script> tag that closes the main script block
# That tag is: \n</script>\n<!-- ═══ PROPOSAL MODAL
END_MARKER = '\n// ══════════════════════════════════════════════════════════\n</script>'

si = html.find(START)
ei = html.find(END_MARKER, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    # Debug
    si2 = html.find('//  HOMEOWNER ESTIMATE PAGE')
    print(f'  Approx START line: {html[:si2].count(chr(10))+1 if si2!=-1 else "not found"}')
    # Find closing script tags
    for m in re.finditer(r'\n</script>', html[si2:si2+50000] if si2!=-1 else html):
        ln = html[:si2+m.start()].count('\n')+1 if si2!=-1 else m.start()
        print(f'  </script> near line: {ln}')
        break
    sys.exit(1)

# Section is from START up to (but not including) the \n// ══ and </script>
section = html[si:ei + 1]  # include the trailing \n after last }
print(f'Found HOMEOWNER ESTIMATE PAGE: {section.count(chr(10))} lines')

module = ('// src/homeowner-estimate.js\n'
          '// Homeowner-facing estimate page (/e/[id]) — self-contained route that\n'
          '// renders the full estimate UI, nearby campaign panel, GHL/tracerfy bulk send.\n'
          '// Depends on: sb, adminAPI(), toast(), haversineM()\n'
          '// Extracted from index.html — Tier 5 modularization\n\n'
          + section[len(START):])

with open('src/homeowner-estimate.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/homeowner-estimate.js ({module.count(chr(10))} lines)')

# Remove section from index.html — keep the \n// ══ and </script> in place
modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/homeowner-estimate.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
