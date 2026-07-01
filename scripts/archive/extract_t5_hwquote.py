#!/usr/bin/env python3
"""Extract src/homeowner-quote.js — /q/[slug] homeowner quote page (self-contained route)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════════════════════════════════════════════════\n//  HOMEOWNER QUOTE PAGE  /q/[slug]\n//  Intercepts before app boot — homeowners never see the BidDrop login screen\n// ═══════════════════════════════════════════════════════════════════════════\n'
END   = '// ═════════════════════════════════════════════════════════════════════════\n//  HOMEOWNER ESTIMATE PAGE  /e/[id]\n// ═════════════════════════════════════════════════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    # Try to find approximate location
    si2 = html.find('//  HOMEOWNER QUOTE PAGE')
    ei2 = html.find('//  HOMEOWNER ESTIMATE PAGE')
    print(f'  Approx START line: {html[:si2].count(chr(10))+1 if si2!=-1 else "not found"}')
    print(f'  Approx END line: {html[:ei2].count(chr(10))+1 if ei2!=-1 else "not found"}')
    sys.exit(1)

section = html[si:ei]
print(f'Found HOMEOWNER QUOTE PAGE: {section.count(chr(10))} lines')

module = ('// src/homeowner-quote.js\n'
          '// Homeowner-facing quote page (/q/[slug]) — self-contained route that\n'
          '// intercepts before app boot, renders the quote UI, handles send-postcard modal.\n'
          '// Depends on: sb, adminAPI(), toast()\n'
          '// Extracted from index.html — Tier 5 modularization\n\n'
          + section[len(START):])

with open('src/homeowner-quote.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/homeowner-quote.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/homeowner-quote.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
