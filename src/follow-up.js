// src/follow-up.js
// Homeowner follow-up modal — open, send SMS/email, template tokens.
// Depends on: sb, S.pins, S.cfg, currentAccount, adminAPI(), toast()
// Extracted from index.html — Tier 3 modularization

function openFollowUp(pinId){
  const p=S.pins.find(x=>x.id===pinId);
  if(!p) return;
  document.getElementById('fu-pin-id').value=pinId;
  // Pre-fill from estimate if available
  const est = p.estimate ? (typeof p.estimate==='string'?JSON.parse(p.estimate):p.estimate) : {};
  document.getElementById('fu-name').value = est.owner||'';
  document.getElementById('fu-email').value = est.email||'';
  document.getElementById('fu-phone').value = p.phone||'';
  // Pre-fill message template
  const rep = p.rep||currentProfile?.name||'';
  const company = S.cfg.companyName||'our company';
  const addr = (p.address||'').split(',')[0];
  const initTpl = S.cfg.ghlSmsTpl || DEFAULTS.ghlSmsTpl;
  document.getElementById('fu-message').value = applyFuTokens(initTpl, est.owner||'there', rep, company, addr);
  openM('m-follow-up');
}
function applyFuTokens(tpl, name, rep, company, addr){
  return tpl
    .replace(/\{name\}/g, name)
    .replace(/\{rep\}/g, rep)
    .replace(/\{company\}/g, company)
    .replace(/\{address\}/g, addr);
}
function insertFuTemplate(type){
  const name = document.getElementById('fu-name').value||'there';
  const rep = currentProfile?.name || S.cfg.repName || 'your rep';
  const company = S.cfg.companyName||'our company';
  const pinId = document.getElementById('fu-pin-id').value;
  const p = S.pins.find(x=>x.id===pinId)||{};
  const addr = (p.address||'').split(',')[0];
  if(type==='sms'){
    const tpl = S.cfg.ghlSmsTpl || DEFAULTS.ghlSmsTpl;
    document.getElementById('fu-message').value = applyFuTokens(tpl, name, rep, company, addr);
  } else {
    const tpl = S.cfg.ghlEmailTpl || DEFAULTS.ghlEmailTpl;
    document.getElementById('fu-message').value = applyFuTokens(tpl, name, rep, company, addr);
  }
}
async function sendFollowUp(){
  const pinId = document.getElementById('fu-pin-id').value;
  const name  = document.getElementById('fu-name').value.trim();
  const phone = document.getElementById('fu-phone').value.trim();
  const email = document.getElementById('fu-email').value.trim();
  const msg   = document.getElementById('fu-message').value.trim();
  if(!msg){toast('Enter a message to send','error');return;}
  if(!phone&&!email){toast('Enter a phone or email to send to','error');return;}
  const btn = document.querySelector('#m-follow-up .btn-ok');
  if(btn){btn.textContent='Sending…';btn.disabled=true;}
  try{
    // Create/find contact in GHL then send message — proxied through secure server API
    const contactPayload={firstName:name.split(' ')[0]||name,lastName:name.split(' ').slice(1).join(' ')||'',email:email||undefined,phone:phone||undefined};
    const cData = await adminAPI('ghl', { path:'/contacts/', method:'POST', body:contactPayload });
    const contactId = cData.contact?.id||cData.id;
    if(contactId && phone){
      await adminAPI('ghl', { path:'/conversations/messages', method:'POST', body:{type:'SMS',contactId,message:msg} });
    }
    if(contactId && email){
      await adminAPI('ghl', { path:'/conversations/messages', method:'POST', body:{type:'Email',contactId,subject:'Following Up About Your Roof',message:msg,html:'<p>'+msg.replace(/\n/g,'<br>')+'</p>'} });
    }
    // Log activity
    addAct('Follow-up sent to <strong>'+escHtml(name||email||phone)+'</strong> for '+escHtml((S.pins.find(x=>x.id===pinId)||{}).address||''),'bid_sent');
    closeM('m-follow-up');
    toast('✅ Follow-up sent!','success');
  } catch(e){
    toast('Send failed: '+e.message,'error');
  } finally {
    if(btn){btn.textContent='Send Follow-Up';btn.disabled=false;}
  }
}

async function rmPin(id){
  bdConfirm('Move this pin to Trash?', async ()=>{
    try{
      await sbDeletePin(id);
    }catch(e){
      toast('Delete failed: '+e.message,'error');
      return;
    }
    const pin = S.pins.find(p=>p.id===id);
    if(pin) pin.deleted_at = new Date().toISOString();
    const _now = new Date().toISOString();
    (S.estimates||[]).filter(e=>e.pinId===id && !e.deletedAt).forEach(e=>{
      e.deletedAt = _now;
      if(sb) sb.from('estimates').update({deleted_at:_now}).eq('id',e.id).then(()=>{});
    });
    if(markers[id]){
      if(clusterGroup) clusterGroup.removeLayer(markers[id]);
      else map.removeLayer(markers[id]);
      delete markers[id];
    }
    renderPinList();
    if(typeof renderEstimatesTab==='function') renderEstimatesTab();
    save();
    toast('Pin moved to Trash — recoverable for 30 days','info');
  });
}

function confirmDeletePin(id){
  const pin=S.pins.find(p=>p.id===id);if(!pin)return;
  map.closePopup();
  document.getElementById('dpin-addr').textContent=pin.address||'this pin';
  document.getElementById('dpin-id').value=id;
  openM('m-delete-pin');
}

async function doDeletePin(){
  const id=document.getElementById('dpin-id').value;
  try{
    await sbDeletePin(id);
  }catch(e){
    toast('Delete failed: '+e.message,'error');
    return;
  }
  // Soft-delete in memory
  const _dp = S.pins.find(p=>p.id===id);
  if(_dp) _dp.deleted_at = new Date().toISOString();
  // Cascade soft-delete: also soft-delete all linked estimates
  const _dpNow = new Date().toISOString();
  (S.estimates||[]).filter(e=>e.pinId===id && !e.deletedAt).forEach(e=>{
    e.deletedAt = _dpNow;
    if(sb) sb.from('estimates').update({deleted_at:_dpNow}).eq('id',e.id).then(()=>{});
  });
  if(markers[id]){
    if(clusterGroup) clusterGroup.removeLayer(markers[id]);
    else map.removeLayer(markers[id]);
    delete markers[id];
  }
  closeM('m-delete-pin');renderPinList();refreshZoneOverlays();if(typeof renderEstimatesTab==='function') renderEstimatesTab();save();toast('🗑 Pin deleted','info');
}

function cycleStatus(id){
  const p=S.pins.find(x=>x.id===id);if(!p)return;
  const opts=['pinned','mailed','emailed','called','responded','quoted','signed','not_interested'];
  p.status=opts[(opts.indexOf(p.status)+1)%opts.length];
  if(markers[id]){
    if(clusterGroup) clusterGroup.removeLayer(markers[id]);
    else map.removeLayer(markers[id]);
    delete markers[id];
  }
  addMarker(p);renderPinList();refreshZoneOverlays();
  sbUpdatePinStatus(id,p.status).catch(e=>console.error('Status:',e));
  // Sync status change to GHL (fire-and-forget)
  ghlSyncPinStatus(p).catch(e=>console.warn('GHL sync:',e));
  save();toast('Status → '+sLabel(p.status),'info');
  // ── Auto-prompt Nearby Campaign when a job is marked Signed ──
  if(p.status==='signed') _promptSignedNearbyCampaign(id);
}

// Render email/phone dropdowns in estimate builder from Tracerfy contactData
function _renderContactDropdowns(p){
  const cd = p && p.contactData;
  const emailWrap = document.getElementById('e-email-wrap');
  const phoneWrap = document.getElementById('e-phone-wrap');
  const curEmail = (document.getElementById('e-email')||{}).value||'';
  const curPhone = (document.getElementById('e-phone')||{}).value||'';
  const fi = 'width:100%;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:9px 11px;color:var(--fg);font-size:13px;font-family:inherit;outline:none;';
  if(emailWrap){
    const emails = cd && cd.emails && cd.emails.length ? cd.emails : null;
    if(emails && emails.length > 1){
      const sel = document.createElement('select');
      sel.id = 'e-email'; sel.style.cssText = fi;
      const blank = document.createElement('option'); blank.value=''; blank.textContent='— select email —'; sel.appendChild(blank);
      emails.forEach(function(em){
        const e = typeof em === 'string' ? em : (em.email||em.address||String(em));
        const opt = document.createElement('option'); opt.value=e; opt.textContent=e;
        if(e===curEmail) opt.selected=true;
        sel.appendChild(opt);
      });
      if(!curEmail && emails.length) sel.value = typeof emails[0]==='string'?emails[0]:(emails[0].email||emails[0].address||'');
      emailWrap.innerHTML=''; emailWrap.appendChild(sel);
    } else {
      // Single or no email — use plain input
      emailWrap.innerHTML = '<input class="fi" id="e-email" placeholder="jane@email.com" type="email" style="width:100%;">';
      const inp = document.getElementById('e-email');
      if(curEmail) inp.value = curEmail;
      else if(emails && emails.length){
        const e = typeof emails[0]==='string'?emails[0]:(emails[0].email||emails[0].address||'');
        inp.value = e;
      }
    }
  }
  if(phoneWrap){
    const phones = cd && cd.phones && cd.phones.length ? cd.phones : null;
    function fmtPhone(n){ const d=(n||'').replace(/\D/g,''); return d.length===10?'('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6):n; }
    if(phones && phones.length > 1){
      const sel = document.createElement('select');
      sel.id = 'e-phone'; sel.style.cssText = fi;
      const blank = document.createElement('option'); blank.value=''; blank.textContent='— select phone —'; sel.appendChild(blank);
      phones.forEach(function(ph){
        const num = fmtPhone(ph.number||ph);
        const raw = (ph.number||ph||'').replace(/\D/g,'');
        const label = num + (ph.type?' · '+ph.type:'') + (ph.dnc?' ⚠ DNC':'');
        const opt = document.createElement('option'); opt.value=num; opt.textContent=label;
        if(num===curPhone||raw===curPhone.replace(/\D/g,'')) opt.selected=true;
        sel.appendChild(opt);
      });
      if(!curPhone){
        const best = phones.find(function(ph){return !ph.dnc;}) || phones[0];
        sel.value = fmtPhone(best.number||best);
      }
      phoneWrap.innerHTML=''; phoneWrap.appendChild(sel);
    } else {
      phoneWrap.innerHTML = '<input class="fi" id="e-phone" placeholder="(555) 000-0000" type="tel" style="width:100%;">';
      const inp = document.getElementById('e-phone');
      if(curPhone) inp.value = curPhone;
      else if(phones && phones.length) inp.value = fmtPhone(phones[0].number||phones[0]);
    }
  }
}

function goEstFromPin(id){
  const p=S.pins.find(x=>x.id===id);if(!p)return;
  currentEstPinId = id;
  // ── SOURCE OF TRUTH: prefer S.estimates (estimates table) over pin.estimate JSONB ──
  // The estimates table is always more up-to-date than the JSONB field on the pin.
  const savedEst = (S.estimates||[]).find(e=>e.pinId===id && !e.deletedAt && !e.isRevision);
  const legacyEst = p.estimate ? (typeof p.estimate==='string'?JSON.parse(p.estimate):p.estimate) : null;
  const est = savedEst || legacyEst; // prefer estimates table
  // Reset form
  document.getElementById('e-owner').value = '';
  document.getElementById('e-email').value = '';
  if(document.getElementById('e-phone')) document.getElementById('e-phone').value = '';
  document.getElementById('e-addr').value = p.address||'';
  structures = [{id:'s1',name:'Main House',sqft:0,stories:'1',pitch:'1.118',mat:'1.3',complexity:'1.12',pts:null}];
  if(est){
    if(est.owner) document.getElementById('e-owner').value = est.owner;
    if(est.email) document.getElementById('e-email').value = est.email;
    if(est.phone && document.getElementById('e-phone')) document.getElementById('e-phone').value = est.phone;
    // Fill owner name from Tracerfy if still empty
    if(p.contactData && !document.getElementById('e-owner').value && p.contactData.ownerName)
      document.getElementById('e-owner').value = p.contactData.ownerName;
    if(est.structures && est.structures.length) structures = est.structures.map(s=>normStruct(s));
    if(savedEst){
      // Restore add-ons from estimates table record
      const sky=document.getElementById('a-sky'); if(sky) sky.checked=!!savedEst.skylight;
      const skyQ=document.getElementById('a-sky-q'); if(skyQ) skyQ.value=savedEst.skylightQty||1;
      const chim=document.getElementById('a-chim'); if(chim) chim.checked=!!savedEst.chimney;
      const gut=document.getElementById('a-gut'); if(gut) gut.checked=!!savedEst.gutters;
      const gutQ=document.getElementById('a-gut-q'); if(gutQ) gutQ.value=savedEst.gutterLf||120;
      const iwsEl=document.getElementById('a-iws'); if(iwsEl) iwsEl.checked=!!savedEst.iceWaterShield;
      window._editingEstimateId = savedEst.id;
    } else {
      window._editingEstimateId = null;
    }
  } else {
    window._editingEstimateId = null;
    // No saved estimate — try to pre-fill from Tracerfy contact data
    if(p.contactData){
      if(p.contactData.ownerName && !document.getElementById('e-owner').value)
        document.getElementById('e-owner').value = p.contactData.ownerName;
    }
  }
  // Render contact dropdowns from Tracerfy data (always, after est/no-est branch)
  _renderContactDropdowns(p);
  // Load all photos via unified system (estimates table → pin fallback)
  _clearAllPhotos();
  if(est){
    _loadAllPhotosFromEst(est, p);
  } else {
    _loadAllPhotosFromPin(p); // no estimate yet — load directly from pin's all_photos/damage_photos
  }
  // Restore home photo preview from the front photo
  const frontPhoto = (window._allPhotos.front||[])[0] || p.photo_url || p.photo_data || null;
  if(frontPhoto){
    window._homePhotoData = frontPhoto;
    const prev=document.getElementById('home-photo-preview');
    if(prev) prev.innerHTML='<img src="'+frontPhoto+'" style="width:100%;height:100%;object-fit:cover;">';
    const clr=document.getElementById('clear-photo-btn');
    if(clr) clr.style.display='block';
  } else {
    window._homePhotoData = null;
    clearHomePhoto();
  }
  goTab('estimate');
  // Update picker to show this pin as selected
  const sel = document.getElementById('est-pin-picker');
  if(sel) sel.value = id;
  // Try to restore draft for this pin
  const hadDraft = restoreDraft(id);
  if(!hadDraft) clearDraftBanner();
  renderStructures();calcP();updatePreview();
  if(p.equityData) showEquityBadge(p.equityData); else hideEquityBadge();
  toast('📋 '+p.address.split(',')[0],'info');
  // Fetch satellite roof measurement from Google Solar API (non-blocking)
  hideSolarBanner();
  if(p.lat && p.lng){
    // Use cached data from popup if available, otherwise fetch fresh
    const cachedSolar = p._solarCache || null;
    if(cachedSolar && cachedSolar.status === 'ok'){
      showSolarBanner(cachedSolar);
      const mainStruct = structures[0];
      if(mainStruct && (!mainStruct.sqft || mainStruct.sqft===0)) applySolarToEstimate();
    } else {
      fetchSolarData(p.lat, p.lng).then(function(solarData){
        if(solarData && solarData.status==='ok'){
          p._solarCache = solarData;
          showSolarBanner(solarData);
          // Auto-apply only if sqft is still 0 (not yet manually entered)
          const mainStruct = structures[0];
          if(mainStruct && (!mainStruct.sqft || mainStruct.sqft===0)){
            applySolarToEstimate();
          }
        }
      }).catch(function(){});
    }
  }
}
