// BidDrop — RentCast property lookup, Solar API, equity badge
// Depends on: state.js (S, currentAccount), ui.js (toast, updateCreditBadge), credits.js (showBuyCreditsModal)

// ═══════════════════════════════
//  RENTCAST PROPERTY LOOKUP
// ═══════════════════════════════
function fmtMoney(v){ if(!v||isNaN(v)) return null; return '$'+Math.round(v).toLocaleString(); }
const _propDataCache = {}; // address -> data (null means not found)
const _propDataInFlight = {}; // address -> Promise (deduplicates concurrent requests)
const _rentcastFetched = new Set(); // pin IDs already fetched this session (prevents re-fetch on addMarker rebuild)
let _rentcastLoadQueue = 0; // stagger counter: delays auto-fetch by 200ms * position to prevent burst on page load
async function lookupPropertyData(address){
  if(!address) return null;
  const cacheKey = address.toLowerCase().trim();
  // Return cached result immediately (including null = not found)
  if(cacheKey in _propDataCache) return _propDataCache[cacheKey];
  // Deduplicate concurrent requests for the same address
  if(_propDataInFlight[cacheKey]) return _propDataInFlight[cacheKey];
  _propDataInFlight[cacheKey] = _lookupPropertyDataRaw(address).then(function(result){
    _propDataCache[cacheKey] = result;
    delete _propDataInFlight[cacheKey];
    return result;
  }).catch(function(e){
    delete _propDataInFlight[cacheKey];
    throw e;
  });
  return _propDataInFlight[cacheKey];
}
async function _lookupPropertyDataRaw(address){
  if(!address) return null;
  try{
    // Proxy through secure server-side API — RentCast key never exposed in browser
    const data = await adminAPI('rentcast', {}, { address });

    // Handle no-credits error (402)
    if(data && data.error === 'no_credits'){
      // Update local credit state
      if(data.free_used !== undefined) S.cfg.freeMailerCreditsUsed = data.free_used;
      if(data.paid_credits !== undefined) S.cfg.mailerCredits = data.paid_credits;
      updateCreditBadge();
      // Show buy credits modal
      showBuyCreditsModal();
      return null;
    }

    // Update local credit state from response
    if(data && data._credits){
      S.cfg.freeMailerCreditsUsed = data._credits.free_used;
      S.cfg.mailerCredits         = data._credits.paid_credits;
      updateCreditBadge();
    }

    // New format: { properties: [...], _credits: {...} }
    // Old format: [...] (array directly)
    // notFound = address not in RentCast DB (highway, service road) — silent, not an error
    if(data && data.notFound) return null;
    const arr = data && data.properties ? data.properties : (Array.isArray(data) ? data : null);
    const r = arr ? arr[0] : (data && !data.error ? data : null);
    if(!r) return null;
    const name = (r.owner && r.owner.names && r.owner.names[0]) || null;
    const estValue = r.estimatedValue || null;
    const mortgageBalance = (r.mortgage && r.mortgage.amount) ? r.mortgage.amount : null;
    const equity = (estValue && mortgageBalance) ? Math.max(0, estValue - mortgageBalance) : (estValue ? estValue : null);
    const yearBuilt = r.yearBuilt || null;
    const roofType = (r.features && r.features.roofType) || null;
    const bedrooms = r.bedrooms || null;
    const bathrooms = r.bathrooms || null;
    const squareFootage = r.squareFootage || null;
    const lastSaleDate = r.lastSaleDate ? r.lastSaleDate.substring(0,10) : null;
    const lastSalePrice = r.lastSalePrice || null;
    return { name, estValue, mortgageBalance, equity, yearBuilt, roofType, bedrooms, bathrooms, squareFootage, lastSaleDate, lastSalePrice };
  } catch(e){
    console.warn('RentCast lookup failed:', e);
    return null;
  }
}
// Backwards-compat alias
async function lookupOwnerName(address){ const d=await lookupPropertyData(address); return d?d.name:null; }
function showEquityBadge(data){
  const badge = document.getElementById('equity-badge');
  if(!badge) return;
  if(!data || (!data.estValue && !data.equity && !data.yearBuilt)) { badge.style.display='none'; return; }
  const valEl = document.getElementById('eq-value');
  const eqEl  = document.getElementById('eq-equity');
  const mortEl= document.getElementById('eq-mortgage');
  if(valEl)  valEl.textContent  = fmtMoney(data.estValue)      || '—';
  if(eqEl)   eqEl.textContent   = fmtMoney(data.equity)         || '—';
  if(mortEl) mortEl.textContent = fmtMoney(data.mortgageBalance) || '—';
  // Property details row
  const propRow = document.getElementById('eq-property-row');
  const yrEl    = document.getElementById('eq-year-built');
  if(propRow && yrEl){
    const parts = [];
    if(data.yearBuilt){
      const age = new Date().getFullYear() - data.yearBuilt;
      parts.push('🏠 Built ' + data.yearBuilt + ' &nbsp;·&nbsp; <span style="color:#F25C05;font-weight:700;">Est. ' + age + '-yr roof</span>');
    }
    if(data.roofType) parts.push('Roof: ' + data.roofType);
    if(data.bedrooms || data.bathrooms){
      const bd = data.bedrooms ? data.bedrooms + ' bd' : '';
      const ba = data.bathrooms ? data.bathrooms + ' ba' : '';
      parts.push([bd,ba].filter(Boolean).join(' / '));
    }
    if(data.lastSaleDate){
      const saleYear = data.lastSaleDate.substring(0,4);
      const salePart = data.lastSalePrice ? saleYear + ' · ' + fmtMoney(data.lastSalePrice) : saleYear;
      parts.push('Last sold: ' + salePart);
    }
    if(parts.length){
      yrEl.innerHTML = parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;');
      propRow.style.display = 'block';
    } else {
      propRow.style.display = 'none';
    }
  }
  badge.style.display = 'block';
}
function hideEquityBadge(){
  const badge = document.getElementById('equity-badge');
  if(badge) badge.style.display='none';
}

// ═══════════════════════════════
//  GOOGLE SOLAR API — Roof Measurement
// ═══════════════════════════════
window._solarData = null; // last fetched solar data for current pin

function showSolarBanner(data){
  const banner = document.getElementById('solar-roof-banner');
  if(!banner) return;
  if(!data || data.status !== 'ok' || !data.sqft){ banner.style.display='none'; return; }
  window._solarData = data;

  // ── Roof measurements ──
  const sqftEl   = document.getElementById('solar-sqft');
  const sqEl     = document.getElementById('solar-squares');
  const pitchEl  = document.getElementById('solar-pitch');
  const shadingEl= document.getElementById('solar-shading');
  const dateEl   = document.getElementById('solar-imagery-date');
  if(sqftEl)  sqftEl.textContent  = data.sqft.toLocaleString();
  if(sqEl)    sqEl.textContent    = data.squares + ' sq';
  if(pitchEl) pitchEl.textContent = data.pitchLabel;
  if(shadingEl && data.roofShadingLabel){
    shadingEl.textContent  = data.roofShadingLabel;
    shadingEl.style.color  = data.roofShadingColor || '#22C55E';
  }
  if(dateEl && data.imageryDate){
    const d = data.imageryDate;
    dateEl.textContent = 'Imagery: ' + (d.month||'') + '/' + (d.year||'');
  } else if(dateEl) dateEl.textContent = '';

  // ── Solar potential row ──
  const potRow = document.getElementById('solar-potential-row');
  if(potRow && data.systemKw){
    potRow.style.display = 'block';
    const kwEl     = document.getElementById('solar-system-kw');
    const panelsEl = document.getElementById('solar-max-panels');
    const panelWEl = document.getElementById('solar-panel-w');
    const kwhEl    = document.getElementById('solar-annual-kwh');
    const sunEl    = document.getElementById('solar-peak-sun');
    if(kwEl)     kwEl.textContent     = data.systemKw + ' kW';
    if(panelsEl) panelsEl.textContent = data.maxPanels ? data.maxPanels.toLocaleString() : '—';
    if(panelWEl) panelWEl.textContent = data.panelCapacityW ? data.panelCapacityW + ' W each' : '— W each';
    if(kwhEl)    kwhEl.textContent    = data.annualEnergyAcKwh ? data.annualEnergyAcKwh.toLocaleString() : '—';
    if(sunEl)    sunEl.textContent    = data.peakSunHoursPerDay ? data.peakSunHoursPerDay : '—';

    // Carbon offset
    const carbonRow = document.getElementById('solar-carbon-row');
    if(carbonRow && data.carbonOffsetKgPerYear){
      carbonRow.style.display = 'flex';
      const kgEl    = document.getElementById('solar-carbon-kg');
      const treesEl = document.getElementById('solar-trees');
      if(kgEl)    kgEl.textContent    = data.carbonOffsetKgPerYear.toLocaleString();
      if(treesEl) treesEl.textContent = data.treesEquivalent ? data.treesEquivalent.toLocaleString() : '—';
    }

    // Auto-fill kW button
    const autoBtn   = document.getElementById('solar-autofill-kw-btn');
    const autoLabel = document.getElementById('solar-autofill-kw-label');
    if(autoBtn && data.systemKw){
      autoBtn.style.display = 'inline-flex';
      if(autoLabel) autoLabel.textContent = data.systemKw;
    }
  }

  // ── Segment shading breakdown ──
  const segsWrap = document.getElementById('solar-segments-wrap');
  const segsList = document.getElementById('solar-segments-list');
  if(segsWrap && segsList && data.segments && data.segments.length > 0){
    segsWrap.style.display = 'block';
    segsList.innerHTML = data.segments.map((seg, i) => {
      const dir = azimuthToDir(seg.azimuthDeg);
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:9px;color:#A8BECE;">' +
        '<span style="min-width:60px;">Seg '+(i+1)+' ('+dir+')</span>' +
        '<span style="min-width:50px;">'+seg.sqft.toLocaleString()+' sqft</span>' +
        '<span style="min-width:40px;">'+seg.pitchLabel+'</span>' +
        '<span style="min-width:50px;">'+seg.sunshineHoursPerYear.toLocaleString()+' hrs/yr</span>' +
        '<span style="color:'+seg.shadingColor+';font-weight:700;min-width:55px;">'+seg.shadingLabel+' ('+seg.shadingPct+'%)</span>' +
        '</div>';
    }).join('');
  }

  banner.style.display = 'block';
}

function azimuthToDir(deg){
  if(deg === null || deg === undefined) return '—';
  const dirs = ['N','NE','E','SE','S','SW','W','NW','N'];
  return dirs[Math.round(((deg % 360) + 360) % 360 / 45)];
}

function applySolarKwToAddon(){
  const data = window._solarData;
  if(!data || !data.systemKw) return;
  // Show and check the solar add-on
  const solarRow = document.getElementById('solar-addon-row');
  if(solarRow) solarRow.style.display = 'block';
  const solarChk = document.getElementById('a-solar');
  if(solarChk){ solarChk.checked = true; toggleSolarInputs(); }
  // Fill in the kW
  const kwInput = document.getElementById('a-solar-kw');
  if(kwInput){ kwInput.value = data.systemKw; onSolarKwInput(); }
  calcP(); updatePreview(); scheduleDraftSave();
  toast('☀️ Solar Add-On added — ' + data.systemKw + ' kW system (' + data.maxPanels + ' panels)', 'success');
}

function hideSolarBanner(){
  const banner = document.getElementById('solar-roof-banner');
  if(banner) banner.style.display='none';
  window._solarData = null;
}

function applySolarToEstimate(){
  const data = window._solarData;
  if(!data || data.status !== 'ok') return;
  // Apply sqft and pitch to the first (Main House) structure
  if(!structures.length) addStructure(0,'Main House',null);
  const s = structures[0];
  s.sqft = data.sqft;
  s.pitch = String(data.pitchMultiplier);
  s.solarFilled = true;
  renderStructures();
  calcP();
  updatePreview();
  // Show solar add-on row if solar potential data available
  if(data.systemKw){
    const solarRow = document.getElementById('solar-addon-row');
    if(solarRow) solarRow.style.display = 'block';
  }
  toast('🛰 Satellite measurement applied — ' + data.sqft.toLocaleString() + ' sq ft, ' + data.pitchLabel + ' pitch' + (data.systemKw ? ' · ☀️ ' + data.systemKw + ' kW solar potential' : ''), 'success');
}

function s_clearSolarFilled(sid){
  const s = structures.find(x=>x.id===sid);
  if(s){ s.solarFilled = false; renderStructures(); }
}

async function fetchSolarData(lat, lng){
  try{
    const res = await fetch('/api/solar?lat='+lat+'&lng='+lng);
    if(!res.ok) return null;
    const data = await res.json();
    return data;
  } catch(e){
    console.warn('Solar API fetch failed:', e);
    return null;
  }
}

async function manualRentcastLookup(){
  const btn = document.getElementById('rc-lookup-btn');
  const addrEl = document.getElementById('e-addr');
  const address = (addrEl && addrEl.value.trim()) || (currentEstPinId && ((S.pins||[]).find(p=>p.id===currentEstPinId)||{}).address) || '';
  if(!address){ toast('Enter a property address first','error'); return; }
  if(btn){ btn.textContent='⏳ Looking up...'; btn.disabled=true; }
  try{
    const data = await lookupPropertyData(address);
    if(!data){ toast('No property record found — try a different address format','error'); return; }
    const ownerEl = document.getElementById('e-owner');
    if(data.name && ownerEl){
      ownerEl.value = data.name;
      updatePreview(); scheduleDraftSave();
      // Persist to pin
      if(currentEstPinId){
        const _pin = (S.pins||[]).find(p=>p.id===currentEstPinId);
        if(_pin && _pin.estimate){
          _pin.estimate.owner = data.name;
          if(sb) sb.from('pins').update({ estimate: _pin.estimate }).eq('id', currentEstPinId).then(()=>{});
        }
      }
    }
    showEquityBadge(data);
    if(currentEstPinId){
      const pin = S.pins.find(p=>p.id===currentEstPinId);
      if(pin){
        pin.equityData = { estValue: data.estValue, mortgageBalance: data.mortgageBalance, equity: data.equity, yearBuilt: data.yearBuilt, roofType: data.roofType, bedrooms: data.bedrooms, bathrooms: data.bathrooms, lastSaleDate: data.lastSaleDate, lastSalePrice: data.lastSalePrice };
        _rentcastFetched.add(currentEstPinId);
        if(sb) sb.from('pins').update({ equity_data: pin.equityData }).eq('id', currentEstPinId)
          .then(function({error}){ if(error && error.code !== 'PGRST204') console.warn('equityData persist (manual):', error); });
      }
    }
    toast('🏠 '+(data.name ? 'Owner: '+data.name : 'Property found — owner name unavailable, enter manually'),'success');
  } catch(e){
    toast('Lookup failed: '+e.message,'error');
  } finally{
    if(btn){ btn.textContent='🏠 Look Up'; btn.disabled=false; }
  }
}
async function autoFillOwnerIfEmpty(address){
  const ownerEl = document.getElementById('e-owner');
  const needsName = ownerEl && !ownerEl.value.trim();
  const data = await lookupPropertyData(address);
  if(!data) return;
  if(needsName && data.name && ownerEl && !ownerEl.value.trim()){
    ownerEl.value = data.name;
    updatePreview();
    toast('🏠 Owner: '+data.name,'info');
    // Fix D: persist the auto-filled name to the pin so it survives page reload
    if(currentEstPinId){
      const _pin = (S.pins||[]).find(p=>p.id===currentEstPinId);
      if(_pin && _pin.estimate){
        _pin.estimate.owner = data.name;
        sb.from('pins').update({ estimate: _pin.estimate }).eq('id', currentEstPinId)
          .then(({error})=>{ if(error) console.warn('Owner persist:', error); });
      }
    }
  }
  showEquityBadge(data);
  // Store equity data on current pin for popup display + persist to Supabase
  if(currentEstPinId){
    const pin = S.pins.find(p=>p.id===currentEstPinId);
    if(pin){
      pin.equityData = { estValue: data.estValue, mortgageBalance: data.mortgageBalance, equity: data.equity, yearBuilt: data.yearBuilt, roofType: data.roofType, bedrooms: data.bedrooms, bathrooms: data.bathrooms, lastSaleDate: data.lastSaleDate, lastSalePrice: data.lastSalePrice };
      _rentcastFetched.add(currentEstPinId);
      if(sb) sb.from('pins').update({ equity_data: pin.equityData }).eq('id', currentEstPinId)
        .then(function({error}){ if(error && error.code !== 'PGRST204') console.warn('equityData persist (autofill):', error); });
      // Refresh the map marker popup to show equity
      if(markers[currentEstPinId]) addMarker(pin);
    }
  }
}

// ═══════════════════════════════
//  SATELLITE MEASUREMENT BUTTON — Estimate Form
// ═══════════════════════════════
// Called by the "🛰 Measure" button next to the Property Address field on the Estimate tab.
// 1. Forward-geocodes the address via Mapbox
// 2. Calls the Solar API for roof measurements
// 3. Auto-applies sqft + pitch to the first structure (same as applySolarToEstimate)
async function fetchSatelliteMeasurementForEstimate(){
  const addrEl = document.getElementById('e-addr');
  const btn = document.getElementById('est-satellite-btn');
  const address = (addrEl && addrEl.value.trim()) || '';
  if(!address){ toast('Enter a property address first','error'); return; }
  if(btn){ btn.textContent='⏳ Fetching...'; btn.disabled=true; }
  try{
    // Step 1: Forward geocode the address to get lat/lng
    const MB = typeof window._MB !== 'undefined' ? window._MB : (window.MB || '');
    const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(address)+'.json?country=us&types=address&limit=1&access_token='+MB);
    const geoData = await geoRes.json();
    const feature = geoData && geoData.features && geoData.features[0];
    if(!feature){ toast('Address not found — try a more specific address','error'); return; }
    const [lng, lat] = feature.center;
    // Step 2: Fetch solar/roof measurement data
    const data = await fetchSolarData(lat, lng);
    if(!data || data.status !== 'ok' || !data.sqft){
      toast('No satellite measurement available for this address','error');
      return;
    }
    // Step 3: Apply to estimate (same as applySolarToEstimate)
    window._solarData = data;
    if(typeof structures !== 'undefined'){
      if(!structures.length && typeof addStructure === 'function') addStructure(0,'Main House',null);
      if(structures.length){
        const s = structures[0];
        s.sqft = data.sqft;
        s.pitch = String(data.pitchMultiplier);
        s.solarFilled = true;
        if(typeof renderStructures === 'function') renderStructures();
        if(typeof calcP === 'function') calcP();
        if(typeof updatePreview === 'function') updatePreview();
      }
    }
    // Show the solar banner in the estimator sidebar
    showSolarBanner(data);
    // Show solar add-on row if solar potential data available
    if(data.systemKw){
      const solarRow = document.getElementById('solar-addon-row');
      if(solarRow) solarRow.style.display = 'block';
      // Store solar kW on the current pin for the map overlay
      if(currentEstPinId && typeof storeSolarKwOnPin === 'function'){
        const _potentialLabel = data.systemKw >= 10 ? 'High Potential' : data.systemKw >= 5 ? 'Medium Potential' : 'Low Potential';
        storeSolarKwOnPin(currentEstPinId, data.systemKw, _potentialLabel);
      }
    }
    toast('🛰 Satellite measurement applied — ' + data.sqft.toLocaleString() + ' sq ft, ' + data.pitchLabel + ' pitch' + (data.systemKw ? ' · ☀️ ' + data.systemKw + ' kW solar potential' : ''), 'success');
  } catch(e){
    console.error('Satellite measurement error:', e);
    toast('Satellite measurement failed: '+(e.message||e),'error');
  } finally{
    if(btn){ btn.textContent='🛰 Measure'; btn.disabled=false; }
  }
}
