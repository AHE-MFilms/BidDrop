#!/usr/bin/env python3
"""Extract src/mailer-preview.js — Estimator preview panel, postcard/proposal preview renderers."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  MAILER PREVIEW\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  DASHBOARD\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found MAILER PREVIEW: {section.count(chr(10))} lines')

module = ('// src/mailer-preview.js\n'
          '// Estimator live preview panel — letter/postcard/proposal mode switcher,\n'
          '// canvas postcard modal, fullscreen preview, proposal preview refresh.\n'
          '// Depends on: S.cfg, S.pins, currentAccount, calcP() (estimates-calc.js),\n'
          '//             buildProposalHTML() (proposal.js), toast()\n'
          '// Extracted from index.html — Tier 5 modularization\n\n'
          + section[len(START):])

with open('src/mailer-preview.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/mailer-preview.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/mailer-preview.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
