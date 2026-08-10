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
  const query = (document.getElementById('hail-zip-input').value || '').trim();
  const statusEl = document.getElementById('hail-zip-status');
  const resultsEl = document.getElementById('hail-zip-results');
  if (!query) { statusEl.textContent = 'Enter an address or ZIP code.'; return; }
  statusEl.textContent = '🔍 Looking up ' + query + '…';
  resultsEl.style.display = 'none';
  try {
    // Geocode address/ZIP to lat/lon using Mapbox
    const MB = window._mapboxToken || '';
    const geo = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=us&limit=1&access_token=${MB}`);
    const geoData = await geo.json();
    if (!geoData.features || !geoData.features.length) { statusEl.textContent = '❌ Location not found.'; return; }
    const [lon, lat] = geoData.features[0].center;
    const placeName = geoData.features[0].place_name || query;
    statusEl.textContent = '📡 Fetching storm data for ' + placeName.split(',').slice(0,2).join(',') + '…';

    // Fly map to this location
    if (map) map.flyTo([lat, lon], 10, { duration: 1.2 });

    // Fetch full storm report (same as loadHailEventsFeed but for this specific location)
    const r = await fetch(`/api/storm-report?lat=${lat}&lon=${lon}&days=90`);
    if (!r.ok) throw new Error('API error');
    const data = await r.json();
    const mrms = data.mrms_hail || [];
    const spcHail = data.spc_hail_spotters || [];
    const spcWind = data.spc_wind || [];
    const nwsWarnings = data.nws_warnings || [];

    // Merge all sources by date — same logic as loadHailEventsFeed
    const byDate = {};
    const ensureDate = (date) => {
      if (!byDate[date]) byDate[date] = { maxHail: 0, mrmsCount: 0, spcHailCount: 0, windCount: 0, warningCount: 0, maxWind: 0, sources: [] };
    };
    mrms.forEach(e => {
      ensureDate(e.date);
      if (e.hail_size_in > byDate[e.date].maxHail) byDate[e.date].maxHail = e.hail_size_in;
      byDate[e.date].mrmsCount++;
      if (!byDate[e.date].sources.includes('MRMS')) byDate[e.date].sources.push('MRMS');
    });
    spcHail.forEach(e => {
      const date = e.date || ''; if (!date) return;
      ensureDate(date);
      const sizeIn = e.size_in || (e.magnitude ? e.magnitude / 100 : 0);
      if (sizeIn > byDate[date].maxHail) byDate[date].maxHail = sizeIn;
      byDate[date].spcHailCount++;
      if (!byDate[date].sources.includes('SPC')) byDate[date].sources.push('SPC');
    });
    spcWind.forEach(e => {
      const date = e.date || ''; if (!date) return;
      ensureDate(date);
      byDate[date].windCount++;
      if (e.speed_mph && e.speed_mph > byDate[date].maxWind) byDate[date].maxWind = e.speed_mph;
      if (!byDate[date].sources.includes('Wind')) byDate[date].sources.push('Wind');
    });
    nwsWarnings.forEach(e => {
      const date = (e.onset || '').slice(0, 10); if (!date) return;
      ensureDate(date);
      byDate[date].warningCount++;
      if (!byDate[date].sources.includes('NWS')) byDate[date].sources.push('NWS');
    });

    const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));
    statusEl.textContent = '';

    if (!dates.length) {
      resultsEl.innerHTML = `<div style="font-size:11px;color:var(--mid);padding:8px 0;">No storm events found within 50 miles of this location in the last 90 days.</div>`;
      resultsEl.style.display = 'block';
      return;
    }

    const shortName = placeName.split(',').slice(0,2).join(',');
    const badgeColors = { MRMS: '#6366f1', SPC: '#f97316', Wind: '#22d3ee', NWS: '#ef4444' };

    let html = `<div style="font-size:10px;font-weight:700;color:#a78bfa;margin-bottom:4px;">📍 ${shortName}</div>`;
    html += `<div style="font-size:10px;color:var(--mid);margin-bottom:8px;">${dates.length} storm date${dates.length !== 1 ? 's' : ''} within 50 miles · last 90 days</div>`;

    dates.forEach(date => {
      const d = byDate[date];
      const hasHail = d.maxHail > 0;
      const hailColor = d.maxHail >= 2.75 ? '#ef4444' : d.maxHail >= 1.75 ? '#f97316' : d.maxHail >= 1.0 ? '#eab308' : '#3b82f6';
      const hailLbl = d.maxHail >= 2.75 ? 'Baseball+' : d.maxHail >= 1.75 ? 'Baseball' : d.maxHail >= 1.0 ? 'Golf Ball' : 'Quarter';
      const subParts = [];
      if (d.mrmsCount) subParts.push(`${d.mrmsCount} radar pts`);
      if (d.spcHailCount) subParts.push(`${d.spcHailCount} hail spotter${d.spcHailCount > 1 ? 's' : ''}`);
      if (d.windCount) subParts.push(`${d.windCount} wind${d.maxWind ? ' ' + d.maxWind + 'mph' : ''}`);
      if (d.warningCount) subParts.push(`${d.warningCount} NWS warning${d.warningCount > 1 ? 's' : ''}`);
      const sourceBadge = d.sources.map(s =>
        `<span style="font-size:9px;background:${badgeColors[s] || '#374151'};border-radius:3px;padding:1px 5px;color:#fff;font-weight:700;">${s}</span>`
      ).join(' ');
      html += `<div onclick="loadMrmsForDate('${date}');_onStormDateChange('${date}');document.getElementById('storm-date-sel').value='${date}';switchStormTab('map');"
        style="display:flex;justify-content:space-between;align-items:center;padding:8px 6px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:5px;"
        onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:var(--text);">${date}</div>
          <div style="font-size:10px;color:var(--mid);margin-top:1px;">${subParts.join(' · ')}</div>
          <div style="margin-top:3px;display:flex;gap:3px;flex-wrap:wrap;">${sourceBadge}</div>
        </div>
        <div style="text-align:right;margin-left:8px;flex-shrink:0;">
          ${hasHail
            ? `<div style="font-size:13px;font-weight:800;color:${hailColor};">${d.maxHail.toFixed(2)}"</div><div style="font-size:10px;color:var(--mid);">${hailLbl}</div>`
            : d.maxWind
              ? `<div style="font-size:12px;font-weight:800;color:#22d3ee;">${d.maxWind}mph</div><div style="font-size:10px;color:var(--mid);">Wind</div>`
              : `<div style="font-size:11px;color:var(--mid);">⚠️</div>`}
        </div>
      </div>`;
    });
    html += `<div style="font-size:10px;color:var(--mid);text-align:center;padding:6px 0;">Tap any row to load that storm's hail swath on the map</div>`;
    resultsEl.innerHTML = html;
    resultsEl.style.display = 'block';
  } catch(e) {
    statusEl.textContent = '❌ Error fetching data. Try again.';
    console.error('[lookupHailByZip]', e);
  }
};

// ── HAIL EVENTS FEED ─────────────────────────────────────────────────────────
window.loadHailEventsFeed = async function() {
  const days = parseInt(document.getElementById('hail-events-days')?.value) || 30;
  const feedEl = document.getElementById('hail-events-feed');
  feedEl.innerHTML = '<div style="font-size:11px;color:var(--mid);text-align:center;padding:10px;">⚡ Loading storm events…</div>';
  try {
    const center = map ? map.getCenter() : { lat: 39.5, lng: -98.35 };
    const r = await fetch(`/api/storm-report?lat=${center.lat}&lon=${center.lng}&days=${days}`);
    if (!r.ok) throw new Error('API error');
    const data = await r.json();
    const mrms = data.mrms_hail || [];
    const spcHail = data.spc_hail_spotters || [];
    const spcWind = data.spc_wind || [];
    const nwsWarnings = data.nws_warnings || [];

    // Merge all data sources by date
    const byDate = {};
    const ensureDate = (date) => {
      if (!byDate[date]) byDate[date] = { maxHail: 0, mrmsCount: 0, spcHailCount: 0, windCount: 0, warningCount: 0, maxWind: 0, sources: [] };
    };

    mrms.forEach(e => {
      ensureDate(e.date);
      if (e.hail_size_in > byDate[e.date].maxHail) byDate[e.date].maxHail = e.hail_size_in;
      byDate[e.date].mrmsCount++;
      if (!byDate[e.date].sources.includes('MRMS')) byDate[e.date].sources.push('MRMS');
    });
    spcHail.forEach(e => {
      const date = e.date || '';
      if (!date) return;
      ensureDate(date);
      const sizeIn = e.size_in || (e.magnitude ? e.magnitude / 100 : 0);
      if (sizeIn > byDate[date].maxHail) byDate[date].maxHail = sizeIn;
      byDate[date].spcHailCount++;
      if (!byDate[date].sources.includes('SPC')) byDate[date].sources.push('SPC');
    });
    spcWind.forEach(e => {
      const date = e.date || '';
      if (!date) return;
      ensureDate(date);
      byDate[date].windCount++;
      if (e.speed_mph && e.speed_mph > byDate[date].maxWind) byDate[date].maxWind = e.speed_mph;
      if (!byDate[date].sources.includes('Wind')) byDate[date].sources.push('Wind');
    });
    nwsWarnings.forEach(e => {
      const date = (e.onset || '').slice(0, 10);
      if (!date) return;
      ensureDate(date);
      byDate[date].warningCount++;
      if (!byDate[date].sources.includes('NWS')) byDate[date].sources.push('NWS');
    });

    const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));
    if (!dates.length) {
      feedEl.innerHTML = '<div style="font-size:11px;color:var(--mid);text-align:center;padding:10px;">No storm events found within 50 miles for the selected period.</div>';
      return;
    }

    let html = `<div style="font-size:10px;color:var(--mid);margin-bottom:6px;">${dates.length} storm dates within 50 mi of map center</div>`;
    dates.forEach(date => {
      const d = byDate[date];
      const hasHail = d.maxHail > 0;
      const hailColor = d.maxHail >= 2.75 ? '#ef4444' : d.maxHail >= 1.75 ? '#f97316' : d.maxHail >= 1.0 ? '#eab308' : '#3b82f6';
      const hailLbl = d.maxHail >= 2.75 ? 'Baseball+' : d.maxHail >= 1.75 ? 'Baseball' : d.maxHail >= 1.0 ? 'Golf Ball' : 'Quarter';

      // Build sub-labels
      const subParts = [];
      if (d.mrmsCount) subParts.push(`${d.mrmsCount} radar pts`);
      if (d.spcHailCount) subParts.push(`${d.spcHailCount} hail spotter${d.spcHailCount > 1 ? 's' : ''}`);
      if (d.windCount) subParts.push(`${d.windCount} wind${d.maxWind ? ' ' + d.maxWind + 'mph' : ''}`);
      if (d.warningCount) subParts.push(`${d.warningCount} NWS warning${d.warningCount > 1 ? 's' : ''}`);

      // Source badges
      const badgeColors = { MRMS: '#6366f1', SPC: '#f97316', Wind: '#22d3ee', NWS: '#ef4444' };
      const sourceBadge = d.sources.map(s =>
        `<span style="font-size:9px;background:${badgeColors[s] || '#374151'};border-radius:3px;padding:1px 5px;color:#fff;font-weight:700;">${s}</span>`
      ).join(' ');

      html += `<div onclick="loadMrmsForDate('${date}');_onStormDateChange('${date}');document.getElementById('storm-date-sel').value='${date}';switchStormTab('map');"
        style="display:flex;justify-content:space-between;align-items:center;padding:8px 6px;border-bottom:1px solid var(--border);cursor:pointer;border-radius:5px;"
        onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='none'">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;color:var(--text);">${date}</div>
          <div style="font-size:10px;color:var(--mid);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${subParts.join(' · ')}</div>
          <div style="margin-top:3px;display:flex;gap:3px;flex-wrap:wrap;">${sourceBadge}</div>
        </div>
        <div style="text-align:right;margin-left:8px;flex-shrink:0;">
          ${hasHail ? `<div style="font-size:13px;font-weight:800;color:${hailColor};">${d.maxHail.toFixed(2)}"</div>
          <div style="font-size:10px;color:var(--mid);">${hailLbl}</div>` : d.maxWind ? `<div style="font-size:12px;font-weight:800;color:#22d3ee;">${d.maxWind}mph</div><div style="font-size:10px;color:var(--mid);">Wind</div>` : `<div style="font-size:11px;color:var(--mid);">⚠️</div>`}
        </div>
      </div>`;
    });
    html += `<div style="font-size:10px;color:var(--mid);text-align:center;padding:6px 0;">Tap any row to load that storm's hail swath on the map</div>`;
    feedEl.innerHTML = html;
  } catch(e) {
    feedEl.innerHTML = '<div style="font-size:11px;color:#ef4444;text-align:center;padding:10px;">Error loading events. Try again.</div>';
    console.error('[loadHailEventsFeed]', e);
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

// ── STORM PLAYBACK ────────────────────────────────────────────────────────────
let _playbackFrames = [];
let _playbackIdx = 0;
let _playbackTimer = null;
let _playbackOverlay = null;
let _playbackImages = [];
let _playbackDate = null;

window.toggleStormPlayback = function() {
  const panel = document.getElementById('storm-playback-panel');
  const btn = document.getElementById('btn-storm-playback-toggle');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (btn) btn.textContent = isOpen ? 'Load' : 'Close';
  if (!isOpen) {
    // Auto-read the currently selected storm date from the MAP tab date picker
    const dateSel = document.getElementById('storm-date-sel');
    if (dateSel && dateSel.value) _playbackDate = dateSel.value;
    if (_playbackDate) {
      loadStormPlayback();
    } else {
      const statusEl = document.getElementById('storm-playback-status');
      if (statusEl) statusEl.textContent = '⚠️ Pick a storm date above, then open Playback.';
    }
  }
};

window.loadStormPlayback = async function() {
  const date = _playbackDate;
  if (!date) { alert('Pick a storm date first in the MAP tab.'); return; }
  const hourStart = parseInt(document.getElementById('storm-pb-hour-start')?.value || '0');
  const hourEnd = parseInt(document.getElementById('storm-pb-hour-end')?.value || '23');
  const statusEl = document.getElementById('storm-playback-status');
  const scrubber = document.getElementById('storm-playback-scrubber');
  const timeEl = document.getElementById('storm-playback-time');
  const frameEl = document.getElementById('storm-playback-frame');
  if (statusEl) statusEl.textContent = '⏳ Building frame list…';
  // Stop any active playback
  if (_playbackTimer) { clearInterval(_playbackTimer); _playbackTimer = null; }
  // Remove old tile layer
  if (_playbackOverlay && map) { map.removeLayer(_playbackOverlay); _playbackOverlay = null; }
  // Build frame list from hourStart to hourEnd, every 5 minutes
  // IEM tile URL: https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::USCOMP-N0Q-{YYYYMMDDHHII}/{z}/{x}/{y}.png
  const yyyymmdd = date.replace(/-/g, '');
  const frames = [];
  for (let h = hourStart; h <= hourEnd; h++) {
    for (let m = 0; m < 60; m += 5) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      frames.push({
        yyyymmddhhmm: `${yyyymmdd}${hh}${mm}`,
        label: `${hh}:${mm} UTC`,
        hhmm: `${hh}${mm}`
      });
    }
  }
  _playbackFrames = frames;
  _playbackIdx = 0;
  if (scrubber) { scrubber.max = frames.length - 1; scrubber.value = 0; }
  if (statusEl) statusEl.textContent = `✅ ${frames.length} frames ready · ${date}`;
  if (timeEl) timeEl.textContent = frames[0]?.label || '--:-- UTC';
  if (frameEl) frameEl.textContent = `1 / ${frames.length}`;
  // Show first frame immediately
  _showPlaybackFrame(0);
};

function _showPlaybackFrame(idx) {
  if (!_playbackFrames.length || idx < 0 || idx >= _playbackFrames.length) return;
  _playbackIdx = idx;
  const frame = _playbackFrames[idx];
  // Update UI
  const timeEl = document.getElementById('storm-playback-time');
  const frameEl = document.getElementById('storm-playback-frame');
  const scrubber = document.getElementById('storm-playback-scrubber');
  if (timeEl) timeEl.textContent = frame.label;
  if (frameEl) frameEl.textContent = `${idx + 1} / ${_playbackFrames.length}`;
  if (scrubber) scrubber.value = idx;
  if (typeof L === 'undefined' || !map) return;
  // Build IEM tile URL for this timestamp
  const tileUrl = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::USCOMP-N0Q-${frame.yyyymmddhhmm}/{z}/{x}/{y}.png`;
  if (_playbackOverlay) {
    // Update existing tile layer URL
    _playbackOverlay.setUrl(tileUrl);
  } else {
    _playbackOverlay = L.tileLayer(tileUrl, {
      opacity: 0.75,
      zIndex: 400,
      attribution: 'NEXRAD via IEM',
      tileSize: 256,
      maxZoom: 18
    }).addTo(map);
  }
}

window.scrubStormFrame = function(val) {
  _showPlaybackFrame(parseInt(val));
};

window.stepStormFrame = function(delta) {
  const next = Math.max(0, Math.min(_playbackFrames.length - 1, _playbackIdx + delta));
  _showPlaybackFrame(next);
};

window.toggleStormPlay = function() {
  const btn = document.getElementById('btn-storm-play');
  if (_playbackTimer) {
    clearInterval(_playbackTimer);
    _playbackTimer = null;
    if (btn) btn.textContent = '▶ Play';
  } else {
    const speed = parseInt(document.getElementById('storm-playback-speed')?.value || '200');
    if (btn) btn.textContent = '⏸ Pause';
    _playbackTimer = setInterval(() => {
      const next = (_playbackIdx + 1) % _playbackFrames.length;
      _showPlaybackFrame(next);
      const scrubber = document.getElementById('storm-playback-scrubber');
      if (scrubber) scrubber.value = next;
    }, speed);
  }
};

window.clearStormPlayback = function() {
  if (_playbackTimer) { clearInterval(_playbackTimer); _playbackTimer = null; }
  if (_playbackOverlay && map) { map.removeLayer(_playbackOverlay); _playbackOverlay = null; }
  _playbackFrames = [];
  _playbackIdx = 0;
  const timeEl = document.getElementById('storm-playback-time');
  const frameEl = document.getElementById('storm-playback-frame');
  const scrubber = document.getElementById('storm-playback-scrubber');
  const statusEl = document.getElementById('storm-playback-status');
  const btn = document.getElementById('btn-storm-play');
  if (timeEl) timeEl.textContent = '-- : -- UTC';
  if (frameEl) frameEl.textContent = '0 / 0';
  if (scrubber) { scrubber.max = 0; scrubber.value = 0; }
  if (statusEl) statusEl.textContent = '';
  if (btn) btn.textContent = '▶ Play';
};

// Auto-load playback when storm date changes
const _origOnStormDateChange = window._onStormDateChange;
window._onStormDateChange = function(date) {
  if (_origOnStormDateChange) _origOnStormDateChange(date);
  // If playback panel is open, reload frames for new date
  const panel = document.getElementById('storm-playback-panel');
  if (panel && panel.style.display !== 'none' && date) {
    _playbackDate = date;
    loadStormPlayback();
  }
};

// ── STORM ALERTS ─────────────────────────────────────────────────────────────
window.setStormAlertTerritory = async function() {
  const city = document.getElementById('storm-alert-city').value.trim();
  const statusEl = document.getElementById('storm-alert-territory-status');
  const labelEl = document.getElementById('storm-alert-territory-label');
  if (!city) { statusEl.textContent = 'Enter a city, state or ZIP.'; return; }
  statusEl.textContent = '🔍 Geocoding…';
  try {
    const MB = window._mapboxToken || '';
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city)}.json?country=us&limit=1&access_token=${MB}`);
    const data = await r.json();
    if (!data.features || !data.features.length) { statusEl.textContent = '❌ Location not found.'; return; }
    const [lon, lat] = data.features[0].center;
    const placeName = data.features[0].place_name || city;
    const radius = parseInt(document.getElementById('storm-alert-radius').value) || 50;
    const minSize = parseFloat(document.getElementById('storm-alert-min-size').value) || 1.0;
    const territory = { type: 'radius', lat, lon, miles: radius, label: placeName.split(',').slice(0,2).join(',') };
    // Save to account
    const { error } = await supabase.from('accounts').update({
      storm_territory_json: territory,
      storm_alert_min_size: minSize
    }).eq('id', S.account?.id);
    if (error) throw error;
    if (S.account) { S.account.storm_territory_json = territory; S.account.storm_alert_min_size = minSize; }
    statusEl.textContent = `✅ Territory set: ${territory.label}`;
    statusEl.style.color = '#22c55e';
    if (labelEl) labelEl.textContent = `${territory.label} · ${radius} mi radius · ≥${minSize}"`;
    // Draw territory circle on map
    if (typeof L !== 'undefined' && map) {
      if (window._alertTerritoryCircle) map.removeLayer(window._alertTerritoryCircle);
      window._alertTerritoryCircle = L.circle([lat, lon], {
        radius: radius * 1609.34,
        color: '#34d399', fillColor: '#34d399', fillOpacity: 0.08, weight: 2, dashArray: '6,4'
      }).addTo(map);
      map.flyTo([lat, lon], 9, { duration: 1 });
    }
  } catch(e) {
    statusEl.textContent = '❌ Failed to save territory.';
    statusEl.style.color = '#ef4444';
  }
};

window.toggleStormAlerts = async function() {
  const track = document.getElementById('storm-alert-toggle-track');
  const thumb = document.getElementById('storm-alert-toggle-thumb');
  const lbl = document.getElementById('storm-alert-toggle-lbl');
  const current = S.account?.storm_alert_enabled || false;
  const newVal = !current;
  if (newVal && !S.account?.storm_territory_json) {
    toast('⚠️ Set your territory first', 'warning'); return;
  }
  try {
    const { error } = await supabase.from('accounts').update({ storm_alert_enabled: newVal }).eq('id', S.account?.id);
    if (error) throw error;
    if (S.account) S.account.storm_alert_enabled = newVal;
    if (track) track.style.background = newVal ? '#34d399' : '#374151';
    if (thumb) thumb.style.left = newVal ? '19px' : '3px';
    if (lbl) lbl.textContent = newVal ? 'ON' : 'OFF';
    toast(newVal ? '🔔 Storm alerts enabled!' : '🔕 Storm alerts disabled', newVal ? 'success' : 'info');
  } catch(e) {
    toast('❌ Failed to update alerts', 'error');
  }
};

// Init storm alert UI state from account data
window._initStormAlertUI = function() {
  const account = S.account;
  if (!account) return;
  const track = document.getElementById('storm-alert-toggle-track');
  const thumb = document.getElementById('storm-alert-toggle-thumb');
  const lbl = document.getElementById('storm-alert-toggle-lbl');
  const labelEl = document.getElementById('storm-alert-territory-label');
  const enabled = account.storm_alert_enabled;
  if (track) track.style.background = enabled ? '#34d399' : '#374151';
  if (thumb) thumb.style.left = enabled ? '19px' : '3px';
  if (lbl) lbl.textContent = enabled ? 'ON' : 'OFF';
  const t = account.storm_territory_json;
  if (t && labelEl) {
    const minSize = account.storm_alert_min_size || 1.0;
    labelEl.textContent = `${t.label || 'Custom territory'} · ${t.miles || 50} mi · ≥${minSize}"`;
    const cityInput = document.getElementById('storm-alert-city');
    if (cityInput) cityInput.value = t.label || '';
    const radiusSel = document.getElementById('storm-alert-radius');
    if (radiusSel) radiusSel.value = t.miles || 50;
    const minSel = document.getElementById('storm-alert-min-size');
    if (minSel) minSel.value = minSize;
  }
};

// ── ADDRESS MONITORING ──────────────────────────────────────────────────────

window.initAddressMonitoring = async function() {
  if (!window._currentAccount) return;
  const plan = window._currentAccount.plan;
  const isMonthly = ['monthly', 'omnipresent'].includes(plan);
  const gate = document.getElementById('addr-monitor-gate');
  const ui = document.getElementById('addr-monitor-ui');
  if (!gate || !ui) return;
  if (!isMonthly) {
    gate.style.display = 'block';
    ui.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  ui.style.display = 'block';
  await loadWatchedAddresses();
};

window.loadWatchedAddresses = async function() {
  const listEl = document.getElementById('watched-addresses-list');
  if (!listEl) return;
  if (!window._currentAccount?.id) { listEl.innerHTML = '<div style="color:var(--muted);font-size:10px;text-align:center;padding:8px;">Not logged in</div>'; return; }
  listEl.innerHTML = '<div style="text-align:center;padding:8px;color:var(--muted);font-size:10px;">Loading…</div>';
  try {
    const { data, error } = await window._supabase
      .from('watched_addresses')
      .select('id,address,label,min_hail_size,alert_enabled,last_hail_date,last_hail_size,last_alert_sent_at')
      .eq('account_id', window._currentAccount.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || !data.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:8px;color:var(--muted);font-size:10px;">No addresses being monitored yet.<br>Add an address above to start.</div>';
      return;
    }
    listEl.innerHTML = data.map(wa => {
      const lastHail = wa.last_hail_date ? `<span style="color:#F97316;font-size:9px;">Last hit: ${wa.last_hail_date} (${wa.last_hail_size?.toFixed(2)}")</span>` : '<span style="color:var(--muted);font-size:9px;">No hail detected yet</span>';
      return `<div style="background:rgba(129,140,248,0.07);border:1px solid rgba(129,140,248,0.2);border-radius:7px;padding:8px 10px;margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${wa.label || wa.address.split(',')[0]}</div>
            <div style="font-size:9px;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${wa.address}</div>
            <div style="margin-top:3px;">${lastHail}</div>
          </div>
          <button onclick="removeWatchedAddress('${wa.id}')" title="Remove" style="background:rgba(239,68,68,0.15);border:none;border-radius:5px;color:#ef4444;cursor:pointer;padding:3px 7px;font-size:10px;flex-shrink:0;">✕</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    listEl.innerHTML = `<div style="color:#ef4444;font-size:10px;padding:6px;">Error: ${e.message}</div>`;
  }
};

window.addWatchedAddress = async function() {
  const input = document.getElementById('watch-addr-input');
  const status = document.getElementById('watch-addr-status');
  const addr = input?.value?.trim();
  if (!addr) return;
  if (!window._currentAccount?.id) { if(status) status.textContent = 'Not logged in.'; return; }
  if (status) status.textContent = 'Geocoding address…';
  try {
    // Geocode via Mapbox
    const MAPBOX_TOKEN = window._mapboxToken || '';
    const geoResp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addr)}.json?access_token=${MAPBOX_TOKEN}&limit=1`);
    const geoData = await geoResp.json();
    const feat = geoData.features?.[0];
    if (!feat) { if(status) status.textContent = 'Address not found. Try a more specific address.'; return; }
    const [lon, lat] = feat.center;
    const fullAddr = feat.place_name;
    if (status) status.textContent = 'Adding…';
    const { error } = await window._supabase.from('watched_addresses').insert({
      account_id: window._currentAccount.id,
      address: fullAddr,
      label: addr.length < 40 ? addr : null,
      lat, lon,
      min_hail_size: 1.0,
      alert_enabled: true
    });
    if (error) throw error;
    input.value = '';
    if (status) status.textContent = `✅ Now monitoring: ${fullAddr.split(',')[0]}`;
    setTimeout(() => { if(status) status.textContent = ''; }, 4000);
    await loadWatchedAddresses();
  } catch(e) {
    if (status) status.textContent = `Error: ${e.message}`;
  }
};

window.removeWatchedAddress = async function(id) {
  if (!confirm('Stop monitoring this address?')) return;
  try {
    const { error } = await window._supabase.from('watched_addresses').delete().eq('id', id);
    if (error) throw error;
    await loadWatchedAddresses();
  } catch(e) {
    alert('Error removing address: ' + e.message);
  }
};

// Auto-init when WORK tab is shown
const _origSwitchStormTab = window.switchStormTab;
window.switchStormTab = function(tab) {
  if (_origSwitchStormTab) _origSwitchStormTab(tab);
  if (tab === 'work') setTimeout(() => window.initAddressMonitoring?.(), 100);
};
