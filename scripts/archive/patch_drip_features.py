with open('/home/ubuntu/biddrop/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ══════════════════════════════════════════════════════════════════════════════
# PATCH 1: Add "Enable Drip Campaigns" toggle to Settings (admin-only section)
# Insert just before the Drip Postcard Designs section
# ══════════════════════════════════════════════════════════════════════════════
old_drip_section_header = '    <!-- ── DRIP POSTCARD DESIGNS ─────────────────────── -->'
new_drip_toggle = '''    <!-- ── DRIP CAMPAIGN TOGGLE (Admin only) ─────────────── -->
    <div id="drip-toggle-section" style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--text);">📮 Drip Mail Campaigns</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px;">When enabled, reps can enroll addresses in an automated postcard follow-up sequence after the initial flyer is sent.</div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex-shrink:0;">
        <span style="font-size:12px;color:var(--muted);" id="drip-toggle-label">Off</span>
        <div style="position:relative;width:44px;height:24px;">
          <input type="checkbox" id="s-drip-enabled" style="opacity:0;width:0;height:0;position:absolute;" onchange="updateDripToggleLabel()">
          <span onclick="document.getElementById('s-drip-enabled').click()" style="position:absolute;inset:0;background:var(--border);border-radius:12px;cursor:pointer;transition:.2s;" id="drip-toggle-track"></span>
          <span id="drip-toggle-knob" style="position:absolute;left:2px;top:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:.2s;pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.3);"></span>
        </div>
      </label>
    </div>
    <!-- ── DRIP POSTCARD DESIGNS ─────────────────────── -->'''

if old_drip_section_header in content:
    content = content.replace(old_drip_section_header, new_drip_toggle, 1)
    print("PATCH 1 OK: drip toggle HTML added to Settings")
else:
    print("PATCH 1 FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# PATCH 2: Load dripEnabled in openSettings
# ══════════════════════════════════════════════════════════════════════════════
old_load = "  [2,3,4].forEach(step=>{\n    const pcp=document.getElementById('pc'+step+'-preview');\n    const url=c['postcardStep'+step];\n    if(pcp)pcp.innerHTML=url?'<img src=\"'+url+'\" style=\"width:100%;height:100%;object-fit:cover;border-radius:5px;\">':'No design<br>uploaded';\n  });"
new_load = """  [2,3,4].forEach(step=>{
    const pcp=document.getElementById('pc'+step+'-preview');
    const url=c['postcardStep'+step];
    if(pcp)pcp.innerHTML=url?'<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">':'No design<br>uploaded';
  });
  // Load drip enabled toggle
  const dripCk = document.getElementById('s-drip-enabled');
  if(dripCk){ dripCk.checked = !!c.dripEnabled; updateDripToggleLabel(); }
  // Only admins can see the drip toggle section
  const dripToggleSec = document.getElementById('drip-toggle-section');
  if(dripToggleSec) dripToggleSec.style.display = isAdminOrAbove() ? 'flex' : 'none';"""

if old_load in content:
    content = content.replace(old_load, new_load, 1)
    print("PATCH 2 OK: dripEnabled loaded in openSettings")
else:
    print("PATCH 2 FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# PATCH 3: Save dripEnabled in saveSettings
# ══════════════════════════════════════════════════════════════════════════════
old_save_end = "    bookingUrl:document.getElementById('s-bookingurl').value||''\n  };"
new_save_end = """    bookingUrl:document.getElementById('s-bookingurl').value||'',
    dripEnabled: isAdminOrAbove() ? !!(document.getElementById('s-drip-enabled') && document.getElementById('s-drip-enabled').checked) : (S.cfg.dripEnabled||false)
  };"""

if old_save_end in content:
    content = content.replace(old_save_end, new_save_end, 1)
    print("PATCH 3 OK: dripEnabled saved in saveSettings")
else:
    print("PATCH 3 FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# PATCH 4: Add updateDripToggleLabel JS function + hide drip button when disabled
# Insert after the cancelDrip function
# ══════════════════════════════════════════════════════════════════════════════
old_cancel_drip_end = "  delete est.drip;\n  save(); renderEstimatesTab(); renderQueue();\n  toast('Drip sequence cancelled','info');\n}"
new_cancel_drip_end = """  delete est.drip;
  save(); renderEstimatesTab(); renderQueue();
  toast('Drip sequence cancelled','info');
}

// Toggle label + track color for the drip enabled switch
function updateDripToggleLabel(){
  const ck = document.getElementById('s-drip-enabled');
  const lbl = document.getElementById('drip-toggle-label');
  const track = document.getElementById('drip-toggle-track');
  const knob = document.getElementById('drip-toggle-knob');
  if(!ck) return;
  const on = ck.checked;
  if(lbl) lbl.textContent = on ? 'On' : 'Off';
  if(track) track.style.background = on ? 'var(--accent)' : 'var(--border)';
  if(knob) knob.style.left = on ? '22px' : '2px';
}"""

if old_cancel_drip_end in content:
    content = content.replace(old_cancel_drip_end, new_cancel_drip_end, 1)
    print("PATCH 4 OK: updateDripToggleLabel function added")
else:
    print("PATCH 4 FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# PATCH 5: Hide drip button in Estimates tab when dripEnabled is false
# Find the drip button render in renderEstimatesTab
# ══════════════════════════════════════════════════════════════════════════════
old_drip_btn = "onclick=\"openDripModal('"+'"'
# Use a different approach - find the drip button in estimates rendering
drip_btn_marker = "openDripModal('"
idx = content.find(drip_btn_marker)
if idx != -1:
    # Find the surrounding button element - look back for <button
    btn_start = content.rfind('<button', 0, idx)
    btn_end = content.find('</button>', idx) + len('</button>')
    old_btn_snippet = content[btn_start:btn_end]
    # Wrap it in a conditional
    new_btn_snippet = "'+( (S.cfg && S.cfg.dripEnabled) ? '"+old_btn_snippet+"' : '')+'";
    # Actually we need to handle this differently since it's in a template string
    # Let's find the exact pattern
    print(f"Found drip button at idx {idx}")
    print(repr(old_btn_snippet[:120]))
else:
    print("PATCH 5 FAIL: drip button not found")

# ══════════════════════════════════════════════════════════════════════════════
# PATCH 6: Add postcard thumbnail to Mail Queue drip rows
# ══════════════════════════════════════════════════════════════════════════════
old_queue_row_actions = (
    "      '<button class=\"btn-xs\" onclick=\"previewQueueItem(\\''+qid+'\\')\">"
    "&#128065; Preview</button>'+\n"
    "      '<button class=\"btn-xs danger\" onclick=\"rmQ(\\''+qid+'\\')\" title=\"Delete\">🗑 Delete</button>'+\n"
    "      '</td></tr>';"
)

# Let's find the exact queue row end
queue_preview_marker = "previewQueueItem"
idx2 = content.find(queue_preview_marker)
if idx2 != -1:
    print(f"Found previewQueueItem at idx {idx2}")
    print(repr(content[idx2-50:idx2+200]))
else:
    print("PATCH 6 FAIL: previewQueueItem not found")

with open('/home/ubuntu/biddrop/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("\nPartial patches written. Check output above.")
