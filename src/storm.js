// src/storm.js
// NOAA SPC Hail + Wind overlay on the map.
// Depends on: map (Leaflet global), toast(), S.cfg, currentAccount, adminAPI()
// Extracted from index.html — Tier 3 modularization

let _stormPanelOpen = false;
let _hailLayerOn = false;   // persistent: stays on even when panel closes
let _windLayerOn = false;   // persistent: stays on even when panel closes
let _stormData = [];        // fetched hail reports
let _stormLayers = [];      // Leaflet hail circle layers
let _windData = [];         // fetched wind reports
let _windLayers = [];       // Leaflet wind circle layers

function toggleStormEvents(){
  _stormPanelOpen = !_stormPanelOpen;
  const btn = document.getElementById('btn-storm-toggle');
  const panel = document.getElementById('storm-panel');
  if(_stormPanelOpen){
    btn.classList.add('active');
    panel.style.display = 'block';
    const toolbar = document.querySelector('.map-toolbar');
    if(toolbar){
      const tbRect = toolbar.getBoundingClientRect();
      const mapRect = document.getElementById('the-map').getBoundingClientRect();
      panel.style.top = (tbRect.bottom - mapRect.top + 10) + 'px';
    } else {
      panel.style.top = '210px';
    }
    _syncHailToggleUI();
    _syncWindToggleUI();
  } else {
    btn.classList.remove('active');
    panel.style.display = 'none';
    // Layers stay ON — closing panel does NOT clear them
  }
}

function closeStormPanel(){
  _stormPanelOpen = false;
  document.getElementById('btn-storm-toggle').classList.remove('active');
  document.getElementById('storm-panel').style.display = 'none';
}

// ── Storm state persistence ──────────────────────────────────────────────────
function _saveStormState(){
  try{
    const days = (document.getElementById('storm-days')||{}).value || '30';
    const minSize = (document.getElementById('storm-min-size')||{}).value || '0.75';
    localStorage.setItem('bd_storm_state', JSON.stringify({
      hailOn: _hailLayerOn,
      windOn: _windLayerOn,
      days: days,
      minSize: minSize
    }));
  }catch(e){}
}
function restoreStormState(){
  try{
    const raw = localStorage.getItem('bd_storm_state');
    if(!raw) return;
    const st = JSON.parse(raw);
    // Restore select values first
    const daysEl = document.getElementById('storm-days');
    const sizeEl = document.getElementById('storm-min-size');
    if(daysEl && st.days) daysEl.value = st.days;
    if(sizeEl && st.minSize) sizeEl.value = st.minSize;
    // Restore hail layer
    if(st.hailOn){
      _hailLayerOn = true;
      _syncHailToggleUI();
      loadStormEvents();
    }
    // Restore wind layer
    if(st.windOn){
      _windLayerOn = true;
      _syncWindToggleUI();
      loadWindEvents();
    }
  }catch(e){}
}
// ── Hail toggle ──────────────────────────────────────────────────
function toggleHailLayer(){
  _hailLayerOn = !_hailLayerOn;
  _syncHailToggleUI();
  if(_hailLayerOn){
    loadStormEvents();
  } else {
    clearStormMarkers();
    _stormData = [];
    const s = document.getElementById('storm-status'); if(s) s.textContent='';
  }
  _saveStormState();
}
function _syncHailToggleUI(){
  const track = document.getElementById('hail-toggle-track');
  const thumb = document.getElementById('hail-toggle-thumb');
  const lbl   = document.getElementById('hail-toggle-lbl');
  const ctrl  = document.getElementById('hail-controls');
  if(!track) return;
  if(_hailLayerOn){
    track.style.background='#3b82f6'; thumb.style.left='19px'; thumb.style.background='#fff';
    if(lbl){ lbl.textContent='ON'; lbl.style.color='#60a5fa'; }
    if(ctrl) ctrl.style.display='block';
  } else {
    track.style.background='#374151'; thumb.style.left='3px'; thumb.style.background='#9ca3af';
    if(lbl){ lbl.textContent='OFF'; lbl.style.color='var(--muted)'; }
    if(ctrl) ctrl.style.display='none';
  }
}

// ── Wind toggle ──────────────────────────────────────────────────
function toggleWindLayer(){
  _windLayerOn = !_windLayerOn;
  _syncWindToggleUI();
  if(_windLayerOn){
    loadWindEvents();
  } else {
    clearWindMarkers();
    _windData = [];
    const s = document.getElementById('wind-status'); if(s) s.textContent='';
  }
  _saveStormState();
}
function _syncWindToggleUI(){
  const track = document.getElementById('wind-toggle-track');
  const thumb = document.getElementById('wind-toggle-thumb');
  const lbl   = document.getElementById('wind-toggle-lbl');
  if(!track) return;
  if(_windLayerOn){
    track.style.background='#10b981'; thumb.style.left='19px'; thumb.style.background='#fff';
    if(lbl){ lbl.textContent='ON'; lbl.style.color='#34d399'; }
  } else {
    track.style.background='#374151'; thumb.style.left='3px'; thumb.style.background='#9ca3af';
    if(lbl){ lbl.textContent='OFF'; lbl.style.color='var(--muted)'; }
  }
}

function clearStormMarkers(){
  _stormLayers.forEach(l => map.removeLayer(l));
  _stormLayers = [];
}
function clearWindMarkers(){
  _windLayers.forEach(l => map.removeLayer(l));
  _windLayers = [];
}

async function loadStormEvents(){
  if(!_hailLayerOn) return;
  clearStormMarkers();
  _stormData = [];
  const days = parseInt(document.getElementById('storm-days').value) || 7;
  const statusEl = document.getElementById('storm-status');
  statusEl.textContent = 'Loading...';

  // Build list of dates to fetch (YYMMDD format)
  const dates = [];
  for(let i = 0; i < days; i++){
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    dates.push(`${yy}${mm}${dd}`);
  }

  // NOAA SPC sends Access-Control-Allow-Origin: * — fetch in batches to avoid overloading browser
  let completed = 0;
  const fetchOne = async (dateStr) => {
    try {
      const url = `https://www.spc.noaa.gov/climo/reports/${dateStr}_rpts_filtered_hail.csv`;
      const res = await fetch(url);
      completed++;
      statusEl.textContent = `Loading… ${completed}/${dates.length}`;
      if(!res.ok) return [];
      const text = await res.text();
      const lines = text.trim().split('\n');
      const rows = [];
      for(let i = 1; i < lines.length; i++){
        const parts = lines[i].split(',');
        if(parts.length < 7) continue;
        const size = parseFloat(parts[1]);
        const lat = parseFloat(parts[5]);
        const lon = parseFloat(parts[6]);
        if(isNaN(lat)||isNaN(lon)||isNaN(size)) continue;
        rows.push({
          date: dateStr,
          time: parts[0],
          size,
          location: parts[2] ? parts[2].trim() : '',
          county: parts[3] ? parts[3].trim() : '',
          state: parts[4] ? parts[4].trim() : '',
          lat, lon,
          comment: parts.slice(7).join(',').trim()
        });
      }
      return rows;
    } catch(e){ completed++; return []; }
  };

  // Batch fetches: 30 at a time to avoid overwhelming the browser for large ranges
  const BATCH = 30;
  const allRows = [];
  for(let b = 0; b < dates.length; b += BATCH){
    const batch = dates.slice(b, b + BATCH);
    const batchResults = await Promise.all(batch.map(fetchOne));
    batchResults.flat().forEach(r => allRows.push(r));
  }
  _stormData = allRows;

  renderStormMarkers();
  if(_stormData.length === 0){
    statusEl.textContent = 'No hail reports found for this period.';
  }
}

function renderStormMarkers(){
  clearStormMarkers();
  const minSize = parseFloat(document.getElementById('storm-min-size').value) || 0.75;
  const filtered = _stormData.filter(r => r.size >= minSize);
  const statusEl = document.getElementById('storm-status');

  filtered.forEach(r => {
    // Color by size (size is stored as decimal inches e.g. 1.00, 1.50, 2.00)
    let color, label;
    if(r.size >= 2.00){       color='#EF4444'; label='Baseball+'; }
    else if(r.size >= 1.50){ color='#F97316'; label='Golf Ball'; }
    else if(r.size >= 1.00){ color='#F59E0B'; label='Quarter'; }
    else {                    color='#FBBF24'; label='Penny'; }

    const sizeInches = r.size.toFixed(2);
    const dateFormatted = `20${r.date.slice(0,2)}-${r.date.slice(2,4)}-${r.date.slice(4,6)}`;

    // Use L.circle with real-world radius (~1 mile = 1609 meters)
    // Larger hail gets a slightly larger radius (up to ~2 miles for baseball+)
    let radiusMeters = 1609; // 1 mile default
    if(r.size >= 2.00) radiusMeters = 3218;      // ~2 miles for baseball+
    else if(r.size >= 1.50) radiusMeters = 2414; // ~1.5 miles for golf ball

    const circle = L.circle([r.lat, r.lon], {
      radius: radiusMeters,
      fillColor: color,
      color: color,
      weight: 1,
      opacity: 0.6,
      fillOpacity: 0.2
    });

    // Add a small center dot so the exact report location is visible
    const dot = L.circleMarker([r.lat, r.lon], {
      radius: 5,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 1
    });

    const popupHtml = `
      <div style="font-family:sans-serif;min-width:210px;">
        <div style="font-weight:700;font-size:14px;color:#fff;margin-bottom:6px;">\u26c8 Hail Report</div>
        <div style="font-size:12px;color:#e5e7eb;margin-bottom:4px;"><b style='color:#fff;'>Size:</b> ${sizeInches}\" (${label})</div>
        <div style="font-size:12px;color:#e5e7eb;margin-bottom:4px;"><b style='color:#fff;'>Location:</b> ${r.location}, ${r.county}, ${r.state}</div>
        <div style="font-size:12px;color:#e5e7eb;margin-bottom:4px;"><b style='color:#fff;'>Date:</b> ${dateFormatted}</div>
        ${r.comment ? `<div style="font-size:11px;color:#9ca3af;margin-bottom:6px;font-style:italic;">${r.comment}</div>` : ''}
        <div style="font-size:10px;color:#6b7280;background:rgba(255,255,255,.06);border-radius:4px;padding:5px 7px;margin-bottom:8px;">\u26a0\ufe0f Hail observed at this location. Impact area typically extends <b style='color:#9ca3af;'>1\u20132 miles</b> from this point.</div>
        <button onclick="stormDropPin(${r.lat},${r.lon},encodeURIComponent('${r.location}, ${r.county}, ${r.state}'))" 
          style="width:100%;background:#F25C05;color:#fff;border:none;border-radius:6px;padding:8px;font-weight:700;font-size:12px;cursor:pointer;">
          \uD83D\uDCCD Drop Pin Here
        </button>
      </div>
    `;
    circle.bindPopup(popupHtml);
    dot.bindPopup(popupHtml);

    circle.addTo(map);
    dot.addTo(map);
    _stormLayers.push(circle);
    _stormLayers.push(dot);
  });

  if(statusEl){
    statusEl.textContent = filtered.length > 0
      ? `${filtered.length} hail report${filtered.length!==1?'s':''} shown`
      : 'No reports match current filters.';
  }
}

function stormDropPin(lat, lon, locationHint){
  // Close any open popup
  map.closePopup();
  // Set the temp lat/lng and open the pin modal pre-filled
  tempLL = {lat, lng: lon};
  document.getElementById('p-addr').value = locationHint || '';
  document.getElementById('p-notes').value = 'Hail damage reported in this area.';
  document.getElementById('p-status').value = 'pinned';
  document.getElementById('p-phone').value = '';
  const repInp = document.getElementById('p-rep');
  if(repInp && currentProfile) repInp.value = currentProfile.name || '';
  resetPinModal();
  openM('m-pin');
  // Reverse geocode to get the real address
  const saveBtn = document.querySelector('#m-pin .btn-ok');
  const addrInp = document.getElementById('p-addr');
  if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Locating...'; }
  revGeo(lat, lon).then(()=>{
    if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = 'Save Pin'; }
  });
}

// ── Wind Events (50 MPH+, past 90 days) ──────────────────────────────
async function loadWindEvents(){
  if(!_windLayerOn) return;
  clearWindMarkers();
  _windData = [];
  const statusEl = document.getElementById('wind-status');
  if(statusEl) statusEl.textContent = 'Loading wind data...';

  const dates = [];
  for(let i = 0; i < 90; i++){
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    dates.push(`${yy}${mm}${dd}`);
  }

  let completed = 0;
  const fetchWind = async (dateStr) => {
    try {
      const url = `https://www.spc.noaa.gov/climo/reports/${dateStr}_rpts_filtered_wind.csv`;
      const res = await fetch(url);
      completed++;
      if(statusEl) statusEl.textContent = `Loading wind… ${completed}/90`;
      if(!res.ok) return [];
      const text = await res.text();
      const lines = text.trim().split('\n');
      const rows = [];
      for(let i = 1; i < lines.length; i++){
        const parts = lines[i].split(',');
        if(parts.length < 7) continue;
        const speed = parseInt(parts[1]); // knots from NOAA, convert to mph
        const lat = parseFloat(parts[5]);
        const lon = parseFloat(parts[6]);
        if(isNaN(lat)||isNaN(lon)||isNaN(speed)) continue;
        const mph = Math.round(speed * 1.15078);
        if(mph < 50) continue; // filter to 50 MPH+
        rows.push({ date: dateStr, time: parts[0], speed: mph, location: (parts[2]||'').trim(), county: (parts[3]||'').trim(), state: (parts[4]||'').trim(), lat, lon, comment: parts.slice(7).join(',').trim() });
      }
      return rows;
    } catch(e){ completed++; return []; }
  };

  const BATCH = 30;
  const allRows = [];
  for(let b = 0; b < dates.length; b += BATCH){
    const batch = dates.slice(b, b + BATCH);
    const batchResults = await Promise.all(batch.map(fetchWind));
    batchResults.flat().forEach(r => allRows.push(r));
  }
  _windData = allRows;
  renderWindMarkers();
  if(_windData.length === 0 && statusEl) statusEl.textContent = 'No 50 MPH+ wind reports in past 90 days.';
}

function renderWindMarkers(){
  clearWindMarkers();
  const statusEl = document.getElementById('wind-status');
  _windData.forEach(r => {
    let color;
    if(r.speed >= 100)      color = '#EF4444'; // extreme
    else if(r.speed >= 75)  color = '#F97316'; // severe
    else if(r.speed >= 60)  color = '#FBBF24'; // strong
    else                    color = '#34d399'; // 50-59 mph

    // Real-world radius: ~1 mile, larger for higher speeds
    let radiusMeters = 1609; // 1 mile
    if(r.speed >= 100) radiusMeters = 3218;      // ~2 miles extreme
    else if(r.speed >= 75) radiusMeters = 2414;  // ~1.5 miles severe

    const dateFormatted = `20${r.date.slice(0,2)}-${r.date.slice(2,4)}-${r.date.slice(4,6)}`;

    const circle = L.circle([r.lat, r.lon], {
      radius: radiusMeters, fillColor: color, color: color, weight: 1, opacity: 0.6, fillOpacity: 0.18
    });
    const dot = L.circleMarker([r.lat, r.lon], {
      radius: 5, fillColor: color, color: '#fff', weight: 1.5, opacity: 1, fillOpacity: 1
    });

    const popupHtml = `
      <div style="font-family:sans-serif;min-width:210px;">
        <div style="font-weight:700;font-size:14px;color:#fff;margin-bottom:6px;">💨 Wind Report</div>
        <div style="font-size:12px;color:#e5e7eb;margin-bottom:4px;"><b style='color:#fff;'>Speed:</b> ${r.speed} MPH</div>
        <div style="font-size:12px;color:#e5e7eb;margin-bottom:4px;"><b style='color:#fff;'>Location:</b> ${r.location}, ${r.county}, ${r.state}</div>
        <div style="font-size:12px;color:#e5e7eb;margin-bottom:4px;"><b style='color:#fff;'>Date:</b> ${dateFormatted}</div>
        ${r.comment ? `<div style="font-size:11px;color:#9ca3af;margin-bottom:6px;font-style:italic;">${r.comment}</div>` : ''}
        <div style="font-size:10px;color:#6b7280;background:rgba(255,255,255,.06);border-radius:4px;padding:5px 7px;margin-bottom:8px;">⚠️ Wind observed at this location. Impact area typically extends <b style='color:#9ca3af;'>1–2 miles</b> from this point.</div>
        <button onclick="stormDropPin(${r.lat},${r.lon},encodeURIComponent('${r.location} ${r.county} ${r.state}'))" 
          style="width:100%;background:#F25C05;color:#fff;border:none;border-radius:6px;padding:8px;font-weight:700;font-size:12px;cursor:pointer;">
          📍 Drop Pin Here
        </button>
      </div>
    `;
    circle.bindPopup(popupHtml);
    dot.bindPopup(popupHtml);
    circle.addTo(map);
    dot.addTo(map);
    _windLayers.push(circle);
    _windLayers.push(dot);
  });
  if(statusEl && _windData.length > 0) statusEl.textContent = `${_windData.length} wind report${_windData.length!==1?'s':''} shown (50+ MPH)`;
}

