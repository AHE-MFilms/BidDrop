// BidDrop — Postcard Template Dispatcher
// Centralises the "which front canvas renderer do I use?" logic so all callers
// (mail-queue.js, mailer-preview.js, postcard-render.js preview) stay in sync.

/**
 * Render the front canvas for the currently-selected postcard template.
 * @param {object} item  - pin/estimate item passed to canvas renderers
 * @param {string} [override] - optional design id override (skips S.cfg lookup)
 * @returns {Promise<string>} dataURL (image/jpeg)
 */
async function renderFrontCanvasForDesign(item, override){
  const design = override || (S.cfg && S.cfg.postcardDesign) || '1';
  switch(design){
    case 't3': return renderPostcard6x9FrontCanvasT3(item);
    case 't4': return renderPostcard6x9FrontCanvasT4(item);
    case 't5': return renderPostcard6x9FrontCanvasT5(item);
    case 't6': return renderPostcard6x9FrontCanvasT6(item);
    case '2':  return renderPostcard6x9FrontCanvasD2(item);
    default:   return renderPostcard6x9FrontCanvas(item);
  }
}

// ── Template Customizer Modal ─────────────────────────────────────────────────
const TEMPLATE_META = {
  t3: {
    label: '🌪 Storm / Wind Damage',
    fields: [
      {key:'postcardT3Headline1', label:'Headline 1', placeholder:'YOU HAVE'},
      {key:'postcardT3Headline2', label:'Headline 2 (big)', placeholder:'WIND DAMAGE'},
      {key:'postcardT3Sub',       label:'Sub-headline on slash', placeholder:'Should you make a claim?'},
      {key:'postcardT3Cta',       label:'CTA line', placeholder:'Call for an in-depth analysis.'},
    ]
  },
  t4: {
    label: '☀️ Solar',
    fields: [
      {key:'postcardT4Headline1', label:'Headline 1', placeholder:'YOUR HOME IS'},
      {key:'postcardT4Headline2', label:'Headline 2', placeholder:'SOLAR READY'},
      {key:'postcardT4Accent',    label:'Accent (gold text)', placeholder:'SAVE UP TO 80%'},
      {key:'postcardT4Sub',       label:'Sub-headline', placeholder:'on your electric bill with solar'},
      {key:'postcardT4Cta',       label:'CTA badge text', placeholder:'FREE Solar Assessment'},
      {key:'postcardT4Bullet1',   label:'Bullet 1', placeholder:'No upfront cost options'},
      {key:'postcardT4Bullet2',   label:'Bullet 2', placeholder:'Federal tax credit eligible'},
      {key:'postcardT4Bullet3',   label:'Bullet 3', placeholder:'30-year panel warranty'},
    ]
  },
  t5: {
    label: '🍂 Gutters / Leaf Guard',
    fields: [
      {key:'postcardT5Headline1', label:'Headline 1', placeholder:"DON'T FALL"},
      {key:'postcardT5Headline2', label:'Headline 2 (accent color)', placeholder:'VICTIM TO'},
      {key:'postcardT5Headline3', label:'Headline 3', placeholder:'CLOGGED GUTTERS'},
      {key:'postcardT5Accent',    label:'Accent bar text', placeholder:'PROTECT YOUR HOME'},
      {key:'postcardT5Bullet1',   label:'Bullet 1', placeholder:'Locally owned & operated'},
      {key:'postcardT5Bullet2',   label:'Bullet 2', placeholder:'HAAG Certified'},
      {key:'postcardT5Bullet3',   label:'Bullet 3', placeholder:'Licensed and Insured'},
      {key:'postcardT5Cta',       label:'CTA (bottom bar)', placeholder:'FREE Gutter Inspection'},
    ]
  },
  t6: {
    label: '🏠 General Roofing',
    fields: [
      {key:'postcardT6Headline1', label:'Headline 1 (accent color)', placeholder:'FREE ROOF'},
      {key:'postcardT6Headline2', label:'Headline 2', placeholder:'INSPECTION'},
      {key:'postcardT6Sub',       label:'Sub-headline', placeholder:'Your neighbors are getting theirs. Are you next?'},
      {key:'postcardT6Badge1',    label:'Starburst badge line 1', placeholder:'FREE'},
      {key:'postcardT6Badge2',    label:'Starburst badge line 2', placeholder:'ESTIMATE'},
      {key:'postcardT6Bullet1',   label:'Bullet 1', placeholder:'Licensed & Insured'},
      {key:'postcardT6Bullet2',   label:'Bullet 2', placeholder:'5-Star Rated'},
      {key:'postcardT6Bullet3',   label:'Bullet 3', placeholder:'Same-Day Response'},
    ]
  }
};

function openTemplateCustomizer(tplId){
  const meta = TEMPLATE_META[tplId];
  if(!meta){ toast('Unknown template','error'); return; }
  const cfg = S.cfg || {};
  const existing = document.getElementById('tpl-customizer-modal');
  if(existing) existing.remove();
  const fieldsHtml = meta.fields.map(f=>`
    <div style="margin-bottom:12px;">
      <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--muted);text-transform:uppercase;margin-bottom:4px;">${f.label}</label>
      <input id="tplf-${f.key}" type="text" value="${(cfg[f.key]||'').replace(/"/g,'&quot;')}" placeholder="${f.placeholder}"
        style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 12px;color:var(--text);font-size:13px;outline:none;">
    </div>`).join('');
  const modal = document.createElement('div');
  modal.id = 'tpl-customizer-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML=`
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:24px;position:relative;">
      <button onclick="document.getElementById('tpl-customizer-modal').remove()" style="position:absolute;top:14px;right:14px;background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;">✕</button>
      <div style="font-family:var(--font-h);font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px;">Customize Template</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:18px;">${meta.label} — changes apply to your account</div>
      ${fieldsHtml}
      <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;">
        <button onclick="_saveTemplateCustomizer('${tplId}')" style="background:var(--accent);color:#fff;border:none;border-radius:9px;padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer;">💾 Save & Preview</button>
        <button onclick="_saveAndUseTemplate('${tplId}')" style="background:none;color:var(--accent);border:1px solid var(--accent);border-radius:9px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;">✅ Save & Use This Template</button>
        <button onclick="document.getElementById('tpl-customizer-modal').remove()" style="background:none;color:var(--muted);border:1px solid var(--border);border-radius:9px;padding:10px 16px;font-size:13px;cursor:pointer;">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function _saveTemplateCustomizer(tplId){
  const meta = TEMPLATE_META[tplId];
  if(!meta) return;
  meta.fields.forEach(f=>{
    const el = document.getElementById('tplf-'+f.key);
    if(el) S.cfg[f.key] = el.value.trim() || undefined;
  });
  await syncAccountToSupabase();
  toast('Template copy saved!');
  document.getElementById('tpl-customizer-modal')?.remove();
  previewBuiltinTemplate(tplId);
}

async function _saveAndUseTemplate(tplId){
  const meta = TEMPLATE_META[tplId];
  if(!meta) return;
  meta.fields.forEach(f=>{
    const el = document.getElementById('tplf-'+f.key);
    if(el) S.cfg[f.key] = el.value.trim() || undefined;
  });
  S.cfg.postcardDesign = tplId;
  await syncAccountToSupabase();
  toast('Template saved and activated!');
  document.getElementById('tpl-customizer-modal')?.remove();
  _highlightActiveTemplate();
}

async function useBuiltinTemplate(tplId){
  S.cfg.postcardDesign = tplId;
  await syncAccountToSupabase();
  toast('Template activated!');
  _highlightActiveTemplate();
}

function _highlightActiveTemplate(){
  const active = (S.cfg && S.cfg.postcardDesign) || '1';
  ['t3','t4','t5','t6'].forEach(id=>{
    const card = document.getElementById('tpl-card-'+id);
    if(!card) return;
    card.style.borderColor = id===active ? 'var(--accent)' : 'var(--border)';
  });
}

async function previewBuiltinTemplate(tplId){
  const sampleItem={addr:'123 Sample Street, Your City, MI 48000',total:8500,id:null,photo_url:null,all_photos:[]};
  toast('Rendering preview…');
  try{
    const frontDataUrl = await renderFrontCanvasForDesign(sampleItem, tplId);
    const backDataUrl  = await renderPostcard6x9BackCanvas(sampleItem);
    // Open a simple preview modal
    const existing = document.getElementById('tpl-preview-modal');
    if(existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'tpl-preview-modal';
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px;overflow-y:auto;';
    modal.innerHTML=`
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:700;letter-spacing:.5px;">FRONT</div>
          <img src="${frontDataUrl}" style="max-width:min(560px,90vw);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6);">
        </div>
        <div style="text-align:center;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:700;letter-spacing:.5px;">BACK</div>
          <img src="${backDataUrl}" style="max-width:min(560px,90vw);border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.6);">
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
        <button onclick="useBuiltinTemplate('${tplId}');document.getElementById('tpl-preview-modal').remove()" style="background:var(--accent);color:#fff;border:none;border-radius:9px;padding:10px 24px;font-size:13px;font-weight:700;cursor:pointer;">✅ Use This Template</button>
        <button onclick="document.getElementById('tpl-preview-modal').remove()" style="background:var(--card);color:var(--mid);border:1px solid var(--border);border-radius:9px;padding:10px 18px;font-size:13px;cursor:pointer;">Close</button>
      </div>`;
    document.body.appendChild(modal);
  } catch(err){
    console.error('previewBuiltinTemplate error',err);
    toast('Preview error: '+err.message,'error');
  }
}

// Highlight active template on Designs tab load
document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(_highlightActiveTemplate, 500); });
