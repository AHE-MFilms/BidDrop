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

  // Get current map bounds
  const bounds = map.getBounds();
  const swLat = bounds.getSouthWest().lat;
  const swLng = bounds.getSouthWest().lng;
  const neLat = bounds.getNorthEast().lat;
  const neLng = bounds.getNorthEast().lng;

  // Derive storm context from MRMS data if available
  const stormDate = window._mrmsLastDate || null;
  const stormCity = window._mrmsLastCity || null;

  _slLoading = true;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading…'; }
  if (statusEl) statusEl.textContent = 'Fetching homes in this area…';

  try {
    const data = await adminAPI('storm-leads-swath', { swLat, swLng, neLat, neLng, stormDate, stormCity });
    if (data.error) {
      toast('⚠️ ' + data.error, 'error');
      if (statusEl) statusEl.textContent = data.error;
      return;
    }
    _slHomes       = data.homes || [];
    _slCampaignId  = data.campaignId;
    _slCampaignName = data.campaignName;

    _renderStormLeadMarkers();

    const locked   = _slHomes.filter(h => !h.unlocked).length;
    const unlocked = _slHomes.filter(h => h.unlocked).length;
    if (statusEl) {
      statusEl.textContent = `${_slHomes.length} homes found — ${locked} locked · ${unlocked} unlocked`;
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

// ── Clear all storm lead markers ─────────────────────────────────────────────
window.clearStormLeadMarkers = function() {
  _slMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  _slMarkers = [];
  _slHomes   = [];
  _slCampaignId  = null;
  _slCampaignName = null;
  const bar = document.getElementById('storm-leads-bulk-bar');
  if (bar) bar.style.display = 'none';
  const btn = document.getElementById('btn-storm-leads');
  if (btn) { btn.disabled = false; btn.textContent = '🏠 Get Addresses'; }
  const statusEl = document.getElementById('mrms-status');
  if (statusEl) statusEl.textContent = '';
};

// ── Render locked/unlocked markers ───────────────────────────────────────────
function _renderStormLeadMarkers() {
  // Remove old markers
  _slMarkers.forEach(m => { try { map.removeLayer(m); } catch(e){} });
  _slMarkers = [];

  _slHomes.forEach(home => {
    if (!home.lat || !home.lon) return;
    const icon = home.unlocked ? _unlockedIcon() : _lockedIcon();
    const m = L.marker([home.lat, home.lon], { icon, zIndexOffset: 500 });
    m.bindPopup(_buildPopup(home), { maxWidth: 260 });
    m.addTo(map);
    _slMarkers.push(m);
  });
}

function _lockedIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:rgba(242,92,5,0.35);border:2px solid #F25C05;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,.5);">🔒</div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  });
}

function _unlockedIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;background:#22C55E;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,.5);">📍</div>`,
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
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
// ── Add to Campaign (no credits charged) ─────────────────────────────────────
window.stormLeadsAddToCampaign = async function() {
  const modal = document.getElementById('sl-choice-modal');
  if (modal) modal.remove();
  const lockedCount = _slHomes.filter(h => !h.unlocked).length;
  // Campaign already created by storm-leads-swath API — just confirm to user
  toast(`📋 ${lockedCount} homes saved to "${_slCampaignName || 'Storm Campaign'}" — tap any pin to unlock when ready`, 'success');
  // Update popup text to reflect campaign mode
  _renderStormLeadMarkers();
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
