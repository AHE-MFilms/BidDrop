// ── Unregister any PWA service worker immediately ──────────────────────────
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(regs=>regs.forEach(r=>r.unregister()));
}

// ── Helpers ────────────────────────────────────────────────────────────────
const $=id=>document.getElementById(id);
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function fmt(n){return n?'$'+Math.round(n).toLocaleString():'$0';}
function fmtMo(total,apr,term){
  if(!total||!apr||!term)return'';
  const r=apr/100/12,n=term;
  const mo=total*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1);
  return'~'+fmt(Math.ceil(mo))+'/mo with financing';
}
function stars(n){return'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n));}
function slugify(s){return(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function pitchLabel(mul){
  const map={
    // new Solar API keys
    '1.054':'4/12','1.083':'5/12','1.118':'6/12','1.158':'7/12','1.202':'8/12','1.250':'9/12','1.302':'10/12','1.357':'11/12','1.414':'12/12',
    // legacy keys
    '1.00':'4/12','1.07':'5/12','1.15':'6/12','1.23':'7/12','1.31':'8/12','1.40':'9/12','1.50':'10/12','1.65':'11/12','1.80':'12/12'
  };
  const k=parseFloat(mul).toFixed(3);
  return map[k]||map[parseFloat(mul).toFixed(2)]||map[parseFloat(mul).toFixed(1)]||'—';
}
function initials(s){return(s||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);}
function fmtDate(iso){if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}

// ── Pricing ────────────────────────────────────────────────────────────────
function computePrice(structures,matKey,acct){
  if(!structures||!structures.length)return 0;
  const costMap={'1.0':acct.cost3Tab,'1.3':acct.costArchitectural,'1.8':acct.costDesigner,'2.5':acct.costMetal};
  const matCost=parseFloat(costMap[matKey])||450;
  const tearoff=parseFloat(acct.costTearoff)||75;
  const iceWater=parseFloat(acct.costIceWater)||42;
  const felts=parseFloat(acct.costFelts)||22;
  const dumpster=parseFloat(acct.costDumpster)||450;
  const overhead=(parseFloat(acct.overhead)||15)/100;
  const margin=(parseFloat(acct.margin)||20)/100;
  let subtotal=dumpster;
  structures.forEach(s=>{
    const sqft=parseFloat(s.sqft)||0;if(!sqft)return;
    const pitchMult=parseFloat(s.pitch)||1.15;
    const complexity=parseFloat(s.complexity)||1.12;
    const sq=sqft/100*1.12*pitchMult;
    subtotal+=sq*(matCost+tearoff+iceWater+felts)*complexity;
  });
  return Math.round(subtotal*(1+overhead)*(1+margin));
}

// ── Config ─────────────────────────────────────────────────────────────────
const API_BASE=window.location.origin;
// ── State ──────────────────────────────────────────────────────────────────
let _estId='',_est=null,_acct=null,_prices={},_gcd={};
