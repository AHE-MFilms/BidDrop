#!/usr/bin/env python3
"""
Master module extraction script for BidDrop.
Creates all src/*.js files and patches index.html to load them.
Run from the repo root: python3 extract_all_modules.py
"""
import os, re, sys

HTML = 'index.html'
SRC  = 'src'
os.makedirs(SRC, exist_ok=True)

with open(HTML, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content.splitlines())
print(f"Starting index.html: {original_len} lines")

# ─── Helper ───────────────────────────────────────────────────────────────────
def extract_block(start_marker, end_marker, inclusive_end=True):
    """Return the text between start_marker and end_marker (inclusive of markers)."""
    si = content.find(start_marker)
    if si == -1:
        print(f"  WARNING: start marker not found: {start_marker[:60]!r}")
        return None
    ei = content.find(end_marker, si + len(start_marker))
    if ei == -1:
        print(f"  WARNING: end marker not found: {end_marker[:60]!r}")
        return None
    if inclusive_end:
        ei += len(end_marker)
    return content[si:ei]

def remove_from_html(text):
    global content
    if text and text in content:
        content = content.replace(text, '', 1)
        return True
    return False

def write_src(filename, src_content):
    path = os.path.join(SRC, filename)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src_content)
    print(f"  ✓ wrote {path} ({len(src_content.splitlines())} lines)")

def insert_script_tag(tag_html, before_marker):
    global content
    idx = content.find(before_marker)
    if idx == -1:
        print(f"  WARNING: insert point not found: {before_marker[:60]!r}")
        return False
    content = content[:idx] + tag_html + '\n' + content[idx:]
    return True

# ─── Find the main <script> opening tag ──────────────────────────────────────
# The main script tag is at line 4026 — find it by line position
lines_list = content.splitlines(keepends=True)
# Find the <script> tag that is followed by the AHE_LOGO or SUPABASE_URL within 10 lines
MAIN_SCRIPT_LINE = None
for li, line in enumerate(lines_list):
    if line.strip() == '<script>':
        # Check if SUPABASE_URL appears within the next 20 lines
        lookahead = ''.join(lines_list[li:li+20])
        if 'SUPABASE_URL' in lookahead or 'AHE_LOGO' in lookahead:
            MAIN_SCRIPT_LINE = li
            break
if MAIN_SCRIPT_LINE is None:
    print("ERROR: Cannot find main <script> tag")
    sys.exit(1)
MAIN_SCRIPT_MARKER = lines_list[MAIN_SCRIPT_LINE].rstrip('\n').rstrip('\r')

# ─── 1. state.js ─────────────────────────────────────────────────────────────
print("\n[1] Extracting state.js...")
STATE_START = "const SUPABASE_URL = 'https://gtwbhxnrmfmdenogzuea.supabase.co';"
STATE_END   = "function sLabel(s){return{needs_roof:'Needs Roof',interested:'Interested',contacted:'Contacted',quoted:'Quoted',signed:'Signed',converted:'Converted',bid_sent:'Bid Sent',not_interested:'Not Interested',lost:'Lost'}[s]||s;}"
state_block = extract_block(STATE_START, STATE_END)
if state_block:
    write_src('state.js', '// BidDrop — Global state, constants, and lookup helpers\n// Loaded before all other modules.\n\n' + state_block + '\n')
    remove_from_html(state_block)
    print("  ✓ removed from index.html")

# ─── 2. api.js ───────────────────────────────────────────────────────────────
print("\n[2] Extracting api.js...")
# adminAPI is now gone (was in state block above since it was between SUPABASE_URL and sLabel)
# Actually adminAPI is at 4039 which is INSIDE the state block range — let's check
# The state block goes from SUPABASE_URL (4032) to sLabel end (4145)
# adminAPI is at 4039 — it IS inside the state block. Good.
# load/save/syncAccount/accountRowToCfg are AFTER the state block (4150-4370)
API_START = "function load(){\n  // localStorage fallback for offline/before auth"
API_END   = "  };  // end accountRowToCfg return\n}"
# Try the actual end
API_END2  = "    taxRate: parseFloat(row.tax_rate)||0,"

# Find accountRowToCfg end
acrc_start = content.find("function accountRowToCfg(row){")
if acrc_start != -1:
    # Find the closing brace of the function
    brace_depth = 0
    i = acrc_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                api_end_pos = i + 1
                break
        i += 1
    api_block = content[content.find("function load(){"):api_end_pos]
    write_src('api.js', '// BidDrop — API layer: adminAPI, localStorage persistence, Supabase account sync\n// Depends on: state.js (sb, S, currentAccount, currentProfile, isAdminOrAbove, DEFAULTS)\n\n' + api_block + '\n')
    remove_from_html(api_block)
    print("  ✓ removed from index.html")
else:
    print("  WARNING: accountRowToCfg not found")

# ─── 3. ui.js ────────────────────────────────────────────────────────────────
print("\n[3] Extracting ui.js...")
UI_START = "function openM(id){document.getElementById(id).style.display='flex';}"
UI_END_MARKER = "function isPlanAtLeast(tier){"
# Find end of isPlanAtLeast
ipl_start = content.find(UI_END_MARKER)
if ipl_start != -1:
    brace_depth = 0
    i = ipl_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                ui_end_pos = i + 1
                break
        i += 1
    # Also include showPlanUpgradePrompt if it follows immediately
    after = content[ui_end_pos:ui_end_pos+200]
    spu_match = re.search(r'\nfunction showPlanUpgradePrompt\(', after)
    if spu_match:
        spu_start = ui_end_pos + spu_match.start()
        brace_depth = 0
        i = spu_start
        in_func = False
        while i < len(content):
            c = content[i]
            if c == '{':
                brace_depth += 1
                in_func = True
            elif c == '}':
                brace_depth -= 1
                if in_func and brace_depth == 0:
                    ui_end_pos = i + 1
                    break
            i += 1

    ui_start_pos = content.find(UI_START)
    ui_block = content[ui_start_pos:ui_end_pos]
    write_src('ui.js', '// BidDrop — UI helpers: modals, toast, date formatting, role/plan checks\n// Depends on: state.js (S, currentProfile, currentAccount)\n\n' + ui_block + '\n')
    remove_from_html(ui_block)
    print("  ✓ removed from index.html")
else:
    print("  WARNING: openM not found")

# ─── 4. credits.js ───────────────────────────────────────────────────────────
print("\n[4] Extracting credits.js...")
CRED_START = "function updateCreditBadge(){"
CRED_END_MARKER = "async function buyCredits(packId, btn){"
bc_start = content.find(CRED_END_MARKER)
if bc_start != -1:
    brace_depth = 0
    i = bc_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                cred_end_pos = i + 1
                break
        i += 1
    cred_start_pos = content.find(CRED_START)
    cred_block = content[cred_start_pos:cred_end_pos]
    write_src('credits.js', '// BidDrop — Credit badge, buy credits modal, Stripe checkout\n// Depends on: state.js (S, currentAccount), ui.js (toast, openM, closeM), api.js (adminAPI)\n\n' + cred_block + '\n')
    remove_from_html(cred_block)
    print("  ✓ removed from index.html")
else:
    print("  WARNING: buyCredits not found")

# ─── 5. map.js ───────────────────────────────────────────────────────────────
print("\n[5] Extracting map.js...")
MAP_START = "function initMap(){"
MAP_END_MARKER = "function toggleSatellite(){"
ts_start = content.find(MAP_END_MARKER)
if ts_start != -1:
    brace_depth = 0
    i = ts_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                map_end_pos = i + 1
                break
        i += 1
    map_start_pos = content.find(MAP_START)
    map_block = content[map_start_pos:map_end_pos]
    write_src('map.js', '// BidDrop — Leaflet map initialization, tile layers, cluster group, GPS locate\n// Depends on: state.js (S, map, markers, clusterGroup), ui.js (toast)\n\n' + map_block + '\n')
    remove_from_html(map_block)
    print("  ✓ removed from index.html")
else:
    print("  WARNING: initMap/toggleSatellite not found")

# ─── 6. ghl.js ───────────────────────────────────────────────────────────────
print("\n[6] Extracting ghl.js...")
GHL_START = "const GHL_BASE = 'https://services.leadconnectorhq.com';"
# Find end of sendViaGHL
sVG_marker = "async function sendViaGHL("
sVG_start = content.find(sVG_marker)
if sVG_start != -1:
    brace_depth = 0
    i = sVG_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                ghl_end_pos = i + 1
                break
        i += 1
    ghl_start_pos = content.find(GHL_START)
    ghl_block = content[ghl_start_pos:ghl_end_pos]
    write_src('ghl.js', '// BidDrop — GoHighLevel CRM integration\n// Depends on: state.js (S, currentAccount), ui.js (toast), api.js (adminAPI)\n\n' + ghl_block + '\n')
    remove_from_html(ghl_block)
    print("  ✓ removed from index.html")
else:
    print("  WARNING: GHL_BASE or sendViaGHL not found")

# ─── 7. integrations.js ──────────────────────────────────────────────────────
print("\n[7] Extracting integrations.js...")
INT_START = "async function updateIntStatus(key){"
# Find end of jnUpsertContact or webhookTest
for end_marker in ["async function jnUpsertContact(", "function webhookTest(", "async function jnTestConnection("]:
    jn_start = content.find(end_marker)
    if jn_start != -1:
        break
if jn_start != -1:
    brace_depth = 0
    i = jn_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                int_end_pos = i + 1
                break
        i += 1
    int_start_pos = content.find(INT_START)
    if int_start_pos != -1:
        int_block = content[int_start_pos:int_end_pos]
        write_src('integrations.js', '// BidDrop — Third-party integration helpers: JobNimbus, Jobber, webhook test\n// Depends on: state.js (S, currentAccount), ui.js (toast), api.js (adminAPI)\n\n' + int_block + '\n')
        remove_from_html(int_block)
        print("  ✓ removed from index.html")
    else:
        print("  WARNING: updateIntStatus not found")
else:
    print("  WARNING: integration end marker not found")

# ─── 8. campaign.js ──────────────────────────────────────────────────────────
print("\n[8] Extracting campaign.js...")
CAMP_START = "function openNearbyCampaign(pid){"
# Find end of launchNearbyCampaign or _launchSignedNearbyCampaign
for end_marker in ["async function _launchSignedNearbyCampaign(", "async function launchNearbyCampaign("]:
    lnc_start = content.find(end_marker)
    if lnc_start != -1:
        break
if lnc_start != -1:
    brace_depth = 0
    i = lnc_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                camp_end_pos = i + 1
                break
        i += 1
    # Also include openSorryForMess if it follows
    after = content[camp_end_pos:camp_end_pos+300]
    sfm_match = re.search(r'\nfunction openSorryForMess\(', after)
    if sfm_match:
        sfm_start = camp_end_pos + sfm_match.start()
        brace_depth = 0
        i = sfm_start
        in_func = False
        while i < len(content):
            c = content[i]
            if c == '{':
                brace_depth += 1
                in_func = True
            elif c == '}':
                brace_depth -= 1
                if in_func and brace_depth == 0:
                    camp_end_pos = i + 1
                    break
            i += 1
    camp_start_pos = content.find(CAMP_START)
    if camp_start_pos != -1:
        camp_block = content[camp_start_pos:camp_end_pos]
        write_src('campaign.js', '// BidDrop — Nearby Campaign: modal, filters, order summary, launch, signed auto-prompt, sorry-for-mess\n// Depends on: state.js (S), ui.js (toast, openM, closeM), api.js (adminAPI), credits.js (updateCreditBadge)\n\n' + camp_block + '\n')
        remove_from_html(camp_block)
        print("  ✓ removed from index.html")
    else:
        print("  WARNING: openNearbyCampaign not found")
else:
    print("  WARNING: launchNearbyCampaign not found")

# ─── 9. auth.js ──────────────────────────────────────────────────────────────
print("\n[9] Extracting auth.js...")
AUTH_START = "async function onSignedIn(user){"
AUTH_END_MARKER = "async function doLogout(){"
dlo_start = content.find(AUTH_END_MARKER)
if dlo_start != -1:
    brace_depth = 0
    i = dlo_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                auth_end_pos = i + 1
                break
        i += 1
    auth_start_pos = content.find(AUTH_START)
    if auth_start_pos != -1:
        auth_block = content[auth_start_pos:auth_end_pos]
        write_src('auth.js', '// BidDrop — Authentication: sign-in bootstrap, login/logout, password reset\n// Depends on: state.js (S, sb, currentUser, currentProfile, currentAccount), api.js (load, save, accountRowToCfg, adminAPI), ui.js (toast, openM, closeM, goTab)\n\n' + auth_block + '\n')
        remove_from_html(auth_block)
        print("  ✓ removed from index.html")
    else:
        print("  WARNING: onSignedIn not found")
else:
    print("  WARNING: doLogout not found")

# ─── 10. postcard-render.js ──────────────────────────────────────────────────
print("\n[10] Extracting postcard-render.js...")
PR_START = "function loadImg(url){"
PR_END_MARKER = "function buildLobMailerHtml("
blm_start = content.find(PR_END_MARKER)
if blm_start != -1:
    brace_depth = 0
    i = blm_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                pr_end_pos = i + 1
                break
        i += 1
    pr_start_pos = content.find(PR_START)
    if pr_start_pos != -1:
        pr_block = content[pr_start_pos:pr_end_pos]
        write_src('postcard-render.js', '// BidDrop — Postcard canvas renderers and HTML builders (pure functions, no side effects)\n// Depends on: state.js (S, PITCHLBL, MATLBL), ui.js (escHtml)\n\n' + pr_block + '\n')
        remove_from_html(pr_block)
        print("  ✓ removed from index.html")
    else:
        print("  WARNING: loadImg not found")
else:
    print("  WARNING: buildLobMailerHtml not found")

# ─── 11. supabase-sync.js ────────────────────────────────────────────────────
print("\n[11] Extracting supabase-sync.js...")
SS_START_MARKER = "// ── SUPABASE PIN OPERATIONS"
SS_END_MARKER   = "function subscribeRealtime(){"
sr_start = content.find(SS_END_MARKER)
if sr_start != -1:
    brace_depth = 0
    i = sr_start
    in_func = False
    while i < len(content):
        c = content[i]
        if c == '{':
            brace_depth += 1
            in_func = True
        elif c == '}':
            brace_depth -= 1
            if in_func and brace_depth == 0:
                ss_end_pos = i + 1
                break
        i += 1
    ss_start_pos = content.find(SS_START_MARKER)
    if ss_start_pos != -1:
        ss_block = content[ss_start_pos:ss_end_pos]
        write_src('supabase-sync.js', '// BidDrop — Supabase data sync: pin CRUD, queue, estimates, realtime subscription\n// Depends on: state.js (S, sb, currentAccount, currentUser), ui.js (toast), api.js (adminAPI)\n\n' + ss_block + '\n')
        remove_from_html(ss_block)
        print("  ✓ removed from index.html")
    else:
        print("  WARNING: SUPABASE PIN OPERATIONS comment not found")
else:
    print("  WARNING: subscribeRealtime not found")

# ─── Inject <script> tags before the main <script> block ─────────────────────
print("\n[12] Injecting <script> tags into index.html...")
SCRIPT_TAGS = """<script src="/src/state.js"></script>
<script src="/src/api.js"></script>
<script src="/src/ui.js"></script>
<script src="/src/credits.js"></script>
<script src="/src/map.js"></script>
<script src="/src/ghl.js"></script>
<script src="/src/integrations.js"></script>
<script src="/src/campaign.js"></script>
<script src="/src/auth.js"></script>
<script src="/src/postcard-render.js"></script>
<script src="/src/supabase-sync.js"></script>"""

# Use line-based insertion at the main script line
lines = content.splitlines(keepends=True)
inserted = False
for li, line in enumerate(lines):
    if line.strip() == '<script>':
        lookahead = ''.join(lines[li:li+20])
        if 'SUPABASE_URL' in lookahead or 'AHE_LOGO' in lookahead or 'switchSettingsTab' in lookahead or 'currentEstPinId' in lookahead:
            lines.insert(li, SCRIPT_TAGS + '\n')
            content = ''.join(lines)
            print(f"  ✓ inserted script tags before main <script> at line {li+1}")
            inserted = True
            break

if not inserted:
    print("  WARNING: Could not find insertion point for script tags!")

# ─── Write patched index.html ─────────────────────────────────────────────────
with open(HTML, 'w', encoding='utf-8') as f:
    f.write(content)

final_len = len(content.splitlines())
print(f"\n✅ Done!")
print(f"   index.html: {original_len} → {final_len} lines (removed {original_len - final_len} lines)")
print(f"   src/ files: {len(os.listdir(SRC))}")
for fn in sorted(os.listdir(SRC)):
    path = os.path.join(SRC, fn)
    with open(path) as f:
        lc = len(f.readlines())
    print(f"   - {fn}: {lc} lines")
