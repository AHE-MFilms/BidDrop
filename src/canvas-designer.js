// src/canvas-designer.js
// ─────────────────────────────────────────────────────────────────────────────
// BidDrop Canvas Designer — Contractor Template Filler
// Replaces the old postcard-designer.js zone-click system.
// Loads published canvas_templates from Supabase, renders them in Fabric.js,
// locks all bdLock='locked' elements, and exposes only bdLock='editable' fields
// as a clean form in the right panel.
// ─────────────────────────────────────────────────────────────────────────────

const CD = {
  templates: [],          // published canvas_templates from API
  activeIdx: -1,          // index into CD.templates
  activeTemplate: null,   // full template object (with front_json/back_json)
  side: 'front',          // 'front' | 'back'
  fabricFront: null,      // Fabric.Canvas instance
  fabricBack: null,       // Fabric.Canvas instance (back)
  editableObjs: [],       // objects with bdLock='editable' on current side
  fieldValues: {},        // { objectId: value } — contractor's edits
  dirty: false,
};

const CD_POSTCARD_W = 2775; // 6×9 + 0.125" bleed @ 300 DPI
const CD_POSTCARD_H = 1875;

// ── Init ──────────────────────────────────────────────────────────────────────
async function cdInit() {
  await cdLoadTemplates();
  cdRenderDesignerShell();
}

async function cdLoadTemplates() {
  try {
    const r = await fetch('/api/canvas?action=list&published_only=1');
    CD.templates = await r.json();
    if (!Array.isArray(CD.templates)) CD.templates = [];
  } catch(e) {
    CD.templates = [];
  }
}

// ── Shell HTML ────────────────────────────────────────────────────────────────
function cdRenderDesignerShell() {
  const el = document.getElementById('pd-layout');
  if (!el) return;

  el.innerHTML = `
    <!-- LEFT: Template picker -->
    <div id="cd-left" style="
      background:var(--card);border-right:1px solid var(--border);
      overflow-y:auto;padding:14px 10px;display:flex;flex-direction:column;gap:4px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:10px;">Templates</div>
      <div id="cd-tpl-list">${cdBuildTplListHtml()}</div>
    </div>

    <!-- CENTER: Canvas + side switcher -->
    <div id="cd-center" style="display:flex;flex-direction:column;overflow:hidden;background:#1a1d27;">
      <!-- Side switcher bar -->
      <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--card);flex-shrink:0;">
        <button id="cd-btn-front" class="cd-side-btn cd-side-active" onclick="cdSwitchSide('front')">📄 Card Front</button>
        <button id="cd-btn-back" class="cd-side-btn" onclick="cdSwitchSide('back')">🔄 Card Back</button>
        <div style="flex:1;"></div>
        <button onclick="cdPreviewPng()" style="padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--card2);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;">👁 Preview</button>
        <button onclick="cdSaveDesign()" style="padding:6px 16px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">💾 Save Design</button>
      </div>
      <!-- Canvas wrapper -->
      <div id="cd-canvas-area" style="flex:1;overflow:hidden;padding:24px;display:flex;align-items:flex-start;justify-content:center;">
        <!-- cd-canvas-sizer: sized to scaled dimensions so layout doesn't overflow -->
        <div id="cd-canvas-sizer" style="flex-shrink:0;overflow:hidden;">
          <div id="cd-canvas-wrap" style="transform-origin:top left;box-shadow:0 8px 40px rgba(0,0,0,.5);">
          <canvas id="cd-canvas-front"></canvas>
          <canvas id="cd-canvas-back" style="position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;"></canvas>
          <div id="cd-no-template" style="
            position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
            justify-content:center;color:var(--muted);font-size:13px;gap:8px;
            background:var(--card);border-radius:4px;">
            <span style="font-size:32px;">🎨</span>
            <span>Select a template from the left panel</span>
          </div>
        </div>
        </div><!-- /cd-canvas-sizer -->
      </div>
      <!-- Uploaded designs section -->
      <div style="padding:0 24px 20px;flex-shrink:0;">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
          <span>📁 Your Uploaded Designs</span>
          <button onclick="openAddDesignModal()" style="background:var(--accent);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:700;cursor:pointer;">+ Upload</button>
        </div>
        <div id="designs-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
          <div style="padding:20px;text-align:center;color:var(--muted);font-size:12px;grid-column:1/-1;">Loading designs…</div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Editable fields form -->
    <div id="cd-right" style="
      background:var(--card);border-left:1px solid var(--border);
      overflow-y:auto;padding:0;display:flex;flex-direction:column;">
      <div id="cd-fields-panel">
        <div style="padding:20px 16px;text-align:center;color:var(--muted);font-size:12px;line-height:1.6;">
          Select a template to see<br>the editable fields here.
        </div>
      </div>
    </div>
  `;

  // Init fabric canvases
  CD.fabricFront = new fabric.Canvas('cd-canvas-front', {
    width: CD_POSTCARD_W, height: CD_POSTCARD_H,
    selection: false, hoverCursor: 'default',
  });
  CD.fabricBack = new fabric.Canvas('cd-canvas-back', {
    width: CD_POSTCARD_W, height: CD_POSTCARD_H,
    selection: false, hoverCursor: 'default',
  });

  // Scale canvas to fit — defer so DOM has time to lay out
  requestAnimationFrame(() => { cdFitCanvas(); });
  setTimeout(cdFitCanvas, 100); // second pass for safety
  window.addEventListener('resize', cdFitCanvas);

  // Click on editable objects
  CD.fabricFront.on('mouse:down', e => cdHandleCanvasClick(e, 'front'));
  CD.fabricBack.on('mouse:down', e => cdHandleCanvasClick(e, 'back'));

  // Load first template if available
  if (CD.templates.length > 0) {
    cdSelectTemplate(0);
  }
}

function cdBuildTplListHtml() {
  if (!CD.templates.length) {
    return '<div style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">No templates published yet.<br>Ask your admin to publish templates.</div>';
  }
  return CD.templates.map((t, i) => `
    <div class="cd-tpl-card${CD.activeIdx===i?' cd-tpl-active':''}" onclick="cdSelectTemplate(${i})" style="
      border-radius:8px;border:2px solid ${CD.activeIdx===i?'var(--accent)':'var(--border)'};
      overflow:hidden;cursor:pointer;margin-bottom:8px;transition:border-color .15s;background:var(--card2);">
      <div style="width:100%;aspect-ratio:6/4;background:#1a1d27;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted);">
        ${t.thumbnail_url ? `<img src="${t.thumbnail_url}" style="width:100%;height:100%;object-fit:cover;">` : '🎨'}
      </div>
      <div style="padding:6px 8px;font-size:11px;font-weight:600;color:var(--text);">${t.name}</div>
      <div style="padding:0 8px 6px;font-size:10px;color:var(--muted);">${t.trade||'roofing'}</div>
    </div>
  `).join('');
}

// ── Template selection ────────────────────────────────────────────────────────
async function cdSelectTemplate(idx) {
  CD.activeIdx = idx;
  const tpl = CD.templates[idx];

  // Show loading state
  const noTpl = document.getElementById('cd-no-template');
  if (noTpl) noTpl.style.display = 'none';

  // Fetch full template JSON (includes front_json/back_json)
  try {
    const r = await fetch(`/api/canvas?action=get&id=${tpl.id}`);
    const data = await r.json();
    // Fall back to tpl if response is an error or missing JSON fields
    CD.activeTemplate = (data && !data.error && (data.front_json || data.back_json)) ? data : tpl;
  } catch(e) {
    CD.activeTemplate = tpl;
  }

  CD.side = 'front';
  document.getElementById('cd-btn-front')?.classList.add('cd-side-active');
  document.getElementById('cd-btn-back')?.classList.remove('cd-side-active');

  // Show front canvas, hide back
  const frontEl = document.getElementById('cd-canvas-front');
  const backEl = document.getElementById('cd-canvas-back');
  if (frontEl) { frontEl.style.visibility = ''; frontEl.style.pointerEvents = ''; frontEl.style.position = 'relative'; }
  if (backEl) { backEl.style.visibility = 'hidden'; backEl.style.pointerEvents = 'none'; backEl.style.position = 'absolute'; }

  // Load front JSON into fabric
  await cdLoadSideIntoFabric('front');
  cdRenderFieldsPanel();

  // Refresh template list to show active state
  const listEl = document.getElementById('cd-tpl-list');
  if (listEl) listEl.innerHTML = cdBuildTplListHtml();
}

async function cdLoadSideIntoFabric(side) {
  const fc = side === 'front' ? CD.fabricFront : CD.fabricBack;
  const json = side === 'front' ? CD.activeTemplate?.front_json : CD.activeTemplate?.back_json;

  if (!json) {
    fc.clear();
    fc.setBackgroundColor('#1a1a2e', fc.renderAll.bind(fc));
    return;
  }

  // Sanitize: remove invalid textBaseline values that cause browser warnings
  function sanitizeJson(j) {
    if (!j || !j.objects) return j;
    const VALID_BASELINES = ['alphabetic','top','hanging','middle','ideographic','bottom'];
    j.objects.forEach(o => {
      if (o.textBaseline && !VALID_BASELINES.includes(o.textBaseline)) {
        delete o.textBaseline;
      }
      // Recurse into group objects
      if (o.objects) o.objects.forEach(child => {
        if (child.textBaseline && !VALID_BASELINES.includes(child.textBaseline)) {
          delete child.textBaseline;
        }
      });
    });
    return j;
  }
  const cleanJson = sanitizeJson(typeof json === 'string' ? JSON.parse(json) : JSON.parse(JSON.stringify(json)));

  return new Promise(resolve => {
    fc.loadFromJSON(cleanJson, () => {
      // Apply lock states to all objects
      fc.getObjects().forEach(obj => {
        const lockState = obj.bdLock || 'locked';
        if (lockState === 'locked') {
          // Fully locked — no interaction
          obj.set({
            selectable: false, evented: false,
            hoverCursor: 'default',
          });
        } else if (lockState === 'editable') {
          // Editable — can click to edit content, but not move/resize
          obj.set({
            selectable: true, evented: true,
            lockMovementX: true, lockMovementY: true,
            lockScalingX: true, lockScalingY: true,
            lockRotation: true,
            hasControls: false, hasBorders: true,
            borderColor: '#22c55e', cornerColor: '#22c55e',
            hoverCursor: 'pointer',
          });
        } else {
          // 'free' — contractor can move/resize (for uploaded designs)
          obj.set({
            selectable: true, evented: true,
            borderColor: '#3b82f6', cornerColor: '#3b82f6',
          });
        }
      });
      fc.renderAll();
      // Collect editable objects
      CD.editableObjs = fc.getObjects().filter(o => o.bdLock === 'editable');
      resolve();
    });
  });
}

// ── Side switching ────────────────────────────────────────────────────────────
async function cdSwitchSide(side) {
  if (side === CD.side || !CD.activeTemplate) return;
  CD.side = side;

  const frontEl = document.getElementById('cd-canvas-front');
  const backEl = document.getElementById('cd-canvas-back');
  const btnFront = document.getElementById('cd-btn-front');
  const btnBack = document.getElementById('cd-btn-back');

  if (side === 'front') {
    if (frontEl) { frontEl.style.visibility = ''; frontEl.style.pointerEvents = ''; frontEl.style.position = 'relative'; }
    if (backEl) { backEl.style.visibility = 'hidden'; backEl.style.pointerEvents = 'none'; backEl.style.position = 'absolute'; }
    btnFront?.classList.add('cd-side-active');
    btnBack?.classList.remove('cd-side-active');
    await cdLoadSideIntoFabric('front');
  } else {
    if (frontEl) { frontEl.style.visibility = 'hidden'; frontEl.style.pointerEvents = 'none'; frontEl.style.position = 'absolute'; }
    if (backEl) { backEl.style.visibility = ''; backEl.style.pointerEvents = ''; backEl.style.position = 'relative'; }
    btnFront?.classList.remove('cd-side-active');
    btnBack?.classList.add('cd-side-active');
    await cdLoadSideIntoFabric('back');
  }
  cdFitCanvas();
  cdRenderFieldsPanel();
}

// ── Canvas click handler ──────────────────────────────────────────────────────
function cdHandleCanvasClick(e, side) {
  const obj = e.target;
  if (!obj || obj.bdLock !== 'editable') return;

  // Find the corresponding field in the right panel and highlight/focus it
  const fieldId = 'cd-field-' + obj.__uid;
  const fieldEl = document.getElementById(fieldId);
  if (fieldEl) {
    fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    fieldEl.focus();
    fieldEl.select?.();
    // Flash highlight
    fieldEl.style.borderColor = '#22c55e';
    setTimeout(() => { fieldEl.style.borderColor = ''; }, 1500);
  }
}

// ── Fields panel ──────────────────────────────────────────────────────────────
function cdRenderFieldsPanel() {
  const panel = document.getElementById('cd-fields-panel');
  if (!panel) return;

  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  const editables = fc.getObjects().filter(o => o.bdLock === 'editable');

  if (!editables.length) {
    panel.innerHTML = `
      <div style="padding:16px;border-bottom:1px solid var(--border);">
        <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:8px;">Your Info</div>
        <div style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;line-height:1.6;">
          No editable fields on this side.<br>Switch to the other side or select a different template.
        </div>
      </div>
      ${cdBrandFieldsHtml()}
    `;
    return;
  }

  // Assign UIDs to objects for stable field IDs
  editables.forEach((o, i) => { if (!o.__uid) o.__uid = i; });

  const fieldsHtml = editables.map(obj => {
    const label = cdFieldLabel(obj);
    const uid = obj.__uid;
    const currentVal = CD.fieldValues[uid] ?? (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text' ? obj.text : '');

    if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
      const isMultiline = (obj.text || '').includes('\n') || (obj.height || 0) > 60;
      return `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">${label}</label>
          ${isMultiline
            ? `<textarea id="cd-field-${uid}" rows="3" oninput="cdUpdateTextField(${uid}, this.value)"
                style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;padding:6px 8px;resize:vertical;font-family:inherit;outline:none;"
                >${escHtml(currentVal)}</textarea>`
            : `<input type="text" id="cd-field-${uid}" value="${escHtml(currentVal)}" oninput="cdUpdateTextField(${uid}, this.value)"
                style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;padding:6px 8px;outline:none;">`
          }
        </div>
      `;
    }

    if (obj.bdZoneLabel === 'logo' || obj.bdZoneLabel === 'logoImage') {
      return `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">${label}</label>
          <div onclick="cdTriggerImageUpload(${uid}, 'logo')" style="
            border:1.5px dashed var(--border);border-radius:6px;padding:12px;text-align:center;
            cursor:pointer;transition:border-color .15s;font-size:12px;color:var(--muted);"
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            ${CD.fieldValues[uid] ? '<img src="'+CD.fieldValues[uid]+'" style="max-height:50px;max-width:100%;object-fit:contain;">' : '📷 Upload Logo'}
          </div>
        </div>
      `;
    }

    if (obj.bdZoneLabel && obj.bdZoneLabel.includes('hero') || obj.bdZoneLabel === 'housePhoto') {
      return `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">${label}</label>
          <div onclick="cdTriggerImageUpload(${uid}, 'hero')" style="
            border:1.5px dashed var(--border);border-radius:6px;padding:12px;text-align:center;
            cursor:pointer;transition:border-color .15s;font-size:12px;color:var(--muted);"
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            ${CD.fieldValues[uid] ? '<img src="'+CD.fieldValues[uid]+'" style="max-height:80px;max-width:100%;object-fit:cover;border-radius:4px;">' : '🏠 Upload House Photo'}
          </div>
        </div>
      `;
    }

    // Generic image zone
    if (obj.type === 'image' || obj.bdZoneLabel) {
      return `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">${label}</label>
          <div onclick="cdTriggerImageUpload(${uid}, 'generic')" style="
            border:1.5px dashed var(--border);border-radius:6px;padding:12px;text-align:center;
            cursor:pointer;transition:border-color .15s;font-size:12px;color:var(--muted);"
            onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            ${CD.fieldValues[uid] ? '<img src="'+CD.fieldValues[uid]+'" style="max-height:80px;max-width:100%;object-fit:cover;border-radius:4px;">' : '📷 Upload Image'}
          </div>
        </div>
      `;
    }

    return '';
  }).join('');

  panel.innerHTML = `
    <div style="padding:16px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:14px;">
        ${CD.side === 'front' ? '📄 Front Side' : '🔄 Back Side'} — Editable Fields
      </div>
      ${fieldsHtml}
    </div>
    ${cdBrandFieldsHtml()}
    <div style="padding:16px;border-top:1px solid var(--border);">
      <button onclick="cdApplyAllFields()" style="
        width:100%;padding:10px;background:var(--accent);color:#fff;border:none;
        border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;">
        ✓ Apply to Preview
      </button>
      <button onclick="cdSaveDesign()" style="
        width:100%;padding:10px;background:var(--green,#22c55e);color:#fff;border:none;
        border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;">
        💾 Save Design
      </button>
    </div>
  `;
}

function cdBrandFieldsHtml() {
  // Pre-fill from S.cfg if available
  const phone = (typeof S !== 'undefined' && S.cfg?.phone) || '';
  const website = (typeof S !== 'undefined' && S.cfg?.website) || '';
  return `
    <div style="padding:16px;border-top:1px solid var(--border);">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:var(--muted);text-transform:uppercase;margin-bottom:12px;">Brand Info</div>
      <div style="margin-bottom:10px;">
        <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Phone</label>
        <input type="tel" id="cd-brand-phone" value="${escHtml(phone)}" placeholder="555-555-5555"
          style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;padding:6px 8px;outline:none;"
          oninput="CD.dirty=true">
      </div>
      <div style="margin-bottom:10px;">
        <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">Website</label>
        <input type="text" id="cd-brand-website" value="${escHtml(website)}" placeholder="yourcompany.com"
          style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;padding:6px 8px;outline:none;"
          oninput="CD.dirty=true">
      </div>
    </div>
  `;
}

function cdFieldLabel(obj) {
  if (obj.bdZoneLabel) {
    const labels = {
      heroImage: 'House Photo', housePhoto: 'House Photo', logo: 'Logo',
      logoImage: 'Logo', headline1: 'Headline', headline2: 'Sub-Headline',
      subtext: 'Body Text', cta: 'Call to Action', phone: 'Phone',
      website: 'Website', guarantee: 'Guarantee Text', qrCode: 'QR Code',
    };
    return labels[obj.bdZoneLabel] || obj.bdZoneLabel;
  }
  if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
    const t = (obj.text || '').substring(0, 30);
    return t || 'Text Field';
  }
  return 'Image Field';
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Field update handlers ─────────────────────────────────────────────────────
function cdUpdateTextField(uid, value) {
  CD.fieldValues[uid] = value;
  CD.dirty = true;
  // Live update the fabric object
  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  const obj = fc.getObjects().find(o => o.__uid === uid);
  if (obj && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
    obj.set('text', value);
    fc.renderAll();
  }
}

function cdTriggerImageUpload(uid, zoneType) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      CD.fieldValues[uid] = ev.target.result;
      CD.dirty = true;
      // Update fabric object
      const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
      const obj = fc.getObjects().find(o => o.__uid === uid);
      if (obj) {
        fabric.Image.fromURL(ev.target.result, img => {
          // Replace the zone rect/image with the uploaded image
          // Use cover-fit: scale uniformly so image fills the zone without squishing
          const left = obj.left, top = obj.top;
          const w = (obj.width || 100) * (obj.scaleX || 1);
          const h = (obj.height || 100) * (obj.scaleY || 1);
          // Cover scale: fill the zone while preserving aspect ratio
          const coverScale = Math.max(w / img.width, h / img.height);
          // Center the image within the zone
          const offsetX = (img.width * coverScale - w) / 2;
          const offsetY = (img.height * coverScale - h) / 2;
          img.set({
            left: left - offsetX,
            top: top - offsetY,
            scaleX: coverScale,
            scaleY: coverScale,
            selectable: true, evented: true,
            lockMovementX: true, lockMovementY: true,
            lockScalingX: true, lockScalingY: true, lockRotation: true,
            hasControls: false, hasBorders: true,
            borderColor: '#22c55e', cornerColor: '#22c55e',
            bdLock: 'editable', bdZoneLabel: obj.bdZoneLabel, __uid: uid,
            // Clip to the original zone bounds so overflow is hidden
            clipPath: new fabric.Rect({
              left: offsetX / coverScale,
              top: offsetY / coverScale,
              width: w / coverScale,
              height: h / coverScale,
              absolutePositioned: false,
            }),
          });
          fc.remove(obj);
          fc.add(img);
          fc.renderAll();
        });
      }
      // Re-render fields panel to show thumbnail
      cdRenderFieldsPanel();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function cdApplyAllFields() {
  // Already applied live via oninput — just re-render
  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  fc.renderAll();
  cdShowToast('Applied ✓', 'ok');
}

// ── Fit canvas to container ───────────────────────────────────────────────────
function cdFitCanvas() {
  const area = document.getElementById('cd-canvas-area');
  if (!area) return;
  const aw = area.clientWidth - 48;
  const ah = area.clientHeight - 48;
  if (aw <= 0 || ah <= 0) return; // not laid out yet
  const scale = Math.min(aw / CD_POSTCARD_W, ah / CD_POSTCARD_H);
  const wrap = document.getElementById('cd-canvas-wrap');
  const sizer = document.getElementById('cd-canvas-sizer');
  if (!wrap || !sizer) return;
  // Scale the inner wrap from top-left
  wrap.style.transform = `scale(${scale})`;
  wrap.style.transformOrigin = 'top left';
  // Set the sizer to the scaled dimensions so the layout collapses correctly
  const scaledW = Math.round(CD_POSTCARD_W * scale);
  const scaledH = Math.round(CD_POSTCARD_H * scale);
  sizer.style.width = `${scaledW}px`;
  sizer.style.height = `${scaledH}px`;
}

// ── Preview PNG ───────────────────────────────────────────────────────────────
function cdPreviewPng() {
  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  if (!fc) return;
  const dataUrl = fc.toDataURL({ format: 'png', multiplier: 1 }); // canvas is already at 300 DPI
  const win = window.open();
  if (win) {
    win.document.write(`<html><body style="margin:0;background:#000;"><img src="${dataUrl}" style="max-width:100%;"></body></html>`);
  }
}

// ── Save design ───────────────────────────────────────────────────────────────
function cdSaveDesign() {
  if (!CD.activeTemplate) {
    cdShowToast('Select a template first', 'err'); return;
  }
  // Collect current canvas state as the "contractor customization"
  const frontJson = CD.fabricFront.toJSON(['bdLock','bdEditable','bdZoneLabel','__uid']);
  const backJson = CD.fabricBack.toJSON(['bdLock','bdEditable','bdZoneLabel','__uid']);

  // Save to S.cfg for use in dispatch/print
  if (typeof S !== 'undefined') {
    S.cfg.canvasDesignFrontJson = frontJson;
    S.cfg.canvasDesignBackJson = backJson;
    S.cfg.canvasTemplateId = CD.activeTemplate.id;
    S.cfg.canvasTemplateName = CD.activeTemplate.name;
    if (typeof save === 'function') save();
  }
  CD.dirty = false;
  cdShowToast('Design saved ✓', 'ok');
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let cdToastTimer;
function cdShowToast(msg, type='ok') {
  // Reuse existing toast if available
  if (typeof showToast === 'function') { showToast(msg); return; }
  const t = document.getElementById('cd-toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'cd-toast show ' + type;
  clearTimeout(cdToastTimer);
  cdToastTimer = setTimeout(() => { t.className = 'cd-toast'; }, 3000);
}

// ── CSS injected once ─────────────────────────────────────────────────────────
(function injectCdStyles() {
  if (document.getElementById('cd-styles')) return;
  const s = document.createElement('style');
  s.id = 'cd-styles';
  s.textContent = `
    .cd-side-btn {
      padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border);
      background: var(--card2); color: var(--muted); font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all .15s;
    }
    .cd-side-btn:hover { border-color: var(--accent); color: var(--accent); }
    .cd-side-active { background: var(--accent) !important; border-color: var(--accent) !important; color: #fff !important; }
    .cd-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: var(--card); border: 1px solid var(--border); border-radius: 8px;
      padding: 10px 20px; font-size: 13px; font-weight: 500; z-index: 999;
      opacity: 0; transition: opacity .3s; pointer-events: none; white-space: nowrap;
    }
    .cd-toast.show { opacity: 1; }
    .cd-toast.ok { border-color: #22c55e; color: #22c55e; }
    .cd-toast.err { border-color: #ef4444; color: #ef4444; }
    #cd-canvas-wrap { transform-origin: top left; }
  `;
  document.head.appendChild(s);
})();

// ── Expose globally ───────────────────────────────────────────────────────────
window.cdInit = cdInit;
window.cdSelectTemplate = cdSelectTemplate;
window.cdSwitchSide = cdSwitchSide;
window.cdUpdateTextField = cdUpdateTextField;
window.cdTriggerImageUpload = cdTriggerImageUpload;
window.cdApplyAllFields = cdApplyAllFields;
window.cdSaveDesign = cdSaveDesign;
window.cdPreviewPng = cdPreviewPng;
