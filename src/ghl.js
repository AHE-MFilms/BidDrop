// BidDrop — GoHighLevel CRM integration
// Depends on: state.js (S, currentAccount), ui.js (toast), api.js (adminAPI)

const GHL_BASE = 'https://services.leadconnectorhq.com';

async function ghlRequest(path, method='GET', body=null){
  // All GHL calls go through the secure server-side proxy — API key never exposed in browser
  const data = await adminAPI('ghl', { path, method, body: body||undefined });
  return data;
}

// ── JobNimbus Integration ──────────────────────────────────────────────────
// Test the JN API key connection
async function updateIntStatus(key){
  const map={
    ghl:{el:'ghl-int-status', fields:['s-ghl-key','s-ghl-loc']},
    jn:{el:'jn-int-status', fields:['s-jn-key']},
    jobber:{el:'jobber-int-status', fields:['s-jobber-key']},
    meta:{el:'meta-int-status', fields:['s-meta-pixel-id']},
    gtag:{el:'gtag-int-status', fields:['s-google-tag-id']},
    webhook:{el:'webhook-int-status', fields:['s-webhook-url']}
  };
  const m=map[key]; if(!m) return;
  const filled=m.fields.every(id=>{const el=document.getElementById(id);return el&&el.value.trim().length>3;});
  const el=document.getElementById(m.el); if(!el) return;
  if(filled){el.className='int-status connected';el.textContent='● Connected';}
  else{el.className='int-status not-connected';el.textContent='● Not Connected';}
}
function refreshAllIntStatuses(){
  ['ghl','jn','jobber','meta','gtag','webhook'].forEach(k=>updateIntStatus(k));
}
async function jobberTestConnection(){
  const key=(document.getElementById('s-jobber-key')||{}).value||'';
  const el=document.getElementById('jobber-test-status');
  if(!key){if(el)el.textContent='⚠ Enter API key first';return;}
  if(el)el.textContent='Testing…';
  try{
    const r=await fetch('https://api.getjobber.com/api/graphql',{method:'POST',headers:{'Authorization':key.startsWith('Bearer ')?key:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({query:'{ account { id name } }'})});
    const d=await r.json();
    if(d.data&&d.data.account){if(el)el.textContent='✅ Connected: '+d.data.account.name;}
    else{if(el)el.textContent='❌ Invalid key';}
  }catch(e){if(el)el.textContent='❌ Error: '+e.message;}
}
async function webhookTest(){
  const url=(document.getElementById('s-webhook-url')||{}).value||'';
  const el=document.getElementById('webhook-test-status');
  if(!url){if(el)el.textContent='⚠ Enter webhook URL first';return;}
  if(el)el.textContent='Sending…';
  try{
    const payload={event:'biddrop_test',name:'Test Homeowner',address:'123 Main St, Canton MI 48188',phone:'(734) 555-0000',email:'test@example.com',rep:'Test Rep',estimate_total:9500,roof_sqft:2200,timestamp:new Date().toISOString()};
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(el)el.textContent=r.ok?'✅ Payload sent ('+r.status+')':'❌ Error '+r.status;
  }catch(e){if(el)el.textContent='❌ '+e.message;}
}
async function jnTestConnection(){
  const apiKey = (document.getElementById('s-jn-key')||{}).value||S.cfg.jnApiKey||'';
  const statusEl = document.getElementById('jn-test-status');
  if(!apiKey){ if(statusEl) statusEl.textContent='⚠️ Enter an API key first'; return; }
  if(statusEl){ statusEl.textContent='Testing…'; statusEl.style.color='var(--muted)'; }
  try{
    const res = await fetch('/api/jobnimbus', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action:'test_connection', apiKey })
    });
    const data = await res.json();
    if(data.ok){
      if(statusEl){ statusEl.textContent='✅ Connected!'; statusEl.style.color='#22C55E'; }
    } else {
      if(statusEl){ statusEl.textContent='❌ '+( data.error||'Connection failed'); statusEl.style.color='#f87171'; }
    }
  }catch(e){
    if(statusEl){ statusEl.textContent='❌ '+e.message; statusEl.style.color='#f87171'; }
  }
}
// Upsert a contact in JobNimbus — creates or updates based on jnContactId stored on pin
// Never throws — errors are swallowed so the main flow is unaffected.
async function jnUpsertContact(pin){
  const apiKey = S.cfg.jnApiKey||'';
  if(!apiKey) return null; // JN not configured — skip silently
  try{
    // Parse name from owner field or rep name
    const ownerName = pin.owner || pin.estimate?.owner || pin.rep || 'Homeowner';
    const nameParts = ownerName.trim().split(/\s+/);
    const firstName = nameParts[0]||'';
    const lastName = nameParts.slice(1).join(' ')||'';
    // Parse address into components (best-effort)
    const addrStr = pin.address||'';
    const addrMatch = addrStr.match(/^(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    const address_line1 = addrMatch ? addrMatch[1].trim() : addrStr;
    const city = addrMatch ? addrMatch[2].trim() : '';
    const state_text = addrMatch ? addrMatch[3].trim() : '';
    const zip = addrMatch ? (addrMatch[4]||'').trim() : '';
    const contactBody = {
      first_name: firstName||undefined,
      last_name: lastName||undefined,
      display_name: ownerName,
      record_type_name: S.cfg.jnRecordType||'Customer',
      status_name: S.cfg.jnStatus||'Lead',
      address_line1: address_line1||undefined,
      city: city||undefined,
      state_text: state_text||undefined,
      zip: zip||undefined,
      source_name: 'BidDrop',
      tags: ['biddrop-lead'],
    };
    if(pin.phone){ contactBody.phone = [{ number: pin.phone.replace(/\D/g,''), type: 'mobile' }]; }
    // Geo coordinates
    if(pin.lat && pin.lng){ contactBody.geo = { lat: pin.lat, lon: pin.lng }; }
    let jnContactId = pin.jnContactId || null;
    if(jnContactId){
      // Update existing contact
      const res = await fetch('/api/jobnimbus', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'update_contact', apiKey, jnid: jnContactId, contactBody })
      });
      const data = await res.json();
      if(!data.ok) console.warn('[JN] update_contact failed:', data.error);
      return jnContactId;
    } else {
      // Create new contact
      const res = await fetch('/api/jobnimbus', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'create_contact', apiKey, contactBody })
      });
      const data = await res.json();
      if(!data.ok){ console.warn('[JN] create_contact failed:', data.error); return null; }
      const newId = data.contact?.jnid || data.contact?.id || null;
      if(newId && pin.id && currentAccount){
        // Persist jnContactId on the pin row
        pin.jnContactId = newId;
        sb.from('pins').update({ jn_contact_id: newId }).eq('id', pin.id).then(({error})=>{
          if(error) console.warn('[JN] Could not save jn_contact_id:', error.message);
        });
      }
      return newId;
    }
  }catch(e){
    console.warn('[JN] jnUpsertContact silent error:', e.message);
    return null;
  }
}


// ── Bulk sync all existing pins to GHL ──────────────────────────────────
async function ghlBulkSync(){
  if(!S.cfg.ghlLocationId){
    toast('GHL Location ID not configured. Save your GHL settings first.','error'); return;
  }
  if(!S.cfg.ghlPipelineId){
    toast('GHL Pipeline ID not configured. Save your GHL settings first.','error'); return;
  }
  const btn = document.getElementById('btn-ghl-bulk-sync');
  const statusEl = document.getElementById('ghl-bulk-sync-status');
  // Find all pins without GHL contact IDs
  const unsynced = (S.pins||[]).filter(p => !p.ghlContactId && !p.deletedAt && p.address);
  if(!unsynced.length){
    toast('All leads are already synced to GHL! ✅','success');
    if(statusEl) statusEl.textContent = 'All leads already synced ✅';
    return;
  }
  if(btn){ btn.textContent = 'Syncing…'; btn.disabled = true; }
  if(statusEl) statusEl.textContent = '0 / '+unsynced.length+' synced…';
  let done = 0, failed = 0;
  for(const pin of unsynced){
    try{
      // Get estimate total if available
      const est = (S.estimates||[]).find(e=>e.pinId===pin.id && !e.deletedAt);
      const total = est ? (est.total||0) : 0;
      const ownerName1 = pin.owner||pin.estimate?.owner||pin.rep||'Homeowner';
      const contactId = await ghlUpsertContact(ownerName1, pin.address, pin.phone||null, pin.ghlContactId||null);
      if(!contactId) throw new Error('No contact ID returned');
      const oppId = await ghlCreateOpportunity(contactId, ownerName1, pin.address, total);
      // Update in-memory pin
      pin.ghlContactId = contactId;
      pin.ghlOpportunityId = oppId;
      // Persist to Supabase
      if(currentAccount){
        sb.from('pins').update({ ghl_contact_id: contactId, ghl_opportunity_id: oppId }).eq('id', pin.id)
          .then(({error})=>{ if(error) console.warn('GHL bulk save:', error); });
      }
      // If pin was queued for mail, add postcard tag
      const wasQueued = (S.queue||[]).some(q=>q.pinId===pin.id || (q.addr&&q.addr.trim()===pin.address.trim()));
      if(wasQueued) ghlAddContactTag(contactId, 'biddrop-postcard').catch(()=>{});
      // Advance stage based on current pin status
      if(oppId) ghlSyncPinStatus(pin).catch(()=>{});
      done++;
    }catch(e){
      console.warn('GHL bulk sync failed for', pin.address, e.message);
      failed++;
    }
    if(statusEl) statusEl.textContent = done+' / '+unsynced.length+' synced…';
    // Small delay to avoid GHL rate limits
    await new Promise(r=>setTimeout(r,300));
  }
  save();
  if(btn){ btn.textContent = '🔄 Sync All Leads to GHL'; btn.disabled = false; }
  const msg = done+' lead'+(done!==1?'s':'')+' synced to GHL'+(failed?' (⚠️ '+failed+' failed)':'')+'!';
  if(statusEl) statusEl.textContent = msg;
  toast(done+' lead'+(done!==1?'s':'')+' synced to GHL ✅', 'success');
}
// ── GHL OAuth helpers ────────────────────────────────────────────────────────
async function ghlCheckOAuthStatus() {
  try {
    const r = await adminAPI('ghl-oauth-status');
    const statusLabel = document.getElementById('ghl-oauth-status-label');
    const statusDetail = document.getElementById('ghl-oauth-status-detail');
    const connectBtn = document.getElementById('btn-ghl-connect');
    const disconnectBtn = document.getElementById('btn-ghl-disconnect');
    const manualSection = document.getElementById('ghl-manual-key-section');
    if (!statusLabel) return;
    if (r.connected) {
      statusLabel.textContent = '✓ Connected to GoHighLevel';
      statusLabel.style.color = '#22C55E';
      statusDetail.textContent = r.locationId ? `Location: ${r.locationId}` : '';
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = '';
      if (manualSection) manualSection.style.display = 'none';
    } else {
      statusLabel.textContent = 'Not Connected';
      statusLabel.style.color = 'var(--muted)';
      statusDetail.textContent = 'Click Connect to authorize BidDrop with your GHL account';
      connectBtn.style.display = '';
      disconnectBtn.style.display = 'none';
      if (manualSection) manualSection.style.display = '';
    }
  } catch(e) { console.warn('[GHL OAuth] status check failed:', e.message); }
}

async function ghlOAuthConnect() {
  // Route through server-side /api/oauth?action=connect which builds the correct URL
  // with client_id, scopes, and state all properly encoded
  const accountId = (currentAccount && currentAccount.id) || '';
  if (!accountId) {
    toast('Could not determine your account — please reload and try again.', 'error');
    return;
  }
  // Redirect to the server handler which will redirect to GHL with the correct client_id
  window.location.href = `/api/oauth?action=connect&accountId=${encodeURIComponent(accountId)}`;
}

async function ghlOAuthDisconnect() {
  if (!confirm('Disconnect GoHighLevel? BidDrop will stop syncing to GHL until you reconnect.')) return;
  try {
    await adminAPI('ghl-oauth-disconnect');
    toast('GoHighLevel disconnected', 'info');
    ghlCheckOAuthStatus();
  } catch(e) { toast('Disconnect failed: ' + e.message, 'error'); }
}

// ── Handle OAuth callback redirect ───────────────────────────────────────────
(function handleGhlOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('ghl_connected') === '1') {
    const locationId = params.get('location') || params.get('location_id') || '';
    const accessToken = params.get('access_token') || '';
    const refreshToken = params.get('refresh_token') || '';
    const expiresIn = parseInt(params.get('expires_in') || '86400', 10);
    // If tokens are in URL (no accountId in state), save them via admin API
    if (accessToken) {
      adminAPI('ghl-oauth-save', {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        location_id: locationId
      }).then(() => {
        toast('GoHighLevel connected successfully!', 'success');
        // Also update ghl_location_id in settings if not set
        if (locationId && !S.cfg.ghlLocationId) {
          S.cfg.ghlLocationId = locationId;
          const locEl = document.getElementById('s-ghl-loc');
          if (locEl) locEl.value = locationId;
        }
        ghlCheckOAuthStatus();
      }).catch(e => toast('GHL connect error: ' + e.message, 'error'));
    } else {
      toast('GoHighLevel connected successfully!', 'success');
      ghlCheckOAuthStatus();
    }
    // Clean URL
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
  } else if (params.get('ghl_error')) {
    toast('GHL connection failed: ' + decodeURIComponent(params.get('ghl_error')), 'error');
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

async function ghlFetchStages() {
  const btn = document.getElementById('btn-fetch-stages');
  const sel = document.getElementById('s-ghl-stage');
  const pipelineId = document.getElementById('s-ghl-pipe').value.trim() || S.cfg.ghlPipelineId;
  const locId = document.getElementById('s-ghl-loc').value.trim() || S.cfg.ghlLocationId;
  if(!locId){ toast('Enter a GHL Location ID first','error'); return; }
  // GHL API key is stored server-side — no client-side check needed
  btn.textContent='Loading...'; btn.disabled=true;
  try {
    // Use list-all-pipelines endpoint (single-pipeline-by-ID requires OAuth scope not available with private keys)
    const data = await ghlRequest('/opportunities/pipelines?locationId='+locId);
    const pipelines = data.pipelines || [];
    // Find the matching pipeline, or fall back to first
    const pipeline = pipelines.find(p => p.id === pipelineId) || pipelines[0];
    const stages = pipeline?.stages || [];
    if(!stages.length){ toast('No stages found — check Pipeline ID','error'); return; }
    sel.innerHTML = stages.map(s =>
      '<option value="'+s.id+'">'+s.name+'</option>'
    ).join('');
    // Auto-select first stage
    if(stages[0]) sel.value = stages[0].id;
    toast('✅ '+stages.length+' stages loaded!','success');
  } catch(e){
    toast('GHL Error: '+e.message,'error');
  } finally {
    btn.textContent='⟳ Fetch'; btn.disabled=false;
  }
}

// Per-pin GHL sync mutex — prevents race condition duplicates
const _ghlSyncLocks = {};

// ── GHL Estimate URL Custom Field ────────────────────────────────────────────
// Auto-creates a "Estimate URL" custom field in GHL on first use.
// Caches the field ID in S.cfg.ghlEstimateUrlFieldId (memory only, no DB needed).
async function ghlEnsureEstimateUrlField(){
  if(S.cfg.ghlEstimateUrlFieldId) return S.cfg.ghlEstimateUrlFieldId;
  const locationId = S.cfg.ghlLocationId;
  if(!locationId) return null;
  try{
    // 1. Check if field already exists
    const existing = await ghlRequest('/locations/'+locationId+'/customFields');
    const fields = existing.customFields || existing.customField || [];
    const found = fields.find(f => f.name === 'Estimate URL' || f.fieldKey === 'contact.estimate_url');
    if(found){
      S.cfg.ghlEstimateUrlFieldId = found.id;
      console.log('[BidDrop] GHL: found existing Estimate URL field:', found.id);
      return found.id;
    }
    // 2. Create it
    const res = await ghlRequest('/locations/'+locationId+'/customFields', 'POST', {
      name:     'Estimate URL',
      dataType: 'TEXT',
      placeholder: 'https://biddrop.americashomeexperts.com/e/...',
      model:    'contact'
    });
    const fieldId = res.customField?.id || res.id;
    S.cfg.ghlEstimateUrlFieldId = fieldId;
    console.log('[BidDrop] GHL: created Estimate URL custom field:', fieldId);
    return fieldId;
  }catch(e){
    console.warn('[BidDrop] GHL: could not ensure Estimate URL field:', e.message);
    return null;
  }
}

async function ghlUpsertContact(name, address, email, existingContactId, pinId, phone){
  const locationId = S.cfg.ghlLocationId || 'gz85VU6SxGXS7lqHAQGx';
  const nameParts = (name||'Homeowner').split(' ');
  // Parse "123 Main St, Canton, Michigan 48188" into GHL fields
  let street = address||'', city = '', state = '', postalCode = '';
  if(address){
    const parts = address.split(',').map(s=>s.trim());
    if(parts.length >= 3){
      street = parts[0];
      city   = parts[1];
      // Last part may be "Michigan 48188" or "MI 48188"
      const stateZip = parts[parts.length-1].trim().split(/\s+/);
      if(stateZip.length >= 2){
        postalCode = stateZip[stateZip.length-1];
        state      = stateZip.slice(0, stateZip.length-1).join(' ');
      } else {
        state = parts[parts.length-1];
      }
    } else if(parts.length === 2){
      street = parts[0];
      city   = parts[1];
    }
  }
  // POST body includes locationId (required for create)
  const postBody = {
    locationId,
    firstName:  nameParts[0]||'Homeowner',
    lastName:   nameParts.slice(1).join(' ')||'',
    address1:   street,
    city:       city||undefined,
    state:      state||undefined,
    postalCode: postalCode||undefined,
    country:    'US',
    tags:       ['biddrop-lead','canvass'],
    source:     'BidDrop by AHE'
  };
  if(email) postBody.email = email;
  if(phone){
    const digits = phone.replace(/\D/g,'');
    postBody.phone = digits.length===10 ? '+1'+digits : (digits.length===11&&digits[0]==='1' ? '+'+digits : phone);
    putBody.phone = postBody.phone;
  }
  // PUT body must NOT include locationId — GHL returns 422 if it's present on update
  const putBody = {
    firstName:  postBody.firstName,
    lastName:   postBody.lastName,
    address1:   postBody.address1,
    city:       postBody.city,
    state:      postBody.state,
    postalCode: postBody.postalCode,
    country:    'US',
    tags:       ['biddrop-lead','canvass']
  };
  // NOTE: email NOT in putBody — sent separately to avoid GHL 400 on first-time email add

  // Helper: try PUT update; if GHL returns 400/404 (stale/deleted contact), fall through to POST
  async function _tryPutOrCreate(contactId){
    try{
      await ghlRequest('/contacts/'+contactId, 'PUT', putBody);
      // Step 2: Update email separately if provided
      if(email){
        try{ await ghlRequest('/contacts/'+contactId, 'PUT', { email }); }
        catch(emailErr){ console.warn('[BidDrop] GHL email update:', emailErr.message); }
      }
      return contactId; // success — contact still exists in GHL
    } catch(putErr){
      const msg = (putErr.message||'').toLowerCase();
      if(msg.includes('bad request') || msg.includes('not found') || msg.includes('400') || msg.includes('404')){
        // Contact was deleted from GHL — clear stale ID and create fresh
        console.warn('[BidDrop] GHL: stale contact ID '+contactId+' — creating new contact');
        if(pinId && sb){
          sb.from('pins').update({ghl_contact_id: null}).eq('id', pinId).then(()=>{});
        }
        const res = await ghlRequest('/contacts/', 'POST', postBody);
        return res.contact?.id || res.id;
      }
      throw putErr; // re-throw unexpected errors
    }
  }

  // PRIORITY 1: If we already have a GHL contact ID in memory, try UPDATE first
  if(existingContactId){
    return await _tryPutOrCreate(existingContactId);
  }
  // PRIORITY 2: If we have a pinId, check Supabase for a stored ghl_contact_id
  // (handles case where pin was synced in a previous session)
  if(pinId && sb){
    try{
      const { data } = await sb.from('pins').select('ghl_contact_id').eq('id', pinId).single();
      if(data && data.ghl_contact_id){
        console.log('[BidDrop] GHL: found stored contact ID for pin', pinId, '→ updating');
        return await _tryPutOrCreate(data.ghl_contact_id);
      }
    }catch(e){ console.warn('GHL Supabase lookup failed:', e.message); }
  }
  // PRIORITY 3: No existing contact found — create new
  console.log('[BidDrop] GHL: creating new contact for', name, address);
  const res = await ghlRequest('/contacts/', 'POST', postBody);
  return res.contact?.id || res.id;
}

async function ghlCreateOpportunity(contactId, name, address, total){
  const locationId = S.cfg.ghlLocationId || 'gz85VU6SxGXS7lqHAQGx';
  const pipelineId = S.cfg.ghlPipelineId;
  const stageId    = S.cfg.ghlStageId;
  if(!pipelineId){
    console.warn('BidDrop: No GHL Pipeline ID set — skipping opportunity');
    return null;
  }
  const oppBody = {
    locationId,
    pipelineId,
    contactId,
    name:    'Roof Bid — '+(address||name||'Unknown'),
    monetaryValue: total||0,
    status:  'open'
  };
  if(stageId) oppBody.pipelineStageId = stageId;
  console.log('[BidDrop] ghlCreateOpportunity body:', JSON.stringify(oppBody));
  try{
    const res = await ghlRequest('/opportunities/', 'POST', oppBody);
    return res.opportunity?.id || res.id || null;
  }catch(oppErr){
    console.warn('[BidDrop] ghlCreateOpportunity failed:', oppErr.message);
    // Try without pipelineStageId in case it\'s invalid
    if(oppBody.pipelineStageId){
      delete oppBody.pipelineStageId;
      console.log('[BidDrop] Retrying opportunity without pipelineStageId...');
      try{
        const res2 = await ghlRequest('/opportunities/', 'POST', oppBody);
        return res2.opportunity?.id || res2.id || null;
      }catch(e2){ console.warn('[BidDrop] Opportunity retry also failed:', e2.message); }
    }
    return null;
  }
}

async function ghlUpdateOpportunityStage(opportunityId, stageId, wonLost){
  if(!opportunityId) return;
  const body = {};
  if(stageId) body.pipelineStageId = stageId;
  if(wonLost) body.status = wonLost; // 'won' or 'lost'
  return ghlRequest('/opportunities/'+opportunityId, 'PUT', body).catch(e=>console.warn('GHL stage update:',e));
}

// Auto-push a new pin to GHL as a contact + opportunity (fire-and-forget)
// Manual per-pin GHL push — called from the ⬆ GHL / ✓ GHL button on each pin card
async function ghlPushPin(pinId){
  const pin = (S.pins||[]).find(p=>p.id===pinId);
  if(!pin){ toast('Pin not found','error'); return; }
  if(!S.cfg.ghlLocationId){ toast('⚠️ GHL not configured — add your Location ID in Settings','warn'); return; }
  // Mutex: if a GHL sync is already running for this pin, wait for it then bail
  if(_ghlSyncLocks[pinId]){
    try{ await _ghlSyncLocks[pinId]; }catch(e){}
    renderPinList(); return;
  }
  // Show spinner state on the button
  const btn = document.querySelector('#pc-'+pinId+' .btn-xs[onclick*="ghlPushPin"]');
  if(btn){ btn.textContent='⏳ Syncing…'; btn.disabled=true; }
  let _resolve, _reject;
  _ghlSyncLocks[pinId] = new Promise((res,rej)=>{ _resolve=res; _reject=rej; });
  try{
    // Reload GHL IDs from Supabase in case they were set in a previous session
    if(!pin.ghlOpportunityId && pin.id && currentAccount){
      const {data} = await sb.from('pins').select('ghl_contact_id,ghl_opportunity_id').eq('id',pin.id).single();
      if(data && data.ghl_contact_id){ pin.ghlContactId = data.ghl_contact_id; }
      if(data && data.ghl_opportunity_id){ pin.ghlOpportunityId = data.ghl_opportunity_id; }
    }
    const ownerName = pin.owner||pin.estimate?.owner||pin.rep||'Homeowner';
    const total = pin.estimate?.total || 0;
    const contactId = await ghlUpsertContact(ownerName, pin.address, pin.phone||null, pin.ghlContactId||null);
    if(!contactId) throw new Error('No contact ID returned from GHL');
    let oppId = pin.ghlOpportunityId;
    if(!oppId){
      oppId = await ghlCreateOpportunity(contactId, ownerName, pin.address, total);
    } else {
      // Update existing opportunity value
      await ghlRequest('/opportunities/'+oppId, 'PUT', { monetaryValue: total||0 }).catch(()=>{});
    }
    pin.ghlContactId = contactId;
    pin.ghlOpportunityId = oppId;
    if(currentAccount){
      await sb.from('pins').update({ ghl_contact_id: contactId, ghl_opportunity_id: oppId }).eq('id', pin.id);
    }
    toast('✅ Synced to GHL: '+ownerName,'success');
    renderPinList();
    _resolve(pin.ghlContactId);
  } catch(e){
    console.warn('GHL push failed:', e);
    toast('❌ GHL sync failed: '+e.message,'error');
    if(btn){ btn.textContent='⚠ Retry'; btn.disabled=false; }
    _reject(e);
  } finally {
    delete _ghlSyncLocks[pinId];
  }
}

async function ghlAutoPushPin(pin){
  // GHL key is server-side only — only check locationId to see if GHL is configured
  if(!S.cfg.ghlLocationId) return;
  if(!S.cfg.ghlPipelineId) return;
  // Mutex: set a lock so ghlUpdateOpportunityValue waits for this to finish
  // before trying to create its own contact (prevents race-condition duplicates)
  if(pin.id && _ghlSyncLocks[pin.id]){
    try{ await _ghlSyncLocks[pin.id]; }catch(e){}
    return; // already synced by a concurrent call
  }
  let _resolve, _reject;
  if(pin.id) _ghlSyncLocks[pin.id] = new Promise((res,rej)=>{ _resolve=res; _reject=rej; });
  try {
    const ownerName2 = pin.owner||pin.estimate?.owner||pin.rep||'Homeowner';
    const contactId = await ghlUpsertContact(ownerName2, pin.address, pin.phone||null, pin.ghlContactId||null, pin.id||null);
    if(!contactId){ if(_resolve) _resolve(null); return; }
    // Save contact ID immediately — before opportunity creation — so it's never lost if opp fails
    pin.ghlContactId = contactId;
    if(currentAccount){
      await sb.from('pins').update({ ghl_contact_id: contactId }).eq('id', pin.id);
    }
    // Now create the opportunity (non-fatal if it fails)
    let oppId = null;
    try{
      oppId = await ghlCreateOpportunity(contactId, ownerName2, pin.address, 0);
    }catch(oppErr){
      console.warn('BidDrop: GHL opportunity creation failed (contact was saved):', oppErr.message);
    }
    if(oppId){
      pin.ghlOpportunityId = oppId;
      if(currentAccount){
        await sb.from('pins').update({ ghl_opportunity_id: oppId }).eq('id', pin.id);
      }
    }
    console.log('BidDrop: GHL contact created for', pin.address, oppId ? '+ opportunity' : '(no opportunity)');
    if(_resolve) _resolve(contactId);
  } catch(e){
    console.warn('BidDrop: GHL auto-push failed (non-blocking):', e.message);
    if(_reject) _reject(e);
  } finally {
    if(pin.id) delete _ghlSyncLocks[pin.id];
  }
}

// Update GHL opportunity monetary value when estimate is saved
// NOTE: This function ONLY updates an existing opportunity's value.
// It NEVER creates new contacts or opportunities — that is ghlAutoPushPin's job.
// This prevents race-condition duplicates when pin drop + estimate save fire simultaneously.
async function ghlUpdateOpportunityValue(pin, total){
  if(!S.cfg.ghlLocationId) return;
  // Wait for any in-progress GHL sync on this pin (e.g. ghlAutoPushPin running concurrently)
  if(pin.id && _ghlSyncLocks[pin.id]){
    try{ await _ghlSyncLocks[pin.id]; }catch(e){}
  }
  // If GHL IDs are missing in memory, try to reload from Supabase
  if(!pin.ghlOpportunityId && pin.id && currentAccount){
    try{
      const {data} = await sb.from('pins').select('ghl_contact_id,ghl_opportunity_id').eq('id',pin.id).single();
      if(data && data.ghl_contact_id){ pin.ghlContactId = data.ghl_contact_id; }
      if(data && data.ghl_opportunity_id){ pin.ghlOpportunityId = data.ghl_opportunity_id; }
    }catch(e){ console.warn('GHL ID reload:', e); }
  }
  // Only update if an opportunity already exists — never create a new contact here
  if(pin.ghlOpportunityId){
    try{
      await ghlRequest('/opportunities/'+pin.ghlOpportunityId, 'PUT', { monetaryValue: total||0 });
      console.log('BidDrop: GHL opportunity value updated to $'+total+' for', pin.address);
    }catch(e){ console.warn('BidDrop: GHL opp value update failed:', e.message); }
  }
  // If no opportunity exists yet, ghlAutoPushPin will handle it — do NOT create one here
}
// Add a tag to a GHL contact by contactId
async function ghlAddContactTag(contactId, tag){
  if(!contactId || !tag) return;
  try{
    await ghlRequest('/contacts/'+contactId+'/tags', 'POST', { tags: [tag] });
    console.log('BidDrop: GHL tag added:', tag, 'to', contactId);
  }catch(e){ console.warn('BidDrop: GHL tag failed:', e.message); }
}
// Update GHL opportunity stage when pin status changes
async function ghlSyncPinStatus(pin){
  if(!pin.ghlOpportunityId) return;
  if(!S.cfg.ghlLocationId) return;
  try {
    let wonLost = null;
    if(pin.status === 'converted') wonLost = 'won';
    if(pin.status === 'not_interested') wonLost = 'lost';
    // Map BidDrop pin status to pipeline stage IDs
    const STAGE_MAP = {
      'quoted':        '2d06ced7-0bcf-432a-b925-701daada9ef4', // Stage 2: Postcard Mailed
      'bid_sent':      S.cfg.ghlStageId || '887131f7-39be-49c1-b5f3-f9b53d7b986e', // Stage 4: Estimate Viewed
      'signed':        '62444bae-6e67-42c9-812b-7dbf1648e153', // Stage 6: Signed
      'converted':     '62444bae-6e67-42c9-812b-7dbf1648e153', // Stage 6: Signed
      'not_interested':'48091422-c19b-4eef-bdbd-488e3b45e10f', // Stage 7: Not Interested
    };
    const stageId = STAGE_MAP[pin.status] || null;
    await ghlUpdateOpportunityStage(pin.ghlOpportunityId, stageId, wonLost);
    console.log('BidDrop: GHL opportunity updated for', pin.address, '->', pin.status);
  } catch(e){
    console.warn('BidDrop: GHL status sync failed (non-blocking):', e.message);
  }
}

async function ghlSendEmail(contactId, toEmail, toName, subject, htmlBody){
  // GHL API: POST /conversations/messages with contactId directly — no need to create a conversation first
  // Docs: https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message/
  return ghlRequest('/conversations/messages', 'POST', {
    type:      'Email',
    contactId,
    emailTo:   toEmail,
    subject,
    html:      htmlBody
  });
}

// Add a note to a GHL contact by address lookup
async function ghlAddDripNote(ownerName, address, stepNum, mailedAt){
  if(!S.cfg.ghlLocationId) return;
  try {
    // Find contact by address
    const locationId = S.cfg.ghlLocationId || 'gz85VU6SxGXS7lqHAQGx';
    const search = await ghlRequest('/contacts/?locationId='+locationId+'&query='+encodeURIComponent(address));
    const contacts = search.contacts || [];
    if(!contacts.length){ console.log('[GHL] No contact found for drip note:', address); return; }
    const contactId = contacts[0].id;
    const stepNames = {2:'Follow-Up (Day 7)',3:'Urgency (Day 14)',4:'Final (Day 28)'};
    const stepLabel = stepNames[stepNum] || 'Step '+stepNum;
    const dateStr = mailedAt ? new Date(mailedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const noteBody = '📮 BidDrop Drip — '+stepLabel+' postcard mailed on '+dateStr+'. Address: '+address;
    await ghlRequest('/contacts/'+contactId+'/notes', 'POST', { body: noteBody, userId: contactId });
    console.log('[GHL] Drip note added for', address, 'step', stepNum);
  } catch(e){ console.warn('[GHL] Failed to add drip note:', e.message); }
}

async function sendViaGHL(){
  if(!isPlanAtLeast('pro')){ showPlanUpgradePrompt('GHL Integration','pro'); return; }
  const owner  = document.getElementById('e-owner').value.trim();
  const addr   = document.getElementById('e-addr').value.trim();
  const email  = document.getElementById('e-email').value.trim();
  const phone  = (document.getElementById('e-phone')||{}).value.trim()||'';
  const total  = calcP();



  if(!total){toast('Build an estimate first','error');return;}

  // GHL API key is used server-side only — no need to check it here

  toast('Sending to GHL...','info');
  // Look up existing GHL contact ID via currentEstPinId
  const _curPin = currentEstPinId ? (S.pins||[]).find(p=>p.id===currentEstPinId) : null;
  // CRITICAL: Wait for any in-progress ghlAutoPushPin to finish before reading ghlContactId
  // Without this, sendViaGHL reads a stale/null ID if the user clicks GHL button immediately after pin drop
  if(_curPin && _curPin.id && _ghlSyncLocks[_curPin.id]){
    try{ await _ghlSyncLocks[_curPin.id]; }catch(e){}
  }
  // If pin still has no ghlContactId in memory, reload from Supabase (handles page-reload case)
  if(_curPin && !_curPin.ghlContactId && _curPin.id && sb){
    try{
      const {data} = await sb.from('pins').select('ghl_contact_id,ghl_opportunity_id').eq('id',_curPin.id).single();
      if(data && data.ghl_contact_id){ _curPin.ghlContactId = data.ghl_contact_id; }
      if(data && data.ghl_opportunity_id){ _curPin.ghlOpportunityId = data.ghl_opportunity_id; }
    }catch(e){ console.warn('GHL ID reload:', e); }
  }
  const _existingGhlId = _curPin ? (_curPin.ghlContactId||null) : null;
  try {
    // 1. Upsert contact — pass existing ID and pinId to prevent duplicates
    const contactId = await ghlUpsertContact(owner||'Homeowner', addr, email||null, _existingGhlId, currentEstPinId||null, phone||null);
    // Always save returned contactId — even if it changed (e.g. fallback create after 404)
    if(_curPin && contactId){
      _curPin.ghlContactId = contactId;
      if(sb) sb.from('pins').update({ghl_contact_id: contactId}).eq('id', _curPin.id).then(()=>{});
    }
    toast('✅ Contact synced to GHL','success');

    // 2. Update existing opportunity value, or create new one (fire and forget)
    if(_curPin && _curPin.ghlOpportunityId){
      ghlRequest('/opportunities/'+_curPin.ghlOpportunityId, 'PUT', { monetaryValue: total||0 }).catch(e=>console.warn('Opp update error:',e));
    } else {
      ghlCreateOpportunity(contactId, owner, addr, total).then(oppId=>{
        if(oppId && _curPin){ _curPin.ghlOpportunityId = oppId; if(sb) sb.from('pins').update({ghl_opportunity_id: oppId}).eq('id', _curPin.id).then(()=>{}); }
      }).catch(e=>console.warn('Opp error:',e));
    }

    // 3. Push estimate URL to GHL custom field (so GHL workflows can send it to homeowner)
    const _estId = window._editingEstimateId || (_curPin ? (S.estimates||[]).find(e=>e.pinId===_curPin.id)?.id : null);
    if(_estId && contactId){
      ghlEnsureEstimateUrlField().then(fieldId=>{
        if(!fieldId) return;
        const estUrl = window.location.origin+'/e/'+_estId;
        ghlRequest('/contacts/'+contactId, 'PUT', {
          customFields: [{ id: fieldId, value: estUrl }]
        }).then(()=>console.log('[BidDrop] GHL: estimate URL set on contact:', estUrl))
          .catch(e=>console.warn('[BidDrop] GHL: estimate URL field update failed:', e.message));
      });
    }

    // BidDrop only syncs contact + opportunity to GHL.
    // GHL workflows handle all email/SMS follow-up automatically.
    addAct('Synced to GHL: <strong>'+escHtml(owner||'Homeowner')+'</strong>'+(email?' ('+escHtml(email)+')':''),'bid_sent');
    save();
    toast('✅ Synced to GHL — workflows will handle follow-up','success');
    // Mark on pin if address matches
    const pin = S.pins.find(p=>p.address===addr);
    if(pin && pin.status==='needs_roof'){
      pin.status='bid_sent';
      if(markers[pin.id]){
        if(clusterGroup) clusterGroup.removeLayer(markers[pin.id]);
        else map.removeLayer(markers[pin.id]);
        delete markers[pin.id];
      }
      addMarker(pin);
      renderPinList();save();
    }
  } catch(e){
    console.error('GHL error:', e);
    toast('GHL Error: '+e.message,'error');
  }
}
