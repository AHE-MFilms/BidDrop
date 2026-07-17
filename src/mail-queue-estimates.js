// src/mail-queue.js
// Estimates tab, mail queue render, bulk ops (delete, restore, CSV export, GHL send),
// estimate revision history, sort/filter helpers, canvas postcard preview.
// Depends on: sb, S, currentAccount, adminAPI(), toast(), calcP() (estimates-calc.js),
//             sendLob() (print.js), escHtml() (ui.js)
// Extracted from index.html — Tier 4 modularization

// ── Campaign send numbering ─────────────────────────────────────────────────
// Returns the next send number for a given address (1-indexed).
// Unlock free postcard is always #1. Each subsequent send increments.
function _nextSendNum(addr){
  var norm = (addr||'').trim().toLowerCase();
  var existing = (S.queue||[]).filter(function(q){
    return (q.addr||'').trim().toLowerCase() === norm;
  });
  return existing.length + 1;
}
// Returns a human-readable campaign label for a send number
function _sendLabel(num, source){
  if(num === 1 || source === 'unlock') return 'Free Postcard';
  return 'Campaign ' + num;
}

async function addToQueue(){
  const addr=document.getElementById('e-addr').value.trim();
  if(!addr){toast('Enter a property address','error');return;}
  const grand=calcP();
  if(!grand){toast('Enter roof area to calculate price','error');return;}
  // CREDIT GATE
  if(typeof requirePinUnlocked==='function' && currentEstPinId){
    const _ok = await requirePinUnlocked(currentEstPinId);
    if(!_ok) return;
    if(typeof _estRefreshUnlockUI==='function') _estRefreshUnlockUI();
  }

  // Get primary structure info for queue row display
  const firstS=structures[0];
  const matLabel=firstS?MATLBL[firstS.mat]||firstS.mat:'—';
  const pitchLabel=firstS?PITCHLBL[firstS.pitch]||firstS.pitch:'—';
  const totalSqft=structures.reduce((s,x)=>s+(parseFloat(x.sqft)||0),0);

  const editId=window._editingQueueId;
  if(editId){
    const existing=S.queue.find(x=>x.id===editId);
    if(existing&&existing.status==='pending'){
      existing.owner=document.getElementById('e-owner').value.trim()||'Homeowner';
      existing.addr=addr;existing.sqft=totalSqft;
      existing.pitch=pitchLabel;existing.mat=matLabel;
      existing.total=grand;existing.updatedAt=new Date().toISOString();
      window._editingQueueId=null;
      addAct('Estimate updated for <strong>'+escHtml(addr)+'</strong> — <strong>$'+grand.toLocaleString()+'</strong>','mailed');
      save();renderQueue();toast('✅ Estimate updated!','success');
      document.getElementById('add-queue-btn').textContent='📬 Add to Mail Queue';
      return;
    }
  }
  var _sn = _nextSendNum(addr);
  const item={
    id:'q'+Date.now(),
    owner:document.getElementById('e-owner').value.trim()||'Homeowner',
    addr, sqft:totalSqft, pitch:pitchLabel, mat:matLabel,
    structures:JSON.parse(JSON.stringify(structures)),
    total:grand, status:'pending',
    send_num: _sn,
    campaign_label: _sendLabel(_sn, null),
    // Snapshot photos at queue time so sendLob has them even if estimator is cleared
    photo_url: (window._homePhotoData && window._homePhotoData.startsWith('http')) ? window._homePhotoData : null,
    photo_data: (window._homePhotoData && !window._homePhotoData.startsWith('http')) ? window._homePhotoData : null,
    damage_photos: (window._damagePhotos && window._damagePhotos.length) ? [...window._damagePhotos] : null,
    all_photos: window._allPhotos ? JSON.parse(JSON.stringify(window._allPhotos)) : null,
    at:new Date().toISOString(), mailedAt:null, lobId:null
  };
  S.queue.unshift(item);
  addAct('Estimate for <strong>'+escHtml(addr)+'</strong> queued','mailed');
  sbSaveQueueItem(item).catch(e=>console.error('Queue:',e));
  sbAddActivity('Estimate queued for <strong>'+escHtml(addr)+'</strong> — $'+grand.toLocaleString(),'mailed');
  // Auto-tag GHL contact with biddrop-postcard and advance to Stage 2 (fire-and-forget)
  if(S.cfg.ghlLocationId){
    const qPin = S.pins.find(p=>p.address&&p.address.trim()===addr.trim());
    if(qPin && qPin.ghlContactId){
      ghlAddContactTag(qPin.ghlContactId, 'biddrop-postcard').catch(e=>console.warn('GHL tag:', e));
      if(qPin.ghlOpportunityId){
        ghlUpdateOpportunityStage(qPin.ghlOpportunityId, '2d06ced7-0bcf-432a-b925-701daada9ef4', null)
          .catch(e=>console.warn('GHL stage:', e));
      }
    }
  }
  save();toast('📬 Added to mail queue!','success');renderQueue();
  // Update approval badge
  if(typeof _updateApprovalBadge==='function') _updateApprovalBadge(true);
}
function _updateApprovalBadge(sendEmail){
  const count = (window.S?.queue||[]).filter(q=>q.status==='needs_approval').length;
  const badge = document.getElementById('mailqueue-approval-badge');
  if(badge){
    badge.textContent = count > 0 ? String(count) : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  // Send email notification to admin when new needs_approval items arrive
  if(sendEmail && count > 0 && currentAccount){
    // Debounce: only send once per 5 minutes per session
    const now = Date.now();
    const lastSent = window._lastApprovalEmailSent || 0;
    if(now - lastSent > 5 * 60 * 1000){
      window._lastApprovalEmailSent = now;
      adminAPI('notify-approval', { count, accountId: currentAccount.id })
        .catch(e => console.warn('[approval-notify]', e));
    }
  }
}

// ── Estimates view state ──────────────────────────────────────────────────
let _estView = 'active';
let _estSort = {col:'savedAt', dir:'desc'};
let _qSort   = {col:'at',      dir:'desc'}; // 'active' | 'trash'

function switchEstView(view){
  _estView = view;
  const btnA = document.getElementById('est-tab-active');
  const btnT = document.getElementById('est-tab-trash');
  const delBtn = document.getElementById('est-bulk-delete-btn');
  const restBtn = document.getElementById('est-bulk-restore-btn');
  if(btnA){ btnA.style.background = view==='active' ? 'var(--accent)' : 'var(--card2)'; btnA.style.color = view==='active' ? '#fff' : 'var(--muted)'; btnA.style.border = view==='active' ? 'none' : '1px solid var(--border)'; }
  if(btnT){ btnT.style.background = view==='trash' ? '#EF4444' : 'var(--card2)'; btnT.style.color = view==='trash' ? '#fff' : 'var(--muted)'; btnT.style.border = view==='trash' ? 'none' : '1px solid var(--border)'; }
  if(delBtn) delBtn.style.display = view==='active' ? '' : 'none';
  if(restBtn) restBtn.style.display = view==='trash' ? '' : 'none';
  clearEstimateSelection();
  renderEstimatesTab();
}


// ── Column Sort Helpers ──────────────────────────────────────────────────────
function _sortList(arr, col, dir){
  return arr.slice().sort(function(a,b){
    let av = a[col], bv = b[col];
    // Numeric columns
    if(col==='total'){ av=parseFloat(av)||0; bv=parseFloat(bv)||0; }
    // Date columns
    else if(col==='savedAt'||col==='at'||col==='mailedAt'){
      av = av ? new Date(av).getTime() : 0;
      bv = bv ? new Date(bv).getTime() : 0;
    }
    // String columns
    else { av=(av||'').toString().toLowerCase(); bv=(bv||'').toString().toLowerCase(); }
    if(av < bv) return dir==='asc' ? -1 : 1;
    if(av > bv) return dir==='asc' ? 1 : -1;
    return 0;
  });
}
function setEstSort(col){
  if(_estSort.col===col){ _estSort.dir = _estSort.dir==='asc'?'desc':'asc'; }
  else { _estSort.col=col; _estSort.dir='asc'; }
  renderEstimatesTab();
}
function setQSort(col){
  if(_qSort.col===col){ _qSort.dir = _qSort.dir==='asc'?'desc':'asc'; }
  else { _qSort.col=col; _qSort.dir='asc'; }
  renderQueue();
}
function _updateEstSortArrows(){
  ['addr','owner','rep','total','savedAt'].forEach(function(c){
    const el=document.getElementById('est-sort-'+c);
    if(!el) return;
    if(_estSort.col===c){ el.textContent=_estSort.dir==='asc'?' ▲':' ▼'; el.style.color='var(--accent)'; }
    else { el.textContent=''; }
  });
}
function _updateQSortArrows(){
  ['owner','addr','total','mat','at','status'].forEach(function(c){
    const el=document.getElementById('q-sort-'+c);
    if(!el) return;
    if(_qSort.col===c){ el.textContent=_qSort.dir==='asc'?' ▲':' ▼'; el.style.color='var(--accent)'; }
    else { el.textContent=''; }
  });
}
// ────────────────────────────────────────────────────────────────────────────
// Helper: trigger unlock modal from the estimates table row
function requirePinUnlockedForEst(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  const pin = est.pinId ? (S.pins||[]).find(p=>p.id===est.pinId) : (S.pins||[]).find(p=>p.address===est.addr);
  if(!pin){ toast('No pin linked to this estimate — drop a pin first','warn'); return; }
  if(pin.unlockedAt){ renderEstimatesTab(); return; } // already unlocked, just refresh
  requirePinUnlocked(pin.id).then(ok=>{ if(ok) renderEstimatesTab(); });
}
function renderEstimatesTab(){
  const allEsts = S.estimates || [];
  // Populate rep filter dropdown
  const repSel = document.getElementById('est-rep-filter');
  if(repSel){
    const curRep = repSel.value;
    const reps = [...new Set(allEsts.map(e=>e.rep||'').filter(Boolean))].sort();
    repSel.innerHTML = '<option value="">All Reps</option>' + reps.map(r=>'<option value="'+escHtml(r)+'"'+(r===curRep?' selected':'')+'>'+escHtml(r)+'</option>').join('');
  }
  const repFilter = repSel ? repSel.value : '';
  // Filter by view (active vs trash) and rep
  const now = Date.now();
  const thirtyDays = 30*24*60*60*1000;
  let list = allEsts.filter(e=>{
    if(e.isRevision) return false; // revisions shown only in history modal
    if(_estView === 'trash'){
      if(!e.deletedAt) return false;
      if(now - new Date(e.deletedAt).getTime() > thirtyDays) return false;
      return true;
    } else {
      return !e.deletedAt;
    }
  });
  if(repFilter) list = list.filter(e=>(e.rep||'')=== repFilter);
  // Search filter
  const searchEl = document.getElementById('est-search');
  const searchQ = searchEl ? searchEl.value.trim().toLowerCase() : '';
  if(searchQ){
    list = list.filter(e=>{
      return (e.addr||'').toLowerCase().includes(searchQ)
        || (e.owner||'').toLowerCase().includes(searchQ)
        || (e.rep||'').toLowerCase().includes(searchQ);
    });
  }

  const empty = document.getElementById('estimates-empty');
  const table = document.getElementById('estimates-table');
  const tbody = document.getElementById('estimates-tbody');
  if(!empty || !table || !tbody) return;
  // Also collect trashed pins for the trash view
  const trashedPins = _estView==='trash'
    ? (S.pins||[]).filter(p=>p.deleted_at && (now - new Date(p.deleted_at).getTime() < 30*24*60*60*1000))
    : [];
  // Collect active pins that have no saved estimate (active view only)
  const estimatedPinIds = new Set((S.estimates||[]).filter(e=>!e.deletedAt&&!e.isRevision).map(e=>e.pinId).filter(Boolean));
  const estimatedAddrs = new Set((S.estimates||[]).filter(e=>!e.deletedAt&&!e.isRevision).map(e=>(e.addr||'').trim().toLowerCase()).filter(Boolean));
  const pinsWithoutEst = _estView==='trash' ? [] : (S.pins||[]).filter(p=>{
    if(p.deleted_at) return false; // skip trashed pins
    if(estimatedPinIds.has(p.id)) return false; // already has estimate by pinId
    if(estimatedAddrs.has((p.address||'').trim().toLowerCase())) return false; // already has estimate by address
    // Apply rep filter
    if(repFilter && (p.rep||'') !== repFilter) return false;
    // Apply search filter
    if(searchQ){
      if(!(p.address||'').toLowerCase().includes(searchQ) && !(p.rep||'').toLowerCase().includes(searchQ)) return false;
    }
    return true;
  });
  if(!list.length && !trashedPins.length && !pinsWithoutEst.length){
    empty.style.display='block'; table.style.display='none';
    const lbl2 = empty.querySelector('div:nth-child(2)');
    if(lbl2) lbl2.textContent = searchQ ? 'No estimates match "'+searchQ+'"' : (_estView==='trash' ? 'Trash is empty' : 'No saved estimates yet');
    return;
  }
  empty.style.display='none'; table.style.display='table';
  // Apply column sort
  list = _sortList(list, _estSort.col, _estSort.dir);
  _updateEstSortArrows();
  tbody.innerHTML = list.map(function(est){
    const date = est.savedAt ? new Date(est.savedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const addr = est.addr || '—';
    const shortAddr = addr.split(',')[0];
    const owner = est.owner || 'Homeowner';
    const rep = est.rep || '—';
    const total = '$'+(est.total||0).toLocaleString();
    const sentBadge = est.sentAt
      ? '<span style="background:rgba(34,197,94,.15);color:var(--success);border:1px solid var(--success);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">SENT</span>'
      : '<span style="background:rgba(59,130,246,.1);color:var(--info);border:1px solid var(--info);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">SAVED</span>';
    // Mailed badge: check if a queue item for this address has been sent
    const _estAddrLow = (est.addr||'').trim().toLowerCase();
    const _mailedItem = (S.queue||[]).find(q => q.addr.trim().toLowerCase()===_estAddrLow && q.status==='sent');
    const mailedBadge = _mailedItem
      ? '<div style="margin-top:4px;"><span style="background:rgba(14,116,144,.15);color:#22d3ee;border:1px solid rgba(14,116,144,.6);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">📬 MAILED</span>'+(_mailedItem.mailedAt?'<div style="font-size:10px;color:var(--muted);margin-top:2px;">'+new Date(_mailedItem.mailedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'</div>':'')+'</div>'
      : '';
    const eid = escHtml(String(est.id||''));
    // Unlock check: find the linked pin and see if it has been unlocked
    const _estPinForUnlock = est.pinId ? (S.pins||[]).find(p=>p.id===est.pinId) : (S.pins||[]).find(p=>p.address===est.addr);
    const _pinUnlocked = _estPinForUnlock ? (isSuperAdmin() || !!_estPinForUnlock.unlockedAt) : false;
    const actionBtns = _estView === 'trash'
      ? `<button onclick="restoreEstimate('${eid}')" style="background:#1a7f4b;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#8629; Restore</button>`
        +(isAdminOrAbove()?`<button onclick="hardDeleteEstimate('${eid}')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;">&#10005; Purge</button>`:'')
      : (()=>{
          const revCount = (S.estimates||[]).filter(e=>e.pinId===est.pinId && e.isRevision).length;
          const histBtn = revCount > 0
            ? `<button onclick="openEstHistory('${eid}')" style="background:#374151;border:none;border-radius:6px;padding:6px 10px;color:#9CA3AF;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128221; History (${revCount})</button>`
            : '';
          return `<button onclick="loadEstimateIntoEstimator('${eid}')" style="background:var(--card2);border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--text);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#9999; Edit</button>`
            +(S.cfg && S.cfg.ghlLocationId ? (()=>{
              // Look up the linked pin to check GHL sync status
              const _estPin = est.pinId ? (S.pins||[]).find(p=>p.id===est.pinId) : (S.pins||[]).find(p=>p.address===est.addr);
              const _ghlId = _estPin ? (_estPin.ghlContactId||null) : null;
              const _ghlSynced = !!_ghlId;
              return `<button id="est-ghl-btn-${eid}" onclick="sendEstimateViaGHL('${eid}')"
                title="${_ghlSynced ? '✓ Synced to GHL — click to re-sync/update' : 'Send to GHL'}"
                style="background:${_ghlSynced?'#166534':'#1e3a5f'};border:1px solid ${_ghlSynced?'#22c55e':'#3b82f6'};border-radius:6px;padding:6px 10px;color:${_ghlSynced?'#4ade80':'#93c5fd'};font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">
                ${_ghlSynced?'✓ GHL':'⬆ GHL'}</button>`;
            })() : '')
            +(()=>{
            const estAddr = (est.addr||'').trim().toLowerCase();
            const inQueue = (S.queue||[]).some(function(q){ return q.addr.trim().toLowerCase()===estAddr && q.status==='pending'; });
            if(!_pinUnlocked){
              return `<button onclick="requirePinUnlockedForEst('${eid}')" title="Unlock this pin to send to Mail Queue" style="background:#374151;border:1px solid #6b7280;border-radius:6px;padding:5px 10px;color:#9CA3AF;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;flex-direction:column;align-items:center;line-height:1.2;"><span style="font-size:9px;opacity:.85;">&#128274; Unlock to</span><span style="font-size:12px;">Queue</span></button>`;
            }
            return inQueue
              ? `<button onclick="goTab('mailqueue')" title="Already in Mail Queue — click to view" style="background:#0e7490;border:none;border-radius:6px;padding:5px 10px;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;flex-direction:column;align-items:center;line-height:1.2;"><span style="font-size:9px;opacity:.85;">&#10003; In</span><span style="font-size:12px;">Queue</span></button>`
              : `<button onclick="addEstimateToMailQueue('${eid}')" style="background:var(--accent);border:none;border-radius:6px;padding:5px 10px;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;flex-direction:column;align-items:center;line-height:1.2;"><span style="font-size:9px;opacity:.85;">&#128228; Send to</span><span style="font-size:12px;">Mail Queue</span></button>`;
          })()
            +(_pinUnlocked && S.cfg && S.cfg.dripEnabled
              ? (est.drip
                  ? `<button onclick="openBlitzStatus('${eid}')" style="background:rgba(124,58,237,.2);border:1px solid rgba(124,58,237,.5);border-radius:6px;padding:6px 10px;color:#a78bfa;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🔥 Blitz Status</button>`
                  : `<button onclick="openDripModal('${eid}')" style="background:#7C3AED;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🔥 Blitz</button>`)
              : '')
            /* Estimate Card hidden — consolidated into Send Postcard flow */
          +(_pinUnlocked?`<button onclick="previewEstimatePostcard('${eid}')" style="background:#0e7490;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128247; Preview Postcard</button>`:'')
            /* Preview Letter hidden — letter visible in estimator panel */
            +(_pinUnlocked?`<button onclick="printEstimate('${eid}')" style="background:#1f3d68;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128424; Print</button>`:'')
            /* PDF hidden — use Print Now instead */
            +(S.cfg && S.cfg.qbClientId ? `<button onclick="sendEstimateToQB('${eid}')" title="${est.qbInvoiceId ? 'QB Invoice #'+est.qbInvoiceId+' — click to update' : 'Send to QuickBooks as invoice'}" style="background:${est.qbInvoiceId ? 'rgba(44,160,28,.15)' : '#1c3a1c'};border:1px solid ${est.qbInvoiceId ? '#2ca01c' : '#2ca01c44'};border-radius:6px;padding:6px 10px;color:${est.qbInvoiceId ? '#4ade80' : '#86efac'};font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">${est.qbInvoiceId ? '&#10003; QB Invoice' : '&#128196; QuickBooks'}</button>` : '')
            +(est.signedAt ? `<button onclick="downloadSignedEstimatePDF('${eid}')" title="Signed by ${escHtml(est.sigName||'homeowner')} on ${new Date(est.signedAt).toLocaleDateString()}" style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);border-radius:6px;padding:6px 10px;color:#4ade80;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#11015; Signed</button>` : '')
            +`<button onclick="openEstimatePage('${eid}')" style="background:#065f46;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#127758; View Page</button>`
            +histBtn
            +`<button onclick="deleteEstimate('${eid}')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;">&#10005;</button>`;
        })()
      return '<tr style="border-bottom:1px solid var(--border);">'+'<td style="padding:10px 8px;"><input type="checkbox" class="est-row-cb" data-id="'+eid+'" onchange="updateEstimateSelectionBar()" style="cursor:pointer;"></td>'
      +'<td style="padding:12px;font-size:14px;font-weight:600;color:var(--text);">'+escHtml(shortAddr)+'<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+escHtml(addr.split(',').slice(1).join(',').trim())+'</div></td>'
      +'<td style="padding:12px;font-size:13px;color:var(--mid);">'+escHtml(owner)+'</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">'+escHtml(rep)+'</td>'
      +'<td style="padding:12px;text-align:right;font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--accent);">'+total+'</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">'+date+(est.version&&est.version>1?'<div style="margin-top:3px;"><span style="background:rgba(249,115,22,.15);color:#F97316;border:1px solid rgba(249,115,22,.4);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;">v'+est.version+'</span></div>':'')+'<div style="margin-top:4px;">'+sentBadge+'</div>'+mailedBadge+'</td>'
      +(()=>{
        const views = est.page_views || 0;
        const firstSeen = est.page_first_viewed_at ? new Date(est.page_first_viewed_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : null;
        const timeSpent = est.page_time_spent ? (est.page_time_spent >= 60 ? Math.round(est.page_time_spent/60)+'m' : est.page_time_spent+'s') : null;
        const matClicks = est.page_mat_clicks && typeof est.page_mat_clicks === 'object' ? Object.entries(est.page_mat_clicks).map(([k,v])=>({key:k,count:v})).sort((a,b)=>b.count-a.count) : [];
        const topMat = matClicks.length ? {'1.0':'3-Tab','1.3':'Arch','1.8':'Designer','2.5':'Metal'}[matClicks[0].key]||matClicks[0].key : null;
        if(!views) return '<td style="padding:12px;text-align:center;"><span style="font-size:11px;color:var(--muted);opacity:.4;">Not viewed</span></td>';
        return '<td style="padding:12px;text-align:center;">'
          +'<div style="font-size:16px;font-weight:800;color:#10b981;">'+views+'</div>'
          +'<div style="font-size:10px;color:var(--muted);">'+(firstSeen?'First: '+firstSeen:'')+'</div>'
          +(timeSpent?'<div style="font-size:10px;color:var(--muted);">'+timeSpent+' spent</div>':'')
          +(topMat?'<div style="font-size:10px;color:#F25C05;font-weight:700;">&#9654; '+topMat+'</div>':'')
          +(est.page_share_clicks?'<div style="font-size:10px;color:#7c3aed;">&#x1F4E4; Shared</div>':'')
          +'</td>';
      })()
      +(()=>{
        // Photo thumbnail cell — click to open lightbox
        const allP = est.all_photos || {};
        const firstCat = ['home','damage','additional'].find(k=>(allP[k]||[]).length>0);
        const firstEntry = firstCat ? (allP[firstCat]||[])[0] : null;
        const thumbSrc = firstEntry
          ? (typeof firstEntry==='string' ? firstEntry : (firstEntry.data||firstEntry.url||''))
          : (est.photo_data||est.photo_url||'');
        const totalCount = ['home','damage','additional'].reduce((n,k)=>n+(allP[k]||[]).length,0)
          || (est.damage_photos&&Array.isArray(est.damage_photos)?est.damage_photos.length:0)
          || (thumbSrc?1:0);
        if(!thumbSrc) return '<td style="padding:12px;text-align:center;"><span style="font-size:10px;color:var(--muted);opacity:.4;">No photos</span></td>';
        return '<td style="padding:12px;text-align:center;">'
          +'<div onclick="openEstPhotoLightbox(\''+eid+'\')" title="Click to view '+totalCount+' photo'+(totalCount!==1?'s':'')+' — '+escHtml(addr)+'" style="position:relative;display:inline-block;cursor:pointer;">'
          +'<img src="'+thumbSrc+'" style="width:64px;height:48px;object-fit:cover;border-radius:5px;border:2px solid var(--border);transition:border-color .15s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'" alt="photo">'
          +(totalCount>1?'<span style="position:absolute;bottom:3px;right:3px;background:rgba(0,0,0,.7);color:#fff;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;">'+totalCount+'</span>':'')
          +'</div>'
          +'</td>';
      })()
      +'<td style="padding:12px;text-align:center;">'
        +'<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">'+actionBtns+'</div>'
      +'</td>'
      +'</tr>';
  }).join('') + trashedPins.map(function(pin){
    const date = pin.deleted_at ? new Date(pin.deleted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const addr = pin.address || '—';
    const shortAddr = addr.split(',')[0];
    const pid = escHtml(String(pin.id||''));
    const pinActionBtns = '<button data-pid="' + pid + '" onclick="restorePin(this.dataset.pid)" style="background:#1a7f4b;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#8629; Restore Pin</button>'
      + (isAdminOrAbove() ? '<button data-pid="' + pid + '" onclick="hardDeletePin(this.dataset.pid)" style="background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;">&#10005; Purge</button>' : '');
    return '<tr style="border-bottom:1px solid var(--border);opacity:.75;">'
      +'<td style="padding:10px 8px;"><input type="checkbox" class="est-row-cb pin-only-cb" data-id="" data-pid="'+pid+'" onchange="updateEstimateSelectionBar()" style="cursor:pointer;width:16px;height:16px;accent-color:var(--accent);"></td>'
      +'<td style="padding:12px;font-size:14px;font-weight:600;color:var(--text);">'+escHtml(shortAddr)+'<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+escHtml(addr.split(',').slice(1).join(',').trim())+'</div><div style="margin-top:3px;"><span style="background:rgba(242,92,5,.1);color:var(--accent);border:1px solid rgba(242,92,5,.3);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;">PIN ONLY</span></div></td>'
      +'<td style="padding:12px;font-size:13px;color:var(--mid);">—</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">'+escHtml(pin.rep||'—')+'</td>'
      +'<td style="padding:12px;text-align:right;font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--muted);">—</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">'+date+'<div style="margin-top:4px;"><span style="background:rgba(239,68,68,.1);color:var(--danger);border:1px solid var(--danger);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">DELETED</span></div></td>'
      +'<td style="padding:12px;text-align:center;"><div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">'+pinActionBtns+'</div></td>'
      +'</tr>';
  }).join('') + pinsWithoutEst.map(function(pin){
    // Active pins with no estimate yet — show as PIN ONLY with a Start Estimate button
    const date = pin.at ? new Date(pin.at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const addr = pin.address || '—';
    const shortAddr = addr.split(',')[0];
    const cityState = addr.split(',').slice(1).join(',').trim();
    const pid = escHtml(String(pin.id||''));
    const ownerName = (pin.estimate && pin.estimate.owner) || (pin.contactData && pin.contactData.ownerName) || '';
    const statusColors = {pinned:'#64748B',contacted:'#3B82F6',quoted:'#0EA5E9',interested:'#22C55E',signed:'#A855F7',sold:'#F59E0B',lost:'#EF4444'};
    const statusColor = statusColors[pin.status] || '#64748B';
    const statusLabel = {pinned:'Pinned',contacted:'Contacted',quoted:'Quoted',interested:'Interested',signed:'Signed',sold:'Sold',lost:'Lost'}[pin.status] || (pin.status||'Pinned');
    return '<tr style="border-bottom:1px solid var(--border);">'
      +'<td style="padding:10px 8px;"><input type="checkbox" class="est-row-cb active-pin-cb" data-id="" data-pid="'+pid+'" onchange="updateEstimateSelectionBar()" style="cursor:pointer;width:16px;height:16px;accent-color:var(--accent);"></td>'
      +'<td style="padding:12px;font-size:14px;font-weight:600;color:var(--text);">'+escHtml(shortAddr)+'<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+escHtml(cityState)+'</div>'
        +(ownerName?'<div style="font-size:11px;color:var(--mid);margin-top:2px;">'+escHtml(ownerName)+'</div>':'')
        +'<div style="margin-top:3px;"><span style="background:rgba(100,116,139,.12);color:#94A3B8;border:1px solid rgba(100,116,139,.3);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;">PIN ONLY</span></div></td>'
      +'<td style="padding:12px;font-size:13px;color:var(--mid);">'+escHtml(pin.rep||'—')+'</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">—</td>'
      +'<td style="padding:12px;text-align:right;font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--muted);">—</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">'+date+'<div style="margin-top:4px;"><span style="background:'+statusColor+'22;color:'+statusColor+';border:1px solid '+statusColor+'44;border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">'+escHtml(statusLabel)+'</span></div></td>'
      +'<td style="padding:12px;text-align:center;"><div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">'
        +'<button data-pid="'+pid+'" onclick="goEstFromPin(this.dataset.pid)" style="background:var(--accent);border:none;border-radius:6px;padding:6px 12px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128203; Start Estimate</button>'
        +'<button data-pid="'+pid+'" onclick="deleteActivePin(this.dataset.pid)" style="background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;">&#128465; Delete</button>'
      +'</div></td>'
      +'</tr>';
  }).join('');
}

// ── Checkbox / bulk selection helpers ────────────────────────────────────
function toggleAllEstimateSelect(checked){
  document.querySelectorAll('.est-row-cb').forEach(cb=>cb.checked=checked);
  updateEstimateSelectionBar();
}
function clearEstimateSelection(){
  document.querySelectorAll('.est-row-cb').forEach(cb=>cb.checked=false);
  const all = document.getElementById('est-select-all');
  if(all){all.checked=false;all.indeterminate=false;}
  updateEstimateSelectionBar();
}
function updateEstimateSelectionBar(){
  const cbs = document.querySelectorAll('.est-row-cb:checked');
  const bar = document.getElementById('est-bulk-bar');
  const cnt = document.getElementById('est-selected-count');
  const all = document.getElementById('est-select-all');
  const total = document.querySelectorAll('.est-row-cb').length;
  const isTrash = _estView === 'trash';
  if(bar) bar.style.display = cbs.length ? 'flex' : 'none';
  if(cnt) cnt.textContent = cbs.length + ' selected';
  if(all){ all.indeterminate = cbs.length>0 && cbs.length<total; if(cbs.length===total && total>0) all.checked=true; }
  // Show/hide buttons based on view
  const delBtn = document.getElementById('est-bulk-delete-btn');
  const queueBtn = document.getElementById('est-bulk-queue-btn');
  const ghlBtn = document.getElementById('est-bulk-ghl-btn');
  const restoreBtn = document.getElementById('est-bulk-restore-btn');
  const purgeBtn   = document.getElementById('est-bulk-purge-btn');
  if(delBtn)     delBtn.style.display     = isTrash ? 'none' : '';
  if(queueBtn)   queueBtn.style.display   = isTrash ? 'none' : '';
  if(ghlBtn)     ghlBtn.style.display     = isTrash ? 'none' : '';
  if(restoreBtn) restoreBtn.style.display = isTrash ? '' : 'none';
  if(purgeBtn)   purgeBtn.style.display   = (isTrash && isAdminOrAbove()) ? '' : 'none';
}

function bulkPurgeEstimates(){
  if(!isAdminOrAbove()){ toast('Only admins can permanently delete estimates.','error'); return; }
  // Collect estimate ids (has data-id) and pin-only ids (has data-pid, no data-id)
  const estIds = [...document.querySelectorAll('.est-row-cb:checked')].map(cb=>cb.dataset.id).filter(Boolean);
  const pinOnlyIds = [...document.querySelectorAll('.pin-only-cb:checked')].map(cb=>cb.dataset.pid).filter(Boolean);
  const total = estIds.length + pinOnlyIds.length;
  if(!total){ toast('No items selected','warn'); return; }
  bdConfirm('Permanently delete '+total+' item'+(total!==1?'s':'')+' and their pins? This cannot be undone.', ()=>{
    // Delete estimates + their pins
    estIds.forEach(estId=>{
      const est = (S.estimates||[]).find(e=>e.id===estId);
      S.estimates = (S.estimates||[]).filter(e=>e.id!==estId);
      if(sb) sb.from('estimates').delete().eq('id', estId).then(({error})=>{ if(error) console.warn('[BidDrop] bulkPurge:', error.message); });
      if(est && est.pinId){
        S.pins = (S.pins||[]).filter(p=>p.id!==est.pinId);
        if(sb) sb.from('pins').delete().eq('id', est.pinId).eq('account_id', currentAccount.id).then(()=>{});
        if(map && markers[est.pinId]){
          if(clusterGroup) clusterGroup.removeLayer(markers[est.pinId]);
          else map.removeLayer(markers[est.pinId]);
          delete markers[est.pinId];
        }
      }
    });
    // Delete pin-only rows
    pinOnlyIds.forEach(pid=>{
      S.pins = (S.pins||[]).filter(p=>p.id!==pid);
      if(sb) sb.from('pins').delete().eq('id', pid).eq('account_id', currentAccount.id).then(({error})=>{ if(error) console.warn('[BidDrop] bulkPurgePins:', error.message); });
      if(map && markers[pid]){
        if(clusterGroup) clusterGroup.removeLayer(markers[pid]);
        else map.removeLayer(markers[pid]);
        delete markers[pid];
      }
    });
    save(); renderPinList(); renderEstimatesTab();
    toast(total+' item'+(total!==1?'s':'')+' permanently deleted','info');
  });
}

// ── Estimate revision history ────────────────────────────────────────────
function openEstHistory(estId){
  const activeEst = (S.estimates||[]).find(e=>e.id===estId);
  if(!activeEst) return;
  const revisions = (S.estimates||[])
    .filter(e=>e.pinId===activeEst.pinId && e.isRevision)
    .sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));
  if(!revisions.length){ toast('No previous versions found for this estimate','info'); return; }
  // Build modal
  let existing = document.getElementById('m-est-history');
  if(existing) existing.remove();
  const rows = revisions.map(r=>{
    const d = r.savedAt ? new Date(r.savedAt).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
    const t = '$'+(r.total||0).toLocaleString();
    const v = r.version ? 'v'+r.version : '—';
    const structs = (r.structures||[]).map(s=>escHtml(s.name||s.type||'Structure')+' ('+escHtml(s.roofType||'')+')').join(', ');
    const rid = escHtml(r.id);
    return '<tr style="border-bottom:1px solid var(--border);">'  
      +'<td style="padding:10px 12px;font-size:12px;color:var(--muted);">'+d+'</td>'
      +'<td style="padding:10px 12px;text-align:center;"><span style="background:rgba(249,115,22,.15);color:#F97316;border:1px solid rgba(249,115,22,.4);border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;">'+v+'</span></td>'
      +'<td style="padding:10px 12px;text-align:right;font-family:var(--font-h);font-size:15px;font-weight:700;color:var(--accent);">'+t+'</td>'
      +'<td style="padding:10px 12px;font-size:11px;color:var(--muted);">'+structs+'</td>'
      +'<td style="padding:10px 12px;text-align:center;">'
        +'<button onclick="restoreRevision(\''+rid+'\',\''+escHtml(estId)+'\')" style="background:#1a7f4b;border:none;border-radius:6px;padding:5px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#8629; Restore</button>'
      +'</td>'
      +'</tr>';
  }).join('');
  const modal = document.createElement('div');
  modal.className='overlay'; modal.id='m-est-history'; modal.dataset.dynamic='1';
  modal.addEventListener('click',e=>{if(e.target===modal)closeM('m-est-history');});
  modal.innerHTML='<div class="modal" style="max-width:700px;">'
    +'<div class="modal-title">&#128221; Estimate Revision History — '+escHtml((activeEst.addr||'').split(',')[0])+'</div>'
    +'<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Showing '+revisions.length+' previous version'+(revisions.length!==1?'s':'')+'. Restoring a revision will replace the current active estimate.</div>'
    +'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">'
    +'<thead><tr style="border-bottom:2px solid var(--border);">'
    +'<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--muted);font-weight:700;">Saved</th>'
    +'<th style="padding:8px 12px;text-align:center;font-size:11px;color:var(--muted);font-weight:700;">Ver</th>'
    +'<th style="padding:8px 12px;text-align:right;font-size:11px;color:var(--muted);font-weight:700;">Total</th>'
    +'<th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--muted);font-weight:700;">Structures</th>'
    +'<th style="padding:8px 12px;"></th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div>'
    +'<div class="modal-footer"><button class="btn-cancel" onclick="closeM(\'m-est-history\')">Close</button></div>'
    +'</div>';
  document.body.appendChild(modal);
  modal.style.display='flex';
}
function restoreRevision(revId, activeEstId){
  bdConfirm('Restore this version? The current estimate will be archived as a revision.', ()=>{
  const rev = (S.estimates||[]).find(e=>e.id===revId);
  const active = (S.estimates||[]).find(e=>e.id===activeEstId);
  if(!rev || !active) return;
  // Archive current active as a revision
  const curVersion = active.version||1;
  const archived = {...active, id:'rev_'+active.id+'_v'+curVersion, isRevision:true, revisedAt:new Date().toISOString()};
  // Promote revision to active
  const restoredVersion = rev.version||1;
  const restored = {...rev, id:activeEstId, isRevision:false, version:curVersion+1, savedAt:new Date().toISOString(), revisedAt:undefined};
  // Remove old revision from list, replace active, add archived current
  const idx = (S.estimates||[]).findIndex(e=>e.id===activeEstId);
  if(idx>=0) S.estimates.splice(idx,1,restored);
  S.estimates = (S.estimates||[]).filter(e=>e.id!==revId);
  S.estimates.push(archived);
  // Sync pin.estimate
  const pin = (S.pins||[]).find(p=>p.id===restored.pinId);
  if(pin){
    pin.estimate = {id:restored.id,owner:restored.owner,email:restored.email,total:restored.total,structures:restored.structures,rep:restored.rep,savedAt:restored.savedAt};
    pin.at_est = restored.savedAt;
    if(sb) sb.from('pins').update({estimate:pin.estimate}).eq('id',pin.id).then(()=>{});
  }
  save(); closeM('m-est-history'); renderEstimatesTab();
  toast('&#10003; Revision restored as v'+(curVersion+1),'success');
  }); // end bdConfirm
}

// ── Soft delete (move to trash) ───────────────────────────────────────────
function deleteEstimate(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est) return;
  // Warn if this pin has been mailed
  const hasMailed = (S.queue||[]).some(q=>q.pinId===est.pinId && q.status==='sent');
  const doDelete = ()=>{
    const now = new Date().toISOString();
    est.deletedAt = now;
    // Soft-delete in the estimates table (30-day recovery)
    if(sb) sb.from('estimates').update({deleted_at: now}).eq('id', estId).then(({error})=>{
      if(error) console.warn('[BidDrop] deleteEstimate:', error.message);
    });
    // Cascade: also soft-delete the linked pin (estimates and pins are one record)
    if(est.pinId){
      const pin = (S.pins||[]).find(p=>p.id===est.pinId);
      if(pin && !pin.deleted_at){
        pin.deleted_at = now;
        pin.estimate = null; pin.at_est = null;
        if(sb) sbDeletePin(est.pinId).catch(()=>{});
        // Remove map marker
        if(map && markers[est.pinId]){
          if(clusterGroup) clusterGroup.removeLayer(markers[est.pinId]);
          else map.removeLayer(markers[est.pinId]);
          delete markers[est.pinId];
        }
      }
    }
    renderPinList();
    renderEstimatesTab();
    toast('Moved to Trash — recoverable for 30 days','info');
  };
  if(hasMailed){
    bdConfirm('⚠️ This address has already been mailed a postcard. Move estimate AND pin to Trash anyway?', doDelete);
  } else {
    doDelete();
  }
}
function deleteActivePin(pinId){
  // Soft-delete a PIN ONLY active row — moves it to Trash (recoverable)
  // Falls back to hard-delete if deleted_at column doesn't exist yet (pre-migration)
  if(!currentAccount) return;
  bdConfirm('Move this pin to Trash?', async ()=>{
    const now = new Date().toISOString();
    const pin = (S.pins||[]).find(p=>p.id===pinId);
    if(!pin) return;
    // Set client-side immediately so it disappears from Active and appears in Trash
    pin.deleted_at = now;
    // Remove map marker
    if(map && markers[pinId]){
      if(clusterGroup) clusterGroup.removeLayer(markers[pinId]);
      else map.removeLayer(markers[pinId]);
      delete markers[pinId];
    }
    renderPinList();
    renderEstimatesTab();
    toast('Moved to Trash — recoverable for 30 days','info');
    // Persist to DB (sbDeletePin handles missing column fallback)
    try{
      await sbDeletePin(pinId);
    }catch(e){
      console.warn('[BidDrop] deleteActivePin DB error:', e.message);
      // Already removed client-side; DB will be cleaned up on next hard-delete/migration
    }
  });
}
async function bulkDeleteEstimates(){
  const ids = Array.from(document.querySelectorAll('.est-row-cb:checked')).map(cb=>cb.dataset.id).filter(Boolean);
  // Also collect active pin-only rows (no estimate, just a pin)
  const activePinIds = Array.from(document.querySelectorAll('.active-pin-cb:checked')).map(cb=>cb.dataset.pid).filter(Boolean);
  const total = ids.length + activePinIds.length;
  if(!total) return;
  bdConfirm('Delete '+total+' item(s) and their pins?', ()=>{
  const now = new Date().toISOString();
  // Handle estimates
  ids.forEach(id=>{
    const e=(S.estimates||[]).find(x=>x.id===id);
    if(e){
      e.deletedAt = now;
      if(sb) sb.from('estimates').update({deleted_at: now}).eq('id', id).then(({error})=>{
        if(error) console.warn('[BidDrop] bulkDeleteEstimates:', error.message);
      });
      // Cascade: also delete the linked pin
      if(e.pinId){
        const pin=(S.pins||[]).find(p=>p.id===e.pinId);
        if(pin && !pin.deleted_at){
          pin.deleted_at = now; pin.estimate=null; pin.at_est=null;
          if(sb) sbDeletePin(e.pinId).catch(()=>{});
          if(map && markers[e.pinId]){
            if(clusterGroup) clusterGroup.removeLayer(markers[e.pinId]);
            else map.removeLayer(markers[e.pinId]);
            delete markers[e.pinId];
          }
        }
      }
    }
  });
  // Handle active PIN ONLY rows — hard-delete since they have no estimate
  activePinIds.forEach(pid=>{
    S.pins = (S.pins||[]).filter(p=>p.id!==pid);
    if(sb) sb.from('pins').delete().eq('id', pid).eq('account_id', currentAccount.id).then(({error})=>{
      if(error) console.warn('[BidDrop] bulkDeleteActivePins:', error.message);
    });
    if(map && markers[pid]){
      if(clusterGroup) clusterGroup.removeLayer(markers[pid]);
      else map.removeLayer(markers[pid]);
      delete markers[pid];
    }
  });
  save(); clearEstimateSelection(); renderPinList(); renderEstimatesTab();
  toast('Deleted '+total+' item(s)','info');
  }); // end bdConfirm
}

// ── Restore from trash ────────────────────────────────────────────────────
async function hardDeletePin(pinId){
  // Only admins and above can permanently delete pins
  if(!isAdminOrAbove()){
    toast('Only admins can permanently delete pins. Reps can only move pins to Trash.','error');
    return;
  }
  bdConfirm('Permanently delete this pin? This cannot be undone.', async ()=>{
  if(!currentAccount) return;
  try{
    const {error} = await sb.from('pins').delete().eq('id', pinId).eq('account_id', currentAccount.id);
    if(error) throw new Error(error.message);
    S.pins = S.pins.filter(p=>p.id!==pinId);
    // Also remove linked estimates from memory
    if(S.estimates) S.estimates = S.estimates.filter(e=>e.pinId!==pinId);
    // Remove map marker
    if(map && markers[pinId]){
      if(clusterGroup) clusterGroup.removeLayer(markers[pinId]);
      else map.removeLayer(markers[pinId]);
      delete markers[pinId];
    }
    if(typeof renderEstimatesTab==='function') renderEstimatesTab();
    if(typeof renderPinList==='function') renderPinList();
    toast('Pin permanently deleted','info');
  }catch(e){
    console.error('[BidDrop] hardDeletePin error:', e);
    toast('Purge failed: '+e.message,'error');
  }
  }); // end bdConfirm
}
async function restorePin(pinId){
  const pin = (S.pins||[]).find(p=>p.id===pinId);
  if(!pin) return;
  try{
    await sbRestorePin(pinId);
    delete pin.deleted_at;
    // Cascade restore: also restore all linked estimates that were soft-deleted
    (S.estimates||[]).filter(e=>e.pinId===pinId && e.deletedAt).forEach(e=>{
      delete e.deletedAt;
      if(sb) sb.from('estimates').update({deleted_at:null}).eq('id',e.id).then(()=>{});
    });
    addMarker(pin);
    renderPinList();
    if(typeof renderEstimatesTab==='function') renderEstimatesTab();
    toast('Pin restored','success');
  }catch(e){
    toast('Restore failed: '+e.message,'error');
  }
}
function restoreEstimate(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est) return;
  delete est.deletedAt;
  if(sb) sb.from('estimates').update({deleted_at: null}).eq('id', estId).then(({error})=>{
    if(error) console.warn('[BidDrop] restoreEstimate:', error.message);
  });
  // Cascade: also restore the linked pin
  if(est.pinId){
    const pin = (S.pins||[]).find(p=>p.id===est.pinId);
    if(pin){
      delete pin.deleted_at;
      pin.estimate = {owner:est.owner,email:est.email,total:est.total,structures:est.structures};
      pin.at_est = est.savedAt;
      if(sb) sb.from('pins').update({estimate:pin.estimate, deleted_at:null}).eq('id',est.pinId).then(()=>{});
      // Re-add marker to map
      if(map) addMarker(pin);
    }
  }
  renderPinList();
  renderEstimatesTab();
  toast('Estimate and pin restored','success');
}
function bulkRestoreEstimates(){
  const ids = Array.from(document.querySelectorAll('.est-row-cb:checked')).map(cb=>cb.dataset.id);
  if(!ids.length) return;
  ids.forEach(id=>{
    const e=(S.estimates||[]).find(x=>x.id===id);
    if(e){ delete e.deletedAt;
      if(sb) sb.from('estimates').update({deleted_at: null}).eq('id', id).then(({error})=>{
        if(error) console.warn('[BidDrop] bulkRestoreEstimates:', error.message);
      });
      // Cascade: also restore the linked pin and re-add map marker
      if(e.pinId){
        const pin=(S.pins||[]).find(p=>p.id===e.pinId);
        if(pin){
          delete pin.deleted_at;
          pin.estimate={owner:e.owner,email:e.email,total:e.total,structures:e.structures}; pin.at_est=e.savedAt;
          if(sb) sb.from('pins').update({estimate:pin.estimate, deleted_at:null}).eq('id',e.pinId).then(()=>{});
          if(map) addMarker(pin);
        }
      }
    }
  });
  save(); clearEstimateSelection(); renderPinList(); renderEstimatesTab();
  toast('Restored '+ids.length+' estimate(s)','success');
}

// ── Bulk: add selected estimates to mail queue ───────────────────────────
function bulkAddToMailQueue(){
  const ids = Array.from(document.querySelectorAll('.est-row-cb:checked')).map(cb=>cb.dataset.id);
  if(!ids.length) return;
  let added = 0, skipped = 0;
  ids.forEach(id=>{
    const est = (S.estimates||[]).find(e=>e.id===id);
    if(!est) return;
    const addr = (est.addr||'').trim().toLowerCase();
    // No duplicate blocking — each send is numbered as a new campaign
    const pin = (S.pins||[]).find(p=>p.id===est.pinId);
    const mainStruct = (est.structures||[])[0] || {};
    const matMap = {'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
    var _bsn = _nextSendNum(est.addr);
    const qItem = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      pinId: est.pinId||null, estId: est.id||null,
      owner: est.owner||'Homeowner', addr: est.addr||'', email: est.email||'',
      sqft: mainStruct.sqft||0, pitch: mainStruct.pitch||'6/12',
      mat: matMap[mainStruct.material]||mainStruct.material||'Architectural Shingle',
      structures: est.structures||[], total: est.total||0,
      photo_data: est.photo_data||null,
      photo_url: est.photo_url||(pin?pin.photo_url:null)||null,
      damage_photos: est.damage_photos||null,
      status: 'pending',
      send_num: _bsn,
      campaign_label: _sendLabel(_bsn, null),
      lobId: null, mailedAt: null,
      at: new Date().toISOString()
    };
    if(!S.queue) S.queue=[];
    S.queue.unshift(qItem);
    sbSaveQueueItem(qItem).catch(function(e){ console.error('Queue save:', e); });
    added++;
  });
  save();
  clearEstimateSelection();
  let msg = 'Added '+added+' estimate(s) to Mail Queue';
  if(skipped) msg += ' ('+skipped+' skipped — already queued)';
  toast(msg, added ? 'success' : 'warn');
}

// ── Bulk: send selected estimates via GHL ─────────────────────────────────
function bulkSendViaGHL(){
  const ids = Array.from(document.querySelectorAll('.est-row-cb:checked')).map(cb=>cb.dataset.id);
  if(!ids.length) return;
  bdConfirm('Send '+ids.length+' estimate(s) via GHL? This will trigger a GHL contact/opportunity for each.', ()=>{
  let sent = 0;
  const sendNext = (i)=>{
    if(i >= ids.length){ toast('Sent '+sent+' estimate(s) via GHL','success'); clearEstimateSelection(); renderEstimatesTab(); return; }
    const est = (S.estimates||[]).find(e=>e.id===ids[i]);
    if(!est){ sendNext(i+1); return; }
    loadEstimateIntoEstimator(ids[i]);
    setTimeout(async ()=>{
      try{ await sendViaGHL(); est.sentAt=new Date().toISOString(); est.status='sent'; sent++; }catch(e){ console.warn('GHL bulk send error',e); }
      save();
      sendNext(i+1);
    }, 400);
  };
  sendNext(0);
  }); // end bdConfirm
}

// ── Hard delete (purge from trash) ────────────────────────────────────────────
function hardDeleteEstimate(estId){
  // Only admins and above can permanently delete estimates
  if(!isAdminOrAbove()){
    toast('Only admins can permanently delete estimates. Reps can only move them to Trash.','error');
    return;
  }
  const est = (S.estimates||[]).find(e=>e.id===estId);
  bdConfirm('Permanently delete this estimate and its pin? This cannot be undone.', ()=>{
  S.estimates = (S.estimates||[]).filter(e=>e.id!==estId);
  if(sb) sb.from('estimates').delete().eq('id', estId).then(({error})=>{
    if(error) console.warn('[BidDrop] hardDeleteEstimate:', error.message);
  });
  // Cascade: also hard-delete the linked pin
  if(est && est.pinId){
    S.pins = (S.pins||[]).filter(p=>p.id!==est.pinId);
    if(sb) sb.from('pins').delete().eq('id', est.pinId).then(()=>{});
    if(map && markers[est.pinId]){
      if(clusterGroup) clusterGroup.removeLayer(markers[est.pinId]);
      else map.removeLayer(markers[est.pinId]);
      delete markers[est.pinId];
    }
  }
  save(); renderPinList(); renderEstimatesTab();
  toast('Estimate and pin permanently deleted','info');
  }); // end bdConfirm
}

// ── CSV Export ────────────────────────────────────────────────────────────
function exportEstimatesCSV(){
  const list = (S.estimates||[]).filter(e=>!e.deletedAt);
  if(!list.length){ toast('No estimates to export','warn'); return; }
  const headers = ['Address','Homeowner','Rep','Email','Total','Structures','Saved Date','Status'];
  const rows = list.map(e=>[
    '"'+(e.addr||'').replace(/"/g,'""')+'"',
    '"'+(e.owner||'').replace(/"/g,'""')+'"',
    '"'+(e.rep||'').replace(/"/g,'""')+'"',
    '"'+(e.email||'').replace(/"/g,'""')+'"',
    e.total||0,
    (e.structures||[]).length,
    e.savedAt ? new Date(e.savedAt).toLocaleDateString('en-US') : '',
    e.sentAt ? 'Sent' : 'Saved'
  ]);
  const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download='estimates_'+(S.cfg&&S.cfg.companyName?S.cfg.companyName.replace(/\s+/g,'_'):'BidDrop')+'_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('CSV downloaded ('+list.length+' estimates)','success');
}

function loadEstimateIntoEstimator(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  // Load all fields into the estimator
  currentEstPinId = est.pinId || null;
  document.getElementById('e-addr').value = est.addr || '';
  document.getElementById('e-owner').value = est.owner || '';
  document.getElementById('e-email').value = est.email || '';
  _clearAllPhotos();
  const pin4est = (S.pins||[]).find(p=>p.id===est.pinId);
  _loadAllPhotosFromEst(est, pin4est);
  structures = (est.structures||[]).map(s=>normStruct(s));
  // Restore add-ons
  const sky = document.getElementById('a-sky'); if(sky) sky.checked = !!est.skylight;
  const skyQ = document.getElementById('a-sky-q'); if(skyQ) skyQ.value = est.skylightQty||1;
  const chim = document.getElementById('a-chim'); if(chim) chim.checked = !!est.chimney;
  const gut = document.getElementById('a-gut'); if(gut) gut.checked = !!est.gutters;
  const gutQ = document.getElementById('a-gut-q'); if(gutQ) gutQ.value = est.gutterLf||120;
  // Restore estimate page settings
  const expiresEl = document.getElementById('e-expires');
  if(expiresEl) expiresEl.value = est.expiresAt ? new Date(est.expiresAt).toISOString().split('T')[0] : '';
  const videoEl = document.getElementById('e-video');
  if(videoEl){ videoEl.value = est.repVideoUrl || ''; if(est.repVideoUrl) onEstVideoUrlInput(); }
  const inspNoteEl = document.getElementById('e-insp-note');
  if(inspNoteEl) inspNoteEl.value = est.inspectionNote || '';
  // Restore price override state
  window._priceOverrideOn = !!(est.priceOverride);
  const overrideInp = document.getElementById('e-price-override');
  const overrideWrap = document.getElementById('price-override-input-wrap');
  const overrideBtn = document.getElementById('price-override-toggle');
  const overrideLbl = document.getElementById('price-override-toggle-label');
  const overrideIcon = document.getElementById('price-override-icon');
  if(window._priceOverrideOn && overrideInp){
    overrideInp.value = est.priceOverride;
    if(overrideWrap) overrideWrap.style.display='block';
    if(overrideBtn){ overrideBtn.style.borderColor='rgba(242,92,5,.6)'; overrideBtn.style.color='rgba(242,92,5,1)'; overrideBtn.style.background='rgba(242,92,5,.08)'; }
    if(overrideLbl) overrideLbl.textContent='Override Active — Click to Disable';
    if(overrideIcon) overrideIcon.textContent='⚡';
  } else {
    if(overrideInp) overrideInp.value='';
    if(overrideWrap) overrideWrap.style.display='none';
    if(overrideBtn){ overrideBtn.style.borderColor='rgba(255,255,255,.15)'; overrideBtn.style.color='rgba(255,255,255,.45)'; overrideBtn.style.background='none'; }
    if(overrideLbl) overrideLbl.textContent='Override Price';
    if(overrideIcon) overrideIcon.textContent='✏️';
  }
  // Set the pin picker
  const sel = document.getElementById('est-pin-picker');
  if(sel && est.pinId) sel.value = est.pinId;
  // Mark this as editing the existing record so Save updates it
  window._editingEstimateId = estId;
  renderStructures(); calcP(); if(typeof setPreviewMode==='function') setPreviewMode('postcard'); else updatePreview();
  goTab('estimate');
  toast('📋 Loaded into Estimator — edit and save to update','info');
  // Refresh unlock/Look Up button state for the loaded pin
  if(typeof _estRefreshUnlockUI==='function') _estRefreshUnlockUI();
}
function addEstimateToMailQueue(estId){
  const est = (S.estimates||[]).find(function(e){return e.id===estId;});
  if(!est){ toast('Estimate not found','error'); return; }
  // Gate behind unlock (secondary guard — UI should already hide button)
  const _gatePin = est.pinId ? (S.pins||[]).find(p=>p.id===est.pinId) : (S.pins||[]).find(p=>p.address===est.addr);
  if(!isSuperAdmin() && _gatePin && !_gatePin.unlockedAt){
    toast('🔒 Unlock this pin first (1 credit) to send to Mail Queue','warn');
    if(_gatePin) requirePinUnlocked(_gatePin.id);
    return;
  }
  // Build a queue item from the estimate (multiple campaigns per address allowed — numbered)
  const addr = (est.addr||'').trim().toLowerCase();
  const pin = (S.pins||[]).find(function(p){return p.id===est.pinId;});
  const mainStruct = (est.structures||[])[0] || {};
  const matMap = {'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
  var _qsn = _nextSendNum(est.addr);
  const qItem = {
    id: 'q_' + Date.now(),
    pinId: est.pinId || null,
    estId: est.id || null,
    owner: est.owner || 'Homeowner',
    addr: est.addr || '',
    email: est.email || '',
    sqft: mainStruct.sqft || 0,
    pitch: mainStruct.pitch || '6/12',
    mat: matMap[mainStruct.material] || mainStruct.material || 'Architectural Shingle',
    structures: est.structures || [],
    total: est.total || 0,
    photo_data: est.photo_data || null,
    photo_url: est.photo_url || (pin ? pin.photo_url : null) || null,
    damage_photos: window._damagePhotos||est.damage_photos||null,
    status: 'pending',
    send_num: _qsn,
    campaign_label: _sendLabel(_qsn, null),
    lobId: null, mailedAt: null,
    at: new Date().toISOString()
  };
  if(!S.queue) S.queue = [];
  S.queue.unshift(qItem);
  sbSaveQueueItem(qItem).catch(function(e){ console.error('Queue save:', e); });
  save();
  renderEstimatesTab();
  toast('Added to Mail Queue!', 'success');
  // Auto-tag GHL contact with biddrop-postcard and advance to Stage 2 (fire-and-forget)
  if(S.cfg.ghlLocationId && pin && pin.ghlContactId){
    ghlAddContactTag(pin.ghlContactId, 'biddrop-postcard').catch(e=>console.warn('GHL tag:', e));
    if(pin.ghlOpportunityId){
      ghlUpdateOpportunityStage(pin.ghlOpportunityId, '2d06ced7-0bcf-432a-b925-701daada9ef4', null)
        .catch(e=>console.warn('GHL stage:', e));
    }
  }
}
async function sendEstimateViaGHL(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  // Load into estimator silently — this also sets currentEstPinId via loadEstimateIntoEstimator
  loadEstimateIntoEstimator(estId);
  // Also ensure currentEstPinId is set so sendViaGHL can find the pin's ghlContactId
  if(est.pinId) currentEstPinId = est.pinId;
  else {
    // Fall back to matching by address
    const matchPin = (S.pins||[]).find(p=>p.address===est.addr);
    if(matchPin) currentEstPinId = matchPin.id;
  }
  setTimeout(async ()=>{
    await sendViaGHL();
    est.sentAt = new Date().toISOString();
    est.status = 'sent';
    save();
    renderEstimatesTab();
  }, 300);
}
async function printEstimate(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  // Gate behind unlock
  if(est.pinId){
    const unlocked = await requirePinUnlocked(est.pinId);
    if(!unlocked){ toast('🔒 Unlock this pin first to print the estimate','warn'); return; }
  } else if(!isSuperAdmin()){
    toast('🔒 This estimate must be linked to an unlocked pin to print','warn'); return;
  }
  loadEstimateIntoEstimator(estId);
  setTimeout(()=>{ printNow(); }, 300);
}
async function downloadEstimatePDF(estId){
  // Open the estimate page in a new window and trigger print-to-PDF
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  // Gate behind unlock
  if(est.pinId){
    const unlocked = await requirePinUnlocked(est.pinId);
    if(!unlocked){ toast('🔒 Unlock this pin first to download the PDF','warn'); return; }
  } else if(!isSuperAdmin()){
    toast('🔒 This estimate must be linked to an unlocked pin to download PDF','warn'); return;
  }
  // Build the estimate page URL and open with print flag
  const baseUrl = window.location.origin;
  const w = window.open(baseUrl+'/e/'+estId+'?print=1','_blank','width=900,height=700');
  if(!w){ toast('Please allow popups to download PDF','warning'); return; }
}
function downloadSignedEstimatePDF(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  if(!est.signedAt){ toast('This estimate has not been signed yet','warning'); return; }
  // Load estimate into estimator and use the proposal builder with signature
  loadEstimateIntoEstimator(estId);
  // Set the signature state in proposal module
  window._editingEstimateId = estId;
  setTimeout(()=>{
    // Open proposal modal with pre-filled signature, then trigger print
    if(typeof buildProposalHTML === 'function'){
      // Temporarily set the sign state
      const tempName = est.sigName || '';
      const tempAt = est.signedAt;
      // Build the HTML with signature block
      const signEl = document.getElementById('prop-esign-name');
      const consentEl = document.getElementById('prop-esign-consent');
      if(signEl) signEl.value = tempName;
      if(consentEl) consentEl.checked = true;
      window._propSignedAt = tempAt; // set module-level variable
      const html = buildProposalHTML(true);
      const w = window.open('','_blank','width=900,height=700');
      if(!w){ toast('Please allow popups to download PDF','warning'); return; }
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(()=>{ w.print(); }, 600);
      // Reset
      window._propSignedAt = null;
      if(signEl) signEl.value = '';
      if(consentEl) consentEl.checked = false;
    } else {
      toast('Proposal builder not available','error');
    }
  }, 400);
}
function clearEst(){
  document.getElementById('e-owner').value='';
  document.getElementById('e-addr').value='';
  ['a-sky','a-chim','a-gut'].forEach(id=>{const el=document.getElementById(id);if(el)el.checked=false;});
  structures=[];
  _resetPriceOverride();
  renderStructures();clearHomePhoto();calcP();if(typeof setPreviewMode==='function') setPreviewMode('postcard'); else updatePreview();
  window._editingQueueId=null;
  window._editingEstimateId=null;
  document.getElementById('add-queue-btn').textContent='📬 Add to Mail Queue';
}

function saveLobKey(){/* Agency model: key stored server-side */}
