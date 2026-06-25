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
