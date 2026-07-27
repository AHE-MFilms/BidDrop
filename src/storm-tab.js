/**
 * storm-tab.js
 * Bridges the full-screen Storm Events tab (tab-storm) to the existing
 * storm.js / mrms.js / storm-leads.js functions that operate on the map.
 *
 * The map-panel controls (storm-panel) remain functional when the user
 * opens Storm Events from the map toolbar. The full-screen tab syncs
 * toggle states with the map-panel controls.
 */

// ── Tab init ─────────────────────────────────────────────────────────────────
function initStormTab() {
  _syncStormTabToggles();
  // Load storm dates into the date picker on first open
  if (typeof fetchMrmsStormDates === 'function') fetchMrmsStormDates();
}

// ── Draw area + switch to map tab ────────────────────────────────────────────
function stormStartDrawAndGoMap() {
  if (typeof goTab === 'function') goTab('map');
  setTimeout(() => {
    if (typeof stormStartDraw === 'function') stormStartDraw();
  }, 200);
}

// ── Sync toggle states from map-panel → storm tab ────────────────────────────
function _syncStormTabToggles() {
  // Hail toggle
  const hailTrack = document.getElementById('hail-toggle-track');
  const hailTrack2 = document.getElementById('hail-toggle-track2');
  const hailThumb2 = document.getElementById('hail-toggle-thumb2');
  const hailLbl2 = document.getElementById('hail-toggle-lbl2');
  const hailControls2 = document.getElementById('hail-controls2');
  if (hailTrack) {
    const on = hailTrack.style.background === 'rgb(242, 92, 5)' || hailTrack.style.background === '#F25C05';
    if (hailTrack2) hailTrack2.style.background = on ? '#F25C05' : '#374151';
    if (hailThumb2) hailThumb2.style.left = on ? '21px' : '3px';
    if (hailThumb2) hailThumb2.style.background = on ? '#fff' : '#9ca3af';
    if (hailLbl2) hailLbl2.textContent = on ? 'ON' : 'OFF';
    if (hailControls2) hailControls2.style.display = on ? 'block' : 'none';
  }

  // MRMS toggle
  const mrmsTrack = document.getElementById('mrms-toggle-track');
  const mrmsTrack2 = document.getElementById('mrms-toggle-track2');
  const mrmsThumb2 = document.getElementById('mrms-toggle-thumb2');
  const mrmsLbl2 = document.getElementById('mrms-toggle-lbl2');
  if (mrmsTrack) {
    const on = mrmsTrack.style.background === 'rgb(99, 102, 241)' || mrmsTrack.style.background === '#6366F1';
    if (mrmsTrack2) mrmsTrack2.style.background = on ? '#6366F1' : '#374151';
    if (mrmsThumb2) mrmsThumb2.style.left = on ? '21px' : '3px';
    if (mrmsThumb2) mrmsThumb2.style.background = on ? '#fff' : '#9ca3af';
    if (mrmsLbl2) mrmsLbl2.textContent = on ? 'ON' : 'OFF';
  }

  // Wind toggle
  const windTrack = document.getElementById('wind-toggle-track');
  const windTrack2 = document.getElementById('wind-toggle-track2');
  const windThumb2 = document.getElementById('wind-toggle-thumb2');
  const windLbl2 = document.getElementById('wind-toggle-lbl2');
  if (windTrack) {
    const on = windTrack.style.background === 'rgb(52, 211, 153)' || windTrack.style.background === '#34d399';
    if (windTrack2) windTrack2.style.background = on ? '#34d399' : '#374151';
    if (windThumb2) windThumb2.style.left = on ? '21px' : '3px';
    if (windThumb2) windThumb2.style.background = on ? '#fff' : '#9ca3af';
    if (windLbl2) windLbl2.textContent = on ? 'ON' : 'OFF';
  }

  // Sync status messages
  const mrmsStatus = document.getElementById('mrms-status');
  const mrmsStatus2 = document.getElementById('mrms-status2');
  if (mrmsStatus && mrmsStatus2) mrmsStatus2.textContent = mrmsStatus.textContent || '🔍 Zoom into a city on the map to see 1km radar hail swaths';

  const stormStatus = document.getElementById('storm-status');
  const stormStatus2 = document.getElementById('storm-status2');
  if (stormStatus && stormStatus2) stormStatus2.textContent = stormStatus.textContent;

  const windStatus = document.getElementById('wind-status');
  const windStatus2 = document.getElementById('wind-status2');
  if (windStatus && windStatus2) windStatus2.textContent = windStatus.textContent;

  // Sync select values
  const days = document.getElementById('storm-days');
  const days2 = document.getElementById('storm-days2');
  if (days && days2) days2.value = days.value;

  const minSize = document.getElementById('storm-min-size');
  const minSize2 = document.getElementById('storm-min-size2');
  if (minSize && minSize2) minSize2.value = minSize.value;
}

// ── Hail toggle (storm tab) ───────────────────────────────────────────────────
function toggleHailLayerSync() {
  // Toggle on the map panel first
  if (typeof toggleHailLayer === 'function') toggleHailLayer();
  // Then sync the tab UI
  setTimeout(_syncStormTabToggles, 50);
}

// ── MRMS toggle (storm tab) ───────────────────────────────────────────────────
function toggleMrmsLayerSync() {
  if (typeof toggleMrmsLayer === 'function') toggleMrmsLayer();
  setTimeout(_syncStormTabToggles, 50);
  // Mirror status updates after load
  setTimeout(_syncStormTabToggles, 2000);
  setTimeout(_syncStormTabToggles, 5000);
}

// ── Wind toggle (storm tab) ───────────────────────────────────────────────────
function toggleWindLayerSync() {
  if (typeof toggleWindLayer === 'function') toggleWindLayer();
  setTimeout(_syncStormTabToggles, 50);
  setTimeout(_syncStormTabToggles, 2000);
}

// ── Sync select: date range ───────────────────────────────────────────────────
function syncStormDays() {
  const days2 = document.getElementById('storm-days2');
  const days = document.getElementById('storm-days');
  if (days2 && days) {
    days.value = days2.value;
    if (typeof loadStormEvents === 'function') loadStormEvents();
    if (typeof renderMrmsLayer === 'function') renderMrmsLayer(); // also refresh MRMS swath
    if (typeof _saveStormState === 'function') _saveStormState();
  }
}

// ── Sync select: min hail size ────────────────────────────────────────────────
function syncStormMinSize() {
  const size2 = document.getElementById('storm-min-size2');
  const size = document.getElementById('storm-min-size');
  if (size2 && size) {
    size.value = size2.value;
    if (typeof renderStormMarkers === 'function') renderStormMarkers();
    if (typeof renderMrmsLayer === 'function') renderMrmsLayer();
    if (typeof _saveStormState === 'function') _saveStormState();
  }
}

// ── City/ZIP search (storm tab) ───────────────────────────────────────────────
function stormSearchFly2() {
  const inp2 = document.getElementById('storm-search-inp2');
  const status2 = document.getElementById('storm-search-status2');
  if (!inp2) return;
  const val = inp2.value.trim();
  if (!val) return;

  // Mirror to the map-panel input and call the existing function
  const inp = document.getElementById('storm-search-inp');
  if (inp) inp.value = val;

  if (status2) status2.textContent = 'Searching…';

  // Use Nominatim geocoder (same as stormSearchFly in storm.js)
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=us&limit=1`)
    .then(r => r.json())
    .then(results => {
      if (!results || !results.length) {
        if (status2) status2.textContent = '❌ Location not found';
        return;
      }
      const { lat, lon, display_name } = results[0];
      if (status2) status2.textContent = '✓ ' + display_name.split(',').slice(0,2).join(',');
      if (typeof map !== 'undefined' && map) {
        map.setView([parseFloat(lat), parseFloat(lon)], 11);
        // Reload active storm layers
        setTimeout(() => {
          const hailOn = document.getElementById('hail-toggle-track');
          if (hailOn && (hailOn.style.background === '#F25C05' || hailOn.style.background === 'rgb(242, 92, 5)')) {
            if (typeof loadStormEvents === 'function') loadStormEvents();
          }
          const mrmsOn = document.getElementById('mrms-toggle-track');
          if (mrmsOn && (mrmsOn.style.background === '#6366F1' || mrmsOn.style.background === 'rgb(99, 102, 241)')) {
            if (typeof renderMrmsLayer === 'function') renderMrmsLayer();
          }
        }, 400);
      }
      // Switch to map to show the result
      if (typeof goTab === 'function') goTab('map');
    })
    .catch(() => {
      if (status2) status2.textContent = '❌ Search failed';
    });
}

// ── Hail address lookup (storm tab) ──────────────────────────────────────────
function lookupHailAddressSync() {
  const inp2 = document.getElementById('hail-lookup-input2');
  const status2 = document.getElementById('hail-lookup-status2');
  const results2 = document.getElementById('hail-lookup-results2');
  if (!inp2) return;
  const val = inp2.value.trim();
  if (!val) return;

  // Mirror to the map-panel input and call the existing function
  const inp = document.getElementById('hail-lookup-input');
  if (inp) {
    inp.value = val;
    if (typeof lookupHailAddress === 'function') {
      // Temporarily redirect output to the storm tab results div
      const origStatus = document.getElementById('hail-lookup-status');
      const origResults = document.getElementById('hail-lookup-results');

      if (status2) status2.textContent = 'Looking up…';
      if (results2) { results2.style.display = 'none'; results2.innerHTML = ''; }

      lookupHailAddress();

      // Poll for results to appear in the map panel and mirror them
      let polls = 0;
      const poll = setInterval(() => {
        polls++;
        if (origStatus && status2) status2.textContent = origStatus.textContent;
        if (origResults && results2 && origResults.innerHTML) {
          results2.innerHTML = origResults.innerHTML;
          results2.style.display = origResults.style.display;
        }
        if (polls > 20 || (origResults && origResults.innerHTML)) clearInterval(poll);
      }, 300);
    }
  }
}
