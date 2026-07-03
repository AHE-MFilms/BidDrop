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



// Queue Tab Switcher
let _queueActiveTab = 'pending';

function switchQueueTab(tab){
  _queueActiveTab = tab;
  var pendBtn = document.getElementById('q-tab-pending');
  var schedBtn = document.getElementById('q-tab-scheduled');
  var sendAllBtn = document.getElementById('q-send-all-btn');
  var pendingTable = document.getElementById('q-table');
  var pendingEmpty = document.getElementById('q-empty');
  var schedTable = document.getElementById('q-scheduled-table');
  var schedEmpty = document.getElementById('q-scheduled-empty');
  var bulkBar = document.getElementById('q-bulk-bar');
  if(tab === 'scheduled'){
    if(pendBtn){ pendBtn.style.background='var(--card2)'; pendBtn.style.color='var(--mid)'; pendBtn.style.border='1px solid var(--border)'; }
    if(schedBtn){ schedBtn.style.background='var(--accent)'; schedBtn.style.color='#fff'; schedBtn.style.border='none'; }
    if(sendAllBtn) sendAllBtn.style.display='none';
    if(bulkBar) bulkBar.style.display='none';
    if(pendingTable) pendingTable.style.display='none';
    if(pendingEmpty) pendingEmpty.style.display='none';
    renderScheduledQueue();
  } else {
    if(pendBtn){ pendBtn.style.background='var(--accent)'; pendBtn.style.color='#fff'; pendBtn.style.border='none'; }
    if(schedBtn){ schedBtn.style.background='var(--card2)'; schedBtn.style.color='var(--mid)'; schedBtn.style.border='1px solid var(--border)'; }
    if(sendAllBtn) sendAllBtn.style.display='';
    if(schedTable) schedTable.style.display='none';
    if(schedEmpty) schedEmpty.style.display='none';
    renderQueue();
  }
}

function renderScheduledQueue(){
  var tbody = document.getElementById('q-scheduled-tbody');
  var tbl = document.getElementById('q-scheduled-table');
  var empty = document.getElementById('q-scheduled-empty');
  if(!tbody || !tbl || !empty) return;
  var scheduled = (S.queue||[]).filter(function(i){ return i.status === 'scheduled' && i.scheduled_send_at; });
  scheduled.sort(function(a,b){ return new Date(a.scheduled_send_at) - new Date(b.scheduled_send_at); });
  if(!scheduled.length){ tbl.style.display='none'; empty.style.display='block'; return; }
  tbl.style.display='table';
  empty.style.display='none';
  var now = new Date();
  var stepNames = ['','First Postcard','Follow-Up','Urgency','Final Notice','Final Goodbye'];
  var stepColors = ['','#F59E0B','#F97316','#EF4444','#A855F7','#3B82F6'];
  var rows = scheduled.map(function(i){
    var sendDate = new Date(i.scheduled_send_at);
    var daysAway = Math.ceil((sendDate - now) / 86400000);
    var daysLabel = daysAway <= 0 ? '<span style="color:#22C55E;font-weight:700;">Today</span>'
      : daysAway === 1 ? '<span style="color:#F59E0B;font-weight:700;">Tomorrow</span>'
      : '<span style="color:var(--mid);">'+daysAway+' days</span>';
    var sendDateStr = sendDate.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    var step = i.drip_step || 0;
    var stepColor = stepColors[step] || '#6B7280';
    var stepName = stepNames[step] || 'Step '+step;
    return '<tr style="border-bottom:1px solid var(--border);">'
      +'<td style="font-weight:600;">'+escHtml(i.owner||'&mdash;')+'</td>'
      +'<td style="font-size:11px;color:var(--mid);">'+escHtml(i.addr||'&mdash;')+'</td>'
      +'<td><span style="font-size:10px;background:'+stepColor+'22;color:'+stepColor+';border:1px solid '+stepColor+'44;border-radius:10px;padding:2px 8px;font-weight:700;white-space:nowrap;">Step '+step+'</span><br><span style="font-size:10px;color:var(--muted);">'+escHtml(stepName)+'</span></td>'
      +'<td style="font-family:var(--font-m);font-size:12px;font-weight:600;color:var(--text);">'+sendDateStr+'</td>'
      +'<td>'+daysLabel+'</td>'
      +'<td><span style="font-size:10px;background:#3D526922;color:#94A3B8;border:1px solid #3D526944;border-radius:10px;padding:2px 8px;font-weight:700;">Scheduled</span></td>'
      +'<td><button class="btn-xs danger" data-id="'+escHtml(i.id)+'" onclick="rmQ(this.dataset.id)" title="Cancel">Cancel</button></td>'
      +'</tr>';
  });
  tbody.innerHTML = rows.join('');
}
