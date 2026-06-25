#!/usr/bin/env python3
"""Extract ui.js from index.html - targeted extraction of UI helper functions."""
import os

HTML = 'index.html'
with open(HTML, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content.splitlines())

# The UI functions we want to extract (they appear in a specific order):
# 1. openM / closeM / overlay listener (lines 12887-12898)
# 2. toastT var + toast function (lines 12900-12903, 13239-13243)
# 3. timeAgo, fmtDate, sleep (lines 13250-13257)
# 4. isAdminOrAbove, isSuperAdmin, isRep (lines 13394-13402)
# 5. PLAN_TIERS, currentPlanTier, isPlanAtLeast, showPlanUpgradePrompt (lines 13405-13424)

# Extract each piece individually and build ui.js content
ui_pieces = []

# Piece 1: openM + closeM + overlay listener
P1_START = "function openM(id){document.getElementById(id).style.display='flex';}"
P1_END   = "let toastT;"
p1_si = content.find(P1_START)
p1_ei = content.find(P1_END, p1_si)
if p1_si != -1 and p1_ei != -1:
    piece = content[p1_si:p1_ei].rstrip()
    ui_pieces.append(piece)
    print(f"  ✓ openM/closeM/overlay ({len(piece.splitlines())} lines)")
else:
    print("  WARNING: openM not found")

# Piece 2: toastT + toast function
P2_START = "let toastT;"
P2_END   = "\n\n// ═══"  # next section comment
p2_si = content.find(P2_START)
# Find the end of toast function
toast_func_start = content.find("function toast(msg,type='info',duration=3200){", p2_si)
if toast_func_start != -1:
    # Find closing brace
    brace_depth = 0
    i = toast_func_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                toast_end = i + 1
                break
        i += 1
    piece = content[p2_si:toast_end].rstrip()
    ui_pieces.append(piece)
    print(f"  ✓ toastT/toast ({len(piece.splitlines())} lines)")
else:
    print("  WARNING: toast not found")

# Piece 3: timeAgo, fmtDate, sleep
P3_START = "function timeAgo(iso){"
P3_END_MARKER = "function sleep(ms){return new Promise(r=>setTimeout(r,ms));}"
p3_si = content.find(P3_START)
p3_ei = content.find(P3_END_MARKER)
if p3_si != -1 and p3_ei != -1:
    piece = content[p3_si:p3_ei + len(P3_END_MARKER)].rstrip()
    ui_pieces.append(piece)
    print(f"  ✓ timeAgo/fmtDate/sleep ({len(piece.splitlines())} lines)")
else:
    print("  WARNING: timeAgo/fmtDate/sleep not found")

# Piece 4: isAdminOrAbove, isSuperAdmin, isRep
P4_START = "function isAdminOrAbove(){"
P4_END_MARKER = "function isRep(){"
p4_si = content.find(P4_START)
p4_ei = content.find(P4_END_MARKER, p4_si)
if p4_si != -1 and p4_ei != -1:
    # Find end of isRep
    brace_depth = 0
    i = p4_ei
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                p4_end = i + 1
                break
        i += 1
    piece = content[p4_si:p4_end].rstrip()
    ui_pieces.append(piece)
    print(f"  ✓ isAdminOrAbove/isSuperAdmin/isRep ({len(piece.splitlines())} lines)")
else:
    print("  WARNING: role helpers not found")

# Piece 5: PLAN_TIERS through showPlanUpgradePrompt
P5_START = "// ── Plan tier helpers ────────────────────────────────────────────────────────"
P5_END_MARKER = "function showPlanUpgradePrompt("
p5_si = content.find(P5_START)
p5_ei = content.find(P5_END_MARKER, p5_si)
if p5_si != -1 and p5_ei != -1:
    # Find end of showPlanUpgradePrompt
    brace_depth = 0
    i = p5_ei
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                p5_end = i + 1
                break
        i += 1
    piece = content[p5_si:p5_end].rstrip()
    ui_pieces.append(piece)
    print(f"  ✓ PLAN_TIERS/isPlanAtLeast/showPlanUpgradePrompt ({len(piece.splitlines())} lines)")
else:
    print("  WARNING: plan helpers not found")

# Write ui.js
ui_content = '// BidDrop — UI helpers: modals, toast, date formatting, role/plan checks\n// Depends on: state.js (S, currentProfile, currentAccount)\n\n'
ui_content += '\n\n'.join(ui_pieces) + '\n'
with open('src/ui.js', 'w', encoding='utf-8') as f:
    f.write(ui_content)
print(f"\n  ✓ wrote src/ui.js ({len(ui_content.splitlines())} lines)")

# Remove each piece from index.html
for piece in ui_pieces:
    if piece in content:
        content = content.replace(piece, '', 1)
        print(f"  ✓ removed piece from index.html")
    else:
        print(f"  WARNING: piece not found in index.html for removal")

# Write patched index.html
with open(HTML, 'w', encoding='utf-8') as f:
    f.write(content)

final_len = len(content.splitlines())
print(f"\n✅ ui.js extraction done!")
print(f"   index.html: {original_len} → {final_len} lines (removed {original_len - final_len} lines)")
