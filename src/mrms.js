// src/mrms.js
// NOAA MRMS (Multi-Radar Multi-Sensor) hail layer for BidDrop.
// Fetches radar-grade hail grid cells from /api/mrms-hail and renders them
// as colored rectangles on the Leaflet map — similar to SwathIQ's hail swath view.
//
// Each grid cell is ~1km (0.001° precision). Cells are colored by hail size:
//   ≥ 2.00" (Baseball+) → red
//   ≥ 1.50" (Golf Ball) → orange
//   ≥ 1.00" (Quarter)   → amber
//   ≥ 0.75" (Penny)     → yellow
//   ≥ 0.50" (Dime)      → light yellow
//
// This module is loaded alongside storm.js and integrates with the existing
// storm panel toggles.

let _mrmsLayers = [];       // Leaflet rectangle layers
let _mrmsData   = [];       // raw fetched rows — full cached dataset
let _mrmsLoaded = false;    // whether data has been fetched for current settings
let _mrmsVisible = false;   // whether the MRMS layer is currently shown
let _mrmsFetchBounds = null; // the large bbox used for the last fetch
let _mrmsLastDays = null;    // days param used for last fetch
let _mrmsLastMinSize = null; // minSize param used for last fetch
let _mrmsFetching = false;   // prevent concurrent fetches

// Grid cell half-size in degrees (~1km at CONUS latitudes)
// MRMS data is on a 0.01° grid; use 0.005° half-size so cells tile edge-to-edge
const CELL_HALF = 0.005; // display half-size for map rectangles (0.01° cell → 0.005° half)
const CELL_GRID = 0.01;  // actual NOAA MRMS grid spacing (0.01° ≈ 1km)

/**
 * Called by the MRMS toggle button — independent of SPC hail toggle.
 */
window.toggleMrmsLayer = function() {
  _mrmsVisible = !_mrmsVisible;
  const track = document.getElementById('mrms-toggle-track');
  const thumb = document.getElementById('mrms-toggle-thumb');
  const lbl   = document.getElementById('mrms-toggle-lbl');
  if (_mrmsVisible) {
    if (track) track.style.background = '#6366f1';
    if (thumb) { thumb.style.background = '#fff'; thumb.style.left = '19px'; }
    if (lbl)   lbl.textContent = 'ON';
    _mrmsLoaded = false;
    fetchMrmsData();
  } else {
    if (track) track.style.background = '#374151';
    if (thumb) { thumb.style.background = '#9ca3af'; thumb.style.left = '3px'; }
    if (lbl)   lbl.textContent = 'OFF';
    clearMrmsLayerOnly();
    const statusEl = document.getElementById('mrms-status');
    if (statusEl) statusEl.textContent = '🔍 Zoom into a city to see 1km radar hail swaths';
  }
};

/**
 * Called by toggleHailLayer() in storm.js — kept for backward compat but MRMS
 * is now independent. This is a no-op so SPC toggle doesn’t auto-load MRMS.
 */
window.loadMrmsLayer = async function() {};

/**
 * Called when hail layer is turned off — kept for backward compat.
 */
window.clearMrmsLayer = function() {};

/**
 * Called when storm-days or storm-min-size changes — refetch and re-render.
 */
window.renderMrmsLayer = function() {
  if (!_mrmsVisible) return;
  _mrmsLoaded = false;
  clearMrmsLayerOnly();
  fetchMrmsData();
};

function clearMrmsLayerOnly() {
  _mrmsLayers.forEach(l => { try { map.removeLayer(l); } catch(e){} });
  _mrmsLayers = [];
}

const MRMS_MIN_ZOOM = 6; // state/regional level — cells are ~1km, visible from zoom 6+

async function fetchMrmsData() {
  const statusEl = document.getElementById('mrms-status');
  if (_mrmsFetching) return; // prevent concurrent fetches

  // Gate: only render MRMS when zoomed in enough to see 1km cells
  let currentZoom = 0;
  try { currentZoom = map.getZoom(); } catch(e) {}
  if (currentZoom < MRMS_MIN_ZOOM) {
    clearMrmsLayerOnly();
    if (statusEl) statusEl.textContent = '🔍 Zoom in to a city to see MRMS radar hail swaths';
    return;
  }

  const days    = parseInt(document.getElementById('storm-days')?.value || '30') || 30;
  const minSize = parseFloat(document.getElementById('storm-min-size')?.value || '0.75') || 0.75;

  // Get current map center
  let center;
  try { center = map.getCenter(); } catch(e) {
    if (statusEl) statusEl.textContent = 'Map not ready.';
    return;
  }

  // Use a large fixed bbox (±5° around center) so one fetch covers the whole metro area.
  // Only re-fetch if: settings changed, or user has panned outside the cached bbox.
  const FETCH_PAD = 5.0; // degrees — covers ~550km radius, one fetch per metro
  const needRefetch = !_mrmsFetchBounds
    || days !== _mrmsLastDays
    || minSize !== _mrmsLastMinSize
    || center.lat < _mrmsFetchBounds.swLat + 1.0
    || center.lat > _mrmsFetchBounds.neLat - 1.0
    || center.lng < _mrmsFetchBounds.swLng + 1.0
    || center.lng > _mrmsFetchBounds.neLng - 1.0;

  if (!needRefetch && _mrmsLoaded) {
    // Data is still good — just re-render from cache (no network call)
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

function renderMrmsLayerFromData() {
  clearMrmsLayerOnly();
  const statusEl = document.getElementById('mrms-status');
  const minSize = parseFloat(document.getElementById('storm-min-size')?.value || '0.75') || 0.75;

  const filtered = _mrmsData.filter(r => parseFloat(r.hail_size_in) >= minSize);

  if (filtered.length === 0) {
    if (statusEl) statusEl.textContent = 'No MRMS hail data for this area/period.';
    return;
  }

  filtered.forEach(r => {
    const lat  = parseFloat(r.lat);
    const lon  = parseFloat(r.lon);
    const size = parseFloat(r.hail_size_in);
    const date = r.event_date;

    const { color, label } = hailColor(size);

    // Each grid cell is a ~1km square rectangle
    const bounds = [
      [lat - CELL_HALF, lon - CELL_HALF],
      [lat + CELL_HALF, lon + CELL_HALF],
    ];

    const rect = L.rectangle(bounds, {
      color:       color,
      fillColor:   color,
      weight:      0,
      fillOpacity: 0.55,
    });

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
    // Derive city from map center (best effort)
    try {
      const c = map.getCenter();
      window._mrmsLastCity = `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
    } catch(e) {}

    // Export tight bounding box of the actual swath cells (not full viewport)
    // storm-leads.js uses this to query only homes inside the hail footprint
    const lats = filtered.map(r => parseFloat(r.lat));
    const lons = filtered.map(r => parseFloat(r.lon));
    window._mrmsSwathBounds = {
      swLat: Math.min(...lats) - CELL_HALF,
      swLng: Math.min(...lons) - CELL_HALF,
      neLat: Math.max(...lats) + CELL_HALF,
      neLng: Math.max(...lons) + CELL_HALF,
    };
    // Export individual cell centers so storm-leads can do point-in-cell filtering
    // Each cell is CELL_HALF degrees on each side (~0.5km radius)
    window._mrmsCells = filtered.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } else {
    window._mrmsSwathBounds = null;
    window._mrmsCells = [];
  }

  if (statusEl) {
    statusEl.textContent = `${filtered.length.toLocaleString()} MRMS radar cells shown`;
  }
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
    // Pan map to the address
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
        <div style="font-size:10px;color:var(--mid);">${ev.distance_km} km from address</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;font-weight:700;color:${color};">${ev.hail_size_in.toFixed(2)}"</div>
        <div style="font-size:9px;color:${color};">${label}</div>
      </div>
    </div>`;
  }).join('');
  const more = events.length > 20 ? `<div style="font-size:10px;color:var(--mid);text-align:center;padding-top:6px;">+${events.length - 20} more events</div>` : '';
  el.innerHTML = `
    <div style="font-size:10px;color:var(--mid);margin-bottom:6px;word-break:break-word;">${address?.split(',').slice(0,2).join(',') || 'Address'}</div>
    <div style="font-size:11px;font-weight:700;color:#f59e0b;margin-bottom:6px;">${events.length} hail event${events.length !== 1 ? 's' : ''} found (last 5 yrs)</div>
    ${rows}
    ${more}
    <button onclick="_hailLookupDropPin(${data.lat},${data.lon})"
      style="width:100%;margin-top:8px;background:#F25C05;color:#fff;border:none;border-radius:6px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;">
      📍 Drop Pin at This Address
    </button>
  `;
  el.style.display = 'block';
}

window._hailLookupDropPin = function(lat, lon) {
  try {
    const addr = document.getElementById('hail-lookup-input')?.value || '';
    stormDropPin(lat, lon, encodeURIComponent(addr || `${lat.toFixed(3)}, ${lon.toFixed(3)}`));
  } catch(e) { console.warn('[MRMS] dropPin error:', e); }
};

// ── Pin popup Hail History card ─────────────────────────────────────────────
// Called from the pin popup "⚡ Hail History" button.
window.showPinHailHistory = async function(pid, address, lat, lon) {
  const el = document.getElementById('hail-hist-' + pid);
  if (!el) return;
  // Toggle: if already visible, hide it
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = '<div style="color:#60A5FA;text-align:center;padding:8px;">⚡ Loading hail history…</div>';
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lon), days: '1825', minSize: '0.5' });
    const resp = await fetch('/api/mrms-address-lookup?' + params.toString());
    const data = await resp.json();
    if (!resp.ok) { el.innerHTML = '<div style="color:#EF4444;font-size:10px;">' + (data.error || 'Lookup failed.') + '</div>'; return; }
    if (!data.events || data.events.length === 0) {
      el.innerHTML = '<div style="color:#22C55E;font-size:11px;text-align:center;padding:6px;">✅ No hail ≥ 0.5" detected at this address in the last 5 years.</div>';
      return;
    }
    const sizeLabel = s => {
      if (s >= 2.00) return { label: 'Baseball+', color: '#EF4444' };
      if (s >= 1.50) return { label: 'Golf Ball', color: '#F97316' };
      if (s >= 1.00) return { label: 'Quarter',   color: '#F59E0B' };
      if (s >= 0.75) return { label: 'Penny',     color: '#FBBF24' };
      return             { label: 'Dime',      color: '#FEF08A' };
    };
    const rows = data.events.slice(0, 10).map(ev => {
      const { label, color } = sizeLabel(ev.hail_size_in);
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.07)">'
        + '<div><div style="font-size:11px;font-weight:700;color:#fff;">' + ev.event_date + '</div>'
        + '<div style="font-size:9px;color:#6B7280;">' + ev.distance_km + ' km away</div></div>'
        + '<div style="text-align:right;"><div style="font-size:12px;font-weight:700;color:' + color + ';">' + parseFloat(ev.hail_size_in).toFixed(2) + '"</div>'
        + '<div style="font-size:9px;color:' + color + ';">' + label + '</div></div></div>';
    }).join('');
    const more = data.events.length > 10 ? '<div style="font-size:9px;color:#6B7280;text-align:center;padding-top:4px;">+' + (data.events.length - 10) + ' more events</div>' : '';
    el.innerHTML = '<div style="font-size:10px;font-weight:700;color:#60A5FA;margin-bottom:6px;">⚡ ' + data.events.length + ' hail event' + (data.events.length !== 1 ? 's' : '') + ' — last 5 years</div>' + rows + more;
  } catch(e) {
    el.innerHTML = '<div style="color:#EF4444;font-size:10px;">Network error. Try again.</div>';
  }
};

// On pan/zoom: re-render from cache (no refetch unless we've moved far outside cached area)
let _mrmsDebounce = null;
function onMapMoveForMrms() {
  if (!_mrmsVisible) return;
  clearTimeout(_mrmsDebounce);
  _mrmsDebounce = setTimeout(() => {
    // fetchMrmsData checks if a refetch is needed; if not, just re-renders from cache
    fetchMrmsData();
  }, 400);
}

// Hook into the map's moveend event once the map is ready
function initMrmsMapHook() {
  if (typeof map !== 'undefined' && map) {
    map.on('moveend', onMapMoveForMrms);
  } else {
    setTimeout(initMrmsMapHook, 500);
  }
}
initMrmsMapHook();
