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
    panel.style.display = 'flex';
    // Position below the toolbar using fixed coords
    const toolbar = document.querySelector('.map-toolbar');
    const bnav = document.querySelector('.bottom-nav') || document.querySelector('#bottom-nav');
    const topOffset = toolbar ? toolbar.getBoundingClientRect().bottom + 10 : 130;
    const bnavH = bnav ? bnav.getBoundingClientRect().height : 60;
    // Use visualViewport on iOS for accurate height (window.innerHeight includes hidden Safari chrome)
    const vph = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    const panelH = vph - topOffset - bnavH - 10;
    panel.style.top = topOffset + 'px';
    panel.style.height = Math.max(panelH, 200) + 'px';
    panel.style.maxHeight = Math.max(panelH, 200) + 'px';
    // Prevent touch events from bubbling to the map on iOS
    const body = panel.querySelector('.storm-body');
    if(body && !body._iosScrollBound){
      body._iosScrollBound = true;
      body.addEventListener('touchstart', e => e.stopPropagation(), {passive:true});
      body.addEventListener('touchmove', e => e.stopPropagation(), {passive:true});
    }
    _syncHailToggleUI();
    _syncWindToggleUI();
    // Populate the storm date picker if not already loaded
    if (typeof fetchMrmsStormDates === 'function') {
      const sel = document.getElementById('storm-date-sel');
      if (sel && sel.options.length <= 1) fetchMrmsStormDates();
    }
  } else {
    btn.classList.remove('active');
    panel.style.display = 'none';
    // Layers stay ON — closing panel does NOT clear them
  }
}

function closeStormPanel(){
  _stormPanelOpen = false;
  document.getElementById('btn-storm-toggle')?.classList.remove('active');
  const _sp=document.getElementById('storm-panel'); if(_sp) _sp.style.display='none';
}

// ── Storm city/zip search bar ────────────────────────────────────────────────
// Geocodes the city/zip input, flies the map there, then refreshes storm layers.
window.stormSearchFly = async function() {
  const inp = document.getElementById('storm-search-inp');
  const statusEl = document.getElementById('storm-search-status');
  const q = (inp?.value || '').trim();
  if (!q) { if (statusEl) statusEl.textContent = 'Enter a city or ZIP code.'; return; }
  if (statusEl) statusEl.textContent = '🔍 Searching…';
  try {
    const MB = window._mapboxToken || '';
    const res = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(q) + '.json?country=us&types=place,postcode&limit=1&access_token=' + MB);
    const data = await res.json();
    const feat = (data.features || [])[0];
    if (!feat) { if (statusEl) statusEl.textContent = 'Location not found.'; return; }
    const [lng, lat] = feat.center;
    const name = feat.place_name;
    // Fly to city/zip level (zoom 11)
    map.flyTo([lat, lng], 11, { duration: 1.2 });
    if (statusEl) statusEl.textContent = '✓ ' + (name || '').split(',').slice(0, 2).join(',').trim();
    // Refresh storm layers after the fly animation settles
    setTimeout(() => {
      if (_hailLayerOn) loadStormEvents();
      if (typeof renderMrmsLayer === 'function') renderMrmsLayer();
      if (typeof loadWindEvents === 'function' && _windLayerOn) loadWindEvents();
    }, 1400);
  } catch(e) {
    if (statusEl) statusEl.textContent = 'Search error. Try again.';
  }
};

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
    if(typeof loadMrmsLayer === 'function') loadMrmsLayer();
  } else {
    clearStormMarkers();
    _stormData = [];
    if(typeof clearMrmsLayer === 'function') clearMrmsLayer();
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
  const days = parseInt(document.getElementById('storm-days')?.value||'7') || 7;
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
      const url = `/api/storm-proxy?date=${dateStr}&type=hail`;
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
        const size = parseFloat(parts[1]) / 100; // SPC reports in hundredths of inches
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
  const minSize = parseFloat(document.getElementById('storm-min-size')?.value||'0.75') || 0.75;
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
            <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Size:</b> ${sizeInches}\" (${label})</div>
        <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Location:</b> ${r.location}, ${r.county}, ${r.state}</div>
        <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Date:</b> ${dateFormatted}</div>
        ${r.comment ? `<div style="font-size:12px;color:#d1d5db;margin-bottom:6px;font-style:italic;">${r.comment}</div>` : ''}
        <div style="font-size:11px;color:#d1d5db;background:rgba(255,255,255,.08);border-radius:4px;padding:6px 8px;margin-bottom:8px;">⚠️ Hail observed at this location. Impact area typically extends <b style='color:#fff;'>1–2 miles</b> from this point.</div>
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
  const _pAddr=document.getElementById('p-addr'); if(_pAddr) _pAddr.value=locationHint||'';
  const _pNotes=document.getElementById('p-notes'); if(_pNotes) _pNotes.value='Hail damage reported in this area.';
  const _pStatus=document.getElementById('p-status'); if(_pStatus) _pStatus.value='pinned';
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
      const url = `/api/storm-proxy?date=${dateStr}&type=wind`;
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
        <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Speed:</b> ${r.speed} MPH</div>
        <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Location:</b> ${r.location}, ${r.county}, ${r.state}</div>
        <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Date:</b> ${dateFormatted}</div>
        ${r.comment ? `<div style="font-size:12px;color:#d1d5db;margin-bottom:6px;font-style:italic;">${r.comment}</div>` : ''}
        <div style="font-size:11px;color:#d1d5db;background:rgba(255,255,255,.08);border-radius:4px;padding:6px 8px;margin-bottom:8px;">⚠️ Wind observed at this location. Impact area typically extends <b style='color:#fff;'>1–2 miles</b> from this point.</div>
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


// ══════════════════════════════════════════════════════════════════════════════
// STORM MODE — Hail intensity overlay for storm chasers
// ══════════════════════════════════════════════════════════════════════════════

let _stormModeActive = false;
let _stormModeDate = null;
let _stormModeLayer = null;      // Leaflet LayerGroup for hail dots
let _stormModeCache = {};        // { date_bounds_key: points[] }
let _stormModeReportCache = {};  // { "lat,lon": stormReportData }
let _stormModeDebounce = null;

// Open the Storm Mode date selector modal
window.openStormModeSelector = function() {
  const modal = document.getElementById('storm-mode-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  // Populate date selector if not already loaded
  const sel = document.getElementById('storm-mode-date-select');
  if (sel && sel.options.length <= 1 && typeof fetchMrmsStormDates === 'function') {
    fetchMrmsStormDates();
  }
};

window.closeStormModeModal = function() {
  const modal = document.getElementById('storm-mode-modal');
  if (modal) modal.style.display = 'none';
};

// Activate Storm Mode with the selected date
window.activateStormMode = function() {
  const sel = document.getElementById('storm-mode-date-select');
  const date = sel ? sel.value : '';
  if (!date) { toast('Please select a storm date first.'); return; }

  const opt = sel.options[sel.selectedIndex];
  const label = opt ? opt.text : date;

  _stormModeActive = true;
  _stormModeDate = date;
  _stormModeCache = {};
  _stormModeReportCache = {};

  // Close modal
  closeStormModeModal();

  // Show active banner
  const banner = document.getElementById('storm-mode-banner');
  const bannerDate = document.getElementById('storm-mode-banner-date');
  const bannerSize = document.getElementById('storm-mode-banner-size');
  if (banner) { banner.style.display = 'flex'; }
  if (bannerDate) bannerDate.textContent = label.split('—')[0].trim();
  if (bannerSize) bannerSize.textContent = (label.split('—')[1] || '').trim();

  // Style the Storm Mode button as active
  const btn = document.getElementById('btn-storm-mode');
  if (btn) { btn.style.background = '#F25C05'; btn.style.color = '#fff'; }

  // Load hail overlay for current viewport
  _loadStormModeOverlay();

  // Re-render on map move (debounced)
  if (map) {
    map.on('moveend', _onStormModeMapMove);
    map.on('zoomend', _onStormModeMapMove);
  }

  toast('⚡ Storm Mode activated — ' + date);
};

// Deactivate Storm Mode
window.deactivateStormMode = function() {
  _stormModeActive = false;
  _stormModeDate = null;

  // Hide banner
  const banner = document.getElementById('storm-mode-banner');
  if (banner) banner.style.display = 'none';

  // Reset button style
  const btn = document.getElementById('btn-storm-mode');
  if (btn) { btn.style.background = 'rgba(242,92,5,0.15)'; btn.style.color = '#F25C05'; }

  // Clear overlay
  if (_stormModeLayer) { map.removeLayer(_stormModeLayer); _stormModeLayer = null; }

  // Remove map listeners
  if (map) {
    map.off('moveend', _onStormModeMapMove);
    map.off('zoomend', _onStormModeMapMove);
  }
};

function _onStormModeMapMove() {
  if (!_stormModeActive) return;
  clearTimeout(_stormModeDebounce);
  _stormModeDebounce = setTimeout(_loadStormModeOverlay, 300);
}

// Load MRMS hail points for the current viewport from /api/mrms-viewport
async function _loadStormModeOverlay() {
  if (!_stormModeActive || !_stormModeDate || !map) return;

  const bounds = map.getBounds();
  const latMin = bounds.getSouth().toFixed(3);
  const latMax = bounds.getNorth().toFixed(3);
  const lonMin = bounds.getWest().toFixed(3);
  const lonMax = bounds.getEast().toFixed(3);

  const cacheKey = `${_stormModeDate}_${latMin}_${latMax}_${lonMin}_${lonMax}`;
  let points;

  if (_stormModeCache[cacheKey]) {
    points = _stormModeCache[cacheKey];
  } else {
    try {
      const url = `/api/mrms-viewport?date=${_stormModeDate}&latMin=${latMin}&latMax=${latMax}&lonMin=${lonMin}&lonMax=${lonMax}`;
      const r = await fetch(url);
      if (!r.ok) return;
      const data = await r.json();
      points = data.points || [];
      _stormModeCache[cacheKey] = points;
    } catch(e) { return; }
  }

  // Clear previous overlay
  if (_stormModeLayer) { map.removeLayer(_stormModeLayer); _stormModeLayer = null; }

  if (points.length === 0) return;

  const zoom = map.getZoom();
  const radius = zoom >= 14 ? 6 : zoom >= 12 ? 9 : 13;

  const layers = [];
  points.forEach(pt => {
    let color;
    if (pt.hail_size_in >= 2.75)      color = '#dc2626'; // Baseball+
    else if (pt.hail_size_in >= 1.75) color = '#ea580c'; // Baseball
    else if (pt.hail_size_in >= 1.0)  color = '#ca8a04'; // Golf Ball
    else                               color = '#2563eb'; // Quarter/Dime

    const dot = L.circleMarker([pt.lat, pt.lon], {
      radius,
      fillColor: color,
      color: color,
      weight: 0,
      fillOpacity: 0.75
    });

    const sizeLabel = pt.hail_size_in >= 2.75 ? 'Baseball+' :
                      pt.hail_size_in >= 1.75 ? 'Baseball' :
                      pt.hail_size_in >= 1.0  ? 'Golf Ball' : 'Quarter/Dime';

    dot.bindTooltip(`${pt.hail_size_in.toFixed(2)}" — ${sizeLabel}`, { sticky: true });
    layers.push(dot);
  });

  _stormModeLayer = L.layerGroup(layers).addTo(map);
}

// Get storm impact data for a specific lat/lon (used by pin popup)
window.getStormModeImpact = async function(lat, lon) {
  if (!_stormModeActive || !_stormModeDate) return null;
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (_stormModeReportCache[key]) return _stormModeReportCache[key];

  try {
    const url = `/api/storm-report?lat=${lat}&lon=${lon}&days=7`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    _stormModeReportCache[key] = data;
    return data;
  } catch(e) { return null; }
};

// Show/hide Activate Storm Mode button when a date is selected in the Storm Events panel
window._onStormDateChange = function(val) {
  const btn = document.getElementById('btn-activate-storm-mode');
  if (!btn) return;
  if (val && !_stormModeActive) {
    btn.style.display = 'block';
  } else {
    btn.style.display = 'none';
  }
};

// Activate Storm Mode from within the Storm Events panel
window.activateStormModeFromPanel = function() {
  const sel = document.getElementById('storm-date-sel');
  const date = sel ? sel.value : '';
  if (!date) { toast('Please pick a storm date first', 'error'); return; }
  activateStormMode(date);
  // Update panel UI
  const btn = document.getElementById('btn-activate-storm-mode');
  const activeRow = document.getElementById('storm-mode-active-row');
  const activeLabel = document.getElementById('storm-mode-active-label');
  if (btn) btn.style.display = 'none';
  if (activeRow) activeRow.style.display = 'block';
  if (activeLabel) activeLabel.textContent = '⚡ STORM MODE ACTIVE — ' + date;
};

// Override deactivateStormMode to also reset panel UI
const _origDeactivate = window.deactivateStormMode;
window.deactivateStormMode = function() {
  if (typeof _origDeactivate === 'function') _origDeactivate();
  const btn = document.getElementById('btn-activate-storm-mode');
  const activeRow = document.getElementById('storm-mode-active-row');
  const sel = document.getElementById('storm-date-sel');
  if (activeRow) activeRow.style.display = 'none';
  if (btn && sel && sel.value) btn.style.display = 'block';
};

// ── HAIL BY ZIP CODE ─────────────────────────────────────────────────────────
window.lookupHailByZip = async function() {
  const zip = (document.getElementById('hail-zip-input').value || '').trim();
  const statusEl = document.getElementById('hail-zip-status');
  const resultsEl = document.getElementById('hail-zip-results');
  if (!zip || zip.length < 5) { statusEl.textContent = 'Enter a 5-digit ZIP code.'; return; }
  statusEl.textContent = '🔍 Looking up hail events for ZIP ' + zip + '…';
  resultsEl.style.display = 'none';
  try {
    // Geocode ZIP to lat/lon using Mapbox
    const MB = window._mapboxToken || '';
    const geo = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${zip}.json?country=us&types=postcode&limit=1&access_token=${MB}`);
    const geoData = await geo.json();
    if (!geoData.features || !geoData.features.length) { statusEl.textContent = '❌ ZIP code not found.'; return; }
    const [lon, lat] = geoData.features[0].center;
    const placeName = geoData.features[0].place_name || zip;
    statusEl.textContent = '📡 Fetching storm data for ' + placeName + '…';
    // Fetch storm report for this location (90 days)
    const r = await fetch(`/api/storm-report?lat=${lat}&lon=${lon}&days=90`);
    if (!r.ok) throw new Error('API error');
    const data = await r.json();
    const mrms = data.mrms_hail || [];
    const spcHail = data.spc_hail_spotters || [];
    const wind = data.spc_wind || [];
    if (!mrms.length && !spcHail.length && !wind.length) {
      statusEl.textContent = '✅ No significant hail events found in ZIP ' + zip + ' (last 90 days).';
      return;
    }
    statusEl.textContent = '';
    // Group MRMS by date
    const byDate = {};
    mrms.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = { max: 0, count: 0 };
      if (e.hail_size_in > byDate[e.date].max) byDate[e.date].max = e.hail_size_in;
      byDate[e.date].count++;
    });
    const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));
    let html = `<div style="font-size:10px;font-weight:700;color:#a78bfa;margin-bottom:6px;">📮 ${placeName} — Last 90 Days</div>`;
    html += `<div style="font-size:10px;color:var(--mid);margin-bottom:8px;">${dates.length} storm date${dates.length !== 1 ? 's' : ''} with hail detected</div>`;
    dates.slice(0, 20).forEach(date => {
      const d = byDate[date];
      const lbl = d.max >= 2.75 ? '🔴 Baseball+' : d.max >= 1.75 ? '🟠 Baseball' : d.max >= 1.0 ? '🟡 Golf Ball' : '🔵 Quarter';
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px;">
        <span style="color:var(--text);">${date}</span>
        <span>${lbl} <b>${d.max.toFixed(2)}"</b></span>
        <span style="color:var(--mid);">${d.count} pts</span>
      </div>`;
    });
    if (spcHail.length) {
      html += `<div style="font-size:10px;font-weight:700;color:#60a5fa;margin-top:8px;margin-bottom:4px;">👤 Spotter Reports (${spcHail.length})</div>`;
      spcHail.slice(0, 5).forEach(e => {
        html += `<div style="font-size:11px;color:#93c5fd;padding:3px 0;border-bottom:1px solid var(--border);">${e.date || ''} — ${(e.magnitude/100).toFixed(2)}" hail${e.comments ? ' — "' + e.comments.substring(0,50) + '"' : ''}</div>`;
      });
    }
    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
  } catch(e) {
    statusEl.textContent = '❌ Error fetching data. Try again.';
  }
};

// ── HAIL EVENTS FEED ─────────────────────────────────────────────────────────
window.loadHailEventsFeed = async function() {
  const days = parseInt(document.getElementById('hail-events-days').value) || 30;
  const feedEl = document.getElementById('hail-events-feed');
  feedEl.innerHTML = '<div style="font-size:11px;color:var(--mid);text-align:center;padding:10px;">⚡ Loading hail events…</div>';
  try {
    // Get current map center for context
    const center = map ? map.getCenter() : { lat: 39.5, lng: -98.35 };
    const r = await fetch(`/api/storm-report?lat=${center.lat}&lon=${center.lng}&days=${days}`);
    if (!r.ok) throw new Error('API error');
    const data = await r.json();
    const mrms = data.mrms_hail || [];
    const spcHail = data.spc_hail_spotters || [];

    // Merge MRMS + SPC spotter data by date
    const byDate = {};
    mrms.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = { max: 0, mrmsCount: 0, spcCount: 0, sources: [] };
      if (e.hail_size_in > byDate[e.date].max) byDate[e.date].max = e.hail_size_in;
      byDate[e.date].mrmsCount++;
      if (!byDate[e.date].sources.includes('MRMS')) byDate[e.date].sources.push('MRMS');
    });
    spcHail.forEach(e => {
      const date = e.date || '';
      if (!date) return;
      const sizeIn = e.size_in || (e.magnitude ? e.magnitude / 100 : 0);
      if (!byDate[date]) byDate[date] = { max: 0, mrmsCount: 0, spcCount: 0, sources: [] };
      if (sizeIn > byDate[date].max) byDate[date].max = sizeIn;
      byDate[date].spcCount++;
      if (!byDate[date].sources.includes('SPC')) byDate[date].sources.push('SPC');
    });

    const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));
    if (!dates.length) {
      feedEl.innerHTML = '<div style="font-size:11px;color:var(--mid);text-align:center;padding:10px;">No hail events found in this area for the selected period.</div>';
      return;
    }
    let html = `<div style="font-size:10px;color:var(--mid);margin-bottom:6px;">${dates.length} storm dates near map center (${days}-day window)</div>`;
    dates.forEach(date => {
      const d = byDate[date];
      const lbl = d.max >= 2.75 ? '🔴 Baseball+' : d.max >= 1.75 ? '🟠 Baseball' : d.max >= 1.0 ? '🟡 Golf Ball' : '🔵 Quarter';
      const sizeColor = d.max >= 2.75 ? '#ef4444' : d.max >= 1.75 ? '#f97316' : d.max >= 1.0 ? '#eab308' : '#3b82f6';
      const subLabel = [
        d.mrmsCount ? `${d.mrmsCount} radar pts` : '',
        d.spcCount ? `${d.spcCount} spotter${d.spcCount > 1 ? 's' : ''}` : ''
      ].filter(Boolean).join(' · ');
      const sourceBadge = d.sources.map(s => `<span style="font-size:9px;background:rgba(255,255,255,0.08);border-radius:3px;padding:1px 4px;color:var(--mid);">${s}</span>`).join(' ');
      html += `<div onclick="loadMrmsForDate('${date}');_onStormDateChange('${date}');document.getElementById('storm-date-sel').value='${date}';" style="display:flex;justify-content:space-between;align-items:center;padding:7px 6px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:5px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--text);">${date}</div>
          <div style="font-size:10px;color:var(--mid);margin-top:1px;">${subLabel}</div>
          <div style="margin-top:2px;">${sourceBadge}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:13px;font-weight:800;color:${sizeColor};">${d.max > 0 ? d.max.toFixed(2)+'"' : '—'}</div>
          <div style="font-size:10px;color:var(--mid);">${lbl.replace(/^[^ ]+ /,'')}</div>
        </div>
      </div>`;
    });
    feedEl.innerHTML = html;
  } catch(e) {
    feedEl.innerHTML = '<div style="font-size:11px;color:#ef4444;text-align:center;padding:10px;">Error loading events. Try again.</div>';
  }
};

// ── STORM PANEL TAB SWITCHER ──────────────────────────────────────────────────
window.switchStormTab = function(tab) {
  const tabs = ['find', 'map', 'work'];
  tabs.forEach(t => {
    const btn = document.getElementById('storm-tab-' + t);
    const pane = document.getElementById('storm-pane-' + t);
    const active = t === tab;
    if (btn) {
      btn.style.borderBottomColor = active ? '#6366F1' : 'transparent';
      btn.style.color = active ? '#6366F1' : 'var(--mid)';
    }
    if (pane) pane.style.display = active ? 'block' : 'none';
  });
  // Auto-load events when switching to Find tab
  if (tab === 'find') {
    const feedEl = document.getElementById('hail-events-feed');
    if (feedEl && feedEl.querySelector && feedEl.querySelector('.no-events-loaded')) {
      loadHailEventsFeed();
    }
  }
};
