"""
Fix postcard-designer.js:
1. Add z-index:1 to all data-zone divs so they always sit above decorative layers
2. Remove the redundant pointer-events:none background bar in Gutters template (line ~410)
3. Add 3 new templates: t7 (Neighborhood Alert), t8 (Estimate Ready), t9 (Before/After)
"""

path = 'src/postcard-designer.js'
content = open(path).read()

# ── Fix 1: Add z-index:1 to all pd-zone divs that use position:absolute
# The issue is decorative divs rendered AFTER zone divs in the DOM stack on top.
# Adding z-index:1 to every data-zone element ensures they're always clickable.
# We do this by adding z-index:1 to the CSS class in index.html instead (simpler).
# Actually we fix it in index.html separately - here just fix the Gutters header bar.

# ── Fix 2: Remove the redundant header bar in Gutters that covers headline1 zone
old_gutters_bar = '    <div style="position:absolute;top:0;left:0;right:0;height:28%;background:linear-gradient(90deg,#1a3a1a,#0f2a0f);display:flex;align-items:center;padding:0 18px;pointer-events:none;"></div>\n'
assert old_gutters_bar in content, 'Gutters bar not found'
content = content.replace(old_gutters_bar, '', 1)
print('Removed Gutters header bar overlay')

# ── Fix 3: Add new templates to PD_TEMPLATES
old_templates = """const PD_TEMPLATES = {
  '1':  { label: '📋 Estimate Reveal', icon: '📋', color: '#F25C05' },
  '2':  { label: '🏠 Design 2',        icon: '🏠', color: '#F25C05' },
  't3': { label: '🌪 Storm / Wind',    icon: '🌪', color: '#F25C05', accentDefault: '#F25C05' },
  't4': { label: '☀️ Solar',           icon: '☀️', color: '#FFD700', accentDefault: '#FFD700' },
  't5': { label: '🍂 Gutters',         icon: '🍂', color: '#4CAF50', accentDefault: '#4CAF50' },
  't6': { label: '🏠 General Roofing', icon: '🏠', color: '#F25C05', accentDefault: '#F25C05' },
};"""

new_templates = """const PD_TEMPLATES = {
  '1':  { label: '📋 Estimate Reveal', icon: '📋', color: '#F25C05' },
  '2':  { label: '🏠 Design 2',        icon: '🏠', color: '#F25C05' },
  't3': { label: '🌪 Storm / Wind',    icon: '🌪', color: '#F25C05', accentDefault: '#F25C05' },
  't4': { label: '☀️ Solar',           icon: '☀️', color: '#FFD700', accentDefault: '#FFD700' },
  't5': { label: '🍂 Gutters',         icon: '🍂', color: '#4CAF50', accentDefault: '#4CAF50' },
  't6': { label: '🏠 General Roofing', icon: '🏠', color: '#F25C05', accentDefault: '#F25C05' },
  't7': { label: '🚨 Neighborhood Alert', icon: '🚨', color: '#E53E3E', accentDefault: '#E53E3E' },
  't8': { label: '📬 Estimate Ready',  icon: '📬', color: '#F25C05', accentDefault: '#F25C05' },
  't9': { label: '🔄 Before / After',  icon: '🔄', color: '#2196F3', accentDefault: '#2196F3' },
};"""

assert old_templates in content, 'PD_TEMPLATES not found'
content = content.replace(old_templates, new_templates, 1)
print('Updated PD_TEMPLATES')

# ── Fix 4: Add PD_ZONES for new templates
old_zones_end = "PD_ZONES['2'] = PD_ZONES['1'];"
new_zones_addition = """PD_ZONES['2'] = PD_ZONES['1'];
PD_ZONES['t7'] = [
  { key: 'headline1',  label: 'Headline Line 1', type: 'text',     default: 'WE ASSESSED' },
  { key: 'headline2',  label: 'Headline Line 2', type: 'text',     default: 'YOUR ROOF' },
  { key: 'subhead',    label: 'Badge Text',      type: 'text',     default: 'FREE INSPECTION' },
  { key: 'ctaLabel',   label: 'CTA Label',       type: 'text',     default: 'Schedule Your Free Inspection' },
  { key: 'phone',      label: 'Phone',           type: 'text',     default: '' },
  { key: 'website',    label: 'Website',         type: 'text',     default: '' },
  { key: 'accentColor',label: 'Accent Color',    type: 'color',    default: '#E53E3E' },
  { key: 'heroImage',  label: 'Hero Image',      type: 'image',    default: null },
  { key: 'logo',       label: 'Logo',            type: 'image',    default: null },
];
PD_ZONES['t8'] = [
  { key: 'headline1',  label: 'Headline Line 1', type: 'text',     default: 'ESTIMATE' },
  { key: 'headline2',  label: 'Headline Line 2', type: 'text',     default: 'READY?' },
  { key: 'subhead',    label: 'Subheadline',     type: 'textarea', default: 'Your home qualifies for a free estimate. No obligation.' },
  { key: 'ctaLabel',   label: 'CTA Label',       type: 'text',     default: 'Scan to View Your Estimate' },
  { key: 'phone',      label: 'Phone',           type: 'text',     default: '' },
  { key: 'website',    label: 'Website',         type: 'text',     default: '' },
  { key: 'accentColor',label: 'Accent Color',    type: 'color',    default: '#F25C05' },
  { key: 'heroImage',  label: 'Hero Image',      type: 'image',    default: null },
  { key: 'logo',       label: 'Logo',            type: 'image',    default: null },
];
PD_ZONES['t9'] = [
  { key: 'headline1',  label: 'Headline Line 1', type: 'text',     default: 'SEE THE' },
  { key: 'headline2',  label: 'Headline Line 2', type: 'text',     default: 'DIFFERENCE' },
  { key: 'subhead',    label: 'Offer Badge',     type: 'text',     default: 'FREE ESTIMATE' },
  { key: 'ctaLabel',   label: 'CTA Label',       type: 'text',     default: 'Call Us Today' },
  { key: 'phone',      label: 'Phone',           type: 'text',     default: '' },
  { key: 'website',    label: 'Website',         type: 'text',     default: '' },
  { key: 'accentColor',label: 'Accent Color',    type: 'color',    default: '#2196F3' },
  { key: 'heroImage',  label: 'After Photo',     type: 'image',    default: null },
  { key: 'logo',       label: 'Logo',            type: 'image',    default: null },
];"""

assert old_zones_end in content, 'PD_ZONES end not found'
content = content.replace(old_zones_end, new_zones_addition, 1)
print('Added PD_ZONES for t7, t8, t9')

# ── Fix 5: Add new template functions before pdBackHtml
# We insert after pdFrontRoofing's closing brace and before pdBackHtml

insert_before = '/* ─── Back HTML renderer ─────────────────────────────────────── */'
assert insert_before in content, 'Back HTML renderer marker not found'

new_templates_html = '''/* ─── Template t7: Neighborhood Alert ───────────────────────── */
function pdFrontAlert(accent, phone, website, logoUrl, heroUrl, companyName, addr, cfg, logoScale=100, heroScale=100) {
  const h1 = cfg.tplHeadline1 || 'WE ASSESSED';
  const h2 = cfg.tplHeadline2 || 'YOUR ROOF';
  const badge = cfg.tplSubhead || 'FREE INSPECTION';
  const cta = cfg.tplCtaLabel || 'Schedule Your Free Inspection';
  return `
    <div style="position:absolute;inset:0;background:#111;"></div>
    ${heroUrl ? `<div data-zone="heroImage" class="pd-zone" style="position:absolute;inset:0;cursor:pointer;overflow:hidden;z-index:1;" title="Click to replace hero image">
      <img src="${heroUrl}" style="width:${heroScale}%;height:${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;opacity:.55;">
      <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,.85) 0%,rgba(0,0,0,.6) 50%,rgba(0,0,0,.3) 100%);pointer-events:none;"></div>
      <div class="pd-zone-hint">📷 Replace Image</div>
    </div>` : `<div data-zone="heroImage" class="pd-zone" style="position:absolute;inset:0;background:linear-gradient(135deg,#1a0000,#2d0000);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;z-index:1;" title="Click to upload hero image">
      <div style="font-size:48px;opacity:.2;">🏠</div>
      <div class="pd-zone-hint">📷 Upload Hero Image</div>
    </div>`}
    <div style="position:absolute;left:0;top:0;width:8px;height:100%;background:${accent};z-index:3;pointer-events:none;"></div>
    <div data-zone="logo" class="pd-zone" style="position:absolute;top:20px;left:22px;z-index:4;cursor:pointer;" title="Upload logo">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:${Math.round(32*logoScale/100)}px;max-width:${Math.round(120*logoScale/100)}px;object-fit:contain;">` : `<div style="background:rgba(255,255,255,.1);border:1.5px dashed rgba(255,255,255,.3);border-radius:5px;padding:4px 12px;font-size:12px;font-weight:900;color:${accent};">${companyName}</div>`}
      <div class="pd-zone-hint">🖼 Upload Logo</div>
    </div>
    <div data-zone="headline1" class="pd-zone" style="position:absolute;left:22px;top:50%;transform:translateY(-65%);z-index:4;cursor:pointer;" title="Edit headline">
      <div style="font-size:clamp(14px,3.5vw,26px);font-weight:900;color:rgba(255,255,255,.85);letter-spacing:1px;text-transform:uppercase;line-height:1;">${h1}</div>
      <div style="font-size:clamp(28px,6.5vw,52px);font-weight:900;color:${accent};letter-spacing:-1px;text-transform:uppercase;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.8);">${h2}</div>
      <div class="pd-zone-hint">✏️ Edit Headline</div>
    </div>
    <div data-zone="subhead" class="pd-zone" style="position:absolute;left:22px;bottom:52px;z-index:4;cursor:pointer;" title="Edit badge text">
      <div style="background:${accent};color:#fff;font-size:11px;font-weight:900;padding:5px 14px;border-radius:3px;letter-spacing:1px;text-transform:uppercase;display:inline-block;">${badge}</div>
      <div class="pd-zone-hint">✏️ Edit Badge</div>
    </div>
    <div data-zone="phone" class="pd-zone" style="position:absolute;right:18px;bottom:18px;background:rgba(255,255,255,.1);border:2px solid ${accent};border-radius:5px;padding:8px 14px;cursor:pointer;text-align:center;min-width:140px;z-index:4;" title="Edit CTA">
      <div style="font-size:9px;color:rgba(255,255,255,.7);letter-spacing:1px;text-transform:uppercase;">${cta}</div>
      <div style="font-size:18px;font-weight:900;color:#fff;">${phone}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.6);">${website}</div>
      <div class="pd-zone-hint">✏️ Edit CTA</div>
    </div>
  `;
}

/* ─── Template t8: Estimate Ready ───────────────────────────── */
function pdFrontEstimateReady(accent, phone, website, logoUrl, heroUrl, companyName, addr, cfg, logoScale=100, heroScale=100) {
  const h1 = cfg.tplHeadline1 || 'ESTIMATE';
  const h2 = cfg.tplHeadline2 || 'READY?';
  const sub = cfg.tplSubhead || 'Your home qualifies for a free estimate. No obligation.';
  const cta = cfg.tplCtaLabel || 'Scan to View Your Estimate';
  return `
    <div style="position:absolute;inset:0;background:#0d0d0d;"></div>
    ${heroUrl ? `<div data-zone="heroImage" class="pd-zone" style="position:absolute;inset:0;cursor:pointer;overflow:hidden;z-index:1;" title="Click to replace hero image">
      <img src="${heroUrl}" style="width:${heroScale}%;height:${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;opacity:.45;">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,.9) 0%,rgba(0,0,0,.5) 60%,rgba(0,0,0,.2) 100%);pointer-events:none;"></div>
      <div class="pd-zone-hint">📷 Replace Image</div>
    </div>` : `<div data-zone="heroImage" class="pd-zone" style="position:absolute;inset:0;background:linear-gradient(135deg,#0d0d0d,#1a1a1a);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;z-index:1;" title="Click to upload hero image">
      <div style="font-size:48px;opacity:.15;">🏠</div>
      <div class="pd-zone-hint">📷 Upload Hero Image</div>
    </div>`}
    <div style="position:absolute;top:0;left:0;right:0;height:5px;background:${accent};z-index:3;pointer-events:none;"></div>
    <div data-zone="logo" class="pd-zone" style="position:absolute;top:20px;left:20px;z-index:4;cursor:pointer;" title="Upload logo">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:${Math.round(30*logoScale/100)}px;max-width:${Math.round(110*logoScale/100)}px;object-fit:contain;">` : `<div style="background:rgba(255,255,255,.08);border:1.5px dashed rgba(255,255,255,.25);border-radius:5px;padding:4px 12px;font-size:12px;font-weight:900;color:${accent};">${companyName}</div>`}
      <div class="pd-zone-hint">🖼 Upload Logo</div>
    </div>
    <div data-zone="headline1" class="pd-zone" style="position:absolute;left:20px;top:50%;transform:translateY(-60%);z-index:4;cursor:pointer;" title="Edit headline">
      <div style="font-size:clamp(12px,2.5vw,18px);font-weight:700;color:${accent};letter-spacing:3px;text-transform:uppercase;line-height:1;">${h1}</div>
      <div style="font-size:clamp(36px,8vw,64px);font-weight:900;color:#fff;letter-spacing:-2px;line-height:.9;text-shadow:0 4px 20px rgba(0,0,0,.8);">${h2}</div>
      <div class="pd-zone-hint">✏️ Edit Headline</div>
    </div>
    <div data-zone="subhead" class="pd-zone" style="position:absolute;left:20px;bottom:60px;max-width:55%;z-index:4;cursor:pointer;" title="Edit subheadline">
      <div style="font-size:10px;color:rgba(255,255,255,.7);line-height:1.5;">${sub}</div>
      <div class="pd-zone-hint">✏️ Edit Sub</div>
    </div>
    <div data-zone="phone" class="pd-zone" style="position:absolute;right:18px;bottom:18px;background:${accent};border-radius:5px;padding:8px 14px;cursor:pointer;text-align:center;min-width:140px;z-index:4;" title="Edit CTA">
      <div style="font-size:9px;color:rgba(0,0,0,.7);letter-spacing:1px;text-transform:uppercase;font-weight:700;">${cta}</div>
      <div style="font-size:18px;font-weight:900;color:#fff;">${phone}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.8);">${website}</div>
      <div class="pd-zone-hint">✏️ Edit CTA</div>
    </div>
  `;
}

/* ─── Template t9: Before / After ───────────────────────────── */
function pdFrontBeforeAfter(accent, phone, website, logoUrl, heroUrl, companyName, addr, cfg, logoScale=100, heroScale=100) {
  const h1 = cfg.tplHeadline1 || 'SEE THE';
  const h2 = cfg.tplHeadline2 || 'DIFFERENCE';
  const badge = cfg.tplSubhead || 'FREE ESTIMATE';
  const cta = cfg.tplCtaLabel || 'Call Us Today';
  return `
    <div style="position:absolute;inset:0;background:#fff;"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:38%;background:linear-gradient(90deg,#111 0%,#222 100%);z-index:1;pointer-events:none;"></div>
    <div data-zone="headline1" class="pd-zone" style="position:absolute;top:0;left:0;right:0;height:38%;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:2;cursor:pointer;" title="Edit headline">
      <div style="font-size:clamp(10px,2vw,14px);font-weight:700;color:rgba(255,255,255,.7);letter-spacing:3px;text-transform:uppercase;">${h1}</div>
      <div style="font-size:clamp(22px,5vw,38px);font-weight:900;color:${accent};letter-spacing:-1px;text-transform:uppercase;line-height:1;">${h2}</div>
      <div class="pd-zone-hint">✏️ Edit Headline</div>
    </div>
    <div style="position:absolute;top:38%;left:0;width:50%;bottom:0;background:#e8e8e8;overflow:hidden;z-index:1;pointer-events:none;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;">
        <div style="font-size:28px;opacity:.2;">🏚</div>
        <div style="font-size:10px;color:#999;font-weight:700;letter-spacing:1px;">BEFORE</div>
      </div>
      <div style="position:absolute;top:8px;left:8px;background:#555;color:#fff;font-size:9px;font-weight:900;padding:3px 8px;border-radius:2px;letter-spacing:1px;">BEFORE</div>
    </div>
    ${heroUrl ? `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:38%;right:0;width:50%;bottom:0;overflow:hidden;cursor:pointer;z-index:2;" title="Click to replace after photo">
      <img src="${heroUrl}" style="width:${heroScale}%;height:${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;">
      <div style="position:absolute;top:8px;left:8px;background:${accent};color:#fff;font-size:9px;font-weight:900;padding:3px 8px;border-radius:2px;letter-spacing:1px;pointer-events:none;">AFTER</div>
      <div class="pd-zone-hint">📷 Replace After Photo</div>
    </div>` : `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:38%;right:0;width:50%;bottom:0;background:#ddd;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;z-index:2;" title="Click to upload after photo">
      <div style="font-size:28px;opacity:.3;">🏠</div>
      <div style="font-size:10px;color:#999;font-weight:700;letter-spacing:1px;">AFTER</div>
      <div class="pd-zone-hint">📷 Upload After Photo</div>
    </div>`}
    <div style="position:absolute;top:38%;left:50%;transform:translateX(-50%);width:3px;bottom:0;background:${accent};z-index:3;pointer-events:none;"></div>
    <div data-zone="subhead" class="pd-zone" style="position:absolute;bottom:28px;left:50%;transform:translateX(-50%);z-index:4;cursor:pointer;white-space:nowrap;" title="Edit badge">
      <div style="background:${accent};color:#fff;font-size:10px;font-weight:900;padding:5px 16px;border-radius:3px;letter-spacing:1px;text-transform:uppercase;">${badge}</div>
      <div class="pd-zone-hint">✏️ Edit Badge</div>
    </div>
    <div data-zone="logo" class="pd-zone" style="position:absolute;top:40%;left:18px;z-index:4;cursor:pointer;" title="Upload logo">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:${Math.round(26*logoScale/100)}px;max-width:${Math.round(100*logoScale/100)}px;object-fit:contain;">` : `<div style="background:rgba(0,0,0,.06);border:1.5px dashed rgba(0,0,0,.2);border-radius:5px;padding:3px 10px;font-size:10px;font-weight:900;color:#555;">${companyName}</div>`}
      <div class="pd-zone-hint">🖼 Upload Logo</div>
    </div>
    <div data-zone="phone" class="pd-zone" style="position:absolute;bottom:8px;left:18px;z-index:4;cursor:pointer;" title="Edit phone">
      <div style="font-size:13px;font-weight:900;color:#111;">${phone}</div>
      <div style="font-size:9px;color:#666;">${website}</div>
      <div class="pd-zone-hint">✏️ Edit CTA</div>
    </div>
  `;
}

'''

content = content.replace(insert_before, new_templates_html + insert_before, 1)
print('Added t7, t8, t9 template functions')

# ── Fix 6: Wire t7/t8/t9 in pdFrontHtml dispatch
old_dispatch = "  if (id === 't6') return pdFrontRoofing(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);"
new_dispatch = """  if (id === 't6') return pdFrontRoofing(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);
  if (id === 't7') return pdFrontAlert(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);
  if (id === 't8') return pdFrontEstimateReady(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);
  if (id === 't9') return pdFrontBeforeAfter(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);"""

assert old_dispatch in content, 'Dispatch line not found'
content = content.replace(old_dispatch, new_dispatch, 1)
print('Wired t7/t8/t9 in pdFrontHtml dispatch')

# ── Fix 7: Add thumbnails for t7/t8/t9 in pdThumbnailHtml
old_thumb_end = "    't6': `<div class=\"pd-tpl-thumb-inner\""
# Find the t6 thumbnail and add t7/t8/t9 after it
# First find the full t6 thumbnail block
import re
# Find the closing backtick of t6 thumbnail
t6_start = content.find("    't6': `<div class=\"pd-tpl-thumb-inner\"")
# Find the next key after t6 (which would be the closing of the thumbs object)
t6_end = content.find("\n  };\n  return thumbs[id]", t6_start)
t6_block_end = content.find("`,\n", t6_start) + 3  # end of t6 template literal

t6_thumb_end = content.find("`,\n", t6_start)
insert_pos = t6_thumb_end + 3  # after the `,\n`

new_thumbs = """    't7': `<div class="pd-tpl-thumb-inner" style="background:#111;position:relative;overflow:hidden;">
      <div style="position:absolute;left:0;top:0;width:4px;height:100%;background:${meta.color};"></div>
      <div style="padding-left:8px;">
        <div style="font-size:7px;color:rgba(255,255,255,.6);font-weight:700;letter-spacing:1px;text-transform:uppercase;">WE ASSESSED</div>
        <div style="font-size:14px;font-weight:900;color:${meta.color};line-height:1;text-transform:uppercase;">YOUR ROOF</div>
        <div style="margin-top:4px;background:${meta.color};color:#fff;font-size:7px;font-weight:900;padding:2px 6px;border-radius:2px;display:inline-block;">FREE INSPECTION</div>
      </div>
    </div>`,
    't8': `<div class="pd-tpl-thumb-inner" style="background:#0d0d0d;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${meta.color};"></div>
      <div style="padding-top:6px;">
        <div style="font-size:7px;color:${meta.color};font-weight:700;letter-spacing:2px;text-transform:uppercase;">ESTIMATE</div>
        <div style="font-size:18px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px;">READY?</div>
        <div style="margin-top:4px;font-size:7px;color:rgba(255,255,255,.5);line-height:1.3;">Your home qualifies for a free estimate.</div>
      </div>
    </div>`,
    't9': `<div class="pd-tpl-thumb-inner" style="background:#fff;position:relative;overflow:hidden;padding:0;">
      <div style="position:absolute;top:0;left:0;right:0;height:35%;background:#111;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:9px;font-weight:900;color:${meta.color};text-transform:uppercase;letter-spacing:1px;">SEE THE DIFFERENCE</div>
      </div>
      <div style="position:absolute;top:35%;left:0;width:50%;bottom:0;background:#e0e0e0;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:7px;color:#999;font-weight:700;">BEFORE</div>
      </div>
      <div style="position:absolute;top:35%;right:0;width:50%;bottom:0;background:#ccc;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:7px;color:#555;font-weight:700;">AFTER</div>
      </div>
      <div style="position:absolute;top:35%;left:50%;transform:translateX(-50%);width:2px;bottom:0;background:${meta.color};"></div>
    </div>`,
"""

content = content[:insert_pos] + new_thumbs + content[insert_pos:]
print('Added t7/t8/t9 thumbnails')

open(path, 'w').write(content)
print('Done — all changes written')
