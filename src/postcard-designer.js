/**
 * BidDrop Postcard Designer
 * Live WYSIWYG preview engine for the 3-column postcard editor.
 * Renders a scaled HTML preview of the selected template and wires
 * click-to-edit zones to the right-panel properties form.
 *
 * Depends on: S.cfg, syncAccountToSupabase, renderFrontCanvasForDesign,
 *             renderPostcard6x9BackCanvas (from postcard-render.js / postcard-dispatch.js)
 */

/* ─── Designer State ─────────────────────────────────────────── */
const PD = {
  tplId: null,          // active template id: '1','2','t3','t4','t5','t6'
  side: 'front',        // 'front' | 'back'
  selectedZone: null,   // currently selected zone key
  heroDataUrl: null,    // uploaded hero image data URL
  logoDataUrl: null,    // uploaded logo image data URL
  logoWhiten: null,     // null = use cfg.tplLogoWhiten, true = force white filter, false = show full color
  dirty: false,
};

/* ─── Template definitions ───────────────────────────────────── */
const PD_TEMPLATES = {
  '1':  { label: '📋 Estimate Reveal', icon: '📋', color: '#F25C05' },
  '2':  { label: '🏠 Design 2',        icon: '🏠', color: '#F25C05' },
  't3': { label: '🌪 Storm / Wind',    icon: '🌪', color: '#F25C05', accentDefault: '#F25C05' },
  't4': { label: '☀️ Solar',           icon: '☀️', color: '#FFD700', accentDefault: '#FFD700' },
  't5': { label: '🍂 Gutters',         icon: '🍂', color: '#4CAF50', accentDefault: '#4CAF50' },
  't6': { label: '🏠 General Roofing', icon: '🏠', color: '#F25C05', accentDefault: '#F25C05' },
};

/* ─── Zone definitions per template ─────────────────────────── */
const PD_ZONES = {
  't3': [
    { key: 'headline1',  label: 'Headline Line 1', type: 'text',     default: 'YOU HAVE' },
    { key: 'headline2',  label: 'Headline Line 2', type: 'text',     default: 'WIND DAMAGE' },
    { key: 'subhead',    label: 'Subheadline',     type: 'textarea', default: 'Should you make a claim? Our Advisors are insurance experts.' },
    { key: 'ctaLabel',   label: 'CTA Label',       type: 'text',     default: 'Call for in-depth analysis' },
    { key: 'phone',      label: 'Phone',           type: 'text',     default: '' },
    { key: 'website',    label: 'Website',         type: 'text',     default: '' },
    { key: 'accentColor',label: 'Accent Color',    type: 'color',    default: '#F25C05' },
    { key: 'heroImage',  label: 'Hero Image',      type: 'image',    default: null },
    { key: 'logo',       label: 'Logo',            type: 'image',    default: null },
  ],
  't4': [
    { key: 'headline1',  label: 'Headline Line 1', type: 'text',     default: 'YOUR HOME IS' },
    { key: 'headline2',  label: 'Headline Line 2', type: 'text',     default: 'SOLAR READY' },
    { key: 'subhead',    label: 'Subheadline',     type: 'textarea', default: 'Save up to 80% on your energy bills with a custom solar system.' },
    { key: 'bullet1',   label: 'Bullet 1',         type: 'text',     default: 'Free Solar Assessment' },
    { key: 'bullet2',   label: 'Bullet 2',         type: 'text',     default: 'Zero Down Financing' },
    { key: 'bullet3',   label: 'Bullet 3',         type: 'text',     default: 'Guaranteed Savings' },
    { key: 'ctaLabel',   label: 'CTA Label',       type: 'text',     default: 'Get Your Free Quote' },
    { key: 'phone',      label: 'Phone',           type: 'text',     default: '' },
    { key: 'website',    label: 'Website',         type: 'text',     default: '' },
    { key: 'accentColor',label: 'Accent Color',    type: 'color',    default: '#FFD700' },
    { key: 'heroImage',  label: 'Hero Image',      type: 'image',    default: null },
    { key: 'logo',       label: 'Logo',            type: 'image',    default: null },
  ],
  't5': [
    { key: 'headline1',  label: 'Headline Line 1', type: 'text',     default: "DON'T FALL VICTIM TO" },
    { key: 'headline2',  label: 'Headline Line 2', type: 'text',     default: 'CLOGGED GUTTERS' },
    { key: 'subhead',    label: 'Subheadline',     type: 'textarea', default: 'Protect your home from water damage with professional gutter cleaning and guards.' },
    { key: 'bullet1',   label: 'Bullet 1',         type: 'text',     default: 'Licensed & Insured' },
    { key: 'bullet2',   label: 'Bullet 2',         type: 'text',     default: 'Free Estimates' },
    { key: 'bullet3',   label: 'Bullet 3',         type: 'text',     default: '5-Star Rated' },
    { key: 'ctaLabel',   label: 'CTA Label',       type: 'text',     default: 'Call for a Free Inspection' },
    { key: 'phone',      label: 'Phone',           type: 'text',     default: '' },
    { key: 'website',    label: 'Website',         type: 'text',     default: '' },
    { key: 'accentColor',label: 'Accent Color',    type: 'color',    default: '#4CAF50' },
    { key: 'heroImage',  label: 'Hero Image',      type: 'image',    default: null },
    { key: 'logo',       label: 'Logo',            type: 'image',    default: null },
  ],
  't6': [
    { key: 'headline1',  label: 'Headline Line 1', type: 'text',     default: 'FREE ROOF' },
    { key: 'headline2',  label: 'Headline Line 2', type: 'text',     default: 'INSPECTION' },
    { key: 'subhead',    label: 'Subheadline',     type: 'textarea', default: 'We protect your biggest investment. Schedule your free inspection today.' },
    { key: 'bullet1',   label: 'Bullet 1',         type: 'text',     default: 'Licensed & Insured' },
    { key: 'bullet2',   label: 'Bullet 2',         type: 'text',     default: 'Free Estimates' },
    { key: 'bullet3',   label: 'Bullet 3',         type: 'text',     default: 'Financing Available' },
    { key: 'ctaLabel',   label: 'CTA Label',       type: 'text',     default: 'Schedule Your Free Inspection' },
    { key: 'phone',      label: 'Phone',           type: 'text',     default: '' },
    { key: 'website',    label: 'Website',         type: 'text',     default: '' },
    { key: 'accentColor',label: 'Accent Color',    type: 'color',    default: '#F25C05' },
    { key: 'heroImage',  label: 'Hero Image',      type: 'image',    default: null },
    { key: 'logo',       label: 'Logo',            type: 'image',    default: null },
  ],
};
// Designs 1 and 2 use the existing settings fields — minimal zones
PD_ZONES['1'] = [
  { key: 'phone',   label: 'Phone',   type: 'text', default: '' },
  { key: 'website', label: 'Website', type: 'text', default: '' },
  { key: 'logo',    label: 'Logo',    type: 'image', default: null },
];
PD_ZONES['2'] = PD_ZONES['1'];

/* ─── Get current value for a zone field ────────────────────── */
function pdGetVal(key) {
  if (!S || !S.cfg) return '';
  const map = {
    headline1:   () => S.cfg.tplHeadline1   || '',
    headline2:   () => S.cfg.tplHeadline2   || '',
    subhead:     () => S.cfg.tplSubhead     || '',
    bullet1:     () => S.cfg.tplBullet1     || '',
    bullet2:     () => S.cfg.tplBullet2     || '',
    bullet3:     () => S.cfg.tplBullet3     || '',
    ctaLabel:    () => S.cfg.tplCtaLabel    || '',
    phone:       () => S.cfg.phone          || '',
    website:     () => S.cfg.website        || '',
    accentColor: () => S.cfg.tplAccentColor || '#F25C05',
    heroImage:   () => PD.heroDataUrl       || S.cfg.tplHeroUrl || null,
    logo:        () => PD.logoDataUrl       || S.cfg.logoData   || null,
  };
  return map[key] ? map[key]() : '';
}

/* ─── Set value from right-panel input ──────────────────────── */
function pdSetVal(key, value) {
  if (!S || !S.cfg) return;
  const map = {
    headline1:   v => { S.cfg.tplHeadline1   = v; },
    headline2:   v => { S.cfg.tplHeadline2   = v; },
    subhead:     v => { S.cfg.tplSubhead     = v; },
    bullet1:     v => { S.cfg.tplBullet1     = v; },
    bullet2:     v => { S.cfg.tplBullet2     = v; },
    bullet3:     v => { S.cfg.tplBullet3     = v; },
    ctaLabel:    v => { S.cfg.tplCtaLabel    = v; },
    phone:       v => { S.cfg.phone          = v; },
    website:     v => { S.cfg.website        = v; },
    accentColor: v => { S.cfg.tplAccentColor = v; },
  };
  if (map[key]) map[key](value);
  PD.dirty = true;
  pdRenderPreview();
}

function pdSetLogoScale(val) {
  PD.logoScale = val;
  if(S && S.cfg) S.cfg.tplLogoScale = val;
  PD.dirty = true;
  // Update the size label live without full re-render
  const lbl = document.querySelector('#pd-props-panel [data-pd-logo-scale-lbl]');
  if(lbl) lbl.textContent = 'Size: ' + val + '%';
  pdRenderPreview();
}

function pdSetLogoWhiten(val) {
  PD.logoWhiten = val;
  if(S && S.cfg) S.cfg.tplLogoWhiten = val;
  PD.dirty = true;
  pdRenderPreview();
}

function pdSetHeroScale(val) {
  PD.heroScale = val;
  if(S && S.cfg) S.cfg.tplHeroScale = val;
  PD.dirty = true;
  const lbl = document.querySelector('#pd-props-panel [data-pd-hero-scale-lbl]');
  if(lbl) lbl.textContent = 'Size: ' + val + '%';
  pdRenderPreview();
}

/* ─── Open the designer (called when Designs tab is opened) ─── */
function openPostcardDesigner() {
  PD.tplId = (S && S.cfg && S.cfg.postcardDesign) || '1';
  PD.side = 'front';
  PD.selectedZone = null;
  PD.heroDataUrl = null;
  PD.logoDataUrl = null;
  PD.logoWhiten = null;
  PD.dirty = false;
  pdRenderTemplateLibrary();
  pdRenderPreview();
  pdRenderPropertiesPanel(null);
  pdUpdateSideButtons();
}

/* ─── Render the template library (left panel) ──────────────── */
function pdRenderTemplateLibrary() {
  const container = document.getElementById('pd-tpl-library');
  if (!container) return;
  const active = PD.tplId;
  container.innerHTML = Object.entries(PD_TEMPLATES).map(([id, meta]) => `
    <div class="pd-tpl-thumb ${id === active ? 'pd-tpl-active' : ''}" onclick="pdSelectTemplate('${id}')" id="pd-tpl-${id}">
      ${pdThumbnailHtml(id, meta)}
      <div class="pd-tpl-name">${meta.label}</div>
    </div>
  `).join('') + `
    <div class="pd-tpl-thumb pd-tpl-upload" onclick="pdTriggerUploadDesign()">
      <div class="pd-tpl-thumb-inner" style="border:2px dashed var(--border);background:var(--card2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:90px;">
        <div style="font-size:22px;">⬆️</div>
        <div style="font-size:11px;color:var(--muted);">Upload Design</div>
      </div>
      <div class="pd-tpl-name" style="color:var(--muted);">📁 Custom Upload</div>
    </div>
  `;
}

function pdThumbnailHtml(id, meta) {
  const thumbs = {
    '1': `<div class="pd-tpl-thumb-inner" style="background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
            <div style="font-size:9px;color:${meta.color};font-weight:900;text-align:center;letter-spacing:.5px;">WE ASSESSED</div>
            <div style="font-size:13px;color:#fff;font-weight:900;">YOUR ROOF.</div>
            <div style="font-size:8px;color:var(--muted);">Estimate Reveal</div>
          </div>`,
    '2': `<div class="pd-tpl-thumb-inner" style="background:linear-gradient(135deg,#0d1a0d,#1a2e1a);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
            <div style="font-size:9px;color:${meta.color};font-weight:900;text-align:center;letter-spacing:.5px;">FREE INSPECTION</div>
            <div style="font-size:13px;color:#fff;font-weight:900;">YOUR ROOF</div>
            <div style="font-size:8px;color:var(--muted);">Design 2</div>
          </div>`,
    't3': `<div class="pd-tpl-thumb-inner" style="background:linear-gradient(135deg,#1a0800,#2d1200);position:relative;overflow:hidden;">
             <div style="position:absolute;left:0;top:0;width:7px;height:100%;background:${meta.color};"></div>
             <div style="padding-left:14px;">
               <div style="font-size:8px;color:rgba(255,255,255,.6);font-weight:700;">YOU HAVE</div>
               <div style="font-size:14px;color:${meta.color};font-weight:900;line-height:1;">WIND<br>DAMAGE</div>
             </div>
           </div>`,
    't4': `<div class="pd-tpl-thumb-inner" style="background:linear-gradient(160deg,#0a1628,#0d2040);position:relative;overflow:hidden;">
             <div style="position:absolute;right:10px;top:8px;width:24px;height:24px;background:radial-gradient(circle,#FFD700 40%,transparent 70%);border-radius:50%;box-shadow:0 0 10px #FFD700;"></div>
             <div>
               <div style="font-size:8px;color:rgba(255,255,255,.6);font-weight:700;">YOUR HOME IS</div>
               <div style="font-size:13px;color:#FFD700;font-weight:900;line-height:1.1;">SOLAR<br>READY</div>
             </div>
           </div>`,
    't5': `<div class="pd-tpl-thumb-inner" style="background:#0f1a0f;position:relative;overflow:hidden;">
             <div style="position:absolute;top:0;left:0;right:0;height:30%;background:#1a3a1a;display:flex;align-items:center;padding:0 8px;">
               <div style="font-size:7px;color:#4CAF50;font-weight:900;">CLOGGED GUTTERS?</div>
             </div>
             <div style="margin-top:30%;padding:4px 8px;">
               <div style="font-size:7px;color:#ccc;">✓ Licensed & Insured</div>
               <div style="font-size:7px;color:#ccc;">✓ Free Estimates</div>
             </div>
           </div>`,
    't6': `<div class="pd-tpl-thumb-inner" style="background:linear-gradient(135deg,#1a1a2e,#16213e);position:relative;overflow:hidden;">
             <div style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:28px;height:28px;background:${meta.color};clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);"></div>
             <div>
               <div style="font-size:8px;color:rgba(255,255,255,.6);font-weight:700;">FREE ROOF</div>
               <div style="font-size:14px;color:${meta.color};font-weight:900;line-height:1;">INSPECTION</div>
             </div>
           </div>`,
  };
  return thumbs[id] || `<div class="pd-tpl-thumb-inner" style="background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:24px;">${meta.icon}</div>`;
}

/* ─── Select a template ──────────────────────────────────────── */
function pdSelectTemplate(id) {
  PD.tplId = id;
  PD.selectedZone = null;
  // Update active highlight
  document.querySelectorAll('.pd-tpl-thumb').forEach(el => el.classList.remove('pd-tpl-active'));
  const thumb = document.getElementById('pd-tpl-' + id);
  if (thumb) thumb.classList.add('pd-tpl-active');
  pdRenderPreview();
  pdRenderPropertiesPanel(null);
}

/* ─── Render the live canvas preview ────────────────────────── */
function pdRenderPreview() {
  const canvas = document.getElementById('pd-canvas');
  if (!canvas) return;
  const id = PD.tplId;
  if (PD.side === 'front') {
    canvas.innerHTML = pdFrontHtml(id);
  } else {
    canvas.innerHTML = pdBackHtml();
  }
  // Wire zone click handlers
  canvas.querySelectorAll('[data-zone]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const zone = el.getAttribute('data-zone');
      pdSelectZone(zone);
    });
  });
}

/* ─── Front HTML renderers per template ─────────────────────── */
function pdFrontHtml(id) {
  const cfg = (S && S.cfg) || {};
  const accent = cfg.tplAccentColor || (PD_TEMPLATES[id] && PD_TEMPLATES[id].accentDefault) || '#F25C05';
  const phone = cfg.phone || '(555) 000-0000';
  const website = cfg.website || 'www.yourcompany.com';
  const logoUrl = PD.logoDataUrl || cfg.logoData || null;
  const heroUrl = PD.heroDataUrl || cfg.tplHeroUrl || null;
  const companyName = cfg.companyName || 'Your Company';
  const companyAddr = cfg.companyAddress || '';
  // Scale factors (100 = default, range 30-200)
  const logoScale = PD.logoScale != null ? PD.logoScale : (cfg.tplLogoScale != null ? cfg.tplLogoScale : 100);
  const heroScale = PD.heroScale != null ? PD.heroScale : (cfg.tplHeroScale != null ? cfg.tplHeroScale : 100);
  if (id === 't3') return pdFrontStorm(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);
  if (id === 't4') return pdFrontSolar(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);
  if (id === 't5') return pdFrontGutters(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);
  if (id === 't6') return pdFrontRoofing(accent, phone, website, logoUrl, heroUrl, companyName, companyAddr, cfg, logoScale, heroScale);
  // Designs 1 & 2 — show a placeholder
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:var(--card2);">
    <div style="font-size:32px;">📋</div>
    <div style="font-size:14px;font-weight:700;color:var(--text);">${PD_TEMPLATES[id]?.label || 'Design '+id}</div>
    <div style="font-size:12px;color:var(--muted);text-align:center;max-width:300px;">This design uses your uploaded image.<br>Use the Upload Design button to manage it.</div>
  </div>`;
}

function pdFrontStorm(accent, phone, website, logoUrl, heroUrl, companyName, addr, cfg, logoScale=100, heroScale=100) {
  const h1 = cfg.tplHeadline1 || 'YOU HAVE';
  const h2 = cfg.tplHeadline2 || 'WIND DAMAGE';
  const sub = cfg.tplSubhead || 'Should you make a claim? Our Advisors are insurance experts.';
  const cta = cfg.tplCtaLabel || 'Call for in-depth analysis';
  return `
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,#1a0800 0%,#2d1200 60%,#1a0800 100%);"></div>
    ${heroUrl ? `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:52%;height:100%;cursor:pointer;overflow:hidden;" title="Click to replace hero image">
      <img src="${heroUrl}" style="width:${heroScale}%;height:${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;">
      <div style="position:absolute;inset:0;background:linear-gradient(to right,#1a0800 0%,rgba(26,8,0,.5) 30%,transparent 60%);"></div>
      <div class="pd-zone-hint">📷 Replace Image</div>
    </div>` : `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:52%;height:100%;background:linear-gradient(135deg,#2d1a0a,#4a2a10);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;" title="Click to upload hero image">
      <div style="font-size:36px;opacity:.4;">🏠</div>
      <div class="pd-zone-hint">📷 Upload Hero Image</div>
    </div>`}
    <div style="position:absolute;inset:0;background:linear-gradient(to right,#1a0800 0%,rgba(26,8,0,.7) 35%,transparent 55%);pointer-events:none;"></div>
    <div style="position:absolute;left:0;top:0;width:7px;height:100%;background:${accent};"></div>
    <div data-zone="logo" class="pd-zone" style="position:absolute;top:22px;left:20px;min-width:100px;height:36px;display:flex;align-items:center;cursor:pointer;" title="Click to upload logo">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:34px;max-width:130px;object-fit:contain;">` : `<div style="background:rgba(255,255,255,.08);border:1.5px dashed rgba(255,255,255,.25);border-radius:5px;padding:4px 12px;font-size:12px;font-weight:900;color:${accent};">${companyName}</div>`}
      <div class="pd-zone-hint">🖼 Upload Logo</div>
    </div>
    ${addr ? `<div data-zone="companyAddr" class="pd-zone" style="position:absolute;top:66px;left:20px;cursor:pointer;" title="Edit company address">
      <div style="font-size:8px;color:${accent};font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Your Company</div>
      <div style="font-size:10px;color:rgba(255,255,255,.55);margin-top:1px;">${addr}</div>
      <div class="pd-zone-hint">✏️ Edit</div>
    </div>` : ''}
    <div data-zone="headline1" class="pd-zone" style="position:absolute;left:20px;bottom:90px;cursor:pointer;" title="Click to edit headline">
      <div style="font-size:clamp(20px,4.5vw,34px);font-weight:900;color:#fff;line-height:1;text-transform:uppercase;letter-spacing:-0.5px;text-shadow:0 2px 8px rgba(0,0,0,.8);">${h1}</div>
      <div style="font-size:clamp(26px,5.5vw,42px);font-weight:900;color:${accent};line-height:1;text-transform:uppercase;letter-spacing:-1px;text-shadow:0 2px 8px rgba(0,0,0,.8);">${h2}</div>
      <div class="pd-zone-hint">✏️ Edit Headline</div>
    </div>
    <div data-zone="subhead" class="pd-zone" style="position:absolute;left:20px;bottom:44px;cursor:pointer;max-width:48%;" title="Click to edit subheadline">
      <div style="font-size:11px;color:rgba(255,255,255,.75);line-height:1.4;">${sub}</div>
      <div class="pd-zone-hint">✏️ Edit Sub</div>
    </div>
    <div data-zone="phone" class="pd-zone" style="position:absolute;right:18px;bottom:22px;background:${accent};border-radius:5px;padding:8px 14px;cursor:pointer;text-align:center;min-width:140px;" title="Click to edit CTA">
      <div style="font-size:9px;color:rgba(255,255,255,.8);letter-spacing:1px;text-transform:uppercase;">${cta}</div>
      <div style="font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.5px;">${phone}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.7);">${website}</div>
      <div class="pd-zone-hint">✏️ Edit CTA</div>
    </div>
  `;
}

function pdFrontSolar(accent, phone, website, logoUrl, heroUrl, companyName, addr, cfg, logoScale=100, heroScale=100) {
  const h1 = cfg.tplHeadline1 || 'YOUR HOME IS';
  const h2 = cfg.tplHeadline2 || 'SOLAR READY';
  const sub = cfg.tplSubhead || 'Save up to 80% on your energy bills with a custom solar system.';
  const b1 = cfg.tplBullet1 || 'Free Solar Assessment';
  const b2 = cfg.tplBullet2 || 'Zero Down Financing';
  const b3 = cfg.tplBullet3 || 'Guaranteed Savings';
  const cta = cfg.tplCtaLabel || 'Get Your Free Quote';
  return `
    <div style="position:absolute;inset:0;background:linear-gradient(160deg,#0a1628 0%,#0d2040 100%);"></div>
    ${heroUrl ? `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:45%;height:100%;cursor:pointer;overflow:hidden;">
      <img src="${heroUrl}" style="width:${heroScale}%;height:${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;">
      <div style="position:absolute;inset:0;background:linear-gradient(to right,#0a1628 0%,rgba(10,22,40,.4) 30%,transparent 60%);"></div>
      <div class="pd-zone-hint">📷 Replace Image</div>
    </div>` : `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:45%;height:100%;background:linear-gradient(135deg,#0d2040,#1a3060);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;">
      <div style="font-size:36px;opacity:.3;">☀️</div>
      <div class="pd-zone-hint">📷 Upload Hero Image</div>
    </div>`}
    <div style="position:absolute;right:10px;top:10px;width:50px;height:50px;background:radial-gradient(circle,${accent} 30%,transparent 70%);border-radius:50%;box-shadow:0 0 20px ${accent};pointer-events:none;"></div>
    <div data-zone="logo" class="pd-zone" style="position:absolute;top:18px;left:18px;cursor:pointer;" title="Upload logo">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:32px;max-width:120px;object-fit:contain;">` : `<div style="background:rgba(255,255,255,.08);border:1.5px dashed rgba(255,255,255,.25);border-radius:5px;padding:4px 12px;font-size:12px;font-weight:900;color:${accent};">${companyName}</div>`}
      <div class="pd-zone-hint">🖼 Upload Logo</div>
    </div>
    <div data-zone="headline1" class="pd-zone" style="position:absolute;left:18px;top:50%;transform:translateY(-60%);cursor:pointer;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700;letter-spacing:1px;">${h1}</div>
      <div style="font-size:clamp(24px,4.5vw,36px);font-weight:900;color:${accent};line-height:1;letter-spacing:-1px;">${h2}</div>
      <div class="pd-zone-hint">✏️ Edit Headline</div>
    </div>
    <div data-zone="subhead" class="pd-zone" style="position:absolute;left:18px;bottom:80px;max-width:50%;cursor:pointer;">
      <div style="font-size:10px;color:rgba(255,255,255,.7);line-height:1.4;">${sub}</div>
      <div class="pd-zone-hint">✏️ Edit Sub</div>
    </div>
    <div data-zone="bullet1" class="pd-zone" style="position:absolute;left:18px;bottom:44px;cursor:pointer;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${[b1,b2,b3].map(b=>`<div style="font-size:9px;color:#fff;background:rgba(255,255,255,.1);border-radius:3px;padding:3px 8px;border:1px solid rgba(255,255,255,.15);">✓ ${b}</div>`).join('')}
      </div>
      <div class="pd-zone-hint">✏️ Edit Bullets</div>
    </div>
    <div data-zone="phone" class="pd-zone" style="position:absolute;right:18px;bottom:18px;background:${accent};border-radius:5px;padding:8px 14px;cursor:pointer;text-align:center;min-width:130px;">
      <div style="font-size:9px;color:rgba(0,0,0,.7);letter-spacing:1px;text-transform:uppercase;font-weight:700;">${cta}</div>
      <div style="font-size:17px;font-weight:900;color:#fff;">${phone}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.8);">${website}</div>
      <div class="pd-zone-hint">✏️ Edit CTA</div>
    </div>
  `;
}

function pdFrontGutters(accent, phone, website, logoUrl, heroUrl, companyName, addr, cfg, logoScale=100, heroScale=100) {
  const h1 = cfg.tplHeadline1 || "DON'T FALL VICTIM TO";
  const h2 = cfg.tplHeadline2 || 'CLOGGED GUTTERS';
  const sub = cfg.tplSubhead || 'Protect your home from water damage with professional gutter cleaning and guards.';
  const b1 = cfg.tplBullet1 || 'Licensed & Insured';
  const b2 = cfg.tplBullet2 || 'Free Estimates';
  const b3 = cfg.tplBullet3 || '5-Star Rated';
  const cta = cfg.tplCtaLabel || 'Call for a Free Inspection';
  return `
    <div style="position:absolute;inset:0;background:#0f1a0f;"></div>
    ${heroUrl ? `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:48%;height:100%;cursor:pointer;overflow:hidden;">
      <img src="${heroUrl}" style="width:${heroScale}%;height:${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;">
      <div style="position:absolute;inset:0;background:linear-gradient(to right,#0f1a0f 0%,rgba(15,26,15,.3) 25%,transparent 50%);"></div>
      <div class="pd-zone-hint">📷 Replace Image</div>
    </div>` : `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:48%;height:100%;background:linear-gradient(135deg,#1a3a1a,#0f2a0f);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;">
      <div style="font-size:36px;opacity:.3;">🍂</div>
      <div class="pd-zone-hint">📷 Upload Hero Image</div>
    </div>`}
    <div style="position:absolute;top:0;left:0;right:0;height:28%;background:linear-gradient(90deg,#1a3a1a,#0f2a0f);display:flex;align-items:center;padding:0 18px;pointer-events:none;"></div>
    <div data-zone="headline1" class="pd-zone" style="position:absolute;top:0;left:0;right:52%;height:28%;display:flex;flex-direction:column;justify-content:center;padding:0 18px;cursor:pointer;">
      <div style="font-size:9px;color:rgba(255,255,255,.6);font-weight:700;letter-spacing:1px;">${h1}</div>
      <div style="font-size:clamp(14px,3vw,22px);font-weight:900;color:${accent};line-height:1.1;">${h2}</div>
      <div class="pd-zone-hint">✏️ Edit Headline</div>
    </div>
    <div data-zone="logo" class="pd-zone" style="position:absolute;top:30%;left:18px;cursor:pointer;">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:${Math.round(30*logoScale/100)}px;max-width:${Math.round(110*logoScale/100)}px;object-fit:contain;">` : `<div style="background:rgba(255,255,255,.08);border:1.5px dashed rgba(255,255,255,.2);border-radius:5px;padding:3px 10px;font-size:11px;font-weight:900;color:${accent};">${companyName}</div>`}
      <div class="pd-zone-hint">🖼 Upload Logo</div>
    </div>
    <div data-zone="subhead" class="pd-zone" style="position:absolute;left:18px;top:48%;max-width:48%;cursor:pointer;">
      <div style="font-size:10px;color:rgba(255,255,255,.65);line-height:1.4;">${sub}</div>
      <div class="pd-zone-hint">✏️ Edit Sub</div>
    </div>
    <div data-zone="bullet1" class="pd-zone" style="position:absolute;left:18px;bottom:52px;cursor:pointer;">
      <div style="display:flex;flex-direction:column;gap:3px;">
        ${[b1,b2,b3].map(b=>`<div style="font-size:9px;color:#ccc;"><span style="color:${accent};font-weight:700;">✓</span> ${b}</div>`).join('')}
      </div>
      <div class="pd-zone-hint">✏️ Edit Bullets</div>
    </div>
    <div data-zone="phone" class="pd-zone" style="position:absolute;right:18px;bottom:18px;background:${accent};border-radius:5px;padding:8px 14px;cursor:pointer;text-align:center;min-width:130px;">
      <div style="font-size:9px;color:rgba(0,0,0,.7);letter-spacing:1px;text-transform:uppercase;font-weight:700;">${cta}</div>
      <div style="font-size:17px;font-weight:900;color:#fff;">${phone}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.8);">${website}</div>
      <div class="pd-zone-hint">✏️ Edit CTA</div>
    </div>
  `;
}

function pdFrontRoofing(accent, phone, website, logoUrl, heroUrl, companyName, addr, cfg, logoScale=100, heroScale=100) {
  const h1 = cfg.tplHeadline1 || 'FREE ROOF';
  const h2 = cfg.tplHeadline2 || 'INSPECTION';
  const sub = cfg.tplSubhead || 'We protect your biggest investment. Schedule your free inspection today.';
  const b1 = cfg.tplBullet1 || 'Licensed & Insured';
  const b2 = cfg.tplBullet2 || 'Free Estimates';
  const b3 = cfg.tplBullet3 || 'Financing Available';
  const cta = cfg.tplCtaLabel || 'Schedule Your Free Inspection';
  return `
    <div style="position:absolute;inset:0;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);"></div>
    ${heroUrl ? `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:48%;height:100%;cursor:pointer;overflow:hidden;">
      <img src="${heroUrl}" style="width:${heroScale}%;height:${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;">
      <div style="position:absolute;inset:0;background:linear-gradient(to right,#1a1a2e 0%,rgba(26,26,46,.3) 25%,transparent 50%);"></div>
      <div class="pd-zone-hint">📷 Replace Image</div>
    </div>` : `<div data-zone="heroImage" class="pd-zone" style="position:absolute;top:0;right:0;width:48%;height:100%;background:linear-gradient(135deg,#16213e,#1a2a4a);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;">
      <div style="font-size:36px;opacity:.3;">🏠</div>
      <div class="pd-zone-hint">📷 Upload Hero Image</div>
    </div>`}
    <div style="position:absolute;right:52%;top:20%;width:50px;height:50px;background:${accent};clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);pointer-events:none;"></div>
    <div data-zone="logo" class="pd-zone" style="position:absolute;top:18px;left:18px;cursor:pointer;">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:${Math.round(30*logoScale/100)}px;max-width:${Math.round(110*logoScale/100)}px;object-fit:contain;">` : `<div style="background:rgba(255,255,255,.08);border:1.5px dashed rgba(255,255,255,.2);border-radius:5px;padding:3px 10px;font-size:11px;font-weight:900;color:${accent};">${companyName}</div>`}
      <div class="pd-zone-hint">🖼 Upload Logo</div>
    </div>
    <div data-zone="headline1" class="pd-zone" style="position:absolute;left:18px;top:50%;transform:translateY(-55%);cursor:pointer;">
      <div style="font-size:11px;color:rgba(255,255,255,.6);font-weight:700;letter-spacing:1px;">${h1}</div>
      <div style="font-size:clamp(22px,4vw,34px);font-weight:900;color:${accent};line-height:1;letter-spacing:-1px;">${h2}</div>
      <div class="pd-zone-hint">✏️ Edit Headline</div>
    </div>
    <div data-zone="subhead" class="pd-zone" style="position:absolute;left:18px;bottom:80px;max-width:48%;cursor:pointer;">
      <div style="font-size:10px;color:rgba(255,255,255,.7);line-height:1.4;">${sub}</div>
      <div class="pd-zone-hint">✏️ Edit Sub</div>
    </div>
    <div data-zone="bullet1" class="pd-zone" style="position:absolute;left:18px;bottom:44px;cursor:pointer;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${[b1,b2,b3].map(b=>`<div style="font-size:9px;color:#fff;background:rgba(255,255,255,.08);border-radius:3px;padding:3px 8px;border:1px solid rgba(255,255,255,.12);">✓ ${b}</div>`).join('')}
      </div>
      <div class="pd-zone-hint">✏️ Edit Bullets</div>
    </div>
    <div data-zone="phone" class="pd-zone" style="position:absolute;right:18px;bottom:18px;background:${accent};border-radius:5px;padding:8px 14px;cursor:pointer;text-align:center;min-width:130px;">
      <div style="font-size:9px;color:rgba(0,0,0,.7);letter-spacing:1px;text-transform:uppercase;font-weight:700;">${cta}</div>
      <div style="font-size:17px;font-weight:900;color:#fff;">${phone}</div>
      <div style="font-size:9px;color:rgba(255,255,255,.8);">${website}</div>
      <div class="pd-zone-hint">✏️ Edit CTA</div>
    </div>
  `;
}

/* ─── Back HTML renderer ─────────────────────────────────────── */
function pdBackHtml() {
  const cfg = (S && S.cfg) || {};
  const accent = cfg.tplAccentColor || '#F25C05';
  const phone = cfg.phone || '(555) 000-0000';
  const website = cfg.website || 'www.yourcompany.com';
  const logoUrl = PD.logoDataUrl || cfg.logoData || null;
  const logoWhiten = PD.logoWhiten != null ? PD.logoWhiten : (cfg.tplLogoWhiten != null ? cfg.tplLogoWhiten : true);
  const companyName = cfg.companyName || 'Your Company';
  const hook = cfg.postcardHook || 'Your neighbors are talking about us.';
  const why = cfg.postcardWhy || 'We deliver quality roofing with a lifetime warranty.';
  const guarantee = cfg.postcardGuarantee || '100% Satisfaction Guaranteed';
  return `
    <div style="position:absolute;inset:0;background:#fff;"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:28%;background:linear-gradient(90deg,${accent},${accent}cc);display:flex;align-items:center;padding:0 22px;gap:14px;">
      ${logoUrl ? `<img src="${logoUrl}" style="max-height:36px;max-width:120px;object-fit:contain;${logoWhiten ? 'filter:brightness(10);' : ''}">` : `<div style="font-size:16px;font-weight:900;color:#fff;">${companyName}</div>`}
      <div style="flex:1;"></div>
      <div style="text-align:right;">
        <div style="font-size:13px;font-weight:900;color:#fff;">${phone}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.8);">${website}</div>
      </div>
    </div>
    <div style="position:absolute;top:30%;left:22px;right:50%;bottom:10px;display:flex;flex-direction:column;justify-content:center;gap:8px;">
      <div data-zone="hook" class="pd-zone" style="cursor:pointer;">
        <div style="font-size:12px;font-weight:700;color:#1a1a2e;line-height:1.4;">"${hook}"</div>
        <div class="pd-zone-hint" style="color:${accent};">✏️ Edit Hook</div>
      </div>
      <div data-zone="why" class="pd-zone" style="cursor:pointer;margin-top:6px;">
        <div style="font-size:10px;color:#444;line-height:1.5;">${why}</div>
        <div class="pd-zone-hint" style="color:${accent};">✏️ Edit Why</div>
      </div>
      <div data-zone="guarantee" class="pd-zone" style="cursor:pointer;margin-top:4px;">
        <div style="font-size:10px;font-weight:700;color:${accent};">⭐ ${guarantee}</div>
        <div class="pd-zone-hint" style="color:${accent};">✏️ Edit Guarantee</div>
      </div>
    </div>
    <div style="position:absolute;top:30%;right:0;width:48%;bottom:10px;border-left:1px dashed #ddd;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;">
      <div style="font-size:9px;color:#999;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Mailing Address</div>
      <div style="font-size:11px;font-weight:700;color:#1a1a2e;">HOMEOWNER NAME</div>
      <div style="font-size:10px;color:#555;">123 Sample Street</div>
      <div style="font-size:10px;color:#555;">Your City, MI 48000</div>
      <div style="margin-top:10px;width:60px;height:60px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;">QR Code</div>
    </div>
  `;
}

/* ─── Select a zone and update the right panel ───────────────── */
function pdSelectZone(zoneKey) {
  PD.selectedZone = zoneKey;
  // Highlight selected zone
  document.querySelectorAll('[data-zone]').forEach(el => {
    el.classList.toggle('pd-zone-selected', el.getAttribute('data-zone') === zoneKey);
  });
  pdRenderPropertiesPanel(zoneKey);
}

/* ─── Render the right-panel properties form ────────────────── */
function pdRenderPropertiesPanel(zoneKey) {
  const panel = document.getElementById('pd-props-panel');
  if (!panel) return;
  const id = PD.tplId;
  const zones = PD_ZONES[id] || [];
  const cfg = (S && S.cfg) || {};
  const accent = cfg.tplAccentColor || '#F25C05';

  // Map zone keys to the fields they control
  const zoneFieldMap = {
    headline1:   ['headline1', 'headline2'],
    subhead:     ['subhead'],
    bullet1:     ['bullet1', 'bullet2', 'bullet3'],
    phone:       ['ctaLabel', 'phone', 'website'],
    logo:        ['logo'],
    heroImage:   ['heroImage'],
    companyAddr: [],
    hook:        ['hook'],
    why:         ['why'],
    guarantee:   ['guarantee'],
  };
  const activeFields = zoneKey ? (zoneFieldMap[zoneKey] || []) : [];

  // Build the full properties form
  let html = '';

  // Selected zone indicator
  if (zoneKey) {
    const zoneLabels = {
      headline1: 'Headline', subhead: 'Subheadline', bullet1: 'Bullet Points',
      phone: 'Call to Action', logo: 'Logo', heroImage: 'Hero Image',
      companyAddr: 'Company Info', hook: 'Hook Copy', why: 'Why Us', guarantee: 'Guarantee',
    };
    html += `<div style="background:rgba(242,92,5,.12);border:1px solid var(--accent);border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:var(--accent);font-weight:700;display:flex;align-items:center;gap:6px;">✏️ ${zoneLabels[zoneKey] || zoneKey} — editing</div>`;
  }

  // Brand section (always shown)
  html += `<div class="pd-prop-section">
    <div class="pd-prop-title">Brand</div>
    <div class="pd-prop-row">
      <label class="pd-prop-label">Accent Color</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="color" value="${accent}" oninput="pdSetVal('accentColor',this.value)" style="width:36px;height:30px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0;">
        <input class="pd-prop-input" type="text" value="${accent}" oninput="pdSetVal('accentColor',this.value)" style="width:80px;">
      </div>
    </div>
    <div class="pd-prop-row" style="flex-direction:column;gap:8px;">
      <label class="pd-prop-label">Logo</label>
      ${(()=>{
        const logoSrc = PD.logoDataUrl || cfg.logoData || null;
        const logoScale = PD.logoScale != null ? PD.logoScale : (cfg.tplLogoScale != null ? cfg.tplLogoScale : 100);
        if(logoSrc){
          return `<div style="display:flex;align-items:center;gap:10px;">
            <img src="${logoSrc}" style="max-height:48px;max-width:120px;object-fit:contain;border-radius:4px;background:rgba(255,255,255,.06);padding:4px;border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px;">
              <input type="checkbox" id="pd-logo-whiten" ${(PD.logoWhiten != null ? PD.logoWhiten : (cfg.tplLogoWhiten != null ? cfg.tplLogoWhiten : true)) ? 'checked' : ''} onchange="pdSetLogoWhiten(this.checked)" style="cursor:pointer;accent-color:var(--accent);">
              <label for="pd-logo-whiten" style="font-size:10px;color:var(--muted);cursor:pointer;">Make white on card back</label>
            </div>
            <div style="flex:1;">
              <div data-pd-logo-scale-lbl style="font-size:10px;color:var(--muted);margin-bottom:4px;">Size: ${logoScale}%</div>
              <input type="range" min="30" max="200" value="${logoScale}" oninput="pdSetLogoScale(+this.value)" style="width:100%;accent-color:var(--accent);cursor:pointer;">
            </div>
            <div class="pd-upload-zone" onclick="pdTriggerLogoUpload()" style="min-width:64px;padding:6px 8px;">
              <div style="font-size:14px;">🔄</div>
              <div style="font-size:9px;color:var(--muted);">Replace</div>
            </div>
          </div>`;
        } else {
          return `<div class="pd-upload-zone" onclick="pdTriggerLogoUpload()">
            <div style="font-size:18px;">🖼</div>
            <div style="font-size:11px;color:var(--muted);">Upload Logo</div>
            <div style="font-size:10px;color:var(--muted2);">PNG with transparency · drag or click</div>
          </div>`;
        }
      })()}
    </div>
  </div>`;

  // Headline section
  if (zones.find(z => z.key === 'headline1')) {
    const isActive = activeFields.includes('headline1') || !zoneKey;
    html += `<div class="pd-prop-section ${isActive ? '' : 'pd-prop-dim'}">
      <div class="pd-prop-title">Headline</div>
      <div class="pd-prop-row">
        <label class="pd-prop-label">Line 1</label>
        <input class="pd-prop-input" type="text" value="${escHtml(cfg.tplHeadline1 || zones.find(z=>z.key==='headline1')?.default || '')}" oninput="pdSetVal('headline1',this.value)">
      </div>
      <div class="pd-prop-row">
        <label class="pd-prop-label">Line 2 (accent color)</label>
        <input class="pd-prop-input" type="text" value="${escHtml(cfg.tplHeadline2 || zones.find(z=>z.key==='headline2')?.default || '')}" oninput="pdSetVal('headline2',this.value)">
      </div>
    </div>`;
  }

  // Subheadline
  if (zones.find(z => z.key === 'subhead')) {
    const isActive = activeFields.includes('subhead') || !zoneKey;
    html += `<div class="pd-prop-section ${isActive ? '' : 'pd-prop-dim'}">
      <div class="pd-prop-title">Subheadline</div>
      <div class="pd-prop-row">
        <textarea class="pd-prop-textarea" oninput="pdSetVal('subhead',this.value)">${escHtml(cfg.tplSubhead || zones.find(z=>z.key==='subhead')?.default || '')}</textarea>
      </div>
    </div>`;
  }

  // Bullets
  if (zones.find(z => z.key === 'bullet1')) {
    const isActive = activeFields.includes('bullet1') || !zoneKey;
    html += `<div class="pd-prop-section ${isActive ? '' : 'pd-prop-dim'}">
      <div class="pd-prop-title">Bullet Points</div>
      ${['bullet1','bullet2','bullet3'].map((bk,i) => {
        const def = zones.find(z=>z.key===bk)?.default || '';
        return `<div class="pd-prop-row">
          <label class="pd-prop-label">Bullet ${i+1}</label>
          <input class="pd-prop-input" type="text" value="${escHtml(cfg['tpl'+bk.charAt(0).toUpperCase()+bk.slice(1)] || def)}" oninput="pdSetVal('${bk}',this.value)">
        </div>`;
      }).join('')}
    </div>`;
  }

  // CTA / Contact
  html += `<div class="pd-prop-section ${activeFields.includes('phone') || !zoneKey ? '' : 'pd-prop-dim'}">
    <div class="pd-prop-title">Call to Action</div>
    ${zones.find(z=>z.key==='ctaLabel') ? `<div class="pd-prop-row">
      <label class="pd-prop-label">CTA Label</label>
      <input class="pd-prop-input" type="text" value="${escHtml(cfg.tplCtaLabel || zones.find(z=>z.key==='ctaLabel')?.default || '')}" oninput="pdSetVal('ctaLabel',this.value)">
    </div>` : ''}
    <div class="pd-prop-row">
      <label class="pd-prop-label">Phone</label>
      <input class="pd-prop-input" type="text" value="${escHtml(cfg.phone || '')}" oninput="pdSetVal('phone',this.value)">
    </div>
    <div class="pd-prop-row">
      <label class="pd-prop-label">Website</label>
      <input class="pd-prop-input" type="text" value="${escHtml(cfg.website || '')}" oninput="pdSetVal('website',this.value)">
    </div>
  </div>`;

  // Hero image
  html += `<div class="pd-prop-section ${activeFields.includes('heroImage') || !zoneKey ? '' : 'pd-prop-dim'}">
    <div class="pd-prop-title">Hero Image</div>
    ${(()=>{
      const heroSrc = PD.heroDataUrl || cfg.tplHeroUrl || null;
      const heroScale = PD.heroScale != null ? PD.heroScale : (cfg.tplHeroScale != null ? cfg.tplHeroScale : 100);
      if(heroSrc){
        return `<div style="display:flex;align-items:center;gap:10px;">
          <img src="${heroSrc}" style="width:72px;height:52px;object-fit:cover;border-radius:4px;border:1px solid var(--border);flex-shrink:0;">
          <div style="flex:1;">
            <div data-pd-hero-scale-lbl style="font-size:10px;color:var(--muted);margin-bottom:4px;">Size: ${heroScale}%</div>
            <input type="range" min="30" max="200" value="${heroScale}" oninput="pdSetHeroScale(+this.value)" style="width:100%;accent-color:var(--accent);cursor:pointer;">
          </div>
          <div class="pd-upload-zone" onclick="pdTriggerHeroUpload()" style="min-width:64px;padding:6px 8px;">
            <div style="font-size:14px;">🔄</div>
            <div style="font-size:9px;color:var(--muted);">Replace</div>
          </div>
        </div>`;
      } else {
        return `<div class="pd-upload-zone" onclick="pdTriggerHeroUpload()">
          <div style="font-size:18px;">📷</div>
          <div style="font-size:11px;color:var(--muted);">Upload Photo</div>
          <div style="font-size:10px;color:var(--muted2);">JPG/PNG · right side of card · drag or click</div>
        </div>`;
      }
    })()}
  </div>`;

  // Back copy (shown when on back side)
  if (PD.side === 'back') {
    html += `<div class="pd-prop-section">
      <div class="pd-prop-title">Back Copy</div>
      <div class="pd-prop-row">
        <label class="pd-prop-label">Hook / Quote</label>
        <textarea class="pd-prop-textarea" oninput="pdSetBackVal('postcardHook',this.value)">${escHtml(cfg.postcardHook || '')}</textarea>
      </div>
      <div class="pd-prop-row">
        <label class="pd-prop-label">Why Us</label>
        <textarea class="pd-prop-textarea" oninput="pdSetBackVal('postcardWhy',this.value)">${escHtml(cfg.postcardWhy || '')}</textarea>
      </div>
      <div class="pd-prop-row">
        <label class="pd-prop-label">Guarantee</label>
        <input class="pd-prop-input" type="text" value="${escHtml(cfg.postcardGuarantee || '')}" oninput="pdSetBackVal('postcardGuarantee',this.value)">
      </div>
    </div>`;
  }

  panel.innerHTML = html;
  // Wire drag-and-drop on upload zones (must run after innerHTML is set)
  pdInitUploadZoneDnd();
}

function pdSetBackVal(key, value) {
  if (!S || !S.cfg) return;
  S.cfg[key] = value;
  PD.dirty = true;
  pdRenderPreview();
}

/* ─── Image upload handlers ──────────────────────────────────── */
function pdTriggerLogoUpload() {
  // Reset value so same file can be re-selected
  const inp = document.getElementById('pd-logo-input');
  if(inp){ inp.value=''; inp.click(); }
}
function pdTriggerHeroUpload() {
  const inp = document.getElementById('pd-hero-input');
  if(inp){ inp.value=''; inp.click(); }
}

// Drag-and-drop support for upload zones — wired after panel renders
function pdInitUploadZoneDnd() {
  function wireZone(zoneEl, handler) {
    if(!zoneEl) return;
    zoneEl.addEventListener('dragover', e=>{ e.preventDefault(); zoneEl.style.borderColor='var(--accent)'; }, {passive:false});
    zoneEl.addEventListener('dragleave', ()=>{ zoneEl.style.borderColor=''; });
    zoneEl.addEventListener('drop', e=>{
      e.preventDefault();
      zoneEl.style.borderColor='';
      const file = e.dataTransfer?.files?.[0];
      if(file && file.type.startsWith('image/')) handler({files:[file]});
    });
  }
  // Wire both zones each time the panel re-renders
  const panel = document.getElementById('pd-props-panel');
  if(!panel) return;
  panel.querySelectorAll('.pd-upload-zone').forEach(z=>{
    if(z.dataset.dndWired) return;
    z.dataset.dndWired = '1';
    const isHero = z.getAttribute('onclick')?.includes('Hero');
    wireZone(z, isHero ? pdHandleHeroUpload : pdHandleLogoUpload);
  });
}
function pdHandleLogoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    PD.logoDataUrl = e.target.result;
    PD.dirty = true;
    pdRenderPreview();
    pdRenderPropertiesPanel(PD.selectedZone);
    // Also upload to server for persistence
    _pdUploadImage(file, 'logo');
  };
  reader.readAsDataURL(file);
}
function pdHandleHeroUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    PD.heroDataUrl = e.target.result;
    PD.dirty = true;
    pdRenderPreview();
    pdRenderPropertiesPanel(PD.selectedZone);
    _pdUploadImage(file, 'hero');
  };
  reader.readAsDataURL(file);
}
async function _pdUploadImage(file, type) {
  // Use the same Supabase Storage path as the existing logo/headshot upload in photo.js
  try {
    if (typeof uploadToStorage !== 'function') return; // not loaded yet
    const acctId = (typeof currentAccount !== 'undefined' && currentAccount && currentAccount.id)
                || (S && S.cfg && S.cfg.accountId) || 'shared';
    const ext  = file.type === 'image/png' ? 'png' : 'jpg';
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const path = acctId + '/cfg/postcard-' + type + '.' + ext;
    const url  = await uploadToStorage(file, path, 1200, 0.92, mime);
    if (url) {
      if (type === 'logo') {
        S.cfg.logoData = url;   // same field used by Settings logo upload
        PD.logoDataUrl = url;
      } else {
        S.cfg.tplHeroUrl = url;
        PD.heroDataUrl   = url;
      }
      pdRenderPreview();
      pdRenderPropertiesPanel(PD.selectedZone);
    }
  } catch(e) {
    // Non-fatal — local data URL still works for preview
    console.warn('Image upload to storage failed, using local preview only', e);
  }
}

/* ─── Side toggle ────────────────────────────────────────────── */
function pdSetSide(side) {
  PD.side = side;
  PD.selectedZone = null;
  pdUpdateSideButtons();
  pdRenderPreview();
  pdRenderPropertiesPanel(null);
}
function pdUpdateSideButtons() {
  const btnFront = document.getElementById('pd-btn-front');
  const btnBack  = document.getElementById('pd-btn-back');
  if (btnFront) btnFront.classList.toggle('pd-side-active', PD.side === 'front');
  if (btnBack)  btnBack.classList.toggle('pd-side-active', PD.side === 'back');
}

/* ─── Save design ────────────────────────────────────────────── */
async function pdSaveDesign() {
  if (!S || !S.cfg) return;
  S.cfg.postcardDesign = PD.tplId;
  const btn = document.getElementById('pd-save-btn');
  if (btn) { btn.textContent = '⏳ Saving…'; btn.disabled = true; }
  try {
    await syncAccountToSupabase();
    PD.dirty = false;
    if (btn) { btn.textContent = '✅ Saved!'; btn.disabled = false; }
    setTimeout(() => { if (btn) btn.textContent = '💾 Save Design'; }, 2000);
    toast('Design saved!');
  } catch(e) {
    if (btn) { btn.textContent = '💾 Save Design'; btn.disabled = false; }
    toast('Save failed: ' + e.message, 'error');
  }
}

/* ─── Preview PNG ────────────────────────────────────────────── */
async function pdPreviewPng() {
  const sampleItem = { addr: '123 Sample Street, Your City, MI 48000', total: 8500, id: null, photo_url: null, all_photos: [] };
  toast('Rendering print preview…');
  try {
    const frontDataUrl = await renderFrontCanvasForDesign(sampleItem, PD.tplId);
    const backDataUrl  = await renderPostcard6x9BackCanvas(sampleItem);
    const existing = document.getElementById('pd-preview-modal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'pd-preview-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:14px;overflow-y:auto;';
    modal.innerHTML = `
      <div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:center;">
        <div style="text-align:center;">
          <div style="font-size:11px;color:#8b949e;margin-bottom:6px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Front (6×9 in)</div>
          <img src="${frontDataUrl}" style="max-width:min(540px,90vw);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6);">
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:#8b949e;margin-bottom:6px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;">Back</div>
          <img src="${backDataUrl}" style="max-width:min(540px,90vw);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6);">
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
        <button onclick="pdSaveDesign();document.getElementById('pd-preview-modal').remove()" style="background:#F25C05;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;">✅ Save & Use This Design</button>
        <button onclick="document.getElementById('pd-preview-modal').remove()" style="background:none;color:#8b949e;border:1px solid #30363d;border-radius:8px;padding:10px 16px;font-size:13px;cursor:pointer;">Close</button>
      </div>`;
    document.body.appendChild(modal);
  } catch(err) {
    console.error('pdPreviewPng error', err);
    toast('Preview error: ' + err.message, 'error');
  }
}

/* ─── Trigger upload design (custom) ────────────────────────── */
function pdTriggerUploadDesign() {
  if (typeof openAddDesignModal === 'function') openAddDesignModal();
}

/* ─── Utility ────────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
