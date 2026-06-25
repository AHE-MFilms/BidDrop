#!/usr/bin/env python3
"""Extract src/photo.js — Logo/headshot/photo upload handlers and postcard preview (LOGO/PHOTO section)."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

START = '// ═══════════════════════════════\n//  LOGO / PHOTO\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  MAP SEARCH\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found LOGO / PHOTO: {section.count(chr(10))} lines')

module = ('// src/photo.js\n'
          '// Logo, headshot, review, postcard photo uploads; drip postcard HTML builder;\n'
          '// postcard/letter preview modals; estimate photo lightbox; home/damage photo capture.\n'
          '// Depends on: sb, S.cfg, S.pins, currentAccount, uploadToStorage(), toast()\n'
          '// Extracted from index.html — Tier 4 modularization\n\n'
          + section[len(START):])

with open('src/photo.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/photo.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/photo.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
