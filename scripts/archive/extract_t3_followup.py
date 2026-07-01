#!/usr/bin/env python3
"""Extract src/follow-up.js — Homeowner follow-up modal (contiguous section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  HOMEOWNER FOLLOW-UP\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  STRUCTURES ENGINEE\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found HOMEOWNER FOLLOW-UP: {section.count(chr(10))} lines')

module = ('// src/follow-up.js\n'
          '// Homeowner follow-up modal — open, send SMS/email, template tokens.\n'
          '// Depends on: sb, S.pins, S.cfg, currentAccount, adminAPI(), toast()\n'
          '// Extracted from index.html — Tier 3 modularization\n\n'
          + section[len(START):])

with open('src/follow-up.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/follow-up.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/follow-up.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
