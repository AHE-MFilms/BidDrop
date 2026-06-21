#!/usr/bin/env python3
"""Extract src/storm.js — NOAA SPC Hail/Wind overlay (contiguous section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════════════════════════════════════\n//  STORM EVENTS — NOAA SPC Hail Overlay\n// ═══════════════════════════════════════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  HAMBURGER NAV MENU\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found'); sys.exit(1)

section = html[si:ei]
print(f'Found STORM EVENTS: {section.count(chr(10))} lines')

module = '// src/storm.js\n// NOAA SPC Hail + Wind overlay on the map.\n// Depends on: map (Leaflet global), toast(), S.cfg, currentAccount, adminAPI()\n// Extracted from index.html — Tier 3 modularization\n\n' + section[len(START):]

with open('src/storm.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/storm.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

# Insert script tag after last src/*.js tag
matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/storm.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
