// BidDrop — Nearby Campaign: modal, filters, order summary, launch, signed auto-prompt, sorry-for-mess
// Depends on: state.js (S), ui.js (toast, openM, closeM), api.js (adminAPI), credits.js (updateCreditBadge)

function openNearbyCampaign(pid){
  _coiSourcePid = pid;
  // Build the picker modal if it doesn't exist yet
  if(!document.getElementById('m-nearby-campaign')){
    const el = document.createElement('div');
    el.id = 'm-nearby-campaign';
    el.className = 'modal-overlay';
    el.style.cssText = 'display:none;z-index:9100;align-items:center;justify-content:center;';
    el.innerHTML = `
      <div class="modal-box" style="max-width:720px;width:96%;background:var(--panel);border-radius:16px;padding:0;position:relative;overflow:hidden;display:flex;flex-direction:column;max-height:92vh;">
        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px 14px;border-bottom:1px solid var(--border);flex-shrink:0;">
          <div>
            <div style="font-size:17px;font-weight:800;color:var(--text);">📍 Nearby Campaign</div>
            <div id="nearby-source-addr" style="font-size:11px;color:var(--muted);margin-top:2px;"></div>
          </div>
          <button onclick="closeM('m-nearby-campaign')" style="background:none;border:none;color:var(--mid);font-size:22px;cursor:pointer;line-height:1;padding:4px;">✕</button>
        </div>
        <!-- Body: two-column layout -->
        <div style="display:flex;flex:1;overflow:hidden;min-height:0;">
          <!-- LEFT: controls -->
          <div style="flex:1;padding:18px 20px;overflow-y:auto;border-right:1px solid var(--border);min-width:0;">
            <!-- Postcard Design Picker -->
            <div style="margin-bottom:18px;">
              <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">📬 Postcard Design</div>
              <div id="nearby-design-preview" onclick="_openCampaignDesignPicker()" style="display:flex;align-items:center;gap:10px;background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
                <div id="nearby-design-thumb" style="width:52px;height:35px;background:#111827;border-radius:4px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;">🖼</span></div>
                <div style="min-width:0;">
                  <div id="nearby-design-name" style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">No design selected</div>
                  <div style="font-size:10px;color:var(--muted);">Click to choose →</div>
                </div>
              </div>
            </div>
            <!-- Count picker -->
            <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">How many nearest homes?</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;">
              <button class="nearby-count-btn" onclick="selectNearbyCount(this,10)">10 homes</button>
              <button class="nearby-count-btn" onclick="selectNearbyCount(this,25)">25 homes</button>
              <button class="nearby-count-btn" onclick="selectNearbyCount(this,50)">50 homes</button>
              <button class="nearby-count-btn" onclick="selectNearbyCount(this,100)">100 homes</button>
            </div>
            <!-- Filters section (hidden until count selected) -->
            <div id="nearby-filters-section" style="display:none;">
              <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">🎯 Refine Targets <span id="nearby-filter-badge" style="font-size:10px;font-weight:600;color:#F25C05;margin-left:6px;"></span></div>
              <!-- Year Built -->
              <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <label style="font-size:12px;font-weight:600;color:var(--text);">Year Built</label>
                  <span id="nearby-yr-label" style="font-size:11px;color:#F25C05;font-weight:700;">Any</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="number" id="nearby-yr-min" placeholder="e.g. 1950" min="1900" max="2024"
                    style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;font-family:inherit;outline:none;"
                    oninput="_nearbyFiltersChanged()">
                  <span style="color:var(--muted);font-size:12px;">–</span>
                  <input type="number" id="nearby-yr-max" placeholder="e.g. 2010" min="1900" max="2024"
                    style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;font-family:inherit;outline:none;"
                    oninput="_nearbyFiltersChanged()">
                </div>
              </div>
              <!-- Home Value -->
              <div style="margin-bottom:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                  <label style="font-size:12px;font-weight:600;color:var(--text);">Est. Home Value</label>
                  <span id="nearby-val-label" style="font-size:11px;color:#F25C05;font-weight:700;">Any</span>
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                  <select id="nearby-val-min"
                    style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;font-family:inherit;outline:none;cursor:pointer;"
                    onchange="_nearbyFiltersChanged()">
                    <option value="">No min</option>
                    <option value="100000">$100k+</option>
                    <option value="200000">$200k+</option>
                    <option value="300000">$300k+</option>
                    <option value="400000">$400k+</option>
                    <option value="500000">$500k+</option>
                    <option value="750000">$750k+</option>
                    <option value="1000000">$1M+</option>
                  </select>
                  <select id="nearby-val-max"
                    style="flex:1;background:var(--card2);border:1px solid var(--border);border-radius:7px;padding:7px 10px;color:var(--text);font-size:12px;font-family:inherit;outline:none;cursor:pointer;"
                    onchange="_nearbyFiltersChanged()">
                    <option value="">No max</option>
                    <option value="300000">Under $300k</option>
                    <option value="500000">Under $500k</option>
                    <option value="750000">Under $750k</option>
                    <option value="1000000">Under $1M</option>
                    <option value="2000000">Under $2M</option>
                  </select>
                </div>
              </div>
              <!-- Reset filters -->
              <button onclick="_nearbyResetFilters()" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;padding:0;text-decoration:underline;">Reset filters</button>
            </div>
            <!-- Status info -->
            <div id="nearby-count-info" style="font-size:11px;color:var(--muted);margin-top:12px;min-height:16px;"></div>
          </div>
          <!-- RIGHT: Order Summary -->
          <div style="width:240px;flex-shrink:0;display:flex;flex-direction:column;background:var(--card2);">
            <div style="padding:14px 16px 10px;border-bottom:1px solid var(--border);flex-shrink:0;">
              <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;">Order Summary</div>
            </div>
            <div id="nearby-order-summary" style="flex:1;overflow-y:auto;padding:12px 14px;">
              <div style="text-align:center;color:var(--muted);font-size:11px;padding:20px 0;">Select a count to see homes</div>
            </div>
            <!-- Cost preview -->
            <div id="nearby-cost-preview" style="padding:12px 14px;border-top:1px solid var(--border);flex-shrink:0;display:none;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:11px;color:var(--muted);">Homes selected</span>
                <span id="nearby-cost-count" style="font-size:12px;font-weight:700;color:var(--text);">0</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-size:11px;color:var(--muted);">Cost if mailed</span>
                <span id="nearby-cost-credits" style="font-size:12px;font-weight:700;color:#F25C05;">0 credits</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:11px;color:var(--muted);">Your balance</span>
                <span id="nearby-cost-balance" style="font-size:12px;font-weight:700;color:#4ade80;">— credits</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Footer -->
        <div style="display:flex;gap:10px;padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0;">
          <button onclick="closeM('m-nearby-campaign')" style="flex:1;background:none;border:1px solid var(--border);border-radius:8px;padding:11px;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>
          <button id="btn-launch-nearby" onclick="launchNearbyCampaign()" disabled style="flex:2;background:#F25C05;border:none;border-radius:8px;padding:11px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;opacity:.4;">Launch Campaign →</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    // Inject button styles
    const style = document.createElement('style');
    style.textContent = `.nearby-count-btn{background:var(--card2);border:1.5px solid var(--border);border-radius:8px;padding:12px;color:var(--text);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-b);transition:all .15s;}
.nearby-count-btn:hover{border-color:#F25C05;color:#F25C05;background:rgba(242,92,5,.1);}
.nearby-count-btn.active{background:rgba(242,92,5,.18);border-color:#F25C05;color:#F25C05;}
#nearby-yr-min:focus,#nearby-yr-max:focus,#nearby-val-min:focus,#nearby-val-max:focus{border-color:#F25C05;}`;
    document.head.appendChild(style);
  }
  // Set source address label
  const srcPin = (S.pins||[]).find(p=>p.id===pid);
  const addrEl = document.getElementById('nearby-source-addr');
  if(addrEl) addrEl.textContent = srcPin ? 'Homes near: '+srcPin.address : '';
  // Reset state
  window._nearbySelectedCount = 0;
  window._nearbyFetchedHomes = null;
  window._nearbyFilteredHomes = null;
  document.querySelectorAll('.nearby-count-btn').forEach(b=>b.classList.remove('active'));
  const infoEl = document.getElementById('nearby-count-info');
  if(infoEl) infoEl.textContent = '';
  const launchBtn = document.getElementById('btn-launch-nearby');
  if(launchBtn){ launchBtn.disabled=true; launchBtn.style.opacity='.4'; }
  // Hide filters section until count is picked
  const filtersSection = document.getElementById('nearby-filters-section');
  if(filtersSection) filtersSection.style.display='none';
  // Reset filters
  _nearbyResetFilters();
  // Reset order summary
  const summary = document.getElementById('nearby-order-summary');
  if(summary) summary.innerHTML='<div style="text-align:center;color:var(--muted);font-size:11px;padding:20px 0;">Select a count to see homes</div>';
  const costPreview = document.getElementById('nearby-cost-preview');
  if(costPreview) costPreview.style.display='none';
  // Pre-populate design picker with default design
  _setCampaignDesign(typeof getDefaultDesign === 'function' ? getDefaultDesign() : null);
  openM('m-nearby-campaign');
}

function _openCampaignDesignPicker(){
  if(typeof openDesignPicker === 'function'){
    openDesignPicker(function(design){ _setCampaignDesign(design); }, window._campaignSelectedDesignId || null);
  } else {
    toast('Design library not available','error');
  }
}

function _setCampaignDesign(design){
  window._campaignSelectedDesign = design || null;
  window._campaignSelectedDesignId = design ? design.id : null;
  const nameEl = document.getElementById('nearby-design-name');
  const thumbEl = document.getElementById('nearby-design-thumb');
  if(!nameEl || !thumbEl) return;
  if(design){
    nameEl.textContent = design.name || 'Untitled';
    thumbEl.innerHTML = design.url ? '<img src="'+design.url+'" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-size:18px;">\ud83d\uddbc</span>';
  } else {
    nameEl.textContent = 'No design selected';
    thumbEl.innerHTML = '<span style="font-size:18px;">\ud83d\uddbc</span>';
  }
}

async function selectNearbyCount(btn, count){
  window._nearbySelectedCount = count;
  document.querySelectorAll('.nearby-count-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const infoEl = document.getElementById('nearby-count-info');
  const launchBtn = document.getElementById('btn-launch-nearby');
  const filtersSection = document.getElementById('nearby-filters-section');
  if(infoEl) infoEl.textContent = '🔍 Fetching nearby homes…';
  if(launchBtn){ launchBtn.disabled=true; launchBtn.style.opacity='.4'; launchBtn.textContent='Fetching…'; }

  const srcPin = (S.pins||[]).find(p=>p.id===_coiSourcePid);
  if(!srcPin || !srcPin.lat || !srcPin.lng){
    if(infoEl) infoEl.textContent = '⚠ Source pin has no location';
    return;
  }

  // Fetch from RentCast (fetch extra to allow filter headroom)
  const radiusMap = {10:0.15, 25:0.2, 50:0.3, 100:0.4};
  const radiusMiles = radiusMap[count] || 0.3;
  let fetched = [];
  try{
    const resp = await adminAPI('rentcast-nearby', null, {
      lat: srcPin.lat, lng: srcPin.lng,
      radius: radiusMiles,
      limit: Math.min(count * 3, 300)  // fetch 3x to allow filter headroom
    }, 'GET');
    const props = resp && (resp.properties || (Array.isArray(resp) ? resp : null));
    if(props && props.length){
      const _srcParts = (srcPin.address||'').trim().toLowerCase().split(/[\s,]+/);
      const _srcNum = _srcParts[0]||''; const _srcStreet = _srcParts[1]||'';
      fetched = props
        .filter(p=>{
          const addr=(p.formattedAddress||p.address||'').trim().toLowerCase();
          if(!addr) return false;
          const parts=addr.split(/[\s,]+/);
          if(_srcNum&&_srcStreet&&parts[0]===_srcNum&&(parts[1]||'').startsWith(_srcStreet.substring(0,5))) return false;
          return true;
        })
        .sort((a,b)=>haversineM(srcPin.lat,srcPin.lng,a.latitude||0,a.longitude||0)-haversineM(srcPin.lat,srcPin.lng,b.latitude||0,b.longitude||0))
        .map(p=>({
          id:'rc-'+(p.id||Math.random().toString(36).slice(2)),
          address:p.formattedAddress||p.address||'',
          lat:p.latitude||0, lng:p.longitude||0,
          _fromRentCast:true, _rentcastData:p
        }));
    }
  }catch(e){
    console.warn('[NearbyC] prefetch failed:',e);
  }

  // Fallback to existing pins
  if(!fetched.length){
    const activePins=(S.pins||[]).filter(p=>!p.deleted_at&&p.lat&&p.lng&&p.id!==_coiSourcePid);
    activePins.sort((a,b)=>haversineM(srcPin.lat,srcPin.lng,a.lat,a.lng)-haversineM(srcPin.lat,srcPin.lng,b.lat,b.lng));
    fetched=activePins.slice(0,count*2);
  }

  window._nearbyFetchedHomes = fetched;
  // Show filters section
  if(filtersSection) filtersSection.style.display='';
  // Apply current filters (or none) to update order summary
  _nearbyFiltersChanged();
  if(infoEl) infoEl.textContent = '';
}

function _nearbyGetFilters(){
  const yrMin = parseInt(document.getElementById('nearby-yr-min')&&document.getElementById('nearby-yr-min').value)||null;
  const yrMax = parseInt(document.getElementById('nearby-yr-max')&&document.getElementById('nearby-yr-max').value)||null;
  const valMin = parseFloat(document.getElementById('nearby-val-min')&&document.getElementById('nearby-val-min').value)||null;
  const valMax = parseFloat(document.getElementById('nearby-val-max')&&document.getElementById('nearby-val-max').value)||null;
  return {yrMin,yrMax,valMin,valMax};
}

function _nearbyResetFilters(){
  const fields=['nearby-yr-min','nearby-yr-max'];
  fields.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const sels=['nearby-val-min','nearby-val-max'];
  sels.forEach(id=>{ const el=document.getElementById(id); if(el) el.selectedIndex=0; });
  _nearbyFiltersChanged();
}

function _nearbyFiltersChanged(){
  const fetched = window._nearbyFetchedHomes || [];
  const count = window._nearbySelectedCount || 0;
  const {yrMin,yrMax,valMin,valMax} = _nearbyGetFilters();
  const hasFilters = yrMin||yrMax||valMin||valMax;

  // Update filter labels
  const yrLabel = document.getElementById('nearby-yr-label');
  if(yrLabel) yrLabel.textContent = (yrMin||yrMax) ? ((yrMin||'Any')+' – '+(yrMax||'Any')) : 'Any';
  const valLabel = document.getElementById('nearby-val-label');
  if(valLabel){
    if(valMin&&valMax) valLabel.textContent='$'+Math.round(valMin/1000)+'k – $'+Math.round(valMax/1000)+'k';
    else if(valMin) valLabel.textContent='$'+Math.round(valMin/1000)+'k+';
    else if(valMax) valLabel.textContent='Under $'+Math.round(valMax/1000)+'k';
    else valLabel.textContent='Any';
  }

  // Apply filters
  let filtered = fetched.filter(h=>{
    const rd = h._rentcastData||{};
    const yr = rd.yearBuilt||null;
    const val = rd.price||rd.lastSalePrice||null;
    if(yrMin && yr && yr < yrMin) return false;
    if(yrMax && yr && yr > yrMax) return false;
    if(valMin && val && val < valMin) return false;
    if(valMax && val && val > valMax) return false;
    return true;
  }).slice(0, count);

  // If filters removed too many, expand without filters up to count
  if(filtered.length < count && hasFilters){
    // still show what we have — don't silently ignore filters
  }

  window._nearbyFilteredHomes = filtered;

  // Update filter badge
  const badge = document.getElementById('nearby-filter-badge');
  if(badge) badge.textContent = hasFilters ? '('+filtered.length+' of '+Math.min(fetched.length,count)+' match)' : '';

  // Update order summary
  const summary = document.getElementById('nearby-order-summary');
  if(summary){
    if(!filtered.length){
      summary.innerHTML='<div style="text-align:center;color:var(--muted);font-size:11px;padding:20px 0;">'+(fetched.length?'No homes match these filters — try relaxing them.':'No homes found nearby.')+'</div>';
    } else {
      summary.innerHTML = filtered.map((h,i)=>{
        const rd=h._rentcastData||{};
        const yr=rd.yearBuilt?'<span style="color:var(--muted);font-size:9px;"> · '+rd.yearBuilt+'</span>':'';
        const val=rd.price?'<span style="color:var(--muted);font-size:9px;"> · $'+Math.round(rd.price/1000)+'k</span>':'';
        return '<div style="font-size:10px;color:var(--text);padding:4px 6px;background:rgba(255,255,255,.04);border-radius:5px;margin-bottom:3px;display:flex;gap:5px;align-items:flex-start;">'+
          '<span style="color:var(--muted);min-width:18px;flex-shrink:0;">'+(i+1)+'.</span>'+
          '<span style="flex:1;line-height:1.4;">'+escHtml(h.address)+yr+val+'</span>'+
          '</div>';
      }).join('');
    }
  }

  // Update cost preview
  const costPreview = document.getElementById('nearby-cost-preview');
  const costCount = document.getElementById('nearby-cost-count');
  const costCredits = document.getElementById('nearby-cost-credits');
  const costBalance = document.getElementById('nearby-cost-balance');
  if(costPreview && filtered.length){
    costPreview.style.display='';
    if(costCount) costCount.textContent = filtered.length;
    if(costCredits) costCredits.textContent = filtered.length+' credit'+(filtered.length>1?'s':'');
    const balance = (S.cfg.mailerCredits||0) + Math.max(0,({
      starter:0,pro:0,agency:0,enterprise:0
    }[(S.cfg.plan||'starter').toLowerCase()]||0) - (S.cfg.freeMailerCreditsUsed||0));
    if(costBalance){
      costBalance.textContent = balance+' credits';
      costBalance.style.color = balance >= filtered.length ? '#4ade80' : '#ef4444';
    }
  } else if(costPreview){
    costPreview.style.display='none';
  }

  // Enable/disable launch button
  const launchBtn = document.getElementById('btn-launch-nearby');
  if(launchBtn){
    const canLaunch = filtered.length > 0;
    launchBtn.disabled = !canLaunch;
    launchBtn.style.opacity = canLaunch ? '1' : '.4';
    launchBtn.textContent = canLaunch ? 'Launch Campaign ('+filtered.length+' homes) →' : 'Launch Campaign →';
  }
}

async function launchNearbyCampaign(){
  const count = window._nearbySelectedCount || 0;
  if(!count || !_coiSourcePid){ toast('Select a count first','error'); return; }
  const srcPin = (S.pins||[]).find(p=>p.id===_coiSourcePid);
  if(!srcPin || !srcPin.lat || !srcPin.lng){ toast('Source pin has no location','error'); return; }

  // Show loading state
  const launchBtn = document.getElementById('btn-launch-nearby');
  if(launchBtn){ launchBtn.disabled=true; launchBtn.textContent='Launching…'; }
  const infoEl = document.getElementById('nearby-count-info');
  if(infoEl) infoEl.textContent = '⚡ Launching campaign…';

  // ── Use pre-fetched + filtered homes from the modal (no extra API call needed) ──
  let nearbyHomes = window._nearbyFilteredHomes || window._nearbyFetchedHomes || [];
  if(nearbyHomes.length > count) nearbyHomes = nearbyHomes.slice(0, count);

  // ── Fallback: if nothing pre-fetched, fall back to existing pins ──
  if(!nearbyHomes.length){
    if(infoEl) infoEl.textContent = '⚠ Using existing pins (RentCast unavailable)';
    const activePins = (S.pins||[]).filter(p=>!p.deleted_at && p.lat && p.lng && p.id!==_coiSourcePid);
    activePins.sort((a,b) => haversineM(srcPin.lat,srcPin.lng,a.lat,a.lng) - haversineM(srcPin.lat,srcPin.lng,b.lat,b.lng));
    nearbyHomes = activePins.slice(0, count);
  }

  if(!nearbyHomes.length){
    if(launchBtn){ launchBtn.disabled=false; launchBtn.textContent='Launch Campaign →'; }
    toast('No homes found nearby','error');
    return;
  }

  // ── Auto-create pins for each real home (campaign_target = true) ──
  const campaignId = 'camp-' + Date.now();
  const campaignPinIds = [];
  const now = new Date().toISOString();
  const repName = (window.currentUser && window.currentUser.email) || 'Campaign';
  for(const home of nearbyHomes){
    if(home._fromRentCast){
      const addrNorm = (home.address||'').toLowerCase().replace(/[^a-z0-9]/g,'');
      const existingPin = (S.pins||[]).find(function(p){
        if(p.deleted_at) return false;
        const pNorm = (p.address||'').toLowerCase().replace(/[^a-z0-9]/g,'');
        return pNorm === addrNorm;
      });
      if(existingPin){
        if(!existingPin.campaign_id){
          existingPin.campaign_id = campaignId;
          existingPin.campaign_target = true;
          // Update campaign fields if columns exist (silently skip if not)
          sb.from('pins').update({ campaign_id: campaignId, campaign_target: true }).eq('id', existingPin.id).then(function(r){
            if(r.error && r.error.message && r.error.message.includes('campaign_id')) return; // column not yet migrated
          });
        }
        home.id = existingPin.id;
        campaignPinIds.push(existingPin.id);
      } else {
        const newPinId = 'camp-' + Date.now() + '-' + Math.random().toString(36).slice(2,8);
        const newPin = {
          id: newPinId,
          lat: home.lat,
          lng: home.lng,
          address: home.address,
          status: 'campaign_target',
          notes: 'Auto-pinned by Nearby Campaign on ' + now.slice(0,10),
          rep: repName,
          at: now,
          campaign_target: true,
          campaign_id: campaignId,
          photo_url: null,
          damage_photos: null,
          all_photos: null
        };
        S.pins.unshift(newPin);
        addMarker(newPin);
        // Save pin — try with campaign columns first, fall back without them if migration not yet run
        const pinPayload = {
          id: newPinId,
          account_id: currentAccount ? currentAccount.id : null,
          created_by: currentUser ? currentUser.id : null,
          rep_name: repName,
          lat: home.lat,
          lng: home.lng,
          address: home.address,
          status: 'needs_roof',
          notes: newPin.notes,
          updated_at: now
        };
        sb.from('pins').upsert(Object.assign({}, pinPayload, { campaign_target: true, campaign_id: campaignId }), {onConflict:'id'}).then(function(r){
          if(r.error && r.error.message && r.error.message.includes('campaign_id')){
            // Columns not yet migrated — save without campaign fields
            sb.from('pins').upsert(pinPayload, {onConflict:'id'}).then(function(r2){
              if(r2.error) console.warn('[Campaign] pin save error (fallback):', r2.error.message);
            });
          } else if(r.error){
            console.warn('[Campaign] pin save error:', r.error.message);
          }
        });
        home.id = newPinId;
        campaignPinIds.push(newPinId);
      }
    } else {
      campaignPinIds.push(home.id);
    }
  }
  renderPinList();
  // ── Save campaign record ──
  window._activeCampaignId = campaignId;
  window._activeCampaignPinIds = campaignPinIds;
  const _selDesign = window._campaignSelectedDesign || null;
  const campaignRecord = {
    id: campaignId,
    account_id: currentAccount ? currentAccount.id : null,
    source_pin_id: srcPin.id || null,
    source_address: srcPin.address || '',
    campaign_date: now,
    rep_email: (window.currentUser && window.currentUser.email) || '',
    pin_ids: campaignPinIds,
    home_count: campaignPinIds.length,
    postcards_sent: 0,
    ghl_pushed: 0,
    status: 'active',
    design_id: _selDesign ? _selDesign.id : null,
    design_name: _selDesign ? (_selDesign.name || 'Untitled') : null,
    design_url: _selDesign ? (_selDesign.url || null) : null
  };
  adminAPI('campaign-save', { campaign: campaignRecord }).catch(function(e){ console.warn('[Campaign] save failed:', e); });
  // Store selected homes
  window._nearbyRealHomes = nearbyHomes;
  _coiSelectedPinIds = new Set(nearbyHomes.map(function(p){ return p.id; }));
  // Highlight campaign target pins on the map
  Object.keys(markers).forEach(function(pid){
    const m = markers[pid];
    if(!m || !m._icon) return;
    if(_coiSelectedPinIds.has(pid)){
      m._icon.style.filter = 'drop-shadow(0 0 8px #F25C05) brightness(1.4) saturate(1.5)';
      m._icon.style.outline = '2px solid #F25C05';
      m._icon.style.borderRadius = '50%';
    } else {
      m._icon.style.filter = '';
      m._icon.style.outline = '';
    }
  });
  closeM('m-nearby-campaign');
  _showNearbyCampaignPanel(srcPin, nearbyHomes);
  toast('📍 '+nearbyHomes.length+' homes pinned near '+srcPin.address,'success');
}

// ── _showNearbyCampaignPanel — opens the postcard-send modal after campaign launch ──
// Called by launchNearbyCampaign() after pins are created and highlighted.
function _showNearbyCampaignPanel(srcPin, homes){
  // Update count badge in the modal
  const countEl = document.getElementById('coi-postcard-count');
  if(countEl) countEl.textContent = homes.length;
  // Update cost estimate
  const costEl = document.getElementById('coi-cost-est');
  if(costEl) costEl.textContent = homes.length + ' credit' + (homes.length!==1?'s':'') + ' ($' + (homes.length*4).toFixed(2) + ')';
  // Reset photo upload area
  const preview = document.getElementById('coi-photo-preview');
  const placeholder = document.getElementById('coi-photo-placeholder');
  if(preview) preview.style.display = 'none';
  if(placeholder) placeholder.style.display = '';
  window._coiPhotoDataUrl = null;
  // Reset progress bar
  const progress = document.getElementById('coi-send-progress');
  if(progress) progress.style.display = 'none';
  const bar = document.getElementById('coi-progress-bar');
  if(bar) bar.style.width = '0%';
  const txt = document.getElementById('coi-progress-text');
  if(txt) txt.textContent = '0 / 0 sent';
  // Re-enable send button
  const btn = document.getElementById('btn-send-campaign');
  if(btn){ btn.disabled = false; btn.textContent = '📮 Send Campaign'; }
  openM('m-campaign-postcard');
}

// ── handleCOIPhotoUpload — reads the selected job photo into memory ───────────
function handleCOIPhotoUpload(input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    window._coiPhotoDataUrl = e.target.result;
    const img = document.getElementById('coi-photo-img');
    if(img) img.src = e.target.result;
    const preview = document.getElementById('coi-photo-preview');
    const placeholder = document.getElementById('coi-photo-placeholder');
    if(preview) preview.style.display = '';
    if(placeholder) placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ── sendCampaignPostcards — sends one postcard per nearby home via Lob ────────
// Called by the "📮 Send Campaign" button inside the m-campaign-postcard modal.
async function sendCampaignPostcards(){
  const homes = window._nearbyRealHomes || [];
  if(!homes.length){ toast('No campaign homes — launch a Nearby Campaign first','error'); return; }

  const photoDataUrl = window._coiPhotoDataUrl || null;
  if(!photoDataUrl){ toast('Please upload a job photo first','error'); return; }

  const headline = (document.getElementById('coi-headline')||{}).value || 'We just finished a project in your neighborhood!';
  const subtext  = (document.getElementById('coi-subtext')||{}).value  || 'Your neighbors love the results. Want a free quote?';

  // Check credit balance
  const balance = S.cfg.mailerCredits || 0;
  if(balance < homes.length){
    toast('Not enough credits (' + balance + ' available, ' + homes.length + ' needed). Please purchase more.','error');
    setTimeout(function(){ if(typeof showBuyCreditsModal==='function') showBuyCreditsModal(); }, 800);
    return;
  }

  // Disable button, show progress
  const btn = document.getElementById('btn-send-campaign');
  if(btn){ btn.disabled = true; btn.textContent = 'Sending…'; }
  const progressEl = document.getElementById('coi-send-progress');
  const barEl = document.getElementById('coi-progress-bar');
  const txtEl = document.getElementById('coi-progress-text');
  if(progressEl) progressEl.style.display = '';

  let sent = 0, failed = 0;
  const total = homes.length;
  const idemBase = 'camp-' + Date.now();

  for(let i = 0; i < homes.length; i++){
    const home = homes[i];
    const toAddr = home.address || '';
    const toName = 'Neighbor';
    if(!toAddr){ failed++; continue; }
    try{
      const d = await adminAPI('lob-postcard-campaign', {
        toAddr: toAddr,
        toName: toName,
        photoDataUrl: photoDataUrl,
        headline: headline,
        subtext: subtext,
        pinId: home.id || null,
        idempotency_key: idemBase + '-' + i
      });
      if(d && d.error === 'no_credits'){
        toast('Ran out of credits after ' + sent + ' postcards','error');
        if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; updateCreditBadge(); }
        break;
      }
      if(d && d.error === 'rate_limited'){
        // Back off 2 seconds and retry once
        await new Promise(function(r){ setTimeout(r, 2000); });
        i--; continue;
      }
      if(d && d.id){
        sent++;
        if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; updateCreditBadge(); }
      } else {
        failed++;
        console.warn('[Campaign] postcard failed for', toAddr, d);
      }
    } catch(e){
      failed++;
      console.warn('[Campaign] postcard error for', toAddr, e);
    }
    // Update progress bar
    const pct = Math.round(((sent + failed) / total) * 100);
    if(barEl) barEl.style.width = pct + '%';
    if(txtEl) txtEl.textContent = (sent + failed) + ' / ' + total + ' sent';
    // Small yield between sends to avoid rate limiting
    if(i < homes.length - 1) await new Promise(function(r){ setTimeout(r, 300); });
  }

  // Update campaign record with postcards_sent count
  const campaignId = window._activeCampaignId;
  if(campaignId && sent > 0){
    adminAPI('campaign-update', { campaignId: campaignId, updates: { postcards_sent: sent } })
      .catch(function(e){ console.warn('[Campaign] update failed:', e); });
  }

  // Final state
  if(btn){ btn.disabled = false; btn.textContent = '📮 Send Campaign'; }
  if(sent > 0){
    toast('📮 ' + sent + ' postcard' + (sent!==1?'s':'') + ' sent!' + (failed?' (' + failed + ' failed)':''), 'success');
    addAct('Campaign: <strong>' + sent + '</strong> postcards mailed near ' + ((S.pins||[]).find(function(p){ return p.id===_coiSourcePid; })||{}).address, 'converted');
    closeM('m-campaign-postcard');
  } else {
    toast('No postcards sent' + (failed?' — ' + failed + ' failed':''), 'error');
  }
}
window.sendCampaignPostcards = sendCampaignPostcards;
window.handleCOIPhotoUpload = handleCOIPhotoUpload;
