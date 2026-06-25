#!/usr/bin/env python3
"""Extract src/agency.js — Agency view (super_admin dashboard, KPIs, account cards, mailer log)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  AGENCY VIEW (super_admin only)\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  OFFLINE PIN QUEUE & PWA\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found AGENCY VIEW: {section.count(chr(10))} lines')

module = ('// src/agency.js\n'
          '// Super-admin agency dashboard — KPIs, account cards, credit adjustments,\n'
          '// mailer log, leaderboard, activity chart, client account editing.\n'
          '// Depends on: sb, S, currentAccount, adminAPI(), toast(), escHtml() (ui.js)\n'
          '// Extracted from index.html — Tier 5 modularization\n\n'
          + section[len(START):])

with open('src/agency.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/agency.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/agency.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
