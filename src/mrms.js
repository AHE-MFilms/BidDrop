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
let _mrmsData   = [];       // raw fetched rows
let _mrmsLoaded = false;    // whether data has been fetched for current settings
let _mrmsVisible = false;   // whether the MRMS layer is currently shown

// Grid cell half-size in degrees (~1km at CONUS latitudes)
// MRMS data is on a 0.01° grid; use 0.005° half-size so cells tile edge-to-edge
const CELL_HALF = 0.005;

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

  // Gate: only render MRMS when zoomed in enough to see 1km cells
  let currentZoom = 0;
  try { currentZoom = map.getZoom(); } catch(e) {}
  if (currentZoom < MRMS_MIN_ZOOM) {
    clearMrmsLayerOnly();
    if (statusEl) statusEl.textContent = '🔍 Zoom in to a city to see MRMS radar hail swaths';
    return;
  }

  if (statusEl) statusEl.textContent = 'Loading MRMS radar data…';

  const days    = parseInt(document.getElementById('storm-days')?.value || '30') || 30;
  const minSize = parseFloat(document.getElementById('storm-min-size')?.value || '0.75') || 0.75;

  // Get current map bounds for the bounding box query
  let bounds;
  try {
    bounds = map.getBounds();
  } catch(e) {
    if (statusEl) statusEl.textContent = 'Map not ready.';
    return;
  }

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  // Expand bounds slightly so cells on the edge are included
  const pad = 0.5;
  const params = new URLSearchParams({
    swLat:   (sw.lat - pad).toFixed(4),
    swLng:   (sw.lng - pad).toFixed(4),
    neLat:   (ne.lat + pad).toFixed(4),
    neLng:   (ne.lng + pad).toFixed(4),
    days:    String(days),
    minSize: String(minSize),
  });

  try {
    const resp = await fetch(`/api/mrms-hail?${params.toString()}`);
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.warn('[MRMS] API error:', resp.status, err);
      // Graceful fallback — if table doesn't exist yet, show a friendly message
      if (statusEl) {
        statusEl.textContent = resp.status === 404 || resp.status === 400
          ? 'MRMS data not yet available — runs nightly.'
          : `MRMS error ${resp.status}`;
      }
      return;
    }
    _mrmsData = await resp.json();
    _mrmsLoaded = true;
    renderMrmsLayerFromData();
  } catch(e) {
    console.warn('[MRMS] Fetch failed:', e.message);
    if (statusEl) statusEl.textContent = 'MRMS data unavailable.';
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
      <div style="font-family:sans-serif;min-width:200px;">
        <div style="font-weight:700;font-size:14px;color:#fff;margin-bottom:6px;">🧊 MRMS Radar Hail</div>
        <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Size:</b> ${size.toFixed(2)}" (${label})</div>
        <div style="font-size:14px;color:#fff;margin-bottom:4px;"><b>Date:</b> ${date}</div>
        <div style="font-size:14px;color:#fff;margin-bottom:8px;"><b>Grid:</b> ${lat.toFixed(3)}°, ${lon.toFixed(3)}°</div>
        <div style="font-size:11px;color:#d1d5db;background:rgba(255,255,255,.08);border-radius:4px;padding:6px 8px;margin-bottom:8px;">
          📡 Radar-estimated hail size. 1km grid cell from NOAA MRMS MESH.
        </div>
        <button onclick="stormDropPin(${lat},${lon},encodeURIComponent('${lat.toFixed(3)}, ${lon.toFixed(3)}'))"
          style="width:100%;background:#F25C05;color:#fff;border:none;border-radius:6px;padding:8px;font-weight:700;font-size:12px;cursor:pointer;">
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
  }

  if (statusEl) {
    statusEl.innerHTML = `${filtered.length.toLocaleString()} MRMS radar cells shown
      <br><button id="btn-storm-leads" onclick="stormLeadsGetAddresses()"
        style="margin-top:6px;width:100%;background:#F25C05;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer;">
        🏠 Get Addresses in This Area
      </button>`;
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

// Re-fetch when map is panned/zoomed (debounced) so we always show
// the current viewport's data
let _mrmsDebounce = null;
function onMapMoveForMrms() {
  if (!_mrmsVisible) return;
  clearTimeout(_mrmsDebounce);
  _mrmsDebounce = setTimeout(() => {
    _mrmsLoaded = false;
    fetchMrmsData();
  }, 800);
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
