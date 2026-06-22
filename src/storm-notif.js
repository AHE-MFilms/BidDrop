// src/storm-notif.js
// Storm push notification feature — toggle, permission, NOAA polling, test.
// Depends on: S (state), currentAccount, toast(), loadStormEvents(), loadWindEvents()
// Extracted as a standalone module — Tier 4 modularization

// ── State ──────────────────────────────────────────────────────────────────────
let _stormNotifEnabled = false;
let _stormNotifInterval = null;
const STORM_NOTIF_POLL_MS = 30 * 60 * 1000; // 30 minutes
const STORM_NOTIF_STORAGE_KEY = 'bd_storm_notif';

// ── Init (called on app load) ──────────────────────────────────────────────────
function initStormNotifications() {
  try {
    const raw = localStorage.getItem(STORM_NOTIF_STORAGE_KEY);
    if (!raw) return;
    const st = JSON.parse(raw);
    if (st.enabled) {
      _stormNotifEnabled = true;
      _syncStormNotifUI();
      _scheduleStormPoll();
    }
    // Restore checkboxes
    const hailCb = document.getElementById('storm-notif-hail');
    const windCb = document.getElementById('storm-notif-wind');
    if (hailCb && st.hail !== undefined) hailCb.checked = st.hail;
    if (windCb && st.wind !== undefined) windCb.checked = st.wind;
  } catch(e) {}
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
async function toggleStormNotifications() {
  if (_stormNotifEnabled) {
    // Turn off
    _stormNotifEnabled = false;
    _clearStormPoll();
    _saveStormNotifState();
    _syncStormNotifUI();
    toast('Storm notifications disabled', 'info');
    return;
  }
  // Request permission
  if (!('Notification' in window)) {
    toast('Push notifications are not supported in this browser', 'warning');
    return;
  }
  const permWarning = document.getElementById('storm-notif-permission-warning');
  const successMsg = document.getElementById('storm-notif-success-msg');
  if (Notification.permission === 'denied') {
    if (permWarning) permWarning.style.display = 'block';
    if (successMsg) successMsg.style.display = 'none';
    return;
  }
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    if (permWarning) permWarning.style.display = 'block';
    if (successMsg) successMsg.style.display = 'none';
    toast('Notification permission denied', 'warning');
    return;
  }
  if (permWarning) permWarning.style.display = 'none';
  // Turn on
  _stormNotifEnabled = true;
  _saveStormNotifState();
  _syncStormNotifUI();
  _scheduleStormPoll();
  if (successMsg) successMsg.style.display = 'block';
  toast('Storm alerts enabled! You\'ll be notified when new storms hit your territory.', 'success');
  // Run an immediate check
  _checkForNewStorms();
}

// ── UI Sync ────────────────────────────────────────────────────────────────────
function _syncStormNotifUI() {
  const track = document.getElementById('storm-notif-toggle-track');
  const thumb = document.getElementById('storm-notif-toggle-thumb');
  const lbl = document.getElementById('storm-notif-toggle-lbl');
  const badge = document.getElementById('storm-notif-status-badge');
  const successMsg = document.getElementById('storm-notif-success-msg');
  if (!track) return;
  if (_stormNotifEnabled) {
    track.style.background = '#3b82f6';
    thumb.style.left = '21px';
    thumb.style.background = '#fff';
    if (lbl) { lbl.textContent = 'ON'; lbl.style.color = '#60a5fa'; }
    if (badge) { badge.textContent = '● Active'; badge.className = 'int-status connected'; }
    if (successMsg) successMsg.style.display = 'block';
  } else {
    track.style.background = '#374151';
    thumb.style.left = '3px';
    thumb.style.background = '#9ca3af';
    if (lbl) { lbl.textContent = 'OFF'; lbl.style.color = 'var(--muted)'; }
    if (badge) { badge.textContent = '● Off'; badge.className = 'int-status not-connected'; }
    if (successMsg) successMsg.style.display = 'none';
  }
}

// ── Persistence ────────────────────────────────────────────────────────────────
function _saveStormNotifState() {
  try {
    const hailCb = document.getElementById('storm-notif-hail');
    const windCb = document.getElementById('storm-notif-wind');
    localStorage.setItem(STORM_NOTIF_STORAGE_KEY, JSON.stringify({
      enabled: _stormNotifEnabled,
      hail: hailCb ? hailCb.checked : true,
      wind: windCb ? windCb.checked : true
    }));
  } catch(e) {}
}

// ── Polling ────────────────────────────────────────────────────────────────────
function _scheduleStormPoll() {
  _clearStormPoll();
  _stormNotifInterval = setInterval(_checkForNewStorms, STORM_NOTIF_POLL_MS);
}
function _clearStormPoll() {
  if (_stormNotifInterval) { clearInterval(_stormNotifInterval); _stormNotifInterval = null; }
}

// ── Storm Check ────────────────────────────────────────────────────────────────
async function _checkForNewStorms() {
  if (!_stormNotifEnabled) return;
  if (Notification.permission !== 'granted') return;
  const hailEnabled = (document.getElementById('storm-notif-hail')||{}).checked !== false;
  const windEnabled = (document.getElementById('storm-notif-wind')||{}).checked !== false;
  // Get territory bounds from canvass zones or pins
  const bounds = _getStormTerritoryBounds();
  // Fetch today's and yesterday's NOAA data
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dates = [today, yesterday].map(d => {
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yy}${mm}${dd}`;
  });
  // Track last-seen storm IDs to avoid duplicate notifications
  let seenKey = 'bd_storm_seen';
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(seenKey)||'{}'); } catch(e) {}
  const newStorms = [];
  for (const dateStr of dates) {
    if (hailEnabled) {
      try {
        const url = `https://www.spc.noaa.gov/climo/reports/${dateStr}_rpts_filtered_hail.csv`;
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const lines = text.trim().split('\n');
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 7) continue;
            const size = parseFloat(parts[1]);
            const lat = parseFloat(parts[5]);
            const lon = parseFloat(parts[6]);
            if (isNaN(lat)||isNaN(lon)||isNaN(size)) continue;
            const id = `hail-${dateStr}-${parts[0]}-${lat}-${lon}`;
            if (seen[id]) continue;
            if (bounds && !_pointInBounds(lat, lon, bounds)) continue;
            const location = (parts[2]||'').trim();
            const county = (parts[3]||'').trim();
            const state = (parts[4]||'').trim();
            newStorms.push({ type: 'hail', id, size, lat, lon, location, county, state, date: dateStr });
            seen[id] = Date.now();
          }
        }
      } catch(e) {}
    }
    if (windEnabled) {
      try {
        const url = `https://www.spc.noaa.gov/climo/reports/${dateStr}_rpts_filtered_wind.csv`;
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const lines = text.trim().split('\n');
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts.length < 7) continue;
            const speed = parseInt(parts[1]);
            const lat = parseFloat(parts[5]);
            const lon = parseFloat(parts[6]);
            if (isNaN(lat)||isNaN(lon)||isNaN(speed)) continue;
            const mph = Math.round(speed * 1.15078);
            if (mph < 50) continue;
            const id = `wind-${dateStr}-${parts[0]}-${lat}-${lon}`;
            if (seen[id]) continue;
            if (bounds && !_pointInBounds(lat, lon, bounds)) continue;
            const location = (parts[2]||'').trim();
            const county = (parts[3]||'').trim();
            const state = (parts[4]||'').trim();
            newStorms.push({ type: 'wind', id, mph, lat, lon, location, county, state, date: dateStr });
            seen[id] = Date.now();
          }
        }
      } catch(e) {}
    }
  }
  // Save seen IDs (prune old entries > 7 days)
  const cutoff = Date.now() - 7*24*60*60*1000;
  Object.keys(seen).forEach(k => { if (seen[k] < cutoff) delete seen[k]; });
  try { localStorage.setItem(seenKey, JSON.stringify(seen)); } catch(e) {}
  // Send notifications for new storms (batch up to 3)
  const toNotify = newStorms.slice(0, 3);
  toNotify.forEach(storm => {
    const title = storm.type === 'hail'
      ? `🌨 Hail Alert — ${storm.size}" hail in ${storm.county}, ${storm.state}`
      : `💨 Wind Alert — ${storm.mph} MPH wind in ${storm.county}, ${storm.state}`;
    const body = `New storm detected in your territory. Tap to open BidDrop and review.`;
    try {
      new Notification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: storm.id
      });
    } catch(e) { console.warn('[BidDrop] Notification error:', e); }
  });
  if (newStorms.length > 3) {
    try {
      new Notification(`⛈ ${newStorms.length} new storm events in your territory`, {
        body: 'Open BidDrop to review all storm events.',
        icon: '/icon-192.png',
        tag: 'storm-batch-' + Date.now()
      });
    } catch(e) {}
  }
}

// ── Territory Bounds ───────────────────────────────────────────────────────────
function _getStormTerritoryBounds() {
  // Use canvass zone bounds if available, otherwise use pin bounding box
  const pins = (S && S.pins) ? S.pins.filter(p => !p.deleted_at) : [];
  if (!pins.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  pins.forEach(p => {
    const lat = parseFloat(p.lat||p.latitude);
    const lon = parseFloat(p.lon||p.longitude||p.lng);
    if (isNaN(lat)||isNaN(lon)) return;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  });
  if (minLat === Infinity) return null;
  // Add 0.5 degree buffer (~35 miles)
  return { minLat: minLat - 0.5, maxLat: maxLat + 0.5, minLon: minLon - 0.5, maxLon: maxLon + 0.5 };
}
function _pointInBounds(lat, lon, bounds) {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lon >= bounds.minLon && lon <= bounds.maxLon;
}

// ── Test Notification ──────────────────────────────────────────────────────────
async function testStormNotification() {
  if (!('Notification' in window)) {
    toast('Push notifications are not supported in this browser', 'warning');
    return;
  }
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    const w = document.getElementById('storm-notif-permission-warning');
    if (w) w.style.display = 'block';
    toast('Notification permission denied — please allow in browser settings', 'warning');
    return;
  }
  try {
    new Notification('🌨 Test Storm Alert — BidDrop', {
      body: 'This is a test notification. Real alerts will fire when new storms hit your territory.',
      icon: '/icon-192.png',
      tag: 'biddrop-storm-test'
    });
    toast('Test notification sent!', 'success');
  } catch(e) {
    toast('Could not send test notification: ' + e.message, 'error');
  }
}
