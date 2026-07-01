#!/usr/bin/env python3
"""
Fix the ui.js extraction: the RentCast functions were accidentally included.
This script:
1. Reads the current src/ui.js
2. Splits it into proper ui.js (modal/toast/date/role helpers) and src/rentcast.js (property lookup)
3. Puts the RentCast functions into src/rentcast.js
4. Adds <script src="/src/rentcast.js"> to index.html after ui.js
"""

HTML = 'index.html'

# ─── Read current ui.js ───────────────────────────────────────────────────────
with open('src/ui.js', 'r', encoding='utf-8') as f:
    ui_content = f.read()

# ─── Split at the RENTCAST section comment ───────────────────────────────────
RENTCAST_MARKER = '// ═══════════════════════════════\n//  RENTCAST PROPERTY LOOKUP'
TOAST_MARKER    = "function toast(msg,type='info',duration=3200){"

split_pos = ui_content.find(RENTCAST_MARKER)
toast_pos = ui_content.find(TOAST_MARKER)

if split_pos == -1:
    print("ERROR: RENTCAST_MARKER not found in ui.js")
    exit(1)

# Everything before the RENTCAST section = proper ui.js content (openM/closeM/overlay/toastT)
ui_before_rentcast = ui_content[:split_pos].rstrip()

# The RENTCAST section through the end of autoFillOwnerIfEmpty = rentcast.js
# toast() and everything after = back to ui.js
if toast_pos == -1:
    print("ERROR: toast function not found in ui.js")
    exit(1)

rentcast_block = ui_content[split_pos:toast_pos].rstrip()
ui_after_rentcast = ui_content[toast_pos:].rstrip()

# ─── Rebuild proper ui.js ─────────────────────────────────────────────────────
proper_ui = '// BidDrop — UI helpers: modals, toast, date formatting, role/plan checks\n// Depends on: state.js (S, currentProfile, currentAccount)\n\n'
proper_ui += ui_before_rentcast.lstrip('// BidDrop — UI helpers: modals, toast, date formatting, role/plan checks\n// Depends on: state.js (S, currentProfile, currentAccount)\n\n')
proper_ui += '\n\n' + ui_after_rentcast + '\n'

with open('src/ui.js', 'w', encoding='utf-8') as f:
    f.write(proper_ui)
print(f"✓ Fixed src/ui.js ({len(proper_ui.splitlines())} lines)")

# ─── Write src/rentcast.js ────────────────────────────────────────────────────
rentcast_js = '// BidDrop — RentCast property lookup, Solar API, equity badge\n// Depends on: state.js (S, currentAccount), ui.js (toast, updateCreditBadge), credits.js (showBuyCreditsModal)\n\n'
rentcast_js += rentcast_block + '\n'

with open('src/rentcast.js', 'w', encoding='utf-8') as f:
    f.write(rentcast_js)
print(f"✓ Wrote src/rentcast.js ({len(rentcast_js.splitlines())} lines)")

# ─── Add <script src="/src/rentcast.js"> to index.html after ui.js ───────────
with open(HTML, 'r', encoding='utf-8') as f:
    html = f.read()

OLD_TAG = '<script src="/src/ui.js"></script>'
NEW_TAGS = '<script src="/src/ui.js"></script>\n<script src="/src/rentcast.js"></script>'

if OLD_TAG in html:
    html = html.replace(OLD_TAG, NEW_TAGS, 1)
    with open(HTML, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"✓ Added rentcast.js script tag to index.html")
else:
    print("WARNING: ui.js script tag not found in index.html")

print("\n✅ Done!")
print(f"   src/ui.js: {len(proper_ui.splitlines())} lines")
print(f"   src/rentcast.js: {len(rentcast_js.splitlines())} lines")
