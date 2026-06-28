// src/proposal.js
// Good/Better/Best tier logic + Proposal modal (e-sign, print, email).
// Depends on: sb, S.cfg, S.pins, currentAccount, adminAPI(), toast(),
//             calcStructPrice(), getMatCost() (estimates-calc.js)
// Extracted from index.html — Tier 3 modularization

const GBB_TIERS = {
  good:   { mat:'1.3', label:'Good',   color:'#22C55E', desc:'Architectural Shingle — standard performance, 25-yr warranty' },
  better: { mat:'1.5', label:'Better', color:'#F25C05', desc:'Impact-Resistant (Class 4) — hail protection, insurance discount' },
  best:   { mat:'1.8', label:'Best',   color:'#A855F7', desc:'Designer / Premium — premium curb appeal, lifetime warranty' }
};
let _gbbTier = 'better'; // default

function setGBBTier(tier) {
  _gbbTier = tier;
  const t = GBB_TIERS[tier];
  // Update button styles
  ['good','better','best'].forEach(k => {
    const btn = document.getElementById('gbb-'+k);
    if (!btn) return;
    const active = k === tier;
    const c = GBB_TIERS[k].color;
    btn.style.borderColor = active ? c : 'var(--border)';
    btn.style.background  = active ? c+'22' : 'none';
    btn.style.color       = active ? c : 'var(--mid)';
  });
  // Update description
  const desc = document.getElementById('gbb-desc');
  if (desc) desc.textContent = t.desc;
  // Apply material to all structures
  structures.forEach(s => { s.mat = t.mat; });
  renderStructures();
  calcP();
  updatePreview();
}

// ═══════════════════════════════════════════════════════════════════════
//  PROPOSAL MODAL
// ═══════════════════════════════════════════════════════════════════════
let _propSignedAt = null;

async function openProposalModal() {
  const _unlocked = await requirePinUnlocked(currentEstPinId);
  if(!_unlocked) return;
  renderProposalTierCards();
  renderProposalLineItems();
  document.getElementById('prop-esign-name').value = '';
  document.getElementById('prop-esign-consent').checked = false;
  document.getElementById('prop-esign-status').style.display = 'none';
  _propSignedAt = null;
  // Hide download signed button on open
  const dlBtn = document.getElementById('prop-download-signed-btn');
  if (dlBtn) dlBtn.style.display = 'none';
  // Pre-fill from existing estimate if already signed
  const estId = window._editingEstimateId || null;
  if (estId) {
    const est = (S.estimates||[]).find(e => e.id === estId);
    if (est && est.signedAt && est.sigName) {
      _propSignedAt = est.signedAt;
      document.getElementById('prop-esign-name').value = est.sigName;
      document.getElementById('prop-esign-consent').checked = true;
      const status = document.getElementById('prop-esign-status');
      if (status) {
        status.style.display = 'block';
        status.innerHTML = `✅ Previously signed by <strong>${escHtml(est.sigName)}</strong> on ${new Date(est.signedAt).toLocaleString()}`;
      }
      if (dlBtn) dlBtn.style.display = 'flex';
    }
  }
  openM('m-proposal');
}

function calcTierTotal(matKey) {
  if (!structures.length) return 0;
  const origMats = structures.map(s => s.mat);
  structures.forEach(s => { s.mat = matKey; });
  const c = S.cfg;
  let grand = structures.reduce((sum, s) => sum + calcStructPrice(s), 0);
  if (document.getElementById('a-sky') && document.getElementById('a-sky').checked)
    grand += (parseFloat(c.costSkylight)||375) * (parseInt(document.getElementById('a-sky-q').value)||1);
  if (document.getElementById('a-chim') && document.getElementById('a-chim').checked)
    grand += (parseFloat(c.costChimney)||295);
  if (document.getElementById('a-gut') && document.getElementById('a-gut').checked)
    grand += (parseFloat(c.costGutter)||9) * (parseInt(document.getElementById('a-gut-q').value)||120);
  if (document.getElementById('a-iws') && document.getElementById('a-iws').checked)
    grand += (parseFloat(c.costIceWater)||42) * structures.reduce((sum,s)=>{const sq=parseFloat(s.sqft)||0;const pm=parseFloat(s.pitch)||1.118;return sum+(sq/100*1.10*pm);},0);
  grand += getSolarPrice();
  // Restore original mats
  structures.forEach((s,i) => { s.mat = origMats[i]; });
  // Apply tax
  const tax = parseFloat(S.cfg.taxRate)||0;
  if (tax > 0) grand = Math.round(grand * (1 + tax/100));
  return Math.round(grand);
}

function renderProposalTierCards() {
  const wrap = document.getElementById('prop-tier-cards');
  if (!wrap) return;
  const tiers = [
    { key:'good',   mat:'1.3', label:'Good',   color:'#22C55E', icon:'🟢', sub:'Architectural Shingle', badge:'' },
    { key:'better', mat:'1.5', label:'Better',  color:'#F25C05', icon:'🟠', sub:'Impact-Resistant (Class 4)', badge:'MOST POPULAR' },
    { key:'best',   mat:'1.8', label:'Best',    color:'#A855F7', icon:'🟣', sub:'Designer / Premium', badge:'TOP TIER' }
  ];
  wrap.innerHTML = tiers.map(t => {
    const total = calcTierTotal(t.mat);
    const tax = parseFloat(S.cfg.taxRate)||0;
    const taxLine = tax > 0 ? `<div style="font-size:10px;color:var(--muted);margin-top:2px;">Incl. ${tax}% tax</div>` : '';
    const badge = t.badge ? `<div style="font-size:9px;font-weight:700;letter-spacing:.6px;background:${t.color};color:#fff;border-radius:4px;padding:2px 6px;margin-bottom:6px;text-align:center;">${t.badge}</div>` : '<div style="height:19px;margin-bottom:6px;"></div>';
    return `<div style="background:var(--card2);border:2px solid ${t.color}33;border-radius:10px;padding:12px;text-align:center;cursor:pointer;transition:all .15s;" onclick="selectProposalTier('${t.key}')" id="prop-card-${t.key}">
      ${badge}
      <div style="font-size:22px;margin-bottom:4px;">${t.icon}</div>
      <div style="font-family:var(--font-h);font-size:16px;font-weight:700;color:${t.color};">${t.label}</div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px;line-height:1.3;">${t.sub}</div>
      <div style="font-family:var(--font-h);font-size:20px;font-weight:700;color:var(--text);">$${total.toLocaleString()}</div>
      ${taxLine}
    </div>`;
  }).join('');
  selectProposalTier(_gbbTier);
}

let _selectedProposalTier = 'better';
function selectProposalTier(tier) {
  _selectedProposalTier = tier;
  ['good','better','best'].forEach(k => {
    const card = document.getElementById('prop-card-'+k);
    if (!card) return;
    const c = GBB_TIERS[k].color;
    card.style.borderColor = k === tier ? c : c+'33';
    card.style.background  = k === tier ? c+'18' : 'var(--card2)';
  });
  renderProposalLineItems();
}

function renderProposalLineItems() {
  const wrap = document.getElementById('prop-line-items');
  if (!wrap || !structures.length) { if(wrap) wrap.innerHTML='<div style="color:var(--muted);font-size:12px;">No structures added yet.</div>'; return; }
  const tier = GBB_TIERS[_selectedProposalTier];
  const matKey = tier.mat;
  const origMats = structures.map(s => s.mat);
  structures.forEach(s => { s.mat = matKey; });
  const c = S.cfg;
  let subtotal = structures.reduce((sum,s) => sum + calcStructPrice(s), 0);
  const addons = [];
  if (document.getElementById('a-sky') && document.getElementById('a-sky').checked) {
    const v = (parseFloat(c.costSkylight)||375)*(parseInt(document.getElementById('a-sky-q').value)||1);
    addons.push({l:'Skylights', v}); subtotal+=v;
  }
  if (document.getElementById('a-chim') && document.getElementById('a-chim').checked) {
    const v = parseFloat(c.costChimney)||295;
    addons.push({l:'Chimney Flashing', v}); subtotal+=v;
  }
  if (document.getElementById('a-gut') && document.getElementById('a-gut').checked) {
    const v = (parseFloat(c.costGutter)||9)*(parseInt(document.getElementById('a-gut-q').value)||120);
    addons.push({l:'Gutters', v}); subtotal+=v;
  }
  if (document.getElementById('a-iws') && document.getElementById('a-iws').checked) {
    const sq = structures.reduce((sum,s)=>{const sqft=parseFloat(s.sqft)||0;const pm=parseFloat(s.pitch)||1.118;return sum+(sqft/100*1.10*pm);},0);
    const v = Math.round((parseFloat(c.costIceWater)||42)*sq);
    addons.push({l:'Ice & Water Shield', v}); subtotal+=v;
  }
  const solP = getSolarPrice();
  if (solP > 0) { addons.push({l:'Solar Add-On', v:solP}); subtotal+=solP; }
  structures.forEach((s,i) => { s.mat = origMats[i]; });
  const tax = parseFloat(S.cfg.taxRate)||0;
  const taxAmt = tax > 0 ? Math.round(subtotal * tax/100) : 0;
  const total = subtotal + taxAmt;
  const row = (l,v,bold) => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);${bold?'font-weight:700;color:var(--text);':'color:var(--mid);'}"><span>${l}</span><span>$${v.toLocaleString()}</span></div>`;
  let html = '';
  structures.forEach((s,i) => {
    const sq = Math.round((parseFloat(s.sqft)||0)/100*1.10*(parseFloat(s.pitch)||1.118)*10)/10;
    html += row(`${s.name||'Structure '+(i+1)} (${sq} squares — ${MATLBL[matKey]||matKey})`, calcStructPrice(s), false);
  });
  addons.forEach(a => { html += row(a.l, a.v, false); });
  if (taxAmt > 0) html += row(`Sales Tax (${tax}%)`, taxAmt, false);
  html += row('TOTAL', total, true);
  wrap.innerHTML = html;
}

function onPropSignInput() {
  const name = (document.getElementById('prop-esign-name').value||'').trim();
  const consent = document.getElementById('prop-esign-consent').checked;
  const status = document.getElementById('prop-esign-status');
  if (name.length >= 2 && consent) {
    _propSignedAt = new Date().toISOString();
    status.style.display = 'block';
    status.innerHTML = `✅ Signed by <strong>${escHtml(name)}</strong> on ${new Date().toLocaleString()} — legally binding under the ESIGN Act`;
    // Save signature to DB
    _saveSignatureToDB(name, _propSignedAt);
    // Show download signed proposal button
    const dlBtn = document.getElementById('prop-download-signed-btn');
    if (dlBtn) { dlBtn.style.display = 'flex'; }
  } else {
    _propSignedAt = null;
    status.style.display = 'none';
    const dlBtn = document.getElementById('prop-download-signed-btn');
    if (dlBtn) { dlBtn.style.display = 'none'; }
  }
}
async function _saveSignatureToDB(sigName, signedAt) {
  const estId = window._editingEstimateId || null;
  if (!estId || !sb || !currentAccount) return;
  try {
    const { error } = await sb.from('estimates')
      .update({ sig_name: sigName, signed_at: signedAt })
      .eq('id', estId)
      .eq('account_id', currentAccount.id);
    if (error) { console.warn('[BidDrop] Save signature error:', error.message); return; }
    // Update in-memory estimate
    const est = (S.estimates||[]).find(e => e.id === estId);
    if (est) { est.sigName = sigName; est.signedAt = signedAt; }
    // Auto-advance the linked pin to 'signed'
    if(typeof autoAdvancePinByAddress === 'function' && est && est.addr) autoAdvancePinByAddress(est.addr, 'signed');
    if(typeof autoAdvancePinStatus === 'function'){
      const sigPin = (S.pins||[]).find(p=>p.id===(window._editingEstPinId||currentEstPinId));
      if(sigPin) autoAdvancePinStatus(sigPin, 'signed');
    }
    console.log('[BidDrop] Signature saved to DB for estimate', estId);
  } catch(e) { console.warn('[BidDrop] _saveSignatureToDB error:', e.message); }
}
function downloadSignedProposal() {
  const name = (document.getElementById('prop-esign-name')||{}).value||'';
  if (!_propSignedAt || !name.trim()) {
    toast('Please have the homeowner sign the proposal first','warning');
    return;
  }
  const html = buildProposalHTML(true);
  const w = window.open('','_blank','width=900,height=700');
  if (!w) { toast('Please allow popups to download','warning'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 600);
}

function printProposalPDF() {
  const html = buildProposalHTML(true);
  const w = window.open('','_blank','width=900,height=700');
  if (!w) { toast('Please allow popups to print','warning'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 600);
}

async function printProposalWithCredit(){
  if(!isPlanAtLeast('pro')){ showPlanUpgradePrompt('Print Proposal','pro'); return; }
  const estId = window._editingEstimateId || null;
  const btn = document.getElementById('prop-preview-print-btn');
  if(btn){ btn.disabled=true; btn.innerHTML='⏳ Unlocking...'; }
  try{
    // Check if already unlocked via postcard or previous print
    const est = estId ? (S.estimates||[]).find(e=>e.id===estId) : null;
    const qItem = estId ? (S.queue||[]).find(q=>(q.estId===estId || (est && q.addr===(est.addr||''))) && q.status==='sent') : null;
    let canPrint = false;
    if(est && est.printPaid){
      // Already paid — free reprint
      canPrint = true;
    } else if(qItem){
      // Postcard was sent — unlock for free
      if(estId) _unlockPrintForEstimate(estId);
      canPrint = true;
    } else if(estId){
      // Charge 1 credit via print-unlock API
      const sess = await sb.auth.getSession();
      const token = sess?.data?.session?.access_token;
      if(!token){ toast('Please log in to print','warning'); return; }
      const d = await adminAPI('print-unlock', { estId });
      if(d && d.error === 'no_credits'){
        toast('Not enough credits to print. Please purchase more credits (1 credit = $4.00).','error');
        setTimeout(()=>showBuyCreditsModal(), 800);
        return;
      }
      if(d && (d.success || d.already_paid)){
        if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; updateCreditBadge(); }
        // Update local estimate record
        if(est) est.printPaid = true;
        canPrint = true;
      } else {
        toast('Could not unlock print — please try again','error');
        return;
      }
    } else {
      // No saved estimate — allow print without credit (unsaved)
      canPrint = true;
    }
    if(canPrint){
      printProposalPDF();
      // Update badge to show free
      const badge = document.getElementById('prop-print-cost-badge');
      if(badge){ badge.textContent='FREE (unlocked)'; badge.style.background='rgba(34,197,94,.25)'; }
    }
  } catch(e){
    toast('Print error: '+e.message,'error');
  } finally {
    if(btn){ btn.disabled=false; btn.innerHTML='\u{1F5A8} Print / Save PDF <span id="prop-print-cost-badge" style="font-size:10px;font-weight:600;background:rgba(255,255,255,.2);border-radius:20px;padding:2px 8px;">1 Credit</span>'; }
  }
}

async function emailProposal() {
  const email = (document.getElementById('e-email')||{}).value||'';
  if (!email) { toast('Add homeowner email first','warning'); return; }
  const btn = document.getElementById('prop-email-btn');
  if (btn) { btn.disabled=true; btn.innerHTML='📧 Sending...'; }
  try {
    const html = buildProposalHTML(false);
    const owner = (document.getElementById('e-owner')||{}).value||'Homeowner';
    const addr  = (document.getElementById('e-addr')||{}).value||'';
    const cfg   = S.cfg;
    const res = await fetch('/api/send-proposal', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        to: email,
        subject: `Your Roofing Proposal from ${cfg.companyName||'Your Roofer'} — ${addr}`,
        html,
        ownerName: owner,
        accountId: currentAccount?.id
      })
    });
    if (res.ok) { toast('Proposal emailed to '+email,'success'); }
    else { toast('Email failed — check your settings','danger'); }
  } catch(e) { toast('Email error: '+e.message,'danger'); }
  finally { if(btn){btn.disabled=false;btn.innerHTML='📧 Email to Homeowner';} }
}

function buildProposalHTML(forPrint) {
  const cfg   = S.cfg;
  const owner = (document.getElementById('e-owner')||{}).value||'Homeowner';
  const addr  = (document.getElementById('e-addr')||{}).value||'Property Address';
  const phone = (document.getElementById('e-phone')||{}).value||'';
  const email = (document.getElementById('e-email')||{}).value||'';
  const notes = (document.getElementById('prop-notes')||{}).value||'';
  const signName = (document.getElementById('prop-esign-name')||{}).value||'';
  const signConsent = (document.getElementById('prop-esign-consent')||{}).checked;
  const co    = cfg.companyName||'Your Roofing Co';
  const coAddr= cfg.companyAddr||'';
  const coPh  = cfg.companyPhone||'';
  const coEmail= cfg.companyEmail||'';
  const color = cfg.brandColor||'#F25C05';
  const lic   = cfg.licenseNum||'';
  const warr  = cfg.warrantyYears||'10';
  const yrs   = cfg.yearsInBusiness||'5+';
  const validDays = cfg.estimateValidDays||'30';
  const depositPct = cfg.depositPercent||'25';
  const logoHtml = cfg.logoData
    ? `<img src="${cfg.logoData}" style="max-height:70px;max-width:200px;object-fit:contain;display:block;">`
    : `<div style="font-family:'Oswald',sans-serif;font-size:26px;font-weight:700;color:${color};letter-spacing:1px;">${escHtml(co)}</div>`;
  const homePhoto = ((window._allPhotos&&window._allPhotos.front)||[])[0]||window._homePhotoData||null;
  const homePhotoHtml = homePhoto
    ? `<div style="position:relative;margin-bottom:0;overflow:hidden;"><img src="${homePhoto}" style="width:100%;height:300px;object-fit:cover;display:block;"></div>`
    : '';
  const estNum = 'BD-' + Date.now().toString(36).toUpperCase().slice(-6);
  const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}).toUpperCase();
  const tax = parseFloat(cfg.taxRate)||0;

  // Build tier data
  const tiers = [
    { key:'good',   mat:'1.3', label:'Good',   colorT:'#22C55E', sub:'Architectural Shingle', badge:'' },
    { key:'better', mat:'1.5', label:'Better',  colorT:'#F59E0B', sub:'Impact-Resistant (Class 4)', badge:'MOST POPULAR' },
    { key:'best',   mat:'1.8', label:'Best',    colorT:color,     sub:'Designer / Premium', badge:'TOP TIER' }
  ];
  const tierTotals = tiers.map(t => ({ ...t, total: calcTierTotal(t.mat) }));
  const selectedTier = tierTotals.find(t => t.key === _selectedProposalTier) || tierTotals[1];

  // Line items for selected tier
  const origMats = structures.map(s => s.mat);
  structures.forEach(s => { s.mat = selectedTier.mat; });
  let subtotal = structures.reduce((sum,s) => sum + calcStructPrice(s), 0);
  const lineItems = structures.map((s,i) => {
    const sq = Math.round((parseFloat(s.sqft)||0)/100*1.10*(parseFloat(s.pitch)||1.118)*10)/10;
    const unitPrice = sq > 0 ? Math.round(calcStructPrice(s)/sq) : 0;
    return { desc: s.name||('Structure '+(i+1)), unit:'SQ', qty:sq, unitPrice, lineTotal:calcStructPrice(s) };
  });
  const addons = [];
  const c = cfg;
  if (document.getElementById('a-sky')&&document.getElementById('a-sky').checked){const qty=parseInt(document.getElementById('a-sky-q').value)||1;const up=parseFloat(c.costSkylight)||375;const v=up*qty;addons.push({desc:'Skylights',unit:'EA',qty,unitPrice:up,lineTotal:v});subtotal+=v;}
  if (document.getElementById('a-chim')&&document.getElementById('a-chim').checked){const v=parseFloat(c.costChimney)||295;addons.push({desc:'Chimney Flashing',unit:'EA',qty:1,unitPrice:v,lineTotal:v});subtotal+=v;}
  if (document.getElementById('a-gut')&&document.getElementById('a-gut').checked){const qty=parseInt(document.getElementById('a-gut-q').value)||120;const up=parseFloat(c.costGutter)||9;const v=up*qty;addons.push({desc:'Gutters',unit:'LF',qty,unitPrice:up,lineTotal:v});subtotal+=v;}
  if (document.getElementById('a-iws')&&document.getElementById('a-iws').checked){const sq2=Math.round(structures.reduce((sum,s)=>{const sqft=parseFloat(s.sqft)||0;const pm=parseFloat(s.pitch)||1.118;return sum+(sqft/100*1.10*pm);},0)*10)/10;const up=parseFloat(c.costIceWater)||42;const v=Math.round(up*sq2);addons.push({desc:'Ice & Water Shield',unit:'SQ',qty:sq2,unitPrice:up,lineTotal:v});subtotal+=v;}
  const solP=getSolarPrice();if(solP>0){addons.push({desc:'Solar Add-On',unit:'LOT',qty:1,unitPrice:solP,lineTotal:solP});subtotal+=solP;}
  structures.forEach((s,i)=>{s.mat=origMats[i];});
  const taxAmt = tax>0 ? Math.round(subtotal*tax/100) : 0;
  const total = subtotal + taxAmt;

  // Build line items HTML with Description | Unit | Qty | Unit Price | Line Total columns
  const matLabel = MATLBL[selectedTier.mat]||selectedTier.mat;
  const allLineItems = [...lineItems, ...addons];
  const lineItemsHtml = allLineItems.map((li,idx) => {
    const bg = idx%2===0?'#fff':'#f9fafb';
    return `<tr style="background:${bg};">
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;">${escHtml(li.desc)}<br><span style="font-size:10px;color:#9ca3af;">${escHtml(matLabel)}</span></td>
      <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:12px;">${escHtml(String(li.unit))}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:center;color:#374151;font-size:12px;">${li.qty}</td>
      <td style="padding:9px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#374151;font-size:12px;">$${li.unitPrice.toLocaleString()}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111827;font-size:12px;">$${li.lineTotal.toLocaleString()}</td>
    </tr>`;
  }).join('');

  // Signing page: checkboxes for each tier
  const tierCheckboxes = tierTotals.map(t => {
    const isSel = t.key === _selectedProposalTier;
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
      <div style="width:16px;height:16px;border:2px solid #374151;border-radius:2px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${isSel?'<div style="width:8px;height:8px;background:#374151;border-radius:1px;"></div>':''}</div>
      <span style="font-size:13px;font-weight:700;color:#111827;">${escHtml(t.label)} — ${escHtml(t.sub)}</span>
      <span style="margin-left:auto;font-size:13px;font-weight:700;color:#111827;">$${t.total.toLocaleString()}</span>
    </div>`;
  }).join('');

  const signBlock = (signName && signConsent && _propSignedAt)
    ? `<div style="padding:16px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#16a34a;margin-bottom:8px;">✅ Electronically Signed</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div><div style="font-size:10px;color:#6b7280;margin-bottom:3px;">Homeowner Signature</div><div style="font-family:'Oswald',sans-serif;font-size:20px;color:#111827;border-bottom:2px solid #111827;padding-bottom:4px;">${escHtml(signName)}</div></div>
          <div><div style="font-size:10px;color:#6b7280;margin-bottom:3px;">Date & Time</div><div style="font-size:13px;color:#374151;font-weight:600;">${new Date(_propSignedAt).toLocaleString()}</div></div>
        </div>
        <div style="font-size:10px;color:#6b7280;margin-top:8px;">Signed electronically under the ESIGN Act (15 U.S.C. § 7001). This constitutes a legally binding agreement.</div>
      </div>`
    : `<div style="display:grid;grid-template-columns:2fr 1fr;gap:32px;margin-top:8px;">
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">${escHtml(owner)}:</div>
          <div style="border-bottom:2px solid #111827;height:40px;margin-bottom:4px;"></div>
        </div>
        <div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Date:</div>
          <div style="border-bottom:2px solid #111827;height:40px;margin-bottom:4px;"></div>
        </div>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Roofing Quote — ${escHtml(addr)}</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Barlow',sans-serif;color:#111827;background:#fff;font-size:13px;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:0.5in;size:letter;}}
</style>
</head>
<body>
<div style="max-width:820px;margin:0 auto;">

  <!-- ══ PAGE 1: COVER ══ -->
  <div style="padding:32px 36px 0;">
    <!-- Logos row -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
      <div>${logoHtml}${coAddr?'<div style="font-size:11px;color:#6b7280;margin-top:4px;">'+escHtml(coAddr)+'</div>':''}</div>
      <div style="text-align:right;"><div style="font-size:10px;color:#6b7280;">${escHtml(coPh)}</div>${coEmail?'<div style="font-size:10px;color:#6b7280;">'+escHtml(coEmail)+'</div>':''}</div>
    </div>
  </div>

  <!-- Hero property photo -->
  ${homePhotoHtml}

  <!-- Cover info block -->
  <div style="padding:28px 36px 32px;display:grid;grid-template-columns:1fr 1px 1fr;gap:0;">
    <div style="padding-right:32px;">
      <div style="font-family:'Oswald',sans-serif;font-size:30px;font-weight:400;color:#111827;line-height:1.15;margin-bottom:8px;">ROOFING<br>QUOTE</div>
      <div style="font-size:12px;color:#6b7280;">${today}</div>
      <div style="margin-top:20px;font-size:11px;color:#6b7280;">Estimate #${estNum}</div>
      ${lic?'<div style="font-size:11px;color:#9ca3af;margin-top:4px;">'+escHtml(lic)+'</div>':''}
      <div style="margin-top:24px;">
        <div style="font-size:11px;font-weight:700;color:#374151;">${escHtml(cfg.repName||co)}</div>
        ${coEmail?'<div style="font-size:11px;color:#6b7280;">'+escHtml(coEmail)+'</div>':''}
        ${coPh?'<div style="font-size:11px;color:#6b7280;">'+escHtml(coPh)+'</div>':''}
      </div>
    </div>
    <div style="background:#e5e7eb;"></div>
    <div style="padding-left:32px;">
      <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:10px;">${escHtml(owner)}</div>
      <div style="font-size:12px;color:#374151;line-height:1.8;">${escHtml(addr)}</div>
      ${phone?'<div style="font-size:12px;color:#374151;">'+escHtml(phone)+'</div>':''}
      ${email?'<div style="font-size:12px;color:#374151;">'+escHtml(email)+'</div>':''}
    </div>
  </div>

  <!-- Gold accent bar -->
  <div style="height:8px;background:${color};margin:0;"></div>

  <!-- ══ PAGE 2: SCOPE & PRICING ══ -->
  <div style="padding:40px 36px;">
    <!-- Section heading -->
    <div style="font-family:'Oswald',sans-serif;font-size:28px;font-weight:700;color:${color};letter-spacing:.5px;margin-bottom:6px;">${escHtml(selectedTier.label.toUpperCase())} — ${escHtml(matLabel.toUpperCase())}</div>
    <div style="height:2px;background:#e5e7eb;margin-bottom:24px;"></div>

    <!-- Line item table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
      <thead>
        <tr style="border-bottom:2px solid #111827;">
          <th style="padding:8px 12px 8px 0;text-align:left;font-size:12px;font-weight:700;color:#111827;">Description</th>
          <th style="padding:8px 8px;text-align:center;font-size:12px;font-weight:700;color:#111827;width:50px;">Unit</th>
          <th style="padding:8px 8px;text-align:center;font-size:12px;font-weight:700;color:#111827;width:50px;">Qty</th>
          <th style="padding:8px 8px;text-align:right;font-size:12px;font-weight:700;color:#111827;width:90px;">Unit price</th>
          <th style="padding:8px 0 8px 8px;text-align:right;font-size:12px;font-weight:700;color:#111827;width:90px;">Line total</th>
        </tr>
        <tr><td colspan="5" style="padding:4px 0;"><div style="font-size:11px;font-weight:700;color:#374151;">Roof System</div></td></tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
        ${taxAmt>0?`<tr><td style="padding:7px 0;border-top:1px solid #e5e7eb;color:#374151;font-size:12px;" colspan="4">Sales Tax (${tax}%)</td><td style="padding:7px 0;border-top:1px solid #e5e7eb;text-align:right;font-weight:600;font-size:12px;">$${taxAmt.toLocaleString()}</td></tr>`:''}
      </tbody>
    </table>

    <!-- Totals block -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
      <div style="min-width:260px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #e5e7eb;">
          <span style="font-size:12px;font-weight:700;color:#374151;">Estimate subtotal</span>
          <span style="font-size:12px;font-weight:700;color:#374151;">$${subtotal.toLocaleString()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #374151;">
          <span style="font-size:13px;font-weight:700;color:#111827;">Total</span>
          <span style="font-size:13px;font-weight:700;color:#111827;">$${total.toLocaleString()}</span>
        </div>
      </div>
    </div>

    ${lic?`<div style="font-size:11px;color:#6b7280;">${escHtml(lic)}</div>`:''}  
  </div>

  <!-- Gold accent bar -->
  <div style="height:8px;background:${color};margin:0;"></div>

  <!-- ══ PAGE 3: SIGNING & OPTIONS ══ -->
  <div style="padding:40px 36px;">
    <div style="font-family:'Oswald',sans-serif;font-size:28px;font-weight:700;color:${color};letter-spacing:.5px;margin-bottom:20px;">SIGNING &amp; OPTIONS</div>

    <!-- Options checkboxes + customer info -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:20px;">
      <div>${tierCheckboxes}</div>
      <div>
        <div style="font-size:12px;margin-bottom:3px;"><strong>Name:</strong> ${escHtml(owner)}</div>
        <div style="font-size:12px;color:#374151;"><strong>Address:</strong> ${escHtml(addr)}</div>
        ${phone?'<div style="font-size:12px;color:#374151;">'+escHtml(phone)+'</div>':''}
      </div>
    </div>

    <!-- Validity / deposit notice bar -->
    <div style="background:#f3f4f6;border-radius:4px;padding:10px 14px;margin-bottom:24px;">
      <span style="font-size:11px;font-weight:700;color:#374151;">Estimates valid for ${escHtml(String(validDays))} days from date of estimate &nbsp;/&nbsp; A ${escHtml(String(depositPct))}% deposit is required before any project begins</span>
    </div>

    <!-- Deposit -->
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">Deposit</div>
      <div style="background:#f9fafb;border-radius:4px;padding:10px 14px;display:flex;justify-content:flex-end;border:1px solid #e5e7eb;">
        <span style="font-size:12px;color:#374151;">${escHtml(String(depositPct))}%</span>
      </div>
      <div style="border-bottom:2px solid #111827;margin-top:4px;"></div>
    </div>

    <!-- Notes -->
    <div style="margin-bottom:32px;">
      <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:8px;">Customer Comments / Notes</div>
      <div style="border:1px solid #9ca3af;border-radius:4px;min-height:80px;padding:10px;font-size:12px;color:#374151;">${notes?escHtml(notes):''}</div>
    </div>

    <!-- Signature -->
    ${signBlock}

    <!-- Footer -->
    <div style="margin-top:40px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:10px;color:#9ca3af;">Generated by BidDrop · biddrop.us</div>
      <div style="font-size:10px;color:#9ca3af;">Estimate #${estNum} · ${today}</div>
    </div>
  </div>

</div>
${forPrint?'<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>':''}
</body>
</html>`;
}
