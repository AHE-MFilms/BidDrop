#!/usr/bin/env python3
"""Extract src/admin-panel.js — Company switcher, admin panel, super admin, delete client account."""
import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# All three sections are tightly coupled — extract as one module
START = '// ═══════════════════════════════\n//  COMPANY SWITCHER (super_admin only)\n// ═══════════════════════════════\n'
END   = '// ═══════════════════════════════\n//  INIT\n// ═══════════════════════════════\n'

si = html.find(START)
ei = html.find(END, si)
if si == -1 or ei == -1:
    print('ERROR: markers not found')
    print('  START found:', si != -1)
    print('  END found:', ei != -1)
    sys.exit(1)

section = html[si:ei]
print(f'Found COMPANY SWITCHER + ADMIN + DELETE: {section.count(chr(10))} lines')

module = ('// src/admin-panel.js\n'
          '// Company switcher (super_admin), admin panel, super admin management,\n'
          '// user CRUD, account creation, delete client account.\n'
          '// Depends on: sb, S, currentAccount, adminAPI(), toast(), escHtml() (ui.js)\n'
          '// Extracted from index.html — Tier 4 modularization\n\n'
          + section[len(START):])

with open('src/admin-panel.js', 'w', encoding='utf-8') as f:
    f.write(module)
print(f'Wrote src/admin-panel.js ({module.count(chr(10))} lines)')

modified = html[:si] + html[ei:]

matches = list(re.finditer(r'(<script src="/src/[^"]+"></script>)', modified))
if not matches: print('ERROR: no src tags'); sys.exit(1)
lm = matches[-1]
modified = modified[:lm.end()] + '\n  <script src="/src/admin-panel.js"></script>' + modified[lm.end():]
print(f'Inserted script tag after {lm.group()}')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

print(f'index.html: {html.count(chr(10))} → {modified.count(chr(10))} lines (removed {html.count(chr(10)) - modified.count(chr(10))})')
