#!/usr/bin/env python3
"""
Extract src/estimates-calc.js from index.html.

Functions to extract (non-contiguous, pulled individually):
  - calcPolygonSqFt   (line ~6788)
  - calcStructPrice   (line ~8421)
  - getMatCost        (line ~8448)
  - getSolarPrice     (line ~8457)  — note: misplaced under VIDEO HELPERS header
  - toggleSolarInputs (line ~8468)
  - onSolarKwInput    (line ~8474)
  - onSolarFlatInput  (line ~8483)
  - calcP             (line ~8490)

Strategy: extract each function body as a text block, remove from index.html,
add <script src="/src/estimates-calc.js"> tag.
"""

import re, sys

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── Helper: extract a top-level function by name ─────────────────────────────
def extract_function(src, fn_name):
    """
    Find 'function fn_name(' or 'async function fn_name(' at the start of a line,
    then grab the full body by counting braces.
    Returns (full_text_including_def, start_idx, end_idx) or raises.
    """
    pattern = re.compile(
        r'^((?:async\s+)?function\s+' + re.escape(fn_name) + r'\s*\()',
        re.MULTILINE
    )
    m = pattern.search(src)
    if not m:
        raise ValueError(f'Could not find function {fn_name}')
    start = m.start()
    # Walk forward from the opening brace
    brace_pos = src.index('{', start)
    depth = 0
    i = brace_pos
    while i < len(src):
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                # Consume optional trailing newline
                if end < len(src) and src[end] == '\n':
                    end += 1
                return src[start:end], start, end
        i += 1
    raise ValueError(f'Unmatched braces for function {fn_name}')

# ── Extract each function ─────────────────────────────────────────────────────
functions_to_extract = [
    'calcPolygonSqFt',
    'calcStructPrice',
    'getMatCost',
    'getSolarPrice',
    'toggleSolarInputs',
    'onSolarKwInput',
    'onSolarFlatInput',
    'calcP',
]

extracted_bodies = {}
for fn in functions_to_extract:
    body, s, e = extract_function(html, fn)
    extracted_bodies[fn] = body
    print(f'  Extracted {fn}: {e - s} chars ({body.count(chr(10))} lines)')

# ── Build the module file ─────────────────────────────────────────────────────
module_header = """\
// src/estimates-calc.js
// Pricing engine — calculates structure prices, material costs, solar, polygon sq ft.
// Depends on: S.cfg (state.js), structures (global array in index.html)
// Extracted from index.html — Tier 2 modularization
// NOTE: calcP() also touches DOM elements (e-total, e-breakdown, sp-*) — keep in sync
//       with the estimates UI in index.html.

"""

module_content = module_header
for fn in functions_to_extract:
    module_content += extracted_bodies[fn] + '\n'

with open('src/estimates-calc.js', 'w', encoding='utf-8') as f:
    f.write(module_content)
print(f'\nWrote src/estimates-calc.js ({module_content.count(chr(10))} lines)')

# ── Remove each function from index.html ─────────────────────────────────────
# We must re-locate each function after each removal (offsets shift).
modified = html
for fn in functions_to_extract:
    body, s, e = extract_function(modified, fn)
    # Also remove the misplaced section comment above getSolarPrice if present
    if fn == 'getSolarPrice':
        # Check for the VIDEO HELPERS comment immediately before
        comment_pattern = re.compile(
            r'// ═+\r?\n//\s+VIDEO HELPERS\r?\n// ═+\r?\n',
            re.MULTILINE
        )
        cm = comment_pattern.search(modified, max(0, s - 200))
        if cm and cm.end() == s:
            modified = modified[:cm.start()] + modified[e:]
            print(f'  Removed misplaced VIDEO HELPERS comment + {fn}')
            continue
    modified = modified[:s] + modified[e:]
    print(f'  Removed {fn} from index.html')

# ── Insert <script src> tag ───────────────────────────────────────────────────
# Insert after the last existing src/*.js script tag before the main inline script.
# We look for the last <script src="/src/..."> tag.
last_src_tag_pattern = re.compile(
    r'(<script src="/src/[^"]+"></script>)',
    re.MULTILINE
)
matches = list(last_src_tag_pattern.finditer(modified))
if not matches:
    print('ERROR: Could not find any <script src="/src/..."> tags!')
    sys.exit(1)

last_match = matches[-1]
insert_pos = last_match.end()
new_tag = '\n  <script src="/src/estimates-calc.js"></script>'
modified = modified[:insert_pos] + new_tag + modified[insert_pos:]
print(f'\nInserted <script src="/src/estimates-calc.js"> after {last_match.group()}')

# ── Write modified index.html ─────────────────────────────────────────────────
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(modified)

orig_lines = html.count('\n')
new_lines = modified.count('\n')
print(f'\nindex.html: {orig_lines} → {new_lines} lines (removed {orig_lines - new_lines})')
print('Done. Run: node build.js')
