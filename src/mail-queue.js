// src/mail-queue.js
// Estimates tab, mail queue render, bulk ops (delete, restore, CSV export, GHL send),
// estimate revision history, sort/filter helpers, canvas postcard preview.
// Depends on: sb, S, currentAccount, adminAPI(), toast(), calcP() (estimates-calc.js),
//             sendLob() (print.js), escHtml() (ui.js)
// Extracted from index.html — Tier 4 modularization

function addToQueue(){
  const addr=document.getElementById('e-addr').value.trim();
  if(!addr){toast('Enter a property address','error');return;}
  const grand=calcP();
  if(!grand){toast('Enter roof area to calculate price','error');return;}

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
      addAct('Estimate updated for <strong>'+escHtml(addr)+'</strong> — <strong>$'+grand.toLocaleString()+'</strong>','bid_sent');
      save();renderQueue();toast('✅ Estimate updated!','success');
      document.getElementById('add-queue-btn').textContent='📬 Add to Mail Queue';
      return;
    }
  }
  const item={
    id:'q'+Date.now(),
    owner:document.getElementById('e-owner').value.trim()||'Homeowner',
    addr, sqft:totalSqft, pitch:pitchLabel, mat:matLabel,
    structures:JSON.parse(JSON.stringify(structures)),
    total:grand, status:'pending',
    // Snapshot photos at queue time so sendLob has them even if estimator is cleared
    photo_url: (window._homePhotoData && window._homePhotoData.startsWith('http')) ? window._homePhotoData : null,
    photo_data: (window._homePhotoData && !window._homePhotoData.startsWith('http')) ? window._homePhotoData : null,
    damage_photos: (window._damagePhotos && window._damagePhotos.length) ? [...window._damagePhotos] : null,
    all_photos: window._allPhotos ? JSON.parse(JSON.stringify(window._allPhotos)) : null,
    at:new Date().toISOString(), mailedAt:null, lobId:null
  };
  S.queue.unshift(item);
  S.estimates.push(item);
  addAct('Estimate for <strong>'+escHtml(addr)+'</strong> queued','bid_sent');
  sbSaveQueueItem(item).catch(e=>console.error('Queue:',e));
  sbAddActivity('Estimate queued for <strong>'+escHtml(addr)+'</strong> — $'+grand.toLocaleString(),'bid_sent');
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
  if(!list.length && !trashedPins.length){
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
    const eid = escHtml(est.id);
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
            return inQueue
              ? `<button onclick="goTab('mailqueue')" title="Already in Mail Queue — click to view" style="background:#0e7490;border:none;border-radius:6px;padding:5px 10px;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;flex-direction:column;align-items:center;line-height:1.2;"><span style="font-size:9px;opacity:.85;">&#10003; In</span><span style="font-size:12px;">Queue</span></button>`
              : `<button onclick="addEstimateToMailQueue('${eid}')" style="background:var(--accent);border:none;border-radius:6px;padding:5px 10px;color:#fff;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;flex-direction:column;align-items:center;line-height:1.2;"><span style="font-size:9px;opacity:.85;">&#128228; Send to</span><span style="font-size:12px;">Mail Queue</span></button>`;
          })()
            +(S.cfg && S.cfg.dripEnabled ? `<button onclick="openDripModal('${eid}')" style="background:#7C3AED;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">🔥 Blitz</button>` : '')
            +(()=>{const _ra=(S&&S.cfg&&S.cfg.tplAccentColor)||'#F25C05';return`<button onclick="openEstimateReveal('${eid}')" style="background:${_ra};border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">📋 Reveal Postcard</button>`;})()
          +`<button onclick="previewEstimatePostcard('${eid}')" style="background:#0e7490;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128247; Preview Postcard</button>`
            +`<button onclick="previewEstimateLetter('${eid}')" style="background:#1f3d68;border:none;border-radius:6px;padding:6px 10px;color:#C8D8E8;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128065; Preview Letter</button>`
            +`<button onclick="printEstimate('${eid}')" style="background:#1f3d68;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128424; Print</button>`
            +`<button onclick="downloadEstimatePDF('${eid}')" style="background:#1f3d68;border:none;border-radius:6px;padding:6px 10px;color:#93c5fd;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#11015; PDF</button>`
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
    const pid = escHtml(pin.id);
    const pinActionBtns = '<button data-pid="' + pid + '" onclick="restorePin(this.dataset.pid)" style="background:#1a7f4b;border:none;border-radius:6px;padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#8629; Restore Pin</button>'
      + (isAdminOrAbove() ? '<button data-pid="' + pid + '" onclick="hardDeletePin(this.dataset.pid)" style="background:none;border:1px solid var(--border);border-radius:6px;padding:6px 10px;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;">&#10005; Purge</button>' : '');
    return '<tr style="border-bottom:1px solid var(--border);opacity:.75;">'
      +'<td style="padding:10px 8px;"></td>'
      +'<td style="padding:12px;font-size:14px;font-weight:600;color:var(--text);">'+escHtml(shortAddr)+'<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+escHtml(addr.split(',').slice(1).join(',').trim())+'</div><div style="margin-top:3px;"><span style="background:rgba(242,92,5,.1);color:var(--accent);border:1px solid rgba(242,92,5,.3);border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;">PIN ONLY</span></div></td>'
      +'<td style="padding:12px;font-size:13px;color:var(--mid);">—</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">'+escHtml(pin.rep||'—')+'</td>'
      +'<td style="padding:12px;text-align:right;font-family:var(--font-h);font-size:16px;font-weight:700;color:var(--muted);">—</td>'
      +'<td style="padding:12px;font-size:12px;color:var(--muted);">'+date+'<div style="margin-top:4px;"><span style="background:rgba(239,68,68,.1);color:var(--danger);border:1px solid var(--danger);border-radius:4px;padding:2px 7px;font-size:10px;font-weight:700;">DELETED</span></div></td>'
      +'<td style="padding:12px;text-align:center;"><div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">'+pinActionBtns+'</div></td>'
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
  if(delBtn) delBtn.style.display = isTrash ? 'none' : '';
  if(queueBtn) queueBtn.style.display = isTrash ? 'none' : '';
  if(ghlBtn) ghlBtn.style.display = isTrash ? 'none' : '';
  if(restoreBtn) restoreBtn.style.display = isTrash ? '' : 'none';
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
  const now = new Date().toISOString();
  est.deletedAt = now;
  // Soft-delete in the estimates table (30-day recovery)
  if(sb) sb.from('estimates').update({deleted_at: now}).eq('id', estId).then(({error})=>{
    if(error) console.warn('[BidDrop] deleteEstimate:', error.message);
  });
  // Clear estimate data from the linked pin (keep pin, clear estimate)
  if(est.pinId){
    const pin = (S.pins||[]).find(p=>p.id===est.pinId);
    if(pin){ pin.estimate = null; pin.at_est = null;
      if(sb) sb.from('pins').update({estimate:null}).eq('id',est.pinId).then(()=>{});
      // Refresh map marker so popup no longer shows stale estimate badge
      if(map && markers[est.pinId]){
        if(clusterGroup) clusterGroup.removeLayer(markers[est.pinId]);
        else map.removeLayer(markers[est.pinId]);
        delete markers[est.pinId];
      }
      addMarker(pin);
    }
  }
  renderEstimatesTab();
  toast('Moved to Trash — recoverable for 30 days','info');
}
async function bulkDeleteEstimates(){
  const ids = Array.from(document.querySelectorAll('.est-row-cb:checked')).map(cb=>cb.dataset.id);
  if(!ids.length) return;
  bdConfirm('Move '+ids.length+' estimate(s) to Trash?', ()=>{
  const now = new Date().toISOString();
  ids.forEach(id=>{
    const e=(S.estimates||[]).find(x=>x.id===id);
    if(e){
      e.deletedAt = now;
      // Soft-delete in Supabase estimates table so it survives reload
      if(sb) sb.from('estimates').update({deleted_at: now}).eq('id', id).then(({error})=>{
        if(error) console.warn('[BidDrop] bulkDeleteEstimates:', error.message);
      });
      if(e.pinId){ const pin=(S.pins||[]).find(p=>p.id===e.pinId); if(pin){ pin.estimate=null; pin.at_est=null; if(sb) sb.from('pins').update({estimate:null}).eq('id',e.pinId).then(()=>{});
        // Refresh map marker so popup no longer shows stale estimate badge
        if(map && markers[e.pinId]){
          if(clusterGroup) clusterGroup.removeLayer(markers[e.pinId]);
          else map.removeLayer(markers[e.pinId]);
          delete markers[e.pinId];
        } addMarker(pin);
      } }
    }
  });
  save(); clearEstimateSelection(); renderEstimatesTab();
  toast('Moved '+ids.length+' estimate(s) to Trash','info');
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
    await sb.from('pins').delete().eq('id', pinId);
  S.pins = S.pins.filter(p=>p.id!==pinId);
  if(typeof renderEstimatesTab==='function') renderEstimatesTab();
  toast('Pin permanently deleted','info');
  }catch(e){
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
  // Restore in estimates table (clear deleted_at)
  if(sb) sb.from('estimates').update({deleted_at: null}).eq('id', estId).then(({error})=>{
    if(error) console.warn('[BidDrop] restoreEstimate:', error.message);
  });
  if(est.pinId){
    const pin = (S.pins||[]).find(p=>p.id===est.pinId);
    if(pin){ pin.estimate = {owner:est.owner,email:est.email,total:est.total,structures:est.structures}; pin.at_est = est.savedAt;
      if(sb) sb.from('pins').update({estimate:pin.estimate}).eq('id',est.pinId).then(()=>{});
    }
  }
  renderEstimatesTab();
  toast('Estimate restored','success');
}
function bulkRestoreEstimates(){
  const ids = Array.from(document.querySelectorAll('.est-row-cb:checked')).map(cb=>cb.dataset.id);
  if(!ids.length) return;
  ids.forEach(id=>{
    const e=(S.estimates||[]).find(x=>x.id===id);
    if(e){ delete e.deletedAt;
      // Restore in Supabase estimates table so it survives reload
      if(sb) sb.from('estimates').update({deleted_at: null}).eq('id', id).then(({error})=>{
        if(error) console.warn('[BidDrop] bulkRestoreEstimates:', error.message);
      });
      if(e.pinId){ const pin=(S.pins||[]).find(p=>p.id===e.pinId); if(pin){ pin.estimate={owner:e.owner,email:e.email,total:e.total,structures:e.structures}; pin.at_est=e.savedAt; if(sb) sb.from('pins').update({estimate:pin.estimate}).eq('id',e.pinId).then(()=>{}); } }
    }
  });
  save(); clearEstimateSelection(); renderEstimatesTab();
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
    const existing = (S.queue||[]).find(q=>q.addr.trim().toLowerCase()===addr && q.status==='pending');
    if(existing){ skipped++; return; }
    const pin = (S.pins||[]).find(p=>p.id===est.pinId);
    const mainStruct = (est.structures||[])[0] || {};
    const matMap = {'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
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
      status: 'pending', lobId: null, mailedAt: null,
      at: new Date().toISOString()
    };
    if(!S.queue) S.queue=[];
    S.queue.unshift(qItem);
    sbSaveQueueItem(qItem);
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

// ── Hard delete (purge from trash) ────────────────────────────────────────
function hardDeleteEstimate(estId){
  // Only admins and above can permanently delete estimates
  if(!isAdminOrAbove()){
    toast('Only admins can permanently delete estimates. Reps can only move them to Trash.','error');
    return;
  }
  bdConfirm('Permanently delete this estimate? This cannot be undone.', ()=>{
  S.estimates = (S.estimates||[]).filter(e=>e.id!==estId);
  // Hard delete from Supabase so it never comes back on reload
  if(sb) sb.from('estimates').delete().eq('id', estId).then(({error})=>{
    if(error) console.warn('[BidDrop] hardDeleteEstimate:', error.message);
  });
  save(); renderEstimatesTab();
  toast('Estimate permanently deleted','info');
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
  renderStructures(); calcP(); updatePreview();
  goTab('estimate');
  toast('📋 Loaded into Estimator — edit and save to update','info');
}
function addEstimateToMailQueue(estId){
  const est = (S.estimates||[]).find(function(e){return e.id===estId;});
  if(!est){ toast('Estimate not found','error'); return; }
  // Block duplicate pending entries for the same address
  const addr = (est.addr||'').trim().toLowerCase();
  const existing = (S.queue||[]).find(function(q){ return q.addr.trim().toLowerCase()===addr && q.status==='pending'; });
  if(existing){
    toast('\u26a0\ufe0f Already in Mail Queue — remove the existing entry first if you want to re-add','warn');
    return;
  }
  // Build a queue item from the estimate
  const pin = (S.pins||[]).find(function(p){return p.id===est.pinId;});
  const mainStruct = (est.structures||[])[0] || {};
  const matMap = {'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
  const qItem = {
    id: 'q_' + Date.now(),
    pinId: est.pinId || null,   // Fix A: store pinId so queue can look up live estimate
    estId: est.id || null,      // Fix A: store estId for direct lookup
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
    lobId: null, mailedAt: null,
    at: new Date().toISOString()
  };
  if(!S.queue) S.queue = [];
  S.queue.unshift(qItem);
  sbSaveQueueItem(qItem);
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
  loadEstimateIntoEstimator(estId);
  setTimeout(()=>{ printNow(); }, 300);
}
function downloadEstimatePDF(estId){
  // Open the estimate page in a new window and trigger print-to-PDF
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
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
  renderStructures();clearHomePhoto();calcP();updatePreview();
  window._editingQueueId=null;
  window._editingEstimateId=null;
  document.getElementById('add-queue-btn').textContent='📬 Add to Mail Queue';
}

function saveLobKey(){/* Agency model: key stored server-side */}

function renderQueue(){
  // Agency model: Lob key loaded at login, not shown in UI
  // Promote any scheduled drip items whose send date has passed
  try{ _processDripScheduleSync(); }catch(e){}
  // Auto-fire any due drip steps (fire-and-forget, only when dripEnabled)
  if(S.cfg && S.cfg.dripEnabled) autoFireDueDripSteps().catch(e=>console.warn('[BidDrop] autoFire error:',e));
  const tbody=document.getElementById('q-tbody');
  const tbl=document.getElementById('q-table');
  const empty=document.getElementById('q-empty');
  if(!S.queue.length){tbl.style.display='none';empty.style.display='block';if(typeof updateSidebarBadge==='function')updateSidebarBadge();return;}
  tbl.style.display='table';empty.style.display='none';
  const sortedQueue = _sortList([...S.queue], _qSort.col, _qSort.dir);
  _updateQSortArrows();
  tbody.innerHTML=sortedQueue.map(i=>{
    // Fix A: sync live estimate data from S.estimates so queue always shows current numbers
    if(i.status !== 'sent'){
      const liveEst = (S.estimates||[]).find(e=>
        (i.estId && e.id===i.estId) ||
        (i.pinId && e.pinId===i.pinId) ||
        (e.addr||'').trim().toLowerCase()===(i.addr||'').trim().toLowerCase()
      );
      if(liveEst){
        i.total = liveEst.total || i.total;
        i.owner = liveEst.owner || i.owner;
        i.structures = liveEst.structures || i.structures;
        const ms = (liveEst.structures||[])[0]||{};
        const mm={'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
        i.mat = mm[ms.material] || ms.material || i.mat;
      }
    }
    const sc={pending:'#F59E0B',sent:'#22C55E',failed:'#EF4444',needs_approval:'#A78BFA',approved:'#38BDF8'}[i.status]||'#3D5269';
    const sl={pending:'Pending',sent:'Mailed \u2713',failed:'Failed',needs_approval:'Needs Approval',approved:'Approved'}[i.status]||i.status;
    const qid = i.id;
    return '<tr>'+
      '<td style="text-align:center;"><input type="checkbox" class="q-row-cb" data-id="'+escHtml(qid)+'" onchange="updateQueueBulkBar()" style="cursor:pointer;width:16px;height:16px;accent-color:var(--accent);"></td>'+
      '<td style="font-weight:600;">'+escHtml(i.owner)+(i.drip_step?'<br><span style="font-size:9px;background:#7C3AED22;color:#C4B5FD;border:1px solid #7C3AED44;border-radius:10px;padding:1px 6px;font-weight:700;">📮 Drip Step '+i.drip_step+'</span>':'')+'</td>'+
      '<td style="color:var(--mid);font-size:11px;">'+escHtml(i.addr)+(i.drip_step && S.cfg && S.cfg['postcardStep'+i.drip_step] ? '<br><img src="'+S.cfg['postcardStep'+i.drip_step]+'" style="width:60px;height:40px;object-fit:cover;border-radius:4px;margin-top:3px;border:1px solid var(--border);" title="Postcard front preview">' : '')+'</td>'+
      '<td style="font-family:var(--font-m);color:var(--accent);font-weight:600;">$'+i.total.toLocaleString()+'</td>'+
      '<td style="font-size:11px;color:var(--mid);">'+escHtml(i.mat)+'</td>'+
      '<td style="font-family:var(--font-m);font-size:10px;color:var(--muted);">'+fmtDate(i.at)+'</td>'+
      '<td><span class="spill" style="background:'+sc+'22;color:'+sc+';border:1px solid '+sc+'44;">'+sl+'</span></td>'+
      '<td style="display:flex;gap:5px;align-items:center;">'+

      (i.status==='needs_approval'?'<button class="btn-xs" onclick="approveQueueItem(\''+qid+'\')" style="background:#7C3AED;border-color:#7C3AED;color:#fff;">\u2713 Approve</button>':'')+
      ((i.status==='pending'||i.status==='approved') && S.cfg.enablePostcard!==false?'<button class="btn-xs" onclick="openSendPostcardModal(\''+qid+'\')" style="background:#0e7490;border-color:#0e7490;color:#fff;" title="Send postcard">\ud83d\udcec Send Postcard</button>':'')+
      (i.status==='sent'?'<span style="font-size:10px;color:var(--muted);">'+fmtDate(i.mailedAt)+'</span>':'')+
      (i.status==='failed' && S.cfg.enablePostcard!==false?'<button class="btn-xs" onclick="sendLobPostcard6x9(\''+qid+'\')" style="background:#0e7490;border-color:#0e7490;color:#fff;">Retry Card</button>':'')+
      (i.status==='pending'?'<button class="btn-xs" onclick="editEstimate(\''+qid+'\')">✏️ Edit</button>':'')+
      '<button class="btn-xs" onclick="previewQueueItem(\''+qid+'\')"">Preview Letter</button>'+
      '<button class="btn-xs" onclick="previewPostcard6x9(\''+qid+'\')" style="background:#0e749022;border-color:#0e7490;color:#0e7490;" title="Preview postcard front & back">Preview Card</button>'+
      '<button class="btn-xs danger" onclick="rmQ(\''+qid+'\')" title="Delete">🗑 Delete</button>'+
      '</td></tr>';
  }).join('');
  // Sync sidebar queue badge
  if(typeof updateSidebarBadge === 'function') updateSidebarBadge();
}

// ── Convert full US state name to 2-letter abbreviation ─────────────────────
function toStateAbbr(s){
  if(!s) return s;
  const map={'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY'};
  const abbr = map[s.trim().toLowerCase()];
  return abbr || s.trim();
}

async function sendLob(id){
  const item=S.queue.find(x=>x.id===id);if(!item)return;
  // Agency model: always use master Lob key loaded at login
  // If not yet loaded (e.g. initial fetch failed), retry once
  if(!masterLobKey){
    toast('Checking mailer service…','info');
    await fetchMasterLobKey();
  }
  if(!masterLobKey){toast('Mailer service not configured — contact your administrator','error');return;}
  const co=S.cfg.companyName||'Your Roofing Co';
  const fromRaw=S.cfg.companyAddr||'123 Main St, Detroit, MI, 48000';
  const fp=fromRaw.split(',').map(s=>s.trim());
  const tp=item.addr.split(',').map(s=>s.trim());
  // Parse recipient address parts (handle 'line1, city, state, zip' or 'line1, city, state zip')
  const toLine1 = tp[0]||'';
  const toCity  = tp[1]||'';
  let   toState = tp[2]||'MI';
  let   toZip   = tp[3]||'';
  // Handle 'State Zip' in one field (e.g. 'Michigan 48188' when address has no 4th comma)
  if((!toZip || toZip==='00000') && toState && toState.includes(' ')){
    const parts=toState.split(' ');
    toZip=parts.pop();
    toState=parts.join(' ');
  }
  if(!toZip) toZip='00000';
  toState = toStateAbbr(toState);
  const fileHtml = buildLobMailerHtml(item);
  toast('Sending direct mail…','info');
  try{
    // Send via secure server-side proxy — Lob key never exposed in browser
    const d = await adminAPI('lob-letter', { payload: {
      description:'Roof Bid — '+item.addr,
      to:{name:item.owner,address_line1:toLine1,address_city:toCity,address_state:toState,address_zip:toZip,address_country:'US'},
      from:{name:co,address_line1:fp[0]||'123 Main St',address_city:fp[1]||'Detroit',address_state:fp[2]||'MI',address_zip:fp[3]||'48000',address_country:'US'},
      file: fileHtml,
      color: true,
      double_sided: false,
      address_placement: 'insert_blank_page',
      use_type: 'marketing'
    }});
    if(d && d.error === 'no_credits'){
      // Not enough credits — show Buy Credits modal
      toast('Not enough credits to send a letter (1 credit = $4.00). Please purchase more credits.','error');
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; }
      updateCreditBadge();
      setTimeout(()=>showBuyCreditsModal(), 800);
      return;
    }
    if(d && d.id){
      item.status='sent';item.mailedAt=new Date().toISOString();item.lobId=d.id;
      sbSaveQueueItem(item).catch(e=>console.warn('Queue save:',e));
      // Auto-unlock print for the linked estimate (free reprint since mailer was sent)
      _unlockPrintForEstimate(item.estId);
      // Update credit badge with new balance
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; updateCreditBadge(); }
      addAct('Bid letter mailed to <strong>'+escHtml(item.addr)+'</strong>','converted');
      // If this is a drip step, log it to GHL contact timeline
      if(item.drip_step) ghlAddDripNote(item.owner, item.addr, item.drip_step, item.mailedAt).catch(e=>console.warn('[GHL drip note]',e));
      // Log to mailer_log for agency billing
      if(currentAccount && sb){
        sb.from('mailer_log').insert({
          account_id: currentAccount.id,
          sent_by: currentUser?.id||null,
          address: item.addr,
          owner_name: item.owner,
          estimate_total: item.total||0,
          lob_id: d.id,
          queue_item_id: item.id,
          company_name: S.cfg.companyName||'',
          mailer_type: 'letter',
          sent_at: new Date().toISOString()
        }).then(({error})=>{ if(error) console.warn('mailer_log insert error:',error.message); });
        // Also mark the linked estimate as sent so the badge shows in the Estimates list
        if(item.estId){
          const sentNow = new Date().toISOString();
          const estIdx = (S.estimates||[]).findIndex(e=>e.id===item.estId);
          if(estIdx>=0){ S.estimates[estIdx].sentAt = sentNow; }
          sb.from('estimates').update({sent_at:sentNow}).eq('id',item.estId).then(({error})=>{if(error)console.warn('estimate sent_at:',error.message);});
        }
      }
      save();renderQueue();toast('✅ Letter queued for mailing!','success');
    } else {
      item.status='failed';save();renderQueue();toast('Mail error: '+(d.error?.message||'Check mail settings & address'),'error');
    }
  } catch(e){item.status='failed';save();renderQueue();toast('Network error — mailer service unavailable','error');}
}

// ─────────────────────────────────────────────────────────────────────────────
//  6×9 Postcard — Front & Back HTML builders + send function
// ─────────────────────────────────────────────────────────────────────────────
async function sendLobPostcard6x9(id){
  const item=S.queue.find(x=>x.id===id);if(!item)return;
  if(!masterLobKey){
    toast('Checking mailer service…','info');
    await fetchMasterLobKey();
  }
  if(!masterLobKey){toast('Mailer service not configured — contact your administrator','error');return;}
  const co=S.cfg.companyName||'Your Roofing Co';
  const fromRaw=S.cfg.companyAddr||'123 Main St, Detroit, MI, 48000';
  const fp=fromRaw.split(',').map(s=>s.trim());
  // Parse recipient address
  const tp=item.addr.split(',').map(s=>s.trim());
  const toLine1=tp[0]||'';
  const toCity=tp[1]||'';
  let toState=tp[2]||'MI';
  let toZip=tp[3]||'';
  if((!toZip||toZip==='00000')&&toState&&toState.includes(' ')){
    const parts=toState.split(' ');toZip=parts.pop();toState=parts.join(' ');
  }
  if(!toZip)toZip='00000';
  toState=toStateAbbr(toState);
  // Parse from address — handle 'City State Zip' in one field (e.g. 'Detroit MI 48227')
  let fromCity=fp[1]||'Detroit';
  let fromState=fp[2]||'MI';
  let fromZip=fp[3]||'';
  if((!fromZip||fromZip==='00000')&&fromState&&fromState.includes(' ')){
    const parts=fromState.split(' ');fromZip=parts.pop();fromState=parts.join(' ');
  }
  if(!fromZip)fromZip='48000';
  fromState=toStateAbbr(fromState);
  // Build a synthetic item with all config fields for the canvas builders
  const syntheticItem=Object.assign({},item,{
    companyName:co,companyAddr:fromRaw,companyPhone:S.cfg.companyPhone||'',
    logoData:S.cfg.logoData||'',headshotData:S.cfg.headshotData||'',
    repName:S.cfg.repName||'',repTitle:S.cfg.repTitle||'',
    pcHook:S.cfg.pcHook||'',pcWhy:S.cfg.pcWhy||'',pcQuote:S.cfg.pcQuote||'',
    pcGuarantee:S.cfg.pcGuarantee||'',
    diff1:S.cfg.diff1||'',diff2:S.cfg.diff2||'',diff3:S.cfg.diff3||'',
    diff4:S.cfg.diff4||'',diff5:S.cfg.diff5||'',diff6:S.cfg.diff6||'',
    yrsInBusiness:S.cfg.yrsInBusiness||'',warrantyYrs:S.cfg.warrantyYrs||'',
    finEnabled:S.cfg.finEnabled,finApr:S.cfg.finApr,finTerm:S.cfg.finTerm,finDown:S.cfg.finDown,
    bookingUrl:S.cfg.bookingUrl||''
  });
  toast('Rendering postcard images…','info');
  // Render front & back to JPEG via canvas, upload to Supabase, send URLs to Lob
  let frontUrl, backUrl;
  try{
    const ts=Date.now();
    const acctId=(currentAccount&&currentAccount.id)||'shared';
    const [fDataUrl,bDataUrl]=await Promise.all([
      renderFrontCanvasForDesign(syntheticItem),
      renderPostcard6x9BackCanvas(syntheticItem)
    ]);
    if(!fDataUrl||!bDataUrl){toast('Failed to render postcard images','error');return;}
    // Upload both JPEGs via server-side API
    const session=await sb.auth.getSession();
    const jwt=session?.data?.session?.access_token;
    const uploadJpeg=async(dataUrl,name)=>{
      const resp=await fetch('/api/admin?action=upload-photo',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+jwt},
        body:JSON.stringify({path:acctId+'/postcards/'+name,dataUrl,mimeType:'image/jpeg'})
      });
      if(!resp.ok)throw new Error('Upload failed: '+resp.status);
      const r=await resp.json();
      return r.url;
    };
    [frontUrl,backUrl]=await Promise.all([
      uploadJpeg(fDataUrl,'front_'+ts+'.jpg'),
      uploadJpeg(bDataUrl,'back_'+ts+'.jpg')
    ]);
    if(!frontUrl||!backUrl){toast('Failed to upload postcard images','error');return;}
  }catch(renderErr){
    toast('Postcard render error: '+renderErr.message,'error');
    return;
  }
  toast('Sending postcard…','info');
  try{
    const d=await adminAPI('lob-postcard',{payload:{
      description:'Roof Bid Postcard — '+item.addr,
      to:{name:item.owner||'Homeowner',address_line1:toLine1,address_city:toCity,address_state:toState,address_zip:toZip,address_country:'US'},
      from:{name:co,address_line1:fp[0]||'123 Main St',address_city:fromCity,address_state:fromState,address_zip:fromZip,address_country:'US'},
      front:frontUrl,
      back:backUrl,
      size:'6x9',
      use_type:'marketing'
    }});
    if(d&&d.error==='no_credits'){
      toast('Not enough credits to send a postcard (1 credit = $4.00). Please purchase more credits.','error');
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; }
      updateCreditBadge();
      setTimeout(()=>showBuyCreditsModal(),800);
      return;
    }
    if(d&&d.id){
      item.status='sent';item.mailedAt=new Date().toISOString();item.lobId=d.id;
      sbSaveQueueItem(item).catch(e=>console.warn('Queue save:',e));
      // Auto-unlock print for the linked estimate
      _unlockPrintForEstimate(item.estId);
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; updateCreditBadge(); }
      addAct('6×9 postcard mailed to <strong>'+escHtml(item.addr)+'</strong>','converted');
      if(currentAccount&&sb){
        sb.from('mailer_log').insert({
          account_id:currentAccount.id,
          sent_by:currentUser?.id||null,
          address:item.addr,
          owner_name:item.owner,
          estimate_total:item.total||0,
          lob_id:d.id,
          queue_item_id:item.id,
          company_name:S.cfg.companyName||'',
          mailer_type:'postcard',
          sent_at:new Date().toISOString()
        }).then(({error})=>{if(error)console.warn('mailer_log insert:',error.message);});
        // Also mark the linked estimate as sent so the badge shows in the Estimates list
        if(item.estId){
          const sentNow = new Date().toISOString();
          const estIdx = (S.estimates||[]).findIndex(e=>e.id===item.estId);
          if(estIdx>=0){ S.estimates[estIdx].sentAt = sentNow; }
          sb.from('estimates').update({sent_at:sentNow}).eq('id',item.estId).then(({error})=>{if(error)console.warn('estimate sent_at:',error.message);});
        }
      }
      save();renderQueue();toast('✅ Postcard queued for mailing!','success');
    } else {
      item.status='failed';save();renderQueue();
      const errMsg=typeof d?.error==='string'?d.error:(d?.error?.message||d?.error?.status_code||JSON.stringify(d?.error)||'Check mail settings & address');
      toast('Postcard error: '+errMsg,'error');
    }
  } catch(e){
    item.status='failed';save();renderQueue();
    const msg=typeof e?.message==='string'?e.message:(typeof e==='object'?JSON.stringify(e):String(e));
    toast('Postcard error: '+msg,'error');
  }}
// ─── Canvas-based JPEG renderers for Lob (no HTML renderer dependency) ───────
// Helper: load an image URL as an Image element (handles CORS)


async function sendAllPending(){
  const pend=S.queue.filter(i=>i.status==='pending');
  if(!pend.length){toast('No pending items','info');return;}
  toast('Sending '+pend.length+' letters…','info');
  for(const i of pend){await sendLob(i.id);await sleep(600);}
}

async function rmQ(id){
  bdConfirm('Delete this estimate?', async ()=>{
  // Delete from Supabase first
  if(currentAccount && sb){
    const {error} = await sb.from('queue').delete().eq('id', id);
    if(error){ toast('Delete failed: '+error.message,'error'); return; }
  }
  S.queue=S.queue.filter(x=>x.id!==id);
  save();renderQueue();toast('🗑 Estimate deleted','info');
  }); // end bdConfirm
}
function toggleAllQueueSelect(checked){
  document.querySelectorAll('.q-row-cb').forEach(function(cb){cb.checked=checked;});
  updateQueueBulkBar();
}
function updateQueueBulkBar(){
  const cbs = document.querySelectorAll('.q-row-cb:checked');
  const bar = document.getElementById('q-bulk-bar');
  const cnt = document.getElementById('q-selected-count');
  const all = document.getElementById('q-select-all');
  const total = document.querySelectorAll('.q-row-cb').length;
  if(bar) bar.style.display = cbs.length ? 'flex' : 'none';
  if(cnt) cnt.textContent = cbs.length + ' selected';
  if(all) all.indeterminate = cbs.length > 0 && cbs.length < total;
  if(all && cbs.length === total && total > 0) all.checked = true;
}
function clearQueueSelection(){
  document.querySelectorAll('.q-row-cb').forEach(function(cb){cb.checked=false;});
  const all = document.getElementById('q-select-all');
  if(all){all.checked=false;all.indeterminate=false;}
  updateQueueBulkBar();
}
async function bulkDeleteQueue(){
  const ids = Array.from(document.querySelectorAll('.q-row-cb:checked')).map(function(cb){return cb.dataset.id;});
  if(!ids.length) return;
  bdConfirm('Delete ' + ids.length + ' selected item' + (ids.length>1?'s':'') + '?', async ()=>{
  // Delete from Supabase first
  if(currentAccount && sb){
    const {error} = await sb.from('queue').delete().in('id', ids);
    if(error){ toast('Delete failed: '+error.message,'error'); return; }
  }
  S.queue = S.queue.filter(function(x){return !ids.includes(x.id);});
  save(); renderQueue(); toast('🗑 Deleted ' + ids.length + ' item' + (ids.length>1?'s':''), 'info');
  }); // end bdConfirm
}

function previewQueueItem(id){
  const item=S.queue.find(x=>x.id===id);if(!item)return;
  // Generate mailer HTML by temporarily loading queue item into estimator
  const savedOwner=document.getElementById('e-owner').value;
  const savedAddr=document.getElementById('e-addr').value;
  const savedPhoto=window._homePhotoData;
  const savedStructures=JSON.parse(JSON.stringify(structures));
  document.getElementById('e-owner').value=item.owner||'';
  document.getElementById('e-addr').value=item.addr||'';
  if(item.structures&&item.structures.length){structures=JSON.parse(JSON.stringify(item.structures));}
  window._homePhotoData=item.photo_data||item.photo_url||null;
  calcP();updatePreview();
  const mailerEl=document.getElementById('mailer-preview');
  const mailerHtml=mailerEl?mailerEl.innerHTML:'';
  // Restore estimator state
  document.getElementById('e-owner').value=savedOwner;
  document.getElementById('e-addr').value=savedAddr;
  window._homePhotoData=savedPhoto;
  structures=savedStructures;
  calcP();updatePreview();
  window._previewingQueueId=id;
  // ── Full-screen modal above nav bar (same pattern as postcard preview) ──
  const existing=document.getElementById('m-letter-preview-modal');
  if(existing) existing.remove();
  const modal=document.createElement('div');
  modal.id='m-letter-preview-modal';
  modal.style.cssText=[
    'position:fixed;inset:0;z-index:10100;',
    'background:rgba(5,10,20,0.95);',
    'display:flex;flex-direction:column;align-items:center;',
    'overflow-y:auto;padding:20px 16px 40px;',
    '-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);'
  ].join('');
  modal.innerHTML=`
    <div style="width:100%;max-width:760px;display:flex;align-items:center;justify-content:space-between;
                margin-bottom:16px;flex-shrink:0;">
      <div>
        <div style="font-family:Oswald,sans-serif;font-size:18px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;">
          &#128065; Letter Preview
        </div>
        <div style="font-size:12px;color:#6688A8;margin-top:2px;">
          ${escHtml(item.owner||'Homeowner')} &mdash; ${escHtml(item.addr||'')}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0;">
        <button onclick="printQueuePreview()"
          style="background:#1f3d68;border:1px solid #2E4060;color:#C8D8E8;font-size:13px;font-weight:700;
                 padding:9px 16px;border-radius:8px;cursor:pointer;white-space:nowrap;">
          &#128424; Print
        </button>
        <button onclick="document.getElementById('m-letter-preview-modal').remove()"
          style="background:#1e2d42;border:1px solid #2E4060;color:#C8D8E8;font-size:13px;font-weight:700;
                 padding:9px 20px;border-radius:8px;cursor:pointer;white-space:nowrap;"
          onmouseover="this.style.background='#F25C05';this.style.borderColor='#F25C05';this.style.color='#fff';"
          onmouseout="this.style.background='#1e2d42';this.style.borderColor='#2E4060';this.style.color='#C8D8E8';">
          &times; Close
        </button>
      </div>
    </div>
    <div id="letter-preview-pages" style="width:100%;max-width:760px;display:flex;flex-direction:column;gap:24px;">
      ${mailerHtml}
    </div>`;
  document.body.appendChild(modal);
  // Scale each ml-page to fit the container width
  setTimeout(function(){
    const container = modal.querySelector('#letter-preview-pages');
    if(!container) return;
    const pages = container.querySelectorAll('.ml-page');
    const containerW = container.offsetWidth;
    // 7.5in at 96dpi = 720px
    const pageNativeW = 720;
    const scale = Math.min(1, containerW / pageNativeW);
    pages.forEach(function(page){
      page.style.transformOrigin = 'top left';
      page.style.transform = 'scale(' + scale + ')';
      page.style.marginBottom = Math.round((page.offsetHeight * scale) - page.offsetHeight) + 'px';
      // Wrap each page in a sized container so layout flows correctly
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:' + Math.round(pageNativeW * scale) + 'px;height:' + Math.round(page.offsetHeight * scale) + 'px;overflow:hidden;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
      page.parentNode.insertBefore(wrapper, page);
      wrapper.appendChild(page);
      page.style.marginBottom = '0';
    });
  }, 60);
  // Also keep queue-preview-content in sync for printQueuePreview()
  const qpc=document.getElementById('queue-preview-content');
  if(qpc) qpc.innerHTML=mailerHtml;
  modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
  function _ltrEsc(e){if(e.key==='Escape'){modal.remove();document.removeEventListener('keydown',_ltrEsc);}}
  document.addEventListener('keydown',_ltrEsc);
}
// Preview the 6x9 postcard front and back in a modal
async function previewPostcard6x9(id){
  const item = S.queue.find(x=>x.id===id); if(!item) return;
  let photoUrl = item.photo_url || item.photo_data || null;
  if(!photoUrl){
    const ap = item.all_photos || {};
    const fp = (ap.front||[])[0] || null;
    if(fp) photoUrl = fp;
  }
  if(!photoUrl){
    try{
      const MB = window._mapboxToken || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
      const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(item.addr)+'.json?country=us&types=address&limit=1&access_token='+MB);
      const geoData = await geoRes.json();
      if(geoData.features && geoData.features[0]){
        const [lon, lat] = geoData.features[0].center;
        photoUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;
      }
    } catch(e){ console.warn('[BidDrop] Geocode for postcard preview failed:', e); }
  }
  // Resolve estimate ID: queue items store estId; fall back to address lookup in S.estimates
  const _qEstId = item.estId || item.estimate_id ||
    ((S.estimates||[]).find(e=>(e.addr||'').trim().toLowerCase()===(item.addr||'').trim().toLowerCase()) || {}).id || null;
  const _qSlug = (S.cfg&&S.cfg.companyName)
    ? S.cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
    : 'roofing';
  const syntheticItem = {
    id:         _qEstId,
    slug:       _qSlug,
    addr:       item.addr  || '',
    owner:      item.owner || 'Homeowner',
    total:      item.total || 0,
    finMo:      item.finMo || 0,
    photo_url:  (photoUrl && photoUrl.startsWith('http')) ? photoUrl : null,
    photo_data: (photoUrl && !photoUrl.startsWith('http')) ? photoUrl : null,
  };
  await _showPostcardCanvasModal('m-postcard6x9-preview', item.owner||'Homeowner', item.addr||'', syntheticItem);
}

function printQueuePreview(){
  const content=document.getElementById('queue-preview-content');
  if(!content)return;
  const w=window.open('','_blank');
  w.document.write('<html><head><title>Mailer Preview</title><style>'+
    'body{margin:0;padding:0;background:#fff;}'+
    '@media print{@page{size:letter;margin:0.5in;}.ml-page{page-break-after:always;width:7.5in !important;height:10in !important;max-height:10in !important;overflow:hidden !important;box-shadow:none !important;}.ml-page:last-child{page-break-after:avoid;}}'+
    // Copy all styles from parent
    Array.from(document.styleSheets).map(function(ss){try{return Array.from(ss.cssRules).map(function(r){return r.cssText;}).join('\n');}catch(e){return '';}}).join('\n')+
    '</style></head><body>'+content.innerHTML+'</body></html>');
  w.document.close();
  w.focus();
  setTimeout(function(){w.print();},600);
}
function editEstimate(id){
  const item=S.queue.find(x=>x.id===id);if(!item)return;
  // Fix E: try to find the linked estimate in S.estimates and load it properly
  const linkedEst = (S.estimates||[]).find(e=>
    (item.pinId && e.pinId===item.pinId) ||
    (e.addr||'').trim().toLowerCase()===(item.addr||'').trim().toLowerCase()
  );
  if(linkedEst){
    // Use the full loadEstimateIntoEstimator flow so currentEstPinId is set
    loadEstimateIntoEstimator(linkedEst.id);
    window._editingQueueId = id;
    document.getElementById('add-queue-btn').textContent='✅ Update Estimate';
    return;
  }
  // Fallback: load directly from queue item
  document.getElementById('e-owner').value=item.owner||'';
  document.getElementById('e-addr').value=item.addr||'';
  if(item.structures&&item.structures.length){
    structures=JSON.parse(JSON.stringify(item.structures));
  } else {
    structures=[{id:'s'+Date.now(),name:'Main House',sqft:item.sqft||0,pitch:'1.202',mat:'1.3',stories:'1',complexity:'1.12'}];
  }
  if(item.photo_data){
    window._homePhotoData=item.photo_data;
    const prev=document.getElementById('home-photo-preview');
    const btn=document.getElementById('clear-photo-btn');
    if(prev){prev.innerHTML='<img src="'+item.photo_data+'" style="width:100%;height:100%;object-fit:cover;">';}
    if(btn){btn.style.display='block';}
  } else {
    window._homePhotoData=null;
  }
  // Set currentEstPinId from queue item if available
  if(item.pinId) currentEstPinId = item.pinId;
  window._editingQueueId=id;
  renderStructures();goTab('estimate');calcP();updatePreview();
  document.getElementById('add-queue-btn').textContent='✅ Update Estimate';
  toast('✏️ Editing estimate — make changes and hit Update','info');
}

