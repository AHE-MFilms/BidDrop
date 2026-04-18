#!/usr/bin/env python3
"""
Final fixes:
1. Settings tab - content starts at top (no blank space)
2. Drip postcard iframes fit inside their container cards
"""

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: Settings tab blank space
# The issue: .tab-pane.active{display:flex} makes the pane a flex container.
# With flex-direction:column and no justify-content, it defaults to stretch,
# causing the inner div to be pushed to vertical center.
# Solution: Add a CSS rule in the stylesheet for #tab-settings specifically.
# ─────────────────────────────────────────────────────────────────────────────

# Add CSS rule right after the .tab-pane.active rule
old_tab_css = '.tab-pane.active{display:flex;}'
new_tab_css = '''.tab-pane.active{display:flex;}
#tab-settings{display:none;}
#tab-settings.active{display:block !important;overflow-y:auto;padding:0;}'''

if old_tab_css in html:
    html = html.replace(old_tab_css, new_tab_css, 1)
    print('FIX 1a applied: Settings tab CSS rule added to stylesheet')
else:
    print('FIX 1a SKIPPED: tab-pane.active pattern not found')

# Also fix the inline style on the settings pane to remove conflicting flex styles
old_settings_inline = '<div class="tab-pane" id="tab-settings" style="flex-direction:column;overflow-y:auto;padding:0;justify-content:flex-start;align-items:stretch;">'
new_settings_inline = '<div class="tab-pane" id="tab-settings">'

if old_settings_inline in html:
    html = html.replace(old_settings_inline, new_settings_inline, 1)
    print('FIX 1b applied: Settings tab inline style cleaned up')
else:
    # Try without the justify-content addition
    old_settings_inline2 = '<div class="tab-pane" id="tab-settings" style="flex-direction:column;overflow-y:auto;padding:0;">'
    if old_settings_inline2 in html:
        html = html.replace(old_settings_inline2, new_settings_inline, 1)
        print('FIX 1b applied (v2): Settings tab inline style cleaned up')
    else:
        print('FIX 1b SKIPPED: settings pane inline style not found')

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Drip postcard iframes overflow their container
# The iframes are 864px wide scaled down, but the container card is ~290px.
# The issue is the wrapper div width/height isn't being set correctly.
# Solution: Use a simpler approach - set the wrapper to aspect-ratio 3/2,
# use overflow:hidden, and scale the iframe to fill it.
# ─────────────────────────────────────────────────────────────────────────────

# Fix the Estimates postcards modal drip preview - replace the iframe approach
# with a simpler CSS transform approach that respects the container width
old_drip_scale = '''    const _dripFrontHtml = buildDripPostcardFrontHtml({
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

new_drip_scale = '''    const _dripFrontHtml = buildDripPostcardFrontHtml({
      photoUrl, headline: msg.headline, subtext: msg.subtext,
      companyName: fromName, companyAddress: fromAddr, phone: fromPhone,
      logoUrl, repHeadshot: cfg.repHeadshot||'', repName: cfg.repName||'',
      total: est.total||0, finMo: est.finMo||0
    });
    const frontHtml = `<div style="margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin-bottom:4px;">&#9650; FRONT</div>
      <div style="position:relative;width:100%;padding-top:66.67%;overflow:hidden;border-radius:6px;cursor:zoom-in;" onclick="previewDripFrontFromEstimate(${s.num},\'${estId}\')" title="Click to enlarge — 6x9 Postcard">
        <iframe srcdoc="${_dripFrontHtml.replace(/"/g,\'&quot;\').replace(/\`/g,\'&#96;\')}"
          style="position:absolute;top:0;left:0;width:864px;height:576px;border:none;transform-origin:top left;pointer-events:none;"
          scrolling="no" id="drip-est-iframe-${s.num}"></iframe>
      </div>
      <div style="text-align:center;font-size:9px;color:#6B7280;margin-top:2px;">Click front to enlarge</div>
    </div>`;'''

if old_drip_scale in html:
    html = html.replace(old_drip_scale, new_drip_scale, 1)
    print('FIX 2a applied: Drip postcard iframe uses responsive padding-top trick')
else:
    print('FIX 2a SKIPPED: drip scale pattern not found')

# Add JS to scale the iframes after the modal is shown
# Find the modal creation and add a requestAnimationFrame to scale iframes
old_modal_show = '''  document.body.appendChild(modal);
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });'''

new_modal_show = '''  document.body.appendChild(modal);
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  // Scale drip iframes to fit their containers
  requestAnimationFrame(()=>{
    [2,3,4].forEach(n=>{
      const iframe = document.getElementById('drip-est-iframe-'+n);
      if(!iframe) return;
      const container = iframe.parentElement;
      if(!container) return;
      const w = container.offsetWidth;
      const scale = w / 864;
      iframe.style.transform = 'scale('+scale+')';
    });
  });'''

if old_modal_show in html:
    html = html.replace(old_modal_show, new_modal_show, 1)
    print('FIX 2b applied: iframe scale JS added after modal render')
else:
    print('FIX 2b SKIPPED: modal show pattern not found')

# Also fix the Follow-Up Mail drip modal thumbnails (drip-pc2/3/4-front-wrap)
old_drip_modal_scale = '''    const scale = 0.22;
    const fw = Math.round(864*scale), fh = Math.round(576*scale);
    if(frontWrap) frontWrap.innerHTML = `<iframe srcdoc="${frontHtml.replace(/"/g,'&quot;').replace(/\`/g,'&#96;')}"
      style="width:864px;height:576px;border:none;transform:scale(${scale});transform-origin:top left;pointer-events:none;"
      scrolling="no"></iframe>`;
    if(frontWrap) { frontWrap.style.width=fw+'px'; frontWrap.style.height=fh+'px'; frontWrap.style.overflow='hidden'; frontWrap.style.borderRadius='5px'; }'''

new_drip_modal_scale = '''    if(frontWrap){
      frontWrap.style.cssText = 'position:relative;width:100%;padding-top:66.67%;overflow:hidden;border-radius:5px;border:1px solid var(--border);';
      const encodedHtml = frontHtml.replace(/"/g,'&quot;').replace(/`/g,'&#96;');
      frontWrap.innerHTML = `<iframe srcdoc="${encodedHtml}"
        style="position:absolute;top:0;left:0;width:864px;height:576px;border:none;transform-origin:top left;pointer-events:none;"
        scrolling="no" data-drip-iframe="1"></iframe>`;
      requestAnimationFrame(()=>{
        const iframe = frontWrap.querySelector('iframe');
        if(iframe){ const w=frontWrap.offsetWidth; iframe.style.transform='scale('+(w/864)+')'; }
      });
    }'''

if old_drip_modal_scale in html:
    html = html.replace(old_drip_modal_scale, new_drip_modal_scale, 1)
    print('FIX 2c applied: Follow-Up Mail drip thumbnails use responsive scaling')
else:
    print('FIX 2c SKIPPED: drip modal scale pattern not found')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('All changes written to index.html')
