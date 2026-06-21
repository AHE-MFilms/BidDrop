#!/usr/bin/env python3
"""Extract src/trades.js — Trade calculators, selector, settings/pricing tabs (TABS section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  TABS\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  CLOUD STORAGE UPLOAD HELPER\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found TABS: {section.count(chr(10))} lines')

module = ('// src/trades.js\n'
          '// Trade calculators (solar, fencing, siding, gutters, insulation, paint, doors, windows),\n'
          '// trade selector UI, settings/pricing tab renderers, estimator tab helpers.\n'
          '// Depends on: S.cfg, S.pins, currentAccount, toast(), calcStructPrice() (estimates-calc.js)\n'
          '// Extracted from index.html — Tier 4 modularization\n\n'
          + section[len(START):])

with open('src/trades.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/trades.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/trades.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
