#!/usr/bin/env python3
"""
Patch: Rebuild drip postcard system to use house photos + configurable messages
- Replace Settings "Upload Postcard Designs" with "Drip Follow-Up Messages" config
- Add buildDripPostcardFront() function that generates postcard front from house photo + message
- Update sendDripPostcard() to use generated front instead of uploaded image
- Update autoFireDueDripSteps() to not require uploaded postcard image
- Update refreshDripPostcardPreviews() to show house photo + message overlay
- Update previewPostcardFront() for drip steps to show generated front
- Update Estimates "Postcards" preview to show generated fronts
"""

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

original_size = len(html)

# ─────────────────────────────────────────────────────────────────────────────
# 1. Replace Settings "Drip Postcard Designs" section with "Drip Follow-Up Messages"
# ─────────────────────────────────────────────────────────────────────────────
OLD_SETTINGS_DRIP = '''    <!-- ── DRIP POSTCARD DESIGNS ─────────────────────── -->
    <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);margin:16px 0 10px;">Drip Postcard Designs <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);font-size:10px;">— Upload your own 6×4" front artwork for each follow-up step. We handle the address back.</span></div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:11px;color:var(--muted);margin-bottom:12px;">📬 Upload a 6×4" (1800×1200px recommended) JPEG or PNG for each drip step. Your company branding, design, and messaging — BidDrop automatically adds the homeowner's mailing address to the back.</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <!-- Step 2 postcard -->
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="background:#7C3AED;color:#fff;font-family:var(--font-h);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">STEP 2</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">Follow-Up Postcard <span style="font-size:11px;font-weight:400;color:var(--muted);">— Day 7</span></div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <div id="pc2-preview" style="width:120px;height:80px;background:var(--bg);border:2px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);overflow:hidden;flex-shrink:0;text-align:center;line-height:1.4;">No design<br>uploaded</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
            <label style="display:block;background:var(--card);border:2px solid var(--border);border-radius:7px;padding:8px 12px;text-align:center;cursor:pointer;color:var(--mid);font-size:11px;font-weight:600;">
              🖼 Upload Postcard Front (Step 2)
              <input type="file" accept="image/*" style="display:none;" onchange="handlePostcardUpload(this,2)">
            </label>
            <button onclick="clearPostcard(2)" style="background:none;border:none;color:var(--muted);font-size:10px;cursor:pointer;text-align:center;">✕ Remove</button>
          </div>
        </div>
      </div>
      <!-- Step 3 postcard -->
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="background:#7C3AED;color:#fff;font-family:var(--font-h);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">STEP 3</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">Urgency Postcard <span style="font-size:11px;font-weight:400;color:var(--muted);">— Day 14</span></div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <div id="pc3-preview" style="width:120px;height:80px;background:var(--bg);border:2px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);overflow:hidden;flex-shrink:0;text-align:center;line-height:1.4;">No design<br>uploaded</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
            <label style="display:block;background:var(--card);border:2px solid var(--border);border-radius:7px;padding:8px 12px;text-align:center;cursor:pointer;color:var(--mid);font-size:11px;font-weight:600;">
              🖼 Upload Postcard Front (Step 3)
              <input type="file" accept="image/*" style="display:none;" onchange="handlePostcardUpload(this,3)">
            </label>
            <button onclick="clearPostcard(3)" style="background:none;border:none;color:var(--muted);font-size:10px;cursor:pointer;text-align:center;">✕ Remove</button>
          </div>
        </div>
      </div>
      <!-- Step 4 postcard -->
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <div style="background:#7C3AED;color:#fff;font-family:var(--font-h);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">STEP 4</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">Final Postcard <span style="font-size:11px;font-weight:400;color:var(--muted);">— Day 35</span></div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <div id="pc4-preview" style="width:120px;height:80px;background:var(--bg);border:2px dashed var(--border);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);overflow:hidden;flex-shrink:0;text-align:center;line-height:1.4;">No design<br>uploaded</div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
            <label style="display:block;background:var(--card);border:2px solid var(--border);border-radius:7px;padding:8px 12px;text-align:center;cursor:pointer;color:var(--mid);font-size:11px;font-weight:600;">
              🖼 Upload Postcard Front (Step 4)
              <input type="file" accept="image/*" style="display:none;" onchange="handlePostcardUpload(this,4)">
            </label>
            <button onclick="clearPostcard(4)" style="background:none;border:none;color:var(--muted);font-size:10px;cursor:pointer;text-align:center;">✕ Remove</button>
          </div>
        </div>
      </div>
    </div>'''

NEW_SETTINGS_DRIP = '''    <!-- ── DRIP FOLLOW-UP MESSAGES ─────────────────────── -->
    <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);margin:16px 0 10px;">Drip Follow-Up Messages <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);font-size:10px;">— Each follow-up reuses the homeowner\'s house photo with your custom message overlaid. We handle the address back.</span></div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:11px;color:var(--muted);margin-bottom:12px;">&#128247; BidDrop automatically reuses the homeowner\'s actual house photo for every follow-up postcard — no design uploads needed. Just set the headline and subtext for each step below.</div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <!-- Step 2 message -->
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="background:#7C3AED;color:#fff;font-family:var(--font-h);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">STEP 2</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">Follow-Up Postcard <span style="font-size:11px;font-weight:400;color:var(--muted);">— Day 7</span></div>
        </div>
        <div class="frow">
          <div class="fg"><label class="fl">Headline</label><input class="fi" id="s-drip2-headline" placeholder="Still thinking it over?" maxlength="40"></div>
          <div class="fg"><label class="fl">Subtext</label><input class="fi" id="s-drip2-subtext" placeholder="Your estimate is still valid. We\'d love to help." maxlength="80"></div>
        </div>
      </div>
      <!-- Step 3 message -->
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="background:#7C3AED;color:#fff;font-family:var(--font-h);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">STEP 3</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">Urgency Postcard <span style="font-size:11px;font-weight:400;color:var(--muted);">— Day 14</span></div>
        </div>
        <div class="frow">
          <div class="fg"><label class="fl">Headline</label><input class="fi" id="s-drip3-headline" placeholder="Storm season is coming." maxlength="40"></div>
          <div class="fg"><label class="fl">Subtext</label><input class="fi" id="s-drip3-subtext" placeholder="Now\'s the time to protect your home. Call us today." maxlength="80"></div>
        </div>
      </div>
      <!-- Step 4 message -->
      <div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="background:#7C3AED;color:#fff;font-family:var(--font-h);font-size:11px;font-weight:700;padding:2px 9px;border-radius:20px;">STEP 4</div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">Final Postcard <span style="font-size:11px;font-weight:400;color:var(--muted);">— Day 35</span></div>
        </div>
        <div class="frow">
          <div class="fg"><label class="fl">Headline</label><input class="fi" id="s-drip4-headline" placeholder="Final notice." maxlength="40"></div>
          <div class="fg"><label class="fl">Subtext</label><input class="fi" id="s-drip4-subtext" placeholder="Your estimate expires soon. Secure your spot before prices rise." maxlength="80"></div>
        </div>
      </div>
    </div>'''

if OLD_SETTINGS_DRIP in html:
    html = html.replace(OLD_SETTINGS_DRIP, NEW_SETTINGS_DRIP, 1)
    print('  OK: Settings drip section replaced')
else:
    print('  MISSING: Settings drip section not found')

# ─────────────────────────────────────────────────────────────────────────────
# 2. Add drip message fields to saveSettings() — load from cfg
# ─────────────────────────────────────────────────────────────────────────────
OLD_LOAD_DRIP = "    const dripCk = document.getElementById('s-drip-enabled');\n    if(dripCk){ dripCk.checked = !!c.dripEnabled; updateDripToggleLabel(); }"
NEW_LOAD_DRIP = """    const dripCk = document.getElementById('s-drip-enabled');
    if(dripCk){ dripCk.checked = !!c.dripEnabled; updateDripToggleLabel(); }
    // Load drip message fields
    const dripFields = [
      ['s-drip2-headline','drip2Headline','Still thinking it over?'],
      ['s-drip2-subtext','drip2Subtext',"Your estimate is still valid. We'd love to help."],
      ['s-drip3-headline','drip3Headline','Storm season is coming.'],
      ['s-drip3-subtext','drip3Subtext',"Now's the time to protect your home. Call us today."],
      ['s-drip4-headline','drip4Headline','Final notice.'],
      ['s-drip4-subtext','drip4Subtext','Your estimate expires soon. Secure your spot before prices rise.'],
    ];
    dripFields.forEach(([id,key,def])=>{ const el=document.getElementById(id); if(el) el.value=c[key]||def; });"""

if OLD_LOAD_DRIP in html:
    html = html.replace(OLD_LOAD_DRIP, NEW_LOAD_DRIP, 1)
    print('  OK: Settings load drip messages')
else:
    print('  MISSING: Settings load drip messages')

# ─────────────────────────────────────────────────────────────────────────────
# 3. Add drip message fields to saveSettings() — save to cfg
# ─────────────────────────────────────────────────────────────────────────────
OLD_SAVE_DRIP = "    postcardStep2:S.cfg.postcardStep2||null,\n    postcardStep3:S.cfg.postcardStep3||null,\n    postcardStep4:S.cfg.postcardStep4||null,"
NEW_SAVE_DRIP = """    postcardStep2:S.cfg.postcardStep2||null,
    postcardStep3:S.cfg.postcardStep3||null,
    postcardStep4:S.cfg.postcardStep4||null,
    drip2Headline: (document.getElementById('s-drip2-headline')||{}).value || S.cfg.drip2Headline || 'Still thinking it over?',
    drip2Subtext:  (document.getElementById('s-drip2-subtext')||{}).value  || S.cfg.drip2Subtext  || "Your estimate is still valid. We'd love to help.",
    drip3Headline: (document.getElementById('s-drip3-headline')||{}).value || S.cfg.drip3Headline || 'Storm season is coming.',
    drip3Subtext:  (document.getElementById('s-drip3-subtext')||{}).value  || S.cfg.drip3Subtext  || "Now's the time to protect your home. Call us today.",
    drip4Headline: (document.getElementById('s-drip4-headline')||{}).value || S.cfg.drip4Headline || 'Final notice.',
    drip4Subtext:  (document.getElementById('s-drip4-subtext')||{}).value  || S.cfg.drip4Subtext  || 'Your estimate expires soon. Secure your spot before prices rise.',"""

if OLD_SAVE_DRIP in html:
    html = html.replace(OLD_SAVE_DRIP, NEW_SAVE_DRIP, 1)
    print('  OK: Settings save drip messages')
else:
    print('  MISSING: Settings save drip messages')

# ─────────────────────────────────────────────────────────────────────────────
# 4. Add drip message fields to DB save (accounts table cfg columns)
# ─────────────────────────────────────────────────────────────────────────────
OLD_DB_SAVE = "    postcard_step2: cfg.postcardStep2||null,\n    postcard_step3: cfg.postcardStep3||null,\n    postcard_step4: cfg.postcardStep4||null,"
NEW_DB_SAVE = """    postcard_step2: cfg.postcardStep2||null,
    postcard_step3: cfg.postcardStep3||null,
    postcard_step4: cfg.postcardStep4||null,
    drip2_headline: cfg.drip2Headline||null,
    drip2_subtext:  cfg.drip2Subtext||null,
    drip3_headline: cfg.drip3Headline||null,
    drip3_subtext:  cfg.drip3Subtext||null,
    drip4_headline: cfg.drip4Headline||null,
    drip4_subtext:  cfg.drip4Subtext||null,"""

if OLD_DB_SAVE in html:
    html = html.replace(OLD_DB_SAVE, NEW_DB_SAVE, 1)
    print('  OK: DB save drip messages')
else:
    print('  MISSING: DB save drip messages')

# ─────────────────────────────────────────────────────────────────────────────
# 5. Add drip message fields to DB load (accounts table cfg columns)
# ─────────────────────────────────────────────────────────────────────────────
OLD_DB_LOAD = "    postcardStep2: row.postcard_step2||null,\n    postcardStep3: row.postcard_step3||null,\n    postcardStep4: row.postcard_step4||null,"
NEW_DB_LOAD = """    postcardStep2: row.postcard_step2||null,
    postcardStep3: row.postcard_step3||null,
    postcardStep4: row.postcard_step4||null,
    drip2Headline: row.drip2_headline||null,
    drip2Subtext:  row.drip2_subtext||null,
    drip3Headline: row.drip3_headline||null,
    drip3Subtext:  row.drip3_subtext||null,
    drip4Headline: row.drip4_headline||null,
    drip4Subtext:  row.drip4_subtext||null,"""

if OLD_DB_LOAD in html:
    html = html.replace(OLD_DB_LOAD, NEW_DB_LOAD, 1)
    print('  OK: DB load drip messages')
else:
    print('  MISSING: DB load drip messages')

# ─────────────────────────────────────────────────────────────────────────────
# 6. Add buildDripPostcardFrontHtml() function — generates front HTML from house photo + message
#    Insert before refreshDripPostcardPreviews
# ─────────────────────────────────────────────────────────────────────────────
BUILD_DRIP_FN = '''// Build the drip postcard front as an HTML string using the house photo + step message
// Returns an HTML string suitable for Lob's front parameter
function buildDripPostcardFrontHtml({ photoUrl, headline, subtext, companyName, estimateTotal, address, phone, logoUrl }){
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtMoney = n => n ? '$'+Number(n).toLocaleString() : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:9in;height:6in;font-family:Arial,sans-serif;background:#111;overflow:hidden;position:relative;}
  .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.75;}
  .overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.15) 0%,rgba(0,0,0,.7) 100%);}
  .badge{position:absolute;top:5%;right:4%;background:var(--accent,#E8531A);color:#fff;font-size:9pt;font-weight:700;padding:4px 14px;border-radius:20px;letter-spacing:.5px;}
  .content{position:absolute;bottom:0;left:0;right:0;padding:5% 6% 6%;}
  .headline{font-size:28pt;font-weight:900;color:#fff;line-height:1.1;margin-bottom:8px;text-shadow:0 2px 8px rgba(0,0,0,.6);}
  .subtext{font-size:11pt;color:rgba(255,255,255,.88);line-height:1.4;margin-bottom:14px;text-shadow:0 1px 4px rgba(0,0,0,.5);}
  .info-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
  .pill{background:rgba(232,83,26,.92);color:#fff;font-size:9pt;font-weight:700;padding:4px 14px;border-radius:20px;}
  .pill.green{background:rgba(16,185,129,.9);}
  .addr{font-size:8.5pt;color:rgba(255,255,255,.75);}
  .logo-area{position:absolute;top:5%;left:4%;display:flex;align-items:center;gap:8px;}
  .logo-area img{max-height:36px;max-width:120px;object-fit:contain;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5));}
  .co-name{color:#fff;font-size:9pt;font-weight:700;text-shadow:0 1px 3px rgba(0,0,0,.5);}
  .phone{color:rgba(255,255,255,.8);font-size:8pt;}
</style>
</head>
<body>
  ${photoUrl ? `<img class="bg" src="${esc(photoUrl)}">` : '<div style="position:absolute;inset:0;background:linear-gradient(135deg,#1a1a2e,#16213e);"></div>'}
  <div class="overlay"></div>
  <div class="badge">YOUR ROOF ASSESSMENT IS READY</div>
  <div class="logo-area">
    ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(companyName)}">` : `<div class="co-name">${esc(companyName)}</div>`}
  </div>
  <div class="content">
    <div class="headline">${esc(headline)}</div>
    <div class="subtext">${esc(subtext)}</div>
    <div class="info-row">
      ${estimateTotal ? `<div class="pill">${fmtMoney(estimateTotal)} Estimate</div>` : ''}
      <div class="addr">${esc(address)}</div>
      ${phone ? `<div class="pill green">${esc(phone)}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

// Get the drip message config for a given step number (2, 3, 4)
function getDripStepMessage(step){
  const cfg = S.cfg || {};
  const defaults = {
    2: { headline: 'Still thinking it over?',           subtext: "Your estimate is still valid. We'd love to help." },
    3: { headline: 'Storm season is coming.',            subtext: "Now's the time to protect your home. Call us today." },
    4: { headline: 'Final notice.',                      subtext: 'Your estimate expires soon. Secure your spot before prices rise.' },
  };
  const d = defaults[step] || { headline: 'Follow-Up', subtext: '' };
  return {
    headline: cfg['drip'+step+'Headline'] || d.headline,
    subtext:  cfg['drip'+step+'Subtext']  || d.subtext,
  };
}

'''

if 'function refreshDripPostcardPreviews()' in html:
    html = html.replace('function refreshDripPostcardPreviews()', BUILD_DRIP_FN + 'function refreshDripPostcardPreviews()', 1)
    print('  OK: buildDripPostcardFrontHtml function added')
else:
    print('  MISSING: refreshDripPostcardPreviews not found')

# ─────────────────────────────────────────────────────────────────────────────
# 7. Replace refreshDripPostcardPreviews to show house photo + message overlay
# ─────────────────────────────────────────────────────────────────────────────
OLD_REFRESH = """function refreshDripPostcardPreviews(){
  const est = (S.estimates||[]).find(e=>e.id===_dripEstId) || {};
  const cfg = S.cfg || {};
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const toName      = est.owner || 'Homeowner';
  const toAddrShort = (est.addr||'').split(',').slice(0,2).join(',');
  const fromName    = cfg.companyName || 'Your Company';
  const fromAddr    = cfg.companyAddress || '1 Company Dr';
  [2,3,4].forEach(step=>{
    const url     = cfg['postcardStep'+step];
    const thumb   = document.getElementById('drip-pc'+step+'-thumb');
    const missing = document.getElementById('drip-pc'+step+'-missing');
    const img     = document.getElementById('drip-pc'+step+'-img');
    const backFrom= document.getElementById('drip-pc'+step+'-back-from');
    const backTo  = document.getElementById('drip-pc'+step+'-back-to');
    if(url){
      if(img) img.src = url;
      if(backFrom) backFrom.innerHTML = '<strong>'+fromName+'</strong><br>'+fromAddr;
      if(backTo)   backTo.innerHTML   = '<strong>'+toName+'</strong><br>'+toAddrShort;
      if(thumb) thumb.style.display = 'block';
      if(missing) missing.style.display = 'none';
    } else {
      if(thumb) thumb.style.display = 'none';
      if(missing) missing.style.display = 'block';
    }
  });
}"""

NEW_REFRESH = """function refreshDripPostcardPreviews(){
  const est = (S.estimates||[]).find(e=>e.id===_dripEstId) || {};
  const cfg = S.cfg || {};
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const photoUrl = est.photo_url || (pin && pin.photo_url) || est.photo_data || null;
  const toName      = est.owner || 'Homeowner';
  const toAddrShort = (est.addr||'').split(',').slice(0,2).join(',');
  const fromName    = cfg.companyName || 'Your Company';
  const fromAddr    = cfg.companyAddress || '1 Company Dr';
  [2,3,4].forEach(step=>{
    const msg     = getDripStepMessage(step);
    const thumb   = document.getElementById('drip-pc'+step+'-thumb');
    const missing = document.getElementById('drip-pc'+step+'-missing');
    const img     = document.getElementById('drip-pc'+step+'-img');
    const backFrom= document.getElementById('drip-pc'+step+'-back-from');
    const backTo  = document.getElementById('drip-pc'+step+'-back-to');
    const msgEl   = document.getElementById('drip-pc'+step+'-msg');
    // Always show the preview — use house photo if available, else show placeholder
    if(img) img.src = photoUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="%23111827"/><text x="150" y="90" text-anchor="middle" fill="%236B7280" font-size="14" font-family="Arial">House photo</text><text x="150" y="112" text-anchor="middle" fill="%236B7280" font-size="12" font-family="Arial">will appear here</text></svg>';
    if(backFrom) backFrom.innerHTML = '<strong>'+fromName+'</strong><br>'+fromAddr;
    if(backTo)   backTo.innerHTML   = '<strong>'+toName+'</strong><br>'+toAddrShort;
    if(msgEl)    msgEl.innerHTML    = '<strong style="display:block;font-size:10px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">'+escHtml(msg.headline)+'</strong><span style="font-size:9px;color:rgba(255,255,255,.8);text-shadow:0 1px 2px rgba(0,0,0,.6);">'+escHtml(msg.subtext)+'</span>';
    if(thumb) thumb.style.display = 'block';
    if(missing) missing.style.display = 'none';
  });
}"""

if OLD_REFRESH in html:
    html = html.replace(OLD_REFRESH, NEW_REFRESH, 1)
    print('  OK: refreshDripPostcardPreviews updated')
else:
    print('  MISSING: refreshDripPostcardPreviews not matched')

# ─────────────────────────────────────────────────────────────────────────────
# 8. Update the drip modal step cards to add message overlay on the thumbnail
#    Replace the drip-pc2-thumb div to include a message overlay element
# ─────────────────────────────────────────────────────────────────────────────
OLD_PC2_THUMB = '''        <div id="drip-pc2-thumb" style="margin-top:8px;display:none;">
          <img id="drip-pc2-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:zoom-in;" alt="Postcard front" onclick="previewPostcardFront(2)" title="Click to enlarge front">'''

NEW_PC2_THUMB = '''        <div id="drip-pc2-thumb" style="margin-top:8px;display:none;">
          <div style="position:relative;cursor:zoom-in;" onclick="previewDripFront(2)" title="Click to enlarge front">
            <img id="drip-pc2-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:5px;border:1px solid var(--border);display:block;" alt="Postcard front">
            <div id="drip-pc2-msg" style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.75));padding:4px 6px;border-radius:0 0 5px 5px;"></div>
          </div>'''

if OLD_PC2_THUMB in html:
    html = html.replace(OLD_PC2_THUMB, NEW_PC2_THUMB, 1)
    print('  OK: drip-pc2-thumb updated with message overlay')
else:
    print('  MISSING: drip-pc2-thumb not matched')

OLD_PC3_THUMB = '''        <div id="drip-pc3-thumb" style="margin-top:8px;display:none;">
          <img id="drip-pc3-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:zoom-in;" alt="Postcard front" onclick="previewPostcardFront(3)" title="Click to enlarge front">'''

NEW_PC3_THUMB = '''        <div id="drip-pc3-thumb" style="margin-top:8px;display:none;">
          <div style="position:relative;cursor:zoom-in;" onclick="previewDripFront(3)" title="Click to enlarge front">
            <img id="drip-pc3-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:5px;border:1px solid var(--border);display:block;" alt="Postcard front">
            <div id="drip-pc3-msg" style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.75));padding:4px 6px;border-radius:0 0 5px 5px;"></div>
          </div>'''

if OLD_PC3_THUMB in html:
    html = html.replace(OLD_PC3_THUMB, NEW_PC3_THUMB, 1)
    print('  OK: drip-pc3-thumb updated with message overlay')
else:
    print('  MISSING: drip-pc3-thumb not matched')

OLD_PC4_THUMB = '''        <div id="drip-pc4-thumb" style="margin-top:8px;display:none;">
          <img id="drip-pc4-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:zoom-in;" alt="Postcard front" onclick="previewPostcardFront(4)" title="Click to enlarge front">'''

NEW_PC4_THUMB = '''        <div id="drip-pc4-thumb" style="margin-top:8px;display:none;">
          <div style="position:relative;cursor:zoom-in;" onclick="previewDripFront(4)" title="Click to enlarge front">
            <img id="drip-pc4-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:5px;border:1px solid var(--border);display:block;" alt="Postcard front">
            <div id="drip-pc4-msg" style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.75));padding:4px 6px;border-radius:0 0 5px 5px;"></div>
          </div>'''

if OLD_PC4_THUMB in html:
    html = html.replace(OLD_PC4_THUMB, NEW_PC4_THUMB, 1)
    print('  OK: drip-pc4-thumb updated with message overlay')
else:
    print('  MISSING: drip-pc4-thumb not matched')

# ─────────────────────────────────────────────────────────────────────────────
# 9. Update the "missing" warning messages — no longer need to upload artwork
# ─────────────────────────────────────────────────────────────────────────────
OLD_MISSING2 = '''        <div id="drip-pc2-missing" style="margin-top:8px;background:rgba(124,58,237,.08);border:1px dashed rgba(124,58,237,.3);border-radius:5px;padding:6px 10px;font-size:10px;color:#C4B5FD;display:none;">⚠️ No postcard design uploaded yet — go to Settings → Drip Postcard Designs to upload your artwork.</div>'''
NEW_MISSING2 = '''        <div id="drip-pc2-missing" style="margin-top:8px;background:rgba(124,58,237,.08);border:1px dashed rgba(124,58,237,.3);border-radius:5px;padding:6px 10px;font-size:10px;color:#C4B5FD;display:none;">&#128247; House photo will be used automatically from this estimate.</div>'''

OLD_MISSING3 = '''        <div id="drip-pc3-missing" style="margin-top:8px;background:rgba(124,58,237,.08);border:1px dashed rgba(124,58,237,.3);border-radius:5px;padding:6px 10px;font-size:10px;color:#C4B5FD;display:none;">⚠️ No postcard design uploaded yet — go to Settings → Drip Postcard Designs to upload your artwork.</div>'''
NEW_MISSING3 = '''        <div id="drip-pc3-missing" style="margin-top:8px;background:rgba(124,58,237,.08);border:1px dashed rgba(124,58,237,.3);border-radius:5px;padding:6px 10px;font-size:10px;color:#C4B5FD;display:none;">&#128247; House photo will be used automatically from this estimate.</div>'''

html = html.replace(OLD_MISSING2, NEW_MISSING2, 1)
html = html.replace(OLD_MISSING3, NEW_MISSING3, 1)
print('  OK: Missing warnings updated')

# ─────────────────────────────────────────────────────────────────────────────
# 10. Add previewDripFront() function — shows lightbox with generated front
#     Replace the old previewPostcardFront function for drip steps
# ─────────────────────────────────────────────────────────────────────────────
PREVIEW_DRIP_FN = '''
// Preview the drip postcard front in a full-screen lightbox (uses house photo + message)
function previewDripFront(step){
  const est = (S.estimates||[]).find(e=>e.id===_dripEstId) || {};
  const cfg = S.cfg || {};
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const photoUrl = est.photo_url || (pin && pin.photo_url) || est.photo_data || null;
  const msg = getDripStepMessage(step);
  const stepNames = {2:'Step 2 — Follow-Up (Day 7)',3:'Step 3 — Urgency (Day 14)',4:'Step 4 — Final (Day 35)'};
  const label = stepNames[step] || 'Step '+step;
  const existing = document.getElementById('drip-front-lightbox');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'drip-front-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="width:100%;max-width:700px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="color:#fff;font-weight:700;font-size:14px;">&#128247; Postcard Front — ${label}</span>
        <button onclick="document.getElementById('drip-front-lightbox').remove()" style="background:none;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 12px;color:#fff;font-size:13px;cursor:pointer;">&#10005; Close</button>
      </div>
      <div style="position:relative;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.6);">
        ${photoUrl
          ? `<img src="${photoUrl}" style="width:100%;display:block;aspect-ratio:3/2;object-fit:cover;">`
          : '<div style="width:100%;aspect-ratio:3/2;background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;align-items:center;justify-content:center;color:#6B7280;font-size:14px;">House photo will appear here</div>'
        }
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.1) 0%,rgba(0,0,0,.65) 100%);"></div>
        <div style="position:absolute;top:5%;right:4%;background:#E8531A;color:#fff;font-size:9px;font-weight:700;padding:3px 12px;border-radius:20px;letter-spacing:.5px;">YOUR ROOF ASSESSMENT IS READY</div>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:5% 6% 6%;">
          <div style="font-size:clamp(18px,3.5vw,32px);font-weight:900;color:#fff;line-height:1.1;margin-bottom:8px;text-shadow:0 2px 8px rgba(0,0,0,.6);">${escHtml(msg.headline)}</div>
          <div style="font-size:clamp(10px,1.5vw,14px);color:rgba(255,255,255,.88);line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,.5);">${escHtml(msg.subtext)}</div>
          ${est.total ? `<div style="margin-top:10px;background:rgba(232,83,26,.9);color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;display:inline-block;">$${Number(est.total).toLocaleString()} Estimate</div>` : ''}
        </div>
      </div>
      <div style="text-align:center;margin-top:10px;color:rgba(255,255,255,.5);font-size:11px;">Actual print size: 6&#215;4&#8243; &bull; House photo + your message &bull; Click outside to close</div>
    </div>`;
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

'''

if 'function previewPostcardFront(step)' in html:
    html = html.replace('function previewPostcardFront(step)', PREVIEW_DRIP_FN + 'function previewPostcardFront(step)', 1)
    print('  OK: previewDripFront function added')
else:
    print('  MISSING: previewPostcardFront not found for insertion point')

# ─────────────────────────────────────────────────────────────────────────────
# 11. Update sendDripPostcard() to generate front from house photo + message
#     instead of using uploaded postcardStep image
# ─────────────────────────────────────────────────────────────────────────────
OLD_SEND_DRIP = """  const frontUrl = S.cfg['postcardStep'+item.drip_step];
  if(!frontUrl){ console.warn('[BidDrop] No postcard design for step', item.drip_step); return; }
  const backHtml = buildPostcardBack({"""

NEW_SEND_DRIP = """  // Generate the front HTML using house photo + configurable step message
  const msg = getDripStepMessage(item.drip_step);
  const frontHtml = buildDripPostcardFrontHtml({
    photoUrl: item.photo_url || item.photo_data || null,
    headline: msg.headline,
    subtext:  msg.subtext,
    companyName: co,
    estimateTotal: item.total || 0,
    address: item.addr || '',
    phone: S.cfg.companyPhone || '',
    logoUrl: S.cfg.logoData || '',
  });
  const backHtml = buildPostcardBack({"""

if OLD_SEND_DRIP in html:
    html = html.replace(OLD_SEND_DRIP, NEW_SEND_DRIP, 1)
    print('  OK: sendDripPostcard updated to use generated front')
else:
    print('  MISSING: sendDripPostcard front logic not matched')

# ─────────────────────────────────────────────────────────────────────────────
# 12. Update the Lob call in sendDripPostcard to use frontHtml instead of frontUrl
# ─────────────────────────────────────────────────────────────────────────────
OLD_LOB_FRONT = "      front: frontUrl,"
NEW_LOB_FRONT = "      front: frontHtml,"

# Only replace the one inside sendDripPostcard (there may be others)
# Find the context around it
if "front: frontUrl," in html:
    html = html.replace("      front: frontUrl,\n      back: backHtml,\n      size: '4x6',",
                        "      front: frontHtml,\n      back: backHtml,\n      size: '4x6',", 1)
    print('  OK: Lob call updated to use frontHtml')
else:
    print('  MISSING: Lob front: frontUrl not found')

# ─────────────────────────────────────────────────────────────────────────────
# 13. Update autoFireDueDripSteps to NOT require postcardStep uploaded image
# ─────────────────────────────────────────────────────────────────────────────
OLD_AUTO_FIRE = """  const due = (S.queue||[]).filter(q=>
    q.drip_step &&
    q.status === 'pending' &&
    q.scheduled_send_at &&
    new Date(q.scheduled_send_at) <= now &&
    S.cfg['postcardStep'+q.drip_step] // postcard design must be uploaded
  );"""

NEW_AUTO_FIRE = """  const due = (S.queue||[]).filter(q=>
    q.drip_step &&
    q.status === 'pending' &&
    q.scheduled_send_at &&
    new Date(q.scheduled_send_at) <= now
    // house photo is generated dynamically — no uploaded design required
  );"""

if OLD_AUTO_FIRE in html:
    html = html.replace(OLD_AUTO_FIRE, NEW_AUTO_FIRE, 1)
    print('  OK: autoFireDueDripSteps updated (no image upload required)')
else:
    print('  MISSING: autoFireDueDripSteps filter not matched')

# ─────────────────────────────────────────────────────────────────────────────
# 14. Update the Estimates "Postcards" preview (printQueuePreview) to show
#     generated drip fronts instead of uploaded images
# ─────────────────────────────────────────────────────────────────────────────
OLD_ESTIMATES_PREVIEW = """    const img = cfg['postcardStep'+s.num];
    const frontHtml = img
      ? `<div style="margin-bottom:8px;"><div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin-bottom:4px;">&#9650; FRONT</div><img src="${img}" style="width:100%;border-radius:6px;cursor:zoom-in;" onclick="previewPostcardFront(${s.num})" title="Click to enlarge"></div>`
      : `<div style="background:#1f2937;border:2px dashed #374151;border-radius:8px;padding:24px;text-align:center;color:#6B7280;font-size:12px;margin-bottom:8px;">No design uploaded<br><span style="font-size:10px;">Settings &#8594; Drip Postcard Designs</span></div>`;"""

NEW_ESTIMATES_PREVIEW = """    const msg = getDripStepMessage(s.num);
    const photoUrl = est.photo_url || (pin && pin.photo_url) || est.photo_data || null;
    const frontHtml = `<div style="margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin-bottom:4px;">&#9650; FRONT</div>
      <div style="position:relative;border-radius:6px;overflow:hidden;cursor:zoom-in;" onclick="previewDripFrontFromEstimate(${s.num},'${est.id||''}')" title="Click to enlarge">
        ${photoUrl
          ? `<img src="${photoUrl}" style="width:100%;display:block;aspect-ratio:3/2;object-fit:cover;">`
          : '<div style="width:100%;aspect-ratio:3/2;background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;align-items:center;justify-content:center;color:#6B7280;font-size:11px;">House photo here</div>'
        }
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.7) 100%);"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 8px;">
          <div style="font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">${escHtml(msg.headline)}</div>
          <div style="font-size:8px;color:rgba(255,255,255,.8);">${escHtml(msg.subtext)}</div>
        </div>
      </div>
    </div>`;"""

if OLD_ESTIMATES_PREVIEW in html:
    html = html.replace(OLD_ESTIMATES_PREVIEW, NEW_ESTIMATES_PREVIEW, 1)
    print('  OK: Estimates postcards preview updated')
else:
    print('  MISSING: Estimates postcards preview not matched')

# ─────────────────────────────────────────────────────────────────────────────
# 15. Add previewDripFrontFromEstimate helper for the Estimates preview
# ─────────────────────────────────────────────────────────────────────────────
PREVIEW_FROM_EST_FN = '''
// Preview drip front from the Estimates "Postcards" modal (no _dripEstId context)
function previewDripFrontFromEstimate(step, estId){
  const origId = _dripEstId;
  _dripEstId = estId;
  previewDripFront(step);
  _dripEstId = origId;
}

'''

if 'function previewDripFront(step)' in html:
    # Insert after previewDripFront function — find the closing brace
    idx = html.find('function previewDripFront(step)')
    # Find the end of this function by counting braces
    depth = 0
    i = idx
    started = False
    while i < len(html):
        if html[i] == '{':
            depth += 1
            started = True
        elif html[i] == '}':
            depth -= 1
            if started and depth == 0:
                i += 1
                break
        i += 1
    html = html[:i] + PREVIEW_FROM_EST_FN + html[i:]
    print('  OK: previewDripFrontFromEstimate helper added')
else:
    print('  MISSING: previewDripFront not found for helper insertion')

# ─────────────────────────────────────────────────────────────────────────────
# Write output
# ─────────────────────────────────────────────────────────────────────────────
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print(f'\nDone. File size: {original_size} -> {len(html)} chars ({len(html)-original_size:+d})')
