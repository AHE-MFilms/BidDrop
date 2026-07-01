// BidDrop — PWA offline queue, service worker helpers, video helpers
// Extracted from index.html inline block

//  VIDEO HELPERS
// ═══════════════════════════════

function togglePriceOverride(){
  window._priceOverrideOn = !window._priceOverrideOn;
  const wrap = document.getElementById('price-override-input-wrap');
  const btn  = document.getElementById('price-override-toggle');
  const lbl  = document.getElementById('price-override-toggle-label');
  const icon = document.getElementById('price-override-icon');
  if(window._priceOverrideOn){
    wrap.style.display='block';
    btn.style.borderColor='rgba(242,92,5,.6)';
    btn.style.color='rgba(242,92,5,1)';
    btn.style.background='rgba(242,92,5,.08)';
    lbl.textContent='Override Active — Click to Disable';
    icon.textContent='⚡';
    const inp=document.getElementById('e-price-override');
    if(inp) inp.focus();
  } else {
    wrap.style.display='none';
    btn.style.borderColor='rgba(255,255,255,.15)';
    btn.style.color='rgba(255,255,255,.45)';
    btn.style.background='none';
    lbl.textContent='Override Price';
    icon.textContent='✏️';
    const inp=document.getElementById('e-price-override');
    if(inp) inp.value='';
  }
  calcP(); updatePreview();
}
function onPriceOverrideInput(){
  calcP(); updatePreview(); scheduleDraftSave();
}
// ═══════════════════════════════
//  DASHBOARD
// ═══════════════════════════════
// ═══════════════════════════════
//  OFFLINE PIN QUEUE & PWA
// ═══════════════════════════════
let _pwaInstallEvent = null;

// Detect iOS Safari and standalone (installed) mode
const _isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
// Check standalone at call-time (not parse-time) to avoid iOS timing issues
function _isStandalone(){
  return !!navigator.standalone ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;
}

// Capture the browser's install prompt on Chrome/Edge/Android
window.addEventListener('beforeinstallprompt', e=>{
  e.preventDefault();
  // Don't show if already running as installed app
  if(_isStandalone()) return;
  _pwaInstallEvent = e;
  const btn = document.getElementById('pwa-hdr-btn');
  if(btn) btn.style.display = 'flex';
});

// iOS Safari: show button only if NOT already in standalone mode
// ── THEME TOGGLE ──────────────────────────────────────────────────────────
function toggleTheme(){
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('bd-theme', isLight ? 'light' : 'dark');
  const btn = document.getElementById('theme-toggle-btn');
  if(btn) btn.textContent = isLight ? '🌙' : '☀️';
  btn && (btn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode');
}
(function restoreTheme(){
  if(localStorage.getItem('bd-theme') === 'light'){
    document.body.classList.add('light');
    const btn = document.getElementById('theme-toggle-btn');
    if(btn){ btn.textContent = '🌙'; btn.title = 'Switch to dark mode'; }
  }
})();
// Use DOMContentLoaded so the DOM is ready, and re-check standalone at that point
document.addEventListener('DOMContentLoaded', ()=>{
  if(_isIos && !_isStandalone()){
    const btn = document.getElementById('pwa-hdr-btn');
    if(btn) btn.style.display = 'flex';
  }
});

// Hide the button once the app is installed
window.addEventListener('appinstalled', ()=>{
  const btn = document.getElementById('pwa-hdr-btn');
  if(btn) btn.style.display = 'none';
  _pwaInstallEvent = null;
});

function doPwaInstall(){
  // Safety check: never show install UI if already running as installed app
  if(_isStandalone()){
    toast('BidDrop is already installed on your device.', 'info');
    const btn = document.getElementById('pwa-hdr-btn');
    if(btn) btn.style.display = 'none';
    return;
  }
  if(_isIos){
    // iOS Safari — show manual instructions
    openM('m-ios-install');
    return;
  }
  if(!_pwaInstallEvent){
    toast('Install prompt not available. Try adding to home screen from your browser menu.', 'info');
    return;
  }
  _pwaInstallEvent.prompt();
  _pwaInstallEvent.userChoice.then(r=>{
    if(r.outcome==='accepted'){
      const btn = document.getElementById('pwa-hdr-btn');
      if(btn) btn.style.display = 'none';
    }
    _pwaInstallEvent = null;
  });
}
// Real connectivity probe — navigator.onLine is unreliable on some devices/networks
async function checkRealConnectivity(){
  // First fast-path: if browser says online, do a quick probe to confirm
  // If browser says offline, trust it immediately (saves a network round-trip)
  if(!navigator.onLine) return false;
  try{
    // Probe Supabase health — use accounts table (root /rest/v1/ always 401s with anon key)
    const ctrl = new AbortController();
    const tid = setTimeout(()=>ctrl.abort(), 3000);
    const r = await fetch('https://gtwbhxnrmfmdenogzuea.supabase.co/rest/v1/accounts?select=id&limit=0', {
      method:'HEAD', signal:ctrl.signal,
      cache:'no-store', headers:{'apikey': (typeof SUPABASE_ANON_KEY!=='undefined'?SUPABASE_ANON_KEY:''), 'Authorization': 'Bearer '+(typeof SUPABASE_ANON_KEY!=='undefined'?SUPABASE_ANON_KEY:'')}
    });
    clearTimeout(tid);
    return r.status < 500; // 200/400 = online, 5xx/network error = offline
  } catch(e){
    return false;
  }
}
async function updateOfflineBanner(){
  const banner = document.getElementById('offline-banner');
  const cnt = document.getElementById('offline-queue-count');
  if(!banner) return;
  const queueLen = (S.offlineQueue||[]).length;
  if(cnt) cnt.textContent = queueLen;
  // Only show the banner if there are actually pins waiting to sync
  // (avoids false alarms from unreliable navigator.onLine)
  if(queueLen > 0){
    const isOnline = await checkRealConnectivity();
    banner.style.display = isOnline ? 'none' : 'block';
  } else {
    banner.style.display = 'none';
  }
}
window.addEventListener('online', async ()=>{
  updateOfflineBanner();
  await flushOfflineQueue();
});
window.addEventListener('offline', ()=>updateOfflineBanner());
async function flushOfflineQueue(){
  if(!currentAccount || !S.offlineQueue || !S.offlineQueue.length) return;
  const queue = [...S.offlineQueue];
  S.offlineQueue = [];
  let synced = 0;
  for(const pin of queue){
    try{
      await sbSavePin(pin);
      synced++;
    } catch(e){
      S.offlineQueue.push(pin); // re-queue on failure
    }
  }
  save();
  if(synced) toast('✅ '+synced+' offline pin'+(synced>1?'s':'')+' synced!','success');
  updateOfflineBanner();
}
async function savePin_withOffline(pin){
  const isOnline = await checkRealConnectivity();
  if(!isOnline){
    S.offlineQueue = S.offlineQueue||[];
    S.offlineQueue.push(pin);
    save();
    updateOfflineBanner();
    toast('📡 Offline — pin saved locally, will sync when online','info');
    return;
  }
  await sbSavePin(pin);
  // JobNimbus push is now MANUAL — triggered from pin popup or Lists & Contacts
  // jnUpsertContact(pin) removed from auto-save flow
}

function renderActFeed(){
  const el=document.getElementById('act-feed');
  if(!S.activity.length){el.innerHTML='<div style="text-align:center;padding:18px;color:var(--muted);font-size:11px;">No activity yet.</div>';return;}
  el.innerHTML=S.activity.slice(0,25).map(a=>
    '<div class="act-item">'+
    '<div class="act-dot" style="background:'+sColor(a.ref||'not_interested')+';"></div>'+
    '<div><div class="act-txt">'+a.txt+'</div><div class="act-time">'+timeAgo(a.at)+'</div></div>'+
    '</div>'
  ).join('');
}

function addAct(txt,ref){
  S.activity.unshift({txt,ref,at:new Date().toISOString()});
  if(S.activity.length>100)S.activity=S.activity.slice(0,100);
  // Supabase activity is handled separately via sbAddActivity
}

// ═══════════════════════════════
