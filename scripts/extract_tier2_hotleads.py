#!/usr/bin/env python3
"""
Extract src/hotleads.js from index.html.

The HOT LEADS DASHBOARD section is a contiguous block.

Section starts with:
  // ═══════════════════════════════
  //  HOT LEADS DASHBOARD
  // ═══════════════════════════════

Section ends just before:
  // timeAgo defined below
  // ═══════════════════════════════
  //  ANALYTICS DASHBOARD
  // ═══════════════════════════════

Functions extracted:
  - loadHotLeads()
  - openHotLeadDetail()
  - hlSendToGHL()
  - _doSendToGHL()

Dependencies (already in other modules):
  - escHtml()  → ui.js
  - timeAgo()  → ui.js
  - adminAPI() → api.js
  - toast()    → ui.js
  - sb         → supabase client (global)
  - S.cfg      → state.js
  - currentAccount → state.js
"""

import sys, re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── Find section boundaries ───────────────────────────────────────────────────
HL_START_MARKER = '// ═══════════════════════════════\n//  HOT LEADS DASHBOARD\n// ═══════════════════════════════\n'
HL_END_MARKER   = '// timeAgo defined below\n\n// ═══════════════════════════════\n//  ANALYTICS DASHBOARD\n'

start_idx = html.find(HL_START_MARKER)
if start_idx == -1:
    print('ERROR: Could not find HOT LEADS DASHBOARD section marker!')
    sys.exit(1)

end_idx = html.find(HL_END_MARKER, start_idx)
if end_idx == -1:
    print('ERROR: Could not find ANALYTICS DASHBOARD marker (end of hot leads)!')
    sys.exit(1)

section_text = html[start_idx:end_idx]
print(f'Found HOT LEADS DASHBOARD section: chars {start_idx}–{end_idx} ({section_text.count(chr(10))} lines)')

# ── Build the module file ─────────────────────────────────────────────────────
module_header = """\
// src/hotleads.js
// Hot Leads dashboard — tracks estimate page views, sends leads to GHL.
// Depends on: sb, S.cfg, currentAccount, adminAPI(), toast(), escHtml(), timeAgo()
// Extracted from index.html — Tier 2 modularization

"""

# Strip the section comment header from the extracted block
code_body = section_text[len(HL_START_MARKER):]

module_content = module_header + code_body

with open('src/hotleads.js', 'w', encoding='utf-8') as f:
    f.write(module_content)
print(f'Wrote src/hotleads.js ({module_content.count(chr(10))} lines)')

# ── Remove section from index.html ────────────────────────────────────────────
# Also remove the HL_END_MARKER comment lines that belong to hotleads context
# (the "// timeAgo defined below" comment is part of the hot leads section)
modified = html[:start_idx] + html[end_idx + len(HL_END_MARKER):]
# Re-insert just the ANALYTICS DASHBOARD header (without the timeAgo comment)
analytics_header = '// ═══════════════════════════════\n//  ANALYTICS DASHBOARD\n// ═══════════════════════════════\n'
modified = html[:start_idx] + html[end_idx + len('// timeAgo defined below\n'):]
print(f'Removed HOT LEADS DASHBOARD section from index.html')

# ── Insert <script src> tag ───────────────────────────────────────────────────
last_src_tag_pattern = re.compile(r'(<script src="/src/[^"]+"></script>)', re.MULTILINE)
matches = list(last_src_tag_pattern.finditer(modified))
if not matches:
    print('ERROR: Could not find any <script src="/src/..."> tags!')
    sys.exit(1)

last_match = matches[-1]
insert_pos = last_match.end()
new_tag = '\n  <script src="/src/hotleads.js"></script>'
modified = modified[:insert_pos] + new_tag + modified[insert_pos:]
print(f'Inserted <script src="/src/hotleads.js"> after {last_match.group()}')

# ── Write modified index.html ─────────────────────────────────────────────────
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

orig_lines = html.count('\n')
new_lines = modified.count('\n')
print(f'\nindex.html: {orig_lines} → {new_lines} lines (removed {orig_lines - new_lines})')
print('Done. Run: node build.js')
