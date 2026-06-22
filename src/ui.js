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
