// BidDrop — Nav menu, contacts, campaigns, postcard design library, drip builder
// Extracted from index.html inline block

//  HAMBURGER NAV MENU
// ═══════════════════════════════
function toggleNavMenu(e){
  if(e) e.stopPropagation();
  const d = document.getElementById('nav-menu-dropdown');
  if(d) d.classList.toggle('open');
}

function closeNavMenu(){
  const d = document.getElementById('nav-menu-dropdown');
  if(d) d.classList.remove('open');
}

// ── Tablet overlay sidebar ──────────────────────────────────────────────────
function openTabletSidebar(){
  const sidebar = document.getElementById('bd-sidebar');
  const scrim   = document.getElementById('bd-sidebar-scrim');
  if(sidebar) sidebar.classList.add('tablet-open');
  if(scrim)   scrim.classList.add('open');
  closeNavMenu();
}
function closeTabletSidebar(){
  const sidebar = document.getElementById('bd-sidebar');
  const scrim   = document.getElementById('bd-sidebar-scrim');
  if(sidebar) sidebar.classList.remove('tablet-open');
  if(scrim)   scrim.classList.remove('open');
}
function toggleTabletSidebar(e){
  if(e) e.stopPropagation();
  const sidebar = document.getElementById('bd-sidebar');
  if(sidebar && sidebar.classList.contains('tablet-open')){
    closeTabletSidebar();
  } else {
    openTabletSidebar();
  }
}
// On tablet, the hamburger button should open the sidebar overlay instead of the dropdown
(function(){
  const btn = document.getElementById('nav-menu-btn');
  if(btn){
    btn.addEventListener('click', function(e){
      if(window.innerWidth >= 769 && window.innerWidth <= 1180){
        e.stopPropagation();
        toggleTabletSidebar(e);
      }
    }, true); // capture phase so it runs before the inline onclick
  }
})();
// Update FAB pin count badge
function updateFabBadge(){
  const fab = document.getElementById('fab-pins');
  if(!fab) return;
  const count = (S.pins || []).filter(p => !p.archived).length;
  fab.innerHTML = count > 0
    ? '<span style="position:relative;">📍<span style="position:absolute;top:-6px;right:-8px;background:#EF4444;color:#fff;font-size:9px;font-weight:700;border-radius:9px;padding:1px 4px;font-family:var(--font-m);line-height:1.4;">'+count+'</span></span>'
    : '📍';
}

// Navigate from the dropdown menu
function navGo(tab){
  closeNavMenu();
  goTab(tab);
}

// Sync active state on nav-menu-items after goTab
function syncNavMenu(t){
  document.querySelectorAll('.nav-menu-item').forEach(b=>{
    b.classList.toggle('active', b.dataset.nav === t);
  });
  // Update the menu button label to show current tab name
  const active = document.querySelector('.nav-menu-item[data-nav="'+t+'"]');
  const lbl = document.getElementById('nav-menu-label');
  if(lbl && active) lbl.textContent = active.textContent.trim();
  // Sync sidebar active state
  document.querySelectorAll('.bd-snav-item').forEach(b=>{
    b.classList.toggle('active', b.dataset.nav === t);
  });
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e){
  const d = document.getElementById('nav-menu-dropdown');
  const b = document.getElementById('nav-menu-btn');
  if(d && b && !b.contains(e.target) && !d.contains(e.target)) closeNavMenu();
});

// Patch goTab to sync nav menu active state
const _origGoTab = goTab;
goTab = function(t){
  _origGoTab(t);
  syncNavMenu(t);
};

// Also sync applyRoleUI visibility for nav items
function syncNavRoleUI(){
  // Mirror tab-btn display:none/flex to nav-menu-items
  // Note: zones is always visible (its tab-btn is a legacy hidden stub, not a role-gated item)
  const map = {
    'agency-tab-btn': 'agency-nav-item',
    'settings-tab-btn': 'settings-nav-item',
    'admin-panel-tab-btn': 'admin-nav-item'
  };
  Object.entries(map).forEach(([tabId, navId])=>{
    const tabBtn = document.getElementById(tabId);
    const navItem = document.getElementById(navId);
    if(tabBtn && navItem){
      navItem.style.display = tabBtn.style.display === 'none' ? 'none' : '';
    }
  });
  // Zones is always visible for all roles
  const zonesNavItem = document.getElementById('zones-nav-item');
  if(zonesNavItem) zonesNavItem.style.display = '';
  // Populate nav user info section
  const nameEl = document.getElementById('nav-user-name');
  const roleEl = document.getElementById('nav-user-role');
  const coInfo = document.getElementById('nav-company-info');
  const coNameEl = document.getElementById('nav-company-name');
  if(nameEl && currentProfile){
    nameEl.textContent = currentProfile.name || currentProfile.email || 'User';
  }
  if(roleEl && currentProfile){
    roleEl.textContent = (currentProfile.role||'').replace(/_/g,' ');
  }
  if(coInfo && coNameEl && currentAccount){
    const acctName = currentAccount.company_name || currentAccount.name || '';
    if(acctName){
      coNameEl.textContent = acctName;
      coInfo.style.display = 'block';
    } else {
      coInfo.style.display = 'none';
    }
  }
  // ── Sync sidebar role-gated items ──
  const sbMap = {
    'agency-tab-btn': 'bd-sb-agency-item',
    'admin-panel-tab-btn': 'bd-sb-admin-item'
  };
  Object.entries(sbMap).forEach(([tabId, sbId])=>{
    const tabBtn = document.getElementById(tabId);
    const sbItem = document.getElementById(sbId);
    if(tabBtn && sbItem){
      sbItem.style.display = tabBtn.style.display === 'none' ? 'none' : '';
    }
  });
  // Populate sidebar user strip
  if(currentProfile){
    const sbName = document.getElementById('bd-sb-uname');
    const sbRole = document.getElementById('bd-sb-urole');
    const sbAvatar = document.getElementById('bd-sb-avatar');
    if(sbName) sbName.textContent = currentProfile.name || currentProfile.email || 'User';
    if(sbRole) sbRole.textContent = (currentProfile.role||'').replace(/_/g,' ');
    if(sbAvatar){
      const initials = (currentProfile.name||currentProfile.email||'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      sbAvatar.textContent = initials;
    }
  }
  // Update sidebar credit label
  updateSidebarBadge();
}


// ══════════════════════════════════════════════════════════
// Sidebar badge + credit label updater
function updateSidebarBadge(){
  // Queue count badge
  const badge = document.getElementById('bd-sb-queue-badge');
  if(badge && window.S && S.queue){
    const pending = S.queue.filter(q=>q.status==='pending').length;
    if(pending > 0){
      badge.textContent = pending;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
  // Credit label — read directly from S.cfg so sidebar always matches the live balance
  const creditLbl = document.getElementById('bd-sb-credit-label');
  if(creditLbl && window.S && S.cfg !== undefined){
    const _paid = S.cfg.mailerCredits || 0;
    const _freeLeft = Math.max(0, 0 - (S.cfg.freeMailerCreditsUsed||0));
    const _total = _paid + _freeLeft;
    creditLbl.textContent = _total > 0 ? _total + ' credits' : 'Buy Credits';
  }
  // Inline credits under company name in user strip
  const inlineCred = document.getElementById('bd-sb-credits-inline');
  if(inlineCred && window.S && S.cfg !== undefined){
    const _paid2 = S.cfg.mailerCredits || 0;
    const _freeLeft2 = Math.max(0, 0 - (S.cfg.freeMailerCreditsUsed||0));
    const _total2 = _paid2 + _freeLeft2;
    inlineCred.textContent = _total2 > 0 ? '📬 ' + _total2 + ' credits' : '📬 Buy Credits';
  }
}
// ══════════════════════════════════════════════════════════

// -- LISTS & CONTACTS ---------------------------------------------------------
let _contactsSelected = new Set();

function renderContacts(){
  const search = (document.getElementById('contacts-search')||{}).value||'';
  const statusF = (document.getElementById('contacts-status-filter')||{}).value||'';
  const ghlF = (document.getElementById('contacts-ghl-filter')||{}).value||'';
  const repF = (document.getElementById('contacts-rep-filter')||{}).value||'';
  const repSel = document.getElementById('contacts-rep-filter');
  if(repSel){
    const reps = [...new Set(S.pins.map(p=>p.rep||'').filter(Boolean))].sort();
    const cur = repSel.value;
    repSel.innerHTML = '<option value="">All Reps</option>' + reps.map(r=>`<option value="${r}"${r===cur?' selected':''}>${r}</option>`).join('');
  }
  let pins = S.pins.filter(p=>!p.deleted_at);
  if(search){ const q=search.toLowerCase(); pins=pins.filter(p=>(p.address||'').toLowerCase().includes(q)||(p.owner||(p.estimate&&p.estimate.owner)||'').toLowerCase().includes(q)||(p.rep||'').toLowerCase().includes(q)); }
  if(statusF) pins=pins.filter(p=>(p.status||'pipeline')===statusF);
  if(ghlF==='synced') pins=pins.filter(p=>p.ghlContactId);
  if(ghlF==='unsynced') pins=pins.filter(p=>!p.ghlContactId);
  if(repF) pins=pins.filter(p=>p.rep===repF);
  pins=pins.slice().sort((a,b)=>{ const ta=a.createdAt||a.at||0,tb=b.createdAt||b.at||0; return tb>ta?1:tb<ta?-1:0; });
  const statsEl=document.getElementById('contacts-stats');
  if(statsEl){
    const total=S.pins.filter(p=>!p.deleted_at).length;
    const synced=S.pins.filter(p=>!p.deleted_at&&p.ghlContactId).length;
    const withEst=S.pins.filter(p=>!p.deleted_at&&p.estimate&&Object.keys(p.estimate).length>0).length;
    statsEl.innerHTML=[{label:'Total Contacts',val:total,color:'var(--accent)'},{label:'Synced to GHL',val:synced,color:'#22C55E'},{label:'Have Estimates',val:withEst,color:'#3B82F6'},{label:'Showing',val:pins.length,color:'var(--mid)'}].map(s=>`<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 18px;display:flex;flex-direction:column;gap:2px;"><div style="font-size:20px;font-weight:800;color:${s.color};font-family:var(--font-h);">${s.val}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">${s.label}</div></div>`).join('');
  }
  const tbody=document.getElementById('contacts-tbody');
  const emptyEl=document.getElementById('contacts-empty');
  if(!tbody) return;
  if(!pins.length){ tbody.innerHTML=''; if(emptyEl) emptyEl.style.display='block'; return; }
  if(emptyEl) emptyEl.style.display='none';
  const TC={roofing:'#F25C05',solar:'#22C55E',fencing:'#A78BFA',siding:'#60A5FA',gutters:'#38BDF8',insulation:'#FB923C',paint:'#F472B6',doors:'#FBBF24',windows:'#67E8F9'};
  const TL={roofing:'Roof',solar:'Solar',fencing:'Fence',siding:'Siding',gutters:'Gutters',insulation:'Insul',paint:'Paint',doors:'Doors',windows:'Win'};
  tbody.innerHTML=pins.map(p=>{
    const pid=p.id;
    const name=(p.owner||(p.estimate&&p.estimate.owner)||'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[c]))||'&mdash;';
    const addr=(p.address||'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[c]))||'&mdash;';
    const status=p.status||'pipeline';
    const sc=sColor(status); const sl=sLabel(status)||status;
    const rep=(p.rep||'&mdash;');
    const trades=(p.interested_trades||[]).slice(0,3).map(t=>`<span style="padding:1px 6px;border-radius:8px;border:1px solid ${TC[t]||'#96B0C8'};color:${TC[t]||'#96B0C8'};font-size:9px;font-weight:700;white-space:nowrap;">${TL[t]||t}</span>`).join(' ');
    const _ghlDate=p.ghlSyncedAt?new Date(p.ghlSyncedAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}):null;
    const ghlBadge=p.ghlSyncError?`<span style="color:#f87171;font-size:10px;font-weight:700;" title="${escHtml(p.ghlSyncError)}">&#9888; Error</span>`:(p.ghlContactId?`<span style="color:#4ade80;font-size:10px;font-weight:700;">&#10003; Synced${_ghlDate?' &middot; '+_ghlDate:''}</span>`:`<span style="color:var(--muted);font-size:10px;">&mdash;</span>`);
    const pinDate=(p.createdAt||p.at)?new Date(p.createdAt||p.at).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'&mdash;';
    const chk=_contactsSelected.has(pid)?'checked':'';
    const ghlBtn=(S.cfg&&S.cfg.ghlLocationId)?`<button onclick="ghlPushPin('${pid}')" style="background:${p.ghlContactId?'rgba(34,197,94,.1)':'var(--card2)'};border:1px solid ${p.ghlContactId?'#22c55e':'var(--border)'};border-radius:5px;padding:4px 8px;color:${p.ghlContactId?'#4ade80':'var(--mid)'};font-size:10px;font-weight:700;cursor:pointer;">${p.ghlContactId?'&#10003; GHL':'&uarr; GHL'}</button>`:'';
    return `<tr style="border-bottom:1px solid var(--border);" onmouseenter="this.style.background='var(--card2)'" onmouseleave="this.style.background=''"><td style="padding:11px 14px;"><input type="checkbox" data-pid="${pid}" onchange="contactsRowCheck(this,'${pid}')" ${chk} style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;"></td><td style="padding:11px 14px;font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;">${name}</td><td style="padding:11px 14px;font-size:11px;color:var(--mid);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${addr}</td><td style="padding:11px 14px;"><span style="background:${sc};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;">${sl}</span></td><td style="padding:11px 14px;font-size:11px;color:var(--mid);">${rep}</td><td style="padding:11px 14px;min-width:80px;">${trades||'<span style="color:var(--muted);font-size:10px;">&mdash;</span>'}</td><td style="padding:11px 14px;">${ghlBadge}</td><td style="padding:11px 14px;font-size:11px;color:var(--muted);">${pinDate}</td><td style="padding:11px 14px;"><div style="display:flex;gap:6px;"><button onclick="goTab('map');setTimeout(()=>selectPinById('${pid}'),300)" style="background:var(--card2);border:1px solid var(--border);border-radius:5px;padding:4px 8px;color:var(--mid);font-size:10px;font-weight:700;cursor:pointer;">Map</button><button onclick="goEstFromPin('${pid}')" style="background:var(--card2);border:1px solid var(--border);border-radius:5px;padding:4px 8px;color:var(--mid);font-size:10px;font-weight:700;cursor:pointer;">Est</button>${ghlBtn}</div></td></tr>`;
  }).join('');
  _updateContactsBulkBar();
}
function contactsRowCheck(cb,pid){ if(cb.checked) _contactsSelected.add(pid); else _contactsSelected.delete(pid); _updateContactsBulkBar(); }
function contactsToggleAll(checked){ const cbs=document.querySelectorAll('#contacts-tbody input[type=checkbox]'); cbs.forEach(cb=>{ cb.checked=checked; if(checked) _contactsSelected.add(cb.dataset.pid); else _contactsSelected.delete(cb.dataset.pid); }); const h=document.getElementById('contacts-hdr-cb'); if(h) h.checked=checked; _updateContactsBulkBar(); }
function contactsDeselectAll(){ _contactsSelected.clear(); contactsToggleAll(false); }
function _updateContactsBulkBar(){ const bar=document.getElementById('contacts-bulk-bar'),n=_contactsSelected.size; if(bar) bar.style.display=n>0?'flex':'none'; const c=document.getElementById('contacts-selected-count'); if(c) c.textContent=n+' selected'; }
async function contactsBulkGHL(){ if(!_contactsSelected.size){toast('Select contacts first','info');return;} if(!S.cfg||!S.cfg.ghlLocationId){toast('GHL not configured','info');return;} const ids=[..._contactsSelected]; toast('Pushing '+ids.length+' to GHL...','info'); let ok=0,fail=0; for(const pid of ids){ try{await ghlPushPin(pid);ok++;}catch(e){fail++;} } toast('GHL: '+ok+' synced'+(fail?' \u00b7 '+fail+' failed':''),'success'); renderContacts(); }
function contactsBulkAddToQueue(){ if(!_contactsSelected.size){toast('Select contacts first','info');return;} const ids=[..._contactsSelected]; let added=0; for(const pid of ids){ const pin=S.pins.find(p=>p.id===pid); if(!pin) continue; const already=S.queue&&S.queue.find(q=>q.pinId===pid||q.pin_id===pid); if(already) continue; if(typeof addToMailQueue==='function') addToMailQueue(pin,{status:'needs_approval',source:'contacts'}); added++; } toast(added>0?added+' added to Mail Queue':'Already in queue','success'); contactsDeselectAll(); }
(function(){ const _orig=window.goTab; if(typeof _orig==='function'){ window.goTab=function(t){ _orig(t); if(t==='contacts') setTimeout(renderContacts,50); }; } })();
// -- END LISTS & CONTACTS -----------------------------------------------------


// -- CAMPAIGNS TAB ------------------------------------------------------------
async function loadCampaignsTab(){
  const listEl = document.getElementById('campaigns-list');
  const statsEl = document.getElementById('campaigns-stats');
  const statusF = (document.getElementById('campaigns-status-filter')||{}).value||'';
  if(listEl) listEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Loading\u2026</div>';
  try{
    const data = await adminAPI('campaign-list', { targetAccountId: currentAccount ? currentAccount.id : null });
    let campaigns = (data && data.campaigns) || [];
    if(statusF) campaigns = campaigns.filter(c=>c.status===statusF);
    campaigns.sort((a,b)=> new Date(b.campaign_date) - new Date(a.campaign_date));

    // Stats strip
    if(statsEl){
      const total = campaigns.length;
      const active = campaigns.filter(c=>c.status==='active').length;
      const totalHomes = campaigns.reduce((s,c)=>s+(c.home_count||0),0);
      const totalCards = campaigns.reduce((s,c)=>s+(c.postcards_sent||0),0);
      statsEl.innerHTML = [
        {label:'Total Campaigns',val:total,color:'var(--accent)'},
        {label:'Active',val:active,color:'#22C55E'},
        {label:'Homes Targeted',val:totalHomes,color:'#3B82F6'},
        {label:'Postcards Sent',val:totalCards,color:'#F59E0B'},
      ].map(s=>`<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 18px;display:flex;flex-direction:column;gap:2px;"><div style="font-size:20px;font-weight:800;color:${s.color};font-family:var(--font-h);">${s.val}</div><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">${s.label}</div></div>`).join('');
    }

    if(!campaigns.length){
      if(listEl) listEl.innerHTML = '<div style="padding:48px;text-align:center;color:var(--muted);font-size:13px;">No campaigns yet.<br><br><button onclick="goTab(\'map\')" style="background:var(--accent);border:none;border-radius:8px;padding:10px 20px;color:#fff;font-family:var(--font-b);font-size:12px;font-weight:700;cursor:pointer;margin-top:8px;">Go to Map to Launch One</button></div>';
      return;
    }

    // Build Part N suffix for campaigns sharing the same source address
    const _addrCount = {};
    // Process in chronological order (oldest first) to assign Part numbers correctly
    const _sorted = campaigns.slice().sort((a,b)=>new Date(a.campaign_date)-new Date(b.campaign_date));
    const _campPart = {};
    _sorted.forEach(function(c){
      const key = (c.source_address||'').toLowerCase().trim();
      if(!key) return;
      _addrCount[key] = (_addrCount[key]||0) + 1;
      _campPart[c.id] = _addrCount[key];
    });
    const rows = campaigns.map(function(c){
      const d = new Date(c.campaign_date);
      const dateStr = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const statusColor = c.status==='active'?'var(--accent)':c.status==='completed'?'#22C55E':'var(--muted)';
      const pct = c.home_count ? Math.round((c.postcards_sent||0)/c.home_count*100) : 0;
      const barW = Math.min(pct,100);
      // Campaign name: short address + Part N if there are multiple from same address
      const addrKey = (c.source_address||'').toLowerCase().trim();
      const totalForAddr = _addrCount[addrKey]||1;
      const partNum = _campPart[c.id]||1;
      const shortAddr = (c.source_address||'Unknown address').split(',')[0];
      const campName = totalForAddr > 1 ? shortAddr + ' — Part ' + partNum : shortAddr;
      return `<div style="padding:16px 20px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;color:var(--text);font-size:13px;margin-bottom:3px;">&#128205; ${escHtml(campName)}</div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${dateStr} &middot; ${escHtml(c.rep_email||'')} &middot; <strong style="color:var(--text);">${c.home_count||0} homes</strong>${c.design_name ? ' &middot; <span style="color:var(--accent);">\ud83d\udcec '+escHtml(c.design_name)+'</span>' : ''}</div>
            <div style="display:flex;gap:16px;font-size:11px;flex-wrap:wrap;">
              <span style="color:#3B82F6;">&#8679; ${c.ghl_pushed||0} to GHL</span>
              <span style="color:#F59E0B;">&#128236; ${c.postcards_sent||0} postcards</span>
              <span style="color:var(--muted);">&#128203; ${(c.pin_ids||[]).length} pins</span>
              ${(()=>{ const stats=getCampaignPerformanceStats(c); return stats.pins>0?`<span style="color:#F59E0B;">&#128269; ${stats.scans} QR scans</span><span style="color:#22C55E;">&#10003; ${stats.convRate}% conversion</span><span style="color:#A855F7;">&#128203; ${stats.estimates} estimates</span>`:'' })()}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
            <span style="background:rgba(242,92,5,.1);border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;color:${statusColor};text-transform:uppercase;letter-spacing:.5px;">${c.status||'active'}</span>
            <div style="display:flex;gap:6px;">
              <button onclick="campaignViewPins('${escHtml(c.id)}')" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;color:var(--mid);font-size:10px;font-weight:700;cursor:pointer;">View Pins</button>
              <button onclick="campaignAddToQueue('${escHtml(c.id)}')" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:5px 10px;color:var(--mid);font-size:10px;font-weight:700;cursor:pointer;">&#128236; Queue Mail</button>
              <button onclick="openCampaignQRStats('${escHtml(c.id)}')" style="background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.4);border-radius:6px;padding:5px 10px;color:#60a5fa;font-size:10px;font-weight:700;cursor:pointer;">&#128202; QR Stats</button>
            </div>
          </div>
        </div>
        ${c.home_count>0?`<div style="margin-top:10px;"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:4px;"><span>Postcard coverage</span><span>${pct}%</span></div><div style="background:var(--card2);border-radius:4px;height:5px;overflow:hidden;"><div style="background:var(--accent);height:100%;width:${barW}%;border-radius:4px;transition:width .3s;"></div></div></div>`:''}
      </div>`;
    }).join('');
    if(listEl) listEl.innerHTML = rows;
  } catch(e){
    if(listEl) listEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--danger);font-size:13px;">Failed to load campaigns: '+escHtml(e.message||String(e))+'</div>';
  }
}

function campaignViewPins(campaignId){
  // Switch to map tab
  goTab('map');
  setTimeout(function(){
    const campPins = S.pins.filter(p=>p.campaign_id===campaignId && !p.deleted_at);
    if(!campPins.length){ toast('No pins found for this campaign','info'); return; }
    // Highlight pins on map
    campPins.forEach(function(p){
      const m = markers[p.id];
      if(m && m._icon){
        m._icon.style.filter = 'drop-shadow(0 0 8px #F25C05) brightness(1.4)';
      }
    });
    // Fit map to campaign pins
    if(typeof map !== 'undefined' && campPins.length){
      const lats = campPins.map(p=>p.lat), lngs = campPins.map(p=>p.lng);
      const bounds = [[Math.min(...lats),Math.min(...lngs)],[Math.max(...lats),Math.max(...lngs)]];
      try{ map.fitBounds(bounds, {padding:[40,40]}); }catch(e){}
    }
    // On mobile: open the pin panel and filter it to this campaign only
    const panel = document.getElementById('map-panel');
    const fab   = document.getElementById('fab-pins');
    if(panel && !panel.classList.contains('open')){
      panel.classList.add('open');
      if(fab) fab.textContent = '✕';
    }
    // Set a campaign filter on the pin list so only these pins show
    window._campaignPinFilter = campaignId;
    renderPinList();
    // Clear the filter after 30s so navigating away resets it
    clearTimeout(window._campaignFilterTimer);
    window._campaignFilterTimer = setTimeout(function(){
      window._campaignPinFilter = null;
      renderPinList();
    }, 30000);
    toast('Showing '+campPins.length+' campaign pins','success');
  }, 300);
}

function campaignAddToQueue(campaignId){
  const campPins = S.pins.filter(p=>p.campaign_id===campaignId && !p.deleted_at);
  if(!campPins.length){ toast('No pins for this campaign','info'); return; }
  let added = 0;
  campPins.forEach(function(pin){
    const already = S.queue && S.queue.find(q=>q.pinId===pin.id||q.pin_id===pin.id);
    if(already) return;
    if(typeof addToMailQueue==='function') addToMailQueue(pin,{status:'needs_approval',source:'campaign',campaign_id:campaignId});
    added++;
  });
  toast(added>0?added+' homes added to Mail Queue (pending approval)':'All already in queue','success');
}

// Patch goTab to load campaigns when tab is opened
(function(){
  const _orig = window.goTab;
  if(typeof _orig==='function'){
    window.goTab = function(t){
      _orig(t);
      if(t==='campaigns') setTimeout(loadCampaignsTab, 50);
    };
  }
})();
// -- END CAMPAIGNS TAB --------------------------------------------------------


// -- QUEUE APPROVAL FLOW ------------------------------------------------------
function approveQueueItem(id){
  const item = S.queue.find(x=>x.id===id);
  if(!item){ toast('Queue item not found','error'); return; }
  item.status = 'approved';
  item.approvedAt = new Date().toISOString();
  item.approvedBy = (window.currentUser && window.currentUser.email) || 'admin';
  save();
  sbSaveQueueItem(item).catch(e=>console.warn('Queue save:',e));
  addAct('Mail queue item approved for <strong>'+escHtml(item.addr||item.owner)+'</strong>','bid_sent');
  renderQueue();
  toast('\u2713 Approved \u2014 ready to send postcard','success');
}

function bulkApproveQueue(){
  const checked = document.querySelectorAll('.q-row-cb:checked');
  if(!checked.length){ toast('Select items to approve','info'); return; }
  let count = 0;
  checked.forEach(function(cb){
    const item = S.queue.find(x=>x.id===cb.dataset.id);
    if(item && item.status==='needs_approval'){
      item.status='approved';
      item.approvedAt=new Date().toISOString();
      item.approvedBy=(window.currentUser&&window.currentUser.email)||'admin';
      sbSaveQueueItem(item).catch(e=>console.warn('Queue save:',e));
      count++;
    }
  });
  save(); renderQueue();
  toast(count>0?count+' item'+(count>1?'s':'')+' approved':'No items needed approval','success');
}
// -- END QUEUE APPROVAL FLOW --------------------------------------------------


// ═══════════════════════════════════════════════════════════════════════════
// POSTCARD DESIGN LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

function getDesigns(){ return Array.isArray(S.cfg.postcardDesigns) ? S.cfg.postcardDesigns : []; }

function renderDesignsGrid(){
  const grid = document.getElementById('designs-grid-page') || document.getElementById('designs-grid');
  if(!grid) return;
  const designs = getDesigns();
  if(!designs.length){
    grid.innerHTML = '<div style="padding:80px 40px;text-align:center;color:var(--muted);font-size:14px;grid-column:1/-1;"><div style="font-size:48px;margin-bottom:14px;">📭</div><div style="font-weight:700;color:var(--text);margin-bottom:6px;">No designs yet</div><div>Upload your first postcard design to get started</div></div>';
    return;
  }
  grid.innerHTML = designs.map((d,i)=>`
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color .2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="position:relative;width:100%;padding-top:66.7%;background:#111827;overflow:hidden;">
        ${d.url ? '<img src="'+d.url+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' : '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;">No preview</div>'}
        <div style="position:absolute;top:8px;left:8px;">
          ${d.isDefault?'<span style="background:var(--accent);color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;letter-spacing:.5px;">DEFAULT</span>':''}
        </div>
      </div>
      <div style="padding:12px;">
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;">${escHtml(d.name||'Untitled')}</div>
        ${d.desc ? '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">'+d.desc+'</div>' : ''}
        <div style="font-size:10px;color:var(--muted);margin-bottom:6px;">Uploaded ${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'recently'}</div>
        ${d.backUrl ? '<div style="margin-bottom:7px;"><span style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#22c55e;font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;letter-spacing:.4px;">🖼 CUSTOM BACK</span></div>' : (d.backOverrides&&Object.keys(d.backOverrides).length ? '<div style="margin-bottom:7px;"><span style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#818cf8;font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;letter-spacing:.4px;">✓ CUSTOM TEXT</span></div>' : '')}
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="openPostcardFullPreview(${i})" style="flex:1;background:var(--accent);border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">&#128247; Preview</button>
          <button onclick="openEditDesignBack(${i})" style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:11px;font-weight:700;cursor:pointer;">${d.backUrl?'🖼️':'✏️'} Edit Back</button>
          ${d.isDefault ? '<button disabled style="flex:1;background:rgba(242,92,5,.15);border:1px solid var(--accent);border-radius:6px;padding:6px 10px;color:var(--accent);font-size:11px;font-weight:700;cursor:default;">&#9733; Default</button>' : '<button onclick="setDesignAsDefault(\'' + d.id + '\')" style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--muted);font-size:11px;font-weight:700;cursor:pointer;">Set Default</button>'}
          <button onclick="deleteDesign(${i})" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:6px 10px;color:#EF4444;font-size:11px;font-weight:700;cursor:pointer;">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openUploadDesignModal(){ openAddDesignModal(); }
function openAddDesignModal(){
  // Reset all fields
  const ids=['new-design-name','new-design-desc','nd-back-badge-text','nd-back-hook','nd-back-why','nd-back-quote','nd-back-guarantee','nd-back-scan-cta','nd-back-scan-sub','nd-back-badge1','nd-back-badge2','nd-back-badge3'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const colorEl=document.getElementById('nd-back-badge-color');
  if(colorEl) colorEl.value=S.cfg&&S.cfg.brandColor?S.cfg.brandColor:'#F25C05';
  document.getElementById('new-design-preview-text').style.display='';
  document.getElementById('new-design-preview-img').style.display='none';
  document.getElementById('new-design-preview-img').src='';
  document.getElementById('new-design-file').value='';
  window._newDesignFile=null;
  window._newDesignDimsOk=false;
  window._newDesignBackFile=null;
  window._newDesignBackDimsOk=false;
  window._editDesignBackUrl=null;
  // Reset back upload preview
  const ndBackUploadText=document.getElementById('nd-back-upload-text');
  const ndBackUploadImg=document.getElementById('nd-back-upload-img');
  if(ndBackUploadText) ndBackUploadText.style.display='';
  if(ndBackUploadImg){ ndBackUploadImg.style.display='none'; ndBackUploadImg.src=''; }
  const ndBackFileInput=document.getElementById('new-design-back-file');
  if(ndBackFileInput) ndBackFileInput.value='';
  const ndBackSizeWarn=document.getElementById('nd-back-size-warn');
  if(ndBackSizeWarn) ndBackSizeWarn.style.display='none';
  // Reset front preview wrap
  const fw=document.getElementById('nd-front-preview-wrap');
  if(fw) fw.innerHTML='<span style="color:var(--muted);font-size:12px;">Upload front artwork to preview</span>';
  // Clear back canvas
  const bc=document.getElementById('nd-back-preview-canvas');
  if(bc){ const ctx=bc.getContext('2d'); ctx.clearRect(0,0,bc.width,bc.height); }
  document.getElementById('add-design-modal').style.display='flex';
  // Show blank back canvas placeholder (no standard back for custom designs)
  setTimeout(()=>{
    const canvas=document.getElementById('nd-back-preview-canvas');
    if(canvas){
      canvas.width=375; canvas.height=562;
      const ctx=canvas.getContext('2d');
      ctx.fillStyle='#1a1a1a'; ctx.fillRect(0,0,375,562);
      ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font='14px Arial'; ctx.textAlign='center';
      ctx.fillText('Upload back artwork to preview',187,270);
      ctx.fillText('with QR + address overlay',187,295);
      ctx.textAlign='left';
    }
  }, 200);
}
function closeAddDesignModal(){
  document.getElementById('add-design-modal').style.display='none';
  window._editDesignBackMode = false;
  window._editDesignBackIdx = null;
  const saveBtn = document.getElementById('nd-save-btn');
  if(saveBtn) saveBtn.textContent = 'Save Design';
}
async function downloadBackTemplate(){
  try{
    const url='https://files.manuscdn.com/user_upload_by_module/session_file/310519663363612497/DfuKKUgxTlPREqia.png';
    const resp=await fetch(url);
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const blob=await resp.blob();
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='BidDrop_Back_Template.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); document.body.removeChild(a); },1000);
  } catch(e){
    // Fallback: open in new tab
    window.open('https://files.manuscdn.com/user_upload_by_module/session_file/310519663363612497/DfuKKUgxTlPREqia.png','_blank');
  }
}
function ndBackTypeChanged(){
  // No-op: toggle removed. Custom designs always use uploaded back.
}
function previewNewDesignBack(inp){
  if(!inp.files||!inp.files[0]) return;
  const file=inp.files[0];
  const warnEl=document.getElementById('nd-back-size-warn');
  if(!['image/jpeg','image/jpg','image/png'].includes(file.type)){
    warnEl.textContent='❌ Invalid format. Please upload a JPEG or PNG file.';
    warnEl.style.display='block';
    window._newDesignBackFile=null; inp.value=''; return;
  }
  window._newDesignBackFile=file;
  window._newDesignBackDimsOk=false;
  const r=new FileReader();
  r.onload=ev=>{
    document.getElementById('nd-back-upload-text').style.display='none';
    const img=document.getElementById('nd-back-upload-img');
    img.src=ev.target.result; img.style.display='block';
    // Check dimensions
    const tmpImg=new Image();
    tmpImg.onload=function(){
      const w=tmpImg.naturalWidth, h=tmpImg.naturalHeight;
      const validPortrait=(w===1875&&h===2775);
      const validLandscape=(w===2775&&h===1875);
      if(validPortrait||validLandscape){
        warnEl.style.display='none';
        window._newDesignBackDimsOk=true;
      } else {
        const minOk=(w>=1800&&h>=2700)||(w>=2700&&h>=1800);
        if(minOk){
          warnEl.innerHTML='⚠️ Recommended size is <b>1875×2775 px</b>. Your image is '+w+'×'+h+' px — may work but could have border issues.';
          warnEl.style.display='block';
          window._newDesignBackDimsOk=true;
        } else {
          warnEl.innerHTML='❌ Image too small ('+w+'×'+h+' px). Required: <b>1875×2775 px</b>.';
          warnEl.style.display='block';
          window._newDesignBackDimsOk=false;
        }
      }
      // Render preview with overlay
      renderCustomBackPreviewInModal();
    };
    tmpImg.src=ev.target.result;
  };
  r.readAsDataURL(file);
}
async function renderCustomBackPreviewInModal(){
  const canvas=document.getElementById('nd-back-preview-canvas');
  if(!canvas) return;
  const spinner=document.getElementById('nd-back-preview-spinner');
  if(spinner) spinner.style.display='flex';
  try{
    let backSrc = null;
    if(window._newDesignBackFile){
      backSrc = await new Promise(res=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.readAsDataURL(window._newDesignBackFile); });
    } else if(window._editDesignBackUrl){
      backSrc = window._editDesignBackUrl;
    }
    if(!backSrc){ if(spinner) spinner.style.display='none'; return; }
    const dataUrl = await renderCustomBackCanvas(backSrc, S.cfg||{});
    if(dataUrl){
      const img=new Image();
      img.onload=()=>{ canvas.width=img.width; canvas.height=img.height; canvas.getContext('2d').drawImage(img,0,0); };
      img.src=dataUrl;
    }
  } catch(e){ console.warn('Custom back preview error:',e); }
  finally{ if(spinner) spinner.style.display='none'; }
}
// Debounce helper for live back preview
let _ndBackPreviewTimer=null;
function designBackPreviewDebounce(){
  clearTimeout(_ndBackPreviewTimer);
  _ndBackPreviewTimer=setTimeout(renderDesignBackPreview, 600);
}
async function renderDesignBackPreview(){
  const canvas=document.getElementById('nd-back-preview-canvas');
  if(!canvas) return;
  const spinner=document.getElementById('nd-back-preview-spinner');
  if(spinner) spinner.style.display='flex';
  // Build a temp cfg merging account defaults with the design-specific overrides
  const v=id=>{ const el=document.getElementById(id); return el?(el.value.trim()||''):''; };
  const tmpCfg=Object.assign({},S.cfg||{});
  if(v('nd-back-badge-text')) tmpCfg.postcardBackBadgeText=v('nd-back-badge-text');
  const colorEl=document.getElementById('nd-back-badge-color');
  if(colorEl&&colorEl.value) tmpCfg.postcardBackBadgeColor=colorEl.value;
  if(v('nd-back-hook')) tmpCfg.postcardHook=v('nd-back-hook');
  if(v('nd-back-why')) tmpCfg.postcardWhy=v('nd-back-why');
  if(v('nd-back-quote')) tmpCfg.postcardQuote=v('nd-back-quote');
  if(v('nd-back-guarantee')) tmpCfg.postcardGuarantee=v('nd-back-guarantee');
  if(v('nd-back-scan-cta')) tmpCfg.postcardScanCta=v('nd-back-scan-cta');
  if(v('nd-back-scan-sub')) tmpCfg.postcardScanSub=v('nd-back-scan-sub');
  const _b1=v('nd-back-badge1'), _b2=v('nd-back-badge2'), _b3=v('nd-back-badge3');
  if(_b1||_b2||_b3){ tmpCfg.diff1=_b1||tmpCfg.diff1; tmpCfg.diff2=_b2||tmpCfg.diff2; tmpCfg.diff3=_b3||tmpCfg.diff3; }
  // Disable canvas designer back for this preview
  tmpCfg.canvasDesignBackJson=null;
  // Build overrides object from form fields
  const overrides={};
  const colorEl2=document.getElementById('nd-back-badge-color');
  if(v('nd-back-badge-text')) overrides.postcardBackBadgeText=v('nd-back-badge-text');
  if(colorEl2&&colorEl2.value) overrides.postcardBackBadgeColor=colorEl2.value;
  if(v('nd-back-hook')) overrides.postcardHook=v('nd-back-hook');
  if(v('nd-back-why')) overrides.postcardWhy=v('nd-back-why');
  if(v('nd-back-quote')) overrides.postcardQuote=v('nd-back-quote');
  if(v('nd-back-guarantee')) overrides.postcardGuarantee=v('nd-back-guarantee');
  if(v('nd-back-scan-cta')) overrides.postcardScanCta=v('nd-back-scan-cta');
  if(v('nd-back-scan-sub')) overrides.postcardScanSub=v('nd-back-scan-sub');
  const _nb1=v('nd-back-badge1'), _nb2=v('nd-back-badge2'), _nb3=v('nd-back-badge3');
  if(_nb1) overrides.diff1=_nb1; if(_nb2) overrides.diff2=_nb2; if(_nb3) overrides.diff3=_nb3;
  try{
    // Use the new design-back renderer (no pricing, QR -> booking URL)
    const dataUrl=await renderDesignBackCanvas(S.cfg||{}, overrides);
    if(dataUrl){
      const img=new Image();
      img.onload=()=>{
        canvas.width=img.width; canvas.height=img.height;
        canvas.getContext('2d').drawImage(img,0,0);
      };
      img.src=dataUrl;
    }
  } catch(e){ console.warn('Design back preview error:',e); }
  finally{ if(spinner) spinner.style.display='none'; }
}
function previewNewDesign(inp){
  if(!inp.files||!inp.files[0]) return;
  const file=inp.files[0];
  const warnEl=document.getElementById('new-design-size-warn');
  if(!['image/jpeg','image/jpg','image/png'].includes(file.type)){
    warnEl.textContent='❌ Invalid format. Please upload a JPEG or PNG file.';
    warnEl.style.display='block';
    window._newDesignFile=null; inp.value=''; return;
  }
  window._newDesignFile=file;
  window._newDesignDimsOk=false;
  const r=new FileReader();
  r.onload=ev=>{
    // Update the small upload box
    document.getElementById('new-design-preview-text').style.display='none';
    const img=document.getElementById('new-design-preview-img');
    img.src=ev.target.result; img.style.display='block';
    // Update the larger right-panel front preview
    const fw=document.getElementById('nd-front-preview-wrap');
    if(fw) fw.innerHTML='<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:contain;">';
    // Check dimensions
    const tmpImg=new Image();
    tmpImg.onload=function(){
      const w=tmpImg.naturalWidth, h=tmpImg.naturalHeight;
      const validPortrait=(w===1875&&h===2775);
      const validLandscape=(w===2775&&h===1875);
      if(validPortrait||validLandscape){
        warnEl.style.display='none';
        window._newDesignDimsOk=true;
      } else {
        const minOk=(w>=1800&&h>=2700)||(w>=2700&&h>=1800);
        if(minOk){
          warnEl.innerHTML='⚠️ Recommended size is <b>1875×2775 px</b>. Your image is '+w+'×'+h+' px — may work but could have border issues.';
          warnEl.style.display='block';
          window._newDesignDimsOk=true;
        } else {
          warnEl.innerHTML='❌ Image too small ('+w+'×'+h+' px). Required: <b>1875×2775 px</b>. Please resize and re-upload.';
          warnEl.style.display='block';
          window._newDesignDimsOk=false;
        }
      }
    };
    tmpImg.src=ev.target.result;
  };
  r.readAsDataURL(file);
}
async function saveNewDesign(){
  const name=(document.getElementById('new-design-name').value||'').trim();
  if(!name){ toast('Please enter a design name','error'); return; }
  // Edit back mode: update existing design without re-uploading front
  if(window._editDesignBackMode){
    const designs = getDesigns();
    const d = designs[window._editDesignBackIdx];
    if(!d){ toast('Design not found','error'); return; }
    const desc=(document.getElementById('new-design-desc').value||'').trim();
    const v=id=>{ const el=document.getElementById(id); return el?(el.value.trim()||''):''; };
    const colorEl=document.getElementById('nd-back-badge-color');
    const backOverrides={};
    if(v('nd-back-badge-text')) backOverrides.postcardBackBadgeText=v('nd-back-badge-text');
    if(colorEl&&colorEl.value&&colorEl.value!=='#F25C05') backOverrides.postcardBackBadgeColor=colorEl.value;
    if(v('nd-back-hook')) backOverrides.postcardHook=v('nd-back-hook');
    if(v('nd-back-why')) backOverrides.postcardWhy=v('nd-back-why');
    if(v('nd-back-quote')) backOverrides.postcardQuote=v('nd-back-quote');
    if(v('nd-back-guarantee')) backOverrides.postcardGuarantee=v('nd-back-guarantee');
    if(v('nd-back-scan-cta')) backOverrides.postcardScanCta=v('nd-back-scan-cta');
    if(v('nd-back-scan-sub')) backOverrides.postcardScanSub=v('nd-back-scan-sub');
    if(v('nd-back-badge1')) backOverrides.diff1=v('nd-back-badge1');
    if(v('nd-back-badge2')) backOverrides.diff2=v('nd-back-badge2');
    if(v('nd-back-badge3')) backOverrides.diff3=v('nd-back-badge3');
    d.name = name; d.desc = desc;
    // Always custom back for designs — upload new file if provided
    if(window._newDesignBackFile){
      const acctIdEdit=(currentAccount&&currentAccount.id)||'shared';
      const safeNEdit=name.toLowerCase().replace(/[^a-z0-9]/g,'-').substring(0,30);
      toast('Uploading back artwork…','info');
      const backPathEdit=acctIdEdit+'/designs/'+safeNEdit+'-back-'+Date.now()+'.jpg';
      const newBackUrl=await uploadToStorage(window._newDesignBackFile,backPathEdit,1800,0.92,'image/jpeg');
      d.backUrl = newBackUrl || d.backUrl;
    }
    // Keep existing backUrl if no new file uploaded
    d.backOverrides = null;
    window._editDesignBackMode = false;
    window._editDesignBackIdx = null;
    const saveBtn = document.getElementById('nd-save-btn');
    if(saveBtn) saveBtn.textContent = 'Save Design';
    save(); closeAddDesignModal(); renderDesignsGrid(); renderDripStepDesignSelects();
    toast('Back updated for "'+name+'"','success');
    return;
  }
  if(!window._newDesignFile){ toast('Please upload a front image','error'); return; }
  if(window._newDesignDimsOk===false){ toast('Image is too small. Please upload a 1875×2775 px JPEG or PNG.','error'); return; }
  const desc=(document.getElementById('new-design-desc').value||'').trim();
  // Collect back text overrides (only store non-empty values)
  const v=id=>{ const el=document.getElementById(id); return el?(el.value.trim()||''):''; };
  const colorEl=document.getElementById('nd-back-badge-color');
  const backOverrides={};
  if(v('nd-back-badge-text')) backOverrides.postcardBackBadgeText=v('nd-back-badge-text');
  if(colorEl&&colorEl.value&&colorEl.value!=='#F25C05') backOverrides.postcardBackBadgeColor=colorEl.value;
  if(v('nd-back-hook')) backOverrides.postcardHook=v('nd-back-hook');
  if(v('nd-back-why')) backOverrides.postcardWhy=v('nd-back-why');
  if(v('nd-back-quote')) backOverrides.postcardQuote=v('nd-back-quote');
  if(v('nd-back-guarantee')) backOverrides.postcardGuarantee=v('nd-back-guarantee');
  if(v('nd-back-scan-cta')) backOverrides.postcardScanCta=v('nd-back-scan-cta');
  if(v('nd-back-scan-sub')) backOverrides.postcardScanSub=v('nd-back-scan-sub');
  if(v('nd-back-badge1')) backOverrides.diff1=v('nd-back-badge1');
  if(v('nd-back-badge2')) backOverrides.diff2=v('nd-back-badge2');
  if(v('nd-back-badge3')) backOverrides.diff3=v('nd-back-badge3');
  const acctId=(currentAccount&&currentAccount.id)||'shared';
  const safeN=name.toLowerCase().replace(/[^a-z0-9]/g,'-').substring(0,30);
  const ts=Date.now();
  const path=acctId+'/designs/'+safeN+'-'+ts+'.jpg';
  toast('Uploading design…','info');
  const url=await uploadToStorage(window._newDesignFile,path,1800,0.92,'image/jpeg');
  // Back image is always required for custom designs
  if(!window._newDesignBackFile){ toast('Please upload a back artwork image','error'); return; }
  if(window._newDesignBackDimsOk===false){ toast('Back image is too small. Please upload a 1875×2775 px image.','error'); return; }
  toast('Uploading back artwork…','info');
  const backPath=acctId+'/designs/'+safeN+'-back-'+ts+'.jpg';
  const backUrl=await uploadToStorage(window._newDesignBackFile,backPath,1800,0.92,'image/jpeg');
  if(!S.cfg.postcardDesigns) S.cfg.postcardDesigns=[];
  S.cfg.postcardDesigns.push({
    id:'des_'+ts,
    name, desc,
    url:url||null,
    backUrl:backUrl||null,
    backOverrides:null,
    createdAt:new Date().toISOString()
  });
  save(); closeAddDesignModal(); renderDesignsGrid(); renderDripStepDesignSelects();
  toast('Design "'+name+'" saved!','success');
}
// Edit back text of an existing design (pre-fills the upload modal without requiring re-upload)
window._editDesignBackIdx = null;
function openEditDesignBack(idx){
  const designs = getDesigns();
  const d = designs[idx];
  if(!d){ toast('Design not found','error'); return; }
  window._editDesignBackIdx = idx;
  // Reset fields first
  const ids=['new-design-name','new-design-desc','nd-back-badge-text','nd-back-hook','nd-back-why','nd-back-quote','nd-back-guarantee','nd-back-scan-cta','nd-back-scan-sub','nd-back-badge1','nd-back-badge2','nd-back-badge3'];
  ids.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  // Pre-fill name + desc
  const nameEl = document.getElementById('new-design-name');
  const descEl = document.getElementById('new-design-desc');
  if(nameEl) nameEl.value = d.name || '';
  if(descEl) descEl.value = d.desc || '';
  // Pre-fill back overrides
  const ov = d.backOverrides || {};
  const fieldMap = {
    'nd-back-badge-text': 'postcardBackBadgeText',
    'nd-back-hook': 'postcardHook',
    'nd-back-why': 'postcardWhy',
    'nd-back-quote': 'postcardQuote',
    'nd-back-guarantee': 'postcardGuarantee',
    'nd-back-scan-cta': 'postcardScanCta',
    'nd-back-scan-sub': 'postcardScanSub',
    'nd-back-badge1': 'diff1',
    'nd-back-badge2': 'diff2',
    'nd-back-badge3': 'diff3'
  };
  Object.entries(fieldMap).forEach(([elId, key])=>{
    const el = document.getElementById(elId);
    if(el && ov[key]) el.value = ov[key];
  });
  const colorEl = document.getElementById('nd-back-badge-color');
  if(colorEl) colorEl.value = ov.postcardBackBadgeColor || (S.cfg&&S.cfg.brandColor) || '#F25C05';
  // Show existing front image in preview (no re-upload needed)
  const fw = document.getElementById('nd-front-preview-wrap');
  if(fw && d.url){
    fw.innerHTML = '<img src="'+d.url+'" style="width:100%;height:100%;object-fit:contain;border-radius:8px;">';
  }
  // Mark as edit mode (no file required)
  window._newDesignFile = null;
  window._newDesignDimsOk = true; // existing design already validated
  window._newDesignBackFile = null;
  window._newDesignBackDimsOk = true;
  window._editDesignBackUrl = d.backUrl || null;
  window._editDesignBackMode = true;
  // Always show back upload section — custom designs always have uploaded backs
  const ndBackUploadText = document.getElementById('nd-back-upload-text');
  const ndBackUploadImg = document.getElementById('nd-back-upload-img');
  if(d.backUrl){
    if(ndBackUploadText) ndBackUploadText.style.display = 'none';
    if(ndBackUploadImg){ ndBackUploadImg.src = d.backUrl; ndBackUploadImg.style.display = 'block'; }
  } else {
    if(ndBackUploadText) ndBackUploadText.style.display = '';
    if(ndBackUploadImg){ ndBackUploadImg.style.display = 'none'; ndBackUploadImg.src = ''; }
  }
  // Change save button label
  const saveBtn = document.getElementById('nd-save-btn');
  if(saveBtn) saveBtn.textContent = 'Save Back Changes';
  document.getElementById('add-design-modal').style.display = 'flex';
  // Always render custom back preview
  setTimeout(renderCustomBackPreviewInModal, 200);
}
function deleteDesign(idx){
  if(!confirm('Delete this design?')) return;
  if(!S.cfg.postcardDesigns) return;
  S.cfg.postcardDesigns.splice(idx,1);
  save(); renderDesignsGrid(); renderDripStepDesignSelects();
  toast('Design deleted','success');
}
function setDesignAsDefault(id){
  if(!S.cfg.postcardDesigns) return;
  S.cfg.postcardDesigns.forEach(d=>{ d.isDefault = (d.id===id); });
  save(); renderDesignsGrid();
  toast('Default design updated','success');
}
function getDefaultDesign(){
  const designs = getDesigns();
  return designs.find(d=>d.isDefault) || designs[0] || null;
}

// Design picker modal
window._designPickerCallback=null;
window._selectedDesignId=null;
function openDesignPicker(cb, preselectedId){
  window._designPickerCallback=cb;
  // Pre-select: use passed id, or the default design, or null
  const defaultDesign = getDefaultDesign();
  window._selectedDesignId = preselectedId || (defaultDesign && defaultDesign.id) || null;
  const designs=getDesigns();
  const grid=document.getElementById('design-picker-grid');
  if(!designs.length){
    grid.innerHTML='<div style="padding:30px;text-align:center;color:var(--muted);font-size:13px;grid-column:1/-1;">No designs yet. Go to <strong>Postcard Designs</strong> to upload one.</div>';
  } else {
    grid.innerHTML=designs.map(d=>`<div id="dpick-${d.id}" onclick="selectDesignInPicker('${d.id}')" style="background:var(--card2);border:2px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:border-color .15s;"><div style="position:relative;width:100%;padding-top:66.7%;background:#111827;overflow:hidden;">${d.url?'<img src="'+d.url+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">':'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;">No preview</div>'}</div><div style="padding:8px;font-size:12px;font-weight:700;color:var(--text);">${d.name||'Untitled'}</div></div>`).join('');
  }
  // Highlight pre-selected design
  if(window._selectedDesignId){
    setTimeout(()=>{
      document.querySelectorAll('[id^="dpick-"]').forEach(el=>{ el.style.borderColor='var(--border)'; });
      const pre = document.getElementById('dpick-'+window._selectedDesignId);
      if(pre) pre.style.borderColor='var(--accent)';
    }, 10);
  }
  document.getElementById('design-picker-modal').style.display='flex';
}
function selectDesignInPicker(id){
  window._selectedDesignId=id;
  document.querySelectorAll('[id^="dpick-"]').forEach(el=>{el.style.borderColor='var(--border)';});
  const el=document.getElementById('dpick-'+id);
  if(el) el.style.borderColor='var(--accent)';
}
function closeDesignPicker(){ document.getElementById('design-picker-modal').style.display='none'; }
function confirmDesignPick(){
  if(!window._selectedDesignId){ toast('Please select a design','error'); return; }
  const design=getDesigns().find(d=>d.id===window._selectedDesignId);
  closeDesignPicker();
  if(window._designPickerCallback) window._designPickerCallback(design);
}

// Patch goTab to render designs/drip when tab opens
(function(){
  const _orig=window.goTab;
  if(typeof _orig==='function'){
    window.goTab=function(t){
      _orig(t);
      if(t==='designs') { setTimeout(renderDesignsGrid,50); }
      if(t==='drip') setTimeout(renderDripBuilder,50);
    };
  }
})();

// ═══════════════════════════════════════════════════════════════════════════
// DRIP AUTOMATIONS BUILDER
// ═══════════════════════════════════════════════════════════════════════════

function getDefaultDripSteps(){
  return [
    {id:1,enabled:true,day:0,designId:null,headline:S.cfg.drip2Headline||'We assessed your roof.',subtext:S.cfg.drip2Subtext||'Your estimate is ready. Call us today.'},
    {id:2,enabled:true,day:7,designId:null,headline:S.cfg.drip3Headline||'Still thinking it over?',subtext:S.cfg.drip3Subtext||"Your estimate is still valid. We'd love to help."},
    {id:3,enabled:true,day:14,designId:null,headline:S.cfg.drip4Headline||'Storm season is coming.',subtext:S.cfg.drip4Subtext||"Now's the time to protect your home."},
    {id:4,enabled:true,day:21,designId:null,headline:S.cfg.drip5Headline||'Final notice.',subtext:S.cfg.drip5Subtext||'Your estimate expires soon. Secure your spot.'},
  ];
}
function getDripSteps(){
  if(S.cfg.dripStepsJson&&Array.isArray(S.cfg.dripStepsJson)&&S.cfg.dripStepsJson.length) return S.cfg.dripStepsJson;
  return getDefaultDripSteps();
}
function renderDripBuilder(){
  const tog=document.getElementById('drip-tab-toggle');
  const knob=document.getElementById('drip-tab-knob');
  if(tog&&knob){
    const on=!!S.cfg.dripEnabled;
    tog.style.background=on?'var(--accent)':'var(--border)';
    knob.style.left=on?'21px':'3px';
  }
  const trigger=(S.cfg.dripStepsJson&&S.cfg.dripStepsJson._trigger)||'manual';
  const trigEl=document.getElementById('drip-trigger-'+trigger);
  if(trigEl) trigEl.checked=true;
  renderDripStepCards();
}
function renderDripStepCards(){
  const container=document.getElementById('drip-steps-builder');
  if(!container) return;
  const steps=getDripSteps();
  const designs=getDesigns();
  const designOpts='<option value="">— Default design —</option>'+designs.map(d=>'<option value="'+d.id+'">'+escHtml(d.name||'')+'</option>').join('');
  container.innerHTML=steps.map((step,i)=>`
    <div style="background:var(--card);border:1px solid ${step.enabled?'rgba(242,92,5,.3)':'var(--border)'};border-radius:12px;padding:16px 20px;display:flex;gap:16px;align-items:flex-start;">
      <div style="flex-shrink:0;text-align:center;min-width:48px;">
        <div style="font-family:var(--font-h);font-size:22px;font-weight:800;color:${step.enabled?'var(--accent)':'var(--muted)'};">${i+1}</div>
        <div onclick="toggleDripStep(${i})" style="width:32px;height:18px;border-radius:9px;background:${step.enabled?'var(--accent)':'var(--border)'};cursor:pointer;position:relative;margin:6px auto 0;transition:background .2s;">
          <div style="position:absolute;top:2px;left:${step.enabled?'14px':'2px'};width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s;"></div>
        </div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Delay (days from trigger)</label>
            <input type="number" aria-label="Delay in days" min="0" max="365" value="${step.day}" onchange="updateDripStepField(${i},'day',parseInt(this.value)||0)" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:13px;width:100%;">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Design</label>
            <select onchange="updateDripStepField(${i},'designId',this.value||null)" style="background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:13px;width:100%;cursor:pointer;">
              ${designOpts.replace('value="'+(step.designId||'')+'"','value="'+(step.designId||'')+'" selected')}
            </select>
          </div>
        </div>
        <div style="margin-bottom:8px;">
          <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Headline (max 40 chars)</label>
          <input class="fi" aria-label="Drip step headline" id="drip-headline-${i}" value="${(step.headline||'').replace(/"/g,'&quot;')}" maxlength="40" oninput="updateDripStepField(${i},'headline',this.value)" placeholder="e.g. Still thinking it over?">
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;display:block;margin-bottom:4px;">Subtext (max 80 chars)</label>
          <input class="fi" aria-label="Drip step subtext" id="drip-subtext-${i}" value="${(step.subtext||'').replace(/"/g,'&quot;')}" maxlength="80" oninput="updateDripStepField(${i},'subtext',this.value)" placeholder="e.g. Your estimate is still valid.">
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--card2);">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-bottom:1px solid var(--border);">
            <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">📬 Postcard Preview</span>
            <button onclick="previewDripStepFullscreen(${i})" style="background:var(--accent);border:none;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:700;color:#fff;cursor:pointer;">👁 Preview Postcard</button>
          </div>
          <div id="drip-preview-thumb-${i}" style="padding:10px;min-height:50px;display:flex;align-items:center;justify-content:center;">
            <div style="color:var(--muted);font-size:12px;text-align:center;">Click <strong style="color:var(--text);">Preview Postcard</strong> to see how this step will look</div>
          </div>
        </div>
      </div>
      <button onclick="removeDripStep(${i})" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;flex-shrink:0;padding:0;line-height:1;" title="Remove step">&#x2715;</button>
    </div>
  `).join('');
}
function renderDripStepDesignSelects(){
  const dripTab=document.getElementById('tab-drip');
  if(dripTab&&dripTab.classList.contains('active')) renderDripStepCards();
}
async function previewDripStepFullscreen(idx){
  const steps=getDripSteps();
  const step=steps[idx];
  if(!step){ toast('Step not found','error'); return; }
  // Build a synthetic queue item using the step's headline/subtext + account defaults
  const headline=step.headline||'';
  const subtext=step.subtext||'';
  const companyName=(S.cfg&&S.cfg.companyName)||'Your Roofing Company';
  const phone=(S.cfg&&S.cfg.phone)||'';
  const slug=companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  // Use a sample address for satellite photo
  const sampleAddr='123 Main Street, Anytown, MI 48188';
  const MB=window._mapboxToken||['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
  let photoUrl=null;
  try{
    const geoRes=await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(sampleAddr)+'.json?country=us&types=address&limit=1&access_token='+MB);
    const geoData=await geoRes.json();
    if(geoData.features&&geoData.features[0]){
      const [lon,lat]=geoData.features[0].center;
      photoUrl=`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;
    }
  }catch(e){}
  const fakeItem={
    id:null,
    slug,
    addr:sampleAddr,
    owner:'Sample Homeowner',
    total:15000,
    structures:[],
    photo_url:photoUrl,
    photo_data:null,
    damage_photos:[],
    all_photos:null,
    headline,
    subtext,
    designId:step.designId||null
  };
  // Override S.cfg temporarily with step's headline/subtext so the canvas renderer picks them up
  const _origH1=S.cfg&&S.cfg.postcardHeadline1;
  const _origH2=S.cfg&&S.cfg.postcardHeadline2;
  if(S.cfg&&headline){
    S.cfg.postcardHeadline1=headline;
    S.cfg.postcardHeadline2=subtext;
  }
  try{
    await _showPostcardCanvasModal('m-drip-step-preview-'+idx,'Sample Homeowner',sampleAddr,fakeItem);
  }finally{
    // Restore original values
    if(S.cfg){
      S.cfg.postcardHeadline1=_origH1;
      S.cfg.postcardHeadline2=_origH2;
    }
  }
}
function toggleDripFromTab(){
  S.cfg.dripEnabled=!S.cfg.dripEnabled; save(); renderDripBuilder();
  toast('Drip automations '+(S.cfg.dripEnabled?'enabled':'disabled'),'success');
}
function addDripStep(){
  const steps=getDripSteps();
  const lastDay=steps.length?steps[steps.length-1].day:0;
  steps.push({id:Date.now(),enabled:true,day:lastDay+7,designId:null,headline:'',subtext:''});
  S.cfg.dripStepsJson=steps; renderDripStepCards();
}
function removeDripStep(idx){
  const steps=getDripSteps();
  if(steps.length<=1){ toast('Need at least one step','error'); return; }
  steps.splice(idx,1); S.cfg.dripStepsJson=steps; renderDripStepCards();
}
function toggleDripStep(idx){
  const steps=getDripSteps(); steps[idx].enabled=!steps[idx].enabled;
  S.cfg.dripStepsJson=steps; renderDripStepCards();
}
function updateDripStepField(idx,field,value){
  const steps=getDripSteps(); steps[idx][field]=value; S.cfg.dripStepsJson=steps;
}
function saveDripSequence(){
  const triggerEl=document.querySelector('input[name="drip-trigger"]:checked');
  const trigger=triggerEl?triggerEl.value:'manual';
  const steps=getDripSteps();
  steps._trigger=trigger;
  S.cfg.dripStepsJson=steps; save();
  toast('Drip sequence saved!','success');
}

// Campaign drip queue
function campaignQueueWithDrip(campaignId,pinIds){
  const steps=getDripSteps().filter(s=>s.enabled);
  if(!steps.length){ toast('No drip steps configured','error'); return; }
  const pins=(S.pins||[]).filter(p=>pinIds.includes(p.id));
  if(!pins.length){ toast('No pins found for this campaign','error'); return; }
  let queued=0;
  pins.forEach(pin=>{
    steps.forEach((step,si)=>{
      const _dripSendAt = si===0 ? new Date().toISOString() : new Date(Date.now() + (step.day||7)*86400000).toISOString();
      const item={id:'q_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),pinId:pin.id,address:pin.address||pin.addr||'',lat:pin.lat,lng:pin.lng,name:pin.name||pin.ownerName||'',status:si===0?'needs_approval':'scheduled',dripStep:si+1,dripDay:step.day,designId:step.designId||null,headline:step.headline||'',subtext:step.subtext||'',campaignId:campaignId,createdAt:new Date().toISOString(),at:_dripSendAt,scheduled_send_at:si===0?null:_dripSendAt};
      if(!S.queue) S.queue=[];
      S.queue.push(item); queued++;
    });
  });
  save();
  if(typeof renderQueue==='function') renderQueue();
  if(typeof updateSidebarBadge==='function') updateSidebarBadge();
  toast('Queued '+pins.length+' contacts × '+steps.length+' steps = '+queued+' postcards (Step 1 needs approval)','success');
}
window._pcpCurrentDesignIdx = null;
function openPostcardFullPreview(designIdx){
  const designs = getDesigns();
  const d = designs[designIdx];
  if(!d){ toast('Design not found','error'); return; }
  window._pcpCurrentDesignIdx = designIdx;
  const modal = document.getElementById('m-postcard-preview');
  if(!modal) return;
  // Set front side
  const front = document.getElementById('pcp-front');
  if(front){
    front.innerHTML = d.url
      ? '<img src="'+d.url+'" style="width:100%;height:100%;object-fit:cover;">'
      : '<div style="color:var(--muted);font-size:12px;padding:20px;text-align:center;">No image for this design</div>';
  }
  modal.style.display = 'flex';
  // Render the design back canvas
  renderPostcardPreviewBack(d);
}
async function renderPostcardPreviewBack(d){
  const canvas = document.getElementById('pcp-back-canvas');
  if(!canvas) return;
  const spinner = document.getElementById('pcp-back-spinner');
  if(spinner) spinner.style.display = 'flex';
  try{
    let dataUrl;
    if(d.backUrl){
      // Custom back: composite uploaded image + QR + address block overlay
      dataUrl = await renderCustomBackCanvas(d.backUrl, S.cfg||{});
    } else {
      // Standard BidDrop back: use design text overrides
      const overrides = d.backOverrides || {};
      dataUrl = await renderDesignBackCanvas(S.cfg||{}, overrides);
    }
    if(dataUrl){
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
      };
      img.src = dataUrl;
    }
  } catch(e){ console.warn('pcp back render error:', e); }
  finally{ if(spinner) spinner.style.display = 'none'; }
}
function updatePostcardPreviewData(){
  // Re-render back if design is open (sample data inputs are now just for reference)
  const designs = getDesigns();
  const d = window._pcpCurrentDesignIdx != null ? designs[window._pcpCurrentDesignIdx] : null;
  if(d) renderPostcardPreviewBack(d);
}
// -- END DESIGNS + DRIP MODULE ------------------------------------------------

// ── DRIP ACTIVE CONTACTS ─────────────────────────────────────────────────────
function renderActiveDripContacts(){
  const el = document.getElementById('drip-active-contacts');
  if(!el) return;
  // Collect all estimates that have an active drip (steps with no sentAt)
  const ests = window.S?.estimates || [];
  const active = ests.filter(e=>
    e.drip && e.drip.steps && e.drip.steps.some(s=>!s.sentAt && !s.paused)
  );
  if(!active.length){
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px;">No contacts currently in an active drip sequence.</div>';
    return;
  }
  el.innerHTML = active.map(est=>{
    const steps = est.drip.steps || [];
    const pending = steps.filter(s=>!s.sentAt);
    const sent = steps.filter(s=>s.sentAt);
    const nextStep = pending[0];
    const nextDate = nextStep?.sendAt ? new Date(nextStep.sendAt).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
    const pin = (window.S?.pins||[]).find(p=>p.id===est.pinId);
    const status = pin?.status || 'active';
    const sc = {needs_roof:'#F59E0B',interested:'#A78BFA',contacted:'#60A5FA',quoted:'#3B82F6',signed:'#22C55E',converted:'#22C55E',not_interested:'#6B7280',lost:'#EF4444'}[status]||'#96B0C8';
    const addr = escHtml(est.addr||est.address||'Unknown address');
    const owner = escHtml(est.owner||'Homeowner');
    const estId = escHtml(est.id||'');
    return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:180px;">
        <div style="font-size:13px;font-weight:700;color:var(--text);">${addr}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;">${owner} &middot; $${(est.total||0).toLocaleString()}</div>
        <div style="display:flex;gap:10px;margin-top:6px;font-size:11px;">
          <span style="color:#22C55E;">&#10003; ${sent.length} sent</span>
          <span style="color:#F59E0B;">&#9200; ${pending.length} pending</span>
          <span style="color:var(--muted);">Next: ${nextDate}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <span style="background:${sc};color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:5px;">${status.replace(/_/g,' ')}</span>
        <div style="display:flex;gap:6px;">
          <button onclick="pauseDripForContact('${estId}')" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.4);border-radius:5px;padding:4px 10px;color:#F59E0B;font-size:10px;font-weight:700;cursor:pointer;">&#9646;&#9646; Pause</button>
          <button onclick="cancelDripForContact('${estId}')" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:5px;padding:4px 10px;color:#EF4444;font-size:10px;font-weight:700;cursor:pointer;">&#10005; Cancel</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function pauseDripForContact(estId){
  const est = (window.S?.estimates||[]).find(e=>e.id===estId);
  if(!est||!est.drip) return;
  const pending = est.drip.steps.filter(s=>!s.sentAt);
  if(!pending.length){ toast('No pending steps to pause','info'); return; }
  pending.forEach(s=>{ s.paused = true; });
  est.drip.paused = true;
  if(typeof save==='function') save();
  toast('Drip paused for '+escHtml(est.addr||'contact')+' — '+pending.length+' steps on hold','info');
  renderActiveDripContacts();
}
function cancelDripForContact(estId){
  if(!confirm('Cancel the drip sequence for this contact? Pending steps will be removed.')) return;
  const est = (window.S?.estimates||[]).find(e=>e.id===estId);
  if(!est||!est.drip) return;
  est.drip.steps = est.drip.steps.filter(s=>s.sentAt);
  est.drip.cancelled = true;
  est.drip.cancelledAt = new Date().toISOString();
  if(typeof save==='function') save();
  toast('Drip cancelled for '+escHtml(est.addr||'contact'),'success');
  renderActiveDripContacts();
}

// ── TERRITORY INTEL MODULE ─────────────────────────────────────────────────
function refreshTerritoryIntel(){
  renderTerritoryIntel();
}
function renderTerritoryIntel(){
  const listEl=document.getElementById('ti-event-list');
  if(!listEl)return;
  const events=window._stormData||[];
  const typeFilter=document.getElementById('ti-filter-type')?.value||'all';
  const sizeFilter=parseFloat(document.getElementById('ti-filter-size')?.value||'0');
  const stateFilter=(document.getElementById('ti-filter-state')?.value||'').trim().toUpperCase();
  const groupByCounty=document.getElementById('ti-group-county')?.checked!==false;

  let filtered=events.filter(e=>{
    if(typeFilter==='hail'&&e.type!=='hail')return false;
    if(typeFilter==='wind'&&e.type!=='wind')return false;
    if(sizeFilter>0&&(parseFloat(e.size)||0)<sizeFilter)return false;
    if(stateFilter&&!(e.state||'').toUpperCase().includes(stateFilter))return false;
    return true;
  });

  // Update stats
  const hailCount=events.filter(e=>e.type==='hail').length;
  const windCount=events.filter(e=>e.type==='wind').length;
  const counties=new Set(events.map(e=>(e.county||e.location||'').split(',')[0].trim()).filter(Boolean));
  const launched=(S.campaigns||[]).filter(c=>c.stormId).length;
  const hailEl=document.getElementById('ti-stat-hail');
  const windEl=document.getElementById('ti-stat-wind');
  const countiesEl=document.getElementById('ti-stat-counties');
  const launchedEl=document.getElementById('ti-stat-launched');
  if(hailEl)hailEl.textContent=hailCount;
  if(windEl)windEl.textContent=windCount;
  if(countiesEl)countiesEl.textContent=counties.size;
  if(launchedEl)launchedEl.textContent=launched;

  if(!filtered.length){
    listEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted);font-size:14px;">No storm events match your filters.<br><span style="font-size:12px;">Try enabling Storm Events on the map first, or adjust filters.</span></div>';
    return;
  }

  // Sort by date desc
  filtered.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));

  if(groupByCounty){
    const byCounty={};
    filtered.forEach(e=>{
      const key=(e.county||e.location||'Unknown County').split(',')[0].trim()+', '+(e.state||'');
      if(!byCounty[key])byCounty[key]=[];
      byCounty[key].push(e);
    });
    listEl.innerHTML=Object.entries(byCounty).map(([county,evts])=>{
      const maxSize=Math.max(...evts.map(e=>parseFloat(e.size)||0));
      const hailEvts=evts.filter(e=>e.type==='hail');
      const windEvts=evts.filter(e=>e.type==='wind');
      const lat=evts[0].lat||evts[0].latitude||null;
      const lng=evts[0].lng||evts[0].longitude||null;
      const hasCoords=lat&&lng;
      return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:800;color:var(--text);font-family:var(--font-h);">${escHtml(county)}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:4px;">
              ${hailEvts.length?`<span style="color:#F59E0B;margin-right:10px;">🌨 ${hailEvts.length} hail event${hailEvts.length>1?'s':''} (max ${maxSize}")</span>`:''}
              ${windEvts.length?`<span style="color:#34d399;">💨 ${windEvts.length} wind event${windEvts.length>1?'s':''}</span>`:''}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">Most recent: ${evts[0].date?new Date(evts[0].date).toLocaleDateString():'Unknown date'}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;">
            ${hasCoords?`<button onclick="tiViewOnMap(${lat},${lng})" style="background:var(--card);border:1px solid var(--border);border-radius:7px;padding:7px 12px;color:var(--text);font-size:12px;font-weight:700;cursor:pointer;">🗺 View</button>`:''}
            ${hasCoords?`<button onclick="tiLaunchCampaign(${lat},${lng},'${escHtml(county).replace(/'/g,"\'")}',${JSON.stringify(evts.map(e=>e.id||''))})" style="background:var(--accent);border:none;border-radius:7px;padding:7px 14px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">📣 Launch Campaign</button>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
  } else {
    listEl.innerHTML=filtered.map(e=>{
      const lat=e.lat||e.latitude||null;
      const lng=e.lng||e.longitude||null;
      const hasCoords=lat&&lng;
      const sizeLabel=e.type==='hail'?` — ${e.size||'?'}" hail`:(e.speed?` — ${e.speed} MPH`:'');
      return `<div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <div style="font-size:22px;">${e.type==='hail'?'🌨':'💨'}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:var(--text);">${escHtml(e.county||e.location||'Unknown')}, ${escHtml(e.state||'')}</div>
          <div style="font-size:12px;color:var(--muted);">${e.date?new Date(e.date).toLocaleDateString():''}${sizeLabel}</div>
        </div>
        ${hasCoords?`<button onclick="tiViewOnMap(${lat},${lng})" style="background:var(--card);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-size:11px;font-weight:700;cursor:pointer;">🗺</button>`:''}
        ${hasCoords?`<button onclick="tiLaunchCampaign(${lat},${lng},'${escHtml((e.county||e.location||'').replace(/'/g,"\'"))}',[])" style="background:var(--accent);border:none;border-radius:7px;padding:6px 12px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;">📣 Campaign</button>`:''}
      </div>`;
    }).join('');
  }
}
function tiViewOnMap(lat,lng){
  goTab('map');
  setTimeout(()=>{
    if(window._map){window._map.setView([lat,lng],15);}
  },300);
}
function tiLaunchCampaign(lat,lng,countyName,stormIds){
  // Show storm campaign suggestion modal
  openStormCampaignSuggest(lat,lng,countyName,stormIds);
}
function openStormCampaignSuggest(lat,lng,countyName,stormIds){
  const existing = document.getElementById('m-storm-suggest');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'm-storm-suggest';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;width:460px;max-width:100%;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:16px;font-weight:800;color:var(--text);font-family:var(--font-h);">📣 Launch Storm Campaign</div>
        <button onclick="document.getElementById('m-storm-suggest').remove()" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#F59E0B;margin-bottom:4px;">🌨 Storm Event Detected</div>
        <div style="font-size:12px;color:var(--muted);">${escHtml(countyName)} — ${stormIds&&stormIds.length?stormIds.length+' event'+(stormIds.length>1?'s':''):''} in your territory</div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">Campaign Name</label>
        <input id="storm-camp-name" class="fi" value="Storm Response — ${escHtml(countyName).replace(/,.*$/,'')}" style="font-size:13px;">
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">Radius (miles)</label>
        <select id="storm-camp-radius" class="fs" style="font-size:13px;">
          <option value="0.5">0.5 miles</option>
          <option value="1" selected>1 mile</option>
          <option value="2">2 miles</option>
          <option value="3">3 miles</option>
          <option value="5">5 miles</option>
        </select>
      </div>
      <div style="margin-bottom:20px;">
        <label style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;">Message Focus</label>
        <select id="storm-camp-msg" class="fs" style="font-size:13px;">
          <option value="hail">Hail Damage — Free Inspection</option>
          <option value="wind">Wind Damage — Free Inspection</option>
          <option value="general">Storm Damage — Free Inspection</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('m-storm-suggest').remove()" style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>
        <button onclick="launchStormCampaignFromSuggest(${lat},${lng})" style="flex:2;background:var(--accent);border:none;border-radius:8px;padding:10px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">📣 Go to Map &amp; Launch Campaign</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
function launchStormCampaignFromSuggest(lat,lng){
  const name = document.getElementById('storm-camp-name')?.value || '';
  const radius = parseFloat(document.getElementById('storm-camp-radius')?.value||'1');
  const msg = document.getElementById('storm-camp-msg')?.value || 'general';
  document.getElementById('m-storm-suggest')?.remove();
  // Store suggestion for map to pick up
  window._stormCampaignSuggest = {lat,lng,name,radius,msg};
  goTab('map');
  setTimeout(()=>{
    if(window._map){
      window._map.setView([lat,lng],14);
      toast('📣 '+name+' — drop a pin or use Nearby Campaign to launch ('+radius+'mi radius)','info',6000);
    }
    // Pre-fill nearby campaign modal if it exists
    const campName = document.getElementById('nearby-campaign-name');
    if(campName) campName.value = name;
    const campRadius = document.getElementById('nearby-campaign-radius');
    if(campRadius) campRadius.value = String(radius);
  },400);
}
// Hook: when Territory Intel tab opens, render it
(function(){
  const _origGoTab=typeof goTab==='function'?goTab:null;
  if(_origGoTab){
    const _patchedGoTab=function(t){
      _origGoTab(t);
      if(t==='territory'){setTimeout(renderTerritoryIntel,100);}
      if(t==='subscription'){setTimeout(renderSubscriptionUI,100);}
    };
    window.goTab=_patchedGoTab;
  }
})();

// ── SUBSCRIPTION UI MODULE ─────────────────────────────────────────────────
const PLAN_INFO={
  starter:{label:'Starter',price:'$97/mo',credits:15,color:'#96B0C8',desc:'Perfect for solo reps getting started.'},
  pro:{label:'Pro',price:'$197/mo',credits:40,color:'#F25C05',desc:'Full platform access for growing teams.'},
  agency:{label:'Agency',price:'$397/mo',credits:100,color:'#A855F7',desc:'Multi-team management with Territory Intel.'},
  enterprise:{label:'Enterprise',price:'Custom',credits:200,color:'#22C55E',desc:'White-label + custom integrations.'},
};
function renderSubscriptionUI(){
  const plan=(S.cfg&&S.cfg.plan)||'starter';
  const info=PLAN_INFO[plan]||PLAN_INFO.starter;
  const badge=document.getElementById('sub-plan-badge');
  const desc=document.getElementById('sub-plan-desc');
  const credLine=document.getElementById('sub-credits-line');
  const creditDetail=document.getElementById('sub-credit-detail');
  const upgradeBtn=document.getElementById('sub-btn-upgrade');
  const cancelBtn=document.getElementById('sub-btn-cancel');
  if(badge){badge.textContent=info.label+' — '+info.price;badge.style.color=info.color;}
  if(desc)desc.textContent=info.desc;
  const paid=S.cfg.mailerCredits||0;
  const free=Math.max(0,(S.cfg.freeMailerCreditsUsed||0));
  if(credLine)credLine.textContent=`${paid} paid credits remaining · ${info.credits} credits/month included`;
  if(creditDetail)creditDetail.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:400px;">
      <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Paid Credits</div><div style="font-size:22px;font-weight:900;color:var(--accent);margin-top:2px;">${paid}</div></div>
      <div><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;">Monthly Allotment</div><div style="font-size:22px;font-weight:900;color:#60a5fa;margin-top:2px;">${info.credits}</div></div>
    </div>
    <div style="margin-top:10px;font-size:12px;color:var(--muted);">1 credit = 1 postcard sent ($4.00 value). Credits roll over month to month.</div>
    <button onclick="showBuyCreditsModal()" style="margin-top:12px;background:var(--accent);border:none;border-radius:8px;padding:8px 18px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">🔍 Buy More Credits</button>
  `;
  // Highlight current plan column in the table
  const planOrder=['starter','pro','agency','enterprise'];
  const planIdx=planOrder.indexOf(plan);
  const tbody=document.getElementById('sub-plan-table-body');
  if(tbody){
    tbody.querySelectorAll('tr').forEach(row=>{
      const cells=row.querySelectorAll('td');
      cells.forEach((cell,i)=>{
        if(i===planIdx+1){
          cell.style.background='rgba(242,92,5,0.08)';
          cell.style.fontWeight='700';
          cell.style.color='var(--accent)';
        } else {
          cell.style.background='';
          cell.style.fontWeight='';
          cell.style.color='';
        }
      });
    });
  }
  // Show/hide upgrade button
  if(upgradeBtn){
    if(plan==='enterprise'){upgradeBtn.style.display='none';}
    else{upgradeBtn.style.display='';upgradeBtn.textContent='⬆ Upgrade to '+(PLAN_INFO[planOrder[planIdx+1]]?.label||'Next Tier');}
  }
}
function subUpgrade(){
  const plan=(S.cfg&&S.cfg.plan)||'starter';
  const planOrder=['starter','pro','agency','enterprise'];
  const nextPlan=planOrder[planOrder.indexOf(plan)+1];
  if(!nextPlan){toast('You are already on the highest plan','info');return;}
  const info=PLAN_INFO[nextPlan];
  if(confirm(`Upgrade to ${info.label} (${info.price})?

This will open the billing portal to complete your upgrade.`)){
    // Open Stripe billing portal or upgrade URL
    const upgradeUrl='https://biddrop.us/upgrade?plan='+nextPlan;
    window.open(upgradeUrl,'_blank');
  }
}
function subCancel(){
  if(!confirm('Are you sure you want to cancel your subscription?\n\nYour access will continue until the end of your current billing period.')){return;}
  adminAPI('cancel-stripe-subscription',{acctId:currentAccount?.id}).then(r=>{
    if(r&&r.success){toast('Subscription cancelled. Access continues until end of billing period.','success');}
    else{toast('Could not cancel automatically. Please contact support@biddrop.us','error');}
  }).catch(()=>{toast('Could not cancel automatically. Please contact support@biddrop.us','error');});
}
// -- END TERRITORY INTEL + SUBSCRIPTION MODULE --------------------------------


// ─────────────────────────────────────────────────────────────
// INVITE REP MODAL
// ─────────────────────────────────────────────────────────────
function openInviteRepModal() {
  const modal = document.getElementById('invite-rep-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('invite-rep-name').value = '';
  document.getElementById('invite-rep-email').value = '';
  document.getElementById('invite-rep-role').value = 'rep';
  const err = document.getElementById('invite-rep-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
}

function closeInviteRepModal() {
  const modal = document.getElementById('invite-rep-modal');
  if (modal) modal.style.display = 'none';
}

async function submitInviteRep() {
  const name = (document.getElementById('invite-rep-name').value || '').trim();
  const email = (document.getElementById('invite-rep-email').value || '').trim();
  const role = document.getElementById('invite-rep-role').value;
  const errEl = document.getElementById('invite-rep-error');
  const btn = document.getElementById('invite-rep-submit-btn');

  const showErr = (msg) => {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  };

  if (!name) return showErr('Please enter the rep\'s full name.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Please enter a valid email address.');

  btn.disabled = true;
  btn.textContent = 'Sending…';
  errEl.style.display = 'none';

  try {
    const tok = (await window._sb.auth.getSession()).data.session?.access_token;
    const res = await fetch('/api/admin?action=invite-rep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ name, email, role, viewingAccountId: (typeof currentAccount !== "undefined" && currentAccount?.id) || null })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to invite rep');

    closeInviteRepModal();
    // Refresh team list
    if (typeof renderSettingsTeam === 'function') renderSettingsTeam();
    alert(`✅ Invite sent to ${email}! They'll receive an email with login instructions.`);
  } catch (e) {
    showErr(e.message || 'Something went wrong. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Invite';
  }
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
  const modal = document.getElementById('invite-rep-modal');
  if (modal && e.target === modal) closeInviteRepModal();
});

// ─────────────────────────────────────────────────────────────
// ANALYTICS CSV EXPORT
// ─────────────────────────────────────────────────────────────
function exportAnalyticsCSV() {
  const period = document.getElementById('an-period')?.value || '30';
  const periodLabel = period === 'all' ? 'All Time' : `Last ${period} Days`;

  // Build rows from current S data
  const now = Date.now();
  let cutoff = 0;
  let cutoffTo = null;
  if(period === 'custom'){
    const fromVal = document.getElementById('an-date-from')?.value;
    const toVal = document.getElementById('an-date-to')?.value;
    cutoff = fromVal ? new Date(fromVal + 'T00:00:00').getTime() : 0;
    cutoffTo = toVal ? new Date(toVal + 'T23:59:59').getTime() : null;
  } else {
    cutoff = period === 'all' ? 0 : now - parseInt(period) * 86400000;
  }

  const pins = (window.S?.pins || []).filter(p => !cutoff || new Date(p.created_at || 0).getTime() >= cutoff);
  const estimates = (window.S?.estimates || []).filter(e => !cutoff || new Date(e.created_at || 0).getTime() >= cutoff);
  const queue = (window.S?.queue || []).filter(q => !cutoff || new Date(q.created_at || 0).getTime() >= cutoff);

  // Summary rows
  const summaryRows = [
    ['BidDrop Analytics Export'],
    [`Period: ${periodLabel}`],
    [`Exported: ${new Date().toLocaleString()}`],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Homes Pinned', pins.length],
    ['Estimates Built', estimates.length],
    ['Postcards Queued', queue.length],
    ['Postcards Sent', queue.filter(q => q.status === 'sent').length],
    ['Signed Jobs', pins.filter(p => p.status === 'signed').length],
    ['Converted', pins.filter(p => p.status === 'converted').length],
    [],
    ['PINS / CONTACTS'],
    ['Address', 'Status', 'Rep', 'Date', 'GHL Synced'],
    ...pins.map(p => [
      p.addr || '',
      p.status || '',
      p.rep_name || p.rep || '',
      p.created_at ? new Date(p.created_at).toLocaleDateString() : '',
      p.ghl_contact_id ? 'Yes' : 'No'
    ]),
    [],
    ['ESTIMATES'],
    ['Address', 'Total', 'Status', 'Rep', 'Date'],
    ...estimates.map(e => [
      e.addr || '',
      e.total ? `$${Number(e.total).toLocaleString()}` : '',
      e.status || '',
      e.rep_name || '',
      e.created_at ? new Date(e.created_at).toLocaleDateString() : ''
    ])
  ];

  const csvContent = summaryRows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `biddrop-analytics-${period === 'all' ? 'all-time' : period + 'd'}-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// ANALYTICS: Period change handler (show/hide custom date range)
function _anPeriodChanged(){
  const period = document.getElementById('an-period')?.value;
  const rangeDiv = document.getElementById('an-custom-range');
  if(rangeDiv){
    rangeDiv.style.display = period === 'custom' ? 'flex' : 'none';
    if(period === 'custom'){
      // Default to last 30 days as starting range
      const to = new Date();
      const from = new Date(Date.now() - 30*86400000);
      const fmt = d => d.toISOString().slice(0,10);
      const fromEl = document.getElementById('an-date-from');
      const toEl = document.getElementById('an-date-to');
      if(fromEl && !fromEl.value) fromEl.value = fmt(from);
      if(toEl && !toEl.value) toEl.value = fmt(to);
      return; // don't reload yet — wait for date inputs
    }
  }
  loadAnalytics();
}
// ─────────────────────────────────────────────────────────────
// ANALYTICS: PDF Export
function exportAnalyticsPDF(){
  const period = document.getElementById('an-period')?.value || '30';
  let periodLabel = period === 'all' ? 'All Time' : period === 'custom' ? 'Custom Range' : `Last ${period} Days`;
  if(period === 'custom'){
    const from = document.getElementById('an-date-from')?.value;
    const to = document.getElementById('an-date-to')?.value;
    if(from && to) periodLabel = `${from} → ${to}`;
  }
  // Collect stat card values from the DOM
  function getStat(id){ return document.getElementById(id)?.textContent?.trim() || '—'; }
  const stats = [
    ['Postcards Sent', getStat('an-postcards')],
    ['QR Scans', getStat('an-scans')],
    ['Engagement Rate', getStat('an-open-rate')],
    ['Signed Jobs', getStat('an-signed')],
    ['Estimates Built', getStat('an-estimates')],
    ['Homes Pinned', getStat('an-pins')],
    ['Est. Pipeline Value', getStat('an-pipeline')],
    ['Close Rate', getStat('an-close-rate')],
    ['Page Views', getStat('an-page-views')],
    ['Booking Clicks', getStat('an-booking-clicks')],
    ['Call Clicks', getStat('an-call-clicks')],
    ['View Rate', getStat('an-view-rate')],
  ];
  // Collect rep table rows
  const repRows = [];
  document.querySelectorAll('#an-rep-table tr').forEach(tr => {
    const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.trim());
    if(cells.length) repRows.push(cells);
  });
  // Build HTML for print
  const companyName = window.S?.cfg?.companyName || 'BidDrop';
  const printHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${companyName} Analytics</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111;background:#fff;}
  h1{font-size:26px;font-weight:900;margin:0 0 4px;}h1 span{color:#F97316;}
  .sub{font-size:13px;color:#666;margin-bottom:24px;}
  .section{margin-bottom:28px;}
  .section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;border-bottom:2px solid #F97316;padding-bottom:4px;margin-bottom:14px;}
  .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
  .stat{background:#f8f8f8;border:1px solid #e5e5e5;border-radius:8px;padding:14px 16px;}
  .stat-lbl{font-size:11px;color:#666;margin-bottom:4px;}
  .stat-val{font-size:22px;font-weight:800;color:#111;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:#f0f0f0;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#666;}
  td{padding:8px 12px;border-bottom:1px solid #eee;}
  @media print{body{padding:16px;}}
</style></head><body>
<h1>Bid<span>Drop</span> Analytics</h1>
<div class="sub">${companyName} &bull; ${periodLabel} &bull; Exported ${new Date().toLocaleString()}</div>
<div class="section">
  <div class="section-title">Performance Summary</div>
  <div class="stats-grid">
    ${stats.map(([lbl,val])=>`<div class="stat"><div class="stat-lbl">${lbl}</div><div class="stat-val">${val}</div></div>`).join('')}
  </div>
</div>
${repRows.length ? `<div class="section">
  <div class="section-title">Rep Performance</div>
  <table><thead><tr><th>Rep</th><th>Pins</th><th>Estimates</th><th>Pipeline</th><th>Signed</th><th>Close %</th><th>Top Trades</th></tr></thead>
  <tbody>${repRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
</div>` : ''}
</body></html>`;
  const win = window.open('','_blank','width=900,height=700');
  if(!win){ toast('Pop-up blocked — allow pop-ups to export PDF','error'); return; }
  win.document.write(printHtml);
  win.document.close();
  win.focus();
  setTimeout(()=>{ win.print(); }, 400);
}
// ─────────────────────────────────────────────────────────────
// CAMPAIGN PERFORMANCE STATS
// ─────────────────────────────────────────────────────────────
function getCampaignPerformanceStats(campaign) {
  // Count pins that belong to this campaign
  const campaignPins = (window.S?.pins || []).filter(p =>
    p.campaign_id === campaign.id ||
    (p.source === 'campaign' && p.campaign_name === campaign.name)
  );

  // Count estimates for those pins
  const pinAddrs = new Set(campaignPins.map(p => p.addr));
  const campaignEstimates = (window.S?.estimates || []).filter(e => pinAddrs.has(e.addr));

  // Count QR scans for those pins
  const campaignScans = (window.S?.scans || []).filter(s =>
    campaignPins.some(p => p.id === s.pin_id)
  );

  // Count postcards sent for this campaign
  const campaignMail = (window.S?.queue || []).filter(q =>
    q.campaign_id === campaign.id || q.campaign_name === campaign.name
  );
  const sent = campaignMail.filter(q => q.status === 'sent').length;
  const pending = campaignMail.filter(q => ['pending', 'needs_approval'].includes(q.status)).length;

  // Conversion rate: estimates / pins
  const convRate = campaignPins.length > 0
    ? Math.round((campaignEstimates.length / campaignPins.length) * 100)
    : 0;

  return {
    pins: campaignPins.length,
    estimates: campaignEstimates.length,
    scans: campaignScans.length,
    sent,
    pending,
    convRate
  };
}

// Patch renderCampaigns to include performance stats if it exists
const _origRenderCampaigns = window.renderCampaigns;
if (typeof _origRenderCampaigns === 'function') {
  window.renderCampaigns = function() {
    _origRenderCampaigns();
    // After render, inject performance stats into each campaign card
    setTimeout(() => {
      const cards = document.querySelectorAll('.campaign-card[data-campaign-id]');
      cards.forEach(card => {
        const cid = card.dataset.campaignId;
        const campaign = (window.S?.campaigns || []).find(c => c.id === cid);
        if (!campaign) return;
        const stats = getCampaignPerformanceStats(campaign);
        let statsEl = card.querySelector('.campaign-perf-stats');
        if (!statsEl) {
          statsEl = document.createElement('div');
          statsEl.className = 'campaign-perf-stats';
          statsEl.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--border);background:rgba(0,0,0,.15);';
          card.appendChild(statsEl);
        }
        statsEl.innerHTML = `
          <span style="font-size:11px;color:var(--muted);">📍 <strong style="color:var(--text)">${stats.pins}</strong> pins</span>
          <span style="font-size:11px;color:var(--muted);">📋 <strong style="color:var(--text)">${stats.estimates}</strong> estimates</span>
          <span style="font-size:11px;color:var(--muted);">🔍 <strong style="color:var(--text)">${stats.scans}</strong> scans</span>
          <span style="font-size:11px;color:var(--muted);">📬 <strong style="color:var(--text)">${stats.sent}</strong> sent</span>
          ${stats.pending > 0 ? `<span style="font-size:11px;color:var(--warning);">⏳ ${stats.pending} pending</span>` : ''}
          <span style="font-size:11px;color:var(--muted);">📈 <strong style="color:${stats.convRate > 20 ? 'var(--success)' : 'var(--text)'}">${stats.convRate}%</strong> conv.</span>
        `;
      });
    }, 100);
  };
}

// ── Campaign QR Stats Modal ──────────────────────────────────────────────────
function openCampaignQRStats(campaignId) {
  const campaign = (S.campaigns||[]).find(c => c.id === campaignId);
  const campObj = campaign || { id: campaignId };
  // Get campaign pins
  const campaignPins = (S.pins||[]).filter(p =>
    p.campaign_id === campaignId ||
    (p.source === 'campaign' && campaign && p.campaign_name === campaign.name)
  );
  const pinIds = new Set(campaignPins.map(p => p.id));
  const pinAddrs = new Set(campaignPins.map(p => (p.address||p.addr||'').trim().toLowerCase()));
  // Get estimates for those pins
  const campaignEstimates = (S.estimates||[]).filter(e =>
    (e.pinId && pinIds.has(e.pinId)) ||
    pinAddrs.has((e.addr||'').trim().toLowerCase())
  ).filter(e => !e.deletedAt && !e.isRevision);
  // Build modal content
  const modal = document.getElementById('m-campaign-qr-stats');
  const body = document.getElementById('campaign-qr-stats-body');
  if (!modal || !body) { toast('QR Stats modal not found','error'); return; }
  const totalScans = campaignEstimates.reduce((s,e) => s + (e.qr_scan_count||0), 0);
  const totalViews = campaignEstimates.reduce((s,e) => s + (e.page_views||0), 0);
  const totalSigned = campaignEstimates.filter(e => e.signedAt).length;
  // Stats summary strip
  let html = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">'
    + '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">'
    + '<div style="font-size:22px;font-weight:800;color:#60a5fa;">'+campaignPins.length+'</div>'
    + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Pins</div></div>'
    + '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">'
    + '<div style="font-size:22px;font-weight:800;color:#F59E0B;">'+totalScans+'</div>'
    + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">QR Scans</div></div>'
    + '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">'
    + '<div style="font-size:22px;font-weight:800;color:#10b981;">'+totalViews+'</div>'
    + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Page Views</div></div>'
    + '<div style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;">'
    + '<div style="font-size:22px;font-weight:800;color:#4ade80;">'+totalSigned+'</div>'
    + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Signed</div></div>'
    + '</div>';
  if (!campaignEstimates.length) {
    html += '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px;">No estimates found for this campaign yet.</div>';
  } else {
    html += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">'
      + '<thead><tr style="border-bottom:2px solid var(--border);">'
      + '<th style="padding:8px 10px;text-align:left;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px;">Address</th>'
      + '<th style="padding:8px 10px;text-align:left;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px;">Homeowner</th>'
      + '<th style="padding:8px 10px;text-align:center;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px;">QR Scans</th>'
      + '<th style="padding:8px 10px;text-align:center;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px;">Page Views</th>'
      + '<th style="padding:8px 10px;text-align:center;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px;">Last Viewed</th>'
      + '<th style="padding:8px 10px;text-align:center;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;font-size:10px;">Status</th>'
      + '</tr></thead><tbody>';
    const sorted = campaignEstimates.slice().sort(function(a,b){ return (b.qr_scan_count||0) - (a.qr_scan_count||0); });
    sorted.forEach(function(est) {
      const scans = est.qr_scan_count || 0;
      const views = est.page_views || 0;
      const lastViewed = est.page_first_viewed_at
        ? new Date(est.page_first_viewed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
        : '—';
      const signed = est.signedAt
        ? '<span style="background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(34,197,94,.4);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">✓ Signed</span>'
        : (views > 0
          ? '<span style="background:rgba(59,130,246,.1);color:#60a5fa;border:1px solid rgba(59,130,246,.4);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">Viewed</span>'
          : '<span style="font-size:10px;color:var(--muted);">Not viewed</span>');
      const shortAddr = (est.addr||'—').split(',')[0];
      html += '<tr style="border-bottom:1px solid var(--border);">'
        + '<td style="padding:9px 10px;color:var(--text);font-weight:600;">'+escHtml(shortAddr)+'</td>'
        + '<td style="padding:9px 10px;color:var(--mid);">'+escHtml(est.owner||'—')+'</td>'
        + '<td style="padding:9px 10px;text-align:center;font-weight:700;color:'+(scans>0?'#F59E0B':'var(--muted)')+';">'+scans+'</td>'
        + '<td style="padding:9px 10px;text-align:center;font-weight:700;color:'+(views>0?'#10b981':'var(--muted)')+';">'+views+'</td>'
        + '<td style="padding:9px 10px;text-align:center;color:var(--muted);">'+lastViewed+'</td>'
        + '<td style="padding:9px 10px;text-align:center;">'+signed+'</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
  }
  body.innerHTML = html;
  // Set modal title
  const titleEl = document.getElementById('campaign-qr-stats-title');
  if (titleEl) titleEl.textContent = campaign ? (campaign.source_address || 'Campaign') : 'Campaign QR Stats';
  modal.style.display = 'flex';
}

