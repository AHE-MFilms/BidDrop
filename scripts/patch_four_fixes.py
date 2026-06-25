#!/usr/bin/env python3
"""Patch script for four BidDrop UI fixes."""

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

original = html

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: Postcard preview auto-refresh on photo upload
# After handleHomePhoto stores the photo and calls updatePreview(), also
# explicitly call _refreshPostcardPreview() if in postcard mode.
# ─────────────────────────────────────────────────────────────────────────────

# In the URL upload success path
old1a = "      updatePreview();toast('\U0001f4f7 Photo added to mailer!','success');"
new1a = "      updatePreview();\n      if(window._previewMode==='postcard') _refreshPostcardPreview();\n      toast('\U0001f4f7 Photo added to mailer!','success');"
if old1a in html:
    html = html.replace(old1a, new1a, 1)
    print("FIX 1a applied: postcard refresh on URL photo upload")
else:
    print("FIX 1a NOT FOUND - searching for alternative...")
    # Try without the emoji
    idx = html.find("updatePreview();toast('")
    if idx > 0:
        ctx = html[idx-200:idx+100]
        print("Context:", ctx)

# In the base64 fallback path
old1b = "          updatePreview();toast('\U0001f4f7 Photo added (local)','info');"
new1b = "          updatePreview();\n          if(window._previewMode==='postcard') _refreshPostcardPreview();\n          toast('\U0001f4f7 Photo added (local)','info');"
if old1b in html:
    html = html.replace(old1b, new1b, 1)
    print("FIX 1b applied: postcard refresh on base64 photo upload")
else:
    print("FIX 1b NOT FOUND")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Settings tab - add to desktop nav and fix blank panel issue
# ─────────────────────────────────────────────────────────────────────────────

# Add Settings tab button to desktop nav (after Canvass Areas)
old2 = '    <button class="tab-btn" id="zones-tab-btn" onclick="goTab(\'zones\')" data-tab="zones">\U0001f5c2 Canvass Areas</button>\n  </div>'
new2 = '    <button class="tab-btn" id="zones-tab-btn" onclick="goTab(\'zones\')" data-tab="zones">\U0001f5c2 Canvass Areas</button>\n    <button class="tab-btn" id="settings-tab-btn" onclick="goTab(\'settings\')" data-tab="settings">\u2699\ufe0f Settings</button>\n  </div>'
if old2 in html:
    html = html.replace(old2, new2, 1)
    print("FIX 2a applied: Settings tab added to desktop nav")
else:
    print("FIX 2a NOT FOUND - trying alternative...")
    # Try without the emoji
    old2b = '    <button class="tab-btn" id="zones-tab-btn" onclick="goTab(\'zones\')" data-tab="zones">'
    idx = html.find(old2b)
    if idx >= 0:
        # Find the end of this button and the closing </div>
        end_idx = html.find('</div>', idx)
        if end_idx >= 0:
            # Check if next line after button closes the div
            btn_end = html.find('</button>', idx) + len('</button>')
            between = html[btn_end:end_idx].strip()
            print(f"Between button end and div close: '{between}'")
            print(f"Context: {html[idx:end_idx+10]}")

# Fix the mobile bottom nav - replace openSettings() with goTab('settings')
old2c = '  <button class="bnav-btn" onclick="openSettings()"><span class="bicon">\u2699\ufe0f</span>Settings</button>'
new2c = '  <button class="bnav-btn" id="settings-bnav-btn" onclick="goTab(\'settings\')" data-tab="settings"><span class="bicon">\u2699\ufe0f</span>Settings</button>'
if old2c in html:
    html = html.replace(old2c, new2c, 1)
    print("FIX 2b applied: Mobile bottom nav Settings button fixed")
else:
    print("FIX 2b NOT FOUND")

# Fix the tab-settings pane - add display:flex and ensure it's properly styled
old2d = '  <div class="tab-pane" id="tab-settings" style="flex-direction:column;overflow-y:auto;">'
new2d = '  <div class="tab-pane" id="tab-settings" style="flex-direction:column;overflow-y:auto;padding:0;">'
if old2d in html:
    html = html.replace(old2d, new2d, 1)
    print("FIX 2c applied: tab-settings pane style fixed")
else:
    print("FIX 2c NOT FOUND")

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Drip postcards use same 6x9 format as main postcard
# Replace buildDripPostcardFrontHtml to use the same layout as buildPostcard6x9FrontHtml
# but with configurable headline/subtext instead of "We Assessed Your Roof."
# ─────────────────────────────────────────────────────────────────────────────

old3 = '''function buildDripPostcardFrontHtml({ photoUrl, headline, subtext, companyName, estimateTotal, address, phone, logoUrl }){
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
}'''

new3 = '''function buildDripPostcardFrontHtml({ photoUrl, headline, subtext, companyName, estimateTotal, address, phone, logoUrl }){
  // Use the same 864x576 (6x9) format as the main postcard for visual consistency
  const cfg   = S.cfg || {};
  const color = cfg.brandColor || '#F25C05';
  const co    = companyName || cfg.companyName || 'Your Roofing Co';
  const ph    = phone || cfg.companyPhone || '(000) 000-0000';
  const total = estimateTotal || 0;
  const escH  = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  // Parse address for short display
  const parts = (address||'').split(',');
  const shortAddr = parts[0] ? parts[0].trim() : (address||'');
  const cityState = parts.slice(1,3).map(s=>s.trim()).join(', ');
  const photoStyle = photoUrl
    ? `background-image:url('${escH(photoUrl)}');background-size:cover;background-position:center;`
    : `background:#1a2333;`;
  // Financing
  const finEnabled = cfg.financingEnabled !== false;
  const finApr  = parseFloat(cfg.financingApr)  || 9.99;
  const finTerm = parseInt(cfg.financingTerm)   || 60;
  const finDown = parseFloat(cfg.financingDown) || 0;
  let finMo = 0;
  if(finEnabled && total){
    const loan = total * (1 - finDown/100);
    const r = finApr / 100 / 12;
    finMo = r===0 ? Math.round(loan/finTerm) : Math.round(loan * r * Math.pow(1+r,finTerm) / (Math.pow(1+r,finTerm)-1));
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=864">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;position:relative;}
  .photo-bg{position:absolute;inset:0;${photoStyle}}
  .photo-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.25) 0%,rgba(0,0,0,.1) 40%,rgba(0,0,0,.65) 75%,rgba(0,0,0,.85) 100%);}
  .content{position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:34px 38px;}
  .top-bar{display:flex;justify-content:space-between;align-items:flex-start;}
  .logo-wrap img{max-height:53px;max-width:192px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6));}
  .logo-wrap .co-name{font-size:22px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);letter-spacing:1px;}
  .badge{background:${color};color:#fff;font-size:13px;font-weight:800;padding:8px 18px;border-radius:30px;letter-spacing:.5px;text-transform:uppercase;box-shadow:0 3px 12px rgba(0,0,0,.4);white-space:nowrap;}
  .bottom{}
  .headline{font-size:38px;font-weight:900;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.8);line-height:1.1;margin-bottom:10px;letter-spacing:-0.5px;}
  .subtext-line{font-size:16px;color:rgba(255,255,255,.9);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:14px;font-weight:500;line-height:1.4;}
  .addr-line{font-size:16px;color:rgba(255,255,255,.85);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:14px;font-weight:600;}
  .price-strip{background:${color};display:inline-flex;align-items:center;gap:20px;padding:12px 24px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.5);}
  .price-main{font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;}
  .price-label{font-size:11px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.5px;line-height:1.3;}
  .price-divider{width:1px;height:36px;background:rgba(255,255,255,.3);}
  .phone-line{margin-top:14px;font-size:16px;color:rgba(255,255,255,.85);font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.6);letter-spacing:.3px;}
</style>
</head>
<body>
  <div class="photo-bg"></div>
  <div class="content">
    <div class="top-bar">
      <div class="logo-wrap">
        ${logoUrl ? `<img src="${escH(logoUrl)}" alt="${escH(co)}">` : `<div class="co-name">${escH(co)}</div>`}
      </div>
      <div class="badge">Follow-Up</div>
    </div>
    <div class="bottom">
      <div class="headline">${escH(headline)}</div>
      <div class="subtext-line">${escH(subtext)}</div>
      <div class="addr-line">&#128205; ${escH(shortAddr)}${cityState ? ', '+escH(cityState) : ''}</div>
      ${total ? `<div class="price-strip">
        <div>
          <div class="price-label">Your Estimate</div>
          <div class="price-main">$${Number(total).toLocaleString()}</div>
        </div>
        ${finMo ? `<div class="price-divider"></div><div><div class="price-label">As Low As</div><div class="price-main">$${finMo.toLocaleString()}<span style="font-size:16px;font-weight:600;">/mo</span></div></div>` : ''}
      </div>` : ''}
      <div class="phone-line">&#128222; ${escH(ph)}</div>
    </div>
  </div>
</body>
</html>`;
}'''

if old3 in html:
    html = html.replace(old3, new3, 1)
    print("FIX 3 applied: drip postcard front now uses 6x9 format matching main postcard")
else:
    print("FIX 3 NOT FOUND - checking partial match...")
    if 'function buildDripPostcardFrontHtml' in html:
        idx = html.find('function buildDripPostcardFrontHtml')
        print(f"Function found at line approx {html[:idx].count(chr(10))+1}")
        print("First 200 chars:", html[idx:idx+200])

# ─────────────────────────────────────────────────────────────────────────────
# Write result
# ─────────────────────────────────────────────────────────────────────────────
if html != original:
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("\nAll changes written to index.html")
else:
    print("\nWARNING: No changes were made!")
