#!/usr/bin/env python3
"""
Tier 1 module extraction: video.js, print.js, financing.js, zones.js
Each extraction uses text-based find/replace to remove functions from index.html
and writes them to src/ files.
"""
import re, os

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

lines = html.split('\n')

def extract_lines(start_line, end_line):
    """Extract lines (1-indexed, inclusive) from the file."""
    return '\n'.join(lines[start_line-1:end_line])

def remove_lines(start_line, end_line):
    """Remove lines (1-indexed, inclusive) from lines list."""
    del lines[start_line-1:end_line]

# ─── Helper: find end of a function by brace matching ───────────────────────
def find_func_end(start_line_1indexed):
    """Given the line where a function starts (1-indexed), return the end line (1-indexed)."""
    depth = 0
    started = False
    for i in range(start_line_1indexed - 1, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                depth += 1
                started = True
            elif ch == '}':
                depth -= 1
        if started and depth == 0:
            return i + 1  # 1-indexed
    return len(lines)

# ─────────────────────────────────────────────────────────────────────────────
# MODULE 1: src/video.js  (lines 8453–8534)
# Functions: videoEmbedPreview, updateRepVideoPreview, onEstVideoUrlInput,
#            handleEstVideoUpload, clearEstVideo
# ─────────────────────────────────────────────────────────────────────────────
VIDEO_START = 8453
VIDEO_END   = 8534

video_content = extract_lines(VIDEO_START, VIDEO_END)

video_js = f"""// ── VIDEO HELPERS ────────────────────────────────────────────────────────────
// Extracted from index.html — pure video embed/upload helpers
// Dependencies: toast() [ui.js], sb [global], scheduleDraftSave [index.html]
{video_content}
"""

with open('src/video.js', 'w', encoding='utf-8') as f:
    f.write(video_js)
print(f'✓ Wrote src/video.js ({len(video_js.splitlines())} lines)')

# ─────────────────────────────────────────────────────────────────────────────
# MODULE 2: src/print.js  (lines 12904–13051)
# Functions: printNow, updateFinPreview, printPreview, getMailerStyles
# ─────────────────────────────────────────────────────────────────────────────
PRINT_START = 12904
PRINT_END   = 13051

print_content = extract_lines(PRINT_START, PRINT_END)

print_js = f"""// ── PRINT & PREVIEW HELPERS ──────────────────────────────────────────────────
// Extracted from index.html — pure print window builders and financing preview
// Dependencies: S [state.js], escHtml [index.html], getMailerStyles [this file]
{print_content}
"""

with open('src/print.js', 'w', encoding='utf-8') as f:
    f.write(print_js)
print(f'✓ Wrote src/print.js ({len(print_js.splitlines())} lines)')

# ─────────────────────────────────────────────────────────────────────────────
# MODULE 3: src/zones.js  (lines 14146–14594)
# Full canvass areas / zones section
# ─────────────────────────────────────────────────────────────────────────────
ZONES_START = 14146
ZONES_END   = 14594

zones_content = extract_lines(ZONES_START, ZONES_END)

zones_js = f"""// ── CANVASS AREAS / ZONES ────────────────────────────────────────────────────
// Extracted from index.html — zones map, polygon drawing, zone CRUD
// Dependencies: S [state.js], map [map.js], toast [ui.js], adminAPI [api.js],
//               sb [global], escHtml [index.html], currentAccount/currentProfile [globals]
{zones_content}
"""

with open('src/zones.js', 'w', encoding='utf-8') as f:
    f.write(zones_js)
print(f'✓ Wrote src/zones.js ({len(zones_js.splitlines())} lines)')

# ─────────────────────────────────────────────────────────────────────────────
# Now patch index.html — remove extracted blocks and add script tags
# We must remove in REVERSE order to preserve line numbers
# ─────────────────────────────────────────────────────────────────────────────

# Re-read the file as a string for text-based replacements
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── Remove zones block ──
zones_marker_start = '// ── CANVASS AREAS ─────────────────────────────────────────────────────────────\n// ── ZONES MAP ADDRESS SEARCH ─────────────────────────────────────────────────'
# Find the end marker — the line just before openManageTeam
zones_end_marker = '\nfunction openManageTeam('

zones_start_pos = html.find(zones_marker_start)
zones_end_pos   = html.find(zones_end_marker)

if zones_start_pos == -1:
    print('⚠️  Could not find zones start marker — trying alternate')
    zones_marker_start = '// ── ZONES MAP ADDRESS SEARCH'
    zones_start_pos = html.find(zones_marker_start)

if zones_start_pos != -1 and zones_end_pos != -1:
    html = html[:zones_start_pos] + html[zones_end_pos:]
    print('✓ Removed zones block from index.html')
else:
    print(f'⚠️  Zones removal failed: start={zones_start_pos}, end={zones_end_pos}')

# ── Remove video block ──
video_marker_start = 'function videoEmbedPreview(url){'
video_end_marker   = '\nfunction getSolarPrice(){'

v_start = html.find(video_marker_start)
v_end   = html.find(video_end_marker)
if v_start != -1 and v_end != -1:
    html = html[:v_start] + html[v_end:]
    print('✓ Removed video block from index.html')
else:
    print(f'⚠️  Video removal failed: start={v_start}, end={v_end}')

# ── Remove print/financing block ──
print_marker_start = 'function printNow(){'
print_end_marker   = '\n// ═══════════════════════════════\n//  AUTH HELPERS'

p_start = html.find(print_marker_start)
p_end   = html.find(print_end_marker)
if p_start != -1 and p_end != -1:
    html = html[:p_start] + html[p_end:]
    print('✓ Removed print/financing block from index.html')
else:
    print(f'⚠️  Print removal failed: start={p_start}, end={p_end}')

# ── Add script tags ──
# Insert after the last existing src/ script tag
last_src_tag = '<script src="/src/supabase-sync.js"></script>'
new_tags = last_src_tag + '\n<script src="/src/video.js"></script>\n<script src="/src/print.js"></script>\n<script src="/src/zones.js"></script>'

if last_src_tag in html:
    html = html.replace(last_src_tag, new_tags, 1)
    print('✓ Added script tags for video.js, print.js, zones.js')
else:
    print('⚠️  Could not find last src tag to insert after')

# ── Write patched index.html ──
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'\n✅ Done! index.html is now {len(html.splitlines())} lines')
