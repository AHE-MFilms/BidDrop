// BidDrop — Map search, roof measurement, pin management, structures
// Extracted from index.html inline block

//  MAP SEARCH
// ═══════════════════════════════
let searchTimer=null;
// Store search results for safe onclick reference
window._srResults = [];

function onSearchInput(){
  clearTimeout(searchTimer);
  const q=document.getElementById('map-search-inp').value.trim();
  if(q.length<3){document.getElementById('map-search-results').classList.remove('show');return;}
  searchTimer=setTimeout(()=>searchAddress(true),400);
}

async function searchAddress(suggest=false){
  const q=document.getElementById('map-search-inp').value.trim();
  if(!q)return;
  try{
    const MB=window._mapboxToken||'';
    const res=await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(q)+'.json?country=us&types=address,place&limit=5&access_token='+MB);
    const data=await res.json();
    const results=(data.features||[]);
    if(!results.length){if(!suggest)toast('Address not found','error');return;}
    if(suggest){
      window._srResults=results;
      const el=document.getElementById('map-search-results');
      el.innerHTML=results.map((r,i)=>'<div class="msr-item" onclick="flyToResultIdx('+i+')">'+escHtml(r.place_name)+'</div>').join('');
      el.classList.add('show');
    } else {
      const c=results[0].center; // [lng, lat]
      flyToResult(c[1],c[0],results[0].place_name);
    }
  }catch(e){toast('Search error','error');}
}
function flyToResultIdx(i){
  const r=window._srResults[i];
  if(!r)return;
  const c=r.center; // [lng, lat]
  flyToResult(c[1],c[0],r.place_name);
}
function flyToResult(lat,lon,name){
  document.getElementById('map-search-results').classList.remove('show');
  document.getElementById('map-search-inp').value=(name||'').split(',').slice(0,2).join(',').trim();
  map.flyTo([parseFloat(lat),parseFloat(lon)],19,{duration:.8});
}
function openEstimatePage(eid){
  const slug=(S.cfg&&S.cfg.companyName?S.cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'roofing');
  window.open('https://biddrop.us/'+slug+'/'+encodeURIComponent(eid),'_blank','noopener,noreferrer');
}
// ── PHOTO ACTION SHEET (camera vs gallery) ──────────────────────────────────
// Usage: showPhotoActionSheet(callbackFn, {multiple: false})
// callbackFn receives a FileList-like array of File objects
let _photoSheetCallback = null;
let _photoSheetMultiple = false;
function showPhotoActionSheet(callback, opts){
  _photoSheetCallback = callback;
  _photoSheetMultiple = !!(opts && opts.multiple);
  const existing = document.getElementById('photo-action-sheet');
  if(existing) existing.remove();
  const sheet = document.createElement('div');
  sheet.id = 'photo-action-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;justify-content:flex-end;';
  sheet.innerHTML = `
    <div id="photo-sheet-backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.55);" onclick="_closePhotoSheet()"></div>
    <div style="position:relative;background:var(--card,#1a1a2e);border-radius:18px 18px 0 0;padding:20px 16px 32px;z-index:1;">
      <div style="width:36px;height:4px;background:var(--border,#333);border-radius:2px;margin:0 auto 18px;"></div>
      <div style="font-family:var(--font-h,sans-serif);font-size:13px;font-weight:700;letter-spacing:.5px;color:var(--muted,#888);text-align:center;margin-bottom:16px;">ADD PHOTO</div>
      <button onclick="_photoSheetCamera()" style="width:100%;background:var(--accent,#e85d04);border:none;border-radius:10px;padding:15px;color:#fff;font-family:var(--font-h,sans-serif);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px;">📷 Take Photo</button>
      <button onclick="_photoSheetGallery()" style="width:100%;background:var(--card2,#252540);border:1px solid var(--border,#333);border-radius:10px;padding:15px;color:var(--text,#fff);font-family:var(--font-h,sans-serif);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px;">🖼️ Choose from Gallery</button>
      <button onclick="_closePhotoSheet()" style="width:100%;background:none;border:none;border-radius:10px;padding:12px;color:var(--muted,#888);font-size:13px;cursor:pointer;">Cancel</button>
    </div>
    <input type="file" id="_photo-sheet-camera-inp" accept="image/*" capture="environment" style="display:none;" onchange="_photoSheetHandleInput(this)">
    <input type="file" id="_photo-sheet-gallery-inp" accept="image/*" style="display:none;" onchange="_photoSheetHandleInput(this)">
  `;
  document.body.appendChild(sheet);
  // Set multiple attribute dynamically
  sheet.querySelector('#_photo-sheet-camera-inp').multiple = _photoSheetMultiple;
  sheet.querySelector('#_photo-sheet-gallery-inp').multiple = _photoSheetMultiple;
}
function _closePhotoSheet(){
  const s = document.getElementById('photo-action-sheet');
  if(s) s.remove();
}
function _photoSheetCamera(){
  _closePhotoSheet();
  // Re-create inputs outside the removed sheet
  let inp = document.getElementById('_psa-camera');
  if(!inp){ inp=document.createElement('input'); inp.type='file'; inp.id='_psa-camera'; inp.accept='image/*'; inp.setAttribute('capture','environment'); inp.style.display='none'; inp.onchange=e=>_photoSheetHandleInput(e.target); document.body.appendChild(inp); }
  inp.multiple = _photoSheetMultiple;
  inp.value='';
  inp.click();
}
function _photoSheetGallery(){
  _closePhotoSheet();
  let inp = document.getElementById('_psa-gallery');
  if(!inp){ inp=document.createElement('input'); inp.type='file'; inp.id='_psa-gallery'; inp.accept='image/*'; inp.style.display='none'; inp.onchange=e=>_photoSheetHandleInput(e.target); document.body.appendChild(inp); }
  inp.multiple = _photoSheetMultiple;
  inp.value='';
  inp.click();
}
function _photoSheetHandleInput(inp){
  if(!inp.files || !inp.files.length || !_photoSheetCallback) return;
  const cb = _photoSheetCallback;
  _photoSheetCallback = null;
  cb(inp.files);
}
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escJs(s){return(s||'').replace(/\\/g,'\\\\').replace(/'/g,'\\x27').replace(/"/g,'\\x22');}
function formatPhone(raw){
  const d=(raw||'').replace(/\D/g,'');
  if(!d) return raw||'';
  // Handle leading country code 1
  const n=d.length>10&&d[0]==='1'?d.slice(1):d;
  if(n.length<=3) return '('+n;
  if(n.length<=6) return '('+n.slice(0,3)+') '+n.slice(3);
  return '('+n.slice(0,3)+') '+n.slice(3,6)+'-'+n.slice(6,10);
}
function autoFormatPhone(el){
  const pos=el.selectionStart;
  const prev=el.value;
  const formatted=formatPhone(prev);
  el.value=formatted;
  // Restore cursor approximately
  try{el.setSelectionRange(Math.min(pos,formatted.length),Math.min(pos,formatted.length));}catch(e){}
}

document.addEventListener('click',e=>{
  if(!e.target.closest('#map-search-wrap'))
    document.getElementById('map-search-results')&&document.getElementById('map-search-results').classList.remove('show');
});

// ═══════════════════════════════
//  MAP
// ═══════════════════════════════
let tileStreet,tileSatellite,tileLabels,isSatellite=false;



// ═══════════════════════════════
//  ROOF MEASUREMENT
// ═══════════════════════════════
let measuring=false,measurePts=[],measurePoly=null,measureMarkers=[];
let allPolygons=[],allPolygonPts=[],totalSqFt=0;
let _measureForPinId=null;
let _targetStructId=null; // when measuring for a specific structure card
let _lastMeasurePts=null;  // saved polygon points from most recent finalized polygon

function toggleMeasure(){
  measuring=!measuring;
  const btn=document.getElementById('btn-measure');
  const hud=document.getElementById('measure-hud');
  if(measuring){
    btn.classList.add('active');btn.textContent='✕ Cancel Measure';
    hud.classList.add('show');
    document.getElementById('the-map').classList.add('measuring');
    map.closePopup();
    if(!isSatellite)toggleSatellite();
    if(map.getZoom()<17)map.setZoom(18);
    document.getElementById('map-panel').classList.remove('open');
    clearMeasureData();
    // Pre-set pitch from solar data if available for the current pin
    const solarForMeasure = window._solarData || (window._currentPopupMarker && window._currentPopupMarker._solarData);
    if(solarForMeasure && solarForMeasure.pitchMultiplier){
      const pitchSel=document.getElementById('mhud-pitch-sel');
      if(pitchSel) pitchSel.value=String(solarForMeasure.pitchMultiplier);
    }
    document.getElementById('mhud-hint').textContent='Click corners of the roof. Double-click to finish.';
  } else {
    btn.classList.remove('active');btn.textContent='📐 Measure Roof';
    hud.classList.remove('show');
    document.getElementById('the-map').classList.remove('measuring');
    _measureForPinId=null;
    _targetStructId=null;
    window._addingToExisting=false;
    window._baseSqft=0;
    clearMeasureData();
  }
}

// Helper: update the Actual Roof Area and Squares display based on current footprint + pitch
function updateMeasureActual(footprintSqft){
  const sel=document.getElementById('mhud-pitch-sel');
  const mult=sel?parseFloat(sel.value)||1.118:1.118;
  const actual=Math.round(footprintSqft*mult);
  const squares=Math.round(footprintSqft*mult/100*10)/10;
  const actualEl=document.getElementById('mhud-actual-sqft');
  const sqEl=document.getElementById('mhud-squares');
  if(actualEl)actualEl.textContent=actual>0?actual.toLocaleString():'0';
  if(sqEl)sqEl.textContent=squares>0?squares.toFixed(1)+' sq':'0 sq';
}
// Called when pitch dropdown changes
function updateMeasurePitch(){
  const footprint=parseInt((document.getElementById('mhud-sqft').textContent||'0').replace(/,/g,''))||0;
  updateMeasureActual(footprint);
}
function clearMeasureData(){
  measurePts=[];
  measureMarkers.forEach(m=>map.removeLayer(m));measureMarkers=[];
  if(measurePoly){map.removeLayer(measurePoly);measurePoly=null;}
  allPolygons.forEach(p=>map.removeLayer(p));
  allPolygons=[];allPolygonPts=[];totalSqFt=0;
  document.getElementById('mhud-sqft').textContent='0';
  updateMeasureActual(0);
  document.getElementById('mhud-bldg-count').textContent='';
  const ub=document.getElementById('btn-use-measure');
  if(ub){ub.style.opacity='.4';ub.style.pointerEvents='none';}
  const banner=document.getElementById('mhud-pin-banner');
  if(banner)banner.remove();
}

function clearMeasure(){
  clearMeasureData();
  document.getElementById('mhud-hint').textContent='Click corners of the roof. Double-click to finish.';
}

function addMeasurePoint(latlng){
  measurePts.push(latlng);
  const idx=measurePts.length-1;
  const dot=L.marker(latlng,{
    icon:L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#F25C05;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.6);cursor:grab;"></div>',iconSize:[14,14],iconAnchor:[7,7]}),
    draggable:true
  }).addTo(map);
  dot.on('drag',()=>{measurePts[idx]=dot.getLatLng();redrawPoly();});
  measureMarkers.push(dot);
  redrawPoly();
  if(measurePts.length>=3){
    const sqft=calcPolygonSqFt(measurePts);
    document.getElementById('mhud-sqft').textContent=sqft.toLocaleString();
    updateMeasureActual(sqft);
    const bldgNum=allPolygons.length+1;
    document.getElementById('mhud-hint').textContent='Bldg '+bldgNum+': '+measurePts.length+' pts — drag to adjust. Dbl-click to finish.';
    const ub=document.getElementById('btn-use-measure');
    if(ub){ub.style.opacity='1';ub.style.pointerEvents='auto';}
  } else {
    document.getElementById('mhud-hint').textContent=measurePts.length+' point'+(measurePts.length>1?'s':'')+' — keep clicking corners.';
  }
}

function redrawPoly(){
  if(measurePoly){map.removeLayer(measurePoly);measurePoly=null;}
  if(measurePts.length>=2){
    measurePoly=L.polygon(measurePts,{color:'#F25C05',fillColor:'#F25C05',fillOpacity:.2,weight:2,dashArray:'5,5'}).addTo(map);
    if(measurePts.length>=3){
      const thisSqft=calcPolygonSqFt(measurePts);
      document.getElementById('mhud-sqft').textContent=(totalSqFt+thisSqft).toLocaleString();
      updateMeasureActual(totalSqFt+thisSqft);
      if(allPolygons.length>0)
        document.getElementById('mhud-bldg-count').textContent=allPolygons.length+' done + this: '+thisSqft.toLocaleString()+' sq ft';
    }
  }
}

function undoMeasurePoint(){
  if(!measurePts.length){
    if(!allPolygons.length)return;
    const lastPoly=allPolygons.pop();
    const lastPts=allPolygonPts.pop();
    map.removeLayer(lastPoly);
    totalSqFt=Math.max(0,totalSqFt-calcPolygonSqFt(lastPts));
    document.getElementById('mhud-sqft').textContent=totalSqFt.toLocaleString();
    updateMeasureActual(totalSqFt);
    document.getElementById('mhud-bldg-count').textContent=allPolygons.length?allPolygons.length+' building'+(allPolygons.length>1?'s':''):'';
    if(!totalSqFt){const ub=document.getElementById('btn-use-measure');if(ub){ub.style.opacity='.4';ub.style.pointerEvents='none';}}
    toast('Last building removed','info');return;
  }
  measurePts.pop();
  const last=measureMarkers.pop();
  if(last)map.removeLayer(last);
  redrawPoly();
  if(!measurePts.length){
    document.getElementById('mhud-sqft').textContent=totalSqFt.toLocaleString()||'0';
    updateMeasureActual(totalSqFt||0);
    document.getElementById('mhud-hint').textContent=allPolygons.length?'✅ Add another building or tap Add to Estimate.':'Tap roof corners. Double-click to finish a building.';
  } else {
    document.getElementById('mhud-hint').textContent=measurePts.length+' pts — keep clicking corners.';
  }
}

function onMapClick(e){
  if(measuring){addMeasurePoint(e.latlng);return;}
  // Don't open pin modal if a popup is currently open (prevents popup button clicks from triggering a new pin)
  if(map._popup && map._popup.isOpen && map._popup.isOpen()) return;
  tempLL=e.latlng;
  document.getElementById('p-addr').value='';
  document.getElementById('p-notes').value='';
  document.getElementById('p-status').value='pinned';
  // Auto-fill rep name from logged in user
  const repInp = document.getElementById('p-rep');
  if(repInp && currentProfile) repInp.value = currentProfile.name || '';
  resetPinModal();
  openM('m-pin');
  // Disable Save and show loading until reverse geocode completes
  const saveBtn = document.querySelector('#m-pin .btn-ok');
  const addrInp = document.getElementById('p-addr');
  if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Locating...'; }
  if(addrInp){ addrInp.placeholder = 'Fetching address...'; }
  revGeo(e.latlng.lat, e.latlng.lng).then(()=>{
    if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Save Pin'; }
    if(addrInp){ addrInp.placeholder = ''; }
  });
}

function onMapDblClick(e){
  if(!measuring||measurePts.length<3)return;
  L.DomEvent.stop(e);
  measurePts.pop();
  if(measureMarkers.length)map.removeLayer(measureMarkers.pop());
  if(measurePoly)map.removeLayer(measurePoly);
  const colors=['#F25C05','#3B82F6','#22C55E','#F59E0B','#A855F7'];
  const col=colors[allPolygons.length%colors.length];
  const finishedPoly=L.polygon(measurePts,{color:col,fillColor:col,fillOpacity:.25,weight:2}).addTo(map);
  const center=finishedPoly.getBounds().getCenter();
  const num=allPolygons.length+1;
  L.marker(center,{icon:L.divIcon({className:'',html:'<div style="background:'+col+';color:white;font-family:sans-serif;font-size:13px;font-weight:700;padding:3px 8px;border-radius:12px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);">Bldg '+num+'</div>',iconAnchor:[28,12]})}).addTo(map);
  allPolygons.push(finishedPoly);
  allPolygonPts.push([...measurePts]);
  const thisSqft=calcPolygonSqFt(measurePts);
  totalSqFt+=thisSqft;
  // Save pts before clearing so any path can restore them
  _lastMeasurePts=measurePts.map(ll=>({lat:ll.lat,lng:ll.lng}));
  // Remove draggable vertex markers from map before clearing
  measureMarkers.forEach(m=>map.removeLayer(m));
  measurePts=[];measureMarkers=[];measurePoly=null;
  document.getElementById('mhud-sqft').textContent=totalSqFt.toLocaleString();
  updateMeasureActual(totalSqFt);
  document.getElementById('mhud-bldg-count').textContent=num+' building'+(num>1?'s':'')+' · Bldg '+num+': '+thisSqft.toLocaleString()+' sq ft';
  document.getElementById('mhud-hint').textContent='✅ Bldg '+num+' done! Tap corners to add another, or tap Add to Estimate.';
  const ub=document.getElementById('btn-use-measure');
  if(ub){ub.style.opacity='1';ub.style.pointerEvents='auto';}
}


function useRoofMeasurement(){
  if(measurePts.length>=3){
    const colors=['#F25C05','#3B82F6','#22C55E','#F59E0B','#A855F7'];
    const col=colors[allPolygons.length%colors.length];
    if(measurePoly)map.removeLayer(measurePoly);
    const fp=L.polygon(measurePts,{color:col,fillColor:col,fillOpacity:.25,weight:2}).addTo(map);
    allPolygons.push(fp);allPolygonPts.push([...measurePts]);
    totalSqFt+=calcPolygonSqFt(measurePts);
    _lastMeasurePts=measurePts.map(ll=>({lat:ll.lat,lng:ll.lng}));
    measureMarkers.forEach(m=>map.removeLayer(m));
    measurePts=[];measureMarkers=[];measurePoly=null;
  }
  const footprint=totalSqFt||parseInt(document.getElementById('mhud-sqft').textContent.replace(/,/g,''));
  if(!footprint){toast('Draw the roof outline first','error');return;}
  // Apply pitch multiplier so the estimate gets the actual sloped roof area
  const pitchSel=document.getElementById('mhud-pitch-sel');
  const pitchMult=pitchSel?parseFloat(pitchSel.value)||1.118:1.118;
  const sqft=Math.round(footprint*pitchMult);
  const pitchVal=pitchSel?pitchSel.value:'1.118';
  // Stop measuring
  measuring=false;
  document.getElementById('btn-measure').classList.remove('active');
  document.getElementById('btn-measure').textContent='📐 Measure Roof';
  document.getElementById('the-map').classList.remove('measuring');
  document.getElementById('measure-hud').classList.remove('show');
  // Snapshot _lastMeasurePts from allPolygonPts BEFORE clearing (dblclick path sets it already; this covers the button path)
  if(!_lastMeasurePts&&allPolygonPts.length>0){
    _lastMeasurePts=allPolygonPts[allPolygonPts.length-1].map(ll=>({lat:ll.lat,lng:ll.lng}));
  }
  measureMarkers.forEach(m=>map.removeLayer(m));
  measurePts=[];measureMarkers=[];measurePoly=null;
  allPolygons=[];allPolygonPts=[];totalSqFt=0;
  document.getElementById('mhud-sqft').textContent='0';
  document.getElementById('mhud-bldg-count').textContent='';
  const ub=document.getElementById('btn-use-measure');
  if(ub){ub.style.opacity='.4';ub.style.pointerEvents='none';}
  const banner=document.getElementById('mhud-pin-banner');
  if(banner)banner.remove();

  // Route 1: measuring for a specific existing structure card
  if(_targetStructId){
    const sid=_targetStructId;
    _targetStructId=null;
    const s=structures.find(x=>x.id===sid);
    if(s){
      s.sqft=sqft;
      s.pitch=pitchVal; // apply selected pitch from measure tool
      if(_lastMeasurePts)s.pts=_lastMeasurePts;
      _lastMeasurePts=null;
      goTab('estimate');
      renderStructures();calcP();updatePreview();
      toast('📐 '+sqft.toLocaleString()+' sq ft applied to '+escHtml(s.name)+'!','success');
      return;
    }
  }

  if(window._addingToExisting){
    window._addingToExisting=false;
    goTab('estimate');
    addStructure(sqft,'Structure '+(structures.length+1),_lastMeasurePts,pitchVal);
    _lastMeasurePts=null;
    toast('📐 '+sqft.toLocaleString()+' sq ft added as new structure!','success');
    return;
  }
  if(_measureForPinId){
    const pin=S.pins.find(p=>p.id===_measureForPinId);
    _measureForPinId=null;
    if(pin){
      window._editingQueueId=null;
      // Auto-select this pin in the estimator
      currentEstPinId = pin.id;
      document.getElementById('e-addr').value=pin.address||'';
      // Load saved owner/email if available
      const savedEst = (S.estimates||[]).find(e=>e.pinId===pin.id && !e.deletedAt && !e.isRevision);
      const legacyEst = pin.estimate ? (typeof pin.estimate==='string'?JSON.parse(pin.estimate):pin.estimate) : null;
      const est = savedEst || legacyEst;
      if(est){
        if(est.owner) document.getElementById('e-owner').value = est.owner;
        if(est.email) document.getElementById('e-email').value = est.email;
      }
      // ── Load photos (the fix: was missing before) ──
      _clearAllPhotos();
      if(est) _loadAllPhotosFromEst(est, pin);
      else _loadAllPhotosFromPin(pin);
      const frontPhoto = (window._allPhotos.front||[])[0] || pin.photo_url || pin.photo_data || null;
      if(frontPhoto){
        window._homePhotoData = frontPhoto;
        const prev=document.getElementById('home-photo-preview');
        if(prev) prev.innerHTML='<img src="'+frontPhoto+'" style="width:100%;height:100%;object-fit:cover;">';
        const clr=document.getElementById('clear-photo-btn');
        if(clr) clr.style.display='block';
      } else {
        window._homePhotoData = null;
        clearHomePhoto();
      }
      // Reset structures and apply measurement
      structures = [];
      addStructure(sqft,'Main House',_lastMeasurePts,pitchVal);
      _lastMeasurePts=null;
      goTab('estimate');
      // Update picker dropdown to show this pin
      const sel = document.getElementById('est-pin-picker');
      if(sel) sel.value = pin.id;
      calcP();updatePreview();
      toast('📐 '+sqft.toLocaleString()+' sq ft loaded for '+escHtml(pin.address.split(',')[0])+'!','success');
      // RentCast lookup is now MANUAL — rep must press the 🏠 Look Up button
      return;
    }
  }
  applyMeasureToEstimate(sqft);
}

function measureForStructure(sid){
  const s=structures.find(x=>x.id===sid);
  if(!s)return;
  _targetStructId=sid;
  _measureForPinId=null;
  window._addingToExisting=false;

  // Clear any in-progress measurement state
  allPolygons.forEach(p=>map.removeLayer(p));
  allPolygons=[];allPolygonPts=[];totalSqFt=0;
  measurePts=[];
  measureMarkers.forEach(m=>map.removeLayer(m));measureMarkers=[];
  if(measurePoly){map.removeLayer(measurePoly);measurePoly=null;}

  const hasSavedPts=s.pts&&s.pts.length>=3;

  goTab('map');
  setTimeout(()=>{
    // Enter measure mode (sets up click/dblclick handlers, satellite, etc.)
    if(!measuring)toggleMeasure();

    // If we have saved points, restore them as draggable vertices
    if(hasSavedPts){
      s.pts.forEach((pt,idx)=>{
        const latlng=L.latLng(pt.lat,pt.lng);
        measurePts.push(latlng);
        const dot=L.marker(latlng,{
          icon:L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#F25C05;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.6);cursor:grab;"></div>',iconSize:[14,14],iconAnchor:[7,7]}),
          draggable:true
        }).addTo(map);
        dot.on('drag',()=>{measurePts[idx]=dot.getLatLng();redrawPoly();});
        measureMarkers.push(dot);
      });
      redrawPoly();
      // Fit map to the polygon
      const bounds=L.latLngBounds(measurePts);
      map.fitBounds(bounds,{padding:[60,60],maxZoom:20});
      // Update HUD with current area
      const sqft=calcPolygonSqFt(measurePts);
      document.getElementById('mhud-sqft').textContent=sqft.toLocaleString();
      updateMeasureActual(sqft);
      const ub=document.getElementById('btn-use-measure');
      if(ub){ub.style.opacity='1';ub.style.pointerEvents='auto';}
      document.getElementById('mhud-hint').textContent='Drag any vertex to adjust. Double-click to finish & save.';
    } else {
      document.getElementById('mhud-hint').textContent='Tap corners of '+s.name+'. Double-click to finish.';
    }

     document.getElementById('btn-measure').textContent='✕ Cancel';
    const ub=document.getElementById('btn-use-measure');
    if(ub)ub.textContent='✅ Apply to '+s.name;
  },300);

  toast(hasSavedPts?'✏️ Drag vertices to adjust '+s.name:'📐 Draw the outline for '+s.name,'info');
}

function applyMeasureToEstimate(sqft){
  window._editingQueueId=null;
  goTab('estimate');
  const pitchSel2=document.getElementById('mhud-pitch-sel');
  const pitchVal2=pitchSel2?pitchSel2.value:'1.118';
  addStructure(sqft,'Main House',_lastMeasurePts,pitchVal2);
  _lastMeasurePts=null;
  toast('📐 '+sqft.toLocaleString()+' sq ft added!','success');
}

function measureForPin(pinId){
  const pin=S.pins.find(p=>p.id===pinId);
  if(!pin)return;
  _measureForPinId=pinId;
  map.closePopup();
  // Reset measure state
  allPolygons.forEach(p=>map.removeLayer(p));
  allPolygons=[];allPolygonPts=[];totalSqFt=0;
  measurePts=[];
  measureMarkers.forEach(m=>map.removeLayer(m));measureMarkers=[];
  if(measurePoly){map.removeLayer(measurePoly);measurePoly=null;}
  map.flyTo([pin.lat,pin.lng],19,{duration:.7});
  setTimeout(()=>{
    if(!measuring)toggleMeasure();
    const short=pin.address?pin.address.split(',')[0]:'this property';
    document.getElementById('mhud-hint').textContent='📍 '+short+' — tap each corner of the roof';
    document.getElementById('btn-measure').textContent='✕ Cancel';
  },800);
  toast('📐 Tap roof corners for '+(pin.address?pin.address.split(',')[0]:'selected pin'),'info');
}

async function revGeo(lat,lng){
  try{
    const MB=window._mapboxToken||'';
    const r=await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+lng+','+lat+'.json?types=address&access_token='+MB);
    const d=await r.json();
    if(d&&d.features&&d.features.length){
      // Use place_name but trim to street + city + state + zip for cleanliness
      const f=d.features[0];
      const addr=f.place_name||'';
      // Mapbox returns "123 Main St, City, State ZIP, Country" — strip country
      const parts=addr.split(',').map(s=>s.trim());
      const noCountry=parts.filter(p=>p!=='United States').join(', ');
      document.getElementById('p-addr').value=noCountry;
    }
  }catch(e){
    // If geocoding fails, leave field blank so user can type manually
    console.warn('revGeo failed:',e);
  }
  // Always resolves (even on error) so the Save button re-enables
}

function mkIcon(status){
  const c=sColor(status);
  return L.divIcon({className:'',html:'<div style="width:16px;height:16px;background:'+c+';border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.6);"></div>',iconSize:[16,16],iconAnchor:[8,8]});
}

function addMarker(pin){
  const pid=pin.id;
  // Remove existing marker for this pin before creating a new one
  if(markers[pid]){
    if(clusterGroup) clusterGroup.removeLayer(markers[pid]);
    else if(map) map.removeLayer(markers[pid]);
    delete markers[pid];
  }
  const m=L.marker([pin.lat,pin.lng],{icon:mkIcon(pin.status)});
  // Pre-compute popup photo HTML to avoid IIFE inside template literal
  const _dmgPhotos = pin.damage_photos||[];
  const _popupPhotos = _dmgPhotos.length
    ? '<div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;">' + _dmgPhotos.map(src=>'<img src="'+src+'" style="width:calc(33% - 3px);height:80px;object-fit:cover;border-radius:6px;display:block;" onerror="this.style.display=\'none\'">').join('') + '</div>'
    : pin.photo_url
      ? '<img src="'+pin.photo_url+'" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-bottom:10px;display:block;" onerror="this.style.display=\'none\'">'
      : '';
  const _popupNotes = pin.notes ? '<div style="font-size:13px;color:#A8BECE;margin-bottom:10px;font-style:italic;">"'+escHtml(pin.notes)+'"</div>' : '';
  // Equity snapshot for popup
  const _eq = pin.equityData;
  const _popupEquity = _eq && (_eq.estValue || _eq.equity || _eq.yearBuilt) ? `
    <div style="background:linear-gradient(135deg,#0f2027,#1a3a2a);border:1px solid #22C55E55;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.7px;color:#22C55E;margin-bottom:6px;">🏠 PROPERTY SNAPSHOT</div>
      <div style="display:flex;gap:8px;margin-bottom:${_eq.yearBuilt ? '8px' : '0'};">
        <div style="flex:1;"><div style="font-size:9px;color:#A8BECE;">Est. Value</div><div style="font-size:13px;font-weight:700;color:#FFF;">${fmtMoney(_eq.estValue)||'—'}</div></div>
        <div style="flex:1;"><div style="font-size:9px;color:#A8BECE;">Equity</div><div style="font-size:13px;font-weight:700;color:#22C55E;">${fmtMoney(_eq.equity)||'—'}</div></div>
        <div style="flex:1;"><div style="font-size:9px;color:#A8BECE;">Mortgage</div><div style="font-size:13px;font-weight:700;color:#F25C05;">${fmtMoney(_eq.mortgageBalance)||'—'}</div></div>
      </div>
      ${_eq.yearBuilt ? `<div style="font-size:11px;color:#A8BECE;border-top:1px solid rgba(34,197,94,.2);padding-top:6px;">🏠 Built ${_eq.yearBuilt} &nbsp;·&nbsp; <span style="color:#A8BECE;font-weight:600;">Home age: ~${new Date().getFullYear()-_eq.yearBuilt} yrs</span>${_eq.roofType ? ' &nbsp;·&nbsp; '+_eq.roofType : ''}</div>` : ''}
    </div>` : '';
  // Solar measurement row — shown only if cached data exists (fetched on-demand via estimator)
  const _solar = pin._solarCache || (pin.solarKw ? { status:'ok', sqft: null, squares: null, pitchLabel: null, systemKw: pin.solarKw } : null);
  const _solarContent = _solar && _solar.status==='ok' && _solar.sqft
    ? _solar.sqft.toLocaleString()+' sq ft &nbsp;&middot;&nbsp; <span style="color:#F25C05;font-weight:700;">'+_solar.squares+' sq</span> &nbsp;&middot;&nbsp; <span style="color:#22C55E;font-weight:700;">'+_solar.pitchLabel+' pitch</span>'
    : (pin.solarKw ? '<span style="color:#F59E0B;font-weight:700;">☀️ '+pin.solarKw+' kW solar potential</span>' : null);
  const _popupSolar = _solarContent ? `<div id="solar-row-${pid}" style="background:rgba(242,92,5,.1);border:1px solid rgba(242,92,5,.3);border-radius:7px;padding:7px 10px;margin-bottom:7px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.6px;color:#F25C05;margin-bottom:3px;">🛰 SATELLITE MEASUREMENT</div>
    <div id="solar-val-${pid}" style="font-size:12px;color:#fff;font-weight:600;">${_solarContent}</div>
  </div>` : '';
  // Build property snapshot row from cached equityData
  const _eq2 = pin.equityData;
  const _propSnap = _eq2 ? buildPropertySnapHTML(pid, _eq2) : `<div id="prop-snap-${pid}" style="background:linear-gradient(135deg,#0f2027,#1a3a2a);border:1px solid #22C55E33;border-radius:8px;padding:8px 10px;margin-bottom:7px;font-size:11px;color:#A8BECE;">🏠 <span id="prop-snap-val-${pid}">Loading property data…</span></div>`;

  m.bindPopup(`
    <div style="min-width:200px;max-width:240px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:5px;color:#FFFFFF;line-height:1.3;">${escHtml(pin.address||'Unknown')}</div>
      <div style="display:inline-block;background:${sColor(pin.status)};color:white;font-size:11px;padding:2px 8px;border-radius:5px;font-weight:700;margin-bottom:8px;">${sLabel(pin.status)}</div>
      ${pin.photo_url ? '<img src="'+pin.photo_url+'" style="width:100%;max-height:90px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" onerror="this.style.display=\'none\'">' : ''}
      ${_propSnap}
      ${_popupSolar}
      ${pin.estimate && pin.estimate.total ? `<div style="background:#0a1628;border:1px solid #3B82F655;border-radius:6px;padding:5px 8px;margin-bottom:7px;display:flex;align-items:center;justify-content:space-between;"><span style="font-size:9px;font-weight:700;color:#3B82F6;">✓ ESTIMATE</span><span style="font-size:13px;font-weight:700;color:#FFF;">$${(pin.estimate.total||0).toLocaleString()}</span></div>` : ''}
      <button onclick="goEstFromPin('${pid}')" style="background:#F25C05;border:none;border-radius:7px;padding:8px;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">${pin.estimate && pin.estimate.total ? '📋 Edit Estimate' : '📋 Build Estimate'}</button>
      <button onclick="measureForPin('${pid}')" style="background:transparent;border:1.5px solid #F25C05;border-radius:7px;padding:6px;color:#F25C05;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">📐 Measure Roof</button>
      <button onclick="openPhotoModal('${pid}')" style="background:transparent;border:1.5px solid #22C55E;border-radius:7px;padding:6px;color:#22C55E;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">📷 Manage Photos</button>
      <div id="contact-info-${pid}" style="margin-bottom:5px;">${pin.contactData ? buildContactInfoHTML(pid, pin.contactData) : (currentAccount && currentAccount.tracerfy_enabled ? `<button onclick="event.stopPropagation();lookupContactInfo('${pid}')" style="background:transparent;border:1.5px solid #A78BFA;border-radius:7px;padding:6px;color:#A78BFA;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;display:block;">📞 Get Contact Info</button>` : `<div style="font-size:10px;color:#6B7280;text-align:center;padding:4px;">Contact lookup not enabled</div>`)}</div>
      <button onclick="openNearbyCampaign('${pid}')" style="background:rgba(242,92,5,.12);border:1.5px solid #F25C05;border-radius:7px;padding:6px;color:#F25C05;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">📍 Nearby Campaign</button>
      <button onclick="openSorryForMess('${pid}')" style="background:rgba(99,102,241,.12);border:1.5px solid #6366F1;border-radius:7px;padding:6px;color:#6366F1;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">🏗 Sorry for the Mess</button>
      <button onclick="confirmDeletePin('${pid}')" style="background:transparent;border:1.5px solid #EF4444;border-radius:7px;padding:5px;color:#EF4444;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;display:block;">🗑 Delete Pin</button>
    </div>
  `,{maxWidth:260});
  markers[pid]=m;
  // Store pin data on marker for Solar API popup lookup
  m._bidDropPinId = pid;
  m._bidDropLat = pin.lat;
  m._bidDropLng = pin.lng;
  // Add to cluster group (falls back to direct map add if cluster not ready)
  if(clusterGroup) clusterGroup.addLayer(m);
  else m.addTo(map);
  // Solar data: fetch on popup open (hits DB cache first — free after first lookup per address)
  if(!pin._solarCache && pin.lat && pin.lng){
    const _sPid = pid, _sPin = pin, _sLat = pin.lat, _sLng = pin.lng;
    setTimeout(function(){
      if(typeof fetchSolarData === 'function'){
        fetchSolarData(_sLat, _sLng).then(function(data){
          if(!data || data.status !== 'ok') return;
          _sPin._solarCache = data;
          // If popup is open, inject solar row directly
          const valEl = document.getElementById('solar-val-'+_sPid);
          if(valEl){
            valEl.innerHTML = data.sqft.toLocaleString()+' sq ft &nbsp;&middot;&nbsp; <span style="color:#F25C05;font-weight:700;">'+data.squares+' sq</span> &nbsp;&middot;&nbsp; <span style="color:#22C55E;font-weight:700;">'+data.pitchLabel+' pitch</span>';
            const rowEl = document.getElementById('solar-row-'+_sPid);
            if(rowEl) rowEl.style.display = 'block';
          } else {
            // Popup not yet open — rebind so next open shows solar
            addMarker_updateSolar(m, _sPid, _sPin);
          }
        }).catch(function(){});
      }
    }, 300);
  }
  // Auto-fetch property data if not cached yet
  if(!pin.equityData && pin.address && !_rentcastFetched.has(pid)){
    _rentcastFetched.add(pid); // session-level dedup: never re-fetch same pin twice per session
    const _rcDelay = (_rentcastLoadQueue++) * 200; // stagger: 200ms apart to avoid burst-firing on load
    setTimeout(function(){
    lookupPropertyData(pin.address).then(function(data){
      if(!data) return;
      pin.equityData = {
        estValue: data.estValue, mortgageBalance: data.mortgageBalance, equity: data.equity,
        yearBuilt: data.yearBuilt, roofType: data.roofType, bedrooms: data.bedrooms,
        bathrooms: data.bathrooms, lastSaleDate: data.lastSaleDate, lastSalePrice: data.lastSalePrice
      };
      // ── PERSIST to Supabase so future page loads skip RentCast for this pin ──
      if(sb) sb.from('pins').update({ equity_data: pin.equityData }).eq('id', pid)
        .then(function({error}){ if(error && error.code !== 'PGRST204') console.warn('equityData persist:', error); });
      if(data.name && pin.estimate && !pin.estimate.owner){
        pin.estimate.owner = data.name;
        sb.from('pins').update({ estimate: pin.estimate }).eq('id', pid)
          .then(({error})=>{ if(error) console.warn('Owner persist:', error); });
      }
      const snapEl = document.getElementById('prop-snap-val-'+pid);
      if(snapEl){
        const parts = [];
        if(data.yearBuilt){ const age = new Date().getFullYear()-data.yearBuilt; parts.push('Built '+data.yearBuilt+' · <strong style="color:#A8BECE;">Home age: ~'+age+' yrs</strong>'); }
        if(data.roofType) parts.push(data.roofType);
        if(data.bedrooms||data.bathrooms) parts.push((data.bedrooms||'')+' bd / '+(data.bathrooms||'')+' ba');
        if(data.estValue) parts.push('Value: <strong style="color:#22C55E;">'+fmtMoney(data.estValue)+'</strong>');
        snapEl.innerHTML = parts.length ? parts.join(' &nbsp;·&nbsp; ') : 'No data available';
        if(m.getPopup && m.getPopup() && m.getPopup().update) m.getPopup().update();
      }
      addMarker_updatePropData(m, pid, pin);
    }).catch(function(){});
    }, _rcDelay); // end stagger setTimeout
  }
}

// Build the property snapshot HTML for the pin popup
function buildPropertySnapHTML(pid, eq){
  const parts = [];
  if(eq.yearBuilt){
    const age = new Date().getFullYear() - eq.yearBuilt;
    parts.push('🏠 Built ' + eq.yearBuilt + ' &nbsp;·&nbsp; <span style="color:#A8BECE;font-weight:600;">Home age: ~' + age + ' yrs</span>');
  }
  if(eq.roofType) parts.push(eq.roofType);
  if(eq.bedrooms || eq.bathrooms){
    const bd = eq.bedrooms ? eq.bedrooms + ' bd' : '';
    const ba = eq.bathrooms ? eq.bathrooms + ' ba' : '';
    parts.push([bd,ba].filter(Boolean).join('/'));
  }
  // Build financial row (value / equity / mortgage)
  const hasFinancial = eq.estValue || eq.equity || eq.mortgageBalance;
  const financialRow = hasFinancial ? `
    <div style="display:flex;gap:6px;margin-top:6px;">
      ${eq.estValue ? `<div style="flex:1;background:#0a1628;border-radius:6px;padding:5px 7px;"><div style="font-size:8px;color:#96B0C8;letter-spacing:.4px;">VALUE</div><div style="font-size:12px;font-weight:700;color:#FFF;">${fmtMoney(eq.estValue)}</div></div>` : ''}
      ${eq.equity ? `<div style="flex:1;background:#0a1628;border-radius:6px;padding:5px 7px;"><div style="font-size:8px;color:#96B0C8;letter-spacing:.4px;">EQUITY</div><div style="font-size:12px;font-weight:700;color:#22C55E;">${fmtMoney(eq.equity)}</div></div>` : ''}
      ${eq.mortgageBalance ? `<div style="flex:1;background:#0a1628;border-radius:6px;padding:5px 7px;"><div style="font-size:8px;color:#96B0C8;letter-spacing:.4px;">MORTGAGE</div><div style="font-size:12px;font-weight:700;color:#F25C05;">${fmtMoney(eq.mortgageBalance)}</div></div>` : ''}
    </div>` : '';
  const lastSale = eq.lastSaleDate ? '<div style="font-size:10px;color:#96B0C8;margin-top:4px;">Last sold ' + eq.lastSaleDate.substring(0,4) + (eq.lastSalePrice ? ' · ' + fmtMoney(eq.lastSalePrice) : '') + '</div>' : '';
  if(!parts.length && !hasFinancial) return '';
  return `<div id="prop-snap-${pid}" style="background:linear-gradient(135deg,#0f2027,#1a3a2a);border:1px solid #22C55E44;border-radius:8px;padding:8px 10px;margin-bottom:7px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.6px;color:#22C55E;margin-bottom:4px;">🏠 PROPERTY DATA</div>
    <div id="prop-snap-val-${pid}" style="font-size:11px;color:#E2E8F0;line-height:1.7;">${parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>
    ${financialRow}
    ${lastSale}
  </div>`;
}

// ── Tracerfy Contact Info ──────────────────────────────────────────────────
function buildContactInfoHTML(pid, cd){
  if(!cd) return '';
  const phones = (cd.phones||[]).slice(0,4);
  const emails = (cd.emails||[]).slice(0,2);
  if(!phones.length && !emails.length) return '<div style="font-size:10px;color:#96B0C8;text-align:center;padding:4px;">No contact data found</div>';
  // Format 10-digit number as (XXX) XXX-XXXX
  function fmtPhone(n){ const d=(n||'').replace(/\D/g,''); return d.length===10?'('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6):n; }
  let html = '<div style="background:linear-gradient(135deg,#1a0f2e,#2a1a3e);border:1px solid #A78BFA44;border-radius:8px;padding:8px 10px;">';
  html += '<div style="font-size:9px;font-weight:700;letter-spacing:.6px;color:#A78BFA;margin-bottom:4px;">📞 CONTACT INFO</div>';
  if(cd.ownerName) html += '<div style="font-size:11px;font-weight:700;color:#FFF;margin-bottom:5px;">'+cd.ownerName+'</div>';
  phones.forEach(function(p){
    const raw = p.number||p;
    const num = fmtPhone(raw);
    const dnc = p.dnc ? ' <span style="font-size:8px;color:#EF4444;background:#EF444422;padding:1px 4px;border-radius:3px;">DNC</span>' : '';
    const type = p.type ? ' <span style="font-size:8px;color:#96B0C8;">'+p.type+'</span>' : '';
    html += '<div style="font-size:12px;color:#FFF;font-weight:600;margin-bottom:3px;"><a href="tel:'+raw+'" style="color:#A78BFA;text-decoration:none;">'+num+'</a>'+type+dnc+'</div>';
  });
  emails.forEach(function(e){
    const addr = e.address||e;
    html += '<div style="font-size:10px;color:#C4B5FD;margin-bottom:2px;word-break:break-all;">✉ '+addr+'</div>';
  });
  html += '</div>';
  return html;
}
async function lookupContactInfo(pid, opts){
  opts = opts || {};
  const pin = (S.pins||[]).find(function(p){ return p.id===pid; });
  if(!pin) return;
  const el = document.getElementById('contact-info-'+pid);
  // DEDUP GUARD: if we already have saved contact data, show it without hitting the API
  if(pin.contactData && (pin.contactData.phones||[]).length + (pin.contactData.emails||[]).length > 0){
    if(el) el.innerHTML = buildContactInfoHTML(pid, pin.contactData);
    const m = markers[pid];
    if(m && m.getPopup && m.getPopup() && m.getPopup().update) m.getPopup().update();
    _fillEstimatorContactFields(pin.contactData);
    return;
  }
  // CREDIT GATE: require pin to be unlocked before hitting Tracerfy (skip if called post-unlock)
  if(!opts.suppressUnlockCheck){
    const _unlocked = await requirePinUnlocked(pid);
    if(!_unlocked) return;
  }
  if(el) el.innerHTML = '<div style="font-size:11px;color:#A78BFA;text-align:center;padding:6px;">⏳ Looking up…</div>';
  try{
    const parts = (pin.address||'').split(',').map(function(s){ return s.trim(); });
    const streetAddr = parts[0]||'';
    const cityPart   = parts[1]||'';
    const stateZip   = (parts[2]||'').trim().split(/\s+/);
    const stateCode  = stateZip[0]||'';
    const zipCode    = stateZip[1]||'';
    const ownerName  = (pin.estimate && pin.estimate.owner) || pin.owner || '';
    const result = await adminAPI('tracerfy', {
      ownerName: ownerName,
      address:   streetAddr,
      city:      cityPart,
      state:     stateCode,
      zip:       zipCode,
      pinId:     pid,
      viewingAccountId: currentAccount ? currentAccount.id : null
    });
    const phones = [];
    const emails = [];
    let ownerFullName = '';
    // Tracerfy returns data nested under persons[]
    const persons = (result && result.persons) ? result.persons : [];
    persons.forEach(function(person){
      // full_name, name, or first_name + last_name
      if(!ownerFullName){
        ownerFullName = person.full_name || person.name ||
          ([person.first_name, person.last_name].filter(Boolean).join(' ')) || '';
      }
      (person.phones||[]).forEach(function(p){ phones.push({ number: p.number||p, dnc: p.dnc||false, type: p.type||'' }); });
      (person.emails||[]).forEach(function(e){ emails.push({ address: e.address||e.email||e }); });
    });
    // Fallback: top-level phones/emails (older API shape)
    if(!phones.length && result && result.phones){
      result.phones.forEach(function(p){ phones.push({ number: p.number||p, dnc: p.dnc||false }); });
    }
    if(!emails.length && result && result.emails){
      result.emails.forEach(function(e){ emails.push({ address: e.address||e }); });
    }
    const cd = { phones: phones, emails: emails, ownerName: ownerFullName };
    pin.contactData = cd;
    if(sb && pin.id) sb.from('pins').update({ contact_data: cd }).eq('id', pin.id).then(function(){});
    // Re-fetch el in case popup was rebuilt while async call was in-flight
    const freshEl = document.getElementById('contact-info-'+pid);
    if(freshEl) freshEl.innerHTML = buildContactInfoHTML(pid, cd);
    else if(el) el.innerHTML = buildContactInfoHTML(pid, cd);
    const m = markers[pid];
    if(m && m.getPopup && m.getPopup() && m.getPopup().update) m.getPopup().update();
    // Auto-fill estimator owner name if empty and Tracerfy returned a name
    if(ownerFullName){
      var ownerEl = document.getElementById('e-owner');
      if(ownerEl && !ownerEl.value.trim()) ownerEl.value = ownerFullName;
      // Also update in-memory pin estimate so it persists
      if(pin.estimate) pin.estimate.owner = pin.estimate.owner || ownerFullName;
      if(typeof _accUpdateHomeownerSummary === 'function') _accUpdateHomeownerSummary();
    }
    // Auto-fill estimator phone + email fields if this pin is loaded in the estimator
    _fillEstimatorContactFields(cd);
  } catch(err){
    console.error('Tracerfy error:', err);
    if(el) el.innerHTML = '<div style="font-size:10px;color:#EF4444;text-align:center;padding:4px;">Lookup failed: '+(err&&err.message?err.message.substring(0,80):'unknown error')+'</div>';
  }
}

// Fill estimator phone + email fields from contactData (called after Tracerfy lookup)
// Handles multiple phones (with DNC badges) and multiple emails as a picker UI.
function _fillEstimatorContactFields(cd){
  if(!cd) return;
  var phones = cd.phones || [];
  var emails = cd.emails || [];

  // ── Phone picker ──────────────────────────────────────────────────────────
  var phoneWrap = document.getElementById('e-phone-wrap');
  var phoneEl   = document.getElementById('e-phone');
  if(phoneWrap && phones.length > 0){
    // Pick best default: first non-DNC number, else first number
    var bestPhone = phones.find(function(p){ return !p.dnc; }) || phones[0];
    if(phoneEl && !phoneEl.value) phoneEl.value = bestPhone.number || '';

    // Build picker list below the input (only if >1 phone or any DNC flag)
    var existingList = document.getElementById('e-phone-picker-list');
    if(existingList) existingList.remove();
    if(phones.length > 1 || phones.some(function(p){ return p.dnc; })){
      var list = document.createElement('div');
      list.id = 'e-phone-picker-list';
      list.style.cssText = 'margin-top:4px;display:flex;flex-direction:column;gap:3px;';
      phones.forEach(function(ph){
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:11px;';
        row.innerHTML =
          '<span style="flex:1;color:#e5e7eb;font-weight:600;">' + (ph.number||'') + '</span>' +
          '<span style="font-size:9px;color:#9ca3af;text-transform:uppercase;">' + (ph.type||'') + '</span>' +
          (ph.dnc ? '<span style="background:#ef4444;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;">DNC</span>' : '<span style="background:#22c55e;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;">OK</span>') +
          '<span style="font-size:10px;color:#f97316;">Use</span>';
        row.addEventListener('click', function(){
          if(phoneEl) phoneEl.value = ph.number || '';
          if(typeof _accUpdateHomeownerSummary==='function') _accUpdateHomeownerSummary();
          if(typeof scheduleDraftSave==='function') scheduleDraftSave();
          // Highlight selected
          list.querySelectorAll('div').forEach(function(r){ r.style.borderColor='rgba(255,255,255,.08)'; r.style.background='rgba(255,255,255,.04)'; });
          row.style.borderColor='#f97316'; row.style.background='rgba(249,115,22,.12)';
        });
        // Pre-highlight the default
        if(ph.number === (phoneEl && phoneEl.value)){
          row.style.borderColor='#f97316'; row.style.background='rgba(249,115,22,.12)';
        }
        list.appendChild(row);
      });
      phoneWrap.appendChild(list);
    }
    if(typeof _accUpdateHomeownerSummary==='function') _accUpdateHomeownerSummary();
  }

  // ── Email picker ─────────────────────────────────────────────────────────
  var emailWrap = document.getElementById('e-email-wrap');
  var emailEl   = document.getElementById('e-email');
  if(emailWrap && emails.length > 0){
    // emails[] are plain strings from Tracerfy
    var bestEmail = emails[0];
    if(typeof bestEmail === 'object') bestEmail = bestEmail.email || bestEmail.address || '';
    if(emailEl && !emailEl.value) emailEl.value = bestEmail;

    // Build picker list below the input (only if >1 email)
    var existingEmailList = document.getElementById('e-email-picker-list');
    if(existingEmailList) existingEmailList.remove();
    if(emails.length > 1){
      var eList = document.createElement('div');
      eList.id = 'e-email-picker-list';
      eList.style.cssText = 'margin-top:4px;display:flex;flex-direction:column;gap:3px;';
      emails.forEach(function(em){
        var addr = typeof em === 'string' ? em : (em.email || em.address || '');
        var eRow = document.createElement('div');
        eRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:11px;';
        eRow.innerHTML =
          '<span style="flex:1;color:#e5e7eb;font-weight:600;word-break:break-all;">' + addr + '</span>' +
          '<span style="font-size:10px;color:#f97316;">Use</span>';
        eRow.addEventListener('click', function(){
          if(emailEl) emailEl.value = addr;
          if(typeof _accUpdateHomeownerSummary==='function') _accUpdateHomeownerSummary();
          if(typeof scheduleDraftSave==='function') scheduleDraftSave();
          eList.querySelectorAll('div').forEach(function(r){ r.style.borderColor='rgba(255,255,255,.08)'; r.style.background='rgba(255,255,255,.04)'; });
          eRow.style.borderColor='#f97316'; eRow.style.background='rgba(249,115,22,.12)';
        });
        if(addr === (emailEl && emailEl.value)){
          eRow.style.borderColor='#f97316'; eRow.style.background='rgba(249,115,22,.12)';
        }
        eList.appendChild(eRow);
      });
      emailWrap.appendChild(eList);
    }
    if(typeof _accUpdateHomeownerSummary==='function') _accUpdateHomeownerSummary();
  }
}

// Rebuild a marker's popup HTML with fresh solar data (called after async fetch)
// ── Popup HTML builder (shared by addMarker + rebind helpers) ──────────────────────
function _buildPinPopupHTML(pin){
  const pid = pin.id;
  const _dmgPhotos = pin.damage_photos||[];
  const _popupPhotos = _dmgPhotos.length
    ? '<div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;">' + _dmgPhotos.map(src=>'<img src="'+src+'" style="width:calc(33% - 3px);height:80px;object-fit:cover;border-radius:6px;display:block;" onerror="this.style.display=\'none\'">').join('') + '</div>'
    : pin.photo_url
      ? '<img src="'+pin.photo_url+'" style="width:100%;max-height:90px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block;" onerror="this.style.display=\'none\'">'
      : '';
  const _solar = pin._solarCache;
  const _solarContent = _solar && _solar.status==='ok' && _solar.sqft
    ? _solar.sqft.toLocaleString()+' sq ft &nbsp;&middot;&nbsp; <span style="color:#F25C05;font-weight:700;">'+_solar.squares+' sq</span> &nbsp;&middot;&nbsp; <span style="color:#22C55E;font-weight:700;">'+_solar.pitchLabel+' pitch</span>'
    : null;
  const _popupSolar = _solarContent ? `<div id="solar-row-${pid}" style="background:rgba(242,92,5,.1);border:1px solid rgba(242,92,5,.3);border-radius:7px;padding:7px 10px;margin-bottom:7px;">
    <div style="font-size:9px;font-weight:700;letter-spacing:.6px;color:#F25C05;margin-bottom:3px;">\ud83d\udef0 SATELLITE MEASUREMENT</div>
    <div id="solar-val-${pid}" style="font-size:12px;color:#fff;font-weight:600;">${_solarContent}</div>
  </div>` : '';
  const _eq2 = pin.equityData;
  const _propSnap = _eq2 ? buildPropertySnapHTML(pid, _eq2) : `<div id="prop-snap-${pid}" style="background:linear-gradient(135deg,#0f2027,#1a3a2a);border:1px solid #22C55E33;border-radius:8px;padding:8px 10px;margin-bottom:7px;font-size:11px;color:#A8BECE;">\ud83c\udfe0 <span id="prop-snap-val-${pid}">Loading property data\u2026</span></div>`;
  // Owner name from estimate or equity data (shown even before contact lookup)
  const _ownerName = (pin.estimate && (typeof pin.estimate==='object' ? pin.estimate.owner : (() => { try { return JSON.parse(pin.estimate).owner; } catch(e) { return ''; } })()))
    || (pin.equityData && pin.equityData.ownerName) || '';
  // Contact info is now only accessible from the Estimator (Unlock Pin button)
  return `<div style="min-width:200px;max-width:240px;">
      <div style="font-weight:700;font-size:13px;margin-bottom:5px;color:#FFFFFF;line-height:1.3;">${escHtml(pin.address||'Unknown')}</div>
      <div style="display:inline-block;background:${sColor(pin.status)};color:white;font-size:11px;padding:2px 8px;border-radius:5px;font-weight:700;margin-bottom:${_ownerName ? '4px' : '8px'};">${sLabel(pin.status)}</div>
      ${_ownerName ? `<div style="font-size:12px;font-weight:700;color:#FFF;margin-bottom:8px;padding:3px 8px;background:rgba(255,255,255,.06);border-radius:6px;display:inline-block;">👤 ${escHtml(_ownerName)}</div>` : ''}
      ${_popupPhotos}
      ${_propSnap}
      ${_popupSolar}
      ${pin.estimate && pin.estimate.total ? `<div style="background:#0a1628;border:1px solid #3B82F655;border-radius:6px;padding:5px 8px;margin-bottom:7px;display:flex;align-items:center;justify-content:space-between;"><span style="font-size:9px;font-weight:700;color:#3B82F6;">\u2713 ESTIMATE</span><span style="font-size:13px;font-weight:700;color:#FFF;">$${(pin.estimate.total||0).toLocaleString()}</span></div>` : ''}
      <button onclick="goEstFromPin('${pid}')" style="background:#F25C05;border:none;border-radius:7px;padding:8px;color:white;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">${pin.estimate && pin.estimate.total ? '\ud83d\udccb Edit Estimate' : '\ud83d\udccb Build Estimate'}</button>
      <button onclick="measureForPin('${pid}')" style="background:transparent;border:1.5px solid #F25C05;border-radius:7px;padding:6px;color:#F25C05;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">\ud83d\udcd0 Measure Roof</button>
      <button onclick="openPhotoModal('${pid}')" style="background:transparent;border:1.5px solid #22C55E;border-radius:7px;padding:6px;color:#22C55E;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">\ud83d\udcf7 Manage Photos</button>
      <button onclick="openNearbyCampaign('${pid}')" style="background:rgba(242,92,5,.12);border:1.5px solid #F25C05;border-radius:7px;padding:6px;color:#F25C05;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">\ud83d\udccd Nearby Campaign</button>
      <button onclick="openSorryForMess('${pid}')" style="background:rgba(99,102,241,.12);border:1.5px solid #6366F1;border-radius:7px;padding:6px;color:#6366F1;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;margin-bottom:5px;display:block;">\ud83c\udfd7 Sorry for the Mess</button>
      <button onclick="confirmDeletePin('${pid}')" style="background:transparent;border:1.5px solid #EF4444;border-radius:7px;padding:5px;color:#EF4444;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;width:100%;display:block;">\ud83d\uddd1 Delete Pin</button>
    </div>`;
}
// Rebind popup with fresh solar data — NO marker destroy/recreate (prevents duplicate markers)
function addMarker_updateSolar(m, pid, pin){
  const cur = markers[pid];
  if(!cur) return;
  // Save contact info HTML if popup is currently open
  const prevContactEl = document.getElementById('contact-info-'+pid);
  const savedContactHTML = prevContactEl ? prevContactEl.innerHTML : null;
  const wasOpen = cur.isPopupOpen ? cur.isPopupOpen() : false;
  // Rebind popup on the EXISTING marker — no destroy, no new async fetches
  cur.bindPopup(_buildPinPopupHTML(pin), {maxWidth:260});
  if(wasOpen){
    cur.openPopup();
    if(savedContactHTML) setTimeout(function(){
      const newEl = document.getElementById('contact-info-'+pid);
      if(newEl && savedContactHTML !== newEl.innerHTML) newEl.innerHTML = savedContactHTML;
    }, 30);
  }
}
// Rebind popup with fresh property data — NO marker destroy/recreate (prevents duplicate markers)
function addMarker_updatePropData(m, pid, pin){
  const cur = markers[pid];
  if(!cur) return;
  // Save contact info HTML if popup is currently open
  const prevContactEl = document.getElementById('contact-info-'+pid);
  const savedContactHTML = prevContactEl ? prevContactEl.innerHTML : null;
  const wasOpen = cur.isPopupOpen ? cur.isPopupOpen() : false;
  // Rebind popup on the EXISTING marker — no destroy, no new async fetches
  cur.bindPopup(_buildPinPopupHTML(pin), {maxWidth:260});
  if(wasOpen){
    cur.openPopup();
    if(savedContactHTML) setTimeout(function(){
      const newEl = document.getElementById('contact-info-'+pid);
      if(newEl && savedContactHTML !== newEl.innerHTML) newEl.innerHTML = savedContactHTML;
    }, 30);
  }
}

function savePin(){
  if(!tempLL)return;
  const dmgPhotos = window._pinDamagePhotos || [];
  // ── Deduplicate: if a pin already exists at this address OR within 30m, offer to open it instead
  const newAddr = (document.getElementById('p-addr').value.trim()||(tempLL.lat.toFixed(4)+', '+tempLL.lng.toFixed(4))).toLowerCase();
  function _haversineM(lat1,lng1,lat2,lng2){
    const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  // Only check for duplicates within the same account
  const currentAccountId = currentAccount && currentAccount.id;
  const dupPin = S.pins.find(p=>{
    // Must be same account (or both null/undefined for legacy pins)
    const sameAccount = !currentAccountId || !p.account_id || p.account_id === currentAccountId;
    if(!sameAccount) return false;
    if((p.address||'').toLowerCase()===newAddr) return true;
    if(p.lat && p.lng && tempLL) return _haversineM(p.lat,p.lng,tempLL.lat,tempLL.lng) < 30;
    return false;
  });
  if(dupPin){
    closeM('m-pin');
    toast('📍 A pin already exists at this address — opening it','info');
    // Fly to existing pin and open its card
    if(map && dupPin.lat && dupPin.lng) map.flyTo([dupPin.lat, dupPin.lng], Math.max(map.getZoom(), 17));
    setTimeout(()=>{ const el=document.getElementById('pc-'+dupPin.id); if(el){ el.classList.add('open'); el.scrollIntoView({behavior:'smooth',block:'nearest'}); } }, 600);
    return;
  }
  // ── Zone lock-out enforcement ──────────────────────────────────────────────
  // Check if this point falls inside a zone assigned to a different rep
  if(typeof S_zones !== 'undefined' && S_zones && S_zones.length && tempLL){
    const myName = (currentProfile && (currentProfile.name || currentProfile.email || '').trim().toLowerCase()) || '';
    const isAdmin = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'super_admin');
    if(!isAdmin){
      const conflictZone = S_zones.find(zone => {
        if(!zone.rep_id) return false; // unassigned zone — anyone can pin
        // Check if zone is assigned to someone else
        const zoneRepProfile = (_zonesProfiles||[]).find(p=>p.id===zone.rep_id);
        const zoneRepName = zoneRepProfile ? (zoneRepProfile.name||zoneRepProfile.email||'').trim().toLowerCase() : '';
        if(zoneRepName === myName) return false; // my zone
        if(zone.rep_id === (currentProfile && currentProfile.id)) return false; // my zone by ID
        // Check if the click point is inside this zone
        const fakePin = {lat: tempLL.lat, lng: tempLL.lng};
        return typeof isPointInPolygon === 'function' && isPointInPolygon(fakePin, zone);
      });
      if(conflictZone){
        const ownerName = getRepName ? (getRepName(conflictZone.rep_id) || 'another rep') : 'another rep';
        const proceed = confirm('⚠️ Zone Conflict\n\nThis address is inside "' + conflictZone.name + '" — assigned to ' + ownerName + '.\n\nDo you still want to drop a pin here?');
        if(!proceed){ closeM('m-pin'); return; }
      }
    }
  }
  const pin={
    id:'p'+Date.now(),
    lat:tempLL.lat,lng:tempLL.lng,
    address:document.getElementById('p-addr').value.trim()||tempLL.lat.toFixed(4)+', '+tempLL.lng.toFixed(4),
    status:document.getElementById('p-status').value,
    notes:document.getElementById('p-notes').value.trim(),
    interested_trades: (window._pinSelectedTrades && window._pinSelectedTrades.length) ? [...window._pinSelectedTrades] : null,
    rep:document.getElementById('p-rep').value.trim()||'Unknown',
    phone:null, // phone field removed from pin modal — will be populated via contact lookup
    at:new Date().toISOString(),
    // Store first photo as primary; prefer all_photos.front[0] (from unified photo modal), fall back to _pinDamagePhotos
    photo_url: ((window._allPhotos&&window._allPhotos.front&&window._allPhotos.front[0]&&window._allPhotos.front[0].startsWith('http'))?window._allPhotos.front[0]:null) || ((dmgPhotos[0]&&dmgPhotos[0].startsWith('http'))?dmgPhotos[0]:null),
    photo_data: ((window._allPhotos&&window._allPhotos.front&&window._allPhotos.front[0]&&!window._allPhotos.front[0].startsWith('http'))?window._allPhotos.front[0]:null) || ((dmgPhotos[0]&&!dmgPhotos[0].startsWith('http'))?dmgPhotos[0]:null),
    damage_photos: dmgPhotos.length ? [...dmgPhotos] : ((window._allPhotos&&(window._allPhotos.damage||[]).length)?[...(window._allPhotos.damage||[])]:null),
    all_photos: (window._allPhotos && _allPhotosCount()>0) ? JSON.parse(JSON.stringify(window._allPhotos)) : null
  };
  S.pins.unshift(pin);
  addMarker(pin);
  bumpTeam(pin.rep,'pins');
  addAct('<strong>'+escHtml(pin.rep)+'</strong> pinned <strong>'+escHtml(pin.address)+'</strong> — '+sLabel(pin.status),pin.status);
  renderPinList();
  refreshZoneOverlays();
  savePin_withOffline(pin).catch(e=>console.error('Pin save:',e));
  sbAddActivity('<strong>'+escHtml(pin.rep)+'</strong> pinned <strong>'+escHtml(pin.address)+'</strong>',pin.status);
  window._pinDamagePhotos = [];
  const _totalPhotos = _allPhotosCount() || dmgPhotos.length;
  _clearAllPhotos(); // clear after saving so next pin starts fresh
  save();closeM('m-pin');toast('📍 Pin saved'+(_totalPhotos?' with '+_totalPhotos+' photo'+(_totalPhotos>1?'s':''):''),'success');
  // Open popup on new pin so satellite measurement loads immediately
  setTimeout(function(){ if(markers[pin.id]) markers[pin.id].openPopup(); }, 300);
  // Auto-pull homeowner name in background (non-blocking)
  if(masterRentcastKey && pin.address){
    const _newPin = pin;
    lookupPropertyData(_newPin.address).then(function(data){
      if(!data || !data.name) return;
      // Store on pin object
      if(!_newPin.estimate) _newPin.estimate = {};
      if(!_newPin.estimate.owner) _newPin.estimate.owner = data.name;
      // Persist to Supabase
      if(sb) sb.from('pins').update({ estimate: _newPin.estimate }).eq('id', _newPin.id)
        .then(function({error}){ if(error && error.code !== 'PGRST204') console.warn('Owner auto-pull persist:', error); });
      // Also store equity data
      _newPin.equityData = { estValue: data.estValue, mortgageBalance: data.mortgageBalance, equity: data.equity, yearBuilt: data.yearBuilt, roofType: data.roofType, bedrooms: data.bedrooms, bathrooms: data.bathrooms, lastSaleDate: data.lastSaleDate, lastSalePrice: data.lastSalePrice };
      if(sb) sb.from('pins').update({ equity_data: _newPin.equityData }).eq('id', _newPin.id)
        .then(function({error}){ if(error && error.code !== 'PGRST204') console.warn('Equity auto-pull persist:', error); });
    }).catch(function(){});
  }
}

// ── PIN DAMAGE PHOTOS ──────────────────────────────────────────────────────
window._pinDamagePhotos = []; // array of base64 data URLs, max 3

function addPinPhoto(){
  showPhotoActionSheet(function(files){
    // Simulate the original input handler
    const inp = document.getElementById('pin-photo-input');
    // Create a DataTransfer to set files on the real input
    try{
      const dt = new DataTransfer();
      Array.from(files).forEach(f=>dt.items.add(f));
      inp.files = dt.files;
    }catch(e){}
    handlePinPhotoInput({files: files});
  }, {multiple: false});
}

function handlePinPhotoInput(inp){
  if(!inp.files||!inp.files[0]) return;
  if((window._pinDamagePhotos||[]).length >= 3){ toast('Maximum 3 damage photos per pin','error'); return; }
  const file = inp.files[0];
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const idx = (window._pinDamagePhotos||[]).length;
  const path = acctId + '/pins/new-' + Date.now() + '/damage-' + idx + '.jpg';
  toast('Uploading photo…','info');
  uploadToStorage(file, path, 1200, 0.82, 'image/jpeg').then(url=>{
    if(!window._pinDamagePhotos) window._pinDamagePhotos = [];
    if(url){
      window._pinDamagePhotos.push(url);
      renderPinPhotosRow();
      toast('📷 Photo '+(window._pinDamagePhotos.length)+' added','success');
    } else {
      // Fallback to base64
      const r2 = new FileReader();
      r2.onload = ev=>{
        const img=new Image();
        img.onload=()=>{
          const canvas=document.createElement('canvas');
          const MAX=1200; let w=img.width,h=img.height;
          if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
          canvas.width=w;canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          const data=canvas.toDataURL('image/jpeg',0.82);
          window._pinDamagePhotos.push(data);
          renderPinPhotosRow();
          toast('📷 Photo '+(window._pinDamagePhotos.length)+' added (local)','info');
        };
        img.src=ev.target.result;
      };
      r2.readAsDataURL(file);
    }
  });
  inp.value = '';
}

function renderPinPhotosRow(){
  const row = document.getElementById('pin-photos-row');
  if(!row) return;
  const photos = window._pinDamagePhotos || [];
  let html = photos.map((src, i) =>
    '<div class="dmg-thumb">' +
      '<img src="'+src+'" alt="Damage photo '+(i+1)+'">' +
      '<button class="dmg-rm" onclick="removePinPhoto('+i+')" title="Remove">×</button>' +
    '</div>'
  ).join('');
  if(photos.length < 3){
    html += '<button class="dmg-add-btn" onclick="addPinPhoto()" title="Add damage photo">+</button>';
  }
  row.innerHTML = html;
}

function removePinPhoto(idx){
  if(!window._pinDamagePhotos) return;
  window._pinDamagePhotos.splice(idx, 1);
  renderPinPhotosRow();
}

function renderPinTradeChips(){
  const wrap = document.getElementById('p-trades-chips');
  if(!wrap) return;
  const et = (S.cfg && S.cfg.enabledTrades) || {roofing:true};
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  const TRADE_LABELS = {roofing:'🏠 Roof',solar:'☀️ Solar',fencing:'🪵 Fence',siding:'🏗 Siding',gutters:'🌊 Gutters',insulation:'🏠 Insulation',paint:'🎨 Paint',doors:'🚪 Doors',windows:'🪟 Windows'};
  const TRADE_COLORS = {roofing:'#F25C05',solar:'#22C55E',fencing:'#A78BFA',siding:'#60A5FA',gutters:'#38BDF8',insulation:'#FB923C',paint:'#F472B6',doors:'#FBBF24',windows:'#67E8F9'};
  const enabled = ALL_TRADES.filter(t => !!(et[t]));
  if(enabled.length <= 1){
    // Only roofing enabled — hide the section
    const section = document.getElementById('p-trades-wrap');
    if(section) section.style.display = 'none';
    return;
  }
  const section = document.getElementById('p-trades-wrap');
  if(section) section.style.display = '';
  if(!window._pinSelectedTrades) window._pinSelectedTrades = [];
  wrap.innerHTML = enabled.map(t => {
    const sel = window._pinSelectedTrades.includes(t);
    const col = TRADE_COLORS[t];
    return `<button type="button" onclick="togglePinTrade('${t}')" id="p-trade-chip-${t}" style="padding:5px 12px;border-radius:20px;border:1.5px solid ${sel ? col : 'var(--border)'};background:${sel ? 'rgba('+_hexToRgbStr(col)+',.15)' : 'var(--card2)'};color:${sel ? col : 'var(--muted)'};font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-b);transition:all .15s;">${TRADE_LABELS[t]}</button>`;
  }).join('');
}
function _hexToRgbStr(hex){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return r+','+g+','+b;
}
function togglePinTrade(t){
  if(!window._pinSelectedTrades) window._pinSelectedTrades = [];
  const idx = window._pinSelectedTrades.indexOf(t);
  if(idx>=0) window._pinSelectedTrades.splice(idx,1);
  else window._pinSelectedTrades.push(t);
  renderPinTradeChips();
}
function resetPinModal(){
  window._pinDamagePhotos = [];
  window._homePhotoData = null; // clear stale front photo from previous pin
  window._pinSelectedTrades = []; // clear trade interest selections
  window._photoModalPinId = null; // reset so photo modal doesn't attach to previous pin
  _clearAllPhotos(); // prevent stale photos from previous pin bleeding into new pin drop
  renderPinPhotosRow();
  renderPinTradeChips();
  // Clear the photo strip UI and reset the Add Photos button label
  const _strip = document.getElementById('pin-modal-photo-strip');
  if (_strip) { _strip.style.display = 'none'; _strip.innerHTML = ''; }
  const _addBtn = _strip ? _strip.previousElementSibling : null;
  if (_addBtn && _addBtn.tagName === 'BUTTON') {
    _addBtn.innerHTML = '📷 Add Photos';
    _addBtn.style.borderColor = '';
    _addBtn.style.color = '';
  }
}

// ── ADD PHOTOS TO EXISTING PIN (from map popup) ──────────────────────────────
function openPinPhotoAdder(pinId){
  window._addingPhotosForPin = pinId;
  showPhotoActionSheet(function(files){
    handlePopupPhotoInput({target:{files: files}});
  }, {multiple: true});
}

function handlePopupPhotoInput(e){
  const pinId = window._addingPhotosForPin;
  if(!pinId || !e.target.files || !e.target.files.length) return;
  const pin = S.pins.find(p=>p.id===pinId);
  if(!pin) return;
  const files = Array.from(e.target.files).slice(0, 3 - (pin.damage_photos||[]).length);
  if(!files.length){ toast('Maximum 3 photos per pin','error'); return; }
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  let processed = 0;
  const total = files.length;
  toast('Uploading '+total+' photo'+(total>1?'s':'')+'…','info');
  files.forEach((file, fi)=>{
    const idx = (pin.damage_photos||[]).length + fi;
    const path = acctId + '/pins/' + pinId + '/damage-' + idx + '.jpg';
    uploadToStorage(file, path, 1200, 0.82, 'image/jpeg').then(url=>{
      const doFinish = ()=>{
        processed++;
        if(processed === total){
          if(markers[pinId]){
            if(clusterGroup) clusterGroup.removeLayer(markers[pinId]);
            else map.removeLayer(markers[pinId]);
            delete markers[pinId];
          }
          addMarker(pin);
          renderPinList();
          sbSavePin(pin).catch(e=>console.error('Pin save:',e));
          save();
          toast('📷 '+processed+' photo'+(processed>1?'s':'')+' added!','success');
          if(markers[pinId]) markers[pinId].openPopup();
        }
      };
      const _syncPinAllPhotos = (src)=>{
        // Keep pin.all_photos in sync so goEstFromPin can load photos
        if(!pin.all_photos) pin.all_photos = { front:[], damage:[], angles:[], other:[] };
        if(!pin.all_photos.front) pin.all_photos.front = [];
        if(!pin.all_photos.damage) pin.all_photos.damage = [];
        // First photo goes to front (for mailer), rest go to damage
        if(pin.all_photos.front.length === 0 && src) pin.all_photos.front.push(src);
        else if(src && !pin.all_photos.front.includes(src) && !pin.all_photos.damage.includes(src) && pin.all_photos.damage.length < 3) pin.all_photos.damage.push(src);
      };
      if(url){
        if(!pin.damage_photos) pin.damage_photos = [];
        if(pin.damage_photos.length < 3) pin.damage_photos.push(url);
        if(!pin.photo_url && !pin.photo_data) pin.photo_url = url;
        _syncPinAllPhotos(url);
        doFinish();
      } else {
        // Fallback to base64
        const r2 = new FileReader();
        r2.onload = ev=>{
          const img=new Image();
          img.onload=()=>{
            const canvas=document.createElement('canvas');
            const MAX=1200; let w=img.width,h=img.height;
            if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
            canvas.width=w;canvas.height=h;
            canvas.getContext('2d').drawImage(img,0,0,w,h);
            const data=canvas.toDataURL('image/jpeg',0.82);
            if(!pin.damage_photos) pin.damage_photos = [];
            if(pin.damage_photos.length < 3) pin.damage_photos.push(data);
            if(!pin.photo_url && !pin.photo_data) pin.photo_data = data;
            _syncPinAllPhotos(data);
            doFinish();
          };
          img.src=ev.target.result;
        };
        r2.readAsDataURL(file);
      }
    });
  });
}

// Pipeline statuses (active working leads)
// Action-based pipeline sets (replaces old trade-specific statuses)
// Archive statuses (closed / parked leads)
const PIPELINE_STATUSES = new Set(['pinned','mailed','emailed','called','responded','quoted']);
const ARCHIVE_STATUSES  = new Set(['signed','not_interested']);

function switchPinView(view){
  curView = view;
  // Update tab button styles
  const pTab = document.getElementById('view-tab-pipeline');
  const aTab = document.getElementById('view-tab-archive');
  const pChips = document.getElementById('pipeline-chips');
  const aChips = document.getElementById('archive-chips');
  if(pTab){ pTab.style.background = view==='pipeline' ? 'var(--accent)' : 'var(--card2)'; pTab.style.color = view==='pipeline' ? '#fff' : 'var(--muted)'; pTab.style.border = view==='pipeline' ? 'none' : '1px solid var(--border)'; }
  if(aTab){ aTab.style.background = view==='archive'  ? 'var(--accent)' : 'var(--card2)'; aTab.style.color = view==='archive'  ? '#fff' : 'var(--muted)'; aTab.style.border = view==='archive'  ? 'none' : '1px solid var(--border)'; }
  if(pChips) pChips.style.display = view==='pipeline' ? '' : 'none';
  if(aChips) aChips.style.display = view==='archive'  ? '' : 'none';
  // Reset to the "all" chip for the new view
  const defaultFilter = view==='pipeline' ? 'pipeline' : 'archive';
  filterPins(defaultFilter);
}

function filterPins(s){
  curFilter=s;
  pinListPage=0; // reset pagination when filter changes
  // Highlight the correct chip in the active chip row
  document.querySelectorAll('.fchip').forEach(c=>c.classList.toggle('active',c.dataset.s===s));
  renderPinList();
}

let _pinTradeFilter = null; // null = all trades, 'roofing'/'siding'/etc = filter by trade
function getPinViewList(pins){
  // Returns the filtered array based on curFilter + optional trade filter
  let list;
  if(curFilter==='pipeline') list = pins.filter(p=>PIPELINE_STATUSES.has(p.status)||!p.status);
  else if(curFilter==='archive') list = pins.filter(p=>ARCHIVE_STATUSES.has(p.status));
  else list = pins.filter(p=>p.status===curFilter);
  if(_pinTradeFilter){
    list = list.filter(p=>{
      const trades = p.interested_trades;
      return trades && trades.includes(_pinTradeFilter);
    });
  }
  return list;
}
function renderPinTradeFilterChips(){
  const wrap = document.getElementById('pin-trade-chips');
  if(!wrap) return;
  const et = (S.cfg && S.cfg.enabledTrades) || {roofing:true};
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  const TRADE_LABELS = {roofing:'🏠 Roof',solar:'☀️ Solar',fencing:'🪵 Fence',siding:'🏗 Siding',gutters:'🌊 Gutters',insulation:'🏠 Insulation',paint:'🎨 Paint',doors:'🚪 Doors',windows:'🪟 Windows'};
  const TRADE_COLORS = {roofing:'#F25C05',solar:'#22C55E',fencing:'#A78BFA',siding:'#60A5FA',gutters:'#38BDF8',insulation:'#FB923C',paint:'#F472B6',doors:'#FBBF24',windows:'#67E8F9'};
  const enabled = ALL_TRADES.filter(t => !!(et[t]));
  if(enabled.length <= 1){ wrap.style.display='none'; return; }
  wrap.style.display='';
  const allBtn = `<button class="fchip ${!_pinTradeFilter?'active':''}" onclick="_setPinTradeFilter(null)" style="${!_pinTradeFilter?'':'border-color:var(--border);color:var(--muted);'}">All Trades</button>`;
  const tradeChips = enabled.map(t=>{
    const sel = _pinTradeFilter===t;
    const col = TRADE_COLORS[t]||'#96B0C8';
    return `<button class="fchip ${sel?'active':''}" onclick="_setPinTradeFilter('${t}')" style="${sel?'border-color:'+col+';color:'+col+';background:rgba('+_hexToRgbStr(col)+',.12);':'border-color:var(--border);color:var(--muted);'}">${TRADE_LABELS[t]||t}</button>`;
  }).join('');
  wrap.innerHTML = allBtn + tradeChips;
}
function _setPinTradeFilter(trade){
  _pinTradeFilter = trade;
  pinListPage = 0;
  renderPinTradeFilterChips();
  renderPinList();
}

function updatePinViewBadges(){
  const active = (S.pins||[]).filter(p=>!p.deleted_at);
  const pCount = active.filter(p=>PIPELINE_STATUSES.has(p.status)||!p.status).length;
  const aCount = active.filter(p=>ARCHIVE_STATUSES.has(p.status)).length;
  const bp = document.getElementById('badge-pipeline');
  const ba = document.getElementById('badge-archive');
  if(bp) bp.textContent = pCount;
  if(ba) ba.textContent = aCount;
}

const PIN_LIST_PAGE_SIZE = 50;
let _pinBulkMode = false;
let _selectedPinIds = new Set();

function togglePinBulkMode(){
  _pinBulkMode = !_pinBulkMode;
  _selectedPinIds.clear();
  const bar = document.getElementById('pin-bulk-bar');
  const btn = document.getElementById('pin-bulk-toggle');
  const tip = document.getElementById('map-tip');
  if(bar) bar.style.display = _pinBulkMode ? 'flex' : 'none';
  if(btn){ btn.textContent = _pinBulkMode ? '✕ Cancel' : '☑ Select'; btn.style.color = _pinBulkMode ? 'var(--accent)' : 'var(--muted)'; btn.style.borderColor = _pinBulkMode ? 'var(--accent)' : 'var(--border)'; }
  if(tip) tip.style.display = _pinBulkMode ? 'none' : 'block';
  updatePinSelectionCount();
  renderPinList();
}
function toggleAllPinSelect(checked){
  const list = getPinViewList((S.pins||[]).filter(p=>!p.deleted_at));
  if(checked) list.forEach(p=>_selectedPinIds.add(p.id));
  else _selectedPinIds.clear();
  updatePinSelectionCount();
  document.querySelectorAll('.pin-cb').forEach(cb=>{ cb.checked = checked; });
}
function togglePinSelect(pid){
  if(_selectedPinIds.has(pid)) _selectedPinIds.delete(pid);
  else _selectedPinIds.add(pid);
  updatePinSelectionCount();
  const all = document.getElementById('pin-select-all');
  const list = getPinViewList((S.pins||[]).filter(p=>!p.deleted_at));
  if(all){ all.checked = _selectedPinIds.size === list.length && list.length > 0; all.indeterminate = _selectedPinIds.size > 0 && _selectedPinIds.size < list.length; }
}
function updatePinSelectionCount(){
  const cnt = document.getElementById('pin-selected-count');
  if(cnt) cnt.textContent = _selectedPinIds.size + ' selected';
}
async function bulkDeletePins(){
  if(!_selectedPinIds.size) return;
  const ids = [..._selectedPinIds];
  if(!confirm('Move '+ids.length+' pin(s) to Trash?\n\nPins are recoverable for 30 days. Only admins can permanently purge them.')) return;
  // Single confirm upfront, then delete all without calling rmPin (which has its own confirm)
  let deleted = 0;
  for(const id of ids){
    try{
      await sbDeletePin(id);
      const _bp = S.pins.find(p=>p.id===id);
      if(_bp) _bp.deleted_at = new Date().toISOString();
      // Cascade soft-delete: also soft-delete all linked estimates
      const _bpNow = new Date().toISOString();
      (S.estimates||[]).filter(e=>e.pinId===id && !e.deletedAt).forEach(e=>{
        e.deletedAt = _bpNow;
        if(sb) sb.from('estimates').update({deleted_at:_bpNow}).eq('id',e.id).then(()=>{});
      });
      if(markers[id]){
        if(clusterGroup) clusterGroup.removeLayer(markers[id]);
        else if(map) map.removeLayer(markers[id]);
        delete markers[id];
      }
      deleted++;
    }catch(e){
      console.warn('Bulk delete failed for pin',id,e);
    }
  }
  _selectedPinIds.clear();
  updatePinSelectionCount();
  // Exit bulk mode after delete
  if(_pinBulkMode) togglePinBulkMode();
  save();
  renderPinList();
  refreshZoneOverlays();
  toast('Deleted '+deleted+' pin(s)','info');
}
function bulkSetPinStatus(status){
  if(!_selectedPinIds.size) return;
  const ids = [..._selectedPinIds];
  ids.forEach(id=>{
    const p = S.pins.find(x=>x.id===id);
    if(p){
      p.status = status;
      if(sb) sb.from('pins').update({status, updated_at: new Date().toISOString()}).eq('id', id).then(()=>{});
      if(markers[id]) markers[id].setIcon && addMarker(p);
    }
  });
  save();
  _selectedPinIds.clear();
  updatePinSelectionCount();
  renderPinList();
  toast('Updated '+ids.length+' pin(s) to '+status.replace('_',' '),'success');
  // ── Auto-prompt Nearby Campaign when job(s) marked Signed ──
  if(status==='signed' && ids.length===1) _promptSignedNearbyCampaign(ids[0]);
  else if(status==='signed' && ids.length>1) _promptSignedNearbyCampaign(ids[0], ids.length);
}

function _promptSignedNearbyCampaign(pid, totalSigned){
  // Small delay so the status toast shows first
  setTimeout(function(){
    const pin = (S.pins||[]).find(p=>p.id===pid);
    if(!pin) return;
    const addr = pin.address || 'this job';
    const extra = totalSigned > 1 ? ' (showing prompt for first signed job)' : '';
    // Build prompt modal
    let prompt = document.getElementById('m-signed-nearby-prompt');
    if(!prompt){
      prompt = document.createElement('div');
      prompt.id = 'm-signed-nearby-prompt';
      prompt.className = 'modal-overlay';
      prompt.style.cssText = 'display:none;z-index:9200;';
      prompt.innerHTML = `
        <div class="modal-box" style="max-width:380px;width:95%;background:var(--panel);border-radius:16px;padding:0;overflow:hidden;">
          <div style="background:linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05));padding:22px 22px 16px;border-bottom:1px solid var(--border);">
            <div style="font-size:22px;margin-bottom:6px;">🎉</div>
            <div style="font-size:16px;font-weight:800;color:#4ade80;">Job Signed!</div>
            <div id="signed-prompt-addr" style="font-size:11px;color:var(--muted);margin-top:3px;"></div>
          </div>
          <div style="padding:18px 22px;">
            <div style="font-size:13px;color:var(--text);font-weight:600;margin-bottom:6px;">Strike while the iron is hot 🔥</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:18px;">Send postcards to the nearest neighbors now. Homes that see your crew are 3× more likely to call. DOPE Marketing calls this their highest-converting campaign.</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <button id="signed-prompt-10" onclick="_launchSignedNearbyCampaign(10)" style="flex:1;background:rgba(242,92,5,.12);border:1.5px solid #F25C05;border-radius:8px;padding:10px;color:#F25C05;font-size:12px;font-weight:700;cursor:pointer;">10 homes</button>
              <button id="signed-prompt-25" onclick="_launchSignedNearbyCampaign(25)" style="flex:1;background:rgba(242,92,5,.18);border:1.5px solid #F25C05;border-radius:8px;padding:10px;color:#F25C05;font-size:13px;font-weight:800;cursor:pointer;">★ 25 homes</button>
              <button id="signed-prompt-50" onclick="_launchSignedNearbyCampaign(50)" style="flex:1;background:rgba(242,92,5,.12);border:1.5px solid #F25C05;border-radius:8px;padding:10px;color:#F25C05;font-size:12px;font-weight:700;cursor:pointer;">50 homes</button>
            </div>
            <button onclick="closeM('m-signed-nearby-prompt')" style="width:100%;background:none;border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;">Not now</button>
          </div>
        </div>`;
      document.body.appendChild(prompt);
    }
    // Set address
    const addrEl = document.getElementById('signed-prompt-addr');
    if(addrEl) addrEl.textContent = addr+extra;
    // Store pid for the launch handler
    window._signedPromptPid = pid;
    openM('m-signed-nearby-prompt');
  }, 800);
}

function _launchSignedNearbyCampaign(count){
  closeM('m-signed-nearby-prompt');
  const pid = window._signedPromptPid;
  if(!pid) return;
  // Pre-select count and open the full nearby campaign modal
  openNearbyCampaign(pid);
  // Auto-click the matching count button after modal opens
  setTimeout(function(){
    const btns = document.querySelectorAll('.nearby-count-btn');
    btns.forEach(function(b){
      if(b.textContent.trim().startsWith(String(count))) b.click();
    });
  }, 200);
}
// ── SORRY FOR THE MESS — Pre-Job Neighbor Campaign ─────────────────────────
function openSorryForMess(pid){
  const srcPin = (S.pins||[]).find(p=>p.id===pid);
  if(!srcPin){ toast('Pin not found','error'); return; }

  let modal = document.getElementById('m-sorry-for-mess');
  if(!modal){
    modal = document.createElement('div');
    modal.id = 'm-sorry-for-mess';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none;z-index:9150;';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:460px;width:95%;background:var(--panel);border-radius:16px;padding:0;overflow:hidden;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(99,102,241,.05));padding:20px 22px 16px;border-bottom:1px solid var(--border);">
          <div style="font-size:20px;margin-bottom:6px;">🏗️</div>
          <div style="font-size:16px;font-weight:800;color:var(--text);">Sorry for the Mess</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px;">Send postcards to neighbors <em>before</em> your crew arrives</div>
        </div>
        <!-- Body -->
        <div style="padding:18px 22px;max-height:80vh;overflow-y:auto;">
          <!-- Job address -->
          <div id="sfm-addr" style="font-size:11px;color:var(--muted);margin-bottom:14px;"></div>

          <!-- Postcard Image -->
          <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📸 Postcard Image</div>
          <div id="sfm-img-area" style="position:relative;width:100%;height:160px;background:#111827;border-radius:10px;overflow:hidden;margin-bottom:4px;cursor:pointer;border:2px dashed var(--border);" onclick="document.getElementById('sfm-img-input').click()">
            <img id="sfm-img-preview" src="" style="width:100%;height:100%;object-fit:cover;display:none;">
            <div id="sfm-img-placeholder" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
              <div style="font-size:28px;">🏠</div>
              <div style="font-size:12px;color:var(--muted);font-weight:600;">Click to upload a photo</div>
              <div style="font-size:10px;color:var(--mid);">or uses house photo from pin by default</div>
            </div>
            <div id="sfm-img-change-btn" style="display:none;position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:4px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">Change Photo</div>
          </div>
          <input type="file" id="sfm-img-input" accept="image/*" style="display:none;" onchange="_sfmHandleImageUpload(this)">
          <div id="sfm-img-source" style="font-size:10px;color:var(--muted);margin-bottom:14px;"></div>

          <!-- Message preview -->
          <div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:16px;">
            <div style="font-size:10px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Postcard Message</div>
            <div style="font-size:13px;color:var(--text);line-height:1.6;font-style:italic;">
              &ldquo;Hi neighbor! We&rsquo;ll be working on the roof at <span id="sfm-job-addr-inline" style="font-weight:700;color:#6366F1;"></span> starting soon. We apologize in advance for any noise or inconvenience. While we&rsquo;re in the neighborhood, we&rsquo;d love to give you a FREE roof inspection. Call us anytime!&rdquo;
            </div>
          </div>
          <!-- Count picker -->
          <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">How many nearest neighbors?</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
            <button class="sfm-count-btn" onclick="_sfmSelectCount(this,10)" style="background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;">10</button>
            <button class="sfm-count-btn sfm-active" onclick="_sfmSelectCount(this,25)" style="background:rgba(99,102,241,.18);border:1.5px solid #6366F1;border-radius:8px;padding:10px;color:#6366F1;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">★ 25</button>
            <button class="sfm-count-btn" onclick="_sfmSelectCount(this,50)" style="background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;">50</button>
          </div>
          <!-- Cost preview -->
          <div id="sfm-cost" style="font-size:11px;color:var(--muted);text-align:center;margin-bottom:16px;"></div>
          <!-- Buttons -->
          <button id="btn-sfm-launch" onclick="_launchSorryForMess()" style="width:100%;background:#6366F1;border:none;border-radius:10px;padding:13px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px;">🏗️ Send Sorry for the Mess</button>
          <button onclick="closeM('m-sorry-for-mess')" style="width:100%;background:none;border:1px solid var(--border);border-radius:10px;padding:10px;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;">Not now</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Set content
  window._sfmSourcePid = pid;
  window._sfmCount = 25;
  window._sfmImageDataUrl = null; // reset uploaded image
  const addrEl = document.getElementById('sfm-addr');
  if(addrEl) addrEl.textContent = 'Job address: ' + (srcPin.address||'Unknown');
  const inlineAddr = document.getElementById('sfm-job-addr-inline');
  if(inlineAddr) inlineAddr.textContent = (srcPin.address||'').split(',')[0] || srcPin.address || 'your address';
  _sfmUpdateCost(25);
  // Auto-load pin house photo if available
  const pinPhoto = srcPin.photo_url || srcPin.photo_data || null;
  const prevImg = document.getElementById('sfm-img-preview');
  const placeholder = document.getElementById('sfm-img-placeholder');
  const changeBtn = document.getElementById('sfm-img-change-btn');
  const srcLbl = document.getElementById('sfm-img-source');
  if(pinPhoto && prevImg){
    prevImg.src = pinPhoto;
    prevImg.style.display = '';
    if(placeholder) placeholder.style.display = 'none';
    if(changeBtn) changeBtn.style.display = '';
    if(srcLbl) srcLbl.textContent = 'Using house photo from pin — click to replace';
    window._sfmImageDataUrl = pinPhoto;
  } else {
    if(prevImg){ prevImg.src=''; prevImg.style.display='none'; }
    if(placeholder) placeholder.style.display = '';
    if(changeBtn) changeBtn.style.display = 'none';
    if(srcLbl) srcLbl.textContent = 'No house photo on file — upload one or the postcard will use a placeholder';
  }
  openM('m-sorry-for-mess');
}

function _sfmHandleImageUpload(input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    window._sfmImageDataUrl = e.target.result;
    const prevImg = document.getElementById('sfm-img-preview');
    const placeholder = document.getElementById('sfm-img-placeholder');
    const changeBtn = document.getElementById('sfm-img-change-btn');
    const srcLbl = document.getElementById('sfm-img-source');
    if(prevImg){ prevImg.src = e.target.result; prevImg.style.display = ''; }
    if(placeholder) placeholder.style.display = 'none';
    if(changeBtn) changeBtn.style.display = '';
    if(srcLbl) srcLbl.textContent = 'Custom upload — click to change';
  };
  reader.readAsDataURL(file);
}

function _sfmSelectCount(btn, count){
  window._sfmCount = count;
  document.querySelectorAll('.sfm-count-btn').forEach(b=>{
    b.style.background='var(--card2)';
    b.style.borderColor='var(--border)';
    b.style.color='var(--text)';
  });
  btn.style.background='rgba(99,102,241,.18)';
  btn.style.borderColor='#6366F1';
  btn.style.color='#6366F1';
  _sfmUpdateCost(count);
}

function _sfmUpdateCost(count){
  const costEl = document.getElementById('sfm-cost');
  if(!costEl) return;
  const balance = (S.cfg.mailerCredits||0);
  const canAfford = balance >= count;
  costEl.innerHTML = count+' postcards &bull; '+count+' credits &bull; Balance: <span style="color:'+(canAfford?'#4ade80':'#ef4444')+';">'+balance+' credits</span>';
}

async function _launchSorryForMess(){
  const pid = window._sfmSourcePid;
  const count = window._sfmCount || 25;
  const srcPin = (S.pins||[]).find(p=>p.id===pid);
  if(!srcPin){ toast('Source pin not found','error'); return; }

  const btn = document.getElementById('btn-sfm-launch');
  if(btn){ btn.disabled=true; btn.textContent='Launching…'; }

  // Use the Nearby Campaign flow but with a pre-job template flag
  closeM('m-sorry-for-mess');
  // Pass image and SFM message to the campaign panel
  window._sorryForMessMode = true;
  window._sorryForMessJobAddr = (srcPin.address||'').split(',')[0] || srcPin.address || '';
  window._sorryForMessImage = window._sfmImageDataUrl || null;
  openNearbyCampaign(pid);
  // Auto-click the matching count button and pre-fill the postcard panel
  setTimeout(function(){
    const btns = document.querySelectorAll('.nearby-count-btn');
    btns.forEach(function(b){
      if(b.textContent.trim().startsWith(String(count))) b.click();
    });
    // Update modal title to reflect the campaign type
    const titleEl = document.querySelector('#m-nearby-campaign .modal-box div[style*="font-size:17px"]');
    if(titleEl) titleEl.textContent = '\ud83c\udfd7 Sorry for the Mess Campaign';
    const subtitleEl = document.getElementById('nearby-source-addr');
    if(subtitleEl) subtitleEl.textContent = 'Pre-job neighbor alert for: ' + (srcPin.address||'');
    // Pre-fill the photo in the campaign postcard panel
    if(window._sorryForMessImage){
      window._coiPhotoDataUrl = window._sorryForMessImage;
      const coiImg = document.getElementById('coi-photo-img');
      const coiPreview = document.getElementById('coi-photo-preview');
      const coiPlaceholder = document.getElementById('coi-photo-placeholder');
      if(coiImg) coiImg.src = window._sorryForMessImage;
      if(coiPreview) coiPreview.style.display = '';
      if(coiPlaceholder) coiPlaceholder.style.display = 'none';
    }
    // Pre-fill headline and subtext with SFM message
    const hlEl = document.getElementById('coi-headline');
    const stEl = document.getElementById('coi-subtext');
    const jobAddr = window._sorryForMessJobAddr || 'your address';
    if(hlEl) hlEl.value = 'Sorry for the Mess!';
    if(stEl) stEl.value = 'We\'re working at ' + jobAddr + '. Call us for a FREE roof inspection!';
  }, 300);
}

function bulkSendPinsToFollowUp(){
  if(!_selectedPinIds.size){ toast('Select at least one pin','info'); return; }
  const ids = [..._selectedPinIds];
  const first = S.pins.find(p=>p.id===ids[0]);
  if(!first) return;
  toast('Opening follow-up for '+ids.length+' home(s) — send one at a time','info');
  openFollowUp(ids[0]);
}

function renderPinList(){
  if(typeof updateFabBadge==='function') updateFabBadge();
  renderPinTradeFilterChips();
  const el=document.getElementById('pin-list');
  // Campaign filter: when coming from "View Pins" on a campaign card
  let basePins = (S.pins||[]).filter(p=>!p.deleted_at);
  if(window._campaignPinFilter){
    basePins = basePins.filter(p=>p.campaign_id===window._campaignPinFilter);
    // Show a dismissible banner above the list
    const bannerEl = document.getElementById('campaign-filter-banner');
    if(bannerEl){
      bannerEl.style.display='flex';
      const addr = (basePins[0]&&basePins[0].address||(basePins[0]&&basePins[0].notes)||'campaign').split(',')[0];
      bannerEl.innerHTML='<span style="flex:1;font-size:11px;color:var(--accent);font-weight:700;">📍 Showing '+basePins.length+' campaign pins</span><button onclick="window._campaignPinFilter=null;clearTimeout(window._campaignFilterTimer);document.getElementById(\'campaign-filter-banner\').style.display=\'none\';renderPinList()" style="background:none;border:none;color:var(--muted);font-size:14px;cursor:pointer;padding:0 4px;">✕</button>';
    }
  } else {
    const bannerEl = document.getElementById('campaign-filter-banner');
    if(bannerEl) bannerEl.style.display='none';
  }
  const list=getPinViewList(basePins); updatePinViewBadges();
  // Show server-side total when available, otherwise fall back to loaded count
  const displayCount = totalPinCount > S.pins.length ? totalPinCount : S.pins.length;
  document.getElementById('pin-count').textContent = displayCount;
  if(!list.length){
    el.innerHTML='<div style="text-align:center;padding:30px 14px;color:var(--muted);font-size:12px;">'+(curFilter==='pipeline'?'No active leads yet. Drop a pin on the map.':(curFilter==='archive'?'No archived leads yet.':'No homes with this status.'))+'</div>';
    return;
  }
  // Paginate: show up to (pinListPage+1)*PAGE_SIZE items
  const visibleCount = (pinListPage + 1) * PIN_LIST_PAGE_SIZE;
  const visible = list.slice(0, visibleCount);
  const hasMore = list.length > visibleCount;
  el.innerHTML = visible.map(p=>{
    const pid=p.id;
    const _thumbSrc = (p.damage_photos&&p.damage_photos.length) ? p.damage_photos[0] : (p.photo_url || p.photo_data || null);
    const dmgThumb = _thumbSrc ? '<img src="'+_thumbSrc+'" style="width:36px;height:36px;object-fit:cover;border-radius:5px;flex-shrink:0;" onerror="this.style.display=\'none\'">' : '';
    const dmgCount = p.damage_photos&&p.damage_photos.length?'<span style="font-size:10px;color:var(--accent);font-weight:700;">📷'+p.damage_photos.length+'</span>':'';
    const cbHtml = _pinBulkMode
      ? '<input type="checkbox" class="pin-cb" data-id="'+pid+'" '+((_selectedPinIds.has(pid))?'checked':'')+' onclick="event.stopPropagation();togglePinSelect(\''+pid+'\')" style="cursor:pointer;width:16px;height:16px;flex-shrink:0;margin-right:4px;">'
      : '';
    const clickHandler = _pinBulkMode
      ? 'onclick="togglePinSelect(\''+pid+'\');this.querySelector(\'.pin-cb\')&&(this.querySelector(\'.pin-cb\').checked=_selectedPinIds.has(\''+pid+'\'))"'
      : 'onclick="togglePinCard(\''+pid+'\')"';
    const tradeChipsHtml = _buildPinTradeChipsHtml(p, pid);
    return '<div class="pc" id="pc-'+pid+'" '+clickHandler+'>'+'<div class="pc-summary">'+cbHtml+dmgThumb+'<div style="flex:1;min-width:0;"><div class="pc-addr">'+escHtml(p.address)+'</div><div class="pc-meta"><span>'+timeAgo(p.at)+'</span>'+(p.rep?'<span>· '+escHtml(p.rep)+'</span>':'')+'</div></div>'+dmgCount+'<div class="sdot" style="background:'+sColor(p.status)+';margin-top:0;"></div>'+(! _pinBulkMode?'<span class="pc-chevron">›</span>':'')+'</div>'+(!_pinBulkMode?'<div class="pc-body">'+tradeChipsHtml+(p.notes?'<div class="pc-note" style="margin-bottom:8px;">"'+escHtml(p.notes)+'"</div>':'')+'<div class="pc-acts">'
    +'<button class="btn-xs pr" onclick="event.stopPropagation();goEstFromPin(\''+pid+'\')">'+'📋 Estimate</button>'+'<button class="btn-xs" onclick="event.stopPropagation();openFollowUp(\''+pid+'\')">'+'✉️ Follow Up</button>'+'<button class="btn-xs" onclick="event.stopPropagation();cycleStatus(\''+pid+'\')">'+'↻ Status</button>'+'<button class="btn-xs" onclick="event.stopPropagation();togglePinCard(\''+pid+'\')" style="margin-left:auto;" title="Close">✕ Close</button>'+(S.cfg.ghlLocationId?'<button class="btn-xs" style="background:'+(p.ghlContactId?'#166534':'#1e3a5f')+';border:1px solid '+(p.ghlContactId?'#22c55e':'#3b82f6')+';color:'+(p.ghlContactId?'#4ade80':'#93c5fd')+';" onclick="event.stopPropagation();ghlPushPin(\''+pid+'\')" title="'+(p.ghlContactId?'✓ Synced to GHL — click to re-sync':'Send to GHL')+'">'+(p.ghlContactId?'✓ GHL':'⬆ GHL')+'</button>':'')+(S.cfg.companyCamKey?'<button class="btn-xs" style="background:#1a2e1a;border:1px solid #22c55e;color:#4ade80;" onclick="event.stopPropagation();openCompanyCamModal(\''+pid+'\')" title="View CompanyCam photos for this property">📷 Photos</button>':'')+'<button class="btn-xs danger" onclick="event.stopPropagation();rmPin(\''+pid+'\')">'+'✕</button>'+'</div></div>':'')+'</div>';
  }).join('');
  if(hasMore){
    el.insertAdjacentHTML('beforeend',
      '<div style="text-align:center;padding:10px 0 6px;">'
      +'<button onclick="pinListPage++;renderPinList()" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px 18px;color:var(--mid);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-b);">'
      +'Load More ('+(list.length - visibleCount)+' remaining)</button></div>');
  }
}

function togglePinCard(pid){
  const el=document.getElementById('pc-'+pid);
  if(!el)return;
  const wasOpen=el.classList.contains('open');
  // Close all open cards
  document.querySelectorAll('.pc.open').forEach(c=>c.classList.remove('open'));
  if(!wasOpen){el.classList.add('open');}
  // Also fly to pin
  flyTo(pid);
}
function flyTo(id){
  const p=S.pins.find(x=>x.id===id);
  if(p&&map){map.flyTo([p.lat,p.lng],17,{duration:.7});markers[id]&&markers[id].openPopup();}
}
// ── Inline trade tag toggle from pin card ──────────────────────────────────
function togglePinTradeInline(pinId, trade){
  const p = S.pins.find(x=>x.id===pinId);
  if(!p) return;
  if(!p.interested_trades) p.interested_trades = [];
  const idx = p.interested_trades.indexOf(trade);
  if(idx>=0) p.interested_trades.splice(idx,1);
  else p.interested_trades.push(trade);
  if(!p.interested_trades.length) p.interested_trades = null;
  save();
  sbUpdatePinTrades(p).catch(e=>console.warn('Trade update:',e));
  // Re-render just the trade chips inside the open card
  const cardEl = document.getElementById('pc-'+pinId);
  if(cardEl){
    const chipsEl = cardEl.querySelector('[data-trade-chips]');
    if(chipsEl) chipsEl.outerHTML = _buildPinTradeChipsHtml(p, pinId);
  }
  // Refresh filter if active
  if(_pinTradeFilter) renderPinList();
}
function _buildPinTradeChipsHtml(p, pid){
  const et = (S.cfg && S.cfg.enabledTrades) || {roofing:true};
  const ALL_TRADES = ['roofing','solar','fencing','siding','gutters','insulation','paint','doors','windows'];
  const TRADE_LABELS = {roofing:'🏠 Roof',solar:'☀️ Solar',fencing:'🪵 Fence',siding:'🏗 Siding',gutters:'🌊 Gutters',insulation:'🏠 Insulation',paint:'🎨 Paint',doors:'🚪 Doors',windows:'🪟 Windows'};
  const TRADE_COLORS = {roofing:'#F25C05',solar:'#22C55E',fencing:'#A78BFA',siding:'#60A5FA',gutters:'#38BDF8',insulation:'#FB923C',paint:'#F472B6',doors:'#FBBF24',windows:'#67E8F9'};
  const enabled = ALL_TRADES.filter(t => !!(et[t]));
  if(enabled.length <= 1) return '';
  const chips = enabled.map(t=>{
    const sel = (p.interested_trades||[]).includes(t);
    const col = TRADE_COLORS[t]||'#96B0C8';
    const rgb = _hexToRgbStr(col);
    return '<button type="button" onclick="event.stopPropagation();togglePinTradeInline(\''+pid+'\',\''+t+'\')" style="padding:3px 10px;border-radius:16px;border:1.5px solid '+(sel?col:'var(--border)')+';background:'+(sel?'rgba('+rgb+',.15)':'var(--card2)')+';color:'+(sel?col:'var(--muted)')+';font-size:10px;font-weight:700;cursor:pointer;font-family:var(--font-b);">'+(TRADE_LABELS[t]||t)+'</button>';
  }).join('');
  return '<div data-trade-chips style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">'+chips+'</div>';
}

// ═══════════════════════════════
//  STRUCTURES ENGINEE
// ═══════════════════════════════
function addStructure(sqft, name, pts, pitch){
  const id='s'+Date.now();
  structures.push({
    id, name:name||(structures.length===0?'Main House':'Structure '+(structures.length+1)),
    sqft:sqft||0, pitch:pitch||'1.202', mat:'1.3', stories:'1', complexity:'1.12',
    pts:pts||null
  });
  renderStructures();calcP();updatePreview();
}

function removeStructure(id){
  structures=structures.filter(s=>s.id!==id);
  renderStructures();calcP();updatePreview();
}

// ── PER-STRUCTURE PHOTOS ──────────────────────────────────────────────
function addStructurePhoto(sid){
  window._structPhotoTarget = sid;
  showPhotoActionSheet(function(files){
    _handleStructPhotoInput({target:{files: files}});
  }, {multiple: true});
}

function _handleStructPhotoInput(e){
  const sid = window._structPhotoTarget;
  const s = structures.find(x=>x.id===sid);
  if(!s || !e.target.files || !e.target.files.length) return;
  if(!s.photos) s.photos = [];
  const slots = 3 - s.photos.length;
  if(slots <= 0){ toast('Max 3 photos per structure','error'); return; }
  const files = Array.from(e.target.files).slice(0, slots);
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const pinSuffix = currentEstPinId || ('tmp-'+Date.now());
  let done = 0;
  const total = files.length;
  toast('Uploading '+total+' photo'+(total>1?'s':'')+'…','info');
  files.forEach((file, fi)=>{
    const idx = s.photos.length + fi;
    const path = acctId + '/pins/' + pinSuffix + '/struct-' + sid + '-' + idx + '.jpg';
    uploadToStorage(file, path, 1200, 0.82, 'image/jpeg').then(url=>{
      if(url){
        s.photos.push(url);
        done++;
        if(done === total){ renderStructures(); updatePreview(); toast('📷 '+done+' photo'+(done>1?'s':'')+' added to structure','success'); }
      } else {
        const r2 = new FileReader();
        r2.onload = ev=>{
          const img=new Image();
          img.onload=()=>{
            const canvas=document.createElement('canvas');
            const MAX=1200; let w=img.width,h=img.height;
            if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
            canvas.width=w;canvas.height=h;
            canvas.getContext('2d').drawImage(img,0,0,w,h);
            s.photos.push(canvas.toDataURL('image/jpeg',0.82));
            done++;
            if(done === total){ renderStructures(); updatePreview(); toast('📷 '+done+' photo'+(done>1?'s':'')+' added (local)','info'); }
          };
          img.src=ev.target.result;
        };
        r2.readAsDataURL(file);
      }
    });
  });
}

function removeStructurePhoto(sid, idx){
  const s = structures.find(x=>x.id===sid);
  if(!s || !s.photos) return;
  s.photos.splice(idx, 1);
  renderStructures();
  updatePreview();
}

// Called from oninput/onchange handlers via data-sid attribute
function _structField(el,field){
  const sid=el.dataset.sid;
  const s=structures.find(x=>x.id===sid);
  if(!s)return;
  s[field]=field==='sqft'?(parseFloat(el.value)||0):el.value;
  calcP();updatePreview();
}

function mkSel(opts, val, field){
  // Renders a <select> that calls _structField(this, field) on change
  // The data-sid attribute is set after insertion via renderStructures
  const inner=opts.map(o=>'<option value="'+o.v+'"'+(o.v==val?' selected':'')+'>'+o.l+'</option>').join('');
  return '<select class="fs" style="font-size:13px;padding:8px 10px;" data-field="'+field+'" onchange="_structField(this,\''+field+'\')">' +inner+'</select>';
}

function renderStructures(){
  const el=document.getElementById('structures-list');
  if(!el)return;
  if(!structures.length){
    el.innerHTML='<div style="text-align:center;padding:18px;color:var(--muted);font-size:13px;border:2px dashed var(--border);border-radius:9px;margin-bottom:12px;">No structures yet — tap + Add Structure below</div>';
    return;
  }
  let html='';
  structures.forEach(function(s,i){
    const price=calcStructPrice(s);
    html+='<div class="struct-card" id="sc-'+s.id+'">'+
      '<div class="struct-card-hdr">'+
      '<span style="background:var(--accent);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:9px;flex-shrink:0;">Bldg '+(i+1)+'</span>'+
      '<input class="struct-name-inp" data-sid="'+s.id+'" value="'+escHtml(s.name)+'" placeholder="e.g. Main House" oninput="_structField(this,\'name\')">'+
      '<span class="struct-price" id="sp-'+s.id+'">$'+price.toLocaleString()+'</span>'+
      '</div>'+
      '<div class="struct-card-actions">'+
      '<button class="struct-meas-btn" data-sid="'+s.id+'" onclick="measureForStructure(this.dataset.sid)">📐 Re-measure on Map</button>'+
      '<button class="struct-photo-btn" data-sid="'+s.id+'" onclick="openPhotoModal()" title="Manage property photos" style="background:transparent;border:1px solid #22C55E;border-radius:7px;padding:6px 10px;color:#22C55E;font-size:12px;font-weight:700;cursor:pointer;">📷 Photos'+((_allPhotosCount()>0)?(' ('+_allPhotosCount()+')'):'')+'</button>'+
      '<button class="struct-del-btn" data-sid="'+s.id+'" onclick="removeStructure(this.dataset.sid)" title="Remove structure">🗑</button>'+
      '</div>'+
      (s.photos&&s.photos.length ? '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;">'+s.photos.map((src,pi)=>'<div style="position:relative;display:inline-block;"><img src="'+src+'" style="width:72px;height:60px;object-fit:cover;border-radius:6px;display:block;"><button onclick="removeStructurePhoto(\"'+s.id+'\",'+pi+')" style="position:absolute;top:-4px;right:-4px;background:#EF4444;border:none;border-radius:50%;width:16px;height:16px;color:white;font-size:10px;cursor:pointer;line-height:16px;padding:0;">×</button></div>').join('')+'</div>' : '')+
      '<div class="frow" style="gap:8px;margin-bottom:8px;">'+
      '<div class="fg" style="margin-bottom:0;"><div class="fl">Sq Ft'+(s.solarFilled?'<span style="margin-left:5px;background:rgba(242,92,5,.15);border:1px solid rgba(242,92,5,.4);border-radius:4px;padding:1px 5px;font-size:9px;color:#F25C05;font-weight:700;letter-spacing:.3px;">🛰 SATELLITE</span>':'')+' </div>'+
      '<input type="number" class="fi" style="font-size:14px;padding:9px 10px;" data-sid="'+s.id+'" value="'+(s.sqft||'')+'" placeholder="2400" oninput="_structField(this,\'sqft\');s_clearSolarFilled(this.dataset.sid)"></div>'+
      '<div class="fg" style="margin-bottom:0;"><div class="fl">Stories</div>'+applyDataSid(mkSel(STORIES_OPTS,s.stories,'stories'),s.id)+'</div>'+
      '</div>'+
      '<div class="frow" style="gap:8px;margin-bottom:8px;">'+
      '<div class="fg" style="margin-bottom:0;"><div class="fl">Pitch</div>'+applyDataSid(mkSel(PITCH_OPTS,s.pitch,'pitch'),s.id)+'</div>'+
      '<div class="fg" style="margin-bottom:0;"><div class="fl">Material</div>'+applyDataSid(mkSel(MAT_OPTS,s.mat,'mat'),s.id)+'</div>'+
      '</div>'+
      '<div class="fg" style="margin-bottom:0;"><div class="fl">Complexity</div>'+applyDataSid(mkSel(COMPLEX_OPTS,s.complexity,'complexity'),s.id)+'</div>'+
      '</div>';
  });
  el.innerHTML=html;
}

// Inject data-sid into a <select> string
function applyDataSid(selectHtml,sid){
  return selectHtml.replace('<select ','<select data-sid="'+sid+'" ');
}

// Migrate old structure objects that used string field names (e.g. material:'arch_shingle', pitch:'6/12')
function normStruct(s){
  const matMap = {'arch_shingle':'1.3','3tab':'1.0','3_tab':'1.0','designer':'1.8','metal':'2.5'};
  const pitchMap = {'4/12':'1.054','5/12':'1.083','6/12':'1.118','7/12':'1.158','8/12':'1.202','9/12':'1.250','10/12':'1.302','11/12':'1.357','12/12':'1.414'};
  const complexMap = {'simple':'1.0','moderate':'1.12','complex':'1.25','very_complex':'1.40'};
  const out = Object.assign({}, s);
  // Fix mat field (was sometimes stored as 'material')
  if(!out.mat && out.material) out.mat = matMap[out.material] || out.material;
  if(out.mat && isNaN(parseFloat(out.mat))) out.mat = matMap[out.mat] || '1.3';
  // Fix pitch field
  if(out.pitch && isNaN(parseFloat(out.pitch))) out.pitch = pitchMap[out.pitch] || '1.15';
  // Fix complexity field
  if(out.complexity && isNaN(parseFloat(out.complexity))) out.complexity = complexMap[out.complexity] || '1.12';
  return out;
}


// ═══════════════════════════════
