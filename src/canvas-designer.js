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
  freeEditMode: false,    // when true, all objects can be moved/resized
};

const CD_POSTCARD_W = 2775; // 6×9 + 0.125" bleed @ 300 DPI
const CD_POSTCARD_H = 1875;

// ── Init ──────────────────────────────────────────────────────────────────────
async function cdInit() {
  await cdLoadTemplates();
  cdRenderDesignerShell();
}

// ── Snapshot / restore field values across side switches ─────────────────────
// Saves the current canvas text/image state into CD.fieldValues keyed by side
function cdSnapshotFieldValues(side) {
  const fc = side === 'front' ? CD.fabricFront : CD.fabricBack;
  if (!fc) return;
  fc.getObjects().forEach(obj => {
    if (obj.__uid == null) return;
    if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
      CD.fieldValues[obj.__uid] = obj.text;
    } else if (obj.bdLock === 'free' && obj.type === 'image') {
      // Uploaded image — store as data URL so it can be re-placed on restore
      try { CD.fieldValues[obj.__uid] = obj.toDataURL(); } catch(e) {}
    }
  });
}

// Re-applies saved CD.fieldValues onto the freshly-loaded canvas side
function cdRestoreFieldValues(side) {
  const fc = side === 'front' ? CD.fabricFront : CD.fabricBack;
  if (!fc) return;
  fc.getObjects().forEach(obj => {
    if (obj.__uid == null || CD.fieldValues[obj.__uid] == null) return;
    const val = CD.fieldValues[obj.__uid];
    if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
      obj.set('text', val);
    } else if (obj.bdLock === 'editable' && typeof val === 'string' && val.startsWith('data:image')) {
      // Re-place uploaded image over the placeholder zone
      const zoneLeft = obj.left, zoneTop = obj.top;
      const zoneW = (obj.width||100)*(obj.scaleX||1), zoneH = (obj.height||100)*(obj.scaleY||1);
      const uid = obj.__uid, zoneLabel = obj.bdZoneLabel;
      fabric.Image.fromURL(val, img => {
        const s = Math.min(zoneW/img.width, zoneH/img.height);
        img.set({
          left: zoneLeft+(zoneW-img.width*s)/2, top: zoneTop+(zoneH-img.height*s)/2,
          scaleX: s, scaleY: s,
          selectable:true, evented:true,
          lockMovementX:false, lockMovementY:false,
          lockScalingX:false, lockScalingY:false, lockRotation:false,
          hasControls:true, hasBorders:true,
          borderColor:'#3b82f6', cornerColor:'#3b82f6', hoverCursor:'move',
          bdLock:'free', bdZoneLabel:zoneLabel, __uid:uid,
          _zoneLeft:zoneLeft, _zoneTop:zoneTop, _zoneW:zoneW, _zoneH:zoneH,
        });
        fc.remove(obj);
        fc.add(img);
        fc.renderAll();
      });
    }
  });
  fc.renderAll();
}

async function cdLoadTemplates() {
  try {
    const r = await fetch('/api/canvas?action=list&published_only=1');
    CD.templates = await r.json();
    if (!Array.isArray(CD.templates)) CD.templates = [];
  } catch(e) {
    CD.templates = [];
  }
  // FIX #7: Generate thumbnails for templates that don't have one
  // We do this lazily in the background after the shell renders
  setTimeout(cdGenerateMissingThumbnails, 500);
}

// FIX #7: Auto-generate thumbnail previews from template front_json
// Renders each template's front JSON onto a tiny off-screen canvas and
// caches the result as a data URL so the template list shows real previews
async function cdGenerateMissingThumbnails() {
  const THUMB_W = 360, THUMB_H = 240;
  for (let i = 0; i < CD.templates.length; i++) {
    const t = CD.templates[i];
    if (t._thumbDataUrl) continue; // already generated this session
    // Fetch full template JSON if not already loaded
    let frontJson = t.front_json;
    if (!frontJson) {
      try {
        const r = await fetch(`/api/canvas?action=get&id=${t.id}`);
        const data = await r.json();
        if (data && data.front_json) {
          frontJson = data.front_json;
          t.front_json = frontJson; // cache for later
          t.back_json = data.back_json;
        }
      } catch(e) { continue; }
    }
    if (!frontJson) continue;
    // Render to off-screen canvas
    try {
      const thumbDataUrl = await new Promise(resolve => {
        const el = document.createElement('canvas');
        el.width = THUMB_W; el.height = THUMB_H;
        const fc = new fabric.StaticCanvas(el, { width: THUMB_W, height: THUMB_H });
        const scale = THUMB_W / CD_POSTCARD_W;
        fc.setZoom(scale);
        const cleanJson = typeof frontJson === 'string' ? JSON.parse(frontJson) : JSON.parse(JSON.stringify(frontJson));
        fc.loadFromJSON(cleanJson, () => {
          fc.renderAll();
          resolve(fc.toDataURL({ format: 'jpeg', quality: 0.7 }));
          fc.dispose();
        });
      });
      t._thumbDataUrl = thumbDataUrl;
      // Update the thumbnail in the list DOM without re-rendering the whole list
      const thumbEl = document.querySelector(`#cd-tpl-list .cd-tpl-card:nth-child(${i+1}) div:first-child`);
      if (thumbEl) {
        thumbEl.innerHTML = `<img src="${thumbDataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
      }
    } catch(e) { /* skip if render fails */ }
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
        <button id="cd-btn-free-edit" onclick="cdToggleFreeEdit()" title="Unlock all elements to freely move and resize them" style="padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--card2);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;">🔓 Free Edit</button>
        <!-- Layer controls — shown only when an object is selected (#8 fix: compact for mobile) -->
        <div id="cd-layer-controls" style="display:none;align-items:center;gap:2px;">
          <span style="font-size:10px;color:var(--muted);font-weight:600;margin-right:2px;white-space:nowrap;">LAYER:</span>
          <button onclick="cdLayerAction('front')" title="Bring to Front" style="padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:var(--card2);color:var(--text);font-size:11px;cursor:pointer;">⬆</button>
          <button onclick="cdLayerAction('forward')" title="Bring Forward" style="padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:var(--card2);color:var(--text);font-size:11px;cursor:pointer;">↑</button>
          <button onclick="cdLayerAction('backward')" title="Send Backward" style="padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:var(--card2);color:var(--text);font-size:11px;cursor:pointer;">↓</button>
          <button onclick="cdLayerAction('back')" title="Send to Background" style="padding:4px 7px;border:1px solid var(--border);border-radius:5px;background:var(--card2);color:var(--text);font-size:11px;cursor:pointer;">⬇</button>
        </div>
        <button onclick="cdPreviewPng()" style="padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--card2);color:var(--text);font-size:12px;font-weight:600;cursor:pointer;">👁 Preview</button>
        <button onclick="cdSaveDesign()" style="padding:6px 16px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;">💾 Save Design</button>
      </div>
      <!-- Canvas wrapper: single canvas shown at a time via display toggle -->
      <!-- No CSS transform scaling — Fabric setZoom/setDimensions handles sizing -->
      <div id="cd-canvas-area" style="flex:1;overflow:hidden;padding:24px;display:flex;align-items:flex-start;justify-content:center;">
        <div id="cd-canvas-sizer" style="flex-shrink:0;">
          <div id="cd-canvas-wrap" style="box-shadow:0 8px 40px rgba(0,0,0,.5);position:relative;">
            <div id="cd-front-wrap"><canvas id="cd-canvas-front"></canvas></div>
            <div id="cd-back-wrap" style="display:none;"><canvas id="cd-canvas-back"></canvas></div>
            <div id="cd-no-template" style="
              position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
              justify-content:center;color:var(--muted);font-size:13px;gap:8px;
              background:var(--card);border-radius:4px;">
              <span style="font-size:32px;">🎨</span>
              <span>Select a template from the left panel</span>
            </div>
          </div>
        </div>
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

  // Init fabric canvases at native resolution — zoom is applied via setZoom/setDimensions
  // so touch/click coordinates always match object positions (no CSS transform mismatch)
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

  // Show/hide layer controls when selection changes
  const showLayerControls = () => {
    const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
    const active = fc.getActiveObject();
    const lc = document.getElementById('cd-layer-controls');
    if (lc) lc.style.display = active ? 'flex' : 'none';
  };
  CD.fabricFront.on('selection:created', showLayerControls);
  CD.fabricFront.on('selection:updated', showLayerControls);
  CD.fabricFront.on('selection:cleared', showLayerControls);
  CD.fabricBack.on('selection:created', showLayerControls);
  CD.fabricBack.on('selection:updated', showLayerControls);
  CD.fabricBack.on('selection:cleared', showLayerControls);

  // FIX #5: Restore last-used template from saved config, or fall back to first template
  if (CD.templates.length > 0) {
    const savedTemplateId = typeof S !== 'undefined' && S.cfg?.canvasTemplateId;
    let startIdx = 0;
    if (savedTemplateId) {
      const found = CD.templates.findIndex(t => t.id === savedTemplateId);
      if (found >= 0) startIdx = found;
    }
    cdSelectTemplate(startIdx);
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
      <div style="width:100%;aspect-ratio:6/4;background:#1a1d27;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted);overflow:hidden;">
        ${t._thumbDataUrl
          ? `<img src="${t._thumbDataUrl}" style="width:100%;height:100%;object-fit:cover;">`
          : t.thumbnail_url
            ? `<img src="${t.thumbnail_url}" style="width:100%;height:100%;object-fit:cover;">`
            : '<span style="font-size:24px;">🎨</span>'}
      </div>
      <div style="padding:6px 8px;font-size:11px;font-weight:600;color:var(--text);">${t.name}</div>
      <div style="padding:0 8px 6px;font-size:10px;color:var(--muted);">${t.trade||'roofing'}</div>
    </div>
  `).join('');
}

// ── Template selection ────────────────────────────────────────────────────────
async function cdSelectTemplate(idx) {
  // FIX #6: Warn before wiping unsaved changes when switching templates
  if (CD.dirty && CD.activeIdx >= 0 && idx !== CD.activeIdx) {
    bdConfirm('You have unsaved changes. Switch templates and lose your edits?', () => { cdSelectTemplate._doSwitch(idx); });
    return;
  }
  cdSelectTemplate._doSwitch = cdSelectTemplate._doSwitch || ((i) => { CD.dirty = false; cdSelectTemplate(i); });

  CD.activeIdx = idx;
  // Reset field values when switching to a new template
  CD.fieldValues = {};
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
  CD.freeEditMode = false; // reset free edit on template change
  document.getElementById('cd-btn-front')?.classList.add('cd-side-active');
  document.getElementById('cd-btn-back')?.classList.remove('cd-side-active');

  // Show front wrap, hide back wrap
  const frontWrap = document.getElementById('cd-front-wrap');
  const backWrap = document.getElementById('cd-back-wrap');
  if (frontWrap) frontWrap.style.display = '';
  if (backWrap) backWrap.style.display = 'none';

  // Reset free edit button appearance
  const freeBtn = document.getElementById('cd-btn-free-edit');
  if (freeBtn) {
    freeBtn.style.background = 'var(--card2)';
    freeBtn.style.color = 'var(--muted)';
    freeBtn.style.borderColor = 'var(--border)';
    freeBtn.textContent = '🔓 Free Edit';
  }

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
          // bdNoSelect:true suppresses selection handles (used for photo upload zones)
          const noSel = obj.bdNoSelect === true;
          obj.set({
            selectable: !noSel, evented: true,
            lockMovementX: true, lockMovementY: true,
            lockScalingX: true, lockScalingY: true,
            lockRotation: true,
            hasControls: false, hasBorders: !noSel,
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

  // FIX #3: Snapshot current side's field values before switching
  cdSnapshotFieldValues(CD.side);

  CD.side = side;

  const frontWrap = document.getElementById('cd-front-wrap');
  const backWrap = document.getElementById('cd-back-wrap');
  const btnFront = document.getElementById('cd-btn-front');
  const btnBack = document.getElementById('cd-btn-back');

  if (side === 'front') {
    if (frontWrap) frontWrap.style.display = '';
    if (backWrap) backWrap.style.display = 'none';
    btnFront?.classList.add('cd-side-active');
    btnBack?.classList.remove('cd-side-active');
    await cdLoadSideIntoFabric('front');
    cdRestoreFieldValues('front');
  } else {
    if (frontWrap) frontWrap.style.display = 'none';
    if (backWrap) backWrap.style.display = '';
    btnFront?.classList.remove('cd-side-active');
    btnBack?.classList.add('cd-side-active');
    await cdLoadSideIntoFabric('back');
    cdRestoreFieldValues('back');
  }

  // FIX #9: Re-apply free edit mode to the newly loaded side if active
  if (CD.freeEditMode) {
    const fc = side === 'front' ? CD.fabricFront : CD.fabricBack;
    fc.getObjects().forEach(obj => {
      obj.set({
        selectable: true, evented: true,
        lockMovementX: false, lockMovementY: false,
        lockScalingX: false, lockScalingY: false, lockRotation: false,
        hasControls: true, hasBorders: true,
        borderColor: '#3b82f6', cornerColor: '#3b82f6',
        hoverCursor: 'move',
      });
    });
    fc.selection = true;
    fc.renderAll();
    // Keep the button in its active state
    const btn = document.getElementById('cd-btn-free-edit');
    if (btn) {
      btn.style.background = '#3b82f6';
      btn.style.color = '#fff';
      btn.style.borderColor = '#3b82f6';
      btn.textContent = '🔒 Lock Layout';
    }
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

    // FIX #4: Skip image objects that are misidentified — only render text inputs for actual text types
    // An image object whose value is a base64 data URL should never appear as a text input
    const isImageObj = obj.type === 'image' || (typeof currentVal === 'string' && currentVal.startsWith('data:image'));
    if (!isImageObj && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
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

    // Image zones — show upload button + delete button if image is uploaded
    // FIX #4: Also catches image objects and base64 values that slipped through text detection
    const hasImage = !!CD.fieldValues[uid];
    const isLogo = obj.bdZoneLabel === 'logo' || obj.bdZoneLabel === 'logoImage';
    const isHero = (obj.bdZoneLabel && obj.bdZoneLabel.includes('hero')) || obj.bdZoneLabel === 'housePhoto';
    const uploadLabel = isLogo ? '📷 Upload Logo' : isHero ? '🏠 Upload House Photo' : '📷 Upload Image';
    const zoneType = isLogo ? 'logo' : isHero ? 'hero' : 'generic';

    if (obj.type === 'image' || obj.bdZoneLabel) {
      return `
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:11px;color:var(--muted);margin-bottom:4px;">${label}</label>
          <div style="display:flex;gap:6px;align-items:flex-start;">
            <div onclick="cdTriggerImageUpload(${uid}, '${zoneType}')" style="
              flex:1;border:1.5px dashed var(--border);border-radius:6px;padding:10px;text-align:center;
              cursor:pointer;transition:border-color .15s;font-size:12px;color:var(--muted);"
              onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
              ${hasImage
                ? `<img src="${CD.fieldValues[uid]}" style="max-height:60px;max-width:100%;object-fit:contain;">`
                : uploadLabel}
            </div>
            ${hasImage ? `<button onclick="cdClearImage(${uid})" title="Remove image" style="
              flex-shrink:0;padding:6px 8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);
              border-radius:6px;color:#ef4444;font-size:13px;cursor:pointer;line-height:1;" 
              onmouseover="this.style.background='rgba(239,68,68,.3)'" onmouseout="this.style.background='rgba(239,68,68,.15)'">🗑</button>` : ''}
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
          // Get the zone bounds
          const zoneLeft = obj.left;
          const zoneTop = obj.top;
          const zoneW = (obj.width || 100) * (obj.scaleX || 1);
          const zoneH = (obj.height || 100) * (obj.scaleY || 1);

          // Cover-fill: scale image to fill the zone completely (crop edges), preserving aspect ratio
          const coverScale = Math.max(zoneW / img.width, zoneH / img.height);
          const scaledW = img.width * coverScale;
          const scaledH = img.height * coverScale;

          // Center within the zone (edges may be cropped by clipPath)
          const centeredLeft = zoneLeft + (zoneW - scaledW) / 2;
          const centeredTop = zoneTop + (zoneH - scaledH) / 2;

          // ClipPath rect — clips image to exact zone bounds
          const clip = new fabric.Rect({
            left: zoneLeft, top: zoneTop,
            width: zoneW, height: zoneH,
            absolutePositioned: true,
          });

          img.set({
            left: centeredLeft,
            top: centeredTop,
            scaleX: coverScale,
            scaleY: coverScale,
            clipPath: clip,
            // Fully locked — photos cannot be moved, resized, or selected
            selectable: false, evented: false,
            lockMovementX: true, lockMovementY: true,
            lockScalingX: true, lockScalingY: true, lockRotation: true,
            hasControls: false, hasBorders: false,
            hoverCursor: 'default',
            bdLock: 'locked', bdZoneLabel: obj.bdZoneLabel, __uid: uid,
            // Store zone bounds for delete/restore
            _zoneLeft: zoneLeft, _zoneTop: zoneTop, _zoneW: zoneW, _zoneH: zoneH,
          });
          fc.remove(obj);
          fc.add(img);
          fc.discardActiveObject();
          fc.renderAll();
        });
      }
      // Re-render fields panel to show thumbnail + delete button
      cdRenderFieldsPanel();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// ── Clear (delete) an uploaded image, restoring the original zone placeholder ─
function cdClearImage(uid) {
  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  const img = fc.getObjects().find(o => o.__uid === uid);
  if (!img) {
    // Image not on canvas — just clear field value and re-render panel
    delete CD.fieldValues[uid];
    cdRenderFieldsPanel();
    return;
  }

  // Restore a placeholder rect in the original zone position
  const zoneLeft = img._zoneLeft ?? img.left;
  const zoneTop = img._zoneTop ?? img.top;
  const zoneW = img._zoneW ?? (img.width * img.scaleX);
  const zoneH = img._zoneH ?? (img.height * img.scaleY);
  const zoneLabel = img.bdZoneLabel;

  const placeholder = new fabric.Rect({
    left: zoneLeft, top: zoneTop,
    width: zoneW, height: zoneH,
    scaleX: 1, scaleY: 1,
    fill: 'rgba(255,255,255,0.05)',
    stroke: '#3b82f6', strokeWidth: 4, strokeDashArray: [20, 10],
    rx: 8, ry: 8,
    selectable: true, evented: true,
    lockMovementX: true, lockMovementY: true,
    lockScalingX: true, lockScalingY: true, lockRotation: true,
    hasControls: false, hasBorders: true,
    borderColor: '#22c55e', cornerColor: '#22c55e',
    hoverCursor: 'pointer',
    bdLock: 'editable', bdZoneLabel: zoneLabel, __uid: uid,
  });

  fc.remove(img);
  fc.add(placeholder);
  fc.renderAll();

  delete CD.fieldValues[uid];
  CD.dirty = true;
  cdRenderFieldsPanel();
}

function cdApplyAllFields() {
  // Already applied live via oninput — just re-render
  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  fc.renderAll();
  cdShowToast('Applied ✓', 'ok');
}

// ── Fit canvas to container ───────────────────────────────────────────────────
// Uses Fabric setZoom + setDimensions instead of CSS transform so that
// touch/click coordinates always match object positions on screen.
function cdFitCanvas() {
  const area = document.getElementById('cd-canvas-area');
  if (!area) return;
  const aw = area.clientWidth - 48;
  const ah = area.clientHeight - 48;
  if (aw <= 0 || ah <= 0) return;
  const scale = Math.min(aw / CD_POSTCARD_W, ah / CD_POSTCARD_H);
  const scaledW = Math.round(CD_POSTCARD_W * scale);
  const scaledH = Math.round(CD_POSTCARD_H * scale);

  // Apply zoom to both canvases so Fabric's internal coordinate system matches screen
  [CD.fabricFront, CD.fabricBack].forEach(fc => {
    if (!fc) return;
    fc.setZoom(scale);
    fc.setDimensions({ width: scaledW, height: scaledH });
  });

  // Size the sizer wrapper to the scaled dimensions
  const sizer = document.getElementById('cd-canvas-sizer');
  if (sizer) {
    sizer.style.width = `${scaledW}px`;
    sizer.style.height = `${scaledH}px`;
  }
}

// ── Free Edit Mode ───────────────────────────────────────────────────────────
function cdToggleFreeEdit() {
  CD.freeEditMode = !CD.freeEditMode;
  const btn = document.getElementById('cd-btn-free-edit');
  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  const fcOther = CD.side === 'front' ? CD.fabricBack : CD.fabricFront;

  if (CD.freeEditMode) {
    // Unlock ONLY text objects — photo zones and structural elements stay locked
    [fc, fcOther].forEach(canvas => {
      canvas.getObjects().forEach(obj => {
        const isText = obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text';
        const isPhoto = obj.bdZoneLabel && obj.bdZoneLabel.startsWith('photo');
        const isStructural = obj.bdZoneLabel === 'bg' || obj.bdZoneLabel === 'border' ||
                             (obj.type === 'rect' && !obj.bdZoneLabel);
        if (isText) {
          // Text can be moved and edited
          obj.set({
            selectable: true, evented: true,
            lockMovementX: false, lockMovementY: false,
            lockScalingX: false, lockScalingY: false, lockRotation: false,
            hasControls: true, hasBorders: true,
            borderColor: '#3b82f6', cornerColor: '#3b82f6',
            hoverCursor: 'move',
          });
        } else if (isPhoto || isStructural) {
          // Photos and structural rects always stay locked
          obj.set({
            selectable: false, evented: false,
            lockMovementX: true, lockMovementY: true,
            lockScalingX: true, lockScalingY: true, lockRotation: true,
            hasControls: false, hasBorders: false,
            hoverCursor: 'default',
          });
        } else {
          // Other editable elements (logo, QR) — allow free edit
          obj.set({
            selectable: true, evented: true,
            lockMovementX: false, lockMovementY: false,
            lockScalingX: false, lockScalingY: false, lockRotation: false,
            hasControls: true, hasBorders: true,
            borderColor: '#3b82f6', cornerColor: '#3b82f6',
            hoverCursor: 'move',
          });
        }
      });
      canvas.selection = true;
      canvas.renderAll();
    });
    if (btn) {
      btn.style.background = '#3b82f6';
      btn.style.color = '#fff';
      btn.style.borderColor = '#3b82f6';
      btn.textContent = '🔒 Lock Layout';
    }
    cdShowToast('Free Edit ON — move & resize anything', 'ok');
  } else {
    // Re-apply original lock states from bdLock property
    [fc, fcOther].forEach(canvas => {
      canvas.getObjects().forEach(obj => {
        const lockState = obj.bdLock || 'locked';
        if (lockState === 'locked') {
          obj.set({ selectable: false, evented: false, hoverCursor: 'default' });
        } else if (lockState === 'editable') {
          const noSel2 = obj.bdNoSelect === true;
          obj.set({
            selectable: !noSel2, evented: true,
            lockMovementX: true, lockMovementY: true,
            lockScalingX: true, lockScalingY: true, lockRotation: true,
            hasControls: false, hasBorders: !noSel2,
            borderColor: '#22c55e', cornerColor: '#22c55e',
            hoverCursor: 'pointer',
          });
        } else {
          // 'free' — stays moveable (uploaded images, etc.)
          obj.set({
            selectable: true, evented: true,
            lockMovementX: false, lockMovementY: false,
            lockScalingX: false, lockScalingY: false,
            borderColor: '#3b82f6', cornerColor: '#3b82f6',
          });
        }
        canvas.discardActiveObject();
        canvas.renderAll();
      });
      canvas.selection = false;
    });
    if (btn) {
      btn.style.background = 'var(--card2)';
      btn.style.color = 'var(--muted)';
      btn.style.borderColor = 'var(--border)';
      btn.textContent = '🔓 Free Edit';
    }
    cdShowToast('Layout locked — back to fill-in mode', 'ok');
  }
}

// ── Layer Controls ───────────────────────────────────────────────────────────
function cdLayerAction(action) {
  const fc = CD.side === 'front' ? CD.fabricFront : CD.fabricBack;
  if (!fc) return;
  const obj = fc.getActiveObject();
  if (!obj) return;
  switch (action) {
    case 'front':    fc.bringToFront(obj); break;
    case 'forward':  fc.bringForward(obj, true); break;
    case 'backward': fc.sendBackwards(obj, true); break;
    case 'back':     fc.sendToBack(obj); break;
  }
  fc.renderAll();
  const labels = { front: 'Brought to front', forward: 'Moved forward', backward: 'Moved backward', back: 'Sent to background' };
  cdShowToast(labels[action] + ' ✓', 'ok');
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
  const frontJson = CD.fabricFront.toJSON(['bdLock','bdEditable','bdZoneLabel','bdNoSelect','__uid','_zoneLeft','_zoneTop','_zoneW','_zoneH']);
  const backJson = CD.fabricBack.toJSON(['bdLock','bdEditable','bdZoneLabel','bdNoSelect','__uid','_zoneLeft','_zoneTop','_zoneW','_zoneH']);

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

    /* ── Mobile layout: stack template list above canvas, fields below ── */
    #pd-layout {
      display: grid;
      grid-template-columns: 180px 1fr 260px;
      grid-template-rows: 1fr;
      height: 100%;
    }
    @media (max-width: 900px) {
      #pd-layout {
        grid-template-columns: 1fr !important;
        grid-template-rows: auto 1fr auto !important;
        height: auto !important;
      }
      #cd-left {
        flex-direction: row !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding: 10px 8px !important;
        border-right: none !important;
        border-bottom: 1px solid var(--border) !important;
        max-height: 120px !important;
        gap: 8px !important;
      }
      #cd-left > div:first-child { display: none !important; } /* hide 'Templates' label */
      .cd-tpl-card {
        flex-shrink: 0 !important;
        width: 100px !important;
        margin-bottom: 0 !important;
      }
      #cd-center {
        min-height: 300px;
      }
      #cd-right {
        border-left: none !important;
        border-top: 1px solid var(--border) !important;
        max-height: 50vh;
        overflow-y: auto;
      }
      /* Toolbar: wrap buttons on small screens */
      #cd-center > div:first-child {
        flex-wrap: wrap !important;
        gap: 6px !important;
        padding: 8px !important;
      }
    }
    @media (max-width: 600px) {
      #cd-left { max-height: 100px !important; }
      .cd-tpl-card { width: 80px !important; }
      #cd-right { max-height: 45vh; }
    }
  `;
  document.head.appendChild(s);
})();

// ── Expose globally ───────────────────────────────────────────────────────────
window.cdInit = cdInit;
window.cdSelectTemplate = cdSelectTemplate;
window.cdSwitchSide = cdSwitchSide;
window.cdUpdateTextField = cdUpdateTextField;
window.cdTriggerImageUpload = cdTriggerImageUpload;
window.cdClearImage = cdClearImage;
window.cdApplyAllFields = cdApplyAllFields;
window.cdSaveDesign = cdSaveDesign;
window.cdPreviewPng = cdPreviewPng;
window.cdToggleFreeEdit = cdToggleFreeEdit;
