// BidDrop — CompanyCam + QuickBooks integration helpers
// Depends on: state.js (S, currentAccount), ui.js (toast), adminAPI()

// ── CompanyCam ────────────────────────────────────────────────────────────────
let _companyCamCurrentPin = null;

function updateCompanyCamStatus(){
  const key = (document.getElementById('s-companycam-key')||{}).value||'';
  const el = document.getElementById('companycam-int-status');
  if(!el) return;
  if(key && key.length > 8){
    el.className = 'int-status connected'; el.textContent = '● Connected';
  } else {
    el.className = 'int-status not-connected'; el.textContent = '● Not Connected';
  }
}

function saveCompanyCamKey(){
  const key = (document.getElementById('s-companycam-key')||{}).value||'';
  S.cfg.companyCamKey = key.trim();
  save();
  updateCompanyCamStatus();
  toast(key ? '✅ CompanyCam key saved' : 'CompanyCam key cleared', key ? 'success' : 'info');
  renderPinList(); // refresh pin cards to show/hide 📷 Photos button
}

function initCompanyCamSettings(){
  const el = document.getElementById('s-companycam-key');
  if(el && S.cfg.companyCamKey) el.value = S.cfg.companyCamKey;
  updateCompanyCamStatus();
}

async function openCompanyCamModal(pinId){
  const pin = (S.pins||[]).find(p=>p.id===pinId);
  if(!pin){ toast('Pin not found','error'); return; }
  if(!S.cfg.companyCamKey){ toast('Add your CompanyCam API key in Settings → Integrations first','warn'); return; }
  _companyCamCurrentPin = pin;
  const addrEl = document.getElementById('companycam-modal-addr');
  if(addrEl) addrEl.textContent = pin.address || '';
  const grid = document.getElementById('companycam-photos-grid');
  if(grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-size:13px;">Loading photos…</div>';
  const linkEl = document.getElementById('companycam-open-link');
  if(linkEl) linkEl.href = 'https://app.companycam.com/projects';
  const modal = document.getElementById('m-companycam');
  if(modal){ modal.style.display = 'flex'; }
  // Fetch projects from CompanyCam API via server proxy
  try {
    const data = await adminAPI('companycam-photos', { address: pin.address, apiKey: S.cfg.companyCamKey });
    if(!grid) return;
    if(!data || !data.photos || !data.photos.length){
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-size:13px;">No photos found in CompanyCam for this address.<br><span style="font-size:11px;margin-top:6px;display:block;">Photos are matched by property address.</span></div>';
      return;
    }
    if(data.projectUrl && linkEl) linkEl.href = data.projectUrl;
    grid.innerHTML = data.photos.map(function(photo){
      return '<div style="position:relative;border-radius:8px;overflow:hidden;background:var(--card2);cursor:pointer;" onclick="window.open(\''+photo.uri+'\',\'_blank\')">'
        + '<img src="'+photo.uri+'" style="width:100%;height:120px;object-fit:cover;display:block;" loading="lazy" onerror="this.parentElement.style.display=\'none\'">'
        + (photo.taken_at ? '<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.6);padding:4px 6px;font-size:9px;color:#ccc;">'+new Date(photo.taken_at*1000).toLocaleDateString()+'</div>' : '')
        + '</div>';
    }).join('');
  } catch(e){
    if(grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#f87171;font-size:13px;">Error loading photos: '+escHtml(e.message)+'</div>';
  }
}

async function syncCompanyCamPhotos(){
  if(!_companyCamCurrentPin){ toast('No pin selected','error'); return; }
  if(!S.cfg.companyCamKey){ toast('CompanyCam not configured','error'); return; }
  toast('Syncing first photo to pin…','info');
  try {
    const data = await adminAPI('companycam-photos', { address: _companyCamCurrentPin.address, apiKey: S.cfg.companyCamKey });
    if(!data || !data.photos || !data.photos.length){ toast('No photos to sync','info'); return; }
    const firstPhoto = data.photos[0];
    _companyCamCurrentPin.photo_url = firstPhoto.uri;
    if(currentAccount){
      await sb.from('pins').update({ photo_url: firstPhoto.uri }).eq('id', _companyCamCurrentPin.id);
    }
    save();
    toast('✅ Photo synced to pin!','success');
    closeM('m-companycam');
    renderPinList();
  } catch(e){
    toast('Sync failed: '+e.message,'error');
  }
}

// ── QuickBooks ────────────────────────────────────────────────────────────────
function updateQBStatus(){
  const clientId = (document.getElementById('s-qb-client-id')||{}).value||'';
  const el = document.getElementById('qb-int-status');
  if(!el) return;
  if(clientId && clientId.length > 8){
    el.className = 'int-status connected'; el.textContent = '● Connected';
  } else {
    el.className = 'int-status not-connected'; el.textContent = '● Not Connected';
  }
}

function saveQBSettings(){
  const clientId = (document.getElementById('s-qb-client-id')||{}).value||'';
  const clientSecret = (document.getElementById('s-qb-client-secret')||{}).value||'';
  const realmId = (document.getElementById('s-qb-realm-id')||{}).value||'';
  S.cfg.qbClientId = clientId.trim();
  S.cfg.qbClientSecret = clientSecret.trim();
  S.cfg.qbRealmId = realmId.trim();
  save();
  updateQBStatus();
  toast(clientId ? '✅ QuickBooks settings saved' : 'QuickBooks settings cleared', clientId ? 'success' : 'info');
  if(typeof renderEstimatesTab === 'function') renderEstimatesTab();
}

function connectQuickBooks(){
  const clientId = (document.getElementById('s-qb-client-id')||{}).value || S.cfg.qbClientId || '';
  if(!clientId){ toast('Enter your QuickBooks Client ID first','warn'); return; }
  // QuickBooks OAuth2 authorization URL
  const redirectUri = encodeURIComponent(window.location.origin + '/api/qb-callback');
  const scope = encodeURIComponent('com.intuit.quickbooks.accounting');
  const state = encodeURIComponent(currentAccount ? currentAccount.id : 'biddrop');
  const authUrl = 'https://appcenter.intuit.com/connect/oauth2'
    + '?client_id=' + encodeURIComponent(clientId)
    + '&redirect_uri=' + redirectUri
    + '&response_type=code'
    + '&scope=' + scope
    + '&state=' + state;
  const statusEl = document.getElementById('qb-connect-status');
  if(statusEl) statusEl.innerHTML = '<span style="color:#EAB308;">⏳ Opening QuickBooks authorization…</span>';
  window.open(authUrl, 'qb-oauth', 'width=600,height=700,scrollbars=yes');
}

function initQBSettings(){
  const cidEl = document.getElementById('s-qb-client-id');
  const csEl = document.getElementById('s-qb-client-secret');
  const ridEl = document.getElementById('s-qb-realm-id');
  if(cidEl && S.cfg.qbClientId) cidEl.value = S.cfg.qbClientId;
  if(csEl && S.cfg.qbClientSecret) csEl.value = S.cfg.qbClientSecret;
  if(ridEl && S.cfg.qbRealmId) ridEl.value = S.cfg.qbRealmId;
  updateQBStatus();
}

async function sendEstimateToQB(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  if(!S.cfg.qbClientId){ toast('Configure QuickBooks in Settings → Integrations first','warn'); return; }
  if(!S.cfg.qbRealmId){ toast('QuickBooks Realm ID required — save settings first','warn'); return; }
  toast('Sending to QuickBooks…','info');
  try {
    const data = await adminAPI('qb-create-invoice', {
      estId: est.id,
      owner: est.owner || 'Homeowner',
      addr: est.addr || '',
      total: est.total || 0,
      structures: est.structures || [],
      realmId: S.cfg.qbRealmId,
      clientId: S.cfg.qbClientId,
      clientSecret: S.cfg.qbClientSecret,
      accessToken: S.cfg.qbAccessToken || null,
      refreshToken: S.cfg.qbRefreshToken || null
    });
    if(data && data.invoiceId){
      est.qbInvoiceId = data.invoiceId;
      if(currentAccount){
        sb.from('estimates').update({ qb_invoice_id: data.invoiceId }).eq('id', est.id).then(()=>{});
      }
      save();
      toast('✅ QuickBooks invoice #' + data.invoiceId + ' created!','success');
      if(typeof renderEstimatesTab === 'function') renderEstimatesTab();
    } else {
      toast('QB error: ' + (data && data.error ? data.error : 'Unknown error'),'error');
    }
  } catch(e){
    toast('QuickBooks sync failed: '+e.message,'error');
  }
}
