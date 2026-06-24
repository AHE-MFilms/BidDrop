/**
 * estimate-reveal.js
 * Estimate Reveal Postcard — personalized postcard flow triggered from
 * the Estimator save button and the Estimates page row actions.
 *
 * Opens m-est-reveal modal, renders a live postcard preview using the
 * Estimate Reveal template (id '1'), and sends via Lob or adds to mail queue.
 */

/* ─── State ─────────────────────────────────────────────────────── */
let _erEstId = null;   // estimate id currently loaded in the modal

/* ─── Open modal ────────────────────────────────────────────────── */
function openEstimateReveal(estId) {
  const est = (S.estimates || []).find(e => e.id === estId);
  if (!est) { toast('Estimate not found', 'error'); return; }
  _erEstId = estId;

  // Populate summary strip
  const ownerEl = document.getElementById('er-owner');
  const addrEl  = document.getElementById('er-addr');
  const totalEl = document.getElementById('er-total');
  const repEl   = document.getElementById('er-rep');
  const noteEl  = document.getElementById('er-note');
  const statusEl = document.getElementById('er-status');

  if (ownerEl) ownerEl.textContent = est.owner || 'Homeowner';
  if (addrEl)  addrEl.textContent  = est.addr  || '—';
  if (totalEl) totalEl.textContent = est.total  ? '$' + Number(est.total).toLocaleString() : '—';
  if (repEl)   repEl.value = est.rep || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : '');
  if (noteEl)  noteEl.value = '';
  if (statusEl) statusEl.textContent = '';

  // Reset delivery to mail
  const mailRadio = document.querySelector('input[name="er-delivery"][value="mail"]');
  if (mailRadio) mailRadio.checked = true;

  // Show modal
  openM('m-est-reveal');

  // Render postcard preview
  _renderErPreview(est);
}

/* ─── Live preview ──────────────────────────────────────────────── */
function _renderErPreview(est) {
  const container = document.getElementById('er-card-preview');
  if (!container) return;

  const cfg = (S && S.cfg) || {};
  const accent  = cfg.tplAccentColor || '#F25C05';
  const phone   = cfg.phone   || '(555) 000-0000';
  const website = cfg.website || 'www.yourcompany.com';
  const logoUrl = cfg.logoData || null;
  const companyName = cfg.companyName || 'Your Company';
  const owner   = est.owner  || 'Homeowner';
  const addr    = est.addr   || '';
  const total   = est.total  ? '$' + Number(est.total).toLocaleString() : 'Your Price';
  const logoScale = cfg.tplLogoScale != null ? cfg.tplLogoScale : 100;

  // Estimate Reveal card front — dark branded card with price reveal
  container.innerHTML = `
    <div style="position:relative;width:100%;height:100%;background:linear-gradient(135deg,#0d0d0d 0%,#1a1a1a 100%);overflow:hidden;font-family:sans-serif;">
      <!-- Accent bar left -->
      <div style="position:absolute;left:0;top:0;width:6px;height:100%;background:${accent};"></div>
      <!-- Logo top-left -->
      <div style="position:absolute;top:16px;left:18px;">
        ${logoUrl
          ? `<img src="${logoUrl}" style="max-height:${Math.round(28 * logoScale / 100)}px;max-width:110px;object-fit:contain;">`
          : `<div style="font-size:11px;font-weight:900;color:${accent};letter-spacing:.5px;">${escHtml(companyName)}</div>`}
      </div>
      <!-- Phone top-right -->
      <div style="position:absolute;top:14px;right:14px;text-align:right;">
        <div style="font-size:11px;font-weight:700;color:#fff;letter-spacing:-.3px;">${escHtml(phone)}</div>
        <div style="font-size:9px;color:rgba(255,255,255,.5);">${escHtml(website)}</div>
      </div>
      <!-- Main content center -->
      <div style="position:absolute;left:18px;right:18px;top:50%;transform:translateY(-52%);">
        <div style="font-size:9px;color:${accent};font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">WE ASSESSED YOUR ROOF</div>
        <div style="font-size:clamp(11px,3vw,15px);font-weight:900;color:#fff;line-height:1.1;text-transform:uppercase;letter-spacing:-.3px;margin-bottom:6px;">
          ${escHtml(owner)},<br>Your Estimate Is Ready.
        </div>
        <div style="font-size:9px;color:rgba(255,255,255,.55);margin-bottom:10px;line-height:1.4;">
          No door-knocking. No pressure. Just your price.
        </div>
        <!-- Price reveal box -->
        <div style="display:inline-block;background:${accent};border-radius:5px;padding:6px 14px;">
          <div style="font-size:8px;color:rgba(255,255,255,.8);letter-spacing:1px;text-transform:uppercase;">Your Estimate</div>
          <div style="font-size:clamp(16px,4vw,22px);font-weight:900;color:#fff;letter-spacing:-.5px;">${escHtml(total)}</div>
        </div>
      </div>
      <!-- Address bottom-left -->
      <div style="position:absolute;bottom:12px;left:18px;font-size:8px;color:rgba(255,255,255,.35);">${escHtml(addr.split(',')[0])}</div>
      <!-- QR placeholder bottom-right -->
      <div style="position:absolute;bottom:10px;right:14px;width:28px;height:28px;background:rgba(255,255,255,.08);border-radius:3px;display:flex;align-items:center;justify-content:center;">
        <div style="font-size:10px;opacity:.4;">QR</div>
      </div>
    </div>`;
}

/* ─── Send / queue ──────────────────────────────────────────────── */
async function sendEstimateReveal() {
  const est = (S.estimates || []).find(e => e.id === _erEstId);
  if (!est) { toast('Estimate not found', 'error'); return; }

  const delivery = (document.querySelector('input[name="er-delivery"]:checked') || {}).value || 'queue';
  const note     = (document.getElementById('er-note')  || {}).value || '';
  const repName  = (document.getElementById('er-rep')   || {}).value || est.rep || '';
  const statusEl = document.getElementById('er-status');
  const sendBtn  = document.getElementById('er-send-btn');

  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; }
  if (statusEl) statusEl.textContent = '';

  if (delivery === 'queue') {
    // Add to mail queue as an Estimate Reveal item
    addEstimateToMailQueue(_erEstId, { revealNote: note, repName, isReveal: true });
    toast('📋 Added to Mail Queue — review before sending', 'success');
    closeM('m-est-reveal');
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '📬 Send Estimate Reveal Postcard'; }
    return;
  }

  // Direct mail via Lob
  try {
    if (statusEl) statusEl.textContent = '⏳ Sending to print…';
    const pin = est.pinId ? (S.pins || []).find(p => p.id === est.pinId) : null;
    const addrParts = _parseAddr(est.addr || '');

    const payload = {
      action: 'send-estimate-reveal',
      estId:  est.id,
      owner:  est.owner || 'Homeowner',
      addr:   est.addr  || '',
      total:  est.total || 0,
      note,
      repName,
      phone:   (S.cfg && S.cfg.phone)   || '',
      website: (S.cfg && S.cfg.website) || '',
      logoData: (S.cfg && S.cfg.logoData) || null,
      accentColor: (S.cfg && S.cfg.tplAccentColor) || '#F25C05',
      companyName: (S.cfg && S.cfg.companyName) || '',
      accountId: currentAccount ? currentAccount.id : null,
    };

    const res = await adminAPI(payload);
    if (res.error) throw new Error(res.error);

    // Mark estimate as reveal-sent
    est.revealSentAt = new Date().toISOString();
    save();
    if (sb) sb.from('estimates').update({ reveal_sent_at: est.revealSentAt }).eq('id', est.id).catch(() => {});

    toast('✅ Estimate Reveal postcard sent!', 'success');
    addAct('Estimate Reveal postcard sent to <strong>' + escHtml(est.owner || est.addr) + '</strong>', 'mail_sent');
    closeM('m-est-reveal');
  } catch (err) {
    console.error('[EstReveal]', err);
    if (statusEl) statusEl.textContent = '❌ ' + (err.message || 'Send failed');
    toast('Send failed: ' + (err.message || 'Unknown error'), 'error');
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '📬 Send Estimate Reveal Postcard'; }
  }
}

/* ─── Address parser helper ─────────────────────────────────────── */
function _parseAddr(full) {
  // "123 Main St, Chicago, IL 60601" → { line1, city, state, zip }
  const parts = full.split(',').map(s => s.trim());
  const line1 = parts[0] || '';
  const city  = parts[1] || '';
  const stateZip = (parts[2] || '').trim().split(/\s+/);
  const state = stateZip[0] || '';
  const zip   = stateZip[1] || '';
  return { line1, city, state, zip };
}
