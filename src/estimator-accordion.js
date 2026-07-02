// src/estimator-accordion.js
// Estimator accordion UI, unlock button, and contact lookup helpers.
// Depends on: S, currentEstPinId, isPinUnlocked, requirePinUnlocked,
//             lookupContactInfo, _fillEstimatorContactFields, toast()
// Extracted from modals-tail.html — Priority 1 misplaced-function fix.

/* ═══════════════════════════════════════════════════════
   ESTIMATOR ACCORDION — toggle, summary updaters, dot states
═══════════════════════════════════════════════════════ */
const _ACC_CARDS = ['homeowner','property','trade','output'];

function toggleAccCard(id) {
  const hdr  = document.getElementById('acc-hdr-'  + id);
  const body = document.getElementById('acc-body-' + id);
  if (!hdr || !body) return;
  const isOpen = body.classList.contains('open');
  if (isOpen) {
    hdr.classList.remove('open');
    body.classList.remove('open');
  } else {
    hdr.classList.add('open');
    body.classList.add('open');
  }
}

function accOpenCard(id) {
  const hdr  = document.getElementById('acc-hdr-'  + id);
  const body = document.getElementById('acc-body-' + id);
  if (!hdr || !body) return;
  hdr.classList.add('open');
  body.classList.add('open');
}

function accCloseCard(id) {
  const hdr  = document.getElementById('acc-hdr-'  + id);
  const body = document.getElementById('acc-body-' + id);
  if (!hdr || !body) return;
  hdr.classList.remove('open');
  body.classList.remove('open');
}

function accSetDot(id, state) {
  // state: '' | 'active' | 'done'
  const dot = document.getElementById('acc-dot-' + id);
  if (!dot) return;
  dot.classList.remove('active','done');
  if (state) dot.classList.add(state);
}

function _accUpdateHomeownerSummary() {
  const name  = (document.getElementById('e-owner')?.value  || '').trim();
  const phone = (document.getElementById('e-phone')?.value  || '').trim();
  const email = (document.getElementById('e-email')?.value  || '').trim();
  const el    = document.getElementById('acc-sum-homeowner');
  if (!el) return;
  if (name) {
    el.textContent = name + (phone ? ' · ' + phone : '') + (email ? ' · ' + email : '');
    el.classList.add('filled');
    accSetDot('homeowner', 'done');
  } else {
    el.textContent = 'Name, phone, email';
    el.classList.remove('filled');
    accSetDot('homeowner', 'active');
  }
}

function _accUpdatePropertySummary() {
  const addr = (document.getElementById('e-addr')?.value || '').trim();
  const el   = document.getElementById('acc-sum-property');
  if (!el) return;
  if (addr) {
    el.textContent = addr.length > 40 ? addr.slice(0,38) + '…' : addr;
    el.classList.add('filled');
    accSetDot('property', 'done');
  } else {
    el.textContent = 'Address & measurements';
    el.classList.remove('filled');
    accSetDot('property', '');
  }
}

function _accUpdateTradeSummary(tradeName, total) {
  const el = document.getElementById('acc-sum-trade');
  if (!el) return;
  if (tradeName) {
    el.textContent = tradeName + (total ? ' · ' + total : '');
    el.classList.add('filled');
    accSetDot('trade', 'done');
  } else {
    el.textContent = 'Select trade to build estimate';
    el.classList.remove('filled');
    accSetDot('trade', '');
  }
}

// Call this after a trade is selected to auto-open Card 3
function _accOnTradeSelected(tradeName) {
  _accUpdateTradeSummary(tradeName, null);
  accSetDot('trade', 'active');
  accOpenCard('trade');
}

// Call this whenever the total changes (from calcP / calcTrade*)
function _accOnTotalUpdated(totalStr) {
  const tradeSel = document.querySelector('.trade-btn.active');
  const tradeName = tradeSel ? tradeSel.getAttribute('data-trade') || '' : '';
  _accUpdateTradeSummary(tradeName, totalStr);
}

// Initialise dot states on page load
document.addEventListener('DOMContentLoaded', function() {
  _accUpdateHomeownerSummary();
  _accUpdatePropertySummary();
  accSetDot('homeowner', 'active');
});

// ── ESTIMATOR UNLOCK BUTTON ──────────────────────────────────────────────────
// Shows/hides the Unlock button based on current pin's lock state.
function _estRefreshUnlockUI() {
  const wrap = document.getElementById('est-unlock-wrap');
  const btn  = document.getElementById('est-unlock-btn');
  const status = document.getElementById('est-unlock-status');
  if (!wrap) return;
  if (!currentEstPinId) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  const _pin = (S.pins||[]).find(function(p){ return p.id === currentEstPinId; });
  const unlocked = typeof isPinUnlocked === 'function' && isPinUnlocked(_pin);
  var rcLookupBtn = document.getElementById('rc-lookup-btn');
  if (rcLookupBtn) rcLookupBtn.style.display = unlocked ? '' : 'none';
  if (unlocked) {
    btn.style.display    = 'none';
    status.style.display = 'block';
    if (_pin && _pin.contactData &&
        ((_pin.contactData.phones||[]).length + (_pin.contactData.emails||[]).length) > 0) {
      _fillEstimatorContactFields(_pin.contactData);
    }
    var lookupBtn = document.getElementById('est-contact-lookup-btn');
    if (lookupBtn) {
      var hasData = _pin && _pin.contactData &&
        ((_pin.contactData.phones||[]).length + (_pin.contactData.emails||[]).length) > 0;
      lookupBtn.style.display = hasData ? 'none' : 'block';
    }
  } else {
    btn.style.display    = 'flex';
    status.style.display = 'none';
    var lookupBtn2 = document.getElementById('est-contact-lookup-btn');
    if (lookupBtn2) lookupBtn2.style.display = 'none';
  }
}

// Called when rep clicks "📞 Look Up Phone & Email"
async function estLookupContact() {
  if (!currentEstPinId) { toast('Load a pinned home first', 'warn'); return; }
  var btn = document.querySelector('#est-contact-lookup-btn button');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Looking up…'; }
  try {
    await lookupContactInfo(currentEstPinId, { suppressUnlockCheck: true });
    var wrap = document.getElementById('est-contact-lookup-btn');
    if (wrap) wrap.style.display = 'none';
  } catch(e) {
    toast('Lookup failed: ' + (e && e.message ? e.message.substring(0,80) : 'unknown'), 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '📞 Look Up Phone &amp; Email'; }
  }
}

// Called when rep clicks "🔓 Unlock Pin — 1 Credit"
async function estUnlockPin() {
  if (!currentEstPinId) { toast('Load a pinned home first', 'warn'); return; }
  // Ensure the pin exists in the DB before attempting unlock.
  // If the pin is in memory but not yet persisted (e.g. just dropped or not yet synced),
  // save it now so the server-side unlock handler can find it.
  const pinToSync = (S.pins||[]).find(p => p.id === currentEstPinId);
  if (pinToSync && typeof sbSavePin === 'function') {
    try {
      await sbSavePin(pinToSync);
    } catch(e) {
      console.warn('[estUnlockPin] pin pre-save failed:', e);
    }
  }
  const ok = typeof requirePinUnlocked === 'function'
    ? await requirePinUnlocked(currentEstPinId)
    : true;
  if (!ok) return;
  _estRefreshUnlockUI();
  _accUpdateHomeownerSummary();
  toast('🔓 Pin unlocked — looking up contact info…', 'success');
}
