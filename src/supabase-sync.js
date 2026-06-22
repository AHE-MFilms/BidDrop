// BidDrop — Supabase data sync: pin CRUD, queue, estimates, realtime subscription
// Depends on: state.js (S, sb, currentAccount, currentUser), ui.js (toast), api.js (adminAPI)

// ── SUPABASE PIN OPERATIONS (replace in-memory S.pins) ───────────────────────
async function uploadPinPhoto(pinId, base64DataUrl){
  // Upload via server-side API (bypasses Supabase Storage RLS)
  const filePath = currentAccount.id + '/' + pinId + '.jpg';
  try {
    const session = await sb.auth.getSession();
    const jwt = session?.data?.session?.access_token;
    const resp = await fetch('/api/admin?action=upload-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
      body: JSON.stringify({ path: filePath, dataUrl: base64DataUrl, mimeType: 'image/jpeg' })
    });
    if(resp.ok){
      const result = await resp.json();
      return result.url || null;
    }
    console.error('Pin photo upload failed:', resp.status);
    return null;
  } catch(err){
    console.error('Pin photo upload error:', err);
    return null;
  }
}

async function sbSavePin(pin){
  if(!currentAccount) return;
  // Upload photo if present
  let photoUrl = pin.photo_url || null;
  if(window._homePhotoData && !photoUrl){
    photoUrl = await uploadPinPhoto(pin.id, window._homePhotoData);
    if(photoUrl){
      pin.photo_url = photoUrl;
      // Update the in-memory pin too
      const mp = S.pins.find(p=>p.id===pin.id);
      if(mp) mp.photo_url = photoUrl;
      window._homePhotoData = null; // clear after upload
    }
  }
  // Store damage_photos inside the estimate JSONB so they persist across reloads
  if(pin.damage_photos && pin.damage_photos.length){
    const existingEst = pin.estimate ? (typeof pin.estimate==='string'?JSON.parse(pin.estimate):pin.estimate) : {};
    if(!existingEst.damage_photos || !existingEst.damage_photos.length){
      existingEst.damage_photos = [...pin.damage_photos];
      pin.estimate = existingEst;
    }
  }
  const {data: upsertData, error} = await sb.from('pins').upsert({
    id: pin.id, account_id: currentAccount.id,
    created_by: currentUser.id, rep_name: pin.rep,
    lat: pin.lat, lng: pin.lng, address: pin.address,
    status: pin.status, notes: pin.notes, pts: pin.pts||null,
    photo_url: photoUrl,
    estimate: (()=>{
      const est = pin.estimate ? (typeof pin.estimate==='string'?JSON.parse(pin.estimate):pin.estimate) : {};
      if(pin.interested_trades && pin.interested_trades.length) est.interested_trades = pin.interested_trades;
      return Object.keys(est).length ? est : null;
    })(),
    all_photos: _allPhotosForSupabase(pin.all_photos),
    updated_at: new Date().toISOString()
  }, {onConflict:'id'}).select('id').single();
  if(error){ console.error('Pin save error:', error); return; }
  // If Supabase assigned a different id (UUID auto-gen), reconcile local state
  const savedId = upsertData && upsertData.id;
  if(savedId && savedId !== pin.id){
    const idx = S.pins.findIndex(p=>p.id===pin.id);
    if(idx>=0){ S.pins[idx].id = savedId; }
    if(markers[pin.id]){
      const m = markers[pin.id];
      delete markers[pin.id];
      markers[savedId] = m;
    }
    pin.id = savedId;
    renderPinList();
  }
}

async function sbDeletePin(pinId){
  if(!currentAccount) return;
  // Soft-delete: set deleted_at so pin moves to Trash (recoverable for 30 days)
  const {error} = await sb.from('pins').update({deleted_at: new Date().toISOString()}).eq('id', pinId);
  if(error) throw new Error(error.message);
}
async function sbRestorePin(pinId){
  if(!currentAccount) return;
  const {error} = await sb.from('pins').update({deleted_at: null}).eq('id', pinId);
  if(error) throw new Error(error.message);
}

async function sbUpdatePinStatus(pinId, status){
  if(!currentAccount) return;
  await sb.from('pins').update({status, updated_at: new Date().toISOString()}).eq('id', pinId);
}

// ── Helper: map a DB row to a JS pin object ──────────────────────────────────
function _rowToPin(row){
  const est = row.estimate ? (typeof row.estimate==='string'?JSON.parse(row.estimate):row.estimate) : null;
  // Resolve photo: prefer pin-level photo_url, then estimate's photo_url, then estimate's photo_data
  const resolvedPhotoUrl  = row.photo_url || (est && est.photo_url)  || null;
  const resolvedPhotoData = (est && est.photo_data) || null;
  return {
    id: row.id, lat: parseFloat(row.lat), lng: parseFloat(row.lng),
    address: row.address||'', status: row.status||'needs_roof',
    notes: row.notes||'', rep: row.rep_name||'Unknown',
    phone: row.phone||null,
    pts: row.pts||null, at: row.created_at,
    photo_url: resolvedPhotoUrl,
    photo_data: resolvedPhotoData,
    all_photos: row.all_photos||null,
    estimate: row.estimate||null,
    at_est: row.at_est||null,
    damage_photos: row.damage_photos||(est && est.damage_photos && est.damage_photos.length ? est.damage_photos : null),
    equityData: row.equity_data||null,
    ghlContactId: row.ghl_contact_id||null,
    ghlOpportunityId: row.ghl_opportunity_id||null,
    jnContactId: row.jn_contact_id||null,
    interested_trades: (est && est.interested_trades) || null,
    contactData: row.contact_data || null
  };
}

// ── Helper: rebuild S.estimates from S.pins ───────────────────────────────────
let _estimateMigrationDone = false;
async function migrateEstimatesFromPins(){
  // One-time migration: copy estimates from pins.estimate JSONB into the estimates table
  // This runs silently on first login after the estimates table was created.
  if(_estimateMigrationDone) return;  // already ran (success or failure) — don't retry
  if(!currentAccount || !sb) return;
  const pinsWithEstimates = (S.pins||[]).filter(p => p.estimate && p.estimate.structures && p.estimate.structures.length > 0);
  if(!pinsWithEstimates.length) return;
  // Check which ones are already in the estimates table
  const {data: existing} = await sb.from('estimates').select('pin_id').eq('account_id', currentAccount.id);
  const existingPinIds = new Set((existing||[]).map(e => e.pin_id));
  const toMigrate = pinsWithEstimates.filter(p => !existingPinIds.has(p.id));
  if(!toMigrate.length) return;
  console.log('[BidDrop] Migrating', toMigrate.length, 'estimates from pins to estimates table...');
  const rows = toMigrate.map(p => {
    const est = p.estimate;
    return {
      id: est.id || ('est_' + p.id),
      account_id: currentAccount.id,
      pin_id: p.id,
      addr: est.addr || p.addr || '',
      owner: est.owner || 'Homeowner',
      email: est.email || '',
      rep: est.rep || '',
      total: est.total || 0,
      structures: est.structures || [],
      photo_url: est.photo_url || p.photo_url || null,
      photo_data: est.photo_data || p.photo_data || null,
      all_photos: est.all_photos || p.all_photos || null,
      damage_photos: est.damage_photos || null,
      skylight: est.skylight || false,
      skylight_qty: est.skylightQty || 1,
      chimney: est.chimney || false,
      gutters: est.gutters || false,
      gutter_lf: est.gutterLf || 120,
      version: est.version || 1,
      is_revision: est.isRevision || false,
      parent_id: est.parentId || null,
      saved_at: est.savedAt || new Date().toISOString(),
      deleted_at: est.deletedAt || null
    };
  });
  const {error} = await sb.from('estimates').upsert(rows, {onConflict:'id'});
  _estimateMigrationDone = true;  // don't retry regardless of outcome
  if(error) console.warn('[BidDrop] migrateEstimatesFromPins error:', error.message);
  else console.log('[BidDrop] Migration complete:', rows.length, 'estimates migrated');
}

async function loadEstimatesFromSupabase(){
  if(!currentAccount || !sb) return;
  // Load all estimates — filter deleted ones client-side (deleted_at column may not exist yet pre-migration)
  const result = await sb.from('estimates')
    .select('*')
    .eq('account_id', currentAccount.id)
    .order('saved_at', {ascending: false})
    .limit(2000);
  const {data, error} = result;
  if(error){ console.warn('[BidDrop] loadEstimatesFromSupabase error:', error.message); return; }
  if(!data || !data.length) return;
  // Map DB rows to in-memory estimate objects
  const loaded = data.map(row => ({
    id: row.id,
    pinId: row.pin_id,
    addr: row.addr || '',
    owner: row.owner || '',
    email: row.email || '',
    phone: row.phone || '',
    rep: row.rep || '',
    total: row.total || 0,
    structures: (row.structures || []).map(normStruct),
    photo_url: row.photo_url || null,
    photo_data: row.photo_data || null,
    all_photos: row.all_photos || null,
    damage_photos: row.damage_photos || null,
    skylight: row.skylight || false,
    skylightQty: row.skylight_qty || 1,
    chimney: row.chimney || false,
    gutters: row.gutters || false,
    gutterLf: row.gutter_lf || 120,
    solar: row.solar || false,
    iceWaterShield: row.ice_water_shield || false,
    solarKw: row.solar_kw || null,
    solarFlat: row.solar_flat || null,
    solarPrice: row.solar_price || null,
    version: row.version || 1,
    isRevision: row.is_revision || false,
    parentId: row.parent_id || null,
    savedAt: row.saved_at || row.created_at,
    sentAt: row.sent_at || null,
    deletedAt: row.deleted_at || null,
    printPaid: row.print_paid || false,
    priceOverride: row.price_override || null,
    signedAt: row.signed_at || null,
    sigName: row.sig_name || null,
    status: 'saved'
  }));
  // Merge: keep any in-memory estimates not yet in DB, replace those that are
  const dbIds = new Set(loaded.map(e => e.id));
  const memOnly = (S.estimates || []).filter(e => !dbIds.has(e.id));
  S.estimates = [...loaded, ...memOnly];
  console.log('[BidDrop] Loaded', loaded.length, 'estimates from Supabase');
  // Backfill pin.estimate JSONB so map badges and goEstFromPin always have fresh data
  _backfillPinEstimatesFromTable();
}
function _backfillPinEstimatesFromTable(){
  // For each pin in S.pins, find its latest non-revision estimate and sync pin.estimate
  (S.pins||[]).forEach(pin => {
    const est = (S.estimates||[]).find(e => e.pinId === pin.id && !e.deletedAt && !e.isRevision);
    if(est){
      pin.estimate = {
        id: est.id,
        owner: est.owner || '',
        email: est.email || '',
        phone: est.phone || '',
        total: est.total || 0,
        structures: est.structures || [],
        photo_url: est.photo_url || null,
        photo_data: est.photo_data || null,
        all_photos: est.all_photos || null,
        damage_photos: est.damage_photos || null,
        skylight: est.skylight || false,
        skylightQty: est.skylightQty || 1,
        chimney: est.chimney || false,
        gutters: est.gutters || false,
        gutterLf: est.gutterLf || 120,
        savedAt: est.savedAt || new Date().toISOString(),
        rep: est.rep || ''
      };
      // Also sync photo fields on the pin itself
      if(est.photo_url && !pin.photo_url) pin.photo_url = est.photo_url;
      if(est.all_photos && !pin.all_photos) pin.all_photos = est.all_photos;
      if(est.damage_photos && !pin.damage_photos) pin.damage_photos = est.damage_photos;
    }
  });
}

function _rebuildEstimatesFromPins(){
  // Only add estimates from pins.estimate JSONB that aren't already in S.estimates
  // (estimates table is the primary source; this is a fallback for legacy data)
  const existingIds = new Set((S.estimates||[]).map(e=>e.id));
  const existingPinIds = new Set((S.estimates||[]).map(e=>e.pinId).filter(Boolean));
  S.pins.forEach(function(pin){
    if(pin.estimate){
      var est = typeof pin.estimate === 'string' ? JSON.parse(pin.estimate) : pin.estimate;
      if(est && est.structures){
        const estId = est.id || ('est_' + pin.id);
        if(existingIds.has(estId)) return; // already loaded from estimates table
        if(existingPinIds.has(pin.id)) return; // a DB estimate for this pin already loaded — skip to prevent duplicates
        S.estimates.push({
          id: est.id || ('est_' + pin.id),
          pinId: pin.id,
          addr: pin.address || '',
          owner: est.owner || '',
          email: est.email || '',
          total: est.total || 0,
          structures: (est.structures || []).map(normStruct),
          photo_url: pin.photo_url || null,
          damage_photos: est.damage_photos || pin.damage_photos || null,
          savedAt: est.savedAt || pin.at_est || pin.at || new Date().toISOString(),
          rep: est.rep || pin.rep || '',
          sentAt: null, status: 'saved'
        });
      }
    }
  });
}

async function loadPinsFromSupabase(){
  if(!currentAccount) return;
  // 1. Fetch server-side count (cheap — no row data transferred)
  const countRes = await sb.from('pins').select('id', {count:'exact', head:true}).eq('account_id', currentAccount.id);
  totalPinCount = countRes.count || 0;
  pinListPage = 0;
  // 2. Load the 500 most-recent pins so the sidebar and dashboard work immediately
  const {data, error} = await sb.from('pins').select('*').eq('account_id', currentAccount.id)
    .is('deleted_at', null)
    .order('created_at', {ascending:false}).limit(500);
  if(error){console.error('Load pins error:', error); return;}
  S.pins = (data||[]).map(_rowToPin);
  // One-time migration: copy any estimates still only in pins.estimate into the estimates table
  await migrateEstimatesFromPins();
  // Load estimates from dedicated table (primary source of truth)
  await loadEstimatesFromSupabase();
  // Fall back: rebuild any estimates still only in pins.estimate JSONB
  _rebuildEstimatesFromPins();
  // 3. Clear and re-add all markers via cluster group
  if(clusterGroup) clusterGroup.clearLayers();
  markers={};
  S.pins.forEach(addMarker);
  renderPinList();
  refreshZoneOverlays();
  // Refresh the estimates tab if it's visible
  if(typeof renderEstimatesTab === 'function') renderEstimatesTab();
}

// ── Viewport-based incremental pin loading ────────────────────────────────────
async function loadPinsForViewport(){
  if(!currentAccount || !map) return;
  const b = map.getBounds();
  // Skip if we already loaded this exact viewport
  if(_lastViewportBounds && _lastViewportBounds.equals(b, 0.0001)) return;
  _lastViewportBounds = b;
  const sw = b.getSouthWest(), ne = b.getNorthEast();
  const {data, error} = await sb.from('pins').select('*')
    .eq('account_id', currentAccount.id)
    .is('deleted_at', null)
    .gte('lat', sw.lat).lte('lat', ne.lat)
    .gte('lng', sw.lng).lte('lng', ne.lng)
    .order('created_at', {ascending:false})
    .limit(500);
  if(error || !data || !data.length) return;
  let added = 0;
  data.forEach(row=>{
    if(S.pins.find(p=>p.id===row.id)) return; // already in memory
    const pin = _rowToPin(row);
    S.pins.push(pin);
    addMarker(pin);
    // Also add to estimates if it has one
    if(pin.estimate){
      const est = typeof pin.estimate==='string'?JSON.parse(pin.estimate):pin.estimate;
      if(est && est.structures && !S.estimates.find(e=>e.pinId===pin.id)){
        S.estimates.push({
          id: est.id||('est_'+pin.id), pinId: pin.id,
          addr: pin.address||'', owner: est.owner||'', email: est.email||'',
          total: est.total||0, structures: (est.structures||[]).map(normStruct),
          photo_url: pin.photo_url||null, damage_photos: est.damage_photos||pin.damage_photos||null,
          savedAt: est.savedAt||pin.at_est||pin.at||new Date().toISOString(),
          rep: est.rep||pin.rep||'', sentAt: null, status: 'saved'
        });
      }
    }
    added++;
  });
  if(added > 0){
    renderPinList();
    refreshZoneOverlays();
  }
}

async function loadQueueFromSupabase(){
  if(!currentAccount) return;
  // Limit to 200 most-recent queue items; older items are rarely needed in the UI
  const {data} = await sb.from('queue').select('*').eq('account_id', currentAccount.id)
    .order('created_at', {ascending:false}).limit(200);
  S.queue = (data||[]).map(row=>{
    const allStructs = row.structures||[];
    const meta = allStructs.find(s=>s&&s.id==='_meta')||{};
    const structs = allStructs.filter(s=>s&&s.id!=='_meta');
    return {
      id: row.id, owner: row.owner, addr: row.addr, email: row.email||'',
      sqft: row.sqft, pitch: row.pitch, mat: row.mat,
      structures: structs, total: row.total,
      status: row.status, lobId: row.lob_id,
      mailedAt: row.mailed_at, at: row.created_at,
      photo_url: meta.photo_url||null,
      photo_data: meta.photo_data||null,
      pinId: meta.pin_id||null
    };
  });
}

async function sbSaveQueueItem(item){
  if(!currentAccount) return;
  // Embed photo_url, photo_data, pin_id inside structures as _meta (no extra columns needed)
  const structs = (item.structures||[]).filter(s=>s&&s.id!=='_meta');
  const meta = {id:'_meta', photo_url: item.photo_url||null, photo_data: item.photo_data||null, pin_id: item.pinId||null};
  // Capture rep name at send time for analytics attribution
  const repName = item.rep_name || currentProfile?.name || currentProfile?.full_name || currentUser?.email?.split('@')[0] || null;
  const {error} = await sb.from('queue').upsert({
    id: item.id, account_id: currentAccount.id, created_by: currentUser.id,
    owner: item.owner, addr: item.addr, email: item.email||'',
    sqft: item.sqft, pitch: item.pitch, mat: item.mat,
    structures: [...structs, meta], total: item.total,
    status: item.status, lob_id: item.lobId||null,
    mailed_at: item.mailedAt||null,
    rep_name: repName,
    drip_step: item.drip_step||null,
    drip_est_id: item.drip_est_id||null,
    scheduled_send_at: item.scheduled_send_at||null
  });
  if(error) console.error('Queue save error:', error);
}

async function sbAddActivity(txt, ref){
  if(!currentAccount) return;
  const {error: actErr} = await sb.from('activity').insert({
    account_id: currentAccount.id, user_id: currentUser?.id,
    txt, ref
  });
  if(actErr) console.warn('Activity error:', actErr);
}

function subscribeRealtime(){
  if(realtimeChannel) sb.removeChannel(realtimeChannel);
  realtimeChannel = sb.channel('account-'+currentAccount.id)
    .on('postgres_changes', {event:'*', schema:'public', table:'pins', filter:'account_id=eq.'+currentAccount.id},
      payload=>{
        const {eventType, new:nw, old} = payload;
        if(eventType==='INSERT'||eventType==='UPDATE'){
          // Include all fields so newly synced pins render correctly
          const pin = {
            id: nw.id, lat: parseFloat(nw.lat), lng: parseFloat(nw.lng),
            address: nw.address||'', status: nw.status||'needs_roof',
            notes: nw.notes||'', rep: nw.rep_name||'Unknown',
            phone: nw.phone||null,
            pts: nw.pts||null, at: nw.created_at,
            photo_url: nw.photo_url||null,
            damage_photos: nw.damage_photos||null,
            estimate: nw.estimate||null,
            at_est: nw.at_est||null,
            equityData: nw.equity_data||null,
            ghlContactId: nw.ghl_contact_id||null,
            ghlOpportunityId: nw.ghl_opportunity_id||null,
            jnContactId: nw.jn_contact_id||null
          };
          const existing = S.pins.findIndex(p=>p.id===pin.id);
          if(existing>=0){
            // UPDATE: refresh data but only re-add marker if status/photo changed
            const hadMarker = !!markers[pin.id];
            S.pins[existing]=pin;
            if(markers[pin.id]){
              if(clusterGroup) clusterGroup.removeLayer(markers[pin.id]);
              else map.removeLayer(markers[pin.id]);
              delete markers[pin.id];
            }
            addMarker(pin);
          } else {
            // INSERT from another device/session — add it
            S.pins.unshift(pin);
            totalPinCount = Math.max(totalPinCount, S.pins.length);
            addMarker(pin);
            if(pin.rep!==currentProfile?.name)
              toast('📍 '+pin.rep+' pinned '+pin.address.split(',')[0],'info');
          }
          renderPinList();
          refreshZoneOverlays();
        } else if(eventType==='DELETE'){
          S.pins = S.pins.filter(p=>p.id!==old.id);
          if(markers[old.id]){
            if(clusterGroup) clusterGroup.removeLayer(markers[old.id]);
            else map.removeLayer(markers[old.id]);
            delete markers[old.id];
          }
          totalPinCount = Math.max(0, totalPinCount - 1);
          renderPinList();
        }
      })
    .on('postgres_changes', {event:'UPDATE', schema:'public', table:'estimates', filter:'account_id=eq.'+currentAccount.id},
      payload=>{
        // When the homeowner submits the gate form, capture_lead PATCHes the estimate row.
        // Update S.estimates in-memory so the Estimator shows the fresh email/phone.
        const nw = payload.new;
        if(!nw || !nw.id) return;
        const idx = (S.estimates||[]).findIndex(e=>e.id===nw.id);
        if(idx>=0){
          const existing = S.estimates[idx];
          // Merge only the fields that capture_lead can update
          if(nw.owner)  existing.owner = nw.owner;
          if(nw.email)  existing.email = nw.email;
          if(nw.phone)  existing.phone = nw.phone;
          if(nw.page_views !== undefined) existing.page_views = nw.page_views;
          if(nw.page_first_viewed_at) existing.page_first_viewed_at = nw.page_first_viewed_at;
          // If this estimate is currently open in the Estimator, refresh the fields live
          if(window._editingEstimateId === nw.id || currentEstPinId === nw.pin_id){
            const emailEl = document.getElementById('e-email');
            const phoneEl = document.getElementById('e-phone');
            if(emailEl && nw.email) emailEl.value = nw.email;
            if(phoneEl && nw.phone) phoneEl.value = nw.phone;
          }
          // Also refresh the estimate list row if visible
          renderEstimateTable();
        }
      })
    .subscribe();
}
