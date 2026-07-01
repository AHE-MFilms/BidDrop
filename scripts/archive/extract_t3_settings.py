#!/usr/bin/env python3
"""Extract src/settings.js — Settings tab render + save (contiguous section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  SETTINGS\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  MODAL / TOAST / UTILS\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found SETTINGS: {section.count(chr(10))} lines')

module = ('// src/settings.js\n'
          '// Settings tab — open/save company config, brand colors, embed card, pricing mode.\n'
          '// Depends on: sb, S.cfg, currentAccount, adminAPI(), toast(), applyBrand()\n'
          '// Extracted from index.html — Tier 3 modularization\n\n'
          + section[len(START):])

with open('src/settings.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/settings.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/settings.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
