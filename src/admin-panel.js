// src/admin-panel.js
// Company switcher (super_admin), admin panel, super admin management,
// user CRUD, account creation, delete client account.
// Depends on: sb, S, currentAccount, adminAPI(), toast(), escHtml() (ui.js)
// Extracted from index.html — Tier 4 modularization
// Fallback escHtml/escJs in case map-core.js hasn't loaded yet (load-order safety)
if(typeof escHtml==='undefined'){var escHtml=function(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');};}
if(typeof escJs==='undefined'){var escJs=function(s){return(s||'').replace(/\\/g,'\\\\').replace(/'/g,'\\x27').replace(/"/g,'\\x22');};}

let _allAccounts = [];
let _coSwitcherOpen = false;
let _sbCoMenuOpen = false;
let _sbCoAccounts = []; // mirrors _allAccounts for sidebar selector

// ── SIDEBAR COMPANY SELECTOR (super_admin only) ───────────────────────────────
function updateSbCoLabel(){
  if(!isSuperAdmin()) return;
  const lbl = document.getElementById('sb-co-label');
  if(lbl) lbl.textContent = currentAccount ? (currentAccount.company_name||currentAccount.name||'Unknown') : 'Select company…';
}

function populateSbCoList(accounts){
  const list = document.getElementById('sb-co-list');
  if(!list) return;
  list.innerHTML = accounts.map(a=>{
    const isCurrent = currentAccount && currentAccount.id===a.id;
    return '<button onclick="switchAccount(\''+a.id+'\');closeSbCoMenu()" style="display:block;width:100%;text-align:left;background:'+(isCurrent?'var(--accent-dim)':'none')+';border:none;border-bottom:1px solid var(--border);padding:9px 12px;color:var(--text);font-family:var(--font-b);font-size:11px;font-weight:'+(isCurrent?'700':'500')+';cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(isCurrent?'✓ ':'')+escHtml(a.company_name||a.name||a.id)+'</button>';
  }).join('');
}

function filterSbCoMenu(){
  const q = (document.getElementById('sb-co-search')?.value||'').toLowerCase().trim();
  const filtered = q ? _sbCoAccounts.filter(a=>(a.company_name||a.name||'').toLowerCase().includes(q)) : _sbCoAccounts;
  populateSbCoList(filtered);
}

function toggleSbCoMenu(){
  const menu = document.getElementById('sb-co-menu');
  if(!menu) return;
  _sbCoMenuOpen = !_sbCoMenuOpen;
  menu.style.display = _sbCoMenuOpen ? 'block' : 'none';
  if(_sbCoMenuOpen){
    const inp = document.getElementById('sb-co-search');
    if(inp){ inp.value=''; inp.focus(); }
    populateSbCoList(_sbCoAccounts);
  }
}

function closeSbCoMenu(){
  _sbCoMenuOpen = false;
  const menu = document.getElementById('sb-co-menu');
  if(menu) menu.style.display = 'none';
}

// Close sidebar menu on outside click
document.addEventListener('click', function(e){
  const sel = document.getElementById('sb-co-selector');
  if(sel && !sel.contains(e.target)) closeSbCoMenu();
});

// ── MAP TOOLBAR TRADE VISIBILITY ─────────────────────────────────────────────
function applyMapToolbarTrades(){
  const et = (S && S.cfg && S.cfg.enabledTrades) || {roofing:true};
  // Roofing-only buttons
  const hasRoofing = et.roofing !== false;
  const hasSolar   = !!et.solar;
  // Measure Roof: show for roofing, solar, siding, gutters (any trade that involves structures)
  const hasStructure = hasRoofing || hasSolar || !!et.siding || !!et.gutters || !!et.insulation;
  const btnMeasure = document.getElementById('btn-measure');
  if(btnMeasure) btnMeasure.style.display = hasStructure ? '' : 'none';
  // Storm Events: show for roofing, gutters, siding (storm-damage trades)
  const hasStormTrade = hasRoofing || !!et.gutters || !!et.siding;
  const btnStorm = document.getElementById('btn-storm-toggle');
  if(btnStorm) btnStorm.style.display = hasStormTrade ? '' : 'none';
  // Home Age: show for roofing, gutters, siding, windows, doors (age-relevant trades)
  const hasAgeTrade = hasRoofing || !!et.gutters || !!et.siding || !!et.windows || !!et.doors;
  const btnAge = document.getElementById('btn-property-layer');
  if(btnAge) btnAge.style.display = hasAgeTrade ? '' : 'none';
  // Solar kW: show only for solar
  const btnSolar = document.getElementById('solar-overlay-btn');
  if(btnSolar) btnSolar.style.display = hasSolar ? '' : 'none';
}

async function initCoSwitcher(){
  if(!isSuperAdmin()) return;
  // Show the switcher, hide the old co-sub span
  const wrap = document.getElementById('co-switcher-wrap');
  if(wrap) wrap.style.display = 'flex';
  const coSub = document.getElementById('co-sub');
  if(coSub) coSub.style.display = 'none';
  // Show sidebar company selector
  const sbSel = document.getElementById('sb-co-selector');
  if(sbSel) sbSel.style.display = 'block';
  // Fetch all accounts
  const {data:accounts} = await sb.from('accounts').select('id,name,company_name').order('company_name',{ascending:true});
  // Exclude the AHE master agency account from the switcher — it's the super_admin's own internal workspace
  _allAccounts = (accounts||[]).filter(a=>a.id!==AGENCY_ACCOUNT_ID);
  _sbCoAccounts = _allAccounts;
  // Set current label
  updateCoSwitcherLabel();
  updateSbCoLabel();
  // Populate list
  const list = document.getElementById('co-switcher-list');
  if(!list) return;
  list.innerHTML = _allAccounts.map(a=>{
    const isCurrent = currentAccount && currentAccount.id===a.id;
    return '<button onclick="switchAccount(\''+a.id+'\')" style="display:block;width:100%;text-align:left;background:'+(isCurrent?'var(--accent-dim)':'none')+';border:none;border-bottom:1px solid var(--border);padding:10px 14px;color:var(--text);font-family:var(--font-b);font-size:12px;font-weight:'+(isCurrent?'700':'500')+';cursor:pointer;">'+(isCurrent?'✓ ':'')+escHtml(a.name||a.company_name||a.id)+'</button>';
  }).join('');
  // Close on outside click
  document.addEventListener('click', function coClickAway(e){
    if(!document.getElementById('co-switcher-wrap')?.contains(e.target)){
      closeCoSwitcher();
    }
  }, {once:false, capture:false});
}

function updateCoSwitcherLabel(){
  if(!isSuperAdmin()) return;
  const lbl = document.getElementById('co-switcher-label');
  if(lbl) lbl.textContent = currentAccount ? (currentAccount.name||currentAccount.company_name||'Unknown') : '— Pick a Company —';
}

function toggleCoSwitcher(){
  const menu = document.getElementById('co-switcher-menu');
  if(!menu) return;
  _coSwitcherOpen = !_coSwitcherOpen;
  menu.style.display = _coSwitcherOpen ? 'block' : 'none';
}

function closeCoSwitcher(){
  _coSwitcherOpen = false;
  const menu = document.getElementById('co-switcher-menu');
  if(menu) menu.style.display = 'none';
}

async function switchAccount(accountId){
  closeCoSwitcher();
  if(currentAccount && currentAccount.id===accountId){
    toast('Already viewing this company','info');
    return;
  }
  toast('Switching company…','info');
  // Unsubscribe from old realtime channel
  if(realtimeChannel){ sb.removeChannel(realtimeChannel); realtimeChannel=null; }
  // Load new account
  const {data:account, error} = await sb.from('accounts').select('*').eq('id',accountId).single();
  if(error||!account){ toast('Could not load account: '+(error?.message||'not found'),'error'); return; }
  currentAccount = account;
  S.cfg = accountRowToCfg(account);
  S.pins = []; S.estimates = []; S.team = []; S.activity = [];
  totalPinCount = 0; pinListPage = 0; _lastViewportBounds = null;
  // Clear cluster group (faster than removing individual markers)
  if(clusterGroup) clusterGroup.clearLayers();
  markers = {};
  // Reload data for new account
  applyBrand();
  updatePreview();
  await loadPinsFromSupabase();
  await loadQueueFromSupabase();
  if(typeof loadEstimatesFromSupabase === 'function') await loadEstimatesFromSupabase();
  subscribeRealtime();
  renderPinList();
  renderDash();
  updateCoSwitcherLabel();
  // Refresh the switcher list to update checkmark
  const list = document.getElementById('co-switcher-list');
  if(list && _allAccounts.length){
    list.innerHTML = _allAccounts.map(a=>{
      const isCurrent = currentAccount && currentAccount.id===a.id;
      return '<button onclick="switchAccount(\''+a.id+'\')" style="display:block;width:100%;text-align:left;background:'+(isCurrent?'var(--accent-dim)':'none')+';border:none;border-bottom:1px solid var(--border);padding:10px 14px;color:var(--text);font-family:var(--font-b);font-size:12px;font-weight:'+(isCurrent?'700':'500')+';cursor:pointer;">'+(isCurrent?'✓ ':'')+escHtml(a.name||a.company_name||a.id)+'</button>';
    }).join('');
  }
  // Refresh credit badge immediately from DB row, then fetch live balance
  updateCreditBadge();
  // Async refresh from API to get accurate live balance
  (async()=>{
    try{
      const sess = (await sb.auth.getSession()).data.session;
      if(sess){
        const _vaIdSw = currentAccount?.id ? '&viewingAccountId='+encodeURIComponent(currentAccount.id) : '';
        const r = await fetch('/api/credits?action=balance'+_vaIdSw,{ headers:{ 'Authorization':'Bearer '+sess.access_token } });
        if(r.ok){ const b=await r.json(); S.cfg.mailerCredits=b.paid_credits; S.cfg.freeMailerCreditsUsed=b.free_used; updateCreditBadge(); }
      }
    }catch(_){}
  })();
  toast('✅ Switched to '+escHtml(account.company_name||account.name||''),'success');
  // Update sidebar selector label
  updateSbCoLabel();
  // Refresh sidebar selector list checkmarks
  populateSbCoList(_sbCoAccounts);
  // If the Settings tab is currently active, refresh it with the new account's data
  const settingsPane = document.getElementById('tab-settings');
  if(settingsPane && settingsPane.classList.contains('active')) renderSettingsTab();
  // If the Campaigns tab is currently active, refresh it for the new account
  const campaignsPane = document.getElementById('tab-campaigns');
  if(campaignsPane && campaignsPane.classList.contains('active')) setTimeout(function(){ if(typeof loadCampaignsTab==='function') loadCampaignsTab(); }, 600);
  // If the Agency tab is currently active, refresh it for the new account
  const agencyPane = document.getElementById('tab-agency');
  if(agencyPane && agencyPane.classList.contains('active')) setTimeout(function(){ if(typeof loadAgencyTab==='function') loadAgencyTab(); }, 600);
  // If the Designs tab is currently active, refresh it for the new account
  const designsPane = document.getElementById('tab-designs');
  if(designsPane && designsPane.classList.contains('active')) setTimeout(function(){ if(typeof loadDesignsTab==='function') loadDesignsTab(); }, 600);
}



// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
function openAdminPanel(){
  goTab('admin');
}


function buildAdminTradeChips(a){
  const TRADES = [
    {key:'roofing',    icon:'🏠', label:'Roofing'},
    {key:'solar',      icon:'☀️', label:'Solar'},
    {key:'fencing',    icon:'🪵', label:'Fencing'},
    {key:'siding',     icon:'🏗',  label:'Siding'},
    {key:'gutters',    icon:'🌊', label:'Gutters'},
    {key:'insulation', icon:'🧱', label:'Insul.'},
    {key:'paint',      icon:'🎨', label:'Paint'},
    {key:'doors',      icon:'🚪', label:'Doors'},
    {key:'windows',    icon:'🪟', label:'Windows'},
  ];
  const enabled = Array.isArray(a.enabled_trades) ? a.enabled_trades : ['roofing'];
  const chips = TRADES.map(t=>{
    const on = enabled.includes(t.key);
    const bg     = on ? 'rgba(242,92,5,.15)' : 'rgba(255,255,255,.04)';
    const border = on ? 'rgba(242,92,5,.5)'  : 'var(--border)';
    const color  = on ? 'var(--accent)'       : 'var(--muted)';
    const fw     = on ? '700' : '500';
    const op     = on ? '1'   : '0.5';
    return '<button onclick="adminToggleTrade(\''+a.id+'\',\''+t.key+'\')"'+
      ' style="background:'+bg+';border:1px solid '+border+';border-radius:5px;'+
      'padding:2px 7px;color:'+color+';font-size:10px;cursor:pointer;'+
      'font-weight:'+fw+';opacity:'+op+';transition:all .15s;"'+
      ' title="'+(on?'Disable':'Enable')+' '+t.label+'">'+t.icon+' '+t.label+'</button>';
  }).join('');
  return '<div data-trade-chips="'+a.id+'" style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border);margin-bottom:6px;">'+
    '<div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin-bottom:5px;">TRADES</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:4px;">'+chips+'</div>'+
    '</div>';
}

async function adminToggleTrade(accountId, tradeKey){
  if(!_adminPanelData) return;
  const a = _adminPanelData.clientAccounts.find(x=>x.id===accountId);
  if(!a) return;
  let enabled = Array.isArray(a.enabled_trades) ? [...a.enabled_trades] : ['roofing'];
  if(enabled.includes(tradeKey)){
    enabled = enabled.filter(t=>t!==tradeKey);
  } else {
    enabled.push(tradeKey);
  }
  // Optimistic update
  a.enabled_trades = enabled;
  // Update chips in-place (avoid full re-render which loses buttons)
  const chipsEl = document.querySelector('[data-trade-chips="'+accountId+'"]');
  if(chipsEl) chipsEl.outerHTML = buildAdminTradeChips(a);
  // Save to DB
  const {error} = await sb.from('accounts').update({enabled_trades: enabled}).eq('id', accountId);
  if(error){
    toast('Failed to save trade settings: '+error.message, 'error');
    // Revert
    a.enabled_trades = enabled.includes(tradeKey) ? enabled.filter(t=>t!==tradeKey) : [...enabled, tradeKey];
    const chipsEl2 = document.querySelector('[data-trade-chips="'+accountId+'"]');
    if(chipsEl2) chipsEl2.outerHTML = buildAdminTradeChips(a);
  } else {
    toast('Trade settings saved', 'success');
  }
}

async function renderAdminPanel(){
  const el = document.getElementById('admin-panel-body');
  if(!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);">Loading...</div>';

  // Wait for a valid session (auth state change can cause a brief sign-out/sign-in cycle)
  let session = null;
  for(let attempt = 0; attempt < 8; attempt++){
    const { data: { session: s } } = await sb.auth.getSession();
    if(s && s.access_token){ session = s; break; }
    await new Promise(r => setTimeout(r, 500));
  }
  if(!session){
    el.innerHTML = '<div style="color:#ef4444;padding:20px;">Session not ready. Please refresh the page.</div>';
    return;
  }

  try {
    if(isSuperAdmin()){
      // Use server-side API to bypass RLS (service role key)
      const d = await adminAPI('agency-data');
      const accounts = Array.isArray(d.accounts) ? d.accounts : [];
      const profiles = Array.isArray(d.profiles) ? d.profiles : [];
      el.innerHTML = renderSuperAdminPanel(accounts, profiles);
    } else if(isAdminOrAbove()){
      // Account admin sees their users
      const {data:profiles} = await sb.from('user_profiles').select('*').eq('account_id', currentAccount.id);
      el.innerHTML = renderAccountAdminPanel(profiles||[]);
    } else {
      el.innerHTML = '<div style="color:var(--muted);padding:20px;">Access denied.</div>';
    }
  } catch(e) {
    console.error('[AdminPanel] error:', e);
    el.innerHTML = '<div style="color:#ef4444;padding:20px;">Error: '+e.message+'<br><br><button onclick="renderAdminPanel()" style="background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Retry</button></div>';
  }
}

// Store admin panel data for live filtering
let _adminPanelData = null;

function filterAdminAccounts(){
  if(!_adminPanelData) return;
  const {clientAccounts, allProfiles} = _adminPanelData;
  const q = (document.getElementById('admin-search')?.value||'').toLowerCase().trim();
  const sort = document.getElementById('admin-sort')?.value || 'name_asc';
  const planFilter = document.getElementById('admin-filter-plan')?.value || 'all';
  const statusFilter = document.getElementById('admin-filter-status')?.value || 'all';

  let filtered = clientAccounts.filter(a=>{
    const name = (a.company_name||a.name||'').toLowerCase();
    if(q && !name.includes(q)) return false;
    if(planFilter !== 'all' && (a.plan||'starter').toLowerCase() !== planFilter) return false;
    if(statusFilter === 'active' && a.active === false) return false;
    if(statusFilter === 'inactive' && a.active !== false) return false;
    return true;
  });

  filtered.sort((a,b)=>{
    const nameA = (a.company_name||a.name||'').toLowerCase();
    const nameB = (b.company_name||b.name||'').toLowerCase();
    if(sort==='name_asc')  return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    if(sort==='name_desc') return nameA > nameB ? -1 : nameA < nameB ? 1 : 0;
    if(sort==='plan'){
      const order = {enterprise:0,agency:1,pro:2,starter:3};
      return (order[a.plan]??2) - (order[b.plan]??2);
    }
    if(sort==='users_desc'){
      const uA = allProfiles.filter(p=>p.account_id===a.id).length;
      const uB = allProfiles.filter(p=>p.account_id===b.id).length;
      return uB - uA;
    }
    return 0;
  });

  const grid = document.getElementById('admin-accounts-grid');
  const countEl = document.getElementById('admin-acct-count');
  if(countEl) countEl.textContent = 'Client Accounts (' + filtered.length + (filtered.length !== clientAccounts.length ? ' of ' + clientAccounts.length : '') + ')';
  if(!grid) return;
  if(!filtered.length){
    grid.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:10px;">No accounts match your search.</div>';
    return;
  }
  grid.innerHTML = filtered.map(a=>{
    const users = allProfiles.filter(p=>p.account_id===a.id);
    const planColor = {starter:'#3B82F6',pro:'#8B5CF6',agency:'#F25C05',enterprise:'#D97706'}[a.plan]||'#6688A8';
    const activeColor = a.active!==false ? '#22C55E' : '#EF4444';
    return '<div class="ag-acct-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
        '<div class="ag-acct-name">'+escHtml(a.company_name||a.name||'')+'</div>' +
        '<div style="display:flex;gap:4px;">' +
          '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;background:'+planColor+'22;color:'+planColor+';border:1px solid '+planColor+'44;text-transform:uppercase;">'+(a.plan||'starter')+'</span>' +
          '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;background:'+activeColor+'22;color:'+activeColor+';border:1px solid '+activeColor+'44;">'+(a.active!==false?'Active':'Inactive')+'</span>' +
        '</div>' +
      '</div>' +
      '<div class="ag-acct-meta">'+users.length+' user'+(users.length!==1?'s':'')+
      '</div>' +
      '<div style="margin:10px 0 6px;border-top:1px solid var(--border);padding-top:8px;">' +
        users.map(u=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 0;">' +
          '<div style="font-size:11px;color:var(--mid);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
            '\uD83D\uDC64 <span style="font-weight:600;">'+(u.name||u.email||u.id.slice(0,8))+'</span>' +
            ' \u2014 <span style="color:var(--accent);font-weight:700;">'+u.role+'</span>' +
            (u.email?' <span style="color:var(--muted);font-size:10px;">'+escHtml(u.email)+'</span>':'')+
          '</div>' +
          '<div style="display:flex;gap:4px;flex-shrink:0;">' +
            '<button onclick="editUser(\''+u.id+'\',\''+escJs(u.name||'')+'\',\''+escJs(u.email||'')+'\',\''+u.role+'\',\''+a.id+'\')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:2px 8px;color:var(--mid);font-size:10px;cursor:pointer;" title="Edit user">\u270F\uFE0F Edit</button>' +
            '<button onclick="deleteUser(\''+u.id+'\',\''+escJs(u.name||u.email||'user')+'\')" style="background:none;border:1px solid var(--danger);border-radius:5px;padding:2px 8px;color:var(--danger);font-size:10px;cursor:pointer;" title="Delete user">\uD83D\uDDD1 Delete</button>' +
          '</div>' +
        '</div>').join('') +
      '</div>' +
      (a.notes?'<div style="font-size:10px;color:var(--muted);margin-top:4px;font-style:italic;">'+escHtml(a.notes)+'</div>':'')+
      buildAdminTradeChips(a)+
      '<div style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;">'+
        '<button onclick="switchAccount(\''+a.id+'\');goTab(\'map\')" style="background:rgba(242,92,5,.18);border:1px solid rgba(242,92,5,.6);border-radius:5px;padding:3px 10px;color:var(--accent);font-size:10px;cursor:pointer;font-weight:700;" title="Switch to this company and take control">🔀 Switch To</button>'+
        '<button onclick="openAddUserModal(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\')" style="background:rgba(242,92,5,.12);border:1px solid rgba(242,92,5,.4);border-radius:5px;padding:3px 10px;color:var(--accent);font-size:10px;cursor:pointer;font-weight:700;">➕ Add User</button>'+
        '<button onclick="setAccountSlug(\''+a.id+'\',\''+escHtml(a.slug||'')+'\')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:3px 10px;color:var(--muted);font-size:10px;cursor:pointer;font-weight:600;">🔗 Set Slug</button>'+
        (a.slug?'<a href="/q/'+a.slug+'" target="_blank" style="background:rgba(242,92,5,.1);border:1px solid rgba(242,92,5,.3);border-radius:5px;padding:3px 10px;color:var(--accent);font-size:10px;font-weight:600;text-decoration:none;">↗ /q/'+a.slug+'</a>':'') +
        '<button onclick="toggleAccountActive(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\','  +(a.active!==false)+')'  +' style="background:none;border:1px solid '+(a.active!==false?'#22C55E':'#6B7280')+';border-radius:5px;padding:3px 10px;color:'+(a.active!==false?'#22C55E':'#9CA3AF')+';font-size:10px;cursor:pointer;font-weight:600;">'+(a.active!==false?'⏸ Deactivate':'▶ Reactivate')+'</button>'+
        '<button onclick="toggleTracerfy(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\',' +(a.tracerfy_enabled?'true':'false')+')" style="background:none;border:1px solid '+(a.tracerfy_enabled?'#A78BFA':'#4B5563')+';border-radius:5px;padding:3px 10px;color:'+(a.tracerfy_enabled?'#A78BFA':'#9CA3AF')+';font-size:10px;cursor:pointer;font-weight:600;" title="Toggle Tracerfy skip-trace">'+(a.tracerfy_enabled?'📞 ON':'📞 OFF')+'</button>'+
        '<button onclick="deleteClientAccount(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\')" style="background:none;border:1px solid var(--danger);border-radius:5px;padding:3px 10px;color:var(--danger);font-size:10px;cursor:pointer;font-weight:600;margin-left:auto;">🗑 Delete</button>'+
      '</div>'+
      '</div>';
  }).join('');
}

function renderSuperAdminPanel(accounts, allProfiles){
  const clientAccounts = accounts.filter(a=>a.id!==AGENCY_ACCOUNT_ID);
  // Store for live filtering
  _adminPanelData = {clientAccounts, allProfiles};
  return (
    // Search + sort + filter toolbar
    '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:14px;">' +
      '<div id="admin-acct-count" style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);flex-shrink:0;">Client Accounts ('+clientAccounts.length+')</div>' +
      '<div style="flex:1;min-width:180px;position:relative;">' +
        '<span style="position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none;">🔍</span>' +
        '<input id="admin-search" oninput="filterAdminAccounts()" placeholder="Search clients..." style="width:100%;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:6px 10px 6px 30px;color:var(--text);font-family:var(--font-b);font-size:12px;outline:none;">' +
      '</div>' +
      '<select id="admin-sort" onchange="filterAdminAccounts()" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-family:var(--font-b);font-size:11px;cursor:pointer;">' +
        '<option value="name_asc">Name A→Z</option>' +
        '<option value="name_desc">Name Z→A</option>' +
        '<option value="plan">Plan</option>' +
        '<option value="users_desc">Most Users</option>' +
      '</select>' +
      '<select id="admin-filter-plan" onchange="filterAdminAccounts()" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-family:var(--font-b);font-size:11px;cursor:pointer;">' +
        '<option value="all">All Plans</option>' +
        '<option value="starter">Starter</option>' +
        '<option value="pro">Pro</option>' +
        '<option value="agency">Agency</option>' +
      '</select>' +
      '<select id="admin-filter-status" onchange="filterAdminAccounts()" style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-family:var(--font-b);font-size:11px;cursor:pointer;">' +
        '<option value="all">All Status</option>' +
        '<option value="active">Active</option>' +
        '<option value="inactive">Inactive</option>' +
      '</select>' +
    '</div>' +
    '<div id="admin-accounts-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:24px;">' +
    clientAccounts.map(a=>{
      const users = allProfiles.filter(p=>p.account_id===a.id);
      const planColor = {starter:'#3B82F6',pro:'#8B5CF6',agency:'#F25C05',enterprise:'#D97706'}[a.plan]||'#6688A8';
      const activeColor = a.active!==false ? '#22C55E' : '#EF4444';
      return '<div class="ag-acct-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
          '<div class="ag-acct-name">'+escHtml(a.company_name||a.name||'')+'</div>' +
          '<div style="display:flex;gap:4px;">' +
            '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;background:'+planColor+'22;color:'+planColor+';border:1px solid '+planColor+'44;text-transform:uppercase;">'+(a.plan||'starter')+'</span>' +
            '<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;background:'+activeColor+'22;color:'+activeColor+';border:1px solid '+activeColor+'44;">'+(a.active!==false?'Active':'Inactive')+'</span>' +
          '</div>' +
        '</div>' +
        '<div class="ag-acct-meta">'+users.length+' user'+(users.length!==1?'s':'')+
          (a.slug?' · <a href="/q/'+a.slug+'" target="_blank" style="color:var(--accent);text-decoration:none;font-size:10px;">/q/'+a.slug+'</a>':'')+
        '</div>' +
        '<div style="margin:10px 0 6px;border-top:1px solid var(--border);padding-top:8px;">' +
          users.map(u=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 0;">' +
            '<div style="font-size:11px;color:var(--mid);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
              '👤 <span style="font-weight:600;">'+escHtml(u.name||u.email||u.id.slice(0,8))+'</span>' +
              ' — <span style="color:var(--accent);font-weight:700;">'+u.role+'</span>' +
              (u.email?' <span style="color:var(--muted);font-size:10px;">'+escHtml(u.email)+'</span>':'')+
            '</div>' +
            '<div style="display:flex;gap:4px;flex-shrink:0;">' +
              '<button onclick="editUser(\''+u.id+'\',\''+escJs(u.name||'')+'\',\''+escJs(u.email||'')+'\',\''+u.role+'\',\''+a.id+'\')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:2px 8px;color:var(--mid);font-size:10px;cursor:pointer;" title="Edit user">✏️ Edit</button>' +
              '<button onclick="deleteUser(\''+u.id+'\',\''+escJs(u.name||u.email||'user')+'\')" style="background:none;border:1px solid var(--danger);border-radius:5px;padding:2px 8px;color:var(--danger);font-size:10px;cursor:pointer;" title="Delete user">🗑 Delete</button>' +
            '</div>' +
          '</div>').join('') +
        '</div>' +
        (a.notes?'<div style="font-size:10px;color:var(--muted);margin-top:4px;font-style:italic;">'+escHtml(a.notes)+'</div>':'')+
        '<div style="margin-top:8px;padding-top:6px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">'+
          '<span style="font-size:10px;color:var(--muted);">Credits:</span>'+
          '<span style="font-size:12px;font-weight:700;color:#4ade80;">'+(a.mailer_credits||0)+'</span>'+
          '<span style="font-size:10px;color:var(--muted);">paid</span>'+
          '<button onclick="adjustCredits(\''+a.id+'\')" style="background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);border-radius:5px;padding:2px 8px;color:#4ade80;font-size:10px;cursor:pointer;font-weight:700;" title="Adjust paid credits">✏️ Adjust</button>'+
        '</div>'+
        buildAdminTradeChips(a)+
        '<div style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;">'+
          '<button onclick="switchAccount(\''+a.id+'\');goTab(\'map\')" style="background:rgba(242,92,5,.18);border:1px solid rgba(242,92,5,.6);border-radius:5px;padding:3px 10px;color:var(--accent);font-size:10px;cursor:pointer;font-weight:700;" title="Switch to this company and take control">🔀 Switch To</button>'+
          '<button onclick="openAddUserModal(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\')" style="background:rgba(242,92,5,.12);border:1px solid rgba(242,92,5,.4);border-radius:5px;padding:3px 10px;color:var(--accent);font-size:10px;cursor:pointer;font-weight:700;" title="Add user to this account">➕ Add User</button>'+
          '<button onclick="setAccountSlug(\''+a.id+'\',\''+escHtml(a.slug||'')+'\')" style="background:none;border:1px solid var(--border);border-radius:5px;padding:3px 10px;color:var(--muted);font-size:10px;cursor:pointer;font-weight:600;" title="Set quote page slug">🔗 Set Slug</button>'+
          (a.slug?'<a href="/q/'+a.slug+'" target="_blank" style="background:rgba(242,92,5,.1);border:1px solid rgba(242,92,5,.3);border-radius:5px;padding:3px 10px;color:var(--accent);font-size:10px;font-weight:600;text-decoration:none;">↗ /q/'+a.slug+'</a>':'') +
          '<button onclick="toggleAccountActive(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\',' +(a.active!==false)+'" style="background:none;border:1px solid '+(a.active!==false?'#22C55E':'#6B7280')+';border-radius:5px;padding:3px 10px;color:'+(a.active!==false?'#22C55E':'#9CA3AF')+';font-size:10px;cursor:pointer;font-weight:600;" title="'+(a.active!==false?'Deactivate account':'Reactivate account')+'">'+(a.active!==false?'⏸ Deactivate':'▶ Reactivate')+'</button>'+
        '<button onclick="toggleTracerfy(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\','  +(a.tracerfy_enabled?'true':'false')+')" style="background:none;border:1px solid '+(a.tracerfy_enabled?'#A78BFA':'#4B5563')+';border-radius:5px;padding:3px 10px;color:'+(a.tracerfy_enabled?'#A78BFA':'#9CA3AF')+';font-size:10px;cursor:pointer;font-weight:600;" title="Toggle Tracerfy skip-trace">'+(a.tracerfy_enabled?'📞 ON':'📞 OFF')+'</button>'+
        '<button onclick="deleteClientAccount(\''+a.id+'\',\''+escJs(a.company_name||a.name||'this account')+'\')" style="background:none;border:1px solid var(--danger);border-radius:5px;padding:3px 10px;color:var(--danger);font-size:10px;cursor:pointer;font-weight:600;margin-left:auto;" title="Delete account">🗑 Delete</button>'+
        '</div>'+
        '</div>';
    }).join('') +
    '</div>' +
    // Two-column bottom section
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px;margin-top:8px;">' +
    // LEFT COLUMN: Onboard + Add Rep
    '<div>' +
      '<button onclick="showAddAccountForm()" class="btn-primary" style="width:100%;margin-bottom:12px;">+ Onboard New Client</button>' +
      '<div id="add-account-form" style="display:none;background:var(--card);border:1px solid var(--border);border-radius:9px;padding:16px;margin-bottom:14px;">' +
        '<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:12px;">NEW CLIENT ACCOUNT</div>' +
        '<div class="frow">' +
          '<div class="fg"><label class="fl" for="new-acct-name">Company Name *</label><input class="fi" id="new-acct-name" placeholder="Rapid Roof LLC"></div>' +
          '<div class="fg"><label class="fl" for="new-acct-email">Admin Email *</label><input class="fi" id="new-acct-email" placeholder="owner@rapidroof.com" type="email"></div>' +
        '</div>' +
        '<div class="frow">' +
          '<div class="fg"><label class="fl" for="new-acct-pass">Temp Password *</label><input class="fi" id="new-acct-pass" placeholder="min 6 chars" type="password"></div>' +
          '<div class="fg"><label class="fl" for="new-acct-phone">Company Phone</label><input class="fi" id="new-acct-phone" placeholder="(313) 555-0100" oninput="autoFormatPhone(this)"></div>' +
        '</div>' +
        '<div class="frow">' +
          '<div class="fg"><label class="fl" for="new-acct-website">Company Website</label><input class="fi" id="new-acct-website" placeholder="https://rapidroof.com" type="url"></div>' +
          '<div class="fg"><label class="fl" for="new-acct-booking">Booking / QR URL <span style="font-weight:400;color:var(--muted);font-size:10px;">(Calendly, etc.)</span></label><input class="fi" id="new-acct-booking" placeholder="https://calendly.com/..."></div>' +
        '</div>' +
        '<div class="fg"><label class="fl" for="new-acct-street">Street Address</label><input class="fi" id="new-acct-street" placeholder="32640 Dequindre Rd, Suite B"></div>'+
        '<div class="frow">'+
          '<div class="fg" style="flex:2;"><label class="fl" for="new-acct-city">City</label><input class="fi" id="new-acct-city" placeholder="Sterling Heights"></div>'+
          '<div class="fg" style="flex:1;"><div class="fl">State</div>'+
            '<select class="fs" id="new-acct-state">'+
              '<option value="">—</option>'+
              (function(){var st='AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY';return st.split(',').map(function(s){return '<option value="'+s+'"'+(s==='MI'?' selected':'')+'>'+s+'</option>';}).join('');})() +
            '</select>'+
          '</div>'+
          '<div class="fg" style="flex:1;"><label class="fl" for="new-acct-zip">Zip</label><input class="fi" id="new-acct-zip" placeholder="48310" maxlength="5"></div>'+
        '</div>' +
        '<div class="frow">' +
          '<div class="fg"><div class="fl">Plan</div>' +
            '<select class="fs" id="new-acct-plan">' +
              '<option value="starter">Starter</option>' +
              '<option value="pro">Pro</option>' +
              '<option value="agency">Agency</option>' +
            '</select>' +
          '</div>' +

        '</div>' +
        '<div style="margin-top:10px;">'+
          '<div class="fg"><div class="fl">Quote Page Slug <span style="font-weight:400;color:var(--muted);font-size:10px;">(e.g. rapidroof → /q/rapidroof)</span></div>'+
          '<input class="fi" id="new-acct-slug" placeholder="rapidroof" oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9_-]/g,\'\')"></div>'+
        '</div>'+
        '<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;">'+
          '<div style="font-size:11px;font-weight:700;color:#1a7f4b;letter-spacing:.5px;margin-bottom:10px;">⚡ GHL CONNECTION <span style="font-weight:400;color:var(--muted);font-size:10px;text-transform:none;letter-spacing:0;">(optional)</span></div>'+
          '<div class="fg"><label class="fl" for="new-acct-ghl-key">GHL Location API Key</label><input class="fi" id="new-acct-ghl-key" placeholder="pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" type="password"></div>'+
          '<div class="frow">'+
            '<div class="fg"><label class="fl" for="new-acct-ghl-loc">GHL Location ID</label><input class="fi" id="new-acct-ghl-loc" placeholder="gz85VU6SxGXS7lqHAQGx"></div>'+
            '<div class="fg"><label class="fl" for="new-acct-ghl-pipe">Pipeline ID</label><input class="fi" id="new-acct-ghl-pipe" placeholder="bxskBIBdbklHry0B63qx"></div>'+
          '</div>'+
          '<div style="font-size:10px;color:var(--muted);margin-bottom:10px;">Find these in the client\'s GHL sub-account \u2192 Settings \u2192 Integrations. Leave blank to skip.</div>'+
        '</div>'+
        '<button id="btn-create-acct" onclick="createAccount()" class="btn-primary">Create Account + Admin Login</button>' +
        '<div id="new-acct-result" style="margin-top:10px;font-size:12px;"></div>' +
      '</div>' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);margin:18px 0 10px;">Add Rep / Admin to Existing Account</div>' +
      renderAddUserForm(clientAccounts) +
    '</div>' +
    // RIGHT COLUMN: Super Admins + Migration
    '<div>' +
      '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#8B5CF6;margin-bottom:12px;">🛡 Super Admins — BidDrop Platform Access</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Super Admins can switch between all client accounts, access the Agency view, manage all clients, and configure platform settings. They cannot delete the primary owner.</div>' +
      allProfiles.filter(p=>p.role==='super_admin').map(p=>{
        const isOwner = p.email===OWNER_EMAIL;
        return '<div style="background:var(--card);border:1px solid '+(isOwner?'#8B5CF6':'var(--border)')+';border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">'+
          '<div>'+
            '<div style="font-weight:700;font-size:13px;">'+escHtml(p.name||p.email||p.id.slice(0,8))+(isOwner?' <span style="font-size:9px;background:#8B5CF622;color:#8B5CF6;border:1px solid #8B5CF644;border-radius:6px;padding:1px 6px;font-weight:700;">PRIMARY OWNER</span>':'')+'</div>'+
            '<div style="font-size:11px;color:var(--muted);">'+escHtml(p.email||'')+'</div>'+
          '</div>'+
          (!isOwner && currentUser && currentUser.email===OWNER_EMAIL
            ? '<button onclick="removeSuperAdmin(\''+p.id+'\',\''+escJs(p.email||p.id)+'\')" style="background:none;border:1px solid var(--danger);border-radius:6px;padding:4px 10px;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;">Remove</button>'
            : '')+
          '</div>';
      }).join('') +
      '<div style="background:var(--card);border:1px solid var(--border);border-radius:9px;padding:14px;margin-top:8px;">'+
        '<div style="font-size:11px;font-weight:700;color:var(--accent);margin-bottom:10px;">+ Invite New Super Admin</div>'+
        '<div class="frow">'+
          '<div class="fg"><label class="fl" for="new-sa-name">Full Name</label><input class="fi" id="new-sa-name" placeholder="Jane Smith"></div>'+
          '<div class="fg"><label class="fl" for="new-sa-email">Email *</label><input class="fi" id="new-sa-email" type="email" placeholder="jane@agency.com"></div>'+
        '</div>'+
        '<div class="fg"><label class="fl" for="new-sa-pass">Temporary Password *</label><input class="fi" id="new-sa-pass" type="password" placeholder="min 6 chars"></div>'+
        '<button onclick="createSuperAdmin()" class="btn-primary" style="margin-top:6px;">Create Super Admin Account</button>'+
        '<div id="new-sa-result" style="margin-top:8px;font-size:12px;"></div>'+
      '</div>' +
      '<hr style="border:none;border-top:1px solid var(--border);margin:24px 0 16px;">'+
      '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#22C55E;margin-bottom:8px;">🛠 Database Maintenance</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Run once to add performance indexes for 30,000+ pin accounts. Safe to run multiple times.</div>'+
      '<button onclick="runMigration()" style="background:linear-gradient(135deg,#22C55E,#16A34A);border:none;border-radius:8px;padding:10px 22px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.5px;">⚡ Run Migration</button>'+
      '<div id="migration-result" style="margin-top:10px;font-size:12px;"></div>'+
      '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0 14px;">'+
      '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#F25C05;margin-bottom:8px;">🎨 Canvas Templates</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:12px;">Load the 6 built-in postcard templates (Storm, Solar, Gutters, Roofing, Alert, Estimate Ready) into the canvas editor. Safe to run once — skips if templates already exist.</div>'+
      '<button onclick="seedCanvasTemplates()" style="background:linear-gradient(135deg,#F25C05,#c44a00);border:none;border-radius:8px;padding:10px 22px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.5px;">\uD83C\uDFA8 Load Default Templates</button>'+
      '<div id="seed-templates-result" style="margin-top:10px;font-size:12px;"></div>'+
      '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0 14px;">'+
      '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#22C55E;margin-bottom:8px;">\uD83D\uDD25 Blitz Promo — Platform Sale Toggle</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:14px;">When ON, all clients see the promo badge in the Send Postcard popup. Configure the buy/get numbers and badge label below.</div>'+
      '<div id="blitz-promo-section" style="background:var(--card);border:1px solid var(--border);border-radius:9px;padding:16px;">'+
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">'+
          '<div id="bp-toggle" onclick="toggleBlitzPromo()" style="width:44px;height:24px;border-radius:12px;background:var(--border);cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;">'+
            '<div id="bp-knob" style="position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s;"></div>'+
          '</div>'+
          '<div>'+
            '<div id="bp-status-label" style="font-size:13px;font-weight:700;color:var(--muted);">Promo OFF</div>'+
            '<div style="font-size:10px;color:var(--muted);">Toggle to activate the sale for all clients</div>'+
          '</div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Buy (credits spent)</label>'+
            '<input id="bp-buy" type="number" min="1" max="20" value="3" oninput="autoUpdateBlitzPromoLabel()" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:14px;font-weight:700;text-align:center;">'+
          '</div>'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Get (postcards total)</label>'+
            '<input id="bp-get" type="number" min="1" max="20" value="5" oninput="autoUpdateBlitzPromoLabel()" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:14px;font-weight:700;text-align:center;">'+
          '</div>'+
        '</div>'+
        '<div style="margin-bottom:12px;">'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Badge Label (shown to clients)</label>'+
          '<input id="bp-label" type="text" maxlength="60" placeholder="Buy 3 Get 5 Total!" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
        '<div id="bp-preview" style="background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:7px;padding:8px 12px;font-size:12px;color:#22C55E;font-weight:700;margin-bottom:12px;">\uD83D\uDD25 Preview: Buy 3 Get 5 Total!</div>'+
        '<button onclick="saveBlitzPromo()" style="width:100%;background:linear-gradient(135deg,#22C55E,#16A34A);border:none;border-radius:8px;padding:10px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.5px;">\uD83D\uDCBE Save Promo Settings</button>'+
        '<div id="bp-result" style="margin-top:8px;font-size:12px;"></div>'+
      '</div>'+
      '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0 14px;">'+
      '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#F97316;margin-bottom:4px;">\uD83D\uDCDD Global Postcard Defaults</div>'+
      '<div style="font-size:11px;color:var(--muted);margin-bottom:14px;">Set site-wide default text for all postcard fields. Individual roofers can override these in their own Settings. Leave blank to use the built-in hardcoded defaults.</div>'+
      '<div id="gpd-section" style="background:var(--card);border:1px solid var(--border);border-radius:9px;padding:16px;">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Headline 1 (Front — large text)</label>'+
            '<input id="gpd-headline1" type="text" placeholder="It might be time for a new roof." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
          '</div>'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Headline 2 (Front — sub-headline)</label>'+
            '<input id="gpd-headline2" type="text" placeholder="But don&#39;t worry, we can help!" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
          '</div>'+
        '</div>'+
        '<div style="margin-bottom:12px;">'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Hook / Intro (Back — main body paragraph)</label>'+
          '<textarea id="gpd-hook" rows="3" placeholder="We built a project estimate for your home using satellite measurements and current pricing..." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
        '</div>'+
        '<div style="margin-bottom:12px;">'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Why We Reached Out (Back — secondary paragraph)</label>'+
          '<textarea id="gpd-why" rows="3" placeholder="We prepare estimates before we reach out so you have real numbers to work with from the start..." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Quote / Testimonial (Back — optional)</label>'+
            '<textarea id="gpd-quote" rows="2" placeholder="Leave blank to hide" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
          '</div>'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Guarantee / Disclaimer (Back — small print)</label>'+
            '<textarea id="gpd-guarantee" rows="2" placeholder="Prepared from satellite data. Your contractor will verify details on-site." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
          '</div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">QR Scan CTA (e.g. SCAN TO BOOK)</label>'+
            '<input id="gpd-scan-cta" type="text" placeholder="SCAN TO BOOK" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
          '</div>'+
          '<div>'+
            '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">QR Scan Sub-label</label>'+
            '<input id="gpd-scan-sub" type="text" placeholder="No-pressure booking" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
          '</div>'+
        '</div>'+
        '<div style="margin-bottom:12px;">'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Letter Hook / Intro (Estimate letter body)</label>'+
          '<textarea id="gpd-hook-letter" rows="3" placeholder="We put together a project estimate for your home based on satellite measurements..." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
        '</div>'+
        '<div style="margin-bottom:14px;">'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Letter Why Received (Estimate letter — why they got this)</label>'+
          '<textarea id="gpd-why-received" rows="3" placeholder="We use satellite imagery and current pricing data to build project estimates for homeowners in our service area..." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
        '</div>'+
        '<button onclick="saveGlobalPostcardDefaults()" style="width:100%;background:linear-gradient(135deg,#F97316,#c44a00);border:none;border-radius:8px;padding:10px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.5px;">\uD83D\uDCBE Save Global Postcard Defaults</button>'+
        '<div id="gpd-result" style="margin-top:8px;font-size:12px;"></div>'+
      '</div>'+
    '</div>' +
    // ── Global Default Content (CMS) ─────────────────────────────────────────
    '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0 14px;">'+
    '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#F97316;margin-bottom:4px;">🌐 Global Default Content</div>'+
    '<div style="font-size:11px;color:var(--muted);margin-bottom:14px;">CMS for all client-facing copy on the homeowner project report page. Individual roofers can override in their Settings. Leave blank to use the built-in defaults. Changes take effect immediately for all accounts that haven\'t customized that field.</div>'+
    '<div id="gcd-section" style="background:var(--card);border:1px solid var(--border);border-radius:9px;padding:16px;">'+
      // ── Gate Screen ──
      '<div style="font-size:10px;font-weight:700;color:#F97316;letter-spacing:.6px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">GATE SCREEN (Lead Capture)</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Gate Title</label>'+
          '<input id="gcd-gate-title" type="text" placeholder="Your Project Report Is Ready" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Gate Button Text</label>'+
          '<input id="gcd-gate-btn" type="text" placeholder="View My Report →" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
      '</div>'+
      '<div style="margin-bottom:12px;">'+
        '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Gate Subtitle</label>'+
        '<textarea id="gcd-gate-sub" rows="2" placeholder="This report was prepared for your property using remote property analysis and current project data. Enter your information to continue." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
      '</div>'+
      '<div style="margin-bottom:16px;">'+
        '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Privacy Notice</label>'+
        '<input id="gcd-gate-privacy" type="text" placeholder="We only share your information with the contractor who requested this report." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
      '</div>'+
      // ── Hero ──
      '<div style="font-size:10px;font-weight:700;color:#F97316;letter-spacing:.6px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">HERO SECTION</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Hero Tag (eyebrow label)</label>'+
          '<input id="gcd-hero-tag" type="text" placeholder="Roofing Project Report" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Hero Headline (use \\n for line breaks)</label>'+
          '<input id="gcd-hero-headline" type="text" placeholder="Your Roofing Project, Organized." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
      '</div>'+
      // ── Rep Bio ──
      '<div style="font-size:10px;font-weight:700;color:#F97316;letter-spacing:.6px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">REP / ADVISOR BIO</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Default Rep Title</label>'+
          '<input id="gcd-rep-title" type="text" placeholder="Project Advisor" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Video Section Label</label>'+
          '<input id="gcd-video-title" type="text" placeholder="A message from your contractor" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
      '</div>'+
      '<div style="margin-bottom:16px;">'+
        '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Default Rep Bio (shown when roofer hasn\'t set an inspection note)</label>'+
        '<textarea id="gcd-rep-bio" rows="3" placeholder="Welcome! This report was prepared to give you a clear starting point for your roofing project. When you\'re ready, we\'ll review the details with you, answer your questions, and confirm everything during an on-site visit." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
      '</div>'+
      // ── About / Reviews / CTA ──
      '<div style="font-size:10px;font-weight:700;color:#F97316;letter-spacing:.6px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">ABOUT, REVIEWS & CTA SECTIONS</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">About Section Title</label>'+
          '<input id="gcd-about-title" type="text" placeholder="Meet Your Contractor." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Reviews Section Title</label>'+
          '<input id="gcd-reviews-title" type="text" placeholder="What Customers Are Saying." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">CTA Headline</label>'+
          '<input id="gcd-cta-title" type="text" placeholder="Ready When You Are." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Sticky Bar Tag (e.g. Licensed &amp; Insured)</label>'+
          '<input id="gcd-sticky-tag" type="text" placeholder="Licensed &amp; Insured" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
        '</div>'+
      '</div>'+
      '<div style="margin-bottom:12px;">'+
        '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">CTA Subheading</label>'+
        '<textarea id="gcd-cta-sub" rows="2" placeholder="If you\'d like to move forward, schedule a convenient inspection and we\'ll verify the project details together." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
      '</div>'+
      // ── Disclaimers ──
      '<div style="font-size:10px;font-weight:700;color:#F97316;letter-spacing:.6px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">DISCLAIMERS & FOOTER</div>'+
      '<div style="margin-bottom:12px;">'+
        '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Footer Disclaimer (bottom of page)</label>'+
        '<textarea id="gcd-footer-disclaimer" rows="2" placeholder="This project report was created for you by the contractor listed above. By viewing this page, you acknowledge that your interaction may be tracked for advertising purposes..." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Property / Pricing Disclaimer</label>'+
          '<textarea id="gcd-property-disclaimer" rows="2" placeholder="Pricing is an estimate based on property data. Final cost confirmed during on-site inspection." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
        '</div>'+
        '<div>'+
          '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Material Disclaimer</label>'+
          '<textarea id="gcd-material-disclaimer" rows="2" placeholder="Material pricing reflects current market rates and may change. Your contractor will confirm at time of project." style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
        '</div>'+
      '</div>'+
      // ── SMS / Email Templates ──
      '<div style="font-size:10px;font-weight:700;color:#F97316;letter-spacing:.6px;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);">SMS & EMAIL TEMPLATES</div>'+
      '<div style="margin-bottom:12px;">'+
        '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Default SMS Template (sent to homeowner — use {{name}}, {{url}})</label>'+
        '<textarea id="gcd-sms-template" rows="3" placeholder="Hi {{name}}, your roofing project report is ready. View it here: {{url}}" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;resize:vertical;"></textarea>'+
      '</div>'+
      '<div style="margin-bottom:16px;">'+
        '<label style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Default Email Subject</label>'+
        '<input id="gcd-email-subject" type="text" placeholder="Your Roofing Project Report Is Ready" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);font-size:13px;">'+
      '</div>'+
      '<button onclick="saveGlobalContentDefaults()" style="width:100%;background:linear-gradient(135deg,#F97316,#c44a00);border:none;border-radius:8px;padding:10px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.5px;">💾 Save Global Content Defaults</button>'+
      '<div id="gcd-result" style="margin-top:8px;font-size:12px;"></div>'+
    '</div>'+
    '</div>' +
    '</div>');
  // Load current promo state from DB and populate the UI
  loadBlitzPromoState();
  // Load current global postcard defaults
  loadGlobalPostcardDefaults();
  // Load current global content defaults
  loadGlobalContentDefaults();
}

async function seedCanvasTemplates(){
  const btn = document.querySelector('[onclick="seedCanvasTemplates()"]');
  const res = document.getElementById('seed-templates-result');
  if(btn){ btn.disabled=true; btn.textContent='Loading…'; }
  if(res) res.innerHTML='<span style="color:var(--muted)">Fetching template data…</span>';
  try{
    // Load seed data from the seed_templates.json file bundled with the app
    const seedResp = await fetch('/seed_templates.json');
    if(!seedResp.ok) throw new Error('Could not load seed_templates.json ('+seedResp.status+')');
    const templates = await seedResp.json();
    // Get the service key from Supabase client for auth
    const sess = (await sb.auth.getSession()).data.session;
    if(!sess) throw new Error('Not authenticated');
    const r = await fetch('/api/canvas?action=seed', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+sess.access_token },
      body: JSON.stringify({ templates, admin_key: sess.access_token })
    });
    const data = await r.json();
    if(!r.ok) throw new Error(data.error || 'Seed failed ('+r.status+')');
    if(res) res.innerHTML='<span style="color:#22c55e">✅ '+data.inserted+' templates loaded successfully!</span>';
    toast('✅ '+data.inserted+' canvas templates loaded','success');
  } catch(e){
    if(res) res.innerHTML='<span style="color:#ef4444">❌ '+escHtml(e.message)+'</span>';
    toast('Seed failed: '+e.message,'error');
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='🎨 Load Default Templates'; }
  }
}

function renderAccountAdminPanel(profiles){
  return '<div style="margin-bottom:14px;">' +
    '<div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);margin-bottom:10px;">Team Members</div>' +
    profiles.map(u=>'<div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;">' +
      '<div>' +
      '<div style="font-weight:700;font-size:14px;">'+escHtml(u.name||'Unnamed')+'</div>' +
      '<div style="font-size:11px;color:var(--muted);">'+escHtml(u.email||'')+'</div>' +
      '</div>' +
      '<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:9px;background:var(--accent-dim);color:var(--accent);text-transform:uppercase;">'+u.role+'</span>' +
      '<button onclick="editTeamMember(\'' +u.id+ '\',\'' +escJs(u.name||'')+ '\',\'' +escJs(u.email||'')+ '\',\'' +escJs(u.phone||'')+ '\',\'' +escJs(u.role||'rep')+ '\')" style="background:none;border:1px solid var(--border);border-radius:5px;color:var(--muted);cursor:pointer;font-size:11px;padding:3px 10px;font-weight:600;white-space:nowrap;margin-left:6px;">✏️ Edit</button>' +
      '</div>').join('') +
    '</div>' +
    renderAddUserForm();
}

function renderAddUserForm(accounts){
  // Build account selector only for super_admin (accounts array passed in)
  const acctSelector = (accounts && accounts.length)
    ? '<div class="fg"><div class="fl">Account</div>' +
      '<select class="fs" id="new-user-account">' +
      accounts.map(a=>'<option value="'+a.id+'">'+escHtml(a.company_name||a.name||'')+'</option>').join('') +
      '</select></div>'
    : '';
  return '<div style="background:var(--card);border:1px solid var(--border);border-radius:9px;padding:16px;">' +
    '<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:10px;">ADD TEAM MEMBER</div>' +
    acctSelector +
    '<div class="fg"><label class="fl" for="new-user-name">Name</label><input class="fi" id="new-user-name" placeholder="Mike Johnson"></div>' +
    '<div class="fg"><label class="fl" for="new-user-email">Email</label><input class="fi" id="new-user-email" placeholder="mike@tmroofing.com" type="email"></div>' +
    '<div class="fg"><label class="fl" for="new-user-pass">Temp Password</label><input class="fi" id="new-user-pass" placeholder="min 6 chars" type="password"></div>' +
    '<div class="fg"><div class="fl">Role</div>' +
    '<select class="fs" id="new-user-role"><option value="rep">Rep (Field)</option><option value="admin">Admin</option></select></div>' +
    '<button onclick="createUser()" class="btn-primary">Create Login</button>' +
    '<div id="new-user-result" style="margin-top:8px;font-size:11px;"></div>' +
    '</div>';
}

function showAddAccountForm(){
  const f=document.getElementById('add-account-form');
  if(f) f.style.display = f.style.display==='none'?'block':'none';
}

async function setAccountSlug(accountId, currentSlug){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  bdPrompt('Set quote page slug (e.g. rapidroof → /q/rapidroof). Leave blank to remove.', currentSlug||'', async (newSlug)=>{
    if(newSlug === null) return;
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'');
    try {
      await adminAPI('patch-account', { accountId, updates: { slug: slug || null } });
      toast('Slug '+(slug?'set to /q/'+slug:'removed'),'success');
      renderAdminPanel();
    } catch(e) {
      toast(e.message||'Could not update slug','error');
    }
  });
}
async function createAccount(){
  const name   = document.getElementById('new-acct-name').value.trim();
  const email  = document.getElementById('new-acct-email').value.trim();
  const pass   = document.getElementById('new-acct-pass').value.trim();
  const phone  = document.getElementById('new-acct-phone').value.trim();
  const street = document.getElementById('new-acct-street').value.trim();
  const city   = document.getElementById('new-acct-city').value.trim();
  const state  = document.getElementById('new-acct-state').value.trim();
  const zip    = document.getElementById('new-acct-zip').value.trim();
  const addr   = [street, city, state, zip].filter(Boolean).join(', ');
  const plan    = document.getElementById('new-acct-plan').value;

  const website = document.getElementById('new-acct-website').value.trim();
  const booking  = document.getElementById('new-acct-booking').value.trim();
  const slug    = document.getElementById('new-acct-slug') ? document.getElementById('new-acct-slug').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'') : '';
  const ghlKey  = document.getElementById('new-acct-ghl-key').value.trim();
  const ghlLoc  = document.getElementById('new-acct-ghl-loc').value.trim();
  const ghlPipe = document.getElementById('new-acct-ghl-pipe').value.trim();
  if(!name||!email||!pass){toast('Company name, email and password are required','error');return;}
  if(pass.length<6){toast('Password must be at least 6 characters','error');return;}
  const resultEl = document.getElementById('new-acct-result');
  resultEl.textContent='Checking for duplicates…';resultEl.style.color='var(--muted)';
  const btn = document.getElementById('btn-create-acct');
  if(btn){btn.disabled=true;btn.textContent='Creating…';}
  try {
    // 0. Duplicate detection: check for existing account with same company name
    const {data: dupAccts} = await sb.from('accounts')
      .select('id,company_name')
      .ilike('company_name', name)
      .limit(1);
    if(dupAccts && dupAccts.length){
      const dup = dupAccts[0];
      const proceed = await new Promise(resolve => {
        bdConfirm(
          `An account named "${dup.company_name}" already exists (ID: ${dup.id}).\n\nCreate another one anyway?`,
          () => resolve(true), () => resolve(false)
        );
      });
      if(!proceed){
        resultEl.textContent='';
        if(btn){btn.disabled=false;btn.textContent='Create Account + Admin Login';}
        return;
      }
    }
    // Also check if email is already tied to an active profile
    const {data: dupProf} = await sb.from('user_profiles')
      .select('id,email,account_id')
      .eq('email', email.toLowerCase())
      .neq('role','deleted')
      .limit(1);
    if(dupProf && dupProf.length){
      const proceed = await new Promise(resolve => {
        bdConfirm(
          `Email "${email}" is already registered to an active account.\n\nProceed anyway? (This will reset their password and re-link their profile.)`,
          () => resolve(true), () => resolve(false)
        );
      });
      if(!proceed){
        resultEl.textContent='';
        if(btn){btn.disabled=false;btn.textContent='Create Account + Admin Login';}
        return;
      }
    }
    resultEl.textContent='Creating account…';
    // 1. Create account row
    const {data:acct, error:acctErr} = await sb.from('accounts').insert({
      name, company_name:name,
      company_phone: phone||null,
      company_addr: addr||null,
      plan,
      active: true,
      created_by: currentUser.id,
      ...(website ? {company_website: website}  : {}),
      ...(booking  ? {booking_url: booking}       : {}),
      ...(ghlKey  ? {ghl_api_key: ghlKey}        : {}),
      ...(ghlLoc  ? {ghl_location_id: ghlLoc}    : {}),
      ...(ghlPipe ? {ghl_pipeline_id: ghlPipe}   : {}),
      ...(slug    ? {slug: slug}                  : {})
    }).select().single();
    if(acctErr) throw acctErr;
    // 2. Create auth user via secure API (service key stays server-side)
    const adminData = await adminAPI('create-user', { email, password:pass, name });
    const userId = adminData.id;
    if(!userId) throw new Error('No user ID returned');
    // 3. Create user profile as admin (upsert handles re-registration of previously deleted accounts)
    const {error:profErr} = await sb.from('user_profiles').upsert({
      id: userId, account_id: acct.id, role:'admin', name, email, must_change_password:true
    }, { onConflict: 'id' });
    if(profErr) throw profErr;
    resultEl.innerHTML = '✅ <strong>'+escHtml(name)+'</strong> is live!<br>'
      +'<span style="font-size:11px;color:var(--muted);">Login: '+escHtml(email)+'<br>'
      +'Temp password: <code style="background:var(--card2);padding:2px 6px;border-radius:4px;">'+escHtml(pass)+'</code><br>'
      +(slug?'Quote page: <code style="background:var(--card2);padding:2px 6px;border-radius:4px;">/q/'+escHtml(slug)+'</code><br>':'')
      +'Account ID: <code style="background:var(--card2);padding:2px 4px;border-radius:4px;font-size:10px;">'+acct.id+'</code></span>';
    resultEl.style.color='var(--success)';
    toast('✅ '+name+' account created!','success');
    setTimeout(renderAdminPanel, 2000);
  } catch(e){
    resultEl.innerHTML='❌ '+escHtml(e.message);
    resultEl.style.color='var(--danger)';
    toast('Error: '+e.message,'error');
    if(btn){btn.disabled=false;btn.textContent='Create Account';}
  }
}

// ── Per-card Add User Modal ──────────────────────────────────────────────────
function openAddUserModal(accountId, accountName){
  // Remove any existing modal
  const existing = document.getElementById('add-user-modal');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'add-user-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:var(--accent);">ADD USER TO <span style="color:var(--text);">${escHtml(accountName)}</span></div>
        <button onclick="document.getElementById('add-user-modal').remove()" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;line-height:1;">✕</button>
      </div>
      <div class="fg"><label class="fl" for="aum-name">Name</label><input class="fi" id="aum-name" placeholder="Mike Johnson" autofocus></div>
      <div class="fg"><label class="fl" for="aum-email">Email</label><input class="fi" id="aum-email" placeholder="mike@company.com" type="email"></div>
      <div class="fg"><label class="fl" for="aum-pass">Temp Password</label><input class="fi" id="aum-pass" placeholder="min 6 chars" type="password"></div>
      <div class="fg"><div class="fl">Role</div>
        <select class="fs" id="aum-role"><option value="rep">Rep (Field)</option><option value="admin">Admin</option></select>
      </div>
      <div id="aum-result" style="font-size:12px;min-height:18px;margin-bottom:10px;"></div>
      <button id="aum-btn" onclick="submitAddUserModal('${accountId}','${escJs(accountName)}')" style="width:100%;background:var(--accent);color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;">CREATE LOGIN</button>
    </div>`;
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  setTimeout(()=>{ const n=document.getElementById('aum-name'); if(n) n.focus(); }, 80);
}
async function submitAddUserModal(accountId, accountName){
  const name  = (document.getElementById('aum-name')?.value||'').trim();
  const email = (document.getElementById('aum-email')?.value||'').trim();
  const pass  = (document.getElementById('aum-pass')?.value||'').trim();
  const role  = document.getElementById('aum-role')?.value || 'rep';
  const result= document.getElementById('aum-result');
  const btn   = document.getElementById('aum-btn');
  if(!name){ toast('Name is required','error'); return; }
  if(!email||!pass){ toast('Email and password required','error'); return; }
  if(pass.length < 6){ toast('Password must be at least 6 characters','error'); return; }
  result.textContent='Creating...'; result.style.color='var(--muted)';
  if(btn){ btn.disabled=true; btn.textContent='Creating...'; }
  try{
    const adminData = await adminAPI('create-user', { email, password:pass, name });
    const userId = adminData.id;
    if(!userId) throw new Error('No user ID returned from admin API');
    const {error:profErr} = await sb.from('user_profiles').insert({
      id: userId, account_id: accountId, role, name, email, must_change_password: true
    });
    if(profErr) throw profErr;
    result.innerHTML = '✅ <strong>'+escHtml(name)+'</strong> added to '+escHtml(accountName)+'!<br>'
      +'<span style="font-size:11px;color:var(--muted);">Email: '+escHtml(email)+'<br>'
      +'Temp password: <code style="background:var(--card2);padding:2px 6px;border-radius:4px;">'+escHtml(pass)+'</code></span>';
    result.style.color='var(--success)';
    toast('✅ '+name+' added to '+accountName,'success');
    if(btn){ btn.disabled=false; btn.textContent='CREATE ANOTHER'; }
    setTimeout(()=>{ const m=document.getElementById('add-user-modal'); if(m) m.remove(); renderAdminPanel(); }, 2500);
  }catch(e){
    result.innerHTML='❌ '+escHtml(e.message);
    result.style.color='var(--danger)';
    toast('❌ '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent='CREATE LOGIN'; }
  }
}
async function createUser(){
  const name  = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const pass  = document.getElementById('new-user-pass').value.trim();
  const role  = document.getElementById('new-user-role').value;
  const result= document.getElementById('new-user-result');
  // Super admin picks account from dropdown; account admins use their own account
  const acctSel = document.getElementById('new-user-account');
  const accountId = acctSel ? acctSel.value : (currentAccount ? currentAccount.id : null);
  if(!name){toast('Name is required','error');return;}
  if(!email||!pass){toast('Email and password required','error');return;}
  if(pass.length < 6){toast('Password must be at least 6 characters','error');return;}
  if(!accountId){toast('No account found — contact your super admin','error');return;}
  result.textContent='Creating...';result.style.color='var(--muted)';
  // Disable button to prevent double-submit
  const createBtn = document.querySelector('#admin-panel-body .btn-primary:last-of-type');
  if(createBtn){ createBtn.disabled=true; createBtn.textContent='Creating...'; }
  try {
    // Create user via secure server-side API (service key stays server-side)
    const adminData = await adminAPI('create-user', { email, password:pass, name });
    const userId = adminData.id;
    if(!userId) throw new Error('No user ID returned from admin API');
    // Create profile with must_change_password = true
    const {error:profErr} = await sb.from('user_profiles').insert({
      id: userId, account_id: accountId, role, name, email,
      must_change_password: true
    });
    if(profErr) throw profErr;
    // Send welcome email via Supabase's built-in email trigger
    // We use resetPasswordForEmail so the user gets a clean branded email
    // with a link back to BidDrop — but we also show the temp password in the message below
    // (Supabase doesn't support custom email body via anon key, so we send a magic-link style welcome)
    const companyName = S.cfg.companyName || 'BidDrop';
    // Build a simple welcome notification via the password reset email
    // (This sends a "Reset Password" email — we customise the template in Supabase dashboard)
    // For now, show the admin the temp password so they can relay it
    result.innerHTML = '✅ <strong>'+escHtml(name)+'</strong> created &amp; confirmed!<br>'
      +'<span style="font-size:11px;color:var(--muted);">Email: '+escHtml(email)+'<br>'
      +'Temp password: <code style="background:var(--card2);padding:2px 6px;border-radius:4px;">'+escHtml(pass)+'</code><br>'
      +'They must change it on first login.</span>';
    result.style.color='var(--success)';
    toast('✅ '+name+' created — no confirmation email needed!','success');
    setTimeout(renderAdminPanel, 3000);
  } catch(e){
    result.innerHTML='❌ <strong>'+escHtml(e.message)+'</strong>';
    result.style.color='var(--danger)';
    toast('❌ '+e.message,'error');
    // Re-enable button so admin can try again
    if(createBtn){ createBtn.disabled=false; createBtn.textContent='Create Login'; }
  }
}

// ═══════════════════════════════
//  SUPER ADMIN MANAGEMENT
// ═══════════════════════════════
async function createSuperAdmin(){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const name  = document.getElementById('new-sa-name').value.trim();
  const email = document.getElementById('new-sa-email').value.trim();
  const pass  = document.getElementById('new-sa-pass').value.trim();
  const result = document.getElementById('new-sa-result');
  if(!email){ toast('Email is required','error'); return; }
  result.textContent='Working…'; result.style.color='var(--muted)';
  try {
    let userId = null;
    let isExisting = false;

    // Step 1: Try to find existing auth user by email via secure API
    const listData = await adminAPI('list-users');
    const users = listData.users || listData || [];
    const found = users.find(u => u.email && u.email.toLowerCase()===email.toLowerCase());
    if(found){ userId = found.id; isExisting = true; }

    if(!isExisting){
      // User doesn't exist yet — create them (password required)
      if(!pass){ toast('Password is required for new accounts','error'); result.textContent=''; return; }
      if(pass.length<6){ toast('Password must be at least 6 characters','error'); result.textContent=''; return; }
      const adminData = await adminAPI('create-user', { email, password:pass, name });
      userId = adminData.id;
      if(!userId) throw new Error('No user ID returned');
    } else if(pass && pass.length>=6){
      // Existing user — update their password if one was provided
      await adminAPI('reset-password', { userId, password:pass });
    }

    // Step 2: Upsert user_profile to super_admin (works whether profile exists or not)
    const {error:profErr} = await sb.from('user_profiles').upsert({
      id: userId, account_id: null, role: 'super_admin',
      name: name||email.split('@')[0], email,
      must_change_password: pass ? true : false
    }, { onConflict: 'id' });
    if(profErr) throw profErr;

    const modeLabel = isExisting ? 'promoted to Super Admin' : 'created as Super Admin';
    result.innerHTML = '✅ <strong>'+escHtml(name||email)+'</strong> '+modeLabel+'!<br>'+
      '<span style="font-size:11px;color:var(--muted);">Email: '+escHtml(email)+'<br>'+
      (pass ? 'Password: <code style="background:var(--card2);padding:2px 6px;border-radius:4px;">'+escHtml(pass)+'</code>' : 'Password unchanged — they can use their existing password.')+'</span>';
    result.style.color='var(--success)';
    toast('✅ Super Admin '+(isExisting?'promoted':'created')+': '+escHtml(email),'success');
    setTimeout(renderAdminPanel, 2500);
  } catch(e){
    result.innerHTML='❌ '+escHtml(e.message);
    result.style.color='var(--danger)';
    toast('❌ '+e.message,'error');
  }
}

async function runMigration(){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const resultEl = document.getElementById('migration-result');
  const btn = document.querySelector('[onclick="runMigration()"]');
  if(resultEl) resultEl.innerHTML = '<span style="color:var(--muted);">Running…</span>';
  if(btn){ btn.disabled=true; btn.textContent='⏳ Running…'; }
  try {
    const data = await adminAPI('run-migration');
    const results = data.results || [];
    const allOk = results.every(r=>r.ok||r.status===200||r.status===204);
    if(resultEl){
      resultEl.innerHTML = (allOk ? '✅ Migration complete! ' : '⚠️ Some steps had issues. ') +
        '<span style="font-size:10px;color:var(--muted);">' +
        results.map(r=>'<br>'+escHtml(r.sql)+'... '+(r.ok?'✅':'status '+r.status)).join('') +
        '</span>';
      resultEl.style.color = allOk ? 'var(--success)' : 'var(--warning)';
    }
    toast(allOk ? '✅ Migration complete!' : '⚠️ Migration finished with warnings', allOk ? 'success' : 'info');
  } catch(e){
    if(resultEl){ resultEl.innerHTML='❌ '+escHtml(e.message); resultEl.style.color='var(--danger)'; }
    toast('❌ Migration failed: '+e.message,'error');
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='⚡ Run Migration'; }
  }
}

async function removeSuperAdmin(userId, emailOrId){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  // Only the primary owner can remove other super_admins
  if(!currentUser || currentUser.email!==OWNER_EMAIL){
    toast('Only the primary owner can remove super admins','error');
    return;
  }
  bdConfirm('Remove super_admin access for '+emailOrId+'?\n\nThis will demote them to a regular user (no account).', async ()=>{
    try {
      const {error} = await sb.from('user_profiles').update({role:'rep',account_id:null}).eq('id',userId);
      if(error) throw error;
      toast('✅ Super admin removed: '+escHtml(emailOrId),'success');
      renderAdminPanel();
    } catch(e){
      toast('❌ '+e.message,'error');
    }
  });
}

// ── USER MANAGEMENT (Super Admin) ────────────────────────────────────────────
function editUser(userId, name, email, role, accountId){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  document.getElementById('eu-id').value = userId;
  document.getElementById('eu-account-id').value = accountId;
  document.getElementById('eu-name').value = name;
  document.getElementById('eu-email').value = email;
  document.getElementById('eu-role').value = role === 'admin' ? 'admin' : 'rep';
  document.getElementById('eu-password').value = '';
  document.getElementById('eu-result').textContent = '';
  openM('m-edit-user');
}

async function saveUserEdits(){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const userId    = document.getElementById('eu-id').value;
  const accountId = document.getElementById('eu-account-id').value;
  const name      = document.getElementById('eu-name').value.trim();
  const email     = document.getElementById('eu-email').value.trim();
  const role      = document.getElementById('eu-role').value;
  const password  = document.getElementById('eu-password').value;
  const msgEl     = document.getElementById('eu-result');
  if(!name){ msgEl.style.color='var(--danger)'; msgEl.textContent='Name is required.'; return; }
  if(!email){ msgEl.style.color='var(--danger)'; msgEl.textContent='Email is required.'; return; }
  if(password && password.length < 6){ msgEl.style.color='var(--danger)'; msgEl.textContent='Password must be at least 6 characters.'; return; }
  msgEl.style.color='var(--muted)'; msgEl.textContent='Saving...';
  try {
    // Update user_profiles
    const {error:profErr} = await sb.from('user_profiles').update({name, email, role}).eq('id', userId);
    if(profErr) throw profErr;
    // Update auth email + optional password via admin API
    const updates = {email};
    if(password) updates.password = password;
    const authResult = await adminAPI('update-user', {userId, updates}); const authErr = authResult?.error || null;
    if(authErr) throw new Error(authErr);
    msgEl.style.color='#1a7f4b'; msgEl.textContent='✅ Saved!';
    setTimeout(()=>{ closeM('m-edit-user'); renderAdminPanel(); }, 800);
  } catch(e){
    msgEl.style.color='var(--danger)'; msgEl.textContent='❌ '+(e.message||'Could not save changes.');
  }
}

async function deleteUser(userId, displayName){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  bdConfirm(
    'Remove "'+displayName+'" from the team?\n\n'+
    '✓ Their login will be disabled immediately.\n'+
    '✓ All their pins, estimates, and mailers will be reassigned to the account owner.\n'+
    '✓ Their name stays attached to each record for tracking purposes.\n\n'+
    'This cannot be undone.',
    async ()=>{
      try {
        const delResult = await adminAPI('delete-user', {userId});
        const error = delResult?.error || null;
        if(error) throw new Error(error);
        const msg = delResult?.message || ('Removed '+escHtml(displayName)+' from the team.');
        toast('✅ '+msg, 'success');
        renderAdminPanel();
      } catch(e){
        toast('❌ '+(e.message||'Could not remove user.'),'error');
      }
    }
  );
}

// ═══════════════════════════════
//  DELETE CLIENT ACCOUNT
// ═══════════════════════════════
async function deleteClientAccount(accountId, accountName){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  bdConfirm(
    'Delete "'+accountName+'"?\n\n⚠️ This will permanently delete the account, all users, pins, estimates, and data.\n\nThis CANNOT be undone. Are you absolutely sure?',
    ()=>{
      bdPrompt('Type the account name to confirm deletion:\n"'+accountName+'"', '', async (confirmName)=>{
        if(!confirmName || confirmName.trim() !== accountName.trim()){
          toast('Account name did not match. Deletion cancelled.','error');
          return;
        }
  try {
    // 1. Cancel Stripe subscription first (if any) — prevents continued billing
    try {
      const cancelResult = await adminAPI('cancel-stripe-subscription', { accountId });
      if(cancelResult && cancelResult.subscription_id){
        console.log('[deleteClientAccount] Stripe subscription cancelled:', cancelResult.subscription_id);
      }
    } catch(stripeErr) {
      console.warn('[deleteClientAccount] Stripe cancel failed (non-fatal):', stripeErr.message);
      // Non-fatal — continue with account deletion even if Stripe cancel fails
    }
    // 2. Delete all user_profiles for this account first
    const {data: profiles} = await sb.from('user_profiles').select('id').eq('account_id', accountId);
    if(profiles && profiles.length){
      for(const p of profiles){
        await adminAPI('delete-user', {userId: p.id}).catch(()=>{});
      }
    }
    // 3. Delete the account record
    const {error} = await sb.from('accounts').delete().eq('id', accountId);
    if(error) throw error;
        toast('✅ Account "'+accountName+'" deleted.','success');
        renderAdminPanel();
      } catch(e){
        toast('❌ '+(e.message||'Could not delete account.'),'error');
      }
      }); // end bdPrompt
    }
  ); // end bdConfirm
}

async function toggleAccountActive(accountId, accountName, currentlyActive){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const newState = !currentlyActive;
  const isDeactivating = !newState;
  const confirmMsg = isDeactivating
    ? 'Deactivate "'+accountName+'"?\n\nThis will:\n• Mark the account inactive (they cannot log in)\n• Cancel their Stripe subscription at period end\n\nTheir data is preserved and can be reactivated.'
    : 'Reactivate "'+accountName+'"?\n\nThis will restore their access to BidDrop.';
  bdConfirm(confirmMsg, async ()=>{
  try {
    // 1. Update active flag in DB
    const {error} = await sb.from('accounts').update({active: newState}).eq('id', accountId);
    if(error) throw error;
    // 2. If deactivating, cancel their Stripe subscription at period end
    if(isDeactivating){
      try {
        const cancelResult = await adminAPI('cancel-stripe-subscription', { accountId });
        if(cancelResult && cancelResult.subscription_id){
          toast('⏸ Account deactivated + Stripe subscription cancelled at period end: '+accountName, 'success');
        } else {
          // No subscription found — just deactivated
          toast('⏸ Account deactivated (no Stripe subscription found): '+accountName, 'success');
        }
      } catch(stripeErr){
        // Stripe cancel failed — still deactivated in DB, warn super admin
        console.warn('[toggleAccountActive] Stripe cancel failed:', stripeErr.message);
        toast('⏸ Account deactivated, but Stripe cancel failed: '+stripeErr.message, 'error');
      }
    } else {
      toast('✅ Account reactivated: '+accountName, 'success');
    }
    // Update local cache
    if(_adminPanelData && _adminPanelData.clientAccounts){
      const acct = _adminPanelData.clientAccounts.find(a=>a.id===accountId);
      if(acct) acct.active = newState;
    }
    renderAdminPanel();
  } catch(e){
    toast('❌ '+(e.message||'Could not update account status.'),'error');
  }
  }); // end bdConfirm
}
async function toggleTracerfy(accountId, accountName, currentlyEnabled){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const newState = !currentlyEnabled;
  try {
    const {error} = await sb.from('accounts').update({tracerfy_enabled: newState}).eq('id', accountId);
    if(error) throw error;
    if(_adminPanelData && _adminPanelData.clientAccounts){
      const acct = _adminPanelData.clientAccounts.find(a=>a.id===accountId);
      if(acct) acct.tracerfy_enabled = newState;
    }
    toast((newState ? '✅ Tracerfy enabled for ' : '🚫 Tracerfy disabled for ')+accountName, 'success');
    renderAdminPanel();
  } catch(e){
    toast('❌ '+(e.message||'Could not update Tracerfy status.'),'error');
  }
}


// ── BLITZ PROMO ADMIN FUNCTIONS ──────────────────────────────────────────────

let _blitzPromoState = { enabled: false, buy: 3, get: 5, label: 'Buy 3 Get 5 Total!' };

async function loadBlitzPromoState(){
  try {
    const r = await fetch('/api/admin?action=get-blitz-promo', { credentials: 'include' });
    if(!r.ok) return;
    const data = await r.json();
    const cfg = data.config || { buy: 3, get: 5, label: 'Buy 3 Get 5 Total!' };
    _blitzPromoState = { enabled: !!data.enabled, buy: cfg.buy||3, get: cfg.get||5, label: cfg.label||'Buy 3 Get 5 Total!' };
    _applyBlitzPromoUI();
  } catch(e){ console.warn('loadBlitzPromoState:', e.message); }
}

function _applyBlitzPromoUI(){
  const toggle = document.getElementById('bp-toggle');
  const knob   = document.getElementById('bp-knob');
  const status = document.getElementById('bp-status-label');
  const buyEl  = document.getElementById('bp-buy');
  const getEl  = document.getElementById('bp-get');
  const lblEl  = document.getElementById('bp-label');
  const prev   = document.getElementById('bp-preview');
  if(!toggle) return;
  const on = _blitzPromoState.enabled;
  toggle.style.background = on ? '#22C55E' : 'var(--border)';
  if(knob) knob.style.left = on ? '24px' : '4px';
  if(status){ status.textContent = on ? 'Promo ON 🟢' : 'Promo OFF'; status.style.color = on ? '#22C55E' : 'var(--muted)'; }
  if(buyEl) buyEl.value = _blitzPromoState.buy;
  if(getEl) getEl.value = _blitzPromoState.get;
  if(lblEl) lblEl.value = _blitzPromoState.label;
  if(prev) prev.textContent = '🔥 Preview: ' + _blitzPromoState.label;
}

function toggleBlitzPromo(){
  _blitzPromoState.enabled = !_blitzPromoState.enabled;
  _applyBlitzPromoUI();
}

function autoUpdateBlitzPromoLabel(){
  const buy = parseInt(document.getElementById('bp-buy')?.value)||3;
  const get = parseInt(document.getElementById('bp-get')?.value)||5;
  const lblEl = document.getElementById('bp-label');
  const prev  = document.getElementById('bp-preview');
  const auto  = 'Buy '+buy+' Get '+get+' Total!';
  if(lblEl && !lblEl.dataset.userEdited) lblEl.value = auto;
  if(prev) prev.textContent = '🔥 Preview: ' + (lblEl?.value || auto);
}

async function saveBlitzPromo(){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const btn = document.querySelector('[onclick="saveBlitzPromo()"]');
  const res = document.getElementById('bp-result');
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  if(res) res.innerHTML='';
  try {
    const buy   = parseInt(document.getElementById('bp-buy')?.value)||3;
    const get   = parseInt(document.getElementById('bp-get')?.value)||5;
    const label = (document.getElementById('bp-label')?.value||'').trim() || ('Buy '+buy+' Get '+get+' Total!');
    const enabled = _blitzPromoState.enabled;
    const saveRes = await fetch('/api/admin?action=save-blitz-promo', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, config: { buy, get, label } })
    });
    if(!saveRes.ok) { const e = await saveRes.json(); throw new Error(e.error || 'Save failed'); }
    _blitzPromoState = { enabled, buy, get, label };
    // Also update the live S.blitzPromo so the badge reflects immediately
    if(typeof S !== 'undefined') S.blitzPromo = { enabled, config: { buy, get, label } };
    updateBlitzPromoBadge();
    if(res) res.innerHTML='<span style="color:#22c55e">✅ Promo settings saved!</span>';
    toast(enabled ? '🔥 Blitz Promo is now LIVE for all clients!' : '✅ Blitz Promo turned OFF', enabled ? 'success' : 'info');
  } catch(e){
    if(res) res.innerHTML='<span style="color:var(--danger)">❌ '+escHtml(e.message)+'</span>';
    toast('❌ Save failed: '+e.message,'error');
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='💾 Save Promo Settings'; }
  }
}

// ── Global Postcard Defaults (SuperAdmin) ─────────────────────────────────────
async function loadGlobalPostcardDefaults(){
  try {
    const r = await fetch('/api/admin?action=get-global-postcard-defaults', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if(!r.ok) return;
    const data = await r.json();
    const d = data.defaults || {};
    const set = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };
    set('gpd-headline1',   d.postcardHeadline1);
    set('gpd-headline2',   d.postcardHeadline2);
    set('gpd-hook',        d.postcardHook);
    set('gpd-why',         d.postcardWhy);
    set('gpd-quote',       d.postcardQuote);
    set('gpd-guarantee',   d.postcardGuarantee);
    set('gpd-scan-cta',    d.postcardScanCta);
    set('gpd-scan-sub',    d.postcardScanSub);
    set('gpd-hook-letter', d.hookLetter);
    set('gpd-why-received',d.whyReceived);
  } catch(e){ console.warn('[GPD] load error:', e); }
}

async function saveGlobalPostcardDefaults(){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const btn = document.querySelector('[onclick="saveGlobalPostcardDefaults()"]');
  const res = document.getElementById('gpd-result');
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  if(res) res.innerHTML='';
  const v = id => (document.getElementById(id)?.value||'').trim();
  const defaults = {};
  const assign = (key, id) => { const val = v(id); if(val) defaults[key] = val; };
  assign('postcardHeadline1', 'gpd-headline1');
  assign('postcardHeadline2', 'gpd-headline2');
  assign('postcardHook',      'gpd-hook');
  assign('postcardWhy',       'gpd-why');
  assign('postcardQuote',     'gpd-quote');
  assign('postcardGuarantee', 'gpd-guarantee');
  assign('postcardScanCta',   'gpd-scan-cta');
  assign('postcardScanSub',   'gpd-scan-sub');
  assign('hookLetter',        'gpd-hook-letter');
  assign('whyReceived',       'gpd-why-received');
  try {
    const r = await fetch('/api/admin?action=save-global-postcard-defaults', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaults })
    });
    if(!r.ok){ const e = await r.json(); throw new Error(e.error||'Save failed'); }
    // Update in-memory global defaults so new accounts loaded in this session pick them up
    window._globalPostcardDefaults = defaults;
    if(res) res.innerHTML='<span style="color:#22c55e">✅ Global postcard defaults saved! New roofers will see these immediately. Existing roofers who haven\'t customized their text will also see the new defaults on next login.</span>';
    toast('✅ Global postcard defaults saved!','success');
  } catch(e){
    if(res) res.innerHTML='<span style="color:var(--danger)">❌ '+escHtml(e.message)+'</span>';
    toast('❌ Save failed: '+e.message,'error');
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='💾 Save Global Postcard Defaults'; }
  }
}

// ── Global Content Defaults (CMS) ────────────────────────────────────────────

async function loadGlobalContentDefaults(){
  try {
    const r = await fetch('/api/admin?action=get-global-content-defaults', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if(!r.ok) return;
    const data = await r.json();
    const d = data.defaults || {};
    const set = (id, val) => { const el = document.getElementById(id); if(el && val) el.value = val; };
    set('gcd-gate-title',          d.gateTitle);
    set('gcd-gate-sub',            d.gateSub);
    set('gcd-gate-btn',            d.gateBtn);
    set('gcd-gate-privacy',        d.gatePrivacy);
    set('gcd-hero-tag',            d.heroTag);
    set('gcd-hero-headline',       d.heroHeadline);
    set('gcd-rep-title',           d.repTitle);
    set('gcd-rep-bio',             d.repBio);
    set('gcd-video-title',         d.videoTitle);
    set('gcd-about-title',         d.aboutTitle);
    set('gcd-reviews-title',       d.reviewsTitle);
    set('gcd-cta-title',           d.ctaTitle);
    set('gcd-cta-sub',             d.ctaSub);
    set('gcd-sticky-tag',          d.stickyTag);
    set('gcd-footer-disclaimer',   d.footerDisclaimer);
    set('gcd-property-disclaimer', d.propertyDisclaimer);
    set('gcd-material-disclaimer', d.materialDisclaimer);
    set('gcd-sms-template',        d.smsTemplate);
    set('gcd-email-subject',       d.emailSubject);
  } catch(e){ console.warn('[GCD] load error:', e); }
}

async function saveGlobalContentDefaults(){
  if(!isSuperAdmin()){ toast('Permission denied','error'); return; }
  const btn = document.querySelector('[onclick="saveGlobalContentDefaults()"]');
  const res = document.getElementById('gcd-result');
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  if(res) res.innerHTML='';
  const v = id => (document.getElementById(id)?.value||'').trim();
  const defaults = {};
  const assign = (key, id) => { const val = v(id); if(val) defaults[key] = val; };
  assign('gateTitle',          'gcd-gate-title');
  assign('gateSub',            'gcd-gate-sub');
  assign('gateBtn',            'gcd-gate-btn');
  assign('gatePrivacy',        'gcd-gate-privacy');
  assign('heroTag',            'gcd-hero-tag');
  assign('heroHeadline',       'gcd-hero-headline');
  assign('repTitle',           'gcd-rep-title');
  assign('repBio',             'gcd-rep-bio');
  assign('videoTitle',         'gcd-video-title');
  assign('aboutTitle',         'gcd-about-title');
  assign('reviewsTitle',       'gcd-reviews-title');
  assign('ctaTitle',           'gcd-cta-title');
  assign('ctaSub',             'gcd-cta-sub');
  assign('stickyTag',          'gcd-sticky-tag');
  assign('footerDisclaimer',   'gcd-footer-disclaimer');
  assign('propertyDisclaimer', 'gcd-property-disclaimer');
  assign('materialDisclaimer', 'gcd-material-disclaimer');
  assign('smsTemplate',        'gcd-sms-template');
  assign('emailSubject',       'gcd-email-subject');
  try {
    const r = await fetch('/api/admin?action=save-global-content-defaults', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaults })
    });
    if(!r.ok){ const e = await r.json(); throw new Error(e.error||'Save failed'); }
    if(res) res.innerHTML='<span style="color:#22c55e">✅ Global content defaults saved! All homeowner project report pages will reflect these changes immediately for accounts that haven\'t customized their own copy.</span>';
    toast('✅ Global content defaults saved!','success');
  } catch(e){
    if(res) res.innerHTML='<span style="color:var(--danger)">❌ '+escHtml(e.message)+'</span>';
    toast('❌ Save failed: '+e.message,'error');
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='💾 Save Global Content Defaults'; }
  }
}
