#!/usr/bin/env python3
"""Extract src/subscription.js — Stripe billing portal (contiguous section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  SUBSCRIPTION & BILLING\n// ═══════════════════════════════\n'
# The subscription section ends at the CIRCLE OF INFLUENCE comment
END   = '// ══════════════════════════════════════════════════════════\n// CIRCLE OF INFLUENCE CAMPAIGN\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found SUBSCRIPTION & BILLING: {section.count(chr(10))} lines')

module = ('// src/subscription.js\n'
          '// Stripe billing portal — open portal, cancel, reactivate, load status.\n'
          '// Depends on: sb, adminAPI(), toast(), S.cfg\n'
          '// Extracted from index.html — Tier 3 modularization\n\n'
          + section[len(START):])

with open('src/subscription.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/subscription.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/subscription.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
