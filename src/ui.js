// BidDrop — UI helpers: modals, toast, date formatting, role/plan checks
// Depends on: state.js (S, currentProfile, currentAccount)

function openM(id){document.getElementById(id).style.display='flex';}
function closeM(id){
  const el=document.getElementById(id);
  if(!el) return;
  // Dynamically-created modals (e.g. history) are removed from DOM; static ones just hidden
  if(el.dataset.dynamic==='1') el.remove();
  else el.style.display='none';
}

document.querySelectorAll('.overlay').forEach(o=>{
  o.addEventListener('click',e=>{if(e.target===o)closeM(o.id);});
});

let toastT;

function toast(msg,type='info',duration=3200){
  const el=document.getElementById('toast');
  el.className='toast '+type;el.textContent=msg;el.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),duration);
}

/**
 * bdConfirm(msg, onOk, onCancel) — non-blocking confirm dialog (replaces native confirm())
 * bdPrompt(msg, defaultVal, onOk, onCancel) — non-blocking prompt dialog (replaces native prompt())
 */
function bdConfirm(msg, onOk, onCancel){
  const id = 'bd-confirm-' + Date.now();
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  el.innerHTML = `
    <div style="background:#1c2128;border:1px solid #30363d;border-radius:14px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.7);">
      <div style="font-size:14px;color:#e6edf3;line-height:1.6;margin-bottom:22px;white-space:pre-wrap;">${msg.replace(/</g,'&lt;')}</div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="${id}-cancel" style="background:none;border:1px solid #30363d;border-radius:8px;padding:9px 18px;color:#8b949e;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="${id}-ok" style="background:#F25C05;border:none;border-radius:8px;padding:9px 18px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const cleanup = () => el.remove();
  document.getElementById(id+'-ok').onclick = () => { cleanup(); if(onOk) onOk(); };
  document.getElementById(id+'-cancel').onclick = () => { cleanup(); if(onCancel) onCancel(); };
  el.addEventListener('click', e => { if(e.target===el){ cleanup(); if(onCancel) onCancel(); } });
}

function bdPrompt(msg, defaultVal, onOk, onCancel){
  const id = 'bd-prompt-' + Date.now();
  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
  el.innerHTML = `
    <div style="background:#1c2128;border:1px solid #30363d;border-radius:14px;padding:28px 24px;max-width:420px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.7);">
      <div style="font-size:14px;color:#e6edf3;line-height:1.6;margin-bottom:14px;white-space:pre-wrap;">${msg.replace(/</g,'&lt;')}</div>
      <input id="${id}-input" type="text" value="${String(defaultVal||'').replace(/"/g,'&quot;')}" style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:9px 12px;color:#e6edf3;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:18px;">
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="${id}-cancel" style="background:none;border:1px solid #30363d;border-radius:8px;padding:9px 18px;color:#8b949e;font-size:13px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="${id}-ok" style="background:#F25C05;border:none;border-radius:8px;padding:9px 18px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">OK</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const input = document.getElementById(id+'-input');
  setTimeout(()=>input.focus(),50);
  const cleanup = () => el.remove();
  document.getElementById(id+'-ok').onclick = () => { const v=input.value; cleanup(); if(onOk) onOk(v); };
  document.getElementById(id+'-cancel').onclick = () => { cleanup(); if(onCancel) onCancel(null); };
  input.addEventListener('keydown', e => { if(e.key==='Enter'){ const v=input.value; cleanup(); if(onOk) onOk(v); } if(e.key==='Escape'){ cleanup(); if(onCancel) onCancel(null); } });
  el.addEventListener('click', e => { if(e.target===el){ cleanup(); if(onCancel) onCancel(null); } });
}

function timeAgo(iso){
  if(!iso)return'';
  const d=Date.now()-new Date(iso).getTime();
  const m=Math.floor(d/6e4),h=Math.floor(m/60),dy=Math.floor(h/24);
  if(m<1)return'just now';if(m<60)return m+'m ago';if(h<24)return h+'h ago';return dy+'d ago';
}
function fmtDate(iso){if(!iso)return'';return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function isAdminOrAbove(){
  return currentProfile && (currentProfile.role==='admin'||currentProfile.role==='super_admin');
}
function isSuperAdmin(){
  return currentProfile && currentProfile.role==='super_admin';
}
function isRep(){
  return currentProfile && currentProfile.role==='rep';
}

// ── Plan tier helpers ────────────────────────────────────────────────────────
const PLAN_TIERS = { starter: 0, pro: 1, agency: 2, enterprise: 3 };
function currentPlanTier(){
  const plan = (S.cfg && S.cfg.plan) ? S.cfg.plan.toLowerCase() : 'starter';
  return PLAN_TIERS[plan] ?? 0;
}
function isPlanAtLeast(minPlan){
  // super_admin bypasses all plan gates
  if(isSuperAdmin()) return true;
  return currentPlanTier() >= (PLAN_TIERS[minPlan.toLowerCase()] ?? 0);
}
// Show an upgrade prompt when a feature is gated
function showPlanUpgradePrompt(featureName, requiredPlan){
  const planNames = { starter: 'Starter ($97/mo)', pro: 'Pro ($197/mo)', agency: 'Agency ($397/mo)', enterprise: 'Enterprise (Custom)' };
  const currentPlan = (S.cfg && S.cfg.plan) ? S.cfg.plan : 'starter';
  toast(
    `🔒 ${featureName} requires the ${planNames[requiredPlan] || requiredPlan} plan or higher. You are on ${planNames[currentPlan] || currentPlan}. Contact support to upgrade.`,
    'error',
    6000
  );
}

// ── PIN UNLOCK SYSTEM ─────────────────────────────────────────────────────────
// 1 credit unlocks a pin forever: fires RentCast + Tracerfy, queues a postcard.
// Grandfather rule: pins with existing contactData, estimate, or active status
// are treated as already unlocked (no credit required).

function isPinUnlocked(pin) {
  if (!pin) return false;
  // Super admins are never gated
  if (isSuperAdmin()) return true;
  // Already explicitly unlocked
  if (pin.unlockedAt) return true;
  // Grandfather: has contact data
  if (pin.contactData && ((pin.contactData.phones||[]).length + (pin.contactData.emails||[]).length) > 0) return true;
  // Grandfather: has a saved estimate with owner
  if (pin.estimate && (typeof pin.estimate === 'object' ? pin.estimate.owner : false)) return true;
  if (pin.estimate && typeof pin.estimate === 'string') {
    try { const e = JSON.parse(pin.estimate); if (e.owner) return true; } catch(e2){}
  }
  // Grandfather: has been worked (mailed, quoted, signed, etc.)
  const activeStatuses = ['mailed','emailed','called','responded','quoted','signed'];
  if (activeStatuses.includes(pin.status)) return true;
  return false;
}

// Returns a promise that resolves to true if the pin is unlocked (or becomes unlocked).
// If not unlocked, shows the unlock prompt modal and resolves to true/false based on user action.
async function requirePinUnlocked(pinId) {
  const pin = (S.pins||[]).find(p => p.id === pinId);
  if (!pin) return false;
  if (isPinUnlocked(pin)) return true;
  return new Promise(resolve => {
    _showUnlockModal(pin, resolve);
  });
}

// Internal: show the unlock prompt modal
function _showUnlockModal(pin, resolve) {
  const balance = (S.cfg && S.cfg.mailerCredits) || 0;
  const existing = document.getElementById('bd-unlock-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'bd-unlock-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);';
  const safeAddr = (pin.address||'This address').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const safePinId = (pin.id||'').replace(/'/g,"\\'");
  modal.innerHTML = `
    <div style="background:#1a1f2e;border:1px solid rgba(249,115,22,.4);border-radius:16px;padding:28px 24px;max-width:360px;width:90%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.6);">
      <div style="font-size:32px;margin-bottom:8px;">🔓</div>
      <div style="font-family:var(--font-h,sans-serif);font-size:18px;font-weight:800;color:#fff;margin-bottom:6px;">Unlock This Lead</div>
      <div style="font-size:13px;color:#9ca3af;margin-bottom:16px;line-height:1.5;">
        Spend <strong style="color:#f97316;">1 credit</strong> to unlock this lead forever:
      </div>
      <div style="text-align:left;background:rgba(255,255,255,.04);border-radius:10px;padding:12px 16px;margin-bottom:14px;font-size:12px;color:#d1d5db;line-height:1.9;">
        📞 Homeowner phone &amp; email (auto-filled)<br>
        🖨 Print letter / Print Now<br>
        📬 Add to Mail Queue (postcard)<br>
        ⬆️ Sync to GoHighLevel CRM<br>
        📋 Sales Proposal PDF<br>
        🏛 Insurance Scope PDF
      </div>
      <div style="background:rgba(255,255,255,.06);border-radius:10px;padding:10px 14px;margin-bottom:18px;font-size:12px;color:#d1d5db;">
        📍 <strong style="color:#fff;">${safeAddr}</strong>
      </div>
      <div style="font-size:13px;color:#6b7280;margin-bottom:18px;">
        Your balance: <strong style="color:${balance>0?'#4ade80':'#f87171'};">${balance} credit${balance===1?'':'s'}</strong>
      </div>
      ${balance < 1 ? `
        <div style="font-size:12px;color:#f87171;margin-bottom:14px;">You don't have enough credits. Purchase more to unlock leads.</div>
        <button onclick="document.getElementById('bd-unlock-modal').remove(); showBuyCreditsModal();" style="background:#f97316;border:none;border-radius:10px;padding:12px 24px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;width:100%;margin-bottom:8px;">🔍 Buy Credits</button>
        <button onclick="document.getElementById('bd-unlock-modal').remove();" style="background:none;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 24px;color:#9ca3af;font-size:13px;cursor:pointer;width:100%;">Cancel</button>
      ` : `
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#9ca3af;margin-bottom:16px;cursor:pointer;justify-content:center;">
          <input type="checkbox" id="bd-unlock-postcard-chk" checked style="width:16px;height:16px;accent-color:#f97316;">
          Queue a postcard to this address (use it or lose it)
        </label>
        <button id="bd-unlock-confirm-btn" onclick="_confirmUnlockPin('${safePinId}');" style="background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:10px;padding:13px 24px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;width:100%;margin-bottom:10px;">🔓 Unlock — 1 Credit</button>
        <button onclick="document.getElementById('bd-unlock-modal').remove(); _unlockReject('${safePinId}');" style="background:none;border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:10px 24px;color:#9ca3af;font-size:13px;cursor:pointer;width:100%;">Cancel</button>
      `}
    </div>`;
  document.body.appendChild(modal);
  // Store resolver so the confirm button can call it
  if (!window._unlockResolvers) window._unlockResolvers = {};
  window._unlockResolvers[pin.id] = resolve;
}

function _unlockReject(pinId) {
  if (window._unlockResolvers && window._unlockResolvers[pinId]) {
    window._unlockResolvers[pinId](false);
    delete window._unlockResolvers[pinId];
  }
}

// Called by the confirm button inside the unlock modal
async function _confirmUnlockPin(pinId) {
  const btn = document.getElementById('bd-unlock-confirm-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Unlocking…'; }
  const queuePostcard = document.getElementById('bd-unlock-postcard-chk') ? document.getElementById('bd-unlock-postcard-chk').checked : true;
  const pin = (S.pins||[]).find(p => p.id === pinId);
  const address = pin ? pin.address : '';
  try {
    const result = await adminAPI('unlock-pin', { pinId, address, queuePostcard });
    // Update in-memory pin
    if (pin) {
      pin.unlockedAt = result.unlocked_at || new Date().toISOString();
      if (result.owner) {
        const est = pin.estimate ? (typeof pin.estimate==='string'?JSON.parse(pin.estimate):pin.estimate) : {};
        est.owner = result.owner;
        pin.estimate = est;
      }
      if (result.equity_data) pin.equityData = result.equity_data;
      if (result.contact_data) pin.contactData = result.contact_data;
      if (result.postcard_queued) pin.unlockQueuedPostcard = true;
    }
    // Deduct credit from local state
    if (result._credits != null) {
      S.cfg.mailerCredits = result._credits;
    } else {
      S.cfg.mailerCredits = Math.max(0, (S.cfg.mailerCredits||0) - 1);
    }
    if (typeof updateCreditBadge === 'function') updateCreditBadge();
    document.getElementById('bd-unlock-modal')?.remove();
    toast('🔓 Lead unlocked!' + (queuePostcard ? ' Postcard queued.' : ''), 'success', 4000);
    // Resolve the promise so the calling action proceeds
    if (window._unlockResolvers && window._unlockResolvers[pinId]) {
      window._unlockResolvers[pinId](true);
      delete window._unlockResolvers[pinId];
    }
  } catch(err) {
    if (btn) { btn.disabled = false; btn.textContent = '🔓 Unlock — 1 Credit'; }
    if (err && err.message && err.message.includes('no_credits')) {
      toast('Not enough credits. Purchase more to unlock this lead.', 'error', 5000);
    } else {
      toast('Unlock failed: ' + ((err && err.message)||'unknown error'), 'error', 5000);
    }
    if (window._unlockResolvers && window._unlockResolvers[pinId]) {
      window._unlockResolvers[pinId](false);
      delete window._unlockResolvers[pinId];
    }
    document.getElementById('bd-unlock-modal')?.remove();
  }
}
