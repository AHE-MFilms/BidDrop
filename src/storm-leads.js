// storm-leads.js — Storm Leads: locked pins from hail swath, 1-credit unlock
// Depends on: map (Leaflet), S, adminAPI(), toast(), updateCreditBadge(), clusterGroup

let _slMarkers   = [];   // Leaflet markers for locked/unlocked storm leads
let _slHomes     = [];   // raw homes array from last swath fetch
let _slCampaignId   = null;
let _slCampaignName = null;
let _slLoading   = false;

// ── "Get Addresses in This Area" button ──────────────────────────────────────
window.stormLeadsGetAddresses = async function() {
  if (_slLoading) return;
  const statusEl = document.getElementById('mrms-status');
  const btn = document.getElementById('btn-storm-leads');

  // Always use the current map VIEWPORT for the RentCast query.
  // If MRMS swath data is loaded, we then filter the results client-side
  // to only keep homes whose coordinates fall inside an actual hail cell.
  // This way: zoom to any neighborhood, tap Get Homes, get back only the
  // hail-hit homes in that neighborhood.
  const vBounds = map.getBounds();
  const swLat = vBounds.getSouthWest().lat;
  const swLng = vBounds.getSouthWest().lng;
  const neLat = vBounds.getNorthEast().lat;
  const neLng = vBounds.getNorthEast().lng;

  // Check if viewport overlaps the swath at all (warn if completely outside)
  if (window._mrmsSwathBounds) {
    const sb = window._mrmsSwathBounds;
    const noOverlap = swLat > sb.neLat || neLat < sb.swLat || swLng > sb.neLng || neLng < sb.swLng;
    if (noOverlap) {
      toast('⚠️ Your map view is outside the hail swath. Pan into the colored area and try again.', 'warning');
      return;
    }
  }

  // Derive storm context from MRMS data if available
  const stormDate = window._mrmsLastDate || null;
  const stormCity = window._mrmsLastCity || null;

  _slLoading = true;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading…'; }
  if (statusEl) statusEl.textContent = 'Fetching homes in view…';

  try {
    // Pass viewport bounds + mrmsFilter flag so the API knows to return all homes
    // in the viewport; client will filter to hail cells
    const data = await adminAPI('storm-leads-swath', { swLat, swLng, neLat, neLng, stormDate, stormCity });
    if (data.error) {
      toast('⚠️ ' + data.error, 'error');
      if (statusEl) statusEl.textContent = data.error;
      return;
    }

    let homes = data.homes || [];
    const totalFetched = homes.length;

    // Client-side filter: keep only homes inside an actual MRMS hail cell
    if (window._mrmsCells && window._mrmsCells.length > 0) {
      homes = homes.filter(h => _homeInMrmsCells(h.latitude, h.longitude));
      if (homes.length === 0) {
        toast('No hail-hit homes found in this view. Try panning into the colored swath area.', 'info');
        if (statusEl) statusEl.textContent = `0 of ${totalFetched} homes in view are inside the hail swath.`;
        if (btn) { btn.disabled = false; btn.textContent = '🏠 Get Homes in This Area'; }
        _slLoading = false;
        return;
      }
    }

    _slHomes       = homes;
    _slCampaignId  = data.campaignId;
    _slCampaignName = data.campaignName;

    _renderStormLeadMarkers();

    const locked   = _slHomes.filter(h => !h.unlocked).length;
    const unlocked = _slHomes.filter(h => h.unlocked).length;
    if (statusEl) {
      statusEl.textContent = `${_slHomes.length} hail-hit homes — ${locked} locked · ${unlocked} unlocked`;
    }
    if (btn) { btn.textContent = `🔄 Refresh (${_slHomes.length})`; }

    // Show bulk-unlock bar if there are locked homes
    _renderBulkUnlockBar(locked);
  } catch (e) {
    toast('Storm Leads error: ' + e.message, 'error');
    if (statusEl) statusEl.textContent = 'Error loading homes.';
  } finally {
    _slLoading = false;
    if (btn) btn.disabled = false;
  }
};

// Check if a lat/lng point falls inside any loaded MRMS hail cell.
// NOAA MRMS data is on a 0.01° grid; each cell center ± 0.005° covers the full cell.
// Add a small tolerance (0.002° ≈ 200m) so homes near cell edges are not missed.
function _homeInMrmsCells(lat, lng) {
  if (!window._mrmsCells || !lat || !lng) return true; // no cells loaded = no filter
  const half = 0.005 + 0.002; // 0.005° cell half + 0.002° tolerance
  return window._mrmsCells.some(c => {
    return lat >= (c.lat - half) && lat <= (c.lat + half) &&
           lng >= (c.lng - half) && lng <= (c.lng + half);
  });
}

// ── Clear all storm lead markers ─────────────────────────────────────────────
window.clearStormLeadMarkers = function() {
  if (_slCluster) { try { _slCluster.clearLayers(); map.removeLayer(_slCluster); } catch(e){} _slCluster = null; }
  _slMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  _slMarkers = [];
  _slHomes   = [];
  _slCampaignId  = null;
  _slCampaignName = null;
  const bar = document.getElementById('storm-leads-bulk-bar');
  if (bar) bar.style.display = 'none';
  const btn = document.getElementById('btn-storm-leads');
  if (btn) { btn.disabled = false; btn.textContent = '🏠 Get Homes in This Area'; }
  const statusEl = document.getElementById('mrms-status');
  if (statusEl) statusEl.textContent = '';
};

// ── Render locked/unlocked markers ───────────────────────────────────────────
// Leaflet.markercluster group (created once, reused)
let _slCluster = null;

function _getOrCreateCluster() {
  if (_slCluster) return _slCluster;
  // Use markercluster if available, otherwise fall back to plain layer group
  if (window.L && L.markerClusterGroup) {
    _slCluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        return L.divIcon({
          className: '',
          html: `<div style="width:38px;height:38px;background:#F25C05;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.6);">${count}</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });
  } else {
    _slCluster = L.layerGroup();
  }
  _slCluster.addTo(map);
  return _slCluster;
}

function _renderStormLeadMarkers() {
  // Remove old markers
  _slMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  _slMarkers = [];
  if (_slCluster) { try { _slCluster.clearLayers(); } catch(e){} }

  const cluster = _getOrCreateCluster();

  _slHomes.forEach(home => {
    if (!home.lat || !home.lon) return;
    const icon = home.unlocked ? _unlockedIcon() : _lockedIcon();
    const m = L.marker([home.lat, home.lon], { icon, zIndexOffset: 500 });
    m.bindPopup(_buildPopup(home), { maxWidth: 260 });
    cluster.addLayer(m);
    _slMarkers.push(m);
  });
}

function _lockedIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;background:#F25C05;border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.7);">🔒</div>`,
    iconSize:   [30, 30],
    iconAnchor: [15, 15],
  });
}

function _unlockedIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;background:#22C55E;border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.7);">✅</div>`,
    iconSize:   [30, 30],
    iconAnchor: [15, 15],
  });
}

function _buildPopup(home) {
  const credits = S.cfg.mailerCredits || 0;
  if (home.unlocked) {
    return `
      <div style="font-family:sans-serif;min-width:200px;">
        <div style="font-weight:700;font-size:13px;color:#22C55E;margin-bottom:4px;">✅ Unlocked</div>
        <div style="font-size:12px;color:#fff;margin-bottom:6px;">${escHtml(home.address)}</div>
        ${home.owner ? `<div style="font-size:11px;color:#A8BECE;margin-bottom:4px;">Owner: ${escHtml(home.owner)}</div>` : ''}
        ${home.yearBuilt ? `<div style="font-size:11px;color:#A8BECE;margin-bottom:4px;">Built: ${home.yearBuilt}</div>` : ''}
        ${home.sqft ? `<div style="font-size:11px;color:#A8BECE;margin-bottom:8px;">${home.sqft.toLocaleString()} sq ft</div>` : ''}
        <div style="font-size:10px;color:#6B7280;">Added to: ${escHtml(_slCampaignName||'Storm Campaign')}</div>
      </div>`;
  }
  return `
    <div style="font-family:sans-serif;min-width:210px;">
      <div style="font-weight:700;font-size:13px;color:#F25C05;margin-bottom:4px;">🔒 Storm Lead</div>
      <div style="font-size:12px;color:#9CA3AF;margin-bottom:2px;filter:blur(3px);user-select:none;">████ ██████ ██, ██████</div>
      ${home.yearBuilt ? `<div style="font-size:11px;color:#A8BECE;margin-bottom:2px;">Built: ${home.yearBuilt}</div>` : ''}
      ${home.sqft ? `<div style="font-size:11px;color:#A8BECE;margin-bottom:8px;">${home.sqft.toLocaleString()} sq ft</div>` : ''}
      <div style="font-size:10px;color:#6B7280;margin-bottom:8px;">Campaign: ${escHtml(_slCampaignName||'Storm Campaign')}</div>
      ${credits < 1
        ? `<div style="font-size:11px;color:#EF4444;margin-bottom:6px;">⚠️ No credits remaining</div>
           <button onclick="openCreditsModal()" style="width:100%;background:#3B82F6;color:#fff;border:none;border-radius:6px;padding:7px;font-size:11px;font-weight:700;cursor:pointer;">Buy Credits</button>`
        : `<button onclick="stormLeadsUnlock(${home.lat},${home.lon},${JSON.stringify(home.address)},${JSON.stringify(home.owner||null)},${JSON.stringify(home.yearBuilt||null)})"
             style="width:100%;background:#F25C05;color:#fff;border:none;border-radius:6px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;">
             🔓 Unlock — 1 Credit (${credits} left)
           </button>`
      }
    </div>`;
}

// ── Unlock a single home ─────────────────────────────────────────────────────
window.stormLeadsUnlock = async function(lat, lon, address, owner, yearBuilt) {
  map.closePopup();
  const credits = S.cfg.mailerCredits || 0;
  if (credits < 1) {
    toast('No credits remaining. Buy more credits to unlock homes.', 'error');
    return;
  }

  // Find the MRMS hail data for this cell (best effort)
  const hailSize = window._mrmsLastSize || null;
  const hailDate = window._mrmsLastDate || null;

  try {
    const data = await adminAPI('storm-leads-unlock', {
      lat, lon, address,
      campaignId: _slCampaignId,
      hailSize, hailDate,
    });

    if (data.error === 'insufficient_credits') {
      toast('No credits remaining.', 'error');
      return;
    }
    if (data.error) {
      toast('Unlock failed: ' + data.error, 'error');
      return;
    }

    // Update credit balance
    S.cfg.mailerCredits = data.creditsRemaining;
    if (typeof updateCreditBadge === 'function') updateCreditBadge();

    // Mark home as unlocked in local state
    const home = _slHomes.find(h => h.lat === lat && h.lon === lon);
    if (home) home.unlocked = true;

    // Add to S.pins so it shows in the pin list immediately
    if (data.pin) {
      const pin = Object.assign({}, data.pin, { lng: data.pin.lng || lon });
      S.pins.unshift(pin);
      if (typeof addMarker === 'function') addMarker(pin);
      if (typeof renderPinList === 'function') renderPinList();
      if (typeof save === 'function') save();
    }

    toast(`📍 ${address} unlocked — added to ${_slCampaignName || 'Storm Campaign'}`, 'success');

    // Re-render markers to update the unlocked one
    _renderStormLeadMarkers();
    const locked = _slHomes.filter(h => !h.unlocked).length;
    _renderBulkUnlockBar(locked);
    const statusEl = document.getElementById('mrms-status');
    if (statusEl) {
      const ul = _slHomes.filter(h => h.unlocked).length;
      statusEl.textContent = `${_slHomes.length} homes — ${locked} locked · ${ul} unlocked`;
    }
  } catch (e) {
    toast('Unlock error: ' + e.message, 'error');
  }
};

// ── Bulk unlock bar (two-path: Add to Campaign vs Unlock & Mail All) ──────────
function _renderBulkUnlockBar(lockedCount) {
  let bar = document.getElementById('storm-leads-bulk-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'storm-leads-bulk-bar';
    bar.style.cssText = 'position:absolute;bottom:80px;left:50%;transform:translateX(-50%);z-index:3000;background:var(--panel,#1a2332);border:1px solid var(--border,#2d3748);border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.5);white-space:nowrap;';
    document.getElementById('the-map').parentElement.appendChild(bar);
  }
  if (lockedCount === 0) {
    bar.style.display = 'none';
    return;
  }
  const credits = S.cfg.mailerCredits || 0;
  bar.style.display = 'flex';
  bar.innerHTML = `
    <div style="font-size:12px;color:var(--text,#fff);">
      <strong style="color:#F25C05;">${lockedCount}</strong> homes found
    </div>
    <button onclick="stormLeadsShowChoiceModal()" style="background:#F25C05;color:#fff;border:none;border-radius:7px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;">
      📋 Work This Area
    </button>
    <button onclick="clearStormLeadMarkers()" style="background:none;border:1px solid var(--border,#2d3748);color:var(--mid,#9ca3af);border-radius:7px;padding:6px 10px;font-size:11px;cursor:pointer;">Clear</button>
  `;
}

// ── Two-path choice modal ─────────────────────────────────────────────────────
window.stormLeadsShowChoiceModal = function() {
  const lockedCount = _slHomes.filter(h => !h.unlocked).length;
  const credits = S.cfg.mailerCredits || 0;
  const canAffordAll = credits >= lockedCount;

  // Remove existing modal if any
  const existing = document.getElementById('sl-choice-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sl-choice-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:#1a2332;border:1px solid #2d3748;border-radius:14px;padding:28px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.6);">
      <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:6px;">How do you want to work this area?</div>
      <div style="font-size:13px;color:#9CA3AF;margin-bottom:24px;">${lockedCount} homes found in this storm area</div>

      <!-- Option 1: Add to Campaign -->
      <div onclick="stormLeadsAddToCampaign()" style="cursor:pointer;border:2px solid #2d3748;border-radius:10px;padding:16px;margin-bottom:12px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='#F25C05'" onmouseout="this.style.borderColor='#2d3748'">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:22px;">📋</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;">Add to Campaign</div>
            <div style="font-size:11px;color:#22C55E;font-weight:600;">0 credits now</div>
          </div>
        </div>
        <div style="font-size:12px;color:#9CA3AF;line-height:1.5;">Save all ${lockedCount} addresses to a campaign. Work through them in the field — unlock and mail each one individually as you confirm it needs a roof. Pay only for what you send.</div>
      </div>

      <!-- Option 2: Unlock & Mail All -->
      <div onclick="${canAffordAll ? 'stormLeadsUnlockAll()' : 'openCreditsModal()'}" style="cursor:pointer;border:2px solid #2d3748;border-radius:10px;padding:16px;margin-bottom:20px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='#3B82F6'" onmouseout="this.style.borderColor='#2d3748'">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:22px;">🚀</span>
          <div>
            <div style="font-size:14px;font-weight:700;color:#fff;">Unlock & Mail All</div>
            <div style="font-size:11px;color:${canAffordAll ? '#F25C05' : '#EF4444'};font-weight:600;">${lockedCount} credits${canAffordAll ? ` (${credits - lockedCount} remaining)` : ` needed — you have ${credits}`}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#9CA3AF;line-height:1.5;">Unlock all ${lockedCount} addresses now and queue them for mailing automatically. Best for volume campaigns where the satellite data is enough signal.</div>
        ${!canAffordAll ? '<div style="font-size:11px;color:#EF4444;margin-top:6px;font-weight:600;">⚠️ Not enough credits — click to buy more</div>' : ''}
      </div>

      <button onclick="document.getElementById('sl-choice-modal').remove()" style="width:100%;background:none;border:1px solid #2d3748;color:#9CA3AF;border-radius:8px;padding:10px;font-size:13px;cursor:pointer;">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);
  // Close on backdrop click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
};

// ── Bulk unlock all locked homes (up to credit balance) ──────────────────────
// ── Add to Campaign — Step 2: name + notes setup modal ───────────────────────
window.stormLeadsAddToCampaign = function() {
  // Close the choice modal
  const choiceModal = document.getElementById('sl-choice-modal');
  if (choiceModal) choiceModal.remove();

  const lockedCount = _slHomes.filter(h => !h.unlocked).length;
  const defaultName = _slCampaignName || 'Storm Campaign';

  const existing = document.getElementById('sl-campaign-setup-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sl-campaign-setup-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:#1a2332;border:1px solid #2d3748;border-radius:16px;padding:28px;max-width:460px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.7);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
        <div style="width:44px;height:44px;background:rgba(242,92,5,0.15);border:1px solid rgba(242,92,5,0.4);border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">📋</div>
        <div>
          <div style="font-size:17px;font-weight:800;color:#fff;line-height:1.2;">Set Up Your Campaign</div>
          <div style="font-size:12px;color:#9CA3AF;margin-top:2px;">${lockedCount} homes · 0 credits now · pay per unlock</div>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;">Campaign Name</label>
        <input id="sl-camp-name-input" type="text" value="${defaultName.replace(/"/g, '&quot;')}" maxlength="80"
          style="width:100%;box-sizing:border-box;background:#0f1923;border:1.5px solid #374151;border-radius:9px;padding:11px 14px;color:#fff;font-size:14px;font-family:inherit;outline:none;"
          onfocus="this.style.borderColor='#F25C05'" onblur="this.style.borderColor='#374151'" />
      </div>

      <div style="margin-bottom:22px;">
        <label style="display:block;font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.6px;margin-bottom:7px;">Notes <span style="font-weight:400;text-transform:none;opacity:.7;">(optional)</span></label>
        <textarea id="sl-camp-notes-input" rows="2" maxlength="200" placeholder="e.g. Focus on older roofs, skip north side…"
          style="width:100%;box-sizing:border-box;background:#0f1923;border:1.5px solid #374151;border-radius:9px;padding:11px 14px;color:#fff;font-size:13px;font-family:inherit;outline:none;resize:none;"
          onfocus="this.style.borderColor='#F25C05'" onblur="this.style.borderColor='#374151'"></textarea>
      </div>

      <div style="background:#0f1923;border:1px solid #1e2d40;border-radius:11px;padding:14px 18px;margin-bottom:22px;display:flex;gap:0;">
        <div style="flex:1;text-align:center;border-right:1px solid #1e2d40;padding-right:16px;">
          <div style="font-size:26px;font-weight:800;color:#F25C05;line-height:1;">${lockedCount}</div>
          <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Homes Saved</div>
        </div>
        <div style="flex:1;text-align:center;border-right:1px solid #1e2d40;padding:0 16px;">
          <div style="font-size:26px;font-weight:800;color:#22C55E;line-height:1;">0</div>
          <div style="font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Credits Used</div>
        </div>
        <div style="flex:2;padding-left:16px;display:flex;align-items:center;">
          <div style="font-size:12px;color:#9CA3AF;line-height:1.5;">Tap any pin on the map to unlock &amp; mail when you confirm it needs a roof.</div>
        </div>
      </div>

      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('sl-campaign-setup-modal').remove()" style="flex:1;background:none;border:1.5px solid #374151;color:#9CA3AF;border-radius:9px;padding:12px;font-size:13px;cursor:pointer;">Cancel</button>
        <button id="sl-camp-save-btn" onclick="stormLeadsSaveCampaign()" style="flex:2;background:#F25C05;border:none;border-radius:9px;padding:12px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;">Save Campaign →</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    const inp = document.getElementById('sl-camp-name-input');
    if (inp) { inp.focus(); inp.select(); }
  }, 80);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
};

// ── Save Campaign: optionally rename, then navigate to Campaigns tab ──────────
window.stormLeadsSaveCampaign = async function() {
  const nameInput = document.getElementById('sl-camp-name-input');
  const notesInput = document.getElementById('sl-camp-notes-input');
  const saveBtn = document.getElementById('sl-camp-save-btn');
  const newName = (nameInput ? nameInput.value.trim() : '') || _slCampaignName || 'Storm Campaign';
  const notes = notesInput ? notesInput.value.trim() : '';

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  // Persist name/notes change to the DB (best-effort)
  if (_slCampaignId) {
    const updates = {};
    if (newName !== _slCampaignName) updates.source_address = newName;
    if (notes) updates.notes = notes;
    if (Object.keys(updates).length > 0) {
      try {
        await adminAPI('campaign-update', { campaignId: _slCampaignId, updates });
        if (updates.source_address) _slCampaignName = newName;
      } catch(e) { /* non-fatal */ }
    }
  }

  const setupModal = document.getElementById('sl-campaign-setup-modal');
  if (setupModal) setupModal.remove();

  const lockedCount = _slHomes.filter(h => !h.unlocked).length;
  _renderStormLeadMarkers();
  toast(`📋 ${lockedCount} homes saved to "${_slCampaignName}" — tap any pin to unlock when ready`, 'success');

  // Navigate to Campaigns tab and highlight the new campaign
  setTimeout(() => {
    if (typeof goTab === 'function') {
      goTab('campaigns');
      setTimeout(() => {
        if (typeof loadCampaignsTab === 'function') loadCampaignsTab();
        setTimeout(() => {
          const list = document.getElementById('campaigns-list');
          if (list) {
            list.scrollTop = 0;
            const first = list.firstElementChild;
            if (first) {
              first.style.transition = 'background 0.3s';
              first.style.background = 'rgba(242,92,5,0.14)';
              setTimeout(() => { first.style.background = ''; }, 2500);
            }
          }
        }, 500);
      }, 300);
    }
  }, 900);
};

window.stormLeadsUnlockAll = async function() {
  const modal = document.getElementById('sl-choice-modal');
  if (modal) modal.remove();
  const locked = _slHomes.filter(h => !h.unlocked);
  const credits = S.cfg.mailerCredits || 0;
  if (credits < 1) { toast('No credits remaining.', 'error'); return; }
  const toUnlock = locked.slice(0, credits);
  if (toUnlock.length === 0) { toast('No locked homes to unlock.', 'info'); return; }

  const confirmed = confirm(`Unlock ${toUnlock.length} homes for ${toUnlock.length} credit${toUnlock.length !== 1 ? 's' : ''}?\n\nYou have ${credits} credits. ${credits - toUnlock.length} will remain.`);
  if (!confirmed) return;

  const bar = document.getElementById('storm-leads-bulk-bar');
  if (bar) bar.innerHTML = `<div style="font-size:12px;color:var(--text,#fff);">⏳ Unlocking ${toUnlock.length} homes…</div>`;

  let successCount = 0;
  for (const home of toUnlock) {
    try {
      const data = await adminAPI('storm-leads-unlock', {
        lat: home.lat, lon: home.lon, address: home.address,
        campaignId: _slCampaignId,
        hailSize: window._mrmsLastSize || null,
        hailDate: window._mrmsLastDate || null,
      });
      if (data.ok) {
        home.unlocked = true;
        S.cfg.mailerCredits = data.creditsRemaining;
        if (data.pin) {
          const pin = Object.assign({}, data.pin, { lng: data.pin.lng || home.lon });
          S.pins.unshift(pin);
          if (typeof addMarker === 'function') addMarker(pin);
        }
        successCount++;
      }
    } catch(e) { /* continue */ }
  }

  if (typeof updateCreditBadge === 'function') updateCreditBadge();
  if (typeof renderPinList === 'function') renderPinList();
  if (typeof save === 'function') save();

  toast(`✅ ${successCount} homes unlocked and added to ${_slCampaignName || 'Storm Campaign'}`, 'success');
  _renderStormLeadMarkers();
  const remaining = _slHomes.filter(h => !h.unlocked).length;
  _renderBulkUnlockBar(remaining);
  const statusEl = document.getElementById('mrms-status');
  if (statusEl) {
    const ul = _slHomes.filter(h => h.unlocked).length;
    statusEl.textContent = `${_slHomes.length} homes — ${remaining} locked · ${ul} unlocked`;
  }
};

// ── Expose last MRMS context so unlock popup can show hail details ────────────
// Called by mrms.js when data loads
window._mrmsLastDate = null;
window._mrmsLastSize = null;
window._mrmsLastCity = null;

// ── Tap-a-cell: Get Homes Near Here ──────────────────────────────────────────
// Called from the MRMS cell popup button. Queries a ~1-mile radius around the
// cell center, then filters to homes inside actual MRMS hail cells.
window.stormGetHomesNearCell = async function(cellLat, cellLng) {
  if (_slLoading) return;
  map.closePopup();

  const statusEl = document.getElementById('mrms-status');
  const stormDate = window._mrmsLastDate || null;
  const stormCity = window._mrmsLastCity || null;

  _slLoading = true;
  if (statusEl) statusEl.textContent = 'Fetching homes near this cell…';

  try {
    // Use a 1-mile radius around the tapped cell center
    const radiusMi = 1.0;
    // Convert radius to bounding box for the API (1 mile ≈ 0.0145 degrees)
    const delta = radiusMi * 0.0145;
    const swLat = cellLat - delta;
    const swLng = cellLng - delta;
    const neLat = cellLat + delta;
    const neLng = cellLng + delta;

    const data = await adminAPI('storm-leads-swath', { swLat, swLng, neLat, neLng, stormDate, stormCity });
    if (data.error) { toast('⚠️ ' + data.error, 'error'); return; }

    let homes = data.homes || [];

    // Filter to homes inside actual MRMS hail cells
    if (window._mrmsCells && window._mrmsCells.length > 0) {
      homes = homes.filter(h => _homeInMrmsCells(h.latitude, h.longitude));
    }

    if (homes.length === 0) {
      toast('No hail-hit homes found near this cell. The cell may be in a rural or non-residential area.', 'info');
      if (statusEl) statusEl.textContent = 'No residential homes found near this cell.';
      return;
    }

    // Append to existing homes (don't replace — user may tap multiple cells)
    const existingAddrs = new Set(_slHomes.map(h => h.address));
    const newHomes = homes.filter(h => !existingAddrs.has(h.address));
    _slHomes = _slHomes.concat(newHomes);
    _slCampaignId  = data.campaignId;
    _slCampaignName = data.campaignName;

    _renderStormLeadMarkers();

    const locked   = _slHomes.filter(h => !h.unlocked).length;
    const unlocked = _slHomes.filter(h => h.unlocked).length;
    if (statusEl) statusEl.textContent = `${_slHomes.length} hail-hit homes — ${locked} locked · ${unlocked} unlocked`;
    toast(`🏠 ${newHomes.length} new hail-hit homes added (${_slHomes.length} total)`, 'success');
    _renderBulkUnlockBar(locked);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    if (statusEl) statusEl.textContent = 'Error loading homes.';
  } finally {
    _slLoading = false;
  }
};

// ── Draw Area: rectangle draw tool ───────────────────────────────────────────
let _slDrawRect = null;   // active Leaflet.draw rectangle handler
let _slDrawLayer = null;  // the drawn rectangle layer

window.stormStartDraw = function() {
  const btn = document.getElementById('btn-storm-draw');
  const hint = document.getElementById('storm-draw-hint');

  // Cancel if already drawing
  if (_slDrawRect) {
    _slDrawRect.disable();
    _slDrawRect = null;
    if (btn) { btn.textContent = '✏️ Draw Area to Get Homes'; btn.style.background = '#6366F1'; }
    if (hint) hint.style.display = 'none';
    return;
  }

  // Remove previous drawn rectangle
  if (_slDrawLayer) { try { map.removeLayer(_slDrawLayer); } catch(e){} _slDrawLayer = null; }

  // Close storm panel so the map is fully visible for drawing
  closeStormPanel();

  if (btn) { btn.textContent = '⏹ Cancel Draw'; btn.style.background = '#EF4444'; }
  if (hint) hint.style.display = 'block';

  // Start Leaflet.draw rectangle
  _slDrawRect = new L.Draw.Rectangle(map, {
    shapeOptions: {
      color: '#6366F1',
      fillColor: '#6366F1',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '6,4',
    },
  });
  _slDrawRect.enable();

  // Listen for draw:created once
  map.once('draw:created', async function(e) {
    _slDrawLayer = e.layer;
    _slDrawLayer.addTo(map);
    _slDrawRect = null;
    // Set a cooldown so the mouseup that completed the rectangle doesn't
    // immediately trigger onMapClick and open the Pin This Home modal
    window._slDrawCooldown = true;
    setTimeout(() => { window._slDrawCooldown = false; }, 1500);
    if (btn) { btn.textContent = '✏️ Draw Area to Get Homes'; btn.style.background = '#6366F1'; }
    if (hint) hint.style.display = 'none';

    const bounds = e.layer.getBounds();
    const swLat = bounds.getSouthWest().lat;
    const swLng = bounds.getSouthWest().lng;
    const neLat = bounds.getNorthEast().lat;
    const neLng = bounds.getNorthEast().lng;

    await _stormFetchInBounds(swLat, swLng, neLat, neLng);

    // Remove the drawn rectangle after fetching
    setTimeout(() => {
      if (_slDrawLayer) { try { map.removeLayer(_slDrawLayer); } catch(e){} _slDrawLayer = null; }
    }, 2000);
  });

  // If user cancels draw
  map.once('draw:drawstop', function() {
    _slDrawRect = null;
    if (btn) { btn.textContent = '✏️ Draw Area to Get Homes'; btn.style.background = '#6366F1'; }
    if (hint) hint.style.display = 'none';
  });
};

// Shared fetch-and-filter logic for both draw-area and viewport queries
async function _stormFetchInBounds(swLat, swLng, neLat, neLng) {
  if (_slLoading) return;
  const statusEl = document.getElementById('mrms-status');
  const stormDate = window._mrmsLastDate || null;
  const stormCity = window._mrmsLastCity || null;

  _slLoading = true;
  if (statusEl) statusEl.textContent = 'Fetching homes in drawn area…';

  try {
    const data = await adminAPI('storm-leads-swath', { swLat, swLng, neLat, neLng, stormDate, stormCity });
    if (data.error) { toast('⚠️ ' + data.error, 'error'); return; }

    let homes = data.homes || [];
    const totalFetched = homes.length;

    // Filter to homes inside actual MRMS hail cells
    if (window._mrmsCells && window._mrmsCells.length > 0) {
      homes = homes.filter(h => _homeInMrmsCells(h.latitude, h.longitude));
    }

    if (homes.length === 0) {
      toast(`No hail-hit homes found in drawn area (${totalFetched} homes checked, none inside hail cells).`, 'info');
      if (statusEl) statusEl.textContent = `0 of ${totalFetched} homes in drawn area are inside the hail swath.`;
      return;
    }

    // Append to existing (deduplicate)
    const existingAddrs = new Set(_slHomes.map(h => h.address));
    const newHomes = homes.filter(h => !existingAddrs.has(h.address));
    _slHomes = _slHomes.concat(newHomes);
    _slCampaignId  = data.campaignId;
    _slCampaignName = data.campaignName;

    _renderStormLeadMarkers();

    const locked   = _slHomes.filter(h => !h.unlocked).length;
    const unlocked = _slHomes.filter(h => h.unlocked).length;
    if (statusEl) statusEl.textContent = `${_slHomes.length} hail-hit homes — ${locked} locked · ${unlocked} unlocked`;
    toast(`🏠 ${newHomes.length} hail-hit homes found (${_slHomes.length} total)`, 'success');
    _renderBulkUnlockBar(locked);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    if (statusEl) statusEl.textContent = 'Error loading homes.';
  } finally {
    _slLoading = false;
  }
}
