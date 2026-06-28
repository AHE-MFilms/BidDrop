// PATCH: replace renderTradeStatusAccordion with new action-based pipeline display + custom tags
function renderTradeStatusAccordion(){
  const container = document.getElementById('trade-statuses-accordion');
  if(!container) return;

  // ── Fixed action-based pipeline (universal, not trade-specific) ──
  const PIPELINE = [
    { v:'pinned',       emoji:'📍', label:'Pinned',       auto:'Automatically set when a pin is dropped', color:'#6B7280' },
    { v:'mailed',       emoji:'📬', label:'Mailed',       auto:'Automatically set when a postcard or letter is sent', color:'#3B82F6' },
    { v:'emailed',      emoji:'📧', label:'Emailed',      auto:'Automatically set when an email is sent', color:'#A855F7' },
    { v:'called',       emoji:'📞', label:'Called',       auto:'Set manually after a phone call', color:'#EAB308' },
    { v:'responded',    emoji:'💬', label:'Responded',    auto:'Set manually when homeowner responds', color:'#F59E0B' },
    { v:'quoted',       emoji:'📋', label:'Quoted',       auto:'Automatically set when an estimate is saved', color:'#0EA5E9' },
    { v:'signed',       emoji:'✅', label:'Signed',       auto:'Automatically set when a proposal is e-signed', color:'#22C55E' },
    { v:'not_interested', emoji:'❌', label:'Not Interested', auto:'Set manually — lead is closed', color:'#6B7280' },
  ];

  // ── Custom tags (contractor-added) ──
  const customTags = (S.cfg && S.cfg.customPinTags) || [];

  container.innerHTML = `
    <div style="margin-bottom:20px;">
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">📍 Action-Based Pipeline</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:14px;">These statuses are universal and advance automatically as you work through BidDrop. You cannot rename or delete them.</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${PIPELINE.map(p => `
          <div style="display:flex;align-items:center;gap:12px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;">
            <span style="font-size:18px;flex-shrink:0;">${p.emoji}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:700;color:${p.color};">${p.label}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:1px;">${p.auto}</div>
            </div>
            <div style="width:10px;height:10px;border-radius:50%;background:${p.color};flex-shrink:0;"></div>
          </div>
        `).join('')}
      </div>
    </div>

    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">🏷 Custom Tags</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Add your own tags that appear below the defaults when dropping a pin. These are optional and for your own reference.</div>
      <div id="custom-tags-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
        ${customTags.length ? customTags.map((t,i) => `
          <div style="display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;">
            <input type="color" value="${t.color||'#F25C05'}" onchange="window._updateCustomTag(${i},'color',this.value)"
              style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none;flex-shrink:0;" />
            <input type="text" value="${(t.label||'').replace(/"/g,'&quot;')}" placeholder="Tag name"
              onchange="window._updateCustomTag(${i},'label',this.value)"
              style="flex:1;background:var(--input);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;font-family:var(--font-b);" />
            <button onclick="window._removeCustomTag(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0 4px;line-height:1;">✕</button>
          </div>
        `).join('') : '<div style="color:var(--muted);font-size:11px;text-align:center;padding:12px 0;">No custom tags yet.</div>'}
      </div>
      <button onclick="window._addCustomTag()" style="background:rgba(242,92,5,.12);border:1px dashed var(--accent);border-radius:8px;padding:9px 16px;color:var(--accent);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-b);width:100%;">+ Add Custom Tag</button>
    </div>
  `;
}

// ── Custom tag helpers ─────────────────────────────────────────────────────────
window._addCustomTag = function(){
  if(!S.cfg) S.cfg = {};
  if(!S.cfg.customPinTags) S.cfg.customPinTags = [];
  S.cfg.customPinTags.push({ label: '', color: '#F25C05' });
  renderTradeStatusAccordion();
};
window._removeCustomTag = function(i){
  if(!S.cfg || !S.cfg.customPinTags) return;
  S.cfg.customPinTags.splice(i, 1);
  save();
  renderTradeStatusAccordion();
};
window._updateCustomTag = function(i, field, val){
  if(!S.cfg || !S.cfg.customPinTags || !S.cfg.customPinTags[i]) return;
  S.cfg.customPinTags[i][field] = val;
  // Auto-save on change
  save();
};
