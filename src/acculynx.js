/**
 * BidDrop — AccuLynx CRM Integration
 *
 * Mirrors the GHL integration pattern:
 *  - acculynxPushPin(pinId)  — push a pin as a Job + Contact from the map popup
 *  - sendViaAccuLynx()       — push the current estimate from the estimator tab
 *  - acculynxTestConnection() — test the API key from Settings
 *  - saveAccuLynxKey()        — save the API key from Settings
 *  - updateAccuLynxStatus()   — update the connected/not-connected badge in Settings
 *
 * The API key is stored server-side only (never exposed to the browser).
 * All AccuLynx calls go through /api/admin?action=acculynx-* proxy.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

async function _alRequest(action, body = {}) {
  const token = (await sb.auth.getSession())?.data?.session?.access_token;
  const res = await fetch('/api/admin?action=' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'AccuLynx API error (' + res.status + ')');
  return data;
}

// ── Settings UI ───────────────────────────────────────────────────────────────

function updateAccuLynxStatus() {
  const key = (document.getElementById('s-acculynx-key') || {}).value || '';
  const el = document.getElementById('acculynx-int-status');
  if (!el) return;
  if (key.trim()) {
    el.className = 'int-status connected';
    el.textContent = '● Key Entered';
  } else if (S.cfg.acculynxApiKeySet) {
    el.className = 'int-status connected';
    el.textContent = '● Connected';
  } else {
    el.className = 'int-status not-connected';
    el.textContent = '● Not Connected';
  }
}

async function saveAccuLynxKey() {
  const keyEl = document.getElementById('s-acculynx-key');
  const key = (keyEl || {}).value || '';
  if (!key.trim() && !S.cfg.acculynxApiKeySet) {
    toast('Enter an AccuLynx API key first', 'error'); return;
  }
  try {
    toast('Saving AccuLynx key…', 'info');
    await _alRequest('acculynx-save-key', { apiKey: key.trim() });
    S.cfg.acculynxApiKeySet = !!key.trim();
    if (keyEl) keyEl.value = '';  // clear field after save (key is server-side only)
    updateAccuLynxStatus();
    toast('✅ AccuLynx API key saved', 'success');
  } catch (e) {
    toast('Error saving key: ' + e.message, 'error');
  }
}

async function acculynxTestConnection() {
  const statusEl = document.getElementById('acculynx-test-status');
  if (statusEl) { statusEl.textContent = 'Testing…'; statusEl.style.color = 'var(--muted)'; }
  try {
    const result = await _alRequest('acculynx-test');
    if (statusEl) { statusEl.textContent = '✅ Connected — ' + (result.company || 'AccuLynx'); statusEl.style.color = '#22c55e'; }
    S.cfg.acculynxApiKeySet = true;
    updateAccuLynxStatus();
    toast('✅ AccuLynx connected: ' + (result.company || 'OK'), 'success');
  } catch (e) {
    if (statusEl) { statusEl.textContent = '❌ ' + e.message; statusEl.style.color = '#ef4444'; }
    toast('AccuLynx test failed: ' + e.message, 'error');
  }
}

// ── Push from pin popup ───────────────────────────────────────────────────────

async function acculynxPushPin(pinId) {
  const pin = (S.pins || []).find(p => p.id === pinId);
  if (!pin) { toast('Pin not found', 'error'); return; }
  if (!S.cfg.acculynxApiKeySet) {
    toast('⚠️ AccuLynx not configured — add your API key in Settings → Integrations', 'warn'); return;
  }

  // Show spinner on button
  const btn = document.querySelector('#pc-' + pinId + ' .btn-xs[onclick*="acculynxPushPin"]');
  if (btn) { btn.textContent = '⏳ Syncing…'; btn.disabled = true; }

  try {
    const ownerName = pin.owner || pin.estimate?.owner || 'Homeowner';
    const total = pin.estimate?.total || 0;
    const sqft  = pin.estimate?.structures?.[0]?.sqft || pin.sqft || null;
    const pitch = pin.estimate?.structures?.[0]?.pitch || pin.pitch || null;

    const result = await _alRequest('acculynx-push-pin', {
      pinId:    pin.id,
      owner:    ownerName,
      address:  pin.address,
      phone:    pin.phone || null,
      email:    pin.email || pin.estimate?.email || null,
      total,
      sqft,
      pitch,
      photoUrl: pin.photo_url || null,
      repName:  pin.rep || (currentProfile && currentProfile.name) || null
    });

    // Store AccuLynx job ID on the pin for future reference
    pin.acculynxJobId = result.jobId || null;
    pin.acculynxSyncedAt = new Date().toISOString();
    if (sb && pin.id && !/^p\d+$/.test(pin.id)) {
      sb.from('pins').update({
        acculynx_job_id: pin.acculynxJobId,
        acculynx_synced_at: pin.acculynxSyncedAt
      }).eq('id', pin.id).then(() => {});
    }

    toast('✅ Pushed to AccuLynx' + (result.jobId ? ' (Job #' + result.jobId + ')' : ''), 'success');
    renderPinList();
  } catch (e) {
    console.warn('[AccuLynx] Push failed:', e);
    toast('❌ AccuLynx sync failed: ' + e.message, 'error');
    if (btn) { btn.textContent = '⚠ Retry'; btn.disabled = false; }
    return;
  }

  // Update button to show synced state
  renderPinList();
}

// ── Init: wire button visibility ────────────────────────────────────────────

function initAccuLynx() {
  // Show/hide the AccuLynx button in the estimator tab based on account config
  const btn = document.getElementById('btn-acculynx-est');
  if (btn) btn.style.display = S.cfg.acculynxApiKeySet ? '' : 'none';
}

// ── Push from Estimator tab ───────────────────────────────────────────────────

async function sendViaAccuLynx() {
  if (!S.cfg.acculynxApiKeySet) {
    toast('⚠️ AccuLynx not configured — add your API key in Settings → Integrations', 'warn'); return;
  }
  const _unlocked = await requirePinUnlocked(currentEstPinId);
  if (!_unlocked) return;

  const owner = (document.getElementById('e-owner') || {}).value?.trim() || '';
  const addr  = (document.getElementById('e-addr')  || {}).value?.trim() || '';
  const email = (document.getElementById('e-email') || {}).value?.trim() || '';
  const phone = (document.getElementById('e-phone') || {}).value?.trim() || '';
  const total = calcP();

  if (!addr) { toast('No address — fill in the estimate first', 'error'); return; }

  const _curPin = currentEstPinId ? (S.pins || []).find(p => p.id === currentEstPinId) : null;
  const sqft    = _curPin?.estimate?.structures?.[0]?.sqft || null;
  const pitch   = _curPin?.estimate?.structures?.[0]?.pitch || null;

  toast('Sending to AccuLynx…', 'info');
  try {
    const result = await _alRequest('acculynx-push-pin', {
      pinId:   currentEstPinId || null,
      owner:   owner || 'Homeowner',
      address: addr,
      phone:   phone || null,
      email:   email || null,
      total,
      sqft,
      pitch,
      photoUrl: window._homePhotoData && window._homePhotoData.startsWith('http') ? window._homePhotoData : null,
      repName: (currentProfile && currentProfile.name) || null
    });

    if (_curPin) {
      _curPin.acculynxJobId = result.jobId || null;
      _curPin.acculynxSyncedAt = new Date().toISOString();
      if (sb && _curPin.id && !/^p\d+$/.test(_curPin.id)) {
        sb.from('pins').update({
          acculynx_job_id: _curPin.acculynxJobId,
          acculynx_synced_at: _curPin.acculynxSyncedAt
        }).eq('id', _curPin.id).then(() => {});
      }
    }

    addAct('Synced to AccuLynx: <strong>' + escHtml(owner || 'Homeowner') + '</strong>', 'emailed');
    save();
    toast('✅ Pushed to AccuLynx' + (result.jobId ? ' (Job #' + result.jobId + ')' : ''), 'success');
  } catch (e) {
    console.error('[AccuLynx] sendViaAccuLynx error:', e);
    toast('AccuLynx Error: ' + e.message, 'error');
  }
}
