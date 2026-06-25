#!/usr/bin/env python3
"""
Extract src/history.js from index.html.

The HISTORY TAB section is a contiguous block:
  Lines ~9473–9681 (after extraction of estimates-calc, offsets will shift).

Section starts with:
  // ═══════════════════════════════
  //  HISTORY TAB
  // ═══════════════════════════════

Section ends just before:
  // ═══════════════════════════════
  //  MAIL QUEUE
  // ═══════════════════════════════

Functions/vars extracted:
  - let _histMailers, _histCredits, _histPage
  - const HIST_PAGE_SIZE
  - loadHistory()
  - histTab()
  - loadCampaignHistory()
  - escHtml() — duplicate; already in ui.js but history uses it inline; we keep it
    in history.js as well (harmless redeclaration since both are function declarations)
  - renderHistMailers()
  - renderHistCredits()
"""

import sys

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── Find section boundaries ───────────────────────────────────────────────────
HIST_START_MARKER = '// ═══════════════════════════════\n//  HISTORY TAB\n// ═══════════════════════════════\n'
HIST_END_MARKER   = '// ═══════════════════════════════\n//  MAIL QUEUE\n// ═══════════════════════════════\n'

start_idx = html.find(HIST_START_MARKER)
if start_idx == -1:
    print('ERROR: Could not find HISTORY TAB section marker!')
    sys.exit(1)

end_idx = html.find(HIST_END_MARKER, start_idx)
if end_idx == -1:
    print('ERROR: Could not find MAIL QUEUE section marker (end of history)!')
    sys.exit(1)

section_text = html[start_idx:end_idx]
print(f'Found HISTORY TAB section: chars {start_idx}–{end_idx} ({section_text.count(chr(10))} lines)')

# ── Build the module file ─────────────────────────────────────────────────────
module_header = """\
// src/history.js
// History tab — mailer log, credit purchases, campaign history.
// Depends on: sb (supabase client), S.cfg, currentAccount, adminAPI(), toast()
// Extracted from index.html — Tier 2 modularization
// Note: escHtml() is also defined in ui.js; this copy is kept for isolation.

"""

# Strip the section comment header from the extracted block (keep just the code)
# The section starts with the marker comment — we'll replace it with our module header
code_body = section_text[len(HIST_START_MARKER):]  # strip the section header comment

module_content = module_header + code_body

with open('src/history.js', 'w', encoding='utf-8') as f:
    f.write(module_content)
print(f'Wrote src/history.js ({module_content.count(chr(10))} lines)')

# ── Remove section from index.html ────────────────────────────────────────────
modified = html[:start_idx] + html[end_idx:]
print(f'Removed HISTORY TAB section from index.html')

# ── Insert <script src> tag ───────────────────────────────────────────────────
import re
last_src_tag_pattern = re.compile(r'(<script src="/src/[^"]+"></script>)', re.MULTILINE)
matches = list(last_src_tag_pattern.finditer(modified))
if not matches:
    print('ERROR: Could not find any <script src="/src/..."> tags!')
    sys.exit(1)

last_match = matches[-1]
insert_pos = last_match.end()
new_tag = '\n  <script src="/src/history.js"></script>'
modified = modified[:insert_pos] + new_tag + modified[insert_pos:]
print(f'Inserted <script src="/src/history.js"> after {last_match.group()}')

# ── Write modified index.html ─────────────────────────────────────────────────
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

orig_lines = html.count('\n')
new_lines = modified.count('\n')
print(f'\nindex.html: {orig_lines} → {new_lines} lines (removed {orig_lines - new_lines})')
print('Done. Run: node build.js')
