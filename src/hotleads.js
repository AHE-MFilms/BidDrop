// src/hotleads.js
// Hot Leads dashboard — tracks estimate page views, sends leads to GHL.
// Depends on: sb, S.cfg, currentAccount, adminAPI(), toast(), escHtml(), timeAgo()
// Extracted from index.html — Tier 2 modularization

async function loadHotLeads(){
  const container = document.getElementById('hl-list');
  const empty = document.getElementById('hl-empty');
  if(!container) return;
  if(!currentAccount){ if(empty) empty.style.display='block'; return; }
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted);font-size:13px;">Loading hot leads...</div>';
  if(empty) empty.style.display='none';
  try{
    const sess = (await sb.auth.getSession()).data.session;
    if(!sess) return;
    // Fetch estimates with QR scan data, sorted by scan count desc then last scan desc
    // Try full query first; fall back to basic query if extended columns don't exist yet (pre-migration)
    let rows = null, error = null;
    const fullQ = await sb.from('estimates')
      .select('id,addr,owner,email,rep,total,qr_scan_count,page_views,page_last_viewed_at,created_at,mat')
      .eq('account_id', currentAccount.id)
      .gt('page_views', 0)
      .order('page_last_viewed_at', {ascending:false})
      .limit(100);
    if(fullQ.error && (fullQ.error.code==='42703'||fullQ.error.message?.includes('column')||fullQ.error.message?.includes('does not exist')||fullQ.error.status===400||fullQ.error.code==='PGRST204')){
      // Columns not yet migrated — show upgrade prompt
      container.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px;">Hot Leads tracking requires a database migration.<br><br><button onclick="runMigration()" style="background:var(--accent);border:none;border-radius:8px;padding:10px 20px;color:#fff;font-weight:700;cursor:pointer;">Run Migration Now</button></div>';
      return;
    }
    rows = fullQ.data; error = fullQ.error;
    if(error) throw error;
    if(!rows || !rows.length){
      container.innerHTML='';
      if(empty) empty.style.display='block';
      return;
    }
    // Sort: QR scans first (hottest), then page views
    rows.sort((a,b)=>{
      const aScore = (a.qr_scan_count||0)*3 + (a.page_views||0);
      const bScore = (b.qr_scan_count||0)*3 + (b.page_views||0);
      return bScore - aScore;
    });
    container.innerHTML = rows.map(r=>{
      const scans = r.qr_scan_count||0;
      const views = r.page_views||0;
      const lastSeen = r.page_last_viewed_at ? timeAgo(r.page_last_viewed_at) : 'never';
      const heatScore = scans*3 + views;
      const heatColor = heatScore>=9?'#EF4444':heatScore>=4?'#F59E0B':'#3B82F6';
      const heatLabel = heatScore>=9?'🔥 Very Hot':heatScore>=4?'🌡 Warm':'👀 Viewed';
      const total = r.total ? '$'+Number(r.total).toLocaleString() : '—';
      // Find pin for quick actions
      const pin = S.pins.find(p=>p.address&&r.addr&&p.address.trim()===r.addr.trim());
      const pinId = pin ? pin.id : null;
      const hasGhl = !!(S.cfg&&S.cfg.ghlLocationId);
      const hasEmail = !!(r.email);
      return '<div class="hl-row" onclick="openHotLeadDetail(\''+r.id+'\')" style="cursor:pointer;">'+
        '<div class="hl-heat" style="background:'+heatColor+'22;border:1px solid '+heatColor+'44;border-radius:8px;padding:6px 10px;text-align:center;min-width:90px;">'+
          '<div style="font-size:11px;font-weight:700;color:'+heatColor+';">'+heatLabel+'</div>'+
          (scans?'<div style="font-size:10px;color:var(--muted);">'+scans+' QR scan'+(scans!==1?'s':'')+'</div>':'')+
          '<div style="font-size:10px;color:var(--muted);">'+views+' view'+(views!==1?'s':'')+'</div>'+
        '</div>'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-weight:700;font-size:14px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(r.owner||'Homeowner')+'</div>'+
          '<div style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(r.addr||'')+'</div>'+
          '<div style="font-size:11px;color:var(--muted);margin-top:2px;">Last seen: '+lastSeen+' · Rep: '+escHtml(r.rep||'—')+'</div>'+
          (hasEmail?'<div style="font-size:11px;color:#22C55E;margin-top:1px;">✉ '+escHtml(r.email)+'</div>':'')+'</div>'+
        '<div style="text-align:right;flex-shrink:0;">'+
          '<div style="font-size:16px;font-weight:800;color:var(--accent);">'+total+'</div>'+
          '<div style="font-size:11px;color:var(--muted);">'+escHtml(r.mat||'')+'</div>'+
          '<div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end;flex-wrap:wrap;">'+
            '<button onclick="event.stopPropagation();window.open(\'/e/'+r.id+'\',\'_blank\')" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:10px;cursor:pointer;font-weight:700;">View Page</button>'+
            (pinId?'<button onclick="event.stopPropagation();goTab(\'map\');setTimeout(()=>openPinPanel(\''+pinId+'\'),400)" style="background:var(--accent);border:none;border-radius:6px;padding:4px 8px;color:#fff;font-size:10px;cursor:pointer;font-weight:700;">Open Pin</button>':'')+
            (hasGhl?'<button onclick="event.stopPropagation();hlSendToGHL(this)" data-est-id="'+r.id+'" data-owner="'+escHtml(r.owner||'')+'" data-addr="'+escHtml(r.addr||'')+'" data-email="'+escHtml(r.email||'')+'" data-total="'+(r.total||0)+'" data-rep="'+escHtml(r.rep||'')+'" style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:4px 8px;color:#7dd3fc;font-size:10px;cursor:pointer;font-weight:700;">Send to GHL →</button>':'')+'</div>'+
        '</div>'+
      '</div>';
    }).join('');
    // Update stat cards
    const totalScans = rows.reduce((s,r)=>s+(r.qr_scan_count||0),0);
    const todayScans = rows.filter(r=>r.page_last_viewed_at&&new Date(r.page_last_viewed_at)>new Date(Date.now()-86400000)).reduce((s,r)=>s+(r.qr_scan_count||0),0);
    const multiScans = rows.filter(r=>(r.qr_scan_count||0)>=2).length;
    // Engagement rate: % of all estimates that have been scanned or viewed
    let totalEstimates = 0;
    try {
      const estCountR = await sb.from('estimates').select('id', {count:'exact',head:true}).eq('account_id', currentAccount.id);
      if(!estCountR.error && typeof estCountR.count === 'number') totalEstimates = estCountR.count;
    } catch(_) {}
    const engagedCount = rows.length; // rows already filtered to page_views > 0
    const scanRate = totalEstimates>0 ? Math.round(engagedCount/totalEstimates*100) : null;
    function setStat2(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
    setStat2('hl-total-scans',totalScans);
    setStat2('hl-today-scans',todayScans);
    setStat2('hl-scan-rate', scanRate !== null ? engagedCount+' / '+totalEstimates+' ('+scanRate+'%)' : '—');
    setStat2('hl-multi-scans',multiScans);
    // Update header count
    const countEl = document.getElementById('hl-count');
    if(countEl) countEl.textContent = rows.length+' hot lead'+(rows.length!==1?'s':'');
  }catch(e){
    container.innerHTML='<div style="text-align:center;padding:30px;color:var(--danger);font-size:13px;">Error loading hot leads: '+escHtml(e.message)+'</div>';
  }
}
function openHotLeadDetail(estimateId){
  window.open('/e/'+estimateId,'_blank');
}

// ── Send Hot Lead to GHL ──────────────────────────────────────────────────────
async function hlSendToGHL(btn){
  const estId = btn.dataset.estId;
  const owner = btn.dataset.owner || 'Homeowner';
  const addr  = btn.dataset.addr  || '';
  let   email = btn.dataset.email || '';
  const total = parseFloat(btn.dataset.total) || 0;
  const rep   = btn.dataset.rep   || '';

  // If no email captured yet, show inline prompt
  if(!email){
    const row = btn.closest('.hl-row');
    // Prevent double-prompt
    if(row && row.querySelector('.hl-email-prompt')) return;
    const prompt = document.createElement('div');
    prompt.className='hl-email-prompt';
    prompt.style.cssText='display:flex;gap:6px;align-items:center;padding:8px 0 2px;flex-wrap:wrap;';
    prompt.innerHTML=
      '<span style="font-size:11px;color:var(--muted);">Enter email to send to GHL:</span>'+
      '<input type="email" aria-label="Homeowner email" placeholder="homeowner@email.com" style="flex:1;min-width:140px;background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:5px 8px;color:var(--text);font-size:11px;">'+
      '<button style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:5px 10px;color:#7dd3fc;font-size:11px;cursor:pointer;font-weight:700;">Send</button>'+
      '<button style="background:transparent;border:none;color:var(--muted);font-size:11px;cursor:pointer;">Cancel</button>';
    if(row){
      const info = row.querySelector('div[style*="flex:1"]');
      if(info) info.appendChild(prompt);
    }
    const [, emailInput, sendBtn, cancelBtn] = prompt.children;
    cancelBtn.onclick = ()=>prompt.remove();
    sendBtn.onclick = async ()=>{
      const typed = emailInput.value.trim();
      if(!typed || !typed.includes('@')){ emailInput.style.borderColor='#EF4444'; return; }
      // Persist email to estimate
      if(sb && estId){
        sb.from('estimates').update({email: typed}).eq('id', estId).then(({error})=>{
          if(error) console.warn('GHL email save:', error.message);
        });
      }
      btn.dataset.email = typed;
      prompt.remove();
      await _doSendToGHL(btn, estId, owner, addr, typed, total, rep);
    };
    emailInput.focus();
    return;
  }

  await _doSendToGHL(btn, estId, owner, addr, email, total, rep);
}

async function _doSendToGHL(btn, estId, owner, addr, email, total, rep){
  if(!S.cfg || !S.cfg.ghlLocationId){
    toast('GHL not configured. Add your GHL Location ID in Settings.','error');
    return;
  }
  const origText = btn.textContent;
  btn.textContent = 'Sending…';
  btn.disabled = true;
  try{
    // Upsert contact in GHL
    // Look up existing GHL contact ID via pin (match by address)
    const _hlPin = (S.pins||[]).find(p=>p.address&&addr&&p.address.trim()===addr.trim());
    const _hlGhlId = _hlPin ? (_hlPin.ghlContactId||null) : null;
    const _hlPinId = _hlPin ? _hlPin.id : null;
    const contactId = await ghlUpsertContact(owner, addr, email, _hlGhlId, _hlPinId);
    if(!contactId) throw new Error('Could not create GHL contact');
    // Always save returned contactId back to pin (even if it changed via fallback create)
    if(_hlPin && contactId){
      _hlPin.ghlContactId = contactId;
      if(sb) sb.from('pins').update({ghl_contact_id: contactId}).eq('id', _hlPin.id).then(()=>{});
    }
    // Create or update opportunity
    if(S.cfg.ghlPipelineId){
      if(_hlPin && _hlPin.ghlOpportunityId){
        ghlRequest('/opportunities/'+_hlPin.ghlOpportunityId, 'PUT', { monetaryValue: total||0 }).catch(()=>{});
      } else {
        const oppId = await ghlCreateOpportunity(contactId, owner, addr, total);
        if(oppId && _hlPin){
          _hlPin.ghlOpportunityId = oppId;
          if(sb) sb.from('pins').update({ghl_opportunity_id: oppId}).eq('id', _hlPin.id).then(()=>{});
        }
      }
    }
    // Add a note with estimate page URL
    const estUrl = window.location.origin+'/e/'+estId;
    // Push estimate URL to GHL custom field (fire-and-forget)
    ghlEnsureEstimateUrlField().then(fieldId=>{
      if(!fieldId) return;
      ghlRequest('/contacts/'+contactId, 'PUT', {
        customFields: [{ id: fieldId, value: estUrl }]
      }).then(()=>console.log('[BidDrop] GHL: estimate URL set on contact:', estUrl))
        .catch(e=>console.warn('[BidDrop] GHL: estimate URL field update failed:', e.message));
    });
    // Also add a note with the estimate URL for easy reference
    try{
      await ghlRequest('/contacts/'+contactId+'/notes', 'POST', {
        body: 'BidDrop Hot Lead\nAddress: '+addr+'\nEstimate Total: $'+Number(total).toLocaleString()+'\nRep: '+(rep||'—')+'\nEstimate Page: '+estUrl
      });
    }catch(e){ /* notes are non-blocking */ }
    btn.textContent = '✓ Sent to GHL';
    btn.style.background='#052e16';
    btn.style.color='#4ade80';
    btn.style.borderColor='#166534';
    toast('✓ '+owner+' sent to GHL','success');
  }catch(e){
    btn.textContent = origText;
    btn.disabled = false;
    toast('GHL error: '+e.message,'error');
    console.error('hlSendToGHL error:', e);
  }
}

