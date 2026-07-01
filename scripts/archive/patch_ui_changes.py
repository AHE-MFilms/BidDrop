"""
Patch script: 4 UI changes
1. Rename POSTCARD/LETTER action buttons to ORDER POSTCARD / ORDER LETTER
2. Fix --mid and --muted text on dark blue backgrounds -> use --text (white)
3. Simplify credits: show total (free + paid) as one number
4. Add SETTINGS tab to nav, remove shield/gear icons from header
"""

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

original_len = len(html)

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: Rename action buttons in renderQueue
# ─────────────────────────────────────────────────────────────────────────────

# "📬 Letter" send button -> "📬 Order Letter"
html = html.replace(
    '>&#128228; Letter</button>',
    '>&#128228; Order Letter</button>'
)
html = html.replace(
    '>📬 Letter</button>',
    '>📬 Order Letter</button>'
)

# "🏠 Postcard" send button -> "🏠 Order Postcard"
html = html.replace(
    '>&#127968; Postcard</button>',
    '>&#127968; Order Postcard</button>'
)
html = html.replace(
    '>🏠 Postcard</button>',
    '>🏠 Order Postcard</button>'
)

# Preview buttons: "👁 Letter" -> "Preview Letter" and "🏠 Card" -> "Preview Card"
html = html.replace(
    '>&#128065; Letter</button>',
    '>Preview Letter</button>'
)
html = html.replace(
    '>🏠 Card</button>',
    '>Preview Card</button>'
)

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Fix text color on dark blue backgrounds
# The issue: --mid (#A8BECE, medium blue-grey) and --muted (#6688A8, dim blue)
# are hard to read on dark panels. Fix by updating the CSS variables so
# --mid becomes a lighter, more readable color and --muted is brighter.
# Also fix specific btn-xs color to be white on dark background.
# ─────────────────────────────────────────────────────────────────────────────

# Make --mid brighter (was #A8BECE, now #C8D8E8 - lighter blue-white)
# Make --muted brighter (was #6688A8, now #8AAAC8 - more readable)
html = html.replace(
    '--text:#F0F6FF;--mid:#A8BECE;--muted:#6688A8;',
    '--text:#F0F6FF;--mid:#C8D8E8;--muted:#96B0C8;'
)

# Fix btn-xs default text color from --mid to --text (white)
html = html.replace(
    '.btn-xs{font-family:var(--font-b);font-size:10px;font-weight:700;padding:4px 9px;border-radius:5px;border:1px solid var(--border);cursor:pointer;background:var(--card2);color:var(--mid);transition:all .15s;letter-spacing:.3px;text-transform:uppercase;}',
    '.btn-xs{font-family:var(--font-b);font-size:10px;font-weight:700;padding:4px 9px;border-radius:5px;border:1px solid var(--border);cursor:pointer;background:var(--card2);color:var(--text);transition:all .15s;letter-spacing:.3px;text-transform:uppercase;}'
)

# Fix tab-btn default color from --muted to --mid (brighter)
html = html.replace(
    '.tab-btn{background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);',
    '.tab-btn{background:none;border:none;border-bottom:2px solid transparent;color:var(--mid);'
)

# Fix the postcard preview button in queue that uses hard-coded #0e7490 color
html = html.replace(
    'style="background:#0e749022;border-color:#0e7490;color:#0e7490;" title="Preview postcard front &amp; back"',
    'style="background:#0e749033;border-color:#0e7490;color:#C8D8E8;" title="Preview postcard front &amp; back"'
)

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: Simplify credits - show total (free + paid) as one number
# ─────────────────────────────────────────────────────────────────────────────

# Update the queue credits bar HTML - replace two separate boxes with one total
old_credits_bar = '''      <span style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);">Your Credits</span>
      <div style="display:flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 14px;">
        <span style="font-size:18px;font-weight:800;color:var(--accent);" id="qcb-free">—</span>
        <span style="font-size:11px;color:var(--muted);">free lookups left this month</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 14px;">
        <span style="font-size:18px;font-weight:800;color:#4ade80;" id="qcb-paid">—</span>
        <span style="font-size:11px;color:var(--muted);">paid credits</span>
      </div>
      <span style="font-size:10px;color:var(--muted);">Each postcard or letter = 16 credits ($4.00)</span>'''

new_credits_bar = '''      <span style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--mid);">Your Credits</span>
      <div style="display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:8px 18px;">
        <span style="font-size:24px;font-weight:800;color:var(--accent);" id="qcb-total">—</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text);">Credits Available</div>
          <div style="font-size:10px;color:var(--mid);">Each mailer = 1 credit ($4.00)</div>
        </div>
      </div>
      <span id="qcb-free" style="display:none;">—</span>
      <span id="qcb-paid" style="display:none;">—</span>'''

html = html.replace(old_credits_bar, new_credits_bar)

# Update the header credit badge label
html = html.replace(
    '<span id="credit-badge-label" class="credit-badge-text">10 free</span>',
    '<span id="credit-badge-label" class="credit-badge-text">10 credits</span>'
)

# Update the updateCreditBadge function to show total
old_badge_fn = '''function updateCreditBadge(){
  const badge = document.getElementById('credit-badge-label');
  if(!badge) return;
  const freeLimit = S.cfg.freeLookupsLimit || 10;
  const freeLeft = Math.max(0, freeLimit - (S.cfg.freeLookupsUsed||0));
  const paid     = S.cfg.lookupCredits || 0;
  if(freeLeft > 0){
    badge.textContent = freeLeft + ' free';
    document.getElementById('credit-badge-btn').style.borderColor = 'rgba(255,255,255,.15)';
  } else if(paid > 0){
    badge.textContent = paid + ' credits';
    document.getElementById('credit-badge-btn').style.borderColor = '#4ade80';
  } else {
    badge.textContent = 'Buy Credits';
    document.getElementById('credit-badge-btn').style.borderColor = '#ef4444';
  }
  // Also update the Mail Queue credits bar
  const qFree = document.getElementById('qcb-free');
  const qPaid = document.getElementById('qcb-paid');
  if(qFree) qFree.textContent = freeLeft;
  if(qPaid) qPaid.textContent = paid;
  // Color the buy button red if out of credits
  const buyBtn = document.querySelector('#queue-credits-bar button');
  if(buyBtn){
    if(freeLeft === 0 && paid === 0){
      buyBtn.style.background = '#ef4444';
      buyBtn.textContent = '⚠ Buy Credits — Out!';
    } else {
      buyBtn.style.background = 'var(--accent)';
      buyBtn.textContent = '+ Buy Credits';
    }
  }
}'''

new_badge_fn = '''function updateCreditBadge(){
  const badge = document.getElementById('credit-badge-label');
  if(!badge) return;
  const freeLimit = S.cfg.freeLookupsLimit || 10;
  const freeLeft = Math.max(0, freeLimit - (S.cfg.freeLookupsUsed||0));
  const paid     = S.cfg.lookupCredits || 0;
  const total    = freeLeft + paid;
  if(total > 0){
    badge.textContent = total + ' credits';
    document.getElementById('credit-badge-btn').style.borderColor = 'rgba(255,255,255,.15)';
  } else {
    badge.textContent = 'Buy Credits';
    document.getElementById('credit-badge-btn').style.borderColor = '#ef4444';
  }
  // Update the Mail Queue credits bar total
  const qTotal = document.getElementById('qcb-total');
  if(qTotal) qTotal.textContent = total;
  // Color the buy button red if out of credits
  const buyBtn = document.querySelector('#queue-credits-bar button');
  if(buyBtn){
    if(total === 0){
      buyBtn.style.background = '#ef4444';
      buyBtn.textContent = 'Out of Credits — Buy Now';
    } else {
      buyBtn.style.background = 'var(--accent)';
      buyBtn.textContent = '+ Buy Credits';
    }
  }
}'''

html = html.replace(old_badge_fn, new_badge_fn)

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4: Add SETTINGS tab to nav, remove shield/gear icons from header
# ─────────────────────────────────────────────────────────────────────────────

# Add SETTINGS tab button to desktop nav (after Canvass Areas)
html = html.replace(
    '    <button class="tab-btn" id="zones-tab-btn" onclick="goTab(\'zones\')" data-tab="zones">&#128194; Canvass Areas</button>\n  </div>',
    '    <button class="tab-btn" id="zones-tab-btn" onclick="goTab(\'zones\')" data-tab="zones">&#128194; Canvass Areas</button>\n    <button class="tab-btn" onclick="goTab(\'settings\')" data-tab="settings">&#9881;&#65039; Settings</button>\n  </div>'
)

# Add SETTINGS tab button to mobile bottom nav (replace the openSettings() button)
html = html.replace(
    '  <button class="bnav-btn" onclick="openSettings()"><span class="bicon">&#9881;&#65039;</span>Settings</button>',
    '  <button class="bnav-btn" onclick="goTab(\'settings\')" data-tab="settings"><span class="bicon">&#9881;&#65039;</span>Settings</button>'
)

# Remove the shield icon button from header (it was display:none for non-super-admin anyway)
html = html.replace(
    '    <button class="icon-btn" id="admin-panel-btn" onclick="openAdminPanel()" title="Admin Panel" style="display:none;">&#128737;</button>\n',
    ''
)
html = html.replace(
    '    <button class="icon-btn" id="admin-panel-btn" onclick="openAdminPanel()" title="Admin Panel" style="display:none;">🛡</button>\n',
    ''
)

# Remove the gear icon button from header
html = html.replace(
    '    <button class="icon-btn" onclick="openSettings()" title="Settings">&#9881;&#65039;</button>\n',
    ''
)
html = html.replace(
    '    <button class="icon-btn" onclick="openSettings()" title="Settings">⚙️</button>\n',
    ''
)

# Update the user-badge button to also go to settings tab (not open admin modal)
html = html.replace(
    '    <button class="icon-btn" id="user-badge" onclick="openAdminPanel()" title="Your Account" style="font-size:11px;font-weight:700;width:auto;padding:0 10px;color:var(--accent);">...</button>',
    '    <button class="icon-btn" id="user-badge" onclick="goTab(\'settings\')" title="Settings" style="font-size:11px;font-weight:700;width:auto;padding:0 10px;color:var(--accent);">...</button>'
)

# Add the settings tab pane after the zones tab pane closing div
# The zones tab ends at the </div></div> pattern before <!-- SAVE ZONE MODAL -->
settings_tab_pane = '''  <div class="tab-pane" id="tab-settings" style="flex-direction:column;overflow-y:auto;">
    <!-- SETTINGS TAB: Team + Company Settings -->
    <div style="max-width:900px;width:100%;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;gap:24px;">

      <!-- TEAM MEMBERS SECTION -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <div style="font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--text);letter-spacing:.5px;">&#128101; Team Members</div>
          <div id="settings-team-role-badge" style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:9px;background:var(--accent-dim);color:var(--accent);text-transform:uppercase;"></div>
        </div>
        <div id="settings-team-body" style="padding:16px 20px;">
          <div style="color:var(--mid);font-size:13px;">Loading team...</div>
        </div>
      </div>

      <!-- COMPANY SETTINGS SECTION (mirrors the settings modal) -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);">
          <div style="font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--text);letter-spacing:.5px;">&#9881;&#65039; Company Settings</div>
        </div>
        <div style="padding:20px;">
          <p style="color:var(--mid);font-size:13px;margin:0 0 16px;">Configure your company info, pricing, postcard content, and integrations.</p>
          <button onclick="openSettings()" style="background:var(--accent);border:none;border-radius:9px;padding:12px 28px;color:#fff;font-family:var(--font-h);font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.5px;">Open Settings &amp; Pricing</button>
        </div>
      </div>

      <!-- SIGN OUT -->
      <div style="text-align:center;padding-bottom:20px;">
        <button onclick="doLogout()" style="background:none;border:1px solid var(--danger);border-radius:8px;padding:10px 28px;color:var(--danger);font-family:var(--font-b);font-size:13px;font-weight:700;cursor:pointer;">Sign Out</button>
      </div>
    </div>
  </div>
'''

html = html.replace(
    '</div>\n<!-- SAVE ZONE MODAL -->',
    '</div>\n' + settings_tab_pane + '<!-- SAVE ZONE MODAL -->'
)

# Add goTab('settings') handler to the goTab function
html = html.replace(
    "  if(t==='followup')renderFollowUpTab();\n}",
    "  if(t==='followup')renderFollowUpTab();\n  if(t==='settings')renderSettingsTab();\n}"
)

# Add the renderSettingsTab function after the renderFollowUpTab function
render_settings_fn = '''
function renderSettingsTab(){
  // Load team members into the settings tab
  const body = document.getElementById('settings-team-body');
  const roleBadge = document.getElementById('settings-team-role-badge');
  if(!body) return;
  body.innerHTML = '<div style="color:var(--mid);font-size:13px;">Loading...</div>';

  // Show the admin panel content inline
  (async ()=>{
    try{
      const isSA = currentUser && currentUser.role === 'super_admin';
      const isAdm = isAdminOrAbove();
      if(roleBadge) roleBadge.textContent = isSA ? 'Super Admin' : (isAdm ? 'Admin' : 'Rep');

      if(isSA){
        // Super admin: show link to full admin panel
        body.innerHTML = '<div style="color:var(--mid);font-size:13px;margin-bottom:12px;">You are logged in as Super Admin.</div>' +
          '<button onclick="openAdminPanel()" style="background:var(--accent);border:none;border-radius:8px;padding:10px 22px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.5px;">Open Full Admin Panel</button>';
      } else if(isAdm){
        const {data:profiles} = await sb.from('user_profiles').select('*').eq('account_id', currentAccount.id);
        body.innerHTML = renderAccountAdminPanel(profiles||[]);
      } else {
        body.innerHTML = '<div style="color:var(--mid);font-size:13px;">Contact your admin to manage team members.</div>';
      }
    } catch(e){
      body.innerHTML = '<div style="color:var(--mid);font-size:13px;">Could not load team data.</div>';
    }
  })();
}
'''

# Insert after renderFollowUpTab function
html = html.replace(
    'function renderFollowUpTab(){',
    render_settings_fn + '\nfunction renderFollowUpTab(){'
)

# ─────────────────────────────────────────────────────────────────────────────
# Write output
# ─────────────────────────────────────────────────────────────────────────────
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

new_len = len(html)
print(f"Done. File size: {original_len} -> {new_len} chars (+{new_len-original_len})")

# Verify key changes
checks = [
    ('Order Letter button', 'Order Letter</button>'),
    ('Order Postcard button', 'Order Postcard</button>'),
    ('Credits total display', 'qcb-total'),
    ('Settings tab in nav', 'goTab(\'settings\')'),
    ('Settings tab pane', 'id="tab-settings"'),
    ('renderSettingsTab fn', 'function renderSettingsTab'),
    ('Updated --mid color', '--mid:#C8D8E8'),
    ('btn-xs white text', 'color:var(--text)'),
]
for name, pattern in checks:
    found = pattern in html
    print(f"  {'OK' if found else 'MISSING'}: {name}")
