#!/usr/bin/env python3
"""Extract src/mail-queue.js — Estimates tab, mail queue, bulk ops (MAIL QUEUE section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  MAIL QUEUE\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  DASHBOARD\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found MAIL QUEUE: {section.count(chr(10))} lines')

module = ('// src/mail-queue.js\n'
          '// Estimates tab, mail queue render, bulk ops (delete, restore, CSV export, GHL send),\n'
          '// estimate revision history, sort/filter helpers, canvas postcard preview.\n'
          '// Depends on: sb, S, currentAccount, adminAPI(), toast(), calcP() (estimates-calc.js),\n'
          '//             sendLob() (print.js), escHtml() (ui.js)\n'
          '// Extracted from index.html — Tier 4 modularization\n\n'
          + section[len(START):])

with open('src/mail-queue.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/mail-queue.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/mail-queue.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
