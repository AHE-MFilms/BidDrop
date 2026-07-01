#!/usr/bin/env python3
"""
Patch script:
1. Fix Settings tab vertical offset (content pushed down with blank space above)
2. Fix drip postcard previews to use proper 6x9 iframe format (same as main postcard)
"""

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: Settings tab - add justify-content:flex-start so content starts at top
# ─────────────────────────────────────────────────────────────────────────────
old_settings_pane = '<div class="tab-pane" id="tab-settings" style="flex-direction:column;overflow-y:auto;padding:0;">'
new_settings_pane = '<div class="tab-pane" id="tab-settings" style="flex-direction:column;overflow-y:auto;padding:0;justify-content:flex-start;align-items:stretch;">'

if old_settings_pane in html:
    html = html.replace(old_settings_pane, new_settings_pane, 1)
    print('FIX 1 applied: Settings tab vertical offset fixed')
else:
    print('FIX 1 SKIPPED: settings pane pattern not found')

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Drip postcard preview in Estimates modal - replace simple img overlay
#         with proper scaled iframe matching the 6x9 main postcard format
# ─────────────────────────────────────────────────────────────────────────────
# The current front HTML in the estimates postcards modal uses a simple img tag.
# Replace the frontHtml generation to use a scaled iframe with buildDripPostcardFrontHtml

old_front_html = '''    const frontHtml = `<div style="margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin-bottom:4px;">&#9650; FRONT</div>
      <div style="position:relative;border-radius:6px;overflow:hidden;cursor:zoom-in;" onclick="previewDripFrontFromEstimate(${s.num},\'${estId}\')" title="Click to enlarge">
        ${photoUrl
          ? `<img src="${photoUrl}" style="width:100%;display:block;aspect-ratio:3/2;object-fit:cover;">`
          : \'<div style="width:100%;aspect-ratio:3/2;background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;align-items:center;justify-content:center;color:#6B7280;font-size:11px;">House photo here</div>\'
        }
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.7) 100%);"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 8px;">
          <div style="font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">${escHtml(msg.headline)}</div>
          <div style="font-size:8px;color:rgba(255,255,255,.8);">${escHtml(msg.subtext)}</div>
        </div>
      </div>
    </div>`;'''

new_front_html = '''    const _dripFrontHtml = buildDripPostcardFrontHtml({
      photoUrl, headline: msg.headline, subtext: msg.subtext,
      companyName: fromName, companyAddress: fromAddr, phone: fromPhone,
      logoUrl, repHeadshot: cfg.repHeadshot||'', repName: cfg.repName||'',
      total: est.total||0, finMo: est.finMo||0
    });
    const _dripScale = 0.33;
    const _dripW = Math.round(864 * _dripScale);
    const _dripH = Math.round(576 * _dripScale);
    const frontHtml = `<div style="margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin-bottom:4px;">&#9650; FRONT</div>
      <div style="position:relative;border-radius:6px;overflow:hidden;cursor:zoom-in;width:${_dripW}px;height:${_dripH}px;margin:0 auto;" onclick="previewDripFrontFromEstimate(${s.num},\'${estId}\')" title="Click to enlarge — 6x9 Postcard">
        <iframe srcdoc="${_dripFrontHtml.replace(/"/g,\'&quot;\').replace(/\`/g,\'&#96;\')}"
          style="width:864px;height:576px;border:none;transform:scale(${_dripScale});transform-origin:top left;pointer-events:none;"
          scrolling="no"></iframe>
      </div>
      <div style="text-align:center;font-size:9px;color:#6B7280;margin-top:2px;">Click front to enlarge</div>
    </div>`;'''

if old_front_html in html:
    html = html.replace(old_front_html, new_front_html, 1)
    print('FIX 2 applied: Drip postcard preview now uses proper 6x9 iframe format')
else:
    # Try a shorter match on just the key part
    short_old = '      <div style="position:relative;border-radius:6px;overflow:hidden;cursor:zoom-in;" onclick="previewDripFrontFromEstimate(${s.num},\'${estId}\')" title="Click to enlarge">'
    if short_old in html:
        print('FIX 2: Found partial match - using line-based replacement')
        lines = html.split('\n')
        start_line = None
        end_line = None
        for i, line in enumerate(lines):
            if 'const frontHtml = `<div style="margin-bottom:8px;">' in line:
                start_line = i
            if start_line is not None and '    </div>`;' in line and i > start_line:
                end_line = i
                break
        if start_line and end_line:
            lines[start_line:end_line+1] = new_front_html.split('\n')
            html = '\n'.join(lines)
            print('FIX 2 applied via line-based replacement')
        else:
            print('FIX 2 FAILED: could not find line range')
    else:
        print('FIX 2 SKIPPED: pattern not found')

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Also fix the drip modal (m-drip) thumbnail previews to use iframes
#         The drip-pc2/3/4-thumb currently use <img> tags - replace with iframe
# ─────────────────────────────────────────────────────────────────────────────
# Update refreshDripPostcardPreviews to inject iframe HTML instead of setting img.src

old_refresh = '''  [2,3,4].forEach(step=>{
    const msg     = getDripStepMessage(step);
    const thumb   = document.getElementById('drip-pc'+step+'-thumb');
    const missing = document.getElementById('drip-pc'+step+'-missing');
    const img     = document.getElementById('drip-pc'+step+'-img');
    const backFrom= document.getElementById('drip-pc'+step+'-back-from');
    const backTo  = document.getElementById('drip-pc'+step+'-back-to');
    const msgEl   = document.getElementById('drip-pc'+step+'-msg');
    if(img) img.src = photoUrl || placeholder;
    if(backFrom) backFrom.innerHTML = '<strong>'+fromName+'</strong><br>'+fromAddr;
    if(backTo)   backTo.innerHTML   = '<strong>'+toName+'</strong><br>'+toAddrShort;
    if(msgEl)    msgEl.innerHTML    = '<strong style="display:block;font-size:10px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);">'+escHtml(msg.headline)+'</strong><span style="font-size:9px;color:rgba(255,255,255,.8);text-shadow:0 1px 2px rgba(0,0,0,.6);">'+escHtml(msg.subtext)+'</span>';
    if(thumb) thumb.style.display = 'block';
    if(missing) missing.style.display = 'none';
  });'''

new_refresh = '''  [2,3,4].forEach(step=>{
    const msg     = getDripStepMessage(step);
    const thumb   = document.getElementById('drip-pc'+step+'-thumb');
    const missing = document.getElementById('drip-pc'+step+'-missing');
    const frontWrap = document.getElementById('drip-pc'+step+'-front-wrap');
    const backFrom= document.getElementById('drip-pc'+step+'-back-from');
    const backTo  = document.getElementById('drip-pc'+step+'-back-to');
    // Build proper 6x9 iframe front
    const frontHtml = buildDripPostcardFrontHtml({
      photoUrl: photoUrl||null, headline: msg.headline, subtext: msg.subtext,
      companyName: fromName, companyAddress: fromAddr, phone: cfg.phone||'',
      logoUrl: cfg.logoData||'', repHeadshot: cfg.repHeadshot||'', repName: cfg.repName||'',
      total: est.total||0, finMo: est.finMo||0
    });
    const scale = 0.22;
    const fw = Math.round(864*scale), fh = Math.round(576*scale);
    if(frontWrap) frontWrap.innerHTML = `<iframe srcdoc="${frontHtml.replace(/"/g,'&quot;').replace(/\`/g,'&#96;')}"
      style="width:864px;height:576px;border:none;transform:scale(${scale});transform-origin:top left;pointer-events:none;"
      scrolling="no"></iframe>`;
    if(frontWrap) { frontWrap.style.width=fw+'px'; frontWrap.style.height=fh+'px'; frontWrap.style.overflow='hidden'; frontWrap.style.borderRadius='5px'; }
    if(backFrom) backFrom.innerHTML = '<strong>'+fromName+'</strong><br>'+fromAddr;
    if(backTo)   backTo.innerHTML   = '<strong>'+toName+'</strong><br>'+toAddrShort;
    if(thumb) thumb.style.display = 'block';
    if(missing) missing.style.display = 'none';
  });'''

if old_refresh in html:
    html = html.replace(old_refresh, new_refresh, 1)
    print('FIX 3 applied: Drip modal thumbnails now use iframe format')
else:
    print('FIX 3 SKIPPED: refresh pattern not found')

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4: Update the drip-pc2/3/4-thumb HTML to use a front-wrap div instead of img
# ─────────────────────────────────────────────────────────────────────────────
for step in [2, 3, 4]:
    old_img_wrap = f'''          <div style="position:relative;cursor:zoom-in;" onclick="previewDripFront({step})" title="Click to enlarge front">
            <img id="drip-pc{step}-img" style="width:100%;max-height:80px;object-fit:cover;border-radius:5px;border:1px solid var(--border);display:block;" alt="Postcard front">
            <div id="drip-pc{step}-msg" style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.75));padding:4px 6px;border-radius:0 0 5px 5px;"></div>
          </div>'''
    new_img_wrap = f'''          <div style="cursor:zoom-in;" onclick="previewDripFront({step})" title="Click to enlarge — 6x9 Postcard">
            <div id="drip-pc{step}-front-wrap" style="overflow:hidden;border-radius:5px;border:1px solid var(--border);"></div>
          </div>'''
    if old_img_wrap in html:
        html = html.replace(old_img_wrap, new_img_wrap, 1)
        print(f'FIX 4 applied: drip-pc{step} img replaced with front-wrap div')
    else:
        print(f'FIX 4 SKIPPED: drip-pc{step} img pattern not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('All changes written to index.html')
