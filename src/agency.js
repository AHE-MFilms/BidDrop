// src/agency.js
// Super-admin agency dashboard — KPIs, account cards, credit adjustments,
// mailer log, leaderboard, activity chart, client account editing.
// Depends on: sb, S, currentAccount, adminAPI(), toast(), escHtml() (ui.js)
// Extracted from index.html — Tier 5 modularization

let _agencyData = null; // cached {accounts, profiles, pins, mailerLog}

async function renderAgencyView(){
  if(!isSuperAdmin()) return;
  // Show loading state
  document.getElementById('agency-accounts-grid').innerHTML =
    '<div style="color:var(--muted);font-size:12px;padding:10px;">Loading client data…</div>';
  document.getElementById('agency-mailer-log').innerHTML =
    '<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;">Loading…</div>';

  try {
    // Fetch all data via secure server-side API
    const { accounts: allAccounts, profiles, pins, mailerLog } = await adminAPI('agency-data');

    // Filter out AHE agency account from client list
    const clientAccounts = (allAccounts||[]).filter(a=>a.id!==AGENCY_ACCOUNT_ID);

    _agencyData = { accounts: clientAccounts, profiles: profiles||[], pins: pins||[], mailerLog: mailerLog||[] };

    // Populate filter dropdown
    const filterSel = document.getElementById('ag-log-filter');
    if(filterSel){
      filterSel.innerHTML = '<option value="all">All Clients</option>' +
        clientAccounts.map(a=>'<option value="'+a.id+'">'+(a.company_name||a.name)+'</option>').join('');
    }

    renderAgencyKPIs();
    renderAgencyAccounts();
    renderAgencyMailerLog();
  } catch(e){
    console.error('Agency view error:', e);
    document.getElementById('agency-accounts-grid').innerHTML =
      '<div style="color:var(--danger);font-size:12px;">Error loading data: '+escHtml(e.message)+'</div>';
  }
}

function renderAgencyKPIs(){
  if(!_agencyData) return;
  const {accounts, pins, mailerLog} = _agencyData;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const activeClients = accounts.filter(a=>a.active!==false).length;
  const mailersThisMonth = mailerLog.filter(m=>m.sent_at>=monthStart).length;

  // Revenue = sum of (mailer_rate * count) per account this month
  let revThisMonth = 0;
  accounts.forEach(a=>{
    const rate = parseFloat(a.mailer_rate)||2.50;
    const count = mailerLog.filter(m=>m.account_id===a.id && m.sent_at>=monthStart).length;
    revThisMonth += rate * count;
  });

  const totalPins = pins.length;

  document.getElementById('ag-clients').textContent = activeClients;
  document.getElementById('ag-mailers-mo').textContent = mailersThisMonth.toLocaleString();
  document.getElementById('ag-rev-mo').textContent = '$'+revThisMonth.toFixed(2);
  document.getElementById('ag-pins').textContent = totalPins.toLocaleString();
}

function filterAgencyAccounts(){
  if(!_agencyData) return;
  const q      = (document.getElementById('ag-search')?.value||'').toLowerCase().trim();
  const sort   = document.getElementById('ag-sort')?.value || 'name_asc';
  const plan   = document.getElementById('ag-filter-plan')?.value || 'all';
  const status = document.getElementById('ag-filter-status')?.value || 'all';
  const {accounts, profiles, pins, mailerLog} = _agencyData;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let filtered = accounts.filter(a=>{
    const name = (a.company_name||a.name||'').toLowerCase();
    if(q && !name.includes(q)) return false;
    if(plan !== 'all' && (a.plan||'starter').toLowerCase() !== plan) return false;
    if(status === 'active'   && a.active === false) return false;
    if(status === 'inactive' && a.active !== false) return false;
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
    if(sort==='pins_desc'){
      const pA = pins.filter(p=>p.account_id===a.id).length;
      const pB = pins.filter(p=>p.account_id===b.id).length;
      return pB - pA;
    }
    if(sort==='activity'){
      const lastA = Math.max(
        ...pins.filter(p=>p.account_id===a.id).map(p=>new Date(p.created_at).getTime()), 0,
        ...mailerLog.filter(m=>m.account_id===a.id).map(m=>new Date(m.sent_at).getTime()), 0
      );
      const lastB = Math.max(
        ...pins.filter(p=>p.account_id===b.id).map(p=>new Date(p.created_at).getTime()), 0,
        ...mailerLog.filter(m=>m.account_id===b.id).map(m=>new Date(m.sent_at).getTime()), 0
      );
      return lastB - lastA;
    }
    if(sort==='created') return new Date(a.created_at) - new Date(b.created_at);
    if(sort==='mailers_desc'){
      const mA = mailerLog.filter(m=>m.account_id===a.id).length;
      const mB = mailerLog.filter(m=>m.account_id===b.id).length;
      return mB - mA;
    }
    if(sort==='revenue_desc'){
      const rA = (parseFloat(a.mailer_rate)||2.50) * mailerLog.filter(m=>m.account_id===a.id).length;
      const rB = (parseFloat(b.mailer_rate)||2.50) * mailerLog.filter(m=>m.account_id===b.id).length;
      return rB - rA;
    }
    return 0;
  });

  _renderAgencyAccountCards(filtered);
}

function renderAgencyAccounts(){
  filterAgencyAccounts();
}

function _renderAgencyAccountCards(accounts){
  if(!_agencyData) return;
  const {profiles, pins, mailerLog} = _agencyData;
  const el = document.getElementById('agency-accounts-grid');
  if(!el) return;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if(!accounts.length){
    el.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--muted);font-size:12px;">No accounts match your search.</td></tr>';
    return;
  }
  el.innerHTML = accounts.map((a,i)=>{
    const users = profiles.filter(p=>p.account_id===a.id);
    const acctPins = pins.filter(p=>p.account_id===a.id);
    const acctMailers = mailerLog.filter(m=>m.account_id===a.id);
    const mailersThisMonth = acctMailers.filter(m=>m.sent_at>=monthStart).length;
    const mailersAllTime = acctMailers.length;
    const rate = parseFloat(a.mailer_rate)||2.50;
    const revAllTime = (rate * mailersAllTime).toFixed(2);
    const converted = acctPins.filter(p=>p.status==='converted').length;
    const planColor = {starter:'#3B82F6',pro:'#8B5CF6',agency:'#F25C05',enterprise:'#D97706'}[a.plan]||'#6688A8';
    const activeColor = a.active!==false ? '#22C55E' : '#EF4444';
    const activeLabel = a.active!==false ? 'Active' : 'Inactive';
    const paidCredits = a.mailer_credits||0;
    const planFreeMapA = {starter:0,pro:0,agency:0,enterprise:0};
    const freeLimit = planFreeMapA[(a.plan||'starter').toLowerCase()] || 0;
    const freeLeft = Math.max(0, freeLimit - (a.free_mailer_credits_used||0));
    // Last activity
    const allDates = [
      ...acctPins.map(p=>p.created_at),
      ...acctMailers.map(m=>m.sent_at)
    ].filter(Boolean).sort().reverse();
    const lastDate = allDates.length
      ? new Date(allDates[0]).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})
      : 'No activity';
    const rowBg = i%2===0 ? 'var(--card)' : 'var(--card2)';
    const td = 'padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:middle;';
    const tdC = td+'text-align:center;';
    return '<tr style="background:'+rowBg+';transition:background .1s;" onmouseover="this.style.background=\'var(--card2)\'" onmouseout="this.style.background=\''+rowBg+'\'">' +
      '<td style="'+td+'min-width:160px;">' +
        '<div style="font-weight:700;font-size:13px;color:var(--text);">'+(a.company_name||a.name)+'</div>' +
        '<div style="font-size:10px;color:var(--muted);margin-top:2px;">'+users.length+' user'+(users.length!==1?'s':'')+' · '+(a.plan||'starter')+'</div>' +
      '</td>' +
      '<td style="'+tdC+'">' +
        '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:'+planColor+'22;color:'+planColor+';border:1px solid '+planColor+'44;text-transform:uppercase;">'+(a.plan||'starter')+'</span>' +
      '</td>' +
      '<td style="'+tdC+'">' +
        '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:'+activeColor+'22;color:'+activeColor+';border:1px solid '+activeColor+'44;">'+activeLabel+'</span>' +
      '</td>' +
      '<td style="'+tdC+';font-size:13px;font-weight:700;color:var(--text);">'+acctPins.length+'</td>' +
      '<td style="'+tdC+';font-size:13px;font-weight:700;color:#22C55E;">'+converted+'</td>' +
      '<td style="'+tdC+';font-size:13px;font-weight:700;color:var(--text);">'+mailersThisMonth+'</td>' +
      '<td style="'+tdC+';font-size:13px;font-weight:700;color:var(--text);">'+mailersAllTime+'</td>' +
      '<td style="'+tdC+';font-size:13px;font-weight:700;color:#4ade80;">$'+revAllTime+'</td>' +
      '<td style="'+tdC+'">' +
        '<span style="font-size:12px;font-weight:700;color:#4ade80;">'+paidCredits+'</span>' +
        '<span style="font-size:10px;color:var(--muted);"> paid</span>' +
        '<span style="font-size:10px;color:var(--muted);"> | </span>' +
        '<span style="font-size:12px;font-weight:700;color:var(--accent);">'+freeLeft+'</span>' +
        '<span style="font-size:10px;color:var(--muted);">/'+freeLimit+' free</span>' +
      '</td>' +
      '<td style="'+tdC+';font-size:11px;color:var(--muted);">'+lastDate+'</td>' +
      '<td style="'+tdC+';white-space:nowrap;">' +
        '<button onclick="editClientAccount(\''+a.id+'\')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 9px;color:var(--mid);font-size:10px;font-weight:700;cursor:pointer;margin:1px;" title="Edit account">Edit</button>' +
        '<button onclick="openManageTeam(\''+a.id+'\')" style="background:none;border:1px solid #3B82F6;border-radius:6px;padding:4px 9px;color:#3B82F6;font-size:10px;font-weight:700;cursor:pointer;margin:1px;" title="Manage team">Team</button>' +
        '<button onclick="adjustCredits(\''+a.id+'\')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 9px;color:var(--muted);font-size:10px;font-weight:700;cursor:pointer;margin:1px;" title="Adjust credits">Credits</button>' +
        '<button onclick="setFreeLimit(\''+a.id+'\')" style="background:none;border:1px solid #a855f7;border-radius:6px;padding:4px 9px;color:#a855f7;font-size:10px;font-weight:700;cursor:pointer;margin:1px;" title="Set free limit">Limit</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

async function adjustCredits(accountId){
  if(!_agencyData) return;
  const a = _agencyData.accounts.find(x=>x.id===accountId);
  if(!a) return;
  const current = a.mailer_credits||0;
  const input = prompt(`Adjust paid mailer credits for ${a.company_name||a.name}\nCurrent balance: ${current}\n\nEnter new balance:`, current);
  if(input===null) return;
  const newVal = parseInt(input,10);
  if(isNaN(newVal)||newVal<0){ toast('Invalid value','error'); return; }
  try{
    const {error} = await sb.from('accounts').update({mailer_credits:newVal}).eq('id',accountId);
    if(error) throw error;
    a.mailer_credits = newVal;
    toast(`Credits updated to ${newVal} for ${a.company_name||a.name}`,'success');
    await renderAdminPanel();
  }catch(e){
    toast('Error: '+e.message,'error');
  }
}

async function setFreeLimit(accountId){
  if(!_agencyData) return;
  const a = _agencyData.accounts.find(x=>x.id===accountId);
  if(!a) return;
  const planFreeMapSL = {starter:0,pro:0,agency:0,enterprise:0};
  const currentLimit = planFreeMapSL[(a.plan||'starter').toLowerCase()] || 0;
  const freeUsed     = a.free_mailer_credits_used || 0;
  const freeLeft     = Math.max(0, currentLimit - freeUsed);
  const input = prompt(
    `Adjust free mailer credits for ${a.company_name||a.name}\n` +
    `Plan: ${a.plan||'starter'} (${currentLimit}/month)\n` +
    `Current: ${freeLeft} remaining (${freeUsed} used)\n\n` +
    `Enter new free_mailer_credits_used value (to reset, enter 0):`,
    String(freeUsed)
  );
  if(input===null) return;
  const newLimit = parseInt(input,10);
  if(isNaN(newLimit)||newLimit<0){ toast('Invalid value','error'); return; }
  try{
    const {error} = await sb.from('accounts').update({ free_mailer_credits_used: newLimit }).eq('id',accountId);
    if(error) throw error;
    a.free_mailer_credits_used = newLimit;
    const newFreeLeft = Math.max(0, currentLimit - newLimit);
    toast(`✅ ${a.company_name||a.name}: ${newFreeLeft} free credits remaining this month`,'success');
    await renderAdminPanel();
  }catch(e){
    toast('Error: '+e.message,'error');
  }
}

function editClientAccount(accountId){
  if(!_agencyData) return;
  const a = _agencyData.accounts.find(x=>x.id===accountId);
  if(!a){ toast('Account not found','error'); return; }
  // Store ID on modal for save
  document.getElementById('m-edit-client').dataset.accountId = accountId;
  // Populate fields
  document.getElementById('ec-name').value  = a.company_name||a.name||'';
  document.getElementById('ec-phone').value = a.company_phone||'';
  // Split stored address ("Street, City, State, ZIP") into parts
  (function(){
    const raw = a.company_addr||'';
    const parts = raw.split(',').map(s=>s.trim());
    document.getElementById('ec-addr-street').value = parts[0]||'';
    document.getElementById('ec-addr-city').value   = parts[1]||'';
    document.getElementById('ec-addr-state').value  = parts[2]||'';
    document.getElementById('ec-addr-zip').value    = parts[3]||'';
  })();
  document.getElementById('ec-plan').value  = a.plan||'starter';

  document.getElementById('ec-notes').value = a.notes||'';
  document.getElementById('ec-ghl-key').value  = a.ghl_api_key||'';
  document.getElementById('ec-ghl-loc').value  = a.ghl_location_id||'';
  document.getElementById('ec-ghl-pipe').value = a.ghl_pipeline_id||'';
  document.getElementById('ec-active').checked = a.active!==false;
  document.getElementById('ec-enable-postcard').checked = a.enable_postcard!==false;
  document.getElementById('ec-enable-letter').checked   = a.enable_letter!==false;
  document.getElementById('ec-result').textContent = '';
  const btn = document.getElementById('btn-save-client');
  if(btn){ btn.disabled=false; btn.textContent='Save Changes'; }
  openM('m-edit-client');
}

async function saveClientAccount(){
  const accountId = document.getElementById('m-edit-client').dataset.accountId;
  if(!accountId){ toast('No account selected','error'); return; }
  const name   = document.getElementById('ec-name').value.trim();
  const phone  = document.getElementById('ec-phone').value.trim();
  // Reassemble address from split fields
  const addrStreet = document.getElementById('ec-addr-street').value.trim();
  const addrCity   = document.getElementById('ec-addr-city').value.trim();
  const addrState  = document.getElementById('ec-addr-state').value.trim();
  const addrZip    = document.getElementById('ec-addr-zip').value.trim();
  const addr = [addrStreet, addrCity, addrState, addrZip].filter(Boolean).join(', ');
  const plan   = document.getElementById('ec-plan').value;

  const notes  = document.getElementById('ec-notes').value.trim();
  const ghlKey  = document.getElementById('ec-ghl-key').value.trim();
  const ghlLoc  = document.getElementById('ec-ghl-loc').value.trim();
  const ghlPipe = document.getElementById('ec-ghl-pipe').value.trim();
  const active          = document.getElementById('ec-active').checked;
  const enablePostcard  = document.getElementById('ec-enable-postcard').checked;
  const enableLetter    = document.getElementById('ec-enable-letter').checked;
  if(!name){ toast('Company name is required','error'); return; }
  const resultEl = document.getElementById('ec-result');
  const btn = document.getElementById('btn-save-client');
  resultEl.textContent = 'Saving…'; resultEl.style.color='var(--muted)';
  if(btn){ btn.disabled=true; btn.textContent='Saving…'; }
  try {
    const updated = await adminAPI('patch-account', {
      accountId,
      updates: { name, company_name:name, company_phone:phone||null, company_addr:addr||null, plan, notes:notes||null, active, enable_postcard:enablePostcard, enable_letter:enableLetter, ghl_api_key:ghlKey||null, ghl_location_id:ghlLoc||null, ghl_pipeline_id:ghlPipe||null }
    });
    // Update local cache
    const idx = _agencyData.accounts.findIndex(x=>x.id===accountId);
    if(idx>=0) _agencyData.accounts[idx] = {..._agencyData.accounts[idx], name, company_name:name, company_phone:phone, company_addr:addr, plan, notes, active, enable_postcard:enablePostcard, enable_letter:enableLetter, ghl_api_key:ghlKey, ghl_location_id:ghlLoc, ghl_pipeline_id:ghlPipe};
    resultEl.innerHTML = '✅ Saved!'; resultEl.style.color='var(--success)';
    toast('✅ '+name+' updated','success');
    renderAgencyAccounts();
    renderAgencyKPIs();
    setTimeout(()=>closeM('m-edit-client'), 900);
  } catch(e){
    resultEl.innerHTML = '❌ '+escHtml(e.message); resultEl.style.color='var(--danger)';
    toast('Error: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent='Save Changes'; }
  }
}


function agMailerLogPeriodChange(){
  const sel = document.getElementById('ag-log-period');
  const customSpan = document.getElementById('ag-log-custom-range');
  if(!sel||!customSpan) return;
  if(sel.value==='custom'){
    customSpan.style.display='flex';
    // Default to current month
    const now = new Date();
    const fromEl = document.getElementById('ag-log-date-from');
    const toEl = document.getElementById('ag-log-date-to');
    if(fromEl && !fromEl.value) fromEl.value = new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
    if(toEl && !toEl.value) toEl.value = now.toISOString().slice(0,10);
  } else {
    customSpan.style.display='none';
  }
  renderAgencyMailerLog();
}
function renderAgencyMailerLog(){
  if(!_agencyData) return;
  const {accounts, mailerLog} = _agencyData;
  const el = document.getElementById('agency-mailer-log');
  if(!el) return;
  const filterAcct = document.getElementById('ag-log-filter')?.value||'all';
  const periodVal = document.getElementById('ag-log-period')?.value||'30';
  let cutoffFrom, cutoffTo;
  if(periodVal==='custom'){
    const fromVal = document.getElementById('ag-log-date-from')?.value;
    const toVal = document.getElementById('ag-log-date-to')?.value;
    cutoffFrom = fromVal ? fromVal+'T00:00:00Z' : '2000-01-01T00:00:00Z';
    cutoffTo = toVal ? toVal+'T23:59:59Z' : new Date().toISOString();
  } else {
    const days = parseInt(periodVal);
    cutoffFrom = days > 0 ? new Date(Date.now()-days*24*60*60*1000).toISOString() : '2000-01-01T00:00:00Z';
    cutoffTo = new Date().toISOString();
  }
  let rows = mailerLog.filter(m=>m.sent_at>=cutoffFrom && m.sent_at<=cutoffTo);
  if(filterAcct!=='all') rows = rows.filter(m=>m.account_id===filterAcct);;

  if(!rows.length){
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;">No mailers found for this filter.</div>';
    return;
  }

  const acctMap = {};
  accounts.forEach(a=>{ acctMap[a.id]=a.company_name||a.name; });

  el.innerHTML = '<table class="ag-log-table">' +
    '<thead><tr>' +
      '<th>Date</th><th>Client</th><th>Address</th><th>Owner</th><th>Estimate</th><th>Mail ID</th>' +
    '</tr></thead>' +
    '<tbody>' +
    rows.map(m=>{
      const d = new Date(m.sent_at);
      const dateStr = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const timeStr = d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      const clientName = acctMap[m.account_id]||'Unknown';
      const est = m.estimate_total ? '$'+parseFloat(m.estimate_total).toLocaleString() : '—';
      const lobId = m.lob_id ? '<span style="font-family:var(--font-m);font-size:9px;color:var(--muted);">'+escHtml(m.lob_id.slice(0,16))+'…</span>' : '—';
      return '<tr>' +
        '<td><div>'+dateStr+'</div><div style="font-size:9px;color:var(--muted);">'+timeStr+'</div></td>' +
        '<td style="font-weight:600;color:var(--text);">'+escHtml(clientName)+'</td>' +
        '<td>'+escHtml(m.address||'—')+'</td>' +
        '<td>'+escHtml(m.owner_name||'—')+'</td>' +
        '<td style="color:var(--success);font-weight:600;">'+est+'</td>' +
        '<td>'+lobId+'</td>' +
        '</tr>';
    }).join('') +
    '</tbody></table>';
}

function renderDash(){
  const mailed=S.queue.filter(i=>i.status==='sent').length;
  const conv=S.pins.filter(p=>p.status==='converted'||p.status==='signed').length;
  // Use server-side count when available (may be larger than loaded S.pins)
  const displayPinCount = totalPinCount > S.pins.length ? totalPinCount : S.pins.length;
  document.getElementById('s-pins').textContent=displayPinCount;
  document.getElementById('s-ests').textContent=S.estimates.length;
  document.getElementById('s-mailed').textContent=mailed;
  document.getElementById('s-conv').textContent=mailed?Math.round(conv/mailed*100)+'%':'—';
  renderActChart();renderTeam();renderActFeed();renderLeaderboard();
  // ── Trade breakdown ──
  const tradeCounts={roofing:0,solar:0,siding:0,fence:0,gutters:0,other:0};
  (S.estimates||[]).forEach(e=>{
    const structs=(e.structures||[]);
    if(structs.length===0){tradeCounts.other++;return;}
    structs.forEach(s=>{
      const t=(s.type||s.trade||'').toLowerCase();
      if(t.includes('solar'))tradeCounts.solar++;
      else if(t.includes('sid')||t.includes('vinyl'))tradeCounts.siding++;
      else if(t.includes('fence'))tradeCounts.fence++;
      else if(t.includes('gutter'))tradeCounts.gutters++;
      else if(t.includes('roof')||t.includes('shingle')||t.includes('metal')||t===''||!t)tradeCounts.roofing++;
      else tradeCounts.other++;
    });
  });
  ['roofing','solar','siding','fence','gutters','other'].forEach(k=>{
    const el=document.getElementById('td-'+k);
    if(el) el.textContent=tradeCounts[k];
  });
  // ── Storm banner ──
  const banner=document.getElementById('dash-storm-banner');
  if(banner && window._stormEvents && window._stormEvents.length){
    const ev=window._stormEvents[0];
    const title=document.getElementById('dash-storm-title');
    const sub=document.getElementById('dash-storm-sub');
    if(title) title.textContent='⛈️ Storm Event: '+(ev.event_type||'Hail')+(ev.location?' — '+ev.location:'');
    if(sub) sub.textContent=(ev.description||'Hail activity detected in your canvass area. Launch a targeted campaign.');
    banner.style.display='flex';
  } else if(banner){
    banner.style.display='none';
  }
  // Sync sidebar badge
  if(typeof updateSidebarBadge==='function') updateSidebarBadge();
}
function renderLeaderboard(){
  const el=document.getElementById('leaderboard-list');
  if(!el) return;
  const period = (document.getElementById('lb-period')||{}).value||'all';
  const cutoff = period==='all' ? null : new Date(Date.now()-parseInt(period)*86400000);

  // Build a map from pin address -> rep name for joining estimates & queue
  const addrToRep = {};
  const pinIdToRep = {};
  S.pins.forEach(p=>{
    const rep = (p.rep||'Unknown').trim()||'Unknown';
    if(p.address) addrToRep[p.address.trim()] = rep;
    if(p.id) pinIdToRep[p.id] = rep;
  });

  // Aggregate pins by rep
  const repMap={};
  function getOrCreate(rep){
    if(!repMap[rep]) repMap[rep]={name:rep,pins:0,estimates:0,mailers:0,signed:0,converted:0};
    return repMap[rep];
  }

  S.pins.forEach(p=>{
    const at = p.at ? new Date(p.at) : null;
    if(cutoff && at && at < cutoff) return;
    const rep=(p.rep||'Unknown').trim()||'Unknown';
    const r=getOrCreate(rep);
    r.pins++;
    if(p.status==='signed')   r.signed++;
    if(p.status==='converted') r.converted++;
  });

  // Aggregate estimates by rep (join via pinId -> rep)
  (S.estimates||[]).forEach(e=>{
    const at = e.savedAt ? new Date(e.savedAt) : null;
    if(cutoff && at && at < cutoff) return;
    const rep = pinIdToRep[e.pinId] || addrToRep[(e.addr||'').trim()] || null;
    if(!rep) return;
    getOrCreate(rep).estimates++;
  });

  // Aggregate mailers sent by rep (join via addr -> rep)
  (S.queue||[]).filter(q=>q.status==='sent').forEach(q=>{
    const at = q.mailedAt ? new Date(q.mailedAt) : null;
    if(cutoff && at && at < cutoff) return;
    const rep = addrToRep[(q.addr||'').trim()] || null;
    if(!rep) return;
    getOrCreate(rep).mailers++;
  });

  const reps=Object.values(repMap).sort((a,b)=>b.pins-a.pins);
  if(!reps.length){el.innerHTML='<div style="text-align:center;padding:18px;color:var(--muted);font-size:11px;">No pins yet.</div>';return;}

  // Header row
  const hdr = '<div style="display:grid;grid-template-columns:28px 1fr repeat(4,52px);gap:6px;padding:0 0 6px 0;border-bottom:2px solid var(--border);margin-bottom:4px;">'+
    '<div></div>'+
    '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;color:var(--muted);">REP</div>'+
    '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;color:var(--accent);text-align:center;">PINS</div>'+
    '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;color:#A855F7;text-align:center;">ESTS</div>'+
    '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;color:#3B82F6;text-align:center;">MAILED</div>'+
    '<div style="font-size:10px;font-weight:700;letter-spacing:.5px;color:#22C55E;text-align:center;">CONV%</div>'+
  '</div>';

  const rows = reps.map((r,i)=>{
    const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':
      '<span style="font-size:11px;color:var(--muted);font-weight:700;">'+('0'+(i+1)).slice(-2)+'</span>';
    const convRate = r.pins ? Math.round((r.signed+r.converted)/r.pins*100) : 0;
    const convColor = convRate>=20?'#22C55E':convRate>=10?'#F59E0B':'var(--muted)';
    return '<div style="display:grid;grid-template-columns:28px 1fr repeat(4,52px);gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">'+
      '<div style="font-size:17px;text-align:center;">'+medal+'</div>'+
      '<div style="font-weight:700;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(r.name)+'</div>'+
      '<div style="text-align:center;font-family:var(--font-h);font-size:15px;font-weight:700;color:var(--accent);">'+r.pins+'</div>'+
      '<div style="text-align:center;font-family:var(--font-h);font-size:15px;font-weight:700;color:#A855F7;">'+r.estimates+'</div>'+
      '<div style="text-align:center;font-family:var(--font-h);font-size:15px;font-weight:700;color:#3B82F6;">'+r.mailers+'</div>'+
      '<div style="text-align:center;font-family:var(--font-h);font-size:15px;font-weight:700;color:'+convColor+';">'+convRate+'%</div>'+
    '</div>';
  }).join('');

  el.innerHTML = hdr + rows;
}

function renderActChart(){
  const ctx=document.getElementById('act-chart').getContext('2d');
  const days=[],pins=[],mails=[];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=d.toDateString();
    days.push(d.toLocaleDateString('en-US',{weekday:'short',month:'numeric',day:'numeric'}));
    pins.push(S.pins.filter(p=>new Date(p.at).toDateString()===ds).length);
    mails.push(S.queue.filter(q=>q.mailedAt&&new Date(q.mailedAt).toDateString()===ds).length);
  }
  if(actChart)actChart.destroy();
  actChart=new Chart(ctx,{type:'bar',data:{labels:days,datasets:[
    {label:'Homes Pinned',data:pins,backgroundColor:'rgba(242,92,5,.7)',borderRadius:4},
    {label:'Bids Mailed',data:mails,backgroundColor:'rgba(59,130,246,.7)',borderRadius:4}
  ]},options:{responsive:true,plugins:{legend:{labels:{color:'#7A96B0',font:{size:11}}}},
    scales:{x:{ticks:{color:'#3D5269',font:{size:10}},grid:{color:'#1C2840'}},
            y:{ticks:{color:'#3D5269',stepSize:1,font:{size:10}},grid:{color:'#1C2840'},beginAtZero:true}}}});
}


