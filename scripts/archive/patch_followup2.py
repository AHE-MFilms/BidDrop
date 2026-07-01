with open('/home/ubuntu/biddrop/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ── Find and replace the entire Follow-Up tab pane ──────────────────────────
start_marker = '  <!-- FOLLOW-UP MAIL -->'
end_marker   = '\n  <!-- CANVASS AREAS -->'

start_idx = content.index(start_marker)
end_idx   = content.index(end_marker)

old_tab = content[start_idx:end_idx]

# New design: 3-column grid of postcard cards, each card shows front + back stacked
new_tab = '''  <!-- FOLLOW-UP MAIL -->
  <div class="tab-pane" id="tab-followup" style="flex-direction:column;overflow-y:auto;padding:24px;gap:24px;">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
      <div>
        <div style="font-family:var(--font-h);font-size:20px;font-weight:700;color:var(--text);">📮 Drip Postcard Designs</div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px;">Each postcard below will be mailed automatically on its scheduled day. Upload your artwork in Settings.</div>
      </div>
      <button onclick="openSettings()" style="background:var(--accent);border:none;border-radius:8px;padding:9px 18px;color:#fff;font-family:var(--font-h);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">⚙️ Upload Designs</button>
    </div>

    <!-- 3-column postcard grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;align-items:start;">

      <!-- STEP 2 -->
      <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border);background:var(--card);">
        <div style="background:#7C3AED;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;">Step 2 — Day 7</div>
          <div style="color:rgba(255,255,255,.7);font-size:11px;">Follow-Up</div>
        </div>
        <!-- Front -->
        <div style="padding:12px;border-bottom:1px solid var(--border);">
          <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">▲ FRONT</div>
          <div id="fu-pc2-front" style="width:100%;border-radius:6px;background:var(--card2);border:1px solid var(--border);min-height:120px;display:flex;align-items:center;justify-content:center;">
            <div style="text-align:center;padding:16px;color:var(--muted);font-size:11px;">📭 No design yet<br><button onclick="openSettings()" style="margin-top:8px;background:var(--accent);border:none;border-radius:6px;padding:6px 14px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Upload</button></div>
          </div>
        </div>
        <!-- Back -->
        <div style="padding:12px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">▼ BACK (Auto-Generated)</div>
          <div id="fu-pc2-back" style="width:100%;border-radius:6px;border:1px solid #ddd;background:#fff;min-height:120px;"></div>
        </div>
      </div>

      <!-- STEP 3 -->
      <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border);background:var(--card);">
        <div style="background:#7C3AED;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;">Step 3 — Day 14</div>
          <div style="color:rgba(255,255,255,.7);font-size:11px;">Urgency</div>
        </div>
        <!-- Front -->
        <div style="padding:12px;border-bottom:1px solid var(--border);">
          <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">▲ FRONT</div>
          <div id="fu-pc3-front" style="width:100%;border-radius:6px;background:var(--card2);border:1px solid var(--border);min-height:120px;display:flex;align-items:center;justify-content:center;">
            <div style="text-align:center;padding:16px;color:var(--muted);font-size:11px;">📭 No design yet<br><button onclick="openSettings()" style="margin-top:8px;background:var(--accent);border:none;border-radius:6px;padding:6px 14px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Upload</button></div>
          </div>
        </div>
        <!-- Back -->
        <div style="padding:12px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">▼ BACK (Auto-Generated)</div>
          <div id="fu-pc3-back" style="width:100%;border-radius:6px;border:1px solid #ddd;background:#fff;min-height:120px;"></div>
        </div>
      </div>

      <!-- STEP 4 -->
      <div style="border-radius:12px;overflow:hidden;border:1px solid var(--border);background:var(--card);">
        <div style="background:#7C3AED;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;">
          <div style="color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;">Step 4 — Day 35</div>
          <div style="color:rgba(255,255,255,.7);font-size:11px;">Final</div>
        </div>
        <!-- Front -->
        <div style="padding:12px;border-bottom:1px solid var(--border);">
          <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">▲ FRONT</div>
          <div id="fu-pc4-front" style="width:100%;border-radius:6px;background:var(--card2);border:1px solid var(--border);min-height:120px;display:flex;align-items:center;justify-content:center;">
            <div style="text-align:center;padding:16px;color:var(--muted);font-size:11px;">📭 No design yet<br><button onclick="openSettings()" style="margin-top:8px;background:var(--accent);border:none;border-radius:6px;padding:6px 14px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Upload</button></div>
          </div>
        </div>
        <!-- Back -->
        <div style="padding:12px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;">▼ BACK (Auto-Generated)</div>
          <div id="fu-pc4-back" style="width:100%;border-radius:6px;border:1px solid #ddd;background:#fff;min-height:120px;"></div>
        </div>
      </div>

    </div><!-- /grid -->
  </div>'''

content = content[:start_idx] + new_tab + content[end_idx:]
print("PATCH 1 OK: tab HTML replaced with 3-column grid")

# ── Fix renderFollowUpTab JS to set image correctly ──────────────────────────
old_render = (
    "    // Front side\n"
    "    if(url){\n"
    "      frontEl.style.display = 'block';\n"
    "      frontEl.style.overflow = 'visible';\n"
    "      frontEl.innerHTML = '<img src=\"'+url+'\" style=\"width:100%;height:auto;display:block;border-radius:6px;\">';\n"
    "    } else {"
)
new_render = (
    "    // Front side\n"
    "    if(url){\n"
    "      frontEl.style.display = 'block';\n"
    "      frontEl.style.minHeight = 'unset';\n"
    "      frontEl.innerHTML = '<img src=\"'+url+'\" style=\"width:100%;height:auto;display:block;border-radius:5px;\">';\n"
    "    } else {"
)
if old_render in content:
    content = content.replace(old_render, new_render, 1)
    print("PATCH 2 OK: renderFollowUpTab front fixed")
else:
    print("PATCH 2 FAIL")

# ── Fix buildPostcardBackInline to use a compact but complete layout ──────────
old_back_start = '  <div style="display:flex;font-family:Arial,sans-serif;font-size:12px;background:#fff;padding:20px;gap:20px;box-sizing:border-box;min-height:180px;">'
new_back = '''  <div style="display:flex;font-family:Arial,sans-serif;background:#fff;padding:14px 16px;gap:14px;box-sizing:border-box;min-height:120px;border-radius:5px;">
    <div style="flex:1.3;display:flex;flex-direction:column;gap:6px;border-right:1px dashed #ccc;padding-right:14px;">
      ${logoUrl ? '<img src="'+logoUrl+'" style="max-width:90px;max-height:32px;object-fit:contain;display:block;margin-bottom:4px;">' : ''}
      <div style="font-weight:700;font-size:10px;color:#111;">${fromName}</div>
      <div style="color:#666;font-size:9px;line-height:1.5;">${fromAddr}${fromCity ? '<br>'+fromCity : ''}${fromPhone ? '<br>'+fromPhone : ''}</div>
      <div style="margin-top:auto;padding-top:8px;font-size:6px;color:#ccc;letter-spacing:2px;text-align:center;">|||||||||||||||||||||||||||||||||</div>
    </div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:8px;">
      <div style="align-self:flex-end;border:1px solid #333;padding:4px 7px;text-align:center;font-size:7px;color:#333;line-height:1.5;">
        <strong style="display:block;font-size:9px;">PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000
      </div>
      <div style="font-size:10px;line-height:1.7;color:#111;">
        <div style="font-weight:700;font-size:11px;">Homeowner Name</div>
        <div style="border-top:1px solid #eee;margin:3px 0;"></div>
        <div>123 Main Street</div>
        <div>City, State 00000</div>
      </div>
      <div style="font-size:6px;color:#ccc;letter-spacing:1px;text-align:center;">DELIVERY POINT BARCODE</div>
    </div>
  </div>'''

if old_back_start in content:
    # Find the full old back block
    back_start = content.index(old_back_start)
    back_end = content.index('`;\n}\n\nfunction populateEstPinPicker', back_start)
    old_back_block = content[back_start:back_end]
    content = content[:back_start] + new_back + content[back_end:]
    print("PATCH 3 OK: buildPostcardBackInline replaced")
else:
    print("PATCH 3 FAIL")

with open('/home/ubuntu/biddrop/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("ALL DONE")
