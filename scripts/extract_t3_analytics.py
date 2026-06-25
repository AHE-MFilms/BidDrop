#!/usr/bin/env python3
"""Extract src/analytics.js — Analytics dashboard + team management (contiguous section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  ANALYTICS DASHBOARD\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  OFFLINE PIN QUEUE & PWA\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found'); sys.exit(1)

section = html[si:ei]
print(f'Found ANALYTICS DASHBOARD: {section.count(chr(10))} lines')

module = '// src/analytics.js\n// Analytics dashboard — postcard stats, scan tracking, team leaderboard.\n// Depends on: sb, S.cfg, currentAccount, adminAPI(), toast(), Chart.js (global)\n// Extracted from index.html — Tier 3 modularization\n\n' + section[len(START):]

with open('src/analytics.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/analytics.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/analytics.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
