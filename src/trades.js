// src/trades.js
// Trade calculators (solar, fencing, siding, gutters, insulation, paint, doors, windows),
// trade selector UI, settings/pricing tab renderers, estimator tab helpers.
// Depends on: S.cfg, S.pins, currentAccount, toast(), calcStructPrice() (estimates-calc.js)
// Extracted from index.html — Tier 4 modularization

// Track which pin the current estimate belongs to
let currentEstPinId = null;



function switchSettingsTab(tab){
  document.querySelectorAll('.stab-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.stab-tab-pane').forEach(p=>p.classList.remove('active'));
  const btn=document.getElementById('stab-tab-'+tab);
  const pane=document.getElementById('stab-tabpane-'+tab);
  if(btn) btn.classList.add('active');
  if(pane) pane.classList.add('active');
  try{ localStorage.setItem('bd_settings_tab', tab); }catch(e){}
  // Render dynamic accordions on demand
  if(tab === 'trade-statuses') renderTradeStatusAccordion();
  if(tab === 'trade-postcard') renderTradePostcardAccordion();
}
function restoreSettingsTab(){
  try{
    const t=localStorage.getItem('bd_settings_tab');
    if(t) switchSettingsTab(t);
  }catch(e){}
}
// ════════════════════════════════════════════════════════════════════════════
// MULTI-TRADE ESTIMATOR — Trade toggles, selector, calculators, bundle logic
// ════════════════════════════════════════════════════════════════════════════

// ── Trade toggle (Settings → Pricing) ────────────────────────────────────────
function toggleTradeEnabled(tradeId){
  if(!S.cfg) S.cfg = {};
  if(!S.cfg.enabledTrades) S.cfg.enabledTrades = {roofing:true};
  const cur = !!S.cfg.enabledTrades[tradeId];
  S.cfg.enabledTrades[tradeId] = !cur;
  _updateTradeToggleUI(tradeId, !cur);
  save();
  renderTradeSelector();
  // Persist enabled_trades array to DB
  const enabledArr = Object.keys(S.cfg.enabledTrades).filter(t => S.cfg.enabledTrades[t]);
  if(sb && currentAccount && currentAccount.id){
    sb.from('accounts').update({enabled_trades: enabledArr}).eq('id', currentAccount.id).then(({error}) => {
      if(error) console.warn('[BidDrop] save enabled_trades:', error.message);
    });
  }
  toast((S.cfg.enabledTrades[tradeId] ? '✅' : '⛔') + ' ' + tradeId.charAt(0).toUpperCase()+tradeId.slice(1) + ' ' + (S.cfg.enabledTrades[tradeId] ? 'enabled' : 'disabled'), 'info');
}
function _updateTradeToggleUI(tradeId, enabled){
  const toggle = document.getElementById('s-trade-'+tradeId+'-toggle');
  const knob   = document.getElementById('s-trade-'+tradeId+'-knob');
  const lbl    = document.getElementById('s-trade-'+tradeId+'-lbl');
  if(toggle) toggle.style.background = enabled ? 'var(--accent)' : 'var(--border)';
  if(knob)   knob.style.left = enabled ? '21px' : '3px';
  if(lbl)    lbl.textContent = enabled ? 'Enabled' : 'Disabled';
}
function refreshAllTradeToggles(){
  const et = (S.cfg && S.cfg.enabledTrades) || {roofing:true};
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  ALL_TRADES.forEach(t => _updateTradeToggleUI(t, !!(et[t])));
}

// ── Trade selector (Estimator) ────────────────────────────────────────────────
const TRADE_META = {
  roofing:    {label:'🏠 Roofing',       color:'#F25C05'},
  solar:      {label:'☀️ Solar',          color:'#22C55E'},
  fencing:    {label:'🪵 Fencing',        color:'#A78BFA'},
  siding:     {label:'🏗 Siding',         color:'#60A5FA'},
  gutters:    {label:'🌊 Gutters',        color:'#38BDF8'},
  insulation: {label:'🏠 Insulation',     color:'#FB923C'},
  paint:      {label:'🎨 Ext. Paint',     color:'#F472B6'},
  doors:      {label:'🚪 Doors',          color:'#FBBF24'},
  windows:    {label:'🪟 Windows',        color:'#67E8F9'},
};
window._activeTrade = null;
window._tradeBundle = []; // [{trade, total, details}]

function renderTradeSelector(){
  const grid = document.getElementById('trade-selector-grid');
  const empty = document.getElementById('trade-selector-empty');
  if(!grid) return;
  const et = (S.cfg && S.cfg.enabledTrades) || {roofing:true};
  const enabled = Object.keys(TRADE_META).filter(t => {
    if(t === 'roofing') return et.roofing !== false;
    return !!et[t];
  });
  if(enabled.length === 0){
    grid.innerHTML = '';
    if(empty) empty.style.display = '';
    return;
  }
  if(empty) empty.style.display = 'none';
  grid.innerHTML = enabled.map(t => {
    const m = TRADE_META[t];
    const isActive = window._activeTrade === t;
    return `<button onclick="selectTrade('${t}')" style="padding:14px 8px;border-radius:10px;border:2px solid ${isActive ? m.color : 'var(--border)'};background:${isActive ? 'rgba('+hexToRgb(m.color)+',.15)' : 'var(--card2)'};color:${isActive ? m.color : 'var(--mid)'};font-family:var(--font-b);font-size:13px;font-weight:700;cursor:pointer;text-align:center;transition:all .15s;box-shadow:${isActive ? '0 0 0 1px '+m.color : 'none'};">${m.label}${isActive ? '<br><span style="font-size:9px;font-weight:400;opacity:.8;letter-spacing:.5px;text-transform:uppercase;">Selected</span>' : ''}</button>`;
  }).join('');
}
function hexToRgb(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return r+','+g+','+b;
}
function selectTrade(tradeId){
  window._activeTrade = tradeId;
  renderTradeSelector();
  // Hide all trade forms
  ['roofing','solar','fencing','siding','gutters','insulation','paint','doors'].forEach(t=>{
    const f = document.getElementById('trade-form-'+t);
    if(f) f.style.display = 'none';
  });
  // Show roofing structures + existing form elements for roofing
  const roofingEls = ['gbb-selector-wrap','price-box-wrap'];
  roofingEls.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display = tradeId==='roofing' ? '' : 'none';
  });
  // Show the structures add button for roofing
  const addStructBtn = document.querySelector('[onclick="addStructure(0,\'\')"]');
  if(addStructBtn) addStructBtn.style.display = tradeId==='roofing' ? '' : 'none';
  const structWrap = document.getElementById('structures-render-wrap');
  if(structWrap) structWrap.style.display = tradeId==='roofing' ? '' : 'none';
  // Show selected trade form
  const form = document.getElementById('trade-form-'+tradeId);
  if(form) form.style.display = '';
  // Auto-populate measurements from satellite data
  autoPopulateTradeMeasurements(tradeId);
  toast('🔧 '+TRADE_META[tradeId].label+' selected','info');
  // Accordion: open Card 3 and update summary
  if(typeof _accOnTradeSelected==='function') _accOnTradeSelected(TRADE_META[tradeId].label);
}
function autoPopulateTradeMeasurements(tradeId){
  // Use last known satellite data (stored in window._lastSolarData)
  const sd = window._lastSolarData;
  if(!sd) return;
  const roofSqft = sd.roofSqft || 0;
  const perimeterLf = Math.round(Math.sqrt(roofSqft) * 4); // rough perimeter estimate
  const wallSqft = Math.round(roofSqft * 0.85); // walls ≈ 85% of roof area as rough estimate
  switch(tradeId){
    case 'solar':
      const kwEl = document.getElementById('te-solar-kw');
      if(kwEl && !kwEl.value && sd.systemKw) { kwEl.value = sd.systemKw; calcTradeSolar(); }
      const banner = document.getElementById('solar-autocalc-banner');
      if(banner && sd.systemKw) banner.style.display = '';
      break;
    case 'fencing':
      const fenEl = document.getElementById('te-fen-lf');
      if(fenEl && !fenEl.value && perimeterLf) { fenEl.value = perimeterLf; calcTradeFencing(); }
      break;
    case 'siding':
      const sidEl = document.getElementById('te-sid-sqft');
      if(sidEl && !sidEl.value && wallSqft) { sidEl.value = wallSqft; calcTradeSiding(); }
      break;
    case 'gutters':
      const gutEl = document.getElementById('te-gut-lf');
      if(gutEl && !gutEl.value && perimeterLf) { gutEl.value = perimeterLf; calcTradeGutters(); }
      break;
    case 'insulation':
      const insEl = document.getElementById('te-ins-sqft');
      if(insEl && !insEl.value && roofSqft) { insEl.value = Math.round(roofSqft * 0.9); calcTradeInsulation(); }
      break;
    case 'paint':
      const pntEl = document.getElementById('te-pnt-sqft');
      if(pntEl && !pntEl.value && wallSqft) { pntEl.value = wallSqft; calcTradePaint(); }
      break;
  }
}

// ── Auto-calc buttons (trigger satellite lookup then populate) ────────────────
function autoCalcSolar(){ if(window._lastSolarData && window._lastSolarData.systemKw){ const el=document.getElementById('te-solar-kw'); if(el) el.value=window._lastSolarData.systemKw; calcTradeSolar(); } else toast('🛰 Run a satellite lookup first (enter address above)','warn'); }
function autoCalcFencing(){ if(window._lastSolarData && window._lastSolarData.roofSqft){ const lf=Math.round(Math.sqrt(window._lastSolarData.roofSqft)*4); const el=document.getElementById('te-fen-lf'); if(el) el.value=lf; calcTradeFencing(); } else toast('🛰 Run a satellite lookup first','warn'); }
function autoCalcSiding(){ if(window._lastSolarData && window._lastSolarData.roofSqft){ const el=document.getElementById('te-sid-sqft'); if(el) el.value=Math.round(window._lastSolarData.roofSqft*0.85); calcTradeSiding(); } else toast('🛰 Run a satellite lookup first','warn'); }
function autoCalcGutters(){ if(window._lastSolarData && window._lastSolarData.roofSqft){ const lf=Math.round(Math.sqrt(window._lastSolarData.roofSqft)*4); const el=document.getElementById('te-gut-lf'); if(el) el.value=lf; calcTradeGutters(); } else toast('🛰 Run a satellite lookup first','warn'); }
function autoCalcInsulation(){ if(window._lastSolarData && window._lastSolarData.roofSqft){ const el=document.getElementById('te-ins-sqft'); if(el) el.value=Math.round(window._lastSolarData.roofSqft*0.9); calcTradeInsulation(); } else toast('🛰 Run a satellite lookup first','warn'); }
function autoCalcPaint(){ if(window._lastSolarData && window._lastSolarData.roofSqft){ const el=document.getElementById('te-pnt-sqft'); if(el) el.value=Math.round(window._lastSolarData.roofSqft*0.85); calcTradePaint(); } else toast('🛰 Run a satellite lookup first','warn'); }

// ── Trade calculators ─────────────────────────────────────────────────────────
function _fmtMoney(n){ return '$'+Math.round(n).toLocaleString(); }
function _applyMargin(base, ovh, mgn){ return base * (1 + (ovh||15)/100) * (1 + (mgn||20)/100); }

function calcTradeSolar(){
  const c = S.cfg || {};
  const kw = parseFloat((document.getElementById('te-solar-kw')||{}).value) || 0;
  const ppw = parseFloat(c.solarPricePerWatt) || 3.50;
  let total = kw * 1000 * ppw;
  if((document.getElementById('te-solar-battery')||{}).checked) total += (c.solarBattery||8000);
  if((document.getElementById('te-solar-panel-upgrade')||{}).checked) total += (c.solarPanelUpgrade||150)*Math.ceil(kw/0.4);
  if((document.getElementById('te-solar-elec-upgrade')||{}).checked) total += (c.solarElecUpgrade||2500);
  if((document.getElementById('te-solar-roof-reinforce')||{}).checked) total += (c.solarRoofReinforce||1500);
  total = _applyMargin(total, c.solarOverhead||12, c.solarMargin||18);
  // Apply incentives
  const fedCredit = total * ((c.solarFedCredit||30)/100);
  const stateRebate = c.solarStateRebate || 0;
  const utilityRebate = c.solarUtilityRebate || 0;
  const net = total - fedCredit - stateRebate - utilityRebate;
  const el = document.getElementById('te-solar-total');
  if(el) el.textContent = _fmtMoney(net);
  const monthly = document.getElementById('te-solar-monthly');
  if(monthly && c.solarMonthlySavings) monthly.textContent = 'Est. monthly savings: $'+(c.solarMonthlySavings||150)+'/mo';
  const detail = document.getElementById('te-solar-incentives-detail');
  if(detail) detail.innerHTML = `Federal Tax Credit (${c.solarFedCredit||30}%): -${_fmtMoney(fedCredit)}<br>State Rebate: -${_fmtMoney(stateRebate)}<br>Utility Rebate: -${_fmtMoney(utilityRebate)}<br><strong>Net after incentives: ${_fmtMoney(net)}</strong>`;
  window._currentTradeTotal = net;
  updateBundleBar();
}

function calcTradeFencing(){
  const c = S.cfg || {};
  const type = (document.getElementById('te-fen-type')||{}).value || 'wood';
  const lf = parseFloat((document.getElementById('te-fen-lf')||{}).value) || 0;
  const plfMap = {wood:c.fenWoodPlf||28, vinyl:c.fenVinylPlf||35, chain:c.fenChainPlf||18, aluminum:c.fenAlumPlf||45, split:c.fenSplitPlf||22, cedar:c.fenCedarPlf||38};
  let base = lf * (plfMap[type] || 28);
  if((document.getElementById('te-fen-gate-single')||{}).checked) base += (c.fenGateSingle||350);
  if((document.getElementById('te-fen-gate-double')||{}).checked) base += (c.fenGateDouble||650);
  if((document.getElementById('te-fen-removal')||{}).checked) base += lf * (c.fenRemoval||5);
  const total = _applyMargin(base, c.fenOverhead||15, c.fenMargin||20);
  const el = document.getElementById('te-fen-total');
  if(el) el.textContent = _fmtMoney(total);
  const bd = document.getElementById('te-fen-breakdown');
  if(bd) bd.textContent = lf+' lf × $'+(plfMap[type]||28)+'/lf';
  window._currentTradeTotal = total;
  updateBundleBar();
  if(typeof updatePreview==='function') updatePreview();
}

function calcTradeSiding(){
  const c = S.cfg || {};
  const type = (document.getElementById('te-sid-type')||{}).value || 'vinyl';
  const sqft = parseFloat((document.getElementById('te-sid-sqft')||{}).value) || 0;
  const psfMap = {vinyl:c.sidVinylPsf||4.50, hardie:c.sidHardiePsf||8.00, wood:c.sidWoodPsf||7.00, engwood:c.sidEngWoodPsf||6.50, metal:c.sidMetalPsf||9.00, stucco:c.sidStuccoPsf||10.00};
  let base = sqft * (psfMap[type] || 4.50);
  if((document.getElementById('te-sid-removal')||{}).checked) base += sqft * (c.sidRemoval||1.50);
  if((document.getElementById('te-sid-housewrap')||{}).checked) base += sqft * (c.sidHousewrap||0.75);
  if((document.getElementById('te-sid-insulation')||{}).checked) base += sqft * (c.sidInsulation||0.50);
  const trimLf = parseFloat((document.getElementById('te-sid-trim-lf')||{}).value) || 0;
  if(trimLf) base += trimLf * (c.sidTrim||6.00);
  const total = _applyMargin(base, c.sidOverhead||15, c.sidMargin||20);
  const el = document.getElementById('te-sid-total');
  if(el) el.textContent = _fmtMoney(total);
  const bd = document.getElementById('te-sid-breakdown');
  if(bd) bd.textContent = sqft+' sqft × $'+(psfMap[type]||4.50)+'/sqft';
  window._currentTradeTotal = total;
  updateBundleBar();
  if(typeof updatePreview==='function') updatePreview();
}

function calcTradeGutters(){
  const c = S.cfg || {};
  const type = (document.getElementById('te-gut-type')||{}).value || 'alum5';
  const lf = parseFloat((document.getElementById('te-gut-lf')||{}).value) || 0;
  const ds = parseInt((document.getElementById('te-gut-downspouts')||{}).value) || 0;
  const plfMap = {alum5:c.gutAlum5||6, alum6:c.gutAlum6||8, seamless:c.gutSeamless||9, copper:c.gutCopper||22, halfrnd:c.gutHalfrnd||10, vinyl:c.gutVinyl||4.50};
  let base = lf * (plfMap[type] || 6);
  base += ds * (c.gutDownspout||75);
  if((document.getElementById('te-gut-guard')||{}).checked) base += lf * (c.gutGuard||5);
  if((document.getElementById('te-gut-removal')||{}).checked) base += lf * (c.gutRemoval||1.50);
  if((document.getElementById('te-gut-fascia')||{}).checked) base += lf * (c.gutFascia||8);
  const total = _applyMargin(base, c.gutOverhead||15, c.gutMargin||20);
  const el = document.getElementById('te-gut-total');
  if(el) el.textContent = _fmtMoney(total);
  const bd = document.getElementById('te-gut-breakdown');
  if(bd) bd.textContent = lf+' lf × $'+(plfMap[type]||6)+'/lf + '+ds+' downspouts';
  window._currentTradeTotal = total;
  updateBundleBar();
  if(typeof updatePreview==='function') updatePreview();
}

function calcTradeInsulation(){
  const c = S.cfg || {};
  const type = (document.getElementById('te-ins-type')||{}).value || 'blowR30';
  const sqft = parseFloat((document.getElementById('te-ins-sqft')||{}).value) || 0;
  const psfMap = {blowR30:c.insBlowR30||1.20, blowR38:c.insBlowR38||1.50, cellR30:c.insCellR30||1.10, cellR38:c.insCellR38||1.40, foamOpen:c.insFoamOpen||1.50, foamClosed:c.insFoamClosed||3.00, battR13:c.insBattR13||0.65, battR19:c.insBattR19||0.85};
  let base = sqft * (psfMap[type] || 1.20);
  if((document.getElementById('te-ins-removal')||{}).checked) base += sqft * (c.insRemoval||0.75);
  if((document.getElementById('te-ins-airsealing')||{}).checked) base += (c.insAirsealing||350);
  if((document.getElementById('te-ins-vapor')||{}).checked) base += sqft * (c.insVapor||0.45);
  const total = _applyMargin(base, c.insOverhead||15, c.insMargin||20);
  const el = document.getElementById('te-ins-total');
  if(el) el.textContent = _fmtMoney(total);
  const bd = document.getElementById('te-ins-breakdown');
  if(bd) bd.textContent = sqft+' sqft × $'+(psfMap[type]||1.20)+'/sqft';
  window._currentTradeTotal = total;
  updateBundleBar();
  if(typeof updatePreview==='function') updatePreview();
}

function calcTradePaint(){
  const c = S.cfg || {};
  const surface = (document.getElementById('te-pnt-surface')||{}).value || 'siding1c';
  const sqft = parseFloat((document.getElementById('te-pnt-sqft')||{}).value) || 0;
  const trimLf = parseFloat((document.getElementById('te-pnt-trim-lf')||{}).value) || 0;
  const psfMap = {siding1c:c.pntSiding1c||1.50, siding2c:c.pntSiding2c||2.25, deck1c:c.pntDeck1c||1.75, deck2c:c.pntDeck2c||2.75, masonry:c.pntMasonry||2.50};
  let base = sqft * (psfMap[surface] || 1.50);
  if(trimLf) base += trimLf * (c.pntTrim1c||2.00);
  if((document.getElementById('te-pnt-powerwash')||{}).checked) base += sqft * (c.pntPowerwash||0.35);
  if((document.getElementById('te-pnt-primer')||{}).checked) base += sqft * (c.pntPrimer||0.50);
  if((document.getElementById('te-pnt-garage-door')||{}).checked) base += (c.pntGarageDoor||150);
  const total = _applyMargin(base, c.pntOverhead||15, c.pntMargin||20);
  const el = document.getElementById('te-pnt-total');
  if(el) el.textContent = _fmtMoney(total);
  const bd = document.getElementById('te-pnt-breakdown');
  if(bd) bd.textContent = sqft+' sqft × $'+(psfMap[surface]||1.50)+'/sqft';
  window._currentTradeTotal = total;
  updateBundleBar();
  if(typeof updatePreview==='function') updatePreview();
}

function calcTradeDoors(){
  const c = S.cfg || {};
  const qty = (id) => parseInt((document.getElementById(id)||{}).value) || 0;
  let base = 0;
  base += qty('te-dor-steel-entry') * (c.dorSteelEntry||850);
  base += qty('te-dor-fiber-entry') * (c.dorFiberEntry||1200);
  base += qty('te-dor-wood-entry')  * (c.dorWoodEntry||1500);
  base += qty('te-dor-storm')       * (c.dorStormStd||450);
  base += qty('te-dor-garage-single') * (c.dorGarageSingle||1100);
  base += qty('te-dor-garage-double') * (c.dorGarageDouble||1800);
  const totalDoors = qty('te-dor-steel-entry')+qty('te-dor-fiber-entry')+qty('te-dor-wood-entry')+qty('te-dor-storm')+qty('te-dor-garage-single')+qty('te-dor-garage-double');
  if((document.getElementById('te-dor-hardware')||{}).checked) base += totalDoors * (c.dorHardware||125);
  if((document.getElementById('te-dor-weatherstrip')||{}).checked) base += totalDoors * (c.dorWeatherstrip||75);
  if((document.getElementById('te-dor-opener')||{}).checked) base += (qty('te-dor-garage-single')+qty('te-dor-garage-double')) * (c.dorOpener||350);
  const total = _applyMargin(base, c.dorOverhead||15, c.dorMargin||20);
  const el = document.getElementById('te-dor-total');
  if(el) el.textContent = _fmtMoney(total);
  const bd = document.getElementById('te-dor-breakdown');
  if(bd) bd.textContent = totalDoors+' door'+(totalDoors!==1?'s':'')+' total';
  window._currentTradeTotal = total;
  updateBundleBar();
  if(typeof updatePreview==='function') updatePreview();
}

// ── Bundle bar ────────────────────────────────────────────────────────────────
function updateBundleBar(){
  const bar = document.getElementById('trade-bundle-bar');
  if(!bar) return;
  if(!window._tradeBundle || window._tradeBundle.length === 0){ bar.style.display='none'; return; }
  bar.style.display = '';
  const list = document.getElementById('trade-bundle-list');
  const totalEl = document.getElementById('trade-bundle-total');
  let grand = 0;
  const lines = window._tradeBundle.map(b => {
    grand += b.total;
    return `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>${TRADE_META[b.trade]?TRADE_META[b.trade].label:b.trade}</span><span style="font-weight:700;">${_fmtMoney(b.total)}</span></div>`;
  });
  if(list) list.innerHTML = lines.join('');
  if(totalEl) totalEl.textContent = _fmtMoney(grand);
}
function addAnotherTrade(){
  // Commit current trade to bundle
  if(window._activeTrade && window._currentTradeTotal > 0){
    const existing = (window._tradeBundle||[]).findIndex(b=>b.trade===window._activeTrade);
    const entry = {trade:window._activeTrade, total:window._currentTradeTotal};
    if(existing >= 0) window._tradeBundle[existing] = entry;
    else window._tradeBundle.push(entry);
  }
  // Reset trade selector so rep can pick another
  window._activeTrade = null;
  window._currentTradeTotal = 0;
  renderTradeSelector();
  ['roofing','solar','fencing','siding','gutters','insulation','paint','doors'].forEach(t=>{
    const f=document.getElementById('trade-form-'+t); if(f) f.style.display='none';
  });
  updateBundleBar();
  toast('✅ Trade added to bundle — select another trade','success');
}

// ── Extend saveEstimateNow to capture trade data ──────────────────────────────
const _origSaveEstimateNow = typeof saveEstimateNow === 'function' ? saveEstimateNow : null;
// We patch saveEstimateNow after it's defined — see _patchSaveEstimate() called on load

function _getTradeEstimateData(){
  const trade = window._activeTrade || 'roofing';
  const bundle = (window._tradeBundle && window._tradeBundle.length > 0) ? [...window._tradeBundle] : null;
  // Add current trade to bundle snapshot if not already there
  if(bundle && window._activeTrade && window._currentTradeTotal > 0){
    const exists = bundle.findIndex(b=>b.trade===window._activeTrade);
    if(exists < 0) bundle.push({trade:window._activeTrade, total:window._currentTradeTotal});
  }
  const grandTotal = bundle ? bundle.reduce((s,b)=>s+b.total,0) : (window._currentTradeTotal||0);
  return { trade, bundle, grandTotal };
}

// ── Store last solar data for auto-calc ──────────────────────────────────────
// Hook into existing solar data population — store roofSqft and systemKw
const _origPopulateSolarBanner = typeof populateSolarBanner === 'function' ? populateSolarBanner : null;

// ── Windows trade calculator ──────────────────────────────────────────────────
window._winMethod = 'A';
function setWinMethod(m){
  window._winMethod = m;
  ['A','B','C'].forEach(x=>{
    const btn = document.getElementById('win-method-'+x);
    const form = document.getElementById('win-form-'+x);
    if(btn){
      btn.style.border = x===m ? '2px solid var(--accent)' : '1px solid var(--border)';
      btn.style.background = x===m ? 'rgba(242,92,5,.12)' : 'none';
      btn.style.color = x===m ? 'var(--accent)' : 'var(--mid)';
    }
    if(form) form.style.display = x===m ? '' : 'none';
  });
  // Auto-populate Method A count from home size
  if(m==='A') _autoFillWinCountA();
  calcTradeWindows();
}
function _autoFillWinCountA(){
  const c = S.cfg || {};
  const size = (document.getElementById('te-win-size')||{}).value || 'md';
  const cntMap = {sm:c.winCntSm||9, md:c.winCntMd||13, lg:c.winCntLg||18, xl:c.winCntXl||25};
  const el = document.getElementById('te-win-count-A');
  if(el && !el.value) el.value = cntMap[size] || 13;
}
function calcTradeWindows(){
  const c = S.cfg || {};
  const m = window._winMethod || 'A';
  const ppwMap = {dbl_hung:c.winDblHung||450, casement:c.winCasement||550, picture:c.winPicture||400, sliding:c.winSliding||480, bay:c.winBay||1800, skylight:c.winSkylight||1200, storm:c.winStorm||200, egress:c.winEgress||2500};
  let base = 0;
  let totalCount = 0;
  let breakdownParts = [];

  if(m==='A'){
    const size = (document.getElementById('te-win-size')||{}).value || 'md';
    const cntMap = {sm:c.winCntSm||9, md:c.winCntMd||13, lg:c.winCntLg||18, xl:c.winCntXl||25};
    const autoCount = cntMap[size] || 13;
    const manualCount = parseInt((document.getElementById('te-win-count-A')||{}).value) || autoCount;
    const typeA = (document.getElementById('te-win-type-A')||{}).value || 'dbl_hung';
    totalCount = manualCount;
    base = manualCount * (ppwMap[typeA] || 450);
    breakdownParts.push(manualCount+' windows × $'+(ppwMap[typeA]||450));
  } else if(m==='B'){
    const fields = [{id:'te-win-b-dblhung',type:'dbl_hung'},{id:'te-win-b-casement',type:'casement'},{id:'te-win-b-picture',type:'picture'},{id:'te-win-b-sliding',type:'sliding'},{id:'te-win-b-bay',type:'bay'},{id:'te-win-b-storm',type:'storm'}];
    fields.forEach(f=>{
      const qty = parseInt((document.getElementById(f.id)||{}).value)||0;
      if(qty>0){ base+=qty*(ppwMap[f.type]||450); totalCount+=qty; breakdownParts.push(qty+'× '+f.type.replace('_',' ')); }
    });
    const disp = document.getElementById('te-win-b-count-display');
    if(disp) disp.textContent = totalCount+' window'+(totalCount!==1?'s':'')+' total';
  } else { // C
    const fields = [{id:'te-win-c-dblhung',type:'dbl_hung'},{id:'te-win-c-casement',type:'casement'},{id:'te-win-c-picture',type:'picture'},{id:'te-win-c-sliding',type:'sliding'},{id:'te-win-c-bay',type:'bay'},{id:'te-win-c-skylight',type:'skylight'},{id:'te-win-c-storm',type:'storm'},{id:'te-win-c-egress',type:'egress'}];
    fields.forEach(f=>{
      const qty = parseInt((document.getElementById(f.id)||{}).value)||0;
      if(qty>0){ base+=qty*(ppwMap[f.type]||450); totalCount+=qty; breakdownParts.push(qty+'× '+f.type.replace('_',' ')); }
    });
    const disp = document.getElementById('te-win-c-count-display');
    if(disp) disp.textContent = totalCount+' window'+(totalCount!==1?'s':'')+' total';
  }

  // Add-ons (per window)
  if((document.getElementById('te-win-lowe')||{}).checked && totalCount>0) base += totalCount*(c.winLowe||75);
  if((document.getElementById('te-win-triple')||{}).checked && totalCount>0) base += totalCount*(c.winTriple||120);
  if((document.getElementById('te-win-trim')||{}).checked && totalCount>0) base += totalCount*(c.winTrim||85);
  if((document.getElementById('te-win-removal')||{}).checked && totalCount>0) base += totalCount*(c.winRemoval||50);

  const total = base * (1+(c.winOverhead||15)/100) * (1+(c.winMargin||20)/100) * (1+(c.winTax||0)/100);
  const el = document.getElementById('te-win-total');
  if(el) el.textContent = _fmtMoney(total);
  const bd = document.getElementById('te-win-breakdown');
  if(bd) bd.textContent = breakdownParts.join(' · ') || 'Enter window details above';
  window._currentTradeTotal = total;
  updateBundleBar();
  if(typeof updatePreview==='function') updatePreview();
}

function switchPricingTab(tab){
  document.querySelectorAll('#pricing-subtabs .stab-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.ptab-pane').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  const btn=document.getElementById('ptab-'+tab);
  const pane=document.getElementById('ptabpane-'+tab);
  if(btn) btn.classList.add('active');
  if(pane){pane.classList.add('active');pane.style.display='';}
  try{ localStorage.setItem('bd_pricing_tab', tab); }catch(e){}
}
function restorePricingTab(){
  try{
    const t=localStorage.getItem('bd_pricing_tab');
    if(t) switchPricingTab(t);
  }catch(e){}
}
function toggleStabCard(name){
  const body = document.getElementById('stab-body-'+name);
  const chevron = document.getElementById('stab-chevron-'+name);
  if(!body) return;
  const isCollapsed = body.classList.contains('collapsed');
  body.classList.toggle('collapsed', !isCollapsed);
  if(chevron) chevron.classList.toggle('collapsed', !isCollapsed);
}
function goTab(t){
  // Close tablet overlay sidebar when navigating to a new tab
  if(typeof closeTabletSidebar==='function') closeTabletSidebar();
  // Auto-save estimate + photos when leaving the estimator tab
  const prevTab = document.querySelector('.tab-btn.active');
  const leavingEstimate = prevTab && prevTab.dataset.tab === 'estimate';
  if(leavingEstimate && currentEstPinId){
    // Persist home photo to sessionStorage (fast, survives tab switch)
    if(window._homePhotoData){
      try{ sessionStorage.setItem('bd_home_photo_'+(currentEstPinId||'_'), window._homePhotoData); }catch(e){}
    }
    // Auto-save the current estimate state to Supabase immediately
    _autoSaveEstimateOnLeave();
  }
  document.querySelectorAll('.tab-btn,.bnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.toggle('active',p.id==='tab-'+t));
  if(t==='map'){setTimeout(()=>map&&map.invalidateSize(),80);}
  if(t==='dashboard')renderDash();
  if(t==='mailqueue')renderQueue();
  if(t==='estimates')renderEstimatesTab();
  if(t==='estimate'){
    populateEstPinPicker();updatePreview();scheduleDraftSave&&clearTimeout(_draftTimer);
    if(typeof renderTradeSelector==='function') renderTradeSelector();
    // Restore home photo if it was cleared during tab switch
    if(!window._homePhotoData && currentEstPinId){
      try{
        const saved = sessionStorage.getItem('bd_home_photo_'+currentEstPinId);
        if(saved){
          window._homePhotoData = saved;
          const prev = document.getElementById('home-photo-preview');
          if(prev) prev.innerHTML = '<img src="'+saved+'" style="width:100%;height:100%;object-fit:cover;">';
          const clr = document.getElementById('clear-photo-btn');
          if(clr) clr.style.display = 'block';
        }
      }catch(e){}
    }
  }
  if(t==='zones')initZonesTab();
  if(t==='agency')renderAgencyView();
  if(t==='history')loadHistory();
  if(t==='settings')renderSettingsTab();
  if(t==='admin')renderAdminPanel();
  if(t==='hotleads')loadHotLeads();
  if(t==='pixel'){loadPixelLeads();}
  if(t==='analytics')loadAnalytics();
  if(t==='leaderboard')renderFullLeaderboard();
}


function renderSettingsTab(){
  // Populate all settings fields from S.cfg into the inline tab
  openSettings();
  // Load team members into the settings tab
  const body = document.getElementById('settings-team-body');
  const roleBadge = document.getElementById('settings-team-role-badge');
  if(!body) return;
  body.innerHTML = '<div style="color:var(--mid);font-size:13px;">Loading...</div>';

  // Show the admin panel content inline
  (async ()=>{
    try{
      const isSA = currentUser && currentUser.role === 'super_admin';
      const isAdm = isAdminOrAbove();
      if(roleBadge) roleBadge.textContent = isSA ? 'Super Admin' : (isAdm ? 'Admin' : 'Rep');

      if(isSA){
        // Super admin: show link to full admin panel
        body.innerHTML = '<div style="color:var(--mid);font-size:13px;margin-bottom:12px;">You are logged in as Super Admin.</div>' +
          '<button onclick="goTab(\'admin\')" style="background:var(--accent);border:none;border-radius:8px;padding:10px 22px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.5px;">Open Admin Panel</button>';
      } else if(isAdm){
        const {data:profiles} = await sb.from('user_profiles').select('*').eq('account_id', currentAccount.id);
        body.innerHTML = renderAccountAdminPanel(profiles||[]);
      } else {
        body.innerHTML = '<div style="color:var(--mid);font-size:13px;">Contact your admin to manage team members.</div>';
      }
    } catch(e){
      body.innerHTML = '<div style="color:var(--mid);font-size:13px;">Could not load team data.</div>';
    }
  })();
}

function renderFollowUpTab(){
  const cfg = S.cfg || {};
  [2,3,4,5,6].forEach(step=>{
    const url = cfg['postcardStep'+step];
    const frontEl = document.getElementById('fu-pc'+step+'-front');
    const backEl  = document.getElementById('fu-pc'+step+'-back');
    if(!frontEl || !backEl) return;

    // Front side
    if(url){
      // Custom uploaded artwork — show it
      frontEl.style.display = 'block';
      frontEl.style.minHeight = 'unset';
      frontEl.innerHTML = '<img src="'+url+'" style="width:100%;height:auto;display:block;border-radius:5px;cursor:zoom-in;" title="Click to enlarge front" onclick="previewPostcardFront('+step+')">';
    } else {
      // No custom upload — render auto-generated BidDrop postcard with step-specific copy
      const msg = getDripStepMessage(step);
      const sampleEst2 = (S.estimates||[]).find(e=>!e.isRevision && !e.deletedAt && !e.deleted);
      const samplePin2 = sampleEst2 ? (S.pins||[]).find(p=>p.id===sampleEst2.pinId) : null;
      const previewPhotoUrl = (sampleEst2 && (sampleEst2.photo_url||sampleEst2.photo_data)) || (samplePin2 && samplePin2.photo_url) || null;
      const frontHtml = buildDripPostcardFrontHtml({
        photoUrl: previewPhotoUrl,
        headline: msg.headline,
        subtext:  msg.subtext,
        companyName:    cfg.companyName    || 'Your Roofing Co',
        companyAddress: cfg.companyAddress || '',
        phone:          cfg.phone          || '',
        logoUrl:        cfg.logoData       || '',
        address:        sampleEst2 ? (sampleEst2.addr||'') : '',
        estimateTotal:  sampleEst2 ? (sampleEst2.total||0) : 0,
      });
      frontEl.style.cssText = 'position:relative;width:100%;padding-top:66.67%;overflow:hidden;border-radius:5px;border:1px solid var(--border);cursor:zoom-in;';
      const encodedHtml = frontHtml.replace(/"/g,'&quot;').replace(/`/g,'&#96;');
      frontEl.innerHTML = `<iframe srcdoc="${encodedHtml}" style="position:absolute;top:0;left:0;width:864px;height:576px;border:none;transform-origin:top left;pointer-events:none;max-width:none;" scrolling="no"></iframe>`;
      frontEl.title = 'Auto-generated — click to preview';
      frontEl.onclick = ()=>previewDripFront(step);
      requestAnimationFrame(()=>{
        const iframe = frontEl.querySelector('iframe');
        if(iframe){ const w=frontEl.offsetWidth||300; iframe.style.transform='scale('+(w/864)+')'; }
      });
      setTimeout(()=>{
        const iframe = frontEl.querySelector('iframe');
        if(iframe){ const w=frontEl.offsetWidth||300; iframe.style.transform='scale('+(w/864)+')'; }
      }, 150);
    }

    // Back side — always render the USPS address template
    const fromName = cfg.companyName  || 'Your Company';
    const fromAddr = cfg.companyAddress|| '1 Company Dr';
    const fromCity = cfg.companyCity   || '';
    const fromPhone= cfg.phone         || '';
    const logoUrl  = cfg.logoData      || '';
    // Use first estimate as sample data for the preview, or generic placeholder
    const sampleEst = (S.estimates||[]).find(e=>!e.isRevision && !e.deleted);
    const previewToName = sampleEst ? (sampleEst.owner||'Sample Homeowner') : 'Sample Homeowner';
    const previewToAddr = sampleEst ? (sampleEst.addr||'123 Main Street, Canton, MI 48188') : '123 Main Street, Canton, MI 48188';
    const backHtml = buildPostcardBackInline({ fromName, fromAddr, fromCity, fromPhone, logoUrl, toName: previewToName, toAddr: previewToAddr });
    backEl.innerHTML = backHtml;
    // Make back clickable to open lightbox (matches front card behavior)
    backEl.style.cursor = 'zoom-in';
    backEl.title = 'Click to enlarge back';
    backEl.onclick = () => previewPostcardBackLightbox(step, previewToName, previewToAddr, fromName, fromAddr, fromCity, fromPhone, logoUrl);
  });
}

// Inline (iframe-free) version of the postcard back for embedding in the tab
function buildPostcardBackInline({ fromName, fromAddr, fromCity, fromPhone, logoUrl, toName, toAddr }){
  return `
  <div style="position:absolute;inset:0;display:flex;font-family:Arial,sans-serif;background:#fff;padding:16px 20px;gap:16px;box-sizing:border-box;">
    <!-- Return address left column -->
    <div style="flex:1.4;display:flex;flex-direction:column;justify-content:space-between;border-right:1px dashed #bbb;padding-right:16px;overflow:hidden;">
      <div>
        ${logoUrl ? '<img src="'+logoUrl+'" style="max-width:100px;max-height:36px;object-fit:contain;display:block;margin-bottom:8px;">' : ''}
        <div style="font-weight:700;font-size:11px;color:#111;line-height:1.3;">${fromName}</div>
        <div style="color:#666;font-size:10px;line-height:1.5;margin-top:3px;">${fromAddr}${fromCity ? '<br>'+fromCity : ''}${fromPhone ? '<br>'+fromPhone : ''}</div>
      </div>
      <div style="font-size:6px;color:#ccc;letter-spacing:3px;text-align:center;padding-top:6px;border-top:1px dashed #ddd;">|||||||||||||||||||||||||||||||||||||</div>
    </div>
    <!-- Delivery right column -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
      <div style="align-self:flex-end;border:1px solid #444;padding:5px 8px;text-align:center;font-size:7px;color:#333;line-height:1.5;">
        <strong style="display:block;font-size:9px;letter-spacing:.3px;">PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000
      </div>
      <div style="font-size:11px;line-height:1.7;color:#111;">
        <div style="font-weight:700;font-size:12px;margin-bottom:2px;">\${toName||'Homeowner Name'}</div>
        <div style="font-size:10px;color:#555;font-style:italic;margin-bottom:4px;">Or Current Resident</div>
        <div style="border-top:1px solid #eee;margin-bottom:5px;"></div>
        \${(toAddr||'123 Main Street, City, State 00000').split(',').map(l=>'<div>'+l.trim()+'</div>').join('')}
      </div>
      <div style="font-size:6px;color:#ccc;letter-spacing:2px;text-align:center;">DELIVERY POINT BARCODE</div>
    </div>
  </div>`;
}

function populateEstPinPicker(){
  const sel = document.getElementById('est-pin-picker');
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Select a pinned address —</option>';
  (S.pins||[]).forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.address || (p.lat.toFixed(4)+', '+p.lng.toFixed(4));
    if(p.id === currentEstPinId) opt.selected = true;
    sel.appendChild(opt);
  });
  if(cur && !currentEstPinId) sel.value = cur;
}

function loadEstFromPicker(){
  const sel = document.getElementById('est-pin-picker');
  if(!sel || !sel.value) return;
  const p = S.pins.find(x=>x.id===sel.value);
  if(!p) return;
  currentEstPinId = p.id;
  // Reset form fields and clear any contact picker lists from previous pin
  document.getElementById('e-owner').value = '';
  document.getElementById('e-email').value = '';
  if(document.getElementById('e-phone')) document.getElementById('e-phone').value = '';
  var _oldPhonePicker = document.getElementById('e-phone-picker-list');
  if(_oldPhonePicker) _oldPhonePicker.remove();
  var _oldEmailPicker = document.getElementById('e-email-picker-list');
  if(_oldEmailPicker) _oldEmailPicker.remove();
  document.getElementById('e-addr').value = p.address || '';
  clearHomePhoto();
  ['a-sky','a-chim','a-gut','a-iws','a-solar'].forEach(function(id){var el=document.getElementById(id);if(el)el.checked=false;});
  ['a-solar-kw','a-solar-flat'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  const solarInp=document.getElementById('solar-inputs'); if(solarInp) solarInp.style.display='none';
  const solarDisp=document.getElementById('solar-calc-display'); if(solarDisp) solarDisp.textContent='';
  // Try to load from S.estimates first (has photo_data), fall back to pin.estimate
  const savedEst = (S.estimates||[]).find(function(e){return e.pinId === p.id && !e.deletedAt;});
  // Always reset _allPhotos before loading (prevents stale photos from previous pin)
  _clearAllPhotos();
  if(savedEst){
    if(savedEst.owner) document.getElementById('e-owner').value = savedEst.owner;
    if(savedEst.email) document.getElementById('e-email').value = savedEst.email;
    if(savedEst.phone && document.getElementById('e-phone')) document.getElementById('e-phone').value = savedEst.phone||'';
    if(savedEst.structures && savedEst.structures.length) structures = savedEst.structures.map(function(s){return normStruct(s);});
    else structures = [{id:'s1',name:'Main House',sqft:0,stories:'1',pitch:'1.118',mat:'1.3',complexity:'1.12',pts:null}];
    // Load all photos via unified system (migrates legacy fields automatically)
    _loadAllPhotosFromEst(savedEst, p);
    window._editingEstimateId = savedEst.id;
  } else if(p.estimate){
    const est = typeof p.estimate === 'string' ? JSON.parse(p.estimate) : p.estimate;
    if(est.owner) document.getElementById('e-owner').value = est.owner;
    if(est.email) document.getElementById('e-email').value = est.email;
    if(est.phone && document.getElementById('e-phone')) document.getElementById('e-phone').value = est.phone||'';
    if(est.structures && est.structures.length) structures = est.structures.map(function(s){return normStruct(s);})
    else structures = [{id:'s1',name:'Main House',sqft:0,stories:'1',pitch:'1.118',mat:'1.3',complexity:'1.12',pts:null}];
    // Load all photos via unified system
    _loadAllPhotosFromEst(est, p);
  } else {
    structures = [{id:'s1',name:'Main House',sqft:0,stories:'1',pitch:'1.118',mat:'1.3',complexity:'1.12',pts:null}];
    // Load photos from pin (no estimate yet)
    _loadAllPhotosFromPin(p);
  }
  renderStructures(); calcP(); updatePreview();
  // Show cached equity data if already looked up previously
  if(p.equityData) showEquityBadge(p.equityData); else hideEquityBadge();
  toast('📋 Loaded: '+p.address.split(',')[0],'info');
  // Refresh accordion summaries
  if(typeof _accUpdateHomeownerSummary==='function') _accUpdateHomeownerSummary();
  if(typeof _accUpdatePropertySummary==='function') _accUpdatePropertySummary();
  // Refresh unlock button state
  if(typeof _estRefreshUnlockUI==='function') _estRefreshUnlockUI();
  // Auto-lookup owner name if field is empty
  if(masterRentcastKey && p.address && !document.getElementById('e-owner').value.trim()){
    autoFillOwnerIfEmpty(p.address);
  }
  // Fetch satellite roof measurement (non-blocking)
  hideSolarBanner();
  if(p.lat && p.lng){
    fetchSolarData(p.lat, p.lng).then(function(solarData){
      if(solarData && solarData.status==='ok'){
        showSolarBanner(solarData);
        // Auto-apply only if sqft is still 0
        const mainStruct = structures[0];
        if(mainStruct && (!mainStruct.sqft || mainStruct.sqft===0)){
          applySolarToEstimate();
        }
      } else {
        if(typeof showSolarUnavailableBanner === 'function') showSolarUnavailableBanner();
      }
    }).catch(function(){
      if(typeof showSolarUnavailableBanner === 'function') showSolarUnavailableBanner();
    });
  }
}
// ── AUTO-SAVE DRAFT ──────────────────────────────────────────────────────
let _draftTimer = null;
function scheduleDraftSave(){
  clearTimeout(_draftTimer);
  _draftTimer = setTimeout(saveDraft, 2000);
}
function saveDraft(){
  if(!currentEstPinId) return;
  const draft = {
    pinId: currentEstPinId,
    owner: (document.getElementById('e-owner')||{}).value||'',
    email: (document.getElementById('e-email')||{}).value||'',
    structures: (structures||[]).map(s=>({...s})),
    damage_photos: window._damagePhotos||[],
    skylight: (document.getElementById('a-sky')||{}).checked||false,
    skylightQty: parseInt((document.getElementById('a-sky-q')||{}).value||1),
    chimney: (document.getElementById('a-chim')||{}).checked||false,
    gutters: (document.getElementById('a-gut')||{}).checked||false,
    iceWaterShield: (document.getElementById('a-iws')||{}).checked||false,
    gutterLf: parseInt((document.getElementById('a-gut-q')||{}).value||120),
    solar: (document.getElementById('a-solar')||{}).checked||false,
    solarKw: parseFloat((document.getElementById('a-solar-kw')||{}).value||0),
    solarFlat: parseFloat((document.getElementById('a-solar-flat')||{}).value||0),
  };
  try{ localStorage.setItem('biddrop_draft_'+currentEstPinId, JSON.stringify(draft)); }catch(e){}
}
function restoreDraft(pinId){
  try{
    const raw = localStorage.getItem('biddrop_draft_'+pinId);
    if(!raw) return false;
    const draft = JSON.parse(raw);
    if(!draft || !draft.structures) return false;
    if(draft.owner) document.getElementById('e-owner').value = draft.owner;
    // Restore email from draft — but only if the field is currently empty (don't overwrite email loaded from Supabase)
    const emailEl = document.getElementById('e-email');
    if(emailEl && draft.email && !emailEl.value) emailEl.value = draft.email;
    // Restore phone from draft — but only if the field is currently empty (don't overwrite a phone loaded from Supabase)
    const phoneEl = document.getElementById('e-phone');
    if(phoneEl && draft.phone && !phoneEl.value) phoneEl.value = draft.phone;
    structures = draft.structures.map(s=>normStruct(s));
    if(draft.damage_photos && draft.damage_photos.length) window._damagePhotos = [...draft.damage_photos];
    const sky=document.getElementById('a-sky'); if(sky) sky.checked=!!draft.skylight;
    const skyQ=document.getElementById('a-sky-q'); if(skyQ) skyQ.value=draft.skylightQty||1;
    const chim=document.getElementById('a-chim'); if(chim) chim.checked=!!draft.chimney;
    const gut=document.getElementById('a-gut'); if(gut) gut.checked=!!draft.gutters;
    const iws=document.getElementById('a-iws'); if(iws) iws.checked=!!draft.iceWaterShield;
    const gutQ=document.getElementById('a-gut-q'); if(gutQ) gutQ.value=draft.gutterLf||120;
    const sol=document.getElementById('a-solar'); if(sol){ sol.checked=!!draft.solar; toggleSolarInputs(); }
    const solKw=document.getElementById('a-solar-kw'); if(solKw) solKw.value=draft.solarKw||'';
    const solFlat=document.getElementById('a-solar-flat'); if(solFlat) solFlat.value=draft.solarFlat||'';
    const banner=document.getElementById('draft-banner');
    const bannerTime=document.getElementById('draft-banner-time');
    if(banner){ banner.style.display='flex'; if(bannerTime) bannerTime.textContent='· '+timeAgo(draft.savedAt); }
    return true;
  }catch(e){ return false; }
}
function discardDraft(){
  if(currentEstPinId) try{ localStorage.removeItem('biddrop_draft_'+currentEstPinId); }catch(e){}
  const banner=document.getElementById('draft-banner');
  if(banner) banner.style.display='none';
  toast('Draft discarded','info');
}
function clearDraftBanner(){
  const banner=document.getElementById('draft-banner');
  if(banner) banner.style.display='none';
}
function _resetPriceOverride(){
  window._priceOverrideOn = false;
  const inp = document.getElementById('e-price-override');
  const wrap = document.getElementById('price-override-input-wrap');
  const btn = document.getElementById('price-override-toggle');
  const lbl = document.getElementById('price-override-toggle-label');
  const icon = document.getElementById('price-override-icon');
  if(inp) inp.value='';
  if(wrap) wrap.style.display='none';
  if(btn){ btn.style.borderColor='rgba(255,255,255,.15)'; btn.style.color='rgba(255,255,255,.45)'; btn.style.background='none'; }
  if(lbl) lbl.textContent='Override Price';
  if(icon) icon.textContent='✏️';
}
function newEstimate(){
  currentEstPinId = null;
  document.getElementById('e-owner').value = '';
  document.getElementById('e-addr').value = '';
  document.getElementById('e-email').value = '';
  window._damagePhotos = [];
  clearHomePhoto(); // always wipe photo when starting fresh
  clearDraftBanner();
  hideEquityBadge();
  if(typeof hideSolarBanner==='function') hideSolarBanner();
  _resetPriceOverride();
  structures = [{id:'s1',name:'Main House',sqft:0,stories:'1',pitch:'1.118',mat:'1.3',complexity:'1.12',pts:null}];
  renderStructures(); calcP(); updatePreview();
  const sel = document.getElementById('est-pin-picker');
  if(sel) sel.value = '';
  // Pre-fill default rep video from company settings
  const defaultVid = (S.cfg && S.cfg.repVideoUrl) || '';
  const vidEl = document.getElementById('e-video');
  if(vidEl) vidEl.value = defaultVid;
  if(defaultVid) onEstVideoUrlInput();
  // Default expiration: 90 days from today
  const expiresEl = document.getElementById('e-expires');
  if(expiresEl){
    const d90 = new Date(); d90.setDate(d90.getDate()+90);
    expiresEl.value = d90.toISOString().split('T')[0];
  }
  toast('🗒 New estimate started','info');
}

function saveEstimateNow(){
  if(!currentEstPinId){
    toast('⚠️ No pin linked — select a pinned home from the dropdown first','warn');
    return;
  }
  const pin = (S.pins||[]).find(p=>p.id===currentEstPinId);
  if(!pin){ toast('Pin not found','error'); return; }
  // Block duplicate address: prevent saving a new estimate for an address already saved by a different pin
  if(!window._editingEstimateId){
    const thisAddr = (pin.address||'').trim().toLowerCase();
    const dupEst = (S.estimates||[]).find(e=>!e.isRevision && !e.deletedAt && e.pinId !== currentEstPinId && (e.addr||'').trim().toLowerCase() === thisAddr);
    if(dupEst){
      toast('⚠️ An estimate already exists for this address ('+escHtml(dupEst.addr)+'). Delete the existing one first.','error');
      return;
    }
  }
  const owner = (document.getElementById('e-owner')||{}).value.trim()||'Homeowner';
  const email = (document.getElementById('e-email')||{}).value.trim()||'';
  const phone = (document.getElementById('e-phone')||{}).value.trim()||'';
  const calcTotal = (structures||[]).reduce((sum,s)=>sum+(calcStructPrice?calcStructPrice(s):0),0);
  const overrideRaw = window._priceOverrideOn ? (parseFloat((document.getElementById('e-price-override')||{}).value)||0) : 0;
  const total = (window._priceOverrideOn && overrideRaw > 0) ? overrideRaw : calcTotal;
  const priceOverride = (window._priceOverrideOn && overrideRaw > 0) ? overrideRaw : null;
  // Photo: prefer the current form state (_homePhotoData, _allPhotos.front) over the stale pin.photo_url
  const frontFromAllPhotos = (window._allPhotos && (window._allPhotos.front||[])[0]) || null;
  const photoUrl = (window._homePhotoData && window._homePhotoData.startsWith('http') ? window._homePhotoData : null)
    || frontFromAllPhotos
    || pin.photo_url || null;
  const photoData = (window._homePhotoData && !window._homePhotoData.startsWith('http') ? window._homePhotoData : null) || null;
  const estRecord = {
    id: window._editingEstimateId || ('est_' + Date.now()),
    pinId: currentEstPinId,
    addr: pin.address || '',
    owner, email, phone, total, priceOverride,
    structures: (structures||[]).map(s=>({...s})),
    photo_url: photoUrl,
    photo_data: photoData,
    damage_photos: (window._damagePhotos && window._damagePhotos.length) ? [...window._damagePhotos] : (pin.damage_photos && pin.damage_photos.length ? [...pin.damage_photos] : null),
    all_photos: window._allPhotos ? JSON.parse(JSON.stringify(window._allPhotos)) : null,
    skylight: (document.getElementById('a-sky')||{}).checked||false,
    skylightQty: parseInt((document.getElementById('a-sky-q')||{}).value||1),
    chimney: (document.getElementById('a-chim')||{}).checked||false,
    gutters: (document.getElementById('a-gut')||{}).checked||false,
    iceWaterShield: (document.getElementById('a-iws')||{}).checked||false,
    gutterLf: parseInt((document.getElementById('a-gut-q')||{}).value||120),
    savedAt: new Date().toISOString(),
    sentAt: null, status: 'saved',
    rep: pin.rep || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : ''),
    expiresAt: (document.getElementById('e-expires')||{}).value ? new Date((document.getElementById('e-expires')||{}).value).toISOString() : null,
    repVideoUrl: (document.getElementById('e-video')||{}).value.trim() || null,
    inspectionNote: (document.getElementById('e-insp-note')||{}).value.trim() || null
  };
  const editingId = window._editingEstimateId || null;
  window._editingEstimateId = null;
  if(editingId){
    // Editing an existing estimate: replace it in-place but archive the old one as a revision
    const idx = (S.estimates||[]).findIndex(e=>e.id===editingId);
    if(idx>=0){
      const oldRec = S.estimates[idx];
      // Bump version and archive old as a revision sibling
      const prevVersion = oldRec.version||1;
      const archivedRev = {...oldRec, id:'rev_'+oldRec.id+'_v'+prevVersion, isRevision:true, revisedAt:new Date().toISOString()};
      estRecord.version = prevVersion + 1;
      S.estimates.splice(idx, 1, estRecord);
      S.estimates.push(archivedRev);
    } else {
      S.estimates.unshift(estRecord);
    }
  } else {
    // New save: mark existing active estimate for this pin as a revision
    const existing = (S.estimates||[]).filter(e=>e.pinId===currentEstPinId && !e.isRevision && !e.deletedAt);
    const revisedAt = new Date().toISOString();
    existing.forEach(e=>{
      e.isRevision=true; e.revisedAt=revisedAt;
      // Persist revision flag to Supabase so old estimates don't reappear as active on reload
      if(sb) sb.from('estimates').update({is_revision:true}).eq('id',e.id).then(({error})=>{
        if(error) console.warn('[BidDrop] mark revision:', error.message);
      });
    });
    const prevMax = existing.reduce((m,e)=>Math.max(m,e.version||1),0);
    estRecord.version = prevMax + 1;
    S.estimates.unshift(estRecord);
  }
  pin.estimate = { id: estRecord.id, owner, email, total, structures: estRecord.structures, rep: estRecord.rep, savedAt: estRecord.savedAt, damage_photos: estRecord.damage_photos||null };
  pin.at_est = estRecord.savedAt;
  // Auto-advance pin to 'quoted' when an estimate is saved (never go backward)
  if(typeof autoAdvancePinStatus === 'function') autoAdvancePinStatus(pin, 'quoted');
  else if(!pin.status || _PIN_ORDER.indexOf(pin.status) < _PIN_ORDER.indexOf('quoted')) pin.status = 'quoted';
  if(true){ // preserve block structure for estRow below
    pin.status = pin.status; // no-op, status already set above
    // Save to dedicated estimates table (primary persistence)
    const estRow = {
      id: estRecord.id,
      account_id: currentAccount ? currentAccount.id : null,
      pin_id: currentEstPinId,
      addr: estRecord.addr,
      owner: estRecord.owner,
      email: estRecord.email,
      phone: estRecord.phone || null,
      rep: estRecord.rep,
      total: estRecord.total,
      price_override: estRecord.priceOverride || null,
      structures: estRecord.structures,
      photo_url: estRecord.photo_url || null,
      photo_data: estRecord.photo_data || null,
      all_photos: _allPhotosForSupabase(estRecord.all_photos),
      damage_photos: (estRecord.damage_photos||[]).filter(s=>s&&s.startsWith('http'))||null,
      skylight: estRecord.skylight || false,
      skylight_qty: estRecord.skylightQty || 1,
      chimney: estRecord.chimney || false,
      gutters: estRecord.gutters || false,
      ice_water_shield: estRecord.iceWaterShield || false,
      gutter_lf: estRecord.gutterLf || 120,
      version: estRecord.version || 1,
      is_revision: estRecord.isRevision || false,
      parent_id: estRecord.parentId || null,
      saved_at: estRecord.savedAt,
      deleted_at: null,
      expires_at: estRecord.expiresAt || null,
      rep_video_url: estRecord.repVideoUrl || null,
      inspection_note: estRecord.inspectionNote || null
    };
    sb.from('estimates').upsert(estRow, {onConflict:'id'}).then(({error})=>{
      if(error) console.warn('[BidDrop] Save estimate to estimates table:', error.message);
    });
    // Also keep pin.estimate + photos in sync on the pin row (map badge + goEstFromPin fallback)
    sb.from('pins').update({
      estimate: pin.estimate, status: 'quoted',
      photo_url: estRecord.photo_url || pin.photo_url || null,
      all_photos: _allPhotosForSupabase(estRecord.all_photos || pin.all_photos),
      damage_photos: (estRecord.damage_photos||pin.damage_photos||[]).filter(s=>s&&s.startsWith('http'))||null,
      updated_at: new Date().toISOString()
    }).eq('id', currentEstPinId).then(({error})=>{
      if(error) console.warn('Save estimate to pin:', error);
    });
  } else {
    // Save to dedicated estimates table
    const estRow2 = {
      id: estRecord.id,
      account_id: currentAccount ? currentAccount.id : null,
      pin_id: currentEstPinId,
      addr: estRecord.addr,
      owner: estRecord.owner,
      email: estRecord.email,
      phone: estRecord.phone || null,
      rep: estRecord.rep,
      total: estRecord.total,
      price_override: estRecord.priceOverride || null,
      structures: estRecord.structures,
      photo_url: estRecord.photo_url || null,
      photo_data: estRecord.photo_data || null,
      all_photos: _allPhotosForSupabase(estRecord.all_photos),
      damage_photos: (estRecord.damage_photos||[]).filter(s=>s&&s.startsWith('http'))||null,
      skylight: estRecord.skylight || false,
      skylight_qty: estRecord.skylightQty || 1,
      chimney: estRecord.chimney || false,
      gutters: estRecord.gutters || false,
      ice_water_shield: estRecord.iceWaterShield || false,
      gutter_lf: estRecord.gutterLf || 120,
      version: estRecord.version || 1,
      is_revision: estRecord.isRevision || false,
      parent_id: estRecord.parentId || null,
      saved_at: estRecord.savedAt,
      deleted_at: null,
      expires_at: estRecord.expiresAt || null,
      rep_video_url: estRecord.repVideoUrl || null,
      inspection_note: estRecord.inspectionNote || null
    };
    sb.from('estimates').upsert(estRow2, {onConflict:'id'}).then(({error})=>{
      if(error) console.warn('[BidDrop] Save estimate to estimates table:', error.message);
    });
    sb.from('pins').update({
      estimate: pin.estimate,
      photo_url: estRecord.photo_url || pin.photo_url || null,
      all_photos: _allPhotosForSupabase(estRecord.all_photos || pin.all_photos),
      damage_photos: (estRecord.damage_photos||pin.damage_photos||[]).filter(s=>s&&s.startsWith('http'))||null,
      updated_at: new Date().toISOString()
    }).eq('id', currentEstPinId).then(({error})=>{
      if(error) console.warn('Save estimate to pin:', error);
    });
  }
  // Refresh the map marker so it shows updated status and estimate badge
  if(markers[currentEstPinId] && map){
    if(clusterGroup) clusterGroup.removeLayer(markers[currentEstPinId]);
    else map.removeLayer(markers[currentEstPinId]);
    delete markers[currentEstPinId];
  }
  addMarker(pin);
  // Clear draft after official save
  try{ localStorage.removeItem('biddrop_draft_'+currentEstPinId); }catch(e){}
  clearDraftBanner();
  save();
  addAct('Estimate saved for <strong>'+escHtml(pin.address||'')+'</strong> — <strong>$'+total.toLocaleString()+'</strong>','quoted');
  // Auto-sync estimate total to GHL opportunity (fire-and-forget)
  ghlUpdateOpportunityValue(pin, total).catch(e=>console.warn('GHL opp update:', e));
  // Also upsert contact in JobNimbus with updated owner info (fire-and-forget)
  if(pin.owner || document.getElementById('e-owner')?.value){ pin.owner = document.getElementById('e-owner')?.value||pin.owner; }
  jnUpsertContact(pin).catch(e=>console.warn('[JN] estimate save push:', e.message));
  toast('✅ Estimate saved!','success');
  setTimeout(()=>{ newEstimate(); goTab('estimates'); }, 600);
}
function autoSaveEstimateToPin(pinId){
  try{
    const pin = (S.pins||[]).find(p=>p.id===pinId);
    if(!pin) return;
    const owner = (document.getElementById('e-owner')||{}).value||'';
    const email = (document.getElementById('e-email')||{}).value||'';
    const total = (structures||[]).reduce((sum,s)=>sum+(calcStructPrice?calcStructPrice(s):0),0);
    pin.estimate = { owner, email, total, structures: (structures||[]).map(s=>({...s})) };
    pin.at_est = new Date().toISOString();
    sb.from('pins').update({ estimate: pin.estimate }).eq('id', pinId).then(({error})=>{
      if(error) console.warn('Auto-save estimate:', error);
    });
    save();
  }catch(e){ console.warn('autoSaveEstimateToPin error:', e); }
}

function togglePinPanel(){
  const p=document.getElementById('map-panel');
  p.classList.toggle('open');
  document.getElementById('fab-pins').textContent=p.classList.contains('open')?'✕':'📍';
}

function toggleMailPreview(){
  const p=document.getElementById('est-preview');
  const showing=p.classList.contains('mobile-show');
  p.classList.toggle('mobile-show',!showing);
  document.querySelector('.btn-preview-toggle').textContent=showing?'👁 Preview Mailer':'✕ Hide Preview';
  if(!showing) setTimeout(()=>p.scrollIntoView({behavior:'smooth',block:'start'}),80);
}


// ════════════════════════════════════════════════════════════════════════════
// TRADE SYSTEM HELPERS (Build 10)
// ════════════════════════════════════════════════════════════════════════════

// ── Default trade-specific pin status labels ──────────────────────────────────
const TRADE_STATUS_DEFAULTS = {
  roofing:    { needs_roof:'Needs Roof', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Converted', not_interested:'Not Interested', lost:'Lost' },
  solar:      { needs_roof:'Solar Prospect', interested:'Interested', contacted:'Contacted', quoted:'Proposal Sent', signed:'Contract Signed', converted:'Installed', not_interested:'Not Interested', lost:'Lost' },
  gutters:    { needs_roof:'Needs Gutters', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Installed', not_interested:'Not Interested', lost:'Lost' },
  siding:     { needs_roof:'Needs Siding', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Installed', not_interested:'Not Interested', lost:'Lost' },
  windows:    { needs_roof:'Needs Windows', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Installed', not_interested:'Not Interested', lost:'Lost' },
  insulation: { needs_roof:'Needs Insulation', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Installed', not_interested:'Not Interested', lost:'Lost' },
  paint:      { needs_roof:'Needs Paint', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Completed', not_interested:'Not Interested', lost:'Lost' },
  doors:      { needs_roof:'Needs Doors', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Installed', not_interested:'Not Interested', lost:'Lost' },
  fencing:    { needs_roof:'Needs Fencing', interested:'Interested', contacted:'Contacted', quoted:'Quoted', signed:'Signed', converted:'Installed', not_interested:'Not Interested', lost:'Lost' },
};

// ── Default trade-specific postcard copy ──────────────────────────────────────
const TRADE_POSTCARD_COPY_DEFAULTS = {
  roofing:    { headline1:'We Assessed', headline2:'Your Roof.', hook:'Most homeowners dread the pushy roofing salesman. I do things differently — I lead with my price, no pressure, no games.', why:'We assessed your neighborhood and identified your home as a candidate for roof replacement.', quote:'"They replaced our roof in one day, no mess, no drama." — Mike D.', guarantee:'No door-knocking. No pressure. Just your price.' },
  solar:      { headline1:'Go Solar,', headline2:'Save More.', hook:'The average homeowner saves $1,400/year with solar. We make it simple — no pushy sales, just your custom proposal.', why:'We assessed your home\'s roof orientation and sun exposure. Your property is a great candidate for solar panels.', quote:'"Our electric bill dropped to almost zero." — Sarah T.', guarantee:'Free solar assessment. No obligation.' },
  gutters:    { headline1:'Protect', headline2:'Your Home.', hook:'Clogged or damaged gutters cause foundation damage, basement flooding, and rot. We\'ll give you a straight price — no games.', why:'We assessed your home and noticed your gutters may need attention. Proper gutters protect your foundation and landscaping.', quote:'"Fast install, great price, no mess left behind." — Tom R.', guarantee:'Free gutter assessment. No pressure.' },
  siding:     { headline1:'New Siding,', headline2:'New Look.', hook:'Worn siding costs you money on energy bills and curb appeal. We lead with our price — no pressure, no games.', why:'We assessed your home and identified your siding as a candidate for replacement or repair.', quote:'"Our home looks brand new. Neighbors keep asking who did it." — Lisa M.', guarantee:'Free siding assessment. No obligation.' },
  windows:    { headline1:'New Windows,', headline2:'Lower Bills.', hook:'Old windows leak energy and money. We give you a straight price — no pushy sales, no games.', why:'We assessed your home and identified windows that may be costing you on heating and cooling bills.', quote:'"The difference in our energy bill was immediate." — Dave K.', guarantee:'Free window assessment. No pressure.' },
  insulation: { headline1:'Stay Warm,', headline2:'Spend Less.', hook:'Poor insulation is the #1 cause of high energy bills. We\'ll assess your home and give you a straight price.', why:'We assessed your neighborhood and identified homes that may be losing heat through inadequate attic insulation.', quote:'"Our heating bill dropped 30% after the insulation upgrade." — Carol B.', guarantee:'Free insulation assessment. No obligation.' },
  paint:      { headline1:'Fresh Paint,', headline2:'Fresh Start.', hook:'Faded or peeling exterior paint hurts your home\'s value. We give you a straight price — no games, no pressure.', why:'We assessed your home and noticed your exterior paint may need attention to protect your siding and boost curb appeal.', quote:'"Our house looks incredible. Best money we\'ve spent." — James P.', guarantee:'Free exterior paint assessment. No pressure.' },
  doors:      { headline1:'New Doors,', headline2:'Better Security.', hook:'Old doors leak energy and compromise security. We give you a straight price — no pushy sales, no games.', why:'We assessed your home and identified doors that may need replacement for better energy efficiency and security.', quote:'"The new front door completely transformed our home\'s look." — Amy S.', guarantee:'Free door assessment. No obligation.' },
  fencing:    { headline1:'New Fence,', headline2:'More Privacy.', hook:'A quality fence adds privacy, security, and value to your home. We lead with our price — no games, no pressure.', why:'We assessed your property and identified your fencing as a candidate for replacement or new installation.', quote:'"Beautiful fence, installed in one day, great price." — Bob W.', guarantee:'Free fencing assessment. No pressure.' },
};

// ── Get status label for a pin, respecting trade-specific labels ──────────────
function sLabelForTrade(status, trade){
  if(!trade) return sLabel(status);
  const tradeStatuses = S.cfg && S.cfg.tradeStatuses;
  if(tradeStatuses && tradeStatuses[trade] && tradeStatuses[trade][status]){
    return tradeStatuses[trade][status];
  }
  const defaults = TRADE_STATUS_DEFAULTS[trade];
  if(defaults && defaults[status]) return defaults[status];
  return sLabel(status);
}

// ── Get active trade for a pin (from its estimate's interested_trades) ────────
function _getPinActiveTrade(pin){
  if(!pin) return null;
  const est = pin.estimate;
  if(est && est.interested_trades && est.interested_trades.length) return est.interested_trades[0];
  return null;
}

// ── Build trade pricing JSON blob from current S.cfg ─────────────────────────
function _buildTradePricingJson(){
  const c = S.cfg || {};
  return {
    // Solar
    solarPricePerWatt: c.solarPricePerWatt, solarMinKw: c.solarMinKw, solarMaxKw: c.solarMaxKw,
    solarInstallDays: c.solarInstallDays, solarBattery: c.solarBattery, solarPanelUpgrade: c.solarPanelUpgrade,
    solarElecUpgrade: c.solarElecUpgrade, solarRoofReinforce: c.solarRoofReinforce,
    solarFedCredit: c.solarFedCredit, solarStateRebate: c.solarStateRebate,
    solarUtilityRebate: c.solarUtilityRebate, solarMonthlySavings: c.solarMonthlySavings,
    solarOverhead: c.solarOverhead, solarMargin: c.solarMargin, solarTax: c.solarTax,
    solarFinEnabled: c.solarFinEnabled, solarFinApr: c.solarFinApr, solarFinTerm: c.solarFinTerm,
    // Fencing
    fenWood: c.fenWood, fenVinyl: c.fenVinyl, fenChain: c.fenChain, fenAluminum: c.fenAluminum,
    fenSplit: c.fenSplit, fenCedar: c.fenCedar,
    fenWoodPlf: c.fenWoodPlf, fenVinylPlf: c.fenVinylPlf, fenChainPlf: c.fenChainPlf,
    fenAlumPlf: c.fenAlumPlf, fenSplitPlf: c.fenSplitPlf, fenCedarPlf: c.fenCedarPlf,
    fenGateSingle: c.fenGateSingle, fenGateDouble: c.fenGateDouble,
    fenRemoval: c.fenRemoval, fenPostConcrete: c.fenPostConcrete,
    fenOverhead: c.fenOverhead, fenMargin: c.fenMargin, fenTax: c.fenTax,
    fenFinEnabled: c.fenFinEnabled, fenFinApr: c.fenFinApr, fenFinTerm: c.fenFinTerm,
    // Siding
    sidVinyl: c.sidVinyl, sidHardie: c.sidHardie, sidWood: c.sidWood, sidEngWood: c.sidEngWood,
    sidMetal: c.sidMetal, sidStucco: c.sidStucco,
    sidVinylPsf: c.sidVinylPsf, sidHardiePsf: c.sidHardiePsf, sidWoodPsf: c.sidWoodPsf,
    sidEngWoodPsf: c.sidEngWoodPsf, sidMetalPsf: c.sidMetalPsf, sidStuccoPsf: c.sidStuccoPsf,
    sidRemoval: c.sidRemoval, sidHousewrap: c.sidHousewrap, sidTrim: c.sidTrim,
    sidCorners: c.sidCorners, sidWindowWrap: c.sidWindowWrap, sidInsulation: c.sidInsulation,
    sidOverhead: c.sidOverhead, sidMargin: c.sidMargin, sidTax: c.sidTax,
    sidFinEnabled: c.sidFinEnabled, sidFinApr: c.sidFinApr, sidFinTerm: c.sidFinTerm,
    // Gutters
    gutAlum5: c.gutAlum5, gutAlum6: c.gutAlum6, gutSeamless: c.gutSeamless, gutCopper: c.gutCopper,
    gutHalfrnd: c.gutHalfrnd, gutVinyl: c.gutVinyl, gutGuard: c.gutGuard, gutDownspout: c.gutDownspout,
    gutOverhead: c.gutOverhead, gutMargin: c.gutMargin, gutTax: c.gutTax,
    gutFinEnabled: c.gutFinEnabled, gutFinApr: c.gutFinApr, gutFinTerm: c.gutFinTerm,
    // Insulation
    insBlownFg: c.insBlownFg, insBlownCell: c.insBlownCell, insFoamOpen: c.insFoamOpen,
    insFoamClosed: c.insFoamClosed, insBattR13: c.insBattR13, insBattR19: c.insBattR19,
    insRemoval: c.insRemoval, insAirsealing: c.insAirsealing, insVapor: c.insVapor, insHatch: c.insHatch,
    insOverhead: c.insOverhead, insMargin: c.insMargin, insTax: c.insTax,
    insFinEnabled: c.insFinEnabled, insFinApr: c.insFinApr, insFinTerm: c.insFinTerm,
    // Paint
    pntSiding1c: c.pntSiding1c, pntSiding2c: c.pntSiding2c, pntTrim1c: c.pntTrim1c, pntTrim2c: c.pntTrim2c,
    pntDeck1c: c.pntDeck1c, pntDeck2c: c.pntDeck2c, pntMasonry: c.pntMasonry, pntGarageDoor: c.pntGarageDoor,
    pntPowerwash: c.pntPowerwash, pntCaulk: c.pntCaulk, pntPrimer: c.pntPrimer, pntStain: c.pntStain,
    pntOverhead: c.pntOverhead, pntMargin: c.pntMargin, pntTax: c.pntTax,
    pntFinEnabled: c.pntFinEnabled, pntFinApr: c.pntFinApr, pntFinTerm: c.pntFinTerm,
    // Doors
    dorSteelEntry: c.dorSteelEntry, dorFiberEntry: c.dorFiberEntry, dorWoodEntry: c.dorWoodEntry,
    dorDoubleEntry: c.dorDoubleEntry, dorStormStd: c.dorStormStd, dorStormFull: c.dorStormFull,
    dorScreen: c.dorScreen, dorSliding: c.dorSliding, dorGarageSingle: c.dorGarageSingle,
    dorGarageDouble: c.dorGarageDouble, dorGarageInsul: c.dorGarageInsul, dorOpener: c.dorOpener,
    dorFrameRepair: c.dorFrameRepair, dorHardware: c.dorHardware, dorWeatherstrip: c.dorWeatherstrip,
    dorPaint: c.dorPaint, dorOverhead: c.dorOverhead, dorMargin: c.dorMargin, dorTax: c.dorTax,
    dorFinEnabled: c.dorFinEnabled, dorFinApr: c.dorFinApr, dorFinTerm: c.dorFinTerm,
    // Windows
    winDblHung: c.winDblHung, winCasement: c.winCasement, winPicture: c.winPicture,
    winSliding: c.winSliding, winBay: c.winBay, winSkylight: c.winSkylight,
    winStorm: c.winStorm, winEgress: c.winEgress,
    winLowe: c.winLowe, winTriple: c.winTriple, winTrim: c.winTrim, winRemoval: c.winRemoval,
    winCntSm: c.winCntSm, winCntMd: c.winCntMd, winCntLg: c.winCntLg, winCntXl: c.winCntXl,
    winOverhead: c.winOverhead, winMargin: c.winMargin, winTax: c.winTax,
  };
}

// ── Restore trade pricing from tradePricingJson blob (called after account load) ──
function _restoreTradePricingFromJson(){
  const blob = S.cfg && S.cfg.tradePricingJson;
  if(!blob) return;
  // Merge blob fields into S.cfg (only if the field is not already set from DB columns)
  Object.assign(S.cfg, blob);
}

// ── Read trade statuses from Settings UI ─────────────────────────────────────
function _readTradeStatuses(){
  const result = {};
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  const STATUS_KEYS = ['needs_roof','interested','contacted','quoted','signed','converted','not_interested','lost'];
  ALL_TRADES.forEach(trade => {
    const tradeObj = {};
    STATUS_KEYS.forEach(sk => {
      const el = document.getElementById('ts-'+trade+'-'+sk.replace('_','-'));
      if(el && el.value.trim()) tradeObj[sk] = el.value.trim();
    });
    if(Object.keys(tradeObj).length) result[trade] = tradeObj;
  });
  return Object.keys(result).length ? result : (S.cfg.tradeStatuses || null);
}

// ── Read trade postcard copy from Settings UI ─────────────────────────────────
function _readTradePostcardCopy(){
  const result = {};
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  ALL_TRADES.forEach(trade => {
    const fields = ['headline1','headline2','hook','why','quote','guarantee'];
    const tradeObj = {};
    fields.forEach(f => {
      const el = document.getElementById('tpc-'+trade+'-'+f);
      if(el && el.value.trim()) tradeObj[f] = el.value.trim();
    });
    if(Object.keys(tradeObj).length) result[trade] = tradeObj;
  });
  return Object.keys(result).length ? result : (S.cfg.tradePostcardCopy || null);
}

// ── Load trade statuses into Settings UI ─────────────────────────────────────
function loadTradeStatusSettings(){
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  const STATUS_KEYS = ['needs_roof','interested','contacted','quoted','signed','converted','not_interested','lost'];
  const saved = (S.cfg && S.cfg.tradeStatuses) || {};
  ALL_TRADES.forEach(trade => {
    const tradeStatuses = saved[trade] || TRADE_STATUS_DEFAULTS[trade] || {};
    STATUS_KEYS.forEach(sk => {
      const el = document.getElementById('ts-'+trade+'-'+sk.replace('_','-'));
      if(el) el.value = tradeStatuses[sk] || TRADE_STATUS_DEFAULTS[trade]?.[sk] || sk;
    });
  });
}

// ── Load trade postcard copy into Settings UI ─────────────────────────────────
function loadTradePostcardCopySettings(){
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  const saved = (S.cfg && S.cfg.tradePostcardCopy) || {};
  ALL_TRADES.forEach(trade => {
    const tradeCopy = saved[trade] || TRADE_POSTCARD_COPY_DEFAULTS[trade] || {};
    ['headline1','headline2','hook','why','quote','guarantee'].forEach(f => {
      const el = document.getElementById('tpc-'+trade+'-'+f);
      if(el) el.value = tradeCopy[f] || TRADE_POSTCARD_COPY_DEFAULTS[trade]?.[f] || '';
    });
  });
}

// ── Get postcard copy for active trade (used by postcard renderer) ────────────
function getTradePostcardCopy(trade){
  if(!trade || trade === 'roofing') return null; // use global defaults for roofing
  const saved = (S.cfg && S.cfg.tradePostcardCopy && S.cfg.tradePostcardCopy[trade]);
  if(saved) return saved;
  return TRADE_POSTCARD_COPY_DEFAULTS[trade] || null;
}

// ── Solar map overlay ─────────────────────────────────────────────────────────
let _solarOverlayActive = false;
let _solarOverlayMarkers = [];
let _solarOverlayLegend = null;

function toggleSolarOverlay(){
  _solarOverlayActive = !_solarOverlayActive;
  const btn = document.getElementById('solar-overlay-btn');
  if(btn){
    btn.style.background = _solarOverlayActive ? 'var(--accent)' : 'var(--card2)';
    btn.style.color = _solarOverlayActive ? '#fff' : 'var(--mid)';
    btn.title = _solarOverlayActive ? 'Hide Solar Overlay' : 'Show Solar kW Overlay';
  }
  if(_solarOverlayActive){
    _renderSolarOverlay();
  } else {
    _removeSolarOverlay();
  }
}

function _renderSolarOverlay(){
  if(!map) return;
  _removeSolarOverlay();
  const pins = (S.pins || []).filter(p => p.solarKw && p.lat && p.lng);
  if(!pins.length){
    toast('No solar data on pins yet — run Solar lookup on a pin first','warn');
    _solarOverlayActive = false;
    const btn = document.getElementById('solar-overlay-btn');
    if(btn){ btn.style.background='var(--card2)'; btn.style.color='var(--mid)'; }
    return;
  }
  pins.forEach(p => {
    const kw = parseFloat(p.solarKw) || 0;
    // Color scale: <5kW = yellow, 5-10kW = orange, >10kW = green
    const color = kw >= 10 ? '#22C55E' : kw >= 5 ? '#F97316' : '#EAB308';
    const circle = L.circleMarker([p.lat, p.lng], {
      radius: Math.max(8, Math.min(20, kw * 1.5)),
      fillColor: color, color: '#fff', weight: 1.5,
      fillOpacity: 0.75, opacity: 0.9
    }).addTo(map);
    circle.bindTooltip(`<strong>${p.address||'Pin'}</strong><br>☀️ ${kw.toFixed(1)} kW${p.solarPotential ? '<br>'+p.solarPotential : ''}`, { permanent: false, direction: 'top' });
    _solarOverlayMarkers.push(circle);
  });
  // Legend
  _solarOverlayLegend = L.control({ position: 'bottomright' });
  _solarOverlayLegend.onAdd = function(){
    const div = L.DomUtil.create('div', 'solar-overlay-legend');
    div.style.cssText = 'background:var(--card2,#1a1a1a);border:1px solid var(--border,#333);border-radius:8px;padding:10px 14px;font-family:var(--font-b,sans-serif);font-size:12px;color:var(--text,#fff);min-width:140px;';
    div.innerHTML = '<div style="font-weight:700;margin-bottom:6px;">☀️ Solar kW</div>'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="width:12px;height:12px;border-radius:50%;background:#22C55E;display:inline-block;"></span> 10+ kW (High)</div>'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;"><span style="width:12px;height:12px;border-radius:50%;background:#F97316;display:inline-block;"></span> 5–10 kW (Mid)</div>'
      + '<div style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:50%;background:#EAB308;display:inline-block;"></span> &lt;5 kW (Low)</div>';
    return div;
  };
  _solarOverlayLegend.addTo(map);
  toast('☀️ Solar overlay: '+pins.length+' pins with solar data','info');
}

function _removeSolarOverlay(){
  if(!map) return;
  _solarOverlayMarkers.forEach(m => { try{ map.removeLayer(m); }catch(e){} });
  _solarOverlayMarkers = [];
  if(_solarOverlayLegend){ try{ map.removeControl(_solarOverlayLegend); }catch(e){} _solarOverlayLegend = null; }
}

// ── Store solar kW on pin after Solar API lookup ──────────────────────────────
function storeSolarKwOnPin(pinId, systemKw, potential){
  if(!pinId || !systemKw) return;
  const pin = (S.pins||[]).find(p=>p.id===pinId);
  if(!pin) return;
  pin.solarKw = systemKw;
  pin.solarPotential = potential || null;
  if(sb && currentAccount){
    sb.from('pins').update({ solar_kw: systemKw, solar_potential: potential||null }).eq('id', pinId).then(({error})=>{
      if(error) console.warn('[BidDrop] storeSolarKwOnPin:', error.message);
    });
  }
  // Refresh overlay if active
  if(_solarOverlayActive) _renderSolarOverlay();
}

// ── Render trade status settings accordion ────────────────────────────────────
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


// ── Render trade postcard copy accordion ──────────────────────────────────────
function renderTradePostcardAccordion(){
  const container = document.getElementById('trade-postcard-accordion');
  if(!container) return;
  const et = (S.cfg && S.cfg.enabledTrades) || {roofing:true};
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  const saved = (S.cfg && S.cfg.tradePostcardCopy) || {};

  const enabledTrades = ALL_TRADES.filter(t => t === 'roofing' ? et.roofing !== false : !!et[t]);

  const COPY_FIELDS = [
    { key:'headline1', label:'Headline Line 1', placeholder:'e.g. We Assessed', type:'input' },
    { key:'headline2', label:'Headline Line 2', placeholder:'e.g. Your Roof.', type:'input' },
    { key:'hook', label:'Hook / Intro Copy', placeholder:'Main hook paragraph', type:'textarea' },
    { key:'why', label:'Why We\'re Here', placeholder:'Why this homeowner received the card', type:'textarea' },
    { key:'quote', label:'Customer Quote', placeholder:'"Great work!" — Name, City', type:'input' },
    { key:'guarantee', label:'Guarantee / CTA', placeholder:'e.g. No pressure. Just your price.', type:'input' },
  ];

  container.innerHTML = enabledTrades.map(trade => {
    const m = TRADE_META[trade] || { label: trade, color: '#F25C05' };
    const tradeCopy = saved[trade] || TRADE_POSTCARD_COPY_DEFAULTS[trade] || {};
    const fields = COPY_FIELDS.map(f => {
      const defVal = (TRADE_POSTCARD_COPY_DEFAULTS[trade] && TRADE_POSTCARD_COPY_DEFAULTS[trade][f.key]) || '';
      const curVal = tradeCopy[f.key] || defVal;
      const inputEl = f.type === 'textarea'
        ? `<textarea id="tpc-${trade}-${f.key}" rows="2" placeholder="${defVal.replace(/"/g,'&quot;')}"
            style="flex:1;background:var(--input);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;font-family:var(--font-b);resize:vertical;min-height:48px;">${curVal.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>`
        : `<input id="tpc-${trade}-${f.key}" type="text" value="${curVal.replace(/"/g,'&quot;')}"
            placeholder="${defVal.replace(/"/g,'&quot;')}"
            style="flex:1;background:var(--input);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:12px;font-family:var(--font-b);" />`;
      return `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <label style="font-size:11px;color:var(--muted);min-width:130px;padding-top:7px;font-family:var(--font-b);">${f.label}</label>
        ${inputEl}
      </div>`;
    }).join('');
    return `<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden;">
      <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'"
        style="display:flex;align-items:center;gap:10px;padding:12px 16px;cursor:pointer;background:var(--card2);">
        <span style="font-size:18px;">${m.label.split(' ')[0]}</span>
        <span style="font-size:13px;font-weight:700;color:var(--text);">${m.label.replace(/^[^\s]+\s/,'')}</span>
        <span style="font-size:10px;color:var(--muted);margin-left:auto;">▾ Expand</span>
      </div>
      <div style="display:none;padding:14px 16px;background:var(--panel);">
        ${fields}
        <div style="font-size:10px;color:var(--muted);margin-top:6px;">These defaults pre-fill the Marketing tab when generating postcards for this trade. Click Save Settings to apply.</div>
      </div>
    </div>`;
  }).join('');

  if(!enabledTrades.length){
    container.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px;">No trades enabled. Enable trades in Settings → Pricing.</div>';
  }
}
