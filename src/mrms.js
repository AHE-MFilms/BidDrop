// mrms.js
// NOAA MRMS (Multi-Radar Multi-Sensor) hail layer for BidDrop.
// Fetches radar-grade hail grid cells from /api/mrms-hail and renders them
// as colored rectangles on the Leaflet map.
//
// NEW: Date-picker-first approach.
//   1. fetchMrmsStormDates()  — loads distinct storm dates into the picker
//   2. loadMrmsForDate(date)  — loads MRMS swath for a specific date, flies map to it
//   3. toggleMrmsLayer()      — legacy toggle (still works from map panel)

let _mrmsLayers   = [];       // Leaflet rectangle layers
let _mrmsData     = [];       // raw fetched rows — full cached dataset
let _mrmsLoaded   = false;    // whether data has been fetched for current settings
let _mrmsVisible  = false;    // whether the MRMS layer is currently shown
let _mrmsFetchBounds = null;  // the large bbox used for the last fetch
let _mrmsLastDays    = null;  // days param used for last fetch
let _mrmsLastMinSize = null;  // minSize param used for last fetch
let _mrmsFetching    = false; // prevent concurrent fetches
let _mrmsActiveDate  = null;  // the specific date currently loaded (null = "all recent")

// Grid cell half-size in degrees (~1km at CONUS latitudes)
const CELL_HALF = 0.005;
const CELL_GRID = 0.01;

// ── Storm Date Picker ─────────────────────────────────────────────────────────

/**
 * Fetch distinct storm dates and populate the storm date picker selects.
 * Called when the Storm tab opens.
 */
window.fetchMrmsStormDates = async function() {
  const statusIds = ['storm-date-status', 'storm-date-status2'];
  const selectIds = ['storm-date-sel', 'storm-date-sel2'];

  statusIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = 'Loading storm dates…';
  });

  try {
    const resp = await fetch('/api/mrms-storm-dates?days=90');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const dates = await resp.json();

    if (!dates || dates.length === 0) {
      statusIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'No storm data in the last 90 days.';
      });
      return;
    }

    // Build option HTML
    const optionsHtml = dates.map(d => {
      const dateObj = new Date(d.date + 'T12:00:00Z');
      const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      const sizeColor = d.maxSize >= 2.0 ? '#EF4444' : d.maxSize >= 1.5 ? '#F97316' : d.maxSize >= 1.0 ? '#F59E0B' : '#FBBF24';
      return `<option value="${d.date}" data-size="${d.maxSize}" data-label="${d.label}" data-cells="${d.cellCount}">${label} — ${d.label} ${d.maxSize.toFixed(2)}"</option>`;
    }).join('');

    selectIds.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">— Pick a storm date —</option>' + optionsHtml;
    });

    statusIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${dates.length} storm event${dates.length !== 1 ? 's' : ''} in the last 90 days`;
    });

  } catch(e) {
    console.warn('[MRMS] fetchMrmsStormDates error:', e.message);
    statusIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = 'Could not load storm dates.';
    });
  }
};

/**
 * Load the MRMS swath for a specific date and fly the map to it.
 * Called when the user picks a date from the storm date picker.
 */
window.loadMrmsForDate = async function(date) {
  if (!date) {
    // User cleared the picker — clear the swath
    clearMrmsLayerOnly();
    _mrmsActiveDate = null;
    _mrmsVisible = false;
    _updateMrmsToggleUI(false);
    ['storm-date-status','storm-date-status2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    return;
  }

  _mrmsActiveDate = date;
  _mrmsVisible = true;
  _updateMrmsToggleUI(true);

  const statusIds = ['storm-date-status', 'storm-date-status2', 'mrms-status', 'mrms-status2'];
  statusIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = `Loading ${date} swath…`;
  });

  // Sync both selects to the chosen date
  ['storm-date-sel','storm-date-sel2'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && sel.value !== date) sel.value = date;
  });

    // Fetch CONUS-wide cells for the exact date using the new exactDate param
  // This avoids the row-cap issue that cut off older dates
  const fetchParams = new URLSearchParams({
    swLat: '20', swLng: '-130', neLat: '55', neLng: '-60',
    exactDate: date,
    minSize: '0.5',
  });
  try {
    if (_mrmsFetching) return;
    _mrmsFetching = true;
    const resp = await fetch(`/api/mrms-hail?${fetchParams.toString()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const allData = await resp.json();
    // All rows are already for this exact date — no client-side filter needed
    _mrmsData = Array.isArray(allData) ? allData : [];
    _mrmsLoaded = true;
    _mrmsFetchBounds = { swLat: 20, swLng: -130, neLat: 55, neLng: -60 };
    _mrmsLastDays = 1; // single-date fetch

    if (_mrmsData.length === 0) {
      statusIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = `No hail data found for ${date}.`;
      });
      return;
    }

    renderMrmsLayerFromData();

    // Find the geographic center of the swath
    const lats = _mrmsData.map(r => parseFloat(r.lat));
    const lons = _mrmsData.map(r => parseFloat(r.lon));
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

    // Show cell count with a View on Map button — no external geocode call (CSP blocked)
    const regionMsg = `${_mrmsData.length.toLocaleString()} hail cells loaded`;
    ['storm-date-status','storm-date-status2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `${regionMsg} &nbsp;<button onclick="_mrmsFlyCenterAndGoMap(${centerLat.toFixed(4)},${centerLon.toFixed(4)})" style="background:#6366f1;color:#fff;border:none;border-radius:5px;padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;">\ud83d\uddfa\ufe0f View Swath</button> &nbsp;<span style="font-size:10px;color:var(--mid);">or search your city above</span>`;
    });

    // Don't auto-fly — rep may be working a different city

  } catch(e) {
    console.warn('[MRMS] loadMrmsForDate error:', e.message);
    statusIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `Failed to load swath for ${date}.`;
    });
  } finally {
    _mrmsFetching = false;
  }
};

// ── Fly to swath center helper ───────────────────────────────────────────────
window._mrmsFlyCenterAndGoMap = function(lat, lon) {
  try { map.setView([lat, lon], 9); } catch(e) {}
  if (typeof goTab === 'function') goTab('map');
};

// ── Legacy toggle (map panel) ─────────────────────────────────────────────────

window.toggleMrmsLayer = function() {
  _mrmsVisible = !_mrmsVisible;
  _updateMrmsToggleUI(_mrmsVisible);
  if (_mrmsVisible) {
    _mrmsLoaded = false;
    if (_mrmsActiveDate) {
      loadMrmsForDate(_mrmsActiveDate);
    } else {
      fetchMrmsData();
    }
  } else {
    clearMrmsLayerOnly();
    const statusEl = document.getElementById('mrms-status');
    if (statusEl) statusEl.textContent = '🔍 Zoom into a city to see 1km radar hail swaths';
  }
};

function _updateMrmsToggleUI(on) {
  const pairs = [
    ['mrms-toggle-track', 'mrms-toggle-thumb', 'mrms-toggle-lbl'],
    ['mrms-toggle-track2', 'mrms-toggle-thumb2', 'mrms-toggle-lbl2'],
  ];
  pairs.forEach(([trackId, thumbId, lblId]) => {
    const track = document.getElementById(trackId);
    const thumb = document.getElementById(thumbId);
    const lbl   = document.getElementById(lblId);
    if (track) track.style.background = on ? '#6366f1' : '#374151';
    if (thumb) { thumb.style.background = on ? '#fff' : '#9ca3af'; thumb.style.left = on ? '19px' : '3px'; }
    if (lbl)   lbl.textContent = on ? 'ON' : 'OFF';
  });
}

window.loadMrmsLayer = async function() {};
window.clearMrmsLayer = function() {};

window.renderMrmsLayer = function() {
  if (!_mrmsVisible) return;
  _mrmsLoaded = false;
  clearMrmsLayerOnly();
  if (_mrmsActiveDate) {
    loadMrmsForDate(_mrmsActiveDate);
  } else {
    fetchMrmsData();
  }
};

function clearMrmsLayerOnly() {
  _mrmsLayers.forEach(l => { try { map.removeLayer(l); } catch(e){} });
  _mrmsLayers = [];
}

const MRMS_MIN_ZOOM = 6;

async function fetchMrmsData() {
  const statusEl = document.getElementById('mrms-status');
  if (_mrmsFetching) return;

  let currentZoom = 0;
  try { currentZoom = map.getZoom(); } catch(e) {}
  if (currentZoom < MRMS_MIN_ZOOM) {
    clearMrmsLayerOnly();
    if (statusEl) statusEl.textContent = '🔍 Zoom in to a city to see MRMS radar hail swaths';
    return;
  }

  const daysEl = document.getElementById('storm-days') || document.getElementById('storm-days2');
  const sizeEl = document.getElementById('storm-min-size') || document.getElementById('storm-min-size2');
  const days    = parseInt(daysEl?.value || '90') || 90;
  const minSize = parseFloat(sizeEl?.value || '0.75') || 0.75;

  let center;
  try { center = map.getCenter(); } catch(e) {
    if (statusEl) statusEl.textContent = 'Map not ready.';
    return;
  }

  const FETCH_PAD = 5.0;
  const needRefetch = !_mrmsFetchBounds
    || days !== _mrmsLastDays
    || minSize !== _mrmsLastMinSize
    || center.lat < _mrmsFetchBounds.swLat + 1.0
    || center.lat > _mrmsFetchBounds.neLat - 1.0
    || center.lng < _mrmsFetchBounds.swLng + 1.0
    || center.lng > _mrmsFetchBounds.neLng - 1.0;

  if (!needRefetch && _mrmsLoaded) {
    renderMrmsLayerFromData();
    return;
  }

  if (statusEl) statusEl.textContent = 'Loading MRMS radar data…';
  _mrmsFetching = true;

  const fetchBounds = {
    swLat: center.lat - FETCH_PAD,
    swLng: center.lng - FETCH_PAD,
    neLat: center.lat + FETCH_PAD,
    neLng: center.lng + FETCH_PAD,
  };

  const params = new URLSearchParams({
    swLat:   fetchBounds.swLat.toFixed(4),
    swLng:   fetchBounds.swLng.toFixed(4),
    neLat:   fetchBounds.neLat.toFixed(4),
    neLng:   fetchBounds.neLng.toFixed(4),
    days:    String(days),
    minSize: String(minSize),
  });

  try {
    const resp = await fetch(`/api/mrms-hail?${params.toString()}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.warn('[MRMS] API error:', resp.status, err);
      if (statusEl) {
        statusEl.textContent = resp.status === 404 || resp.status === 400
          ? 'MRMS data not yet available — runs nightly.'
          : `MRMS error ${resp.status}`;
      }
      return;
    }
    _mrmsData = await resp.json();
    _mrmsLoaded = true;
    _mrmsFetchBounds = fetchBounds;
    _mrmsLastDays = days;
    _mrmsLastMinSize = minSize;
    renderMrmsLayerFromData();
  } catch(e) {
    console.warn('[MRMS] Fetch failed:', e.message);
    if (statusEl) statusEl.textContent = 'MRMS data unavailable.';
  } finally {
    _mrmsFetching = false;
  }
}

// Simple convex hull (gift wrapping) for a set of [lat,lon] points
function _convexHull(points) {
  if (points.length < 3) return points;
  // Find leftmost point
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[start][1]) start = i;
  }
  const hull = [];
  let current = start;
  do {
    hull.push(points[current]);
    let next = (current + 1) % points.length;
    for (let i = 0; i < points.length; i++) {
      // Cross product to find most counter-clockwise point
      const cross = (points[next][0] - points[current][0]) * (points[i][1] - points[current][1])
                  - (points[next][1] - points[current][1]) * (points[i][0] - points[current][0]);
      if (cross < 0) next = i;
    }
    current = next;
  } while (current !== start && hull.length <= points.length);
  return hull;
}

function renderMrmsLayerFromData() {
  clearMrmsLayerOnly();
  const statusEl = document.getElementById('mrms-status');
  const statusEl2 = document.getElementById('mrms-status2');
  const minSize = parseFloat(document.getElementById('storm-min-size')?.value || '0.5') || 0.5;

  const filtered = _mrmsData.filter(r => parseFloat(r.hail_size_in) >= minSize);

  if (filtered.length === 0) {
    const msg = 'No MRMS hail data for this area/period.';
    if (statusEl) statusEl.textContent = msg;
    if (statusEl2) statusEl2.textContent = msg;
    return;
  }

  // ── Heatmap layer (visible at any zoom, like SwathIQ) ────────────────────
  // Intensity is normalized: 0.75" = 0.1, 1.0" = 0.3, 1.5" = 0.6, 2.0"+ = 1.0
  try {
    const maxHailSize = Math.max(...filtered.map(r => parseFloat(r.hail_size_in)));
    const heatPoints = filtered.map(r => {
      const size = parseFloat(r.hail_size_in);
      // Normalize intensity: penny=0.1, quarter=0.35, golf ball=0.65, baseball+=1.0
      const intensity = Math.min(1.0, Math.max(0.05, (size - 0.5) / 2.0));
      return [parseFloat(r.lat), parseFloat(r.lon), intensity];
    });

    // Leaflet.heat with warm color gradient (yellow → orange → red)
    const heatLayer = L.heatLayer(heatPoints, {
      radius: 18,
      blur: 20,
      maxZoom: 12,
      max: 1.0,
      minOpacity: 0.35,
      gradient: {
        0.0: '#ffffb2',
        0.2: '#fecc5c',
        0.4: '#fd8d3c',
        0.65: '#f03b20',
        1.0: '#bd0026',
      },
    });
    heatLayer.addTo(map);
    _mrmsLayers.push(heatLayer);

    // Add a pulsing center marker showing max hail size
    const lats = filtered.map(r => parseFloat(r.lat));
    const lons = filtered.map(r => parseFloat(r.lon));
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const { label: maxLabel } = hailColor(maxHailSize);
    const centerIcon = L.divIcon({
      className: '',
      html: `<div style="background:#bd0026;color:#fff;border-radius:50%;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;text-align:center;line-height:1.3;border:3px solid #fff;box-shadow:0 0 0 3px #bd0026,0 2px 10px rgba(0,0,0,.5);">🧊<br>${maxHailSize.toFixed(1)}&quot;</div><style>@keyframes mrms-pulse{0%,100%{box-shadow:0 0 0 3px #bd0026,0 2px 10px rgba(0,0,0,.5)}50%{box-shadow:0 0 0 10px rgba(189,0,38,.25),0 2px 10px rgba(0,0,0,.5)}}</style>`,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });
    const centerMarker = L.marker([centerLat, centerLon], { icon: centerIcon, zIndexOffset: 1000 });
    centerMarker.bindPopup(`<div style="font-family:sans-serif;">
      <b>🧊 Storm Center</b><br>
      Max hail: ${maxHailSize.toFixed(2)}&quot; (${maxLabel})<br>
      ${filtered.length.toLocaleString()} radar cells<br>
      <small style="color:#d1d5db">${_mrmsActiveDate || ''}</small>
    </div>`);
    centerMarker.addTo(map);
    _mrmsLayers.push(centerMarker);
  } catch(e) {
    console.warn('[MRMS] Heatmap error:', e.message);
  }

  // ── Individual 1km cell rectangles at zoom 11+ (precision view) ──────────
  let currentZoom = 8;
  try { currentZoom = map.getZoom(); } catch(e) {}
  const showCells = currentZoom >= 11;

  // Toggle cell visibility on zoom
  if (!map._mrmsZoomListener) {
    map._mrmsZoomListener = true;
    map.on('zoomend', () => {
      const z = map.getZoom();
      _mrmsLayers.forEach(l => {
        if (l._isMrmsCellRect) {
          try { l.setStyle({ fillOpacity: z >= 11 ? 0.6 : 0 }); } catch(e){}
        }
      });
    });
  }

  filtered.forEach(r => {
    const lat  = parseFloat(r.lat);
    const lon  = parseFloat(r.lon);
    const size = parseFloat(r.hail_size_in);
    const date = r.event_date;

    const { color, label } = hailColor(size);

    const bounds = [
      [lat - CELL_HALF, lon - CELL_HALF],
      [lat + CELL_HALF, lon + CELL_HALF],
    ];

    const rect = L.rectangle(bounds, {
      color:       color,
      fillColor:   color,
      weight:      0,
      fillOpacity: showCells ? 0.6 : 0,
    });
    rect._isMrmsCellRect = true;

    const popupHtml = `
      <div style="font-family:sans-serif;min-width:210px;">
        <div style="font-weight:700;font-size:14px;color:#fff;margin-bottom:6px;">🧊 MRMS Radar Hail</div>
        <div style="font-size:13px;color:#fff;margin-bottom:3px;"><b>Size:</b> ${size.toFixed(2)}" (${label})</div>
        <div style="font-size:13px;color:#fff;margin-bottom:3px;"><b>Date:</b> ${date}</div>
        <div style="font-size:11px;color:#d1d5db;background:rgba(255,255,255,.08);border-radius:4px;padding:5px 8px;margin-bottom:8px;">
          📡 Radar-estimated hail size. 1km grid cell from NOAA MRMS MESH.
        </div>
        <button onclick="stormGetHomesNearCell(${lat},${lon})"
          style="width:100%;background:#F25C05;color:#fff;border:none;border-radius:6px;padding:9px;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:6px;">
          🏠 Get Homes Near Here
        </button>
        <button onclick="stormDropPin(${lat},${lon},encodeURIComponent('${lat.toFixed(3)}, ${lon.toFixed(3)}'))"
          style="width:100%;background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:6px;padding:7px;font-weight:600;font-size:12px;cursor:pointer;">
          📍 Drop Pin Here
        </button>
      </div>
    `;

    rect.bindPopup(popupHtml);
    rect.addTo(map);
    _mrmsLayers.push(rect);
  });

  // Track last MRMS context for storm-leads.js
  if (filtered.length > 0) {
    const mostRecent = filtered.reduce((a, b) => a.event_date > b.event_date ? a : b);
    window._mrmsLastDate = mostRecent.event_date;
    window._mrmsLastSize = parseFloat(mostRecent.hail_size_in);
    try {
      const c = map.getCenter();
      window._mrmsLastCity = `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
    } catch(e) {}

    const lats = filtered.map(r => parseFloat(r.lat));
    const lons = filtered.map(r => parseFloat(r.lon));
    window._mrmsSwathBounds = {
      swLat: Math.min(...lats) - CELL_HALF,
      swLng: Math.min(...lons) - CELL_HALF,
      neLat: Math.max(...lats) + CELL_HALF,
      neLng: Math.max(...lons) + CELL_HALF,
    };
    window._mrmsCells = filtered.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } else {
    window._mrmsSwathBounds = null;
    window._mrmsCells = [];
  }

  const msg = `${filtered.length.toLocaleString()} MRMS radar cells shown`;
  if (statusEl) statusEl.textContent = msg;
  if (statusEl2) statusEl2.textContent = msg;

  // Also update date status elements
  const dateStatus = document.getElementById('storm-date-status');
  const dateStatus2 = document.getElementById('storm-date-status2');
  if (dateStatus && _mrmsActiveDate) dateStatus.textContent = `${filtered.length.toLocaleString()} hail cells loaded — draw a box inside the red to get homes`;
  if (dateStatus2 && _mrmsActiveDate) dateStatus2.textContent = `${filtered.length.toLocaleString()} hail cells loaded — draw a box inside the red to get homes`;
}

function hailColor(sizeIn) {
  if (sizeIn >= 2.00) return { color: '#EF4444', label: 'Baseball+' };
  if (sizeIn >= 1.50) return { color: '#F97316', label: 'Golf Ball' };
  if (sizeIn >= 1.00) return { color: '#F59E0B', label: 'Quarter'   };
  if (sizeIn >= 0.75) return { color: '#FBBF24', label: 'Penny'     };
  return                     { color: '#FEF08A', label: 'Dime'      };
}

// ── Address-level hail history lookup ──────────────────────────────────────
window.lookupHailAddress = async function() {
  const input   = document.getElementById('hail-lookup-input');
  const statusEl = document.getElementById('hail-lookup-status');
  const resultsEl = document.getElementById('hail-lookup-results');
  const address = (input?.value || '').trim();
  if (!address) {
    if (statusEl) statusEl.textContent = 'Enter an address above.';
    return;
  }
  if (statusEl) statusEl.textContent = '🔍 Looking up hail history…';
  if (resultsEl) resultsEl.style.display = 'none';

  try {
    const params = new URLSearchParams({ address, days: '1825', minSize: '0.5' });
    const resp = await fetch(`/api/mrms-address-lookup?${params}`);
    const data = await resp.json();
    if (!resp.ok) {
      if (statusEl) statusEl.textContent = data.error || 'Lookup failed.';
      return;
    }
    if (!data.events || data.events.length === 0) {
      if (statusEl) statusEl.textContent = '✅ No hail ≥ 0.5" detected at this address in the last 5 years.';
      if (resultsEl) resultsEl.style.display = 'none';
      return;
    }
    if (statusEl) statusEl.textContent = '';
    _renderHailLookupResults(data, resultsEl);
    try { map.setView([data.lat, data.lon], Math.max(map.getZoom(), 13)); } catch(e) {}
  } catch(e) {
    if (statusEl) statusEl.textContent = 'Network error. Try again.';
  }
};

function _renderHailLookupResults(data, el) {
  const { address, events } = data;
  const sizeLabel = s => {
    if (s >= 2.00) return { label: 'Baseball+', color: '#EF4444' };
    if (s >= 1.50) return { label: 'Golf Ball', color: '#F97316' };
    if (s >= 1.00) return { label: 'Quarter',   color: '#F59E0B' };
    if (s >= 0.75) return { label: 'Penny',     color: '#FBBF24' };
    return             { label: 'Dime',      color: '#FEF08A' };
  };
  const rows = events.slice(0, 20).map(ev => {
    const { label, color } = sizeLabel(ev.hail_size_in);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text);">${ev.event_date}</div>
        <div style="font-size:10px;color:var(--mid);">${ev.hail_size_in.toFixed(2)}" — ${label}</div>
      </div>
      <span style="font-size:10px;font-weight:700;color:${color};background:rgba(255,255,255,.06);border-radius:4px;padding:2px 6px;">${label}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--text);margin-bottom:6px;">${escHtml(address)}</div>
    <div style="font-size:10px;color:var(--mid);margin-bottom:8px;">${events.length} hail event${events.length !== 1 ? 's' : ''} found</div>
    ${rows}
  `;
  el.style.display = 'block';
}
