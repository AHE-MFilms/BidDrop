// ── SEND POSTCARD CHOICE MODAL ───────────────────────────────────────────────
let _spmQueueId = null;
let _spmChoice  = null;

function openSendPostcardModal(queueId){
  _spmQueueId = queueId;
  _spmChoice  = null;
  window._spmDesign = null; // reset design selection
  const item = (S.queue||[]).find(x=>x.id===queueId);
  const lbl = document.getElementById('spm-homeowner');
  if(lbl && item) lbl.textContent = (item.owner||'Homeowner') + ' — ' + (item.addr||'');
  // Show credit cost for single send — 0 if paid by unlock, 1 otherwise
  // Fallback: also check item.id prefix in case source column hasn't loaded yet
  const paidByUnlock = item && (item.source === 'unlock' || (item.id && item.id.startsWith('mq_unlock_')));
  const singleCostEl = document.getElementById('spm-single-cost');
  if(singleCostEl){
    singleCostEl.textContent = paidByUnlock ? '0 credits — included with unlock' : '1 credit';
    singleCostEl.style.color = paidByUnlock ? '#4ade80' : 'var(--accent)';
  }
  // Store for use in spmSelect
  window._spmPaidByUnlock = paidByUnlock;
  // Reset selection state
  ['single','blitz'].forEach(k=>{
    const el = document.getElementById('spm-opt-'+k);
    if(el){ el.style.borderColor='var(--border)'; el.style.background=''; }
  });
  const btn = document.getElementById('spm-confirm-btn');
  if(btn){ btn.textContent='Select an option above'; btn.style.opacity='.4'; btn.style.pointerEvents='none'; btn.style.background='var(--accent)'; }
  // Reset design row to Standard
  _spmUpdateDesignRow(null);
  // Show/hide promo badge based on platform promo config
  updateBlitzPromoBadge();
  openM('m-send-postcard');
}
function _spmUpdateDesignRow(design){
  const nameEl = document.getElementById('spm-design-name');
  const noteEl = document.getElementById('spm-design-back-note');
  const thumbEl = document.getElementById('spm-design-thumb');
  if(!nameEl) return;
  if(!design){
    nameEl.textContent = 'Standard (Account Default)';
    noteEl.textContent = 'Uses your account back text';
    thumbEl.innerHTML = '<span style="font-size:16px;">&#128203;</span>';
  } else {
    nameEl.textContent = design.name || 'Custom Design';
    noteEl.textContent = design.backOverrides && Object.keys(design.backOverrides).length
      ? '✓ Custom back text included'
      : 'Uses account back text';
    if(design.url){
      thumbEl.innerHTML = '<img src="'+design.url+'" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      thumbEl.innerHTML = '<span style="font-size:16px;">&#127912;</span>';
    }
  }
}
function spmPickDesign(){
  if(typeof openDesignPicker === 'function'){
    openDesignPicker(function(design){
      window._spmDesign = design || null;
      _spmUpdateDesignRow(design || null);
    }, window._spmDesign ? window._spmDesign.id : null);
  }
}

function spmSelect(choice){
  _spmChoice = choice;
  ['single','blitz'].forEach(k=>{
    const el = document.getElementById('spm-opt-'+k);
    if(!el) return;
    if(k===choice){
      el.style.borderColor = choice==='blitz' ? '#a855f7' : 'var(--accent)';
      el.style.background  = choice==='blitz' ? 'rgba(168,85,247,.08)' : 'rgba(249,115,22,.08)';
    } else {
      el.style.borderColor='var(--border)'; el.style.background='';
    }
  });
  const btn = document.getElementById('spm-confirm-btn');
  if(btn){
    if(choice==='single'){
      btn.textContent = window._spmPaidByUnlock ? '🏠 Send Postcard — FREE (included with unlock)' : '🏠 Send 1 Postcard — 1 Credit';
      btn.style.background='var(--accent)';
    } else {
      btn.textContent='🔥 Start Follow-Up Blitz — 3 Credits (5 Postcards Total)';
      btn.style.background='#7C3AED';
    }
    btn.style.opacity='1'; btn.style.pointerEvents='auto';
  }
}

function spmConfirm(){
  if(!_spmChoice || !_spmQueueId) return;
  closeM('m-send-postcard');
  // Apply design settings to the queue item so sendLobPostcard6x9 can use them
  const design = window._spmDesign;
  const item = (S.queue||[]).find(x=>x.id===_spmQueueId);
  if(design){
    if(item){
      item._sendDesignId = design.id;
      item._sendDesignUrl = design.url || null;
      // Custom back: pass backUrl for renderCustomBackCanvas
      if(design.backUrl){
        item._sendDesignBackUrl = design.backUrl;
        item._sendBackOverrides = null;
      } else if(design.backOverrides && Object.keys(design.backOverrides).length){
        item._sendDesignBackUrl = null;
        item._sendBackOverrides = design.backOverrides;
      } else {
        item._sendDesignBackUrl = null;
        item._sendBackOverrides = null;
      }
    }
  } else {
    if(item){ delete item._sendDesignId; delete item._sendDesignUrl; delete item._sendBackOverrides; delete item._sendDesignBackUrl; }
  }
  if(_spmChoice==='single'){
    sendLobPostcard6x9(_spmQueueId);
  } else {
    openBlitzFromQueue(_spmQueueId);
  }
}


