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

// Grid cell half-size in degrees (~0.5km at CONUS latitudes)
const CELL_HALF = 0.0005;

/**
 * Called by toggleHailLayer() in storm.js after the existing SPC toggle.
 * Loads MRMS data if not already loaded, then renders.
 */
window.loadMrmsLayer = async function() {
  _mrmsVisible = true;
  if (!_mrmsLoaded) {
    await fetchMrmsData();
  } else {
    renderMrmsLayer();
  }
};

/**
 * Called when hail layer is turned off.
 */
window.clearMrmsLayer = function() {
  _mrmsVisible = false;
  _mrmsLayers.forEach(l => { try { map.removeLayer(l); } catch(e){} });
  _mrmsLayers = [];
};

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

const MRMS_MIN_ZOOM = 8; // county level — below this, 1km cells are sub-pixel

async function fetchMrmsData() {
  const statusEl = document.getElementById('storm-status');

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
  const statusEl = document.getElementById('storm-status');
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
