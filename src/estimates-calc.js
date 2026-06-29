// src/estimates-calc.js
// Pricing engine — calculates structure prices, material costs, solar, polygon sq ft.
// Depends on: S.cfg (state.js), structures (global array in index.html)
// Extracted from index.html — Tier 2 modularization
// NOTE: calcP() also touches DOM elements (e-total, e-breakdown, sp-*) — keep in sync
//       with the estimates UI in index.html.

function calcPolygonSqFt(pts){
  if(pts.length<3)return 0;
  const toM=ll=>{
    const R=6371000;
    return{x:R*ll.lng*(Math.PI/180)*Math.cos(ll.lat*Math.PI/180),y:R*ll.lat*(Math.PI/180)};
  };
  const mp=pts.map(toM);let area=0;
  for(let i=0;i<mp.length;i++){
    const j=(i+1)%mp.length;
    area+=mp[i].x*mp[j].y;area-=mp[j].x*mp[i].y;
  }
  return Math.round(Math.abs(area)/2*10.7639);
}

function calcStructPrice(s){
  const c=S.cfg;
  const sqft=parseFloat(s.sqft)||0;if(!sqft)return 0;
  const pitchMult=parseFloat(s.pitch)||1.118; // default 6/12
  const complexity=parseFloat(s.complexity)||1.12;
  const stories=parseFloat(s.stories)||1;
  const sq=sqft/100*1.10*pitchMult; // footprint → actual roof squares w/ 10% waste
  // ── Simple mode: price per square (per-material rates) ──
  if((c.pricingMode||'detailed')==='per_square'){
    const ppsMap={'1.3':parseFloat(c.ppsArchitectural)||450,'1.8':parseFloat(c.ppsDesigner)||580,'1.5':parseFloat(c.ppsImpact)||520,'2.5':parseFloat(c.ppsMetal)||950,'0.9':parseFloat(c.ppsFlat)||400,'3.2':parseFloat(c.ppsTile)||1400};
    const pps=ppsMap[String(s.mat)]||(parseFloat(c.pricePerSquare)||450);
    const stMult=stories<=1?1:stories<=1.5?1.08:stories<=2?1.16:1.25;
    return Math.round(sq*pps*stMult*complexity);
  }
  // ── Detailed mode ──
  const stMult=stories<=1?1:stories<=1.5?1.08:stories<=2?1.16:1.25;
  const matCost=getMatCost(s.mat);
  const tearoff=(parseFloat(c.costTearoff)||75)*sq;
  const felts=(parseFloat(c.costFelts)||22)*sq;
  const dumpster=(parseFloat(c.costDumpster)||450);
  const labor=matCost*sq*stMult*complexity;
  const sub=labor+tearoff+felts+dumpster;
  const ovh=sub*(parseFloat(c.overhead)||15)/100;
  const mgn=(sub+ovh)*(parseFloat(c.margin)||20)/100;
  return Math.round(sub+ovh+mgn);
}

function getMatCost(matKey){
  const c=S.cfg;
  return{'1.0':parseFloat(c.cost3Tab)||220,'1.3':parseFloat(c.costArchitectural)||300,'1.8':parseFloat(c.costDesigner)||420,'1.5':parseFloat(c.costImpact)||380,'2.5':parseFloat(c.costMetal)||680,'0.9':parseFloat(c.costFlat)||320,'3.2':parseFloat(c.costTile)||950}[matKey]||300;
}

function getSolarPrice(){
  const solarCk = document.getElementById('a-solar');
  if(!solarCk || !solarCk.checked) return 0;
  const flatEl = document.getElementById('a-solar-flat');
  const kwEl   = document.getElementById('a-solar-kw');
  const flat   = parseFloat((flatEl&&flatEl.value)||0);
  if(flat > 0) return flat;
  const kw     = parseFloat((kwEl&&kwEl.value)||0);
  const ppw    = parseFloat(S.cfg.costSolarPerWatt)||3.50;
  return kw > 0 ? Math.round(kw * 1000 * ppw) : 0;
}

function toggleSolarInputs(){
  const ck = document.getElementById('a-solar');
  const inp = document.getElementById('solar-inputs');
  if(!inp) return;
  inp.style.display = (ck && ck.checked) ? 'flex' : 'none';
}

function onSolarKwInput(){
  // When kW is entered, clear flat price and show calculated amount
  const kwEl = document.getElementById('a-solar-kw');
  const flatEl = document.getElementById('a-solar-flat');
  const dispEl = document.getElementById('solar-calc-display');
  if(flatEl && parseFloat(kwEl&&kwEl.value||0) > 0) flatEl.value = '';
  const price = getSolarPrice();
  if(dispEl) dispEl.textContent = price > 0 ? '$'+price.toLocaleString() : '';
}

function onSolarFlatInput(){
  // When flat price is entered, clear kW and hide calculated
  const kwEl = document.getElementById('a-solar-kw');
  const dispEl = document.getElementById('solar-calc-display');
  if(kwEl) kwEl.value = '';
  if(dispEl) dispEl.textContent = '';
}

function calcP(){
  if(!structures.length){
    document.getElementById('e-total').textContent='$0';
    document.getElementById('e-breakdown').textContent='Add a structure above to calculate';
    return 0;
  }
  let grand=structures.reduce((sum,s)=>sum+calcStructPrice(s),0);
  const c=S.cfg;
  if(document.getElementById('a-sky')&&document.getElementById('a-sky').checked)
    grand+=(parseFloat(c.costSkylight)||375)*(parseInt(document.getElementById('a-sky-q').value)||1);
  if(document.getElementById('a-chim')&&document.getElementById('a-chim').checked)
    grand+=(parseFloat(c.costChimney)||295);
  if(document.getElementById('a-gut')&&document.getElementById('a-gut').checked)
    grand+=(parseFloat(c.costGutter)||9)*(parseInt(document.getElementById('a-gut-q').value)||120);
  if(document.getElementById('a-iws')&&document.getElementById('a-iws').checked)
    grand+=(parseFloat(c.costIceWater)||42)*structures.reduce(function(sum,s){var sqft=parseFloat(s.sqft)||0;var pitchMult=parseFloat(s.pitch)||1.118;return sum+(sqft/100*1.10*pitchMult);},0);
  grand+=getSolarPrice();
  // Show override price in the display if active
  const overrideVal = window._priceOverrideOn ? (parseFloat((document.getElementById('e-price-override')||{}).value)||0) : 0;
  const displayTotal = (window._priceOverrideOn && overrideVal > 0) ? overrideVal : grand;
  const lbl = document.getElementById('price-box-lbl');
  if(lbl) lbl.textContent = (window._priceOverrideOn && overrideVal > 0) ? '⚡ Override Price (Homeowner Sees This)' : 'Estimated Total';
  // If non-roofing trade is active, show that trade's total instead
  const _calcActiveTr = window._activeTrade;
  const _calcIsNonRoof = _calcActiveTr && _calcActiveTr !== 'roofing';
  const _calcTradeTotal = _calcIsNonRoof ? (window._currentTradeTotal || 0) : 0;
  const _calcBundleItems = window._tradeBundle || [];
  const _calcBundleTotal = _calcBundleItems.reduce((s,b)=>s+b.total,0);
  const _calcAlreadyInBundle = _calcBundleItems.some(b=>b.trade===_calcActiveTr);
  const _calcFinalTotal = _calcIsNonRoof
    ? (_calcBundleTotal > 0
        ? (_calcBundleTotal + (!_calcAlreadyInBundle && _calcTradeTotal > 0 ? _calcTradeTotal : 0))
        : _calcTradeTotal)
    : displayTotal;
  const _calcDisplayFinal = (window._priceOverrideOn && overrideVal > 0) ? overrideVal : (_calcFinalTotal || displayTotal);
  document.getElementById('e-total').textContent='$'+_calcDisplayFinal.toLocaleString();
  document.getElementById('e-breakdown').textContent=_calcIsNonRoof
    ? (_calcActiveTr.charAt(0).toUpperCase()+_calcActiveTr.slice(1)+' estimate · $'+_calcDisplayFinal.toLocaleString())
    : (structures.length+' structure'+(structures.length>1?'s':'')+' · Calc: $'+grand.toLocaleString()+(window._priceOverrideOn&&overrideVal>0?' · Override: $'+overrideVal.toLocaleString():''));
  structures.forEach(s=>{
    const el=document.getElementById('sp-'+s.id);
    if(el)el.textContent='$'+calcStructPrice(s).toLocaleString();
  });
  if(typeof scheduleDraftSave==='function') scheduleDraftSave();
  // Refresh insurance scope totals whenever estimate changes
  if(typeof calcInsuranceTotals==='function') calcInsuranceTotals();
  // Update accordion trade summary
  if(typeof _accOnTotalUpdated==='function') _accOnTotalUpdated('$'+_calcDisplayFinal.toLocaleString());
  return grand;
}

