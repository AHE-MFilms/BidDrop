/**
 * BidDrop Pixel Leads — src/pixel-leads.js
 *
 * Handles the Pixel Leads tab UI:
 *  - loadPixelLeads()      — fetch hits from /api/pixel
 *  - renderPixelLeads()    — render the leads list
 *  - pixelQueuePostcard()  — mark a hit as postcard queued
 *  - pixelDismiss()        — dismiss a hit
 *  - renderPixelSettings() — embed code generator + settings panel
 */

let _pixelHits = [];
let _pixelTotal = 0;
let _pixelOffset = 0;
const PIXEL_PAGE_SIZE = 50;
let _pixelFilter = 'pending'; // pending | resolved | queued | dismissed | all

async function loadPixelLeads(reset = true) {
  if (reset) { _pixelOffset = 0; _pixelHits = []; }
  const accountId = S.cfg?.accountId || S.cfg?.id;
  if (!accountId) return;

  const status = _pixelFilter === 'all' ? '' : `&status=${encodeURIComponent(_pixelFilter)}`;
  const url = `/api/pixel?action=list&accountId=${encodeURIComponent(accountId)}&limit=${PIXEL_PAGE_SIZE}&offset=${_pixelOffset}${status}`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    if (reset) {
      _pixelHits = data.hits || [];
    } else {
      _pixelHits = _pixelHits.concat(data.hits || []);
    }
    _pixelTotal = data.total || 0;
    renderPixelLeads();
  } catch (e) {
    console.error('loadPixelLeads error', e);
  }
}

function renderPixelLeads() {
  const el = document.getElementById('pixel-leads-list');
  if (!el) return;

  // Update stats
  const pending = _pixelHits.filter(h => h.resolution_status === 'pending').length;
  const resolved = _pixelHits.filter(h => h.resolution_status === 'resolved').length;
  const queued = _pixelHits.filter(h => h.postcard_queued).length;
  const setEl = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setEl('px-stat-total', _pixelTotal);
  setEl('px-stat-pending', pending);
  setEl('px-stat-resolved', resolved);
  setEl('px-stat-queued', queued);

  if (!_pixelHits.length) {
    el.innerHTML = `<div style="padding:48px;text-align:center;color:var(--muted);">
      <div style="font-size:40px;margin-bottom:12px;">📡</div>
      <div style="font-size:16px;font-weight:700;color:var(--mid);margin-bottom:6px;">No pixel hits yet</div>
      <div style="font-size:13px;">Once your pixel is installed and visitors spend 20+ seconds on your site, leads will appear here.</div>
    </div>`;
    return;
  }

  const rows = _pixelHits.map(h => {
    const ts = new Date(h.created_at).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    const statusBadge = {
      pending:   '<span style="background:rgba(245,158,11,.15);color:#F59E0B;border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">Pending</span>',
      resolved:  '<span style="background:rgba(34,197,94,.15);color:#22C55E;border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">Resolved</span>',
      queued:    '<span style="background:rgba(59,130,246,.15);color:#3B82F6;border:1px solid rgba(59,130,246,.3);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">📬 Queued</span>',
      dismissed: '<span style="background:rgba(150,176,200,.1);color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:2px 8px;font-size:11px;font-weight:700;">Dismissed</span>',
    }[h.resolution_status] || '';

    const addressLine = h.resolved_address
      ? `<div style="font-size:13px;font-weight:600;color:var(--text);">${h.resolved_name || 'Homeowner'}</div>
         <div style="font-size:12px;color:var(--mid);">${h.resolved_address}, ${h.resolved_city || ''} ${h.resolved_state || ''} ${h.resolved_zip || ''}</div>`
      : `<div style="font-size:13px;color:var(--muted);font-style:italic;">Address pending resolution</div>
         <div style="font-size:11px;color:var(--muted);">IP: ${(h.ip||'').replace(/(\d+\.\d+)\.\d+\.\d+/, '$1.x.x')}</div>`;

    const pageShort = (h.page_url || '').replace(/^https?:\/\/[^/]+/, '').substring(0, 40) || '/';
    const sessionStr = h.session_seconds >= 60
      ? `${Math.floor(h.session_seconds/60)}m ${h.session_seconds%60}s`
      : `${h.session_seconds}s`;

    const canQueue = h.resolved_address && !h.postcard_queued && h.resolution_status !== 'dismissed';
    const canDismiss = h.resolution_status !== 'dismissed';

    return `<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border);">
      <div style="width:36px;height:36px;border-radius:50%;background:var(--card2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🏠</div>
      <div style="flex:1;min-width:0;">
        ${addressLine}
        <div style="display:flex;gap:10px;align-items:center;margin-top:4px;flex-wrap:wrap;">
          ${statusBadge}
          <span style="font-size:11px;color:var(--muted);">⏱ ${sessionStr} on ${pageShort}</span>
          <span style="font-size:11px;color:var(--muted);">${ts}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${canQueue ? `<button onclick="pixelQueuePostcard('${h.id}')" style="background:var(--accent);border:none;border-radius:7px;padding:6px 12px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">📬 Send Postcard</button>` : ''}
        ${canDismiss ? `<button onclick="pixelDismiss('${h.id}')" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--muted);font-size:12px;cursor:pointer;">✕</button>` : ''}
      </div>
    </div>`;
  }).join('');

  const loadMore = _pixelHits.length < _pixelTotal
    ? `<div style="padding:16px;text-align:center;"><button onclick="pixelLoadMore()" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:8px 24px;color:var(--mid);font-size:13px;cursor:pointer;">Load more (${_pixelTotal - _pixelHits.length} remaining)</button></div>`
    : '';

  el.innerHTML = rows + loadMore;
}

async function pixelQueuePostcard(hitId) {
  await fetch('/api/pixel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'queue_postcard', id: hitId })
  });
  const hit = _pixelHits.find(h => h.id === hitId);
  if (hit) { hit.postcard_queued = true; hit.resolution_status = 'queued'; }
  renderPixelLeads();
  showToast('Postcard queued! 📬');
}

async function pixelDismiss(hitId) {
  await fetch('/api/pixel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'dismiss', id: hitId })
  });
  const hit = _pixelHits.find(h => h.id === hitId);
  if (hit) hit.resolution_status = 'dismissed';
  renderPixelLeads();
}

function pixelLoadMore() {
  _pixelOffset += PIXEL_PAGE_SIZE;
  loadPixelLeads(false);
}

function setPixelFilter(f) {
  _pixelFilter = f;
  document.querySelectorAll('.px-filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.f === f);
  });
  loadPixelLeads(true);
}

// ── Pixel Settings ────────────────────────────────────────────────────────────

async function generatePixelId() {
  const accountId = S.cfg?.accountId || S.cfg?.id;
  if (!accountId) return;
  bdConfirm('Generate a new Pixel ID? Your existing embed code will stop working.', async ()=>{
    const r = await fetch('/api/pixel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_pixel_id', accountId })
    });
    const data = await r.json();
    if (data.pixelId) {
      S.cfg.pixelId = data.pixelId;
      renderPixelEmbedCode();
      showToast('New Pixel ID generated ✓');
    }
  });
}

async function saveResolutionKey() {
  const accountId = S.cfg?.accountId || S.cfg?.id;
  const key = document.getElementById('px-resolution-key')?.value?.trim() || '';
  if (!accountId) return;
  await fetch('/api/pixel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save_resolution_key', accountId, key })
  });
  showToast('Resolution API key saved ✓');
}

function renderPixelEmbedCode() {
  const pixelId = S.cfg?.pixelId || '';
  const codeEl = document.getElementById('px-embed-code');
  if (!codeEl) return;
  if (!pixelId) {
    codeEl.value = '<!-- Click "Generate Pixel ID" to get your embed code -->';
    return;
  }
  codeEl.value = `<!-- BidDrop Pixel -->\n<script src="https://biddrop.us/pixel.js" data-pixel-id="${pixelId}" async><\/script>`;
}

function copyPixelCode() {
  const el = document.getElementById('px-embed-code');
  if (!el) return;
  el.select();
  document.execCommand('copy');
  showToast('Embed code copied! 📋');
}
