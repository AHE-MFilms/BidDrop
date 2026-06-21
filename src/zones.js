// ── CANVASS AREAS / ZONES ────────────────────────────────────────────────────
// Extracted from index.html — zones map, polygon drawing, zone CRUD
// Dependencies: S [state.js], map [map.js], toast [ui.js], adminAPI [api.js],
//               sb [global], escHtml [index.html], currentAccount/currentProfile [globals]

// ── CANVASS AREAS ─────────────────────────────────────────────────────────────

// ── ZONES MAP ADDRESS SEARCH ─────────────────────────────────────────────────
let _zonesSearchTimer = null;
function onZonesSearchInput(){
  clearTimeout(_zonesSearchTimer);
  _zonesSearchTimer = setTimeout(function(){ zonesSearchAddress(true); }, 400);
}
async function zonesSearchAddress(suggest){
  suggest = suggest || false;
  const inp = document.getElementById('zones-search-inp');
  const q = inp ? inp.value.trim() : '';
  if(!q) return;
  try{
    const MB = window._mapboxToken||['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
    const res = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(q)+'.json?country=us&types=address,place&limit=5&access_token='+MB);
    const data = await res.json();
    const results = data.features||[];
    if(!results.length){ if(!suggest) toast('Address not found','error'); return; }
    if(suggest){
      window._zonesSrResults = results;
      const el = document.getElementById('zones-search-results');
      if(el){
        el.innerHTML = results.map(function(r,i){ return '<div class="msr-item" onclick="flyToZonesResultIdx('+i+')">'+escHtml(r.place_name)+'</div>'; }).join('');
        el.classList.add('show');
      }
    } else {
      const c = results[0].center;
      flyToZonesResult(c[1], c[0], results[0].place_name);
    }
  }catch(e){ toast('Search error','error'); }
}
function flyToZonesResultIdx(i){
  const r = (window._zonesSrResults||[])[i];
  if(!r) return;
  flyToZonesResult(r.center[1], r.center[0], r.place_name);
}
function flyToZonesResult(lat, lon, name){
  const el = document.getElementById('zones-search-results');
  if(el) el.classList.remove('show');
  const inp = document.getElementById('zones-search-inp');
  if(inp) inp.value = (name||'').split(',').slice(0,2).join(',').trim();
  if(zonesMap) zonesMap.flyTo([parseFloat(lat), parseFloat(lon)], 16, {duration:0.8});
}
document.addEventListener('click', function(e){
  const inp = document.getElementById('zones-search-inp');
  const res = document.getElementById('zones-search-results');
  if(res && inp && !inp.contains(e.target) && !res.contains(e.target)){
    res.classList.remove('show');
  }
});

let zonesMap = null;
let zonesDrawControl = null;
let zonesDrawLayer = null;   // FeatureGroup holding drawn polygons
let pendingPolygon = null;   // latlngs of the polygon being saved
let zoneOverlays = {};       // id → Leaflet polygon layer
let S_zones = [];            // in-memory zone array

// Distinct rep colors (cycles if more reps than colors)
const ZONE_COLORS = [
  '#F25C05','#3B82F6','#22C55E','#A855F7','#F59E0B',
  '#EC4899','#14B8A6','#EF4444','#6366F1','#84CC16'
];

function initZonesMap(){
  if(zonesMap) return;
  zonesMap = L.map('zones-map',{maxZoom:22}).setView([42.3314, -83.0458], 12);
  const _MB=window._mapboxToken||['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
  L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token='+_MB,{
    attribution:'© <a href="https://www.mapbox.com/">Mapbox</a>', maxZoom:22, tileSize:512, zoomOffset:-1
  }).addTo(zonesMap);
  zonesDrawLayer = new L.FeatureGroup().addTo(zonesMap);
  zonesMap.on('click', function(){if(currentZonePin)closeZonePinCard();});
  zonesMap.on('draw:created', function(e){
    pendingPolygon = e.layer.getLatLngs()[0].map(ll=>({lat:ll.lat,lng:ll.lng}));
    zonesDrawLayer.addLayer(e.layer);
    stopDrawMode();
    populateZoneRepSelect();
    // Auto-assign a color based on rep count
    document.getElementById('zone-color').value = ZONE_COLORS[S_zones.length % ZONE_COLORS.length];
    openM('m-save-zone');
  });
}

function startDrawZone(){
  if(!zonesMap) return;
  const drawControl = new L.Draw.Polygon(zonesMap, {
    shapeOptions:{ color: document.getElementById('zone-color')?.value || '#F25C05', fillOpacity:0.25, weight:2 }
  });
  drawControl.enable();
  document.getElementById('btn-draw-zone').style.display = 'none';
  document.getElementById('btn-cancel-draw').style.display = 'inline-flex';
  document.getElementById('zones-draw-tip').style.display = 'block';
  zonesDrawControl = drawControl;
}

function stopDrawMode(){
  if(zonesDrawControl){ zonesDrawControl.disable(); zonesDrawControl = null; }
  document.getElementById('btn-draw-zone').style.display = 'inline-flex';
  document.getElementById('btn-cancel-draw').style.display = 'none';
  document.getElementById('zones-draw-tip').style.display = 'none';
}

function cancelDrawZone(){
  stopDrawMode();
  if(pendingPolygon){ zonesDrawLayer.clearLayers(); pendingPolygon = null; }
}

async function populateZoneRepSelect(){
  const sel = document.getElementById('zone-rep-select');
  sel.innerHTML = '<option value="">— Select a rep —</option>';
  if(!currentAccount) return;
  const {data} = await sb.from('user_profiles').select('id,name,email').eq('account_id', currentAccount.id);
  _zonesProfiles = data || [];
  _zonesProfiles.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name || p.email || 'Unnamed';
    sel.appendChild(opt);
  });
}

async function saveZone(){
  const name = document.getElementById('zone-name').value.trim();
  const repId = document.getElementById('zone-rep-select').value;
  const color = document.getElementById('zone-color').value;
  if(!name){ toast('Please enter a zone name','error'); return; }
  if(!pendingPolygon){ toast('No polygon drawn','error'); return; }
  if(!currentAccount){ toast('Not logged in','error'); return; }
  const row = {
    account_id: currentAccount.id,
    rep_id: repId || null,
    name,
    color,
    polygon: pendingPolygon
  };
  const {data, error} = await sb.from('canvass_zones').insert(row).select().single();
  if(error){ toast('Save failed: '+error.message,'error'); return; }
  S_zones.push(data);
  pendingPolygon = null;
  zonesDrawLayer.clearLayers();
  document.getElementById('zone-name').value = '';
  closeM('m-save-zone');
  renderZoneOverlays();
  renderZonesList();
  toast('Zone saved!','success');
}

let _zonesProfiles = [];  // cached profiles for rep name lookup
async function loadZonesFromSupabase(){
  if(!currentAccount) return;
  const [{data: zoneData, error}, {data: profData}] = await Promise.all([
    sb.from('canvass_zones').select('*').eq('account_id', currentAccount.id),
    sb.from('user_profiles').select('id,name,email').eq('account_id', currentAccount.id)
  ]);
  if(error){ console.error('Load zones error:', error); return; }
  S_zones = zoneData || [];
  _zonesProfiles = profData || [];
  renderZoneOverlays();
  renderZonesList();
}

function renderZoneOverlays(){
  if(!zonesMap) return;
  // Remove old overlays
  Object.values(zoneOverlays).forEach(l=>zonesMap.removeLayer(l));
  zoneOverlays = {};
  const isAdmin = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'super_admin');
  S_zones.forEach(zone=>{
    const latlngs = (zone.polygon||[]).map(p=>[p.lat, p.lng]);
    if(!latlngs.length) return;
    const isMyZone = currentProfile && zone.rep_id === currentProfile.id;
    const opacity = isAdmin ? 0.28 : (isMyZone ? 0.35 : 0.08);
    const poly = L.polygon(latlngs, {
      color: zone.color || '#F25C05',
      fillColor: zone.color || '#F25C05',
      fillOpacity: opacity,
      weight: isMyZone || isAdmin ? 2.5 : 1,
      dashArray: isAdmin ? null : (isMyZone ? null : '6,4')
    }).addTo(zonesMap);
    // Zone label
    const center = poly.getBounds().getCenter();
    const label = L.divIcon({
      className:'',
      html:'<div style="background:rgba(15,22,35,0.82);color:'+zone.color+';border:1px solid '+zone.color+';border-radius:5px;padding:3px 8px;font-size:11px;font-weight:700;font-family:Oswald,sans-serif;letter-spacing:.5px;white-space:nowrap;">'+escHtml(zone.name)+'</div>',
      iconAnchor:[0,0]
    });
    L.marker(center, {icon:label, interactive:false}).addTo(zonesMap);
    // Click to show stats (admin only)
    if(isAdmin){
      poly.on('click', ()=>showZoneStats(zone));
      poly.bindTooltip('<b>'+escHtml(zone.name)+'</b><br><span style="font-size:11px;color:#aaa;">Click for stats</span>', {sticky:true});
    }
    zoneOverlays[zone.id] = poly;
  });
  // Overlay existing pins as clickable colored dots
  (S.pins||[]).forEach(pin=>{
    const color = pin.status==='needs_roof'?'#F25C05':pin.status==='bid_sent'?'#3B82F6':pin.status==='converted'?'#22C55E':'#6688A8';
    const dot = L.circleMarker([pin.lat, pin.lng],{
      radius:6, color:'#0F1623', weight:1.5, fillColor:color, fillOpacity:0.95
    }).addTo(zonesMap);
    const _statusLabels = {needs_roof:'Needs Roof',interested:'Interested',contacted:'Contacted',quoted:'Quoted',signed:'Signed',bid_sent:'Bid Sent',converted:'Converted',not_interested:'Not Interested',lost:'Lost'};
    const _tipStatus = _statusLabels[pin.status] || pin.status || '';
    const _tipEst = pin.estimate ? (()=>{ try{ const e=typeof pin.estimate==='string'?JSON.parse(pin.estimate):pin.estimate; return e&&e.total?' · $'+Number(e.total).toLocaleString():''; }catch(ex){ return ''; } })() : '';
    dot.bindTooltip('<b>'+escHtml(pin.address||'Pin')+'</b><br><span style="font-size:11px;color:#aaa;">'+_tipStatus+_tipEst+' — tap to view details</span>', {sticky:true});
    dot.on('click', function(e){ L.DomEvent.stopPropagation(e); showZonePinCard(pin); });
  });
  const _zc = document.getElementById('zones-count'); if(_zc) _zc.textContent = S_zones.length;
}

function renderZonesList(){
  const el = document.getElementById('zones-list');
  const isAdmin = currentProfile && (currentProfile.role === 'admin' || currentProfile.role === 'super_admin');
  if(!S_zones.length){
    el.innerHTML = '<div style="text-align:center;padding:30px 14px;color:var(--muted);font-size:12px;">No zones yet.'+(isAdmin?' Click <b style="color:var(--accent);">+ Draw Zone</b> to create one.':'')+'</div>';
    return;
  }
  el.innerHTML = S_zones.map(zone=>{
    const pinCount = (S.pins||[]).filter(p=>isPointInPolygon(p, zone)).length;
    const outcomes = getZoneOutcomes(zone);
    const deleteBtn = isAdmin
      ? '<button onclick="deleteZone(\''+zone.id+'\')" title="Delete zone" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 4px;" onmouseover="this.style.color=\'var(--danger)\'" onmouseout="this.style.color=\'var(--muted)\'">×</button>'
      : '';
    return '<div class="pc" onclick="flyToZone(\''+zone.id+'\')" style="border-left:3px solid '+zone.color+';cursor:pointer;">'+
      '<div class="pc-top">'+
        '<div class="pc-addr" style="font-size:13px;">'+escHtml(zone.name)+'</div>'+
        deleteBtn+
      '</div>'+
      '<div class="pc-meta">'+pinCount+' pins · '+outcomes.interested+' interested · '+outcomes.converted+' converted</div>'+
    '</div>';
  }).join('');
}

function flyToZone(id){
  const zone = S_zones.find(z=>z.id===id);
  if(!zone||!zonesMap) return;
  const latlngs = zone.polygon.map(p=>[p.lat,p.lng]);
  zonesMap.fitBounds(L.polygon(latlngs).getBounds(), {padding:[30,30]});
}

function showZoneStats(zone){
  const pins = (S.pins||[]).filter(p=>isPointInPolygon(p, zone));
  const outcomes = getZoneOutcomes(zone);
  const repName = getRepName(zone.rep_id);
  const msg = '📍 '+pins.length+' total pins\n'
    +'🟠 Needs Roof: '+outcomes.needs_roof+'\n'
    +'🔵 Bid Sent: '+outcomes.bid_sent+'\n'
    +'🟢 Converted: '+outcomes.converted+'\n'
    +'⚫ Not Interested: '+outcomes.not_interested+'\n'
    +'👤 Assigned to: '+(repName||'Unassigned');
  toast('Zone: '+zone.name+'\n'+msg, 'info', 6000);
}

async function deleteZone(id){
  if(!confirm('Delete this zone? This cannot be undone.')) return;
  const {error} = await sb.from('canvass_zones').delete().eq('id', id);
  if(error){ toast('Delete failed: '+error.message,'error'); return; }
  S_zones = S_zones.filter(z=>z.id!==id);
  if(zoneOverlays[id]){ zonesMap.removeLayer(zoneOverlays[id]); delete zoneOverlays[id]; }
  renderZoneOverlays();
  renderZonesList();
  toast('Zone deleted','info');
}

function getZoneOutcomes(zone){
  const pins = (S.pins||[]).filter(p=>isPointInPolygon(p, zone));
  return {
    needs_roof: pins.filter(p=>p.status==='needs_roof').length,
    bid_sent:   pins.filter(p=>p.status==='bid_sent').length,
    converted:  pins.filter(p=>p.status==='converted').length,
    not_interested: pins.filter(p=>p.status==='not_interested').length,
    interested: pins.filter(p=>p.status==='needs_roof'||p.status==='bid_sent').length
  };
}

// Ray-casting point-in-polygon test
function isPointInPolygon(pin, zone){
  const poly = zone.polygon || [];
  let inside = false;
  const x = pin.lng, y = pin.lat;
  for(let i=0, j=poly.length-1; i<poly.length; j=i++){
    const xi=poly[i].lng, yi=poly[i].lat;
    const xj=poly[j].lng, yj=poly[j].lat;
    const intersect = ((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

let currentZonePin = null;

function showZonePinCard(pin){
  currentZonePin = pin;
  const SL={needs_roof:'Needs Roof',contacted:'Contacted',quoted:'Quoted',signed:'Signed',bid_sent:'Bid Sent',converted:'Converted',not_interested:'Not Interested',lost:'Lost'};
  const SC={needs_roof:'#F25C05',contacted:'#A855F7',quoted:'#3B82F6',signed:'#22C55E',bid_sent:'#3B82F6',converted:'#22C55E',not_interested:'#6688A8',lost:'#EF4444'};
  const label=SL[pin.status]||pin.status||'Unknown';
  const color=SC[pin.status]||'#aaa';
  document.getElementById('zpc-address').textContent=pin.address||'Unknown address';
  document.getElementById('zpc-meta').innerHTML='<span style="color:'+color+';font-weight:700;">'+escHtml(label)+'</span>'+(pin.notes?' &middot; <span style="font-style:italic;">'+escHtml(pin.notes.slice(0,60))+(pin.notes.length>60?'&hellip;':'')+'</span>':'');
  document.getElementById('zpc-rep').textContent=pin.rep?'Rep: '+pin.rep:'';
  let estHtml='';
  if(pin.estimate){try{const est=typeof pin.estimate==='string'?JSON.parse(pin.estimate):pin.estimate;if(est&&est.total)estHtml='$'+Number(est.total).toLocaleString();}catch(ex){}}
  const savedEst=(S.estimates||[]).find(e=>e.pinId===pin.id&&!e.deletedAt&&!e.isRevision);
  if(savedEst&&savedEst.total)estHtml='$'+Number(savedEst.total).toLocaleString();
  document.getElementById('zpc-estimate').textContent=estHtml?'Estimate: '+estHtml:'';
  const photoEl=document.getElementById('zpc-photo');
  const photoUrl=pin.photo_url||pin.photo_data||null;
  if(photoUrl){photoEl.innerHTML='<img src="'+photoUrl+'" style="width:100%;height:100%;object-fit:cover;">';}
  else{photoEl.textContent='\uD83C\uDFE0';}
  document.getElementById('zpc-open-btn').style.display=pin.id?'inline-block':'none';
  const card=document.getElementById('zone-pin-card');
  if(card)card.style.transform='translateY(0)';
}
function closeZonePinCard(){
  currentZonePin=null;
  const card=document.getElementById('zone-pin-card');
  if(card)card.style.transform='translateY(100%)';
}
function showZonePinDetail(pin){showZonePinCard(pin);}
function closeZonePinDetail(){closeZonePinCard();}
function openZonePinEstimate(){if(!currentZonePin)return;const pin=currentZonePin;closeZonePinCard();if(pin.id)goEstFromPin(pin.id);}

function openPinInEstimator(){
  if(!currentZonePin) return;
  // Switch to estimator tab and pre-select this pin
  goTab('estimate');
  setTimeout(()=>{
    const picker = document.getElementById('est-pin-picker');
    if(picker){
      picker.value = currentZonePin.id;
      picker.dispatchEvent(new Event('change'));
    }
  }, 150);
}

function previewZonePin(){
  if(!currentZonePin) return;
  const pin = currentZonePin;
  if(!pin.estimate){ toast('No estimate built for this pin yet.','info'); return; }
  const est = typeof pin.estimate==='string' ? JSON.parse(pin.estimate) : pin.estimate;
  if(!est || !est.structures){ toast('No estimate data found.','info'); return; }
  // Save current estimator state so we can restore it
  const savedOwner = document.getElementById('e-owner').value;
  const savedEmail = document.getElementById('e-email').value;
  const savedAddr  = document.getElementById('e-addr').value;
  // Temporarily load pin data into estimator fields
  document.getElementById('e-owner').value = est.owner || pin.address.split(',')[0] || 'Homeowner';
  document.getElementById('e-email').value = est.email || '';
  document.getElementById('e-addr').value  = pin.address || '';
  // Load structures into estimator state and re-render preview
  structures = (est.structures || []).map(s => normStruct(s));
  renderStructures();
  if(typeof updatePreview === 'function') updatePreview();
  // Copy rendered mailer into the preview modal
  const mailerEl = document.getElementById('mailer-preview');
  const modalContent = document.getElementById('queue-preview-content');
  if(mailerEl && modalContent){ modalContent.innerHTML = mailerEl.innerHTML; }
  // Restore estimator state
  document.getElementById('e-owner').value = savedOwner;
  document.getElementById('e-email').value = savedEmail;
  document.getElementById('e-addr').value  = savedAddr;
  if(typeof updatePreview === 'function') updatePreview();
  openM('m-queue-preview');
}

function getRepName(repId){
  if(!repId) return null;
  const p = (_zonesProfiles||[]).find(x=>x.id===repId);
  return p ? (p.name || p.email || 'Rep') : null;
}

function initZonesTab(){
  setTimeout(()=>{
    if(!zonesMap){ initZonesMap(); if(currentAccount) loadZonesFromSupabase(); }
    else zonesMap.invalidateSize();
    const isAdmin = currentProfile && (currentProfile.role==='admin'||currentProfile.role==='super_admin');
    const btn = document.getElementById('btn-draw-zone');
    if(btn) btn.style.display = isAdmin ? 'inline-flex' : 'none';
  }, 80);
}

function clearZonesState(){
  S_zones = [];
  if(zonesMap){ zonesMap.remove(); zonesMap=null; }
  zoneOverlays = {};
  pendingPolygon = null;
  // Also clear main-map zone overlays
  mainMapZoneOverlays.forEach(l=>{ try{ map.removeLayer(l); }catch(_){} });
  mainMapZoneOverlays = [];
}

// ── ZONES ON MAIN CANVASS MAP ────────────────────────────────────────────────
let mainMapZonesVisible = false;
let mainMapZoneOverlays = [];

function toggleZonesOnMap(){
  const btn = document.getElementById('btn-zones-toggle');
  mainMapZonesVisible = !mainMapZonesVisible;
  if(mainMapZonesVisible){
    btn.classList.add('active');
    btn.textContent = '🗂 Zones ✓';
    drawZonesOnMainMap();
  } else {
    btn.classList.remove('active');
    btn.textContent = '🗂 Zones';
    mainMapZoneOverlays.forEach(l=>{ try{ map.removeLayer(l); }catch(_){} });
    mainMapZoneOverlays = [];
  }
}

function drawZonesOnMainMap(){
  // Clear existing
  mainMapZoneOverlays.forEach(l=>{ try{ map.removeLayer(l); }catch(_){} });
  mainMapZoneOverlays = [];
  if(!mainMapZonesVisible || !map) return;
  S_zones.forEach(zone=>{
    const latlngs = (zone.polygon||[]).map(p=>[p.lat, p.lng]);
    if(!latlngs.length) return;
    const poly = L.polygon(latlngs, {
      color: zone.color || '#F25C05',
      fillColor: zone.color || '#F25C05',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '6,4',
      interactive: false
    }).addTo(map);
    // Zone name label
    const center = poly.getBounds().getCenter();
    const label = L.divIcon({
      className:'',
      html:'<div style="background:rgba(15,22,35,0.75);color:'+zone.color+';border:1px solid '+zone.color+';border-radius:5px;padding:2px 7px;font-size:11px;font-weight:700;font-family:Oswald,sans-serif;white-space:nowrap;">'+escHtml(zone.name)+'</div>',
      iconAnchor:[0,0]
    });
    const labelMarker = L.marker(center, {icon:label, interactive:false}).addTo(map);
    mainMapZoneOverlays.push(poly, labelMarker);
  });
}

// Call this after any pin or estimate change to keep both maps in sync
function refreshZoneOverlays(){
  if(zonesMap) renderZoneOverlays();
  if(mainMapZonesVisible) drawZonesOnMainMap();
  // Always re-render sidebar zone cards so pin counts stay current
  const zonesList = document.getElementById('zones-list');
  if(zonesList) renderZonesList();
}

