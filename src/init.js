// BidDrop — App initialisation, team management, drip scheduling
// Extracted from index.html inline block

//  INIT
// ═══════════════════════════════
window.addEventListener('load', ()=>{
  // ── QUOTE PAGE ROUTE INTERCEPT ────────────────────────────────────────────
  // Must run BEFORE Supabase init so homeowners never see the app login screen
  const _qSlug = (location.pathname.match(/^\/q\/([a-z0-9_-]+)/i)||[])[1];
  if (_qSlug) { initQuotePage(_qSlug); return; }
  // ── ESTIMATE PAGE ROUTE INTERCEPT ────────────────────────────────────────
  const _eId = (location.pathname.match(/^\/e\/([a-zA-Z0-9_-]+)/)||[])[1];
  if (_eId) { initEstimatePage(_eId); return; }
  // Initialize Supabase client
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Show login screen immediately (hidden by onSignedIn if session exists)
  showLoginScreen();

  // ── ROBUST INIT STRATEGY ─────────────────────────────────────────────────
  // Supabase v2 fires auth events in unpredictable order on page load
  // (INITIAL_SESSION, TOKEN_REFRESHED, SIGNED_OUT can interleave). Relying on
  // event order caused pins/estimates to disappear after hard refresh or re-login.
  //
  // New approach:
  //   1. Call getSession() directly on load — if a session exists, start the app
  //      immediately without waiting for any event.
  //   2. onAuthStateChange only handles two explicit user actions:
  //        SIGNED_IN  → user just submitted the login form
  //        SIGNED_OUT → user clicked Sign Out
  //      All other events (INITIAL_SESSION, TOKEN_REFRESHED) are ignored.
  //   3. Auto-reload pins every 60 s while the app is open.
  // ─────────────────────────────────────────────────────────────────────────

  // Step 1 — bootstrap from existing session on every page load / hard refresh
  // IMPORTANT: If the URL hash contains type=recovery, this is a password reset link.
  // Supabase v2 parses the hash and returns a valid session from getSession() immediately,
  // which would auto-log the user in BEFORE onAuthStateChange fires PASSWORD_RECOVERY.
  // We must skip the bootstrap in this case and let onAuthStateChange handle it.
  const _urlHash = window.location.hash || '';
  const _isPasswordRecovery = _urlHash.includes('type=recovery') || _urlHash.includes('type%3Drecovery');
  if(_isPasswordRecovery){
    // Mark recovery mode immediately so SIGNED_IN event is also blocked
    window._inPasswordRecovery = true;
    // onAuthStateChange will fire PASSWORD_RECOVERY and show the set-password form
    console.log('[Auth] Password recovery link detected — skipping getSession bootstrap');
  } else {
    sb.auth.getSession().then(({ data: { session } }) => {
      if(session && session.user && !_appInitialized){
        onSignedIn(session.user).catch(e => {
          console.error('[Auth] onSignedIn error (getSession bootstrap):', e);
          showLoginScreen();
          sb.auth.signOut().catch(()=>{});
        });
      }
    }).catch(e => console.warn('[Auth] getSession error:', e));
  }

  // Step 2 — listen only for explicit user-triggered events
  sb.auth.onAuthStateChange((event, session) => {
    console.log('[Auth]', event, session ? session.user?.email : 'no-session');

    if(event === 'PASSWORD_RECOVERY'){
      window._inPasswordRecovery = true;
      showSetNewPassword();
      return;
    }

    // New login from the sign-in form
    if(event === 'SIGNED_IN' && session && !_appInitialized){
      if(window._inPasswordRecovery) return;
      // Defer to release Supabase internal auth mutex before making DB calls
      setTimeout(() => {
        if(_appInitialized) return;
        onSignedIn(session.user).catch(e => {
          console.error('[Auth] onSignedIn error:', e);
          const errEl = document.getElementById('login-error');
          const btnEl = document.getElementById('login-btn');
          if(errEl) errEl.textContent = 'Login error: '+e.message;
          if(btnEl){ btnEl.textContent='Sign In'; btnEl.disabled=false; }
          showLoginScreen();
          sb.auth.signOut().catch(()=>{});
        });
      }, 0);
      return;
    }

    // Explicit sign-out — only clear state if we were actually logged in
    if(event === 'SIGNED_OUT' && _appInitialized){
      onSignedOut();
      return;
    }
  });

  // Step 3 — auto-reload pins every 5 min (realtime handles live changes; this is a safety net)
  // Reduced from 60s to 300s to cut Supabase Disk IO
  setInterval(() => {
    if(_appInitialized && currentAccount){
      loadPinsFromSupabase().catch(e => console.warn('[AutoReload] pins:', e));
    }
  }, 300000);

  // Step 4 — save estimate when user switches browser tabs or minimizes the window
  document.addEventListener('visibilitychange', () => {
    if(document.hidden && _appInitialized && currentEstPinId){
      _autoSaveEstimateOnLeave();
    }
  });

  // Step 5 — save estimate when user closes/refreshes the page
  window.addEventListener('beforeunload', () => {
    if(_appInitialized && currentEstPinId){
      _autoSaveEstimateOnLeave();
    }
  });
});

async function fetchMasterLobKey(){
  // Confirm master keys exist on the server — keys never leave the server
  // All Lob and RentCast calls are now proxied through /api/admin
  try {
    const result = await adminAPI('get-master-keys');
    masterLobKey      = result.hasLobKey      ? '__server__' : '';
    masterRentcastKey = result.hasRentcastKey ? '__server__' : '';
  } catch(e){ console.warn('Could not confirm master keys:', e.message); }
}


// ── BLITZ PROMO ─────────────────────────────────────────────────────────────

async function fetchBlitzPromo(){
  try {
    const { data, error } = await sb
      .from('accounts')
      .select('blitz_promo_enabled, blitz_promo_config')
      .eq('id', AGENCY_ACCOUNT_ID)
      .single();
    // Silently ignore if columns don't exist yet (pre-migration) or row not found
    if(error || !data) return;
    window.S.blitzPromo = {
      enabled: data.blitz_promo_enabled || false,
      config: data.blitz_promo_config || { buy: 3, get: 5, label: 'Buy 3 Get 5 Total!' }
    };
    // Update the badge in the Send Postcard popup if it's already open
    updateBlitzPromoBadge();
  } catch(e){ console.warn('fetchBlitzPromo:', e.message); }
}

function updateBlitzPromoBadge(){
  const promo = window.S?.blitzPromo;
  const badge = document.getElementById('spm-blitz-promo-badge');
  if(!badge) return;
  if(promo && promo.enabled && promo.config){
    badge.textContent = '🔥 ' + (promo.config.label || 'Buy '+promo.config.buy+' Get '+promo.config.get+' Total!');
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

// ── CANVASS AREAS ─────────────────────────────────────────────────────────────


function openManageTeam(accountId){
  if(!_agencyData) return;
  const a = _agencyData.accounts.find(x=>x.id===accountId);
  if(!a){ toast('Account not found','error'); return; }
  const _mtCo=document.getElementById('mt-company-name'); if(_mtCo) _mtCo.textContent=a.company_name||a.name;
  document.getElementById('m-manage-team').dataset.accountId = accountId;
  renderManageTeam(accountId);
  openM('m-manage-team');
}

function renderManageTeam(accountId){
  if(!_agencyData) return;
  const users = _agencyData.profiles.filter(p=>p.account_id===accountId);
  const el = document.getElementById('mt-body');
  if(!el) return;
  const userRows = users.length ? users.map(u=>{
    const roleColor = u.role==='admin' ? '#F25C05' : '#3B82F6';
    const uid = u.id;
    return '<div id="mt-row-'+uid+'" style="background:var(--card);border:1px solid var(--border);border-radius:9px;padding:12px;margin-bottom:8px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div>' +
          '<div style="font-weight:700;font-size:14px;">'+(u.name||'Unnamed')+'</div>' +
          '<div style="font-size:11px;color:var(--muted);">'+(u.email||'')+(u.phone ? ' &middot; '+u.phone : '')+'</div>' +
        '</div>' +
        '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:8px;background:'+roleColor+'22;color:'+roleColor+';border:1px solid '+roleColor+'44;text-transform:uppercase;">'+u.role+'</span>' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button onclick="mtToggleEdit(\''+uid+'\')" style="background:none;border:1px solid var(--accent);border-radius:6px;padding:5px 10px;color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;">✏️ Edit</button>' +
        '<button onclick="mtResetPassword(\''+uid+'\',\''+escJs(u.email||'')+'\')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:5px 10px;color:var(--mid);font-size:11px;font-weight:700;cursor:pointer;">🔑 Reset Password</button>' +
        '<button onclick="mtRemoveUser(\''+uid+'\',\''+escJs(u.name||'Unnamed')+'\',\''+accountId+'\')" style="background:none;border:1px solid #EF444444;border-radius:6px;padding:5px 10px;color:#EF4444;font-size:11px;font-weight:700;cursor:pointer;">🗑 Remove</button>' +
      '</div>' +
      '<div id="mt-edit-'+uid+'" style="display:none;margin-top:10px;border-top:1px solid var(--border);padding-top:10px;">' +
        '<div class="frow">' +
          '<div class="fg"><label class="fl" for="mt-e-name-'+uid+'">Name</label><input class="fi" id="mt-e-name-'+uid+'" value="'+((u.name||'').replace(/"/g,'&quot;'))+'" placeholder="Full name"></div>' +
          '<div class="fg"><label class="fl" for="mt-e-phone-'+uid+'">Phone</label><input class="fi" id="mt-e-phone-'+uid+'" value="'+(u.phone||'')+'" placeholder="(313) 555-0100" oninput="autoFormatPhone(this)"></div>' +
        '</div>' +
        '<div class="frow">' +
          '<div class="fg"><label class="fl" for="mt-e-email-'+uid+'">Email</label><input class="fi" id="mt-e-email-'+uid+'" value="'+((u.email||'').replace(/"/g,'&quot;'))+'" placeholder="email@company.com" type="email"></div>' +
          '<div class="fg"><div class="fl">Role</div><select class="fs" id="mt-e-role-'+uid+'"><option value="rep"'+(u.role==='rep'?' selected':'')+'>Rep (Field)</option><option value="admin"'+(u.role==='admin'?' selected':'')+'>Admin</option></select></div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-top:4px;">' +
          '<button onclick="mtSaveEdit(\''+uid+'\',\''+accountId+'\')" class="btn-primary" style="flex:1;">Save Changes</button>' +
          '<button onclick="mtToggleEdit(\''+uid+'\')" class="btn-cancel" style="flex:1;">Cancel</button>' +
        '</div>' +
        '<div id="mt-edit-result-'+uid+'" style="margin-top:6px;font-size:11px;"></div>' +
      '</div>' +
    '</div>';
  }).join(''): '<div style="color:var(--muted);font-size:12px;padding:10px;">No team members yet.</div>';

  el.innerHTML = userRows +
    '<div style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px;">' +
      '<div style="font-size:11px;font-weight:700;color:var(--accent);letter-spacing:.5px;margin-bottom:10px;">+ ADD TEAM MEMBER</div>' +
      '<div class="frow">' +
        '<div class="fg"><label class="fl" for="mt-new-name">Name</label><input class="fi" id="mt-new-name" placeholder="Mike Johnson"></div>' +
        '<div class="fg"><label class="fl" for="mt-new-email">Email</label><input class="fi" id="mt-new-email" placeholder="mike@company.com" type="email"></div>' +
      '</div>' +
      '<div class="frow">' +
        '<div class="fg"><label class="fl" for="mt-new-pass">Temp Password</label><input class="fi" id="mt-new-pass" placeholder="min 6 chars" type="password"></div>' +
        '<div class="fg"><div class="fl">Role</div><select class="fs" id="mt-new-role"><option value="rep">Rep (Field)</option><option value="admin">Admin</option></select></div>' +
      '</div>' +
      '<button onclick="mtAddMember(\'' + accountId + '\')" class="btn-primary" style="margin-top:4px;">Create Login</button>' +
      '<div id="mt-add-result" style="margin-top:8px;font-size:12px;"></div>' +
    '</div>';
}

function mtToggleEdit(uid){
  const el = document.getElementById('mt-edit-'+uid);
  if(el) el.style.display = el.style.display==='none' ? 'block' : 'none';
}
async function mtSaveEdit(userId, accountId){
  const name  = (document.getElementById('mt-e-name-'+userId)||{}).value||'';
  const phone = (document.getElementById('mt-e-phone-'+userId)||{}).value||'';
  const email = (document.getElementById('mt-e-email-'+userId)||{}).value||'';
  const role  = (document.getElementById('mt-e-role-'+userId)||{}).value||'rep';
  const res   = document.getElementById('mt-edit-result-'+userId);
  if(!name.trim()){ if(res) res.innerHTML='<span style="color:#EF4444">Name is required.</span>'; return; }
  // Update user_profiles
  const {error} = await sb.from('user_profiles').update({name:name.trim(), phone:phone.trim()||null, email:email.trim()||null, role}).eq('id', userId);
  if(error){ if(res) res.innerHTML='<span style="color:#EF4444">'+error.message+'</span>'; return; }
  // Update local cache
  if(_agencyData){
    const p = _agencyData.profiles.find(x=>x.id===userId);
    if(p){ p.name=name.trim(); p.phone=phone.trim(); p.email=email.trim(); p.role=role; }
  }
  if(res) res.innerHTML='<span style="color:#22C55E">Saved!</span>';
  setTimeout(()=>{ renderManageTeam(accountId); renderAgencyAccounts(); }, 800);
}
async function mtChangeRole(userId, accountId){
  const u = _agencyData.profiles.find(p=>p.id===userId);
  if(!u) return;
  const newRole = u.role==='admin' ? 'rep' : 'admin';
  if(!confirm('Change '+( u.name||u.email)+' from '+u.role+' to '+newRole+'?')) return;
  const {error} = await sb.from('user_profiles').update({role:newRole}).eq('id',userId);
  if(error){ toast('Error: '+error.message,'error'); return; }
  // Update local data
  u.role = newRole;
  toast('Role updated to '+newRole,'success');
  renderManageTeam(accountId);
  renderAgencyAccounts();
}

async function mtResetPassword(userId, email){
  const newPass = prompt('Enter new password for '+email+' (min 6 chars):');
  if(!newPass || newPass.length < 6){ toast('Password must be at least 6 characters','error'); return; }
  try {
    await adminAPI('reset-password', { userId, password: newPass });
  } catch(e){ toast('Error: '+e.message,'error'); return; }
  // Mark must_change_password
  await sb.from('user_profiles').update({must_change_password:true}).eq('id',userId);
  toast('✅ Password reset for '+email,'success');
}

async function mtRemoveUser(userId, userName, accountId){
  if(!confirm('Remove '+userName+' from this account? This cannot be undone.')) return;
  // Delete profile first
  const {error:profErr} = await sb.from('user_profiles').delete().eq('id',userId);
  if(profErr){ toast('Error removing profile: '+profErr.message,'error'); return; }
  // Delete auth user via secure API
  try {
    await adminAPI('delete-user', { userId });
  } catch(e){ toast('Error deleting auth user: '+e.message,'error'); return; }
  // Update local data
  _agencyData.profiles = _agencyData.profiles.filter(p=>p.id!==userId);
  toast('✅ '+userName+' removed','success');
  renderManageTeam(accountId);
  renderAgencyAccounts();
}

async function mtAddMember(accountId){
  const name  = document.getElementById('mt-new-name').value.trim();
  const email = document.getElementById('mt-new-email').value.trim();
  const pass  = document.getElementById('mt-new-pass').value.trim();
  const role  = document.getElementById('mt-new-role').value;
  const result= document.getElementById('mt-add-result');
  if(!name||!email||!pass){ toast('Name, email and password required','error'); return; }
  if(pass.length<6){ toast('Password must be at least 6 characters','error'); return; }
  result.textContent='Creating...'; result.style.color='var(--muted)';
  try {
    const adminData = await adminAPI('create-user', { email, password:pass, name });
    const userId = adminData.id;
    if(!userId) throw new Error('No user ID returned');
    const {error:profErr} = await sb.from('user_profiles').insert({
      id:userId, account_id:accountId, role, name, email, must_change_password:true
    });
    if(profErr) throw profErr;
    // Update local data
    _agencyData.profiles.push({id:userId, account_id:accountId, role, name, email, must_change_password:true});
    result.innerHTML = '✅ <strong>'+escHtml(name)+'</strong> created!<br><span style="font-size:11px;color:var(--muted);">Temp password: <code style="background:var(--card2);padding:2px 5px;border-radius:4px;">'+escHtml(pass)+'</code></span>';
    result.style.color='var(--success)';
    renderManageTeam(accountId);
    renderAgencyAccounts();
  } catch(e){
    result.innerHTML='❌ '+escHtml(e.message);
    result.style.color='var(--danger)';
  }
}


// ── DRIP SEQUENCE ────────────────────────────────────────────────────────
let _dripEstId = null;

// Open the Follow-Up Blitz modal from a mail queue item
function openBlitzFromQueue(queueId){
  const item = (S.queue||[]).find(x=>x.id===queueId);
  if(!item){ toast('Queue item not found','error'); return; }
  // Find the estimate: try estId first, then drip_est_id, then address match
  const est = (S.estimates||[]).find(e=>
    e.id===item.estId ||
    e.id===item.drip_est_id ||
    (item.addr && e.addr && e.addr.trim().toLowerCase()===item.addr.trim().toLowerCase())
  );
  if(!est){ toast('Estimate not found — please open the estimate directly and use the Follow-Up Blitz button there.','error'); return; }
  openDripModal(est.id);
}
function openDripModal(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  _dripEstId = estId;
  const lbl = document.getElementById('drip-est-label');
  if(lbl) lbl.textContent = (est.addr||'Unknown address') + ' — ' + (est.owner||'Homeowner') + ' — $'+(est.total||0).toLocaleString();
  // Show existing drip status if any
  if(est.drip && est.drip.steps){
    const active = est.drip.steps.filter(s=>!s.sentAt).length;
    if(active > 0){
      const lbl2 = document.getElementById('drip-est-label');
      if(lbl2) lbl2.textContent += ' · ⚡ Drip active ('+active+' steps pending)';
    }
  }
  refreshDripPostcardPreviews();
  openM('m-drip');
}

function startDripSequence(){
  if(!isPlanAtLeast('agency')){ showPlanUpgradePrompt('Follow-Up Blitz','agency'); return; }
  const est = (S.estimates||[]).find(e=>e.id===_dripEstId);
  if(!est){ toast('Estimate not found','error'); return; }
  // Credit pre-check:
  // If the estimate is already unlocked (pin.unlockQueuedPostcard or pin.unlocked),
  // Step 1 was already queued during unlock — Blitz only needs 2 more credits for Steps 2-5.
  // If NOT already unlocked, Blitz needs 3 credits total (Step 1 + Steps 2-5).
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const step1AlreadyQueued = !!(pin && (pin.unlockQueuedPostcard || pin.unlocked));
  const BLITZ_CREDITS = step1AlreadyQueued ? 2 : 3;
  const paid = S.cfg.mailerCredits || 0;
  if(paid < BLITZ_CREDITS){
    const msg = step1AlreadyQueued
      ? `Need 2 more credits ($8.00) for Steps 2–5 of the Blitz. You have ${paid}. Step 1 is already queued from your unlock.`
      : `Need 3 credits ($12.00) for the full 5-postcard Blitz. You have ${paid}.`;
    toast(msg,'error');
    setTimeout(()=>showBuyCreditsModal(), 800);
    return;
  }
  const d2 = parseInt((document.getElementById('drip-delay-2')||{}).value)||7;
  const d3 = parseInt((document.getElementById('drip-delay-3')||{}).value)||14;
  const d4 = parseInt((document.getElementById('drip-delay-4')||{}).value)||21;
  const d5 = parseInt((document.getElementById('drip-delay-5')||{}).value)||30;
  const now = new Date();
  const msDay = 86400000;
  est.drip = {
    startedAt: now.toISOString(),
    blitz: true,
    step1FromUnlock: step1AlreadyQueued,
    steps: [
      { step:1, type:'postcard', label:'First Postcard',     sendAt: now.toISOString(),                              sentAt: step1AlreadyQueued ? now.toISOString() : null, queueId:null },
      { step:2, type:'postcard', label:'Follow-Up Postcard', sendAt: new Date(now.getTime()+d2*msDay).toISOString(), sentAt:null, queueId:null },
      { step:3, type:'postcard', label:'Urgency Postcard',   sendAt: new Date(now.getTime()+d3*msDay).toISOString(), sentAt:null, queueId:null },
      { step:4, type:'postcard', label:'Final Notice',       sendAt: new Date(now.getTime()+d4*msDay).toISOString(), sentAt:null, queueId:null },
      { step:5, type:'postcard', label:'Final Goodbye',      sendAt: new Date(now.getTime()+d5*msDay).toISOString(), sentAt:null, queueId:null }
    ]
  };
  // Step 1: only queue if NOT already queued from unlock
  if(!step1AlreadyQueued){
    addEstimateToMailQueueWithDripTag(est, 1);
  }
  // Schedule steps 2-5
  [1,2,3,4].forEach(i=>{
    const step = est.drip.steps[i];
    scheduleDripStep(est, step);
  });
  save();
  closeM('m-drip');
  renderEstimatesTab();
  const creditMsg = step1AlreadyQueued
    ? '🔥 Follow-Up Blitz started! Step 1 already queued from unlock. Steps 2–5 scheduled automatically.'
    : '🔥 Follow-Up Blitz started! Step 1 added to Mail Queue. Steps 2–5 scheduled automatically.';
  toast(creditMsg,'success');
}

function addEstimateToMailQueueWithDripTag(est, stepNum){
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const mainStruct = (est.structures||[])[0] || {};
  const matMap = {'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
  const qid = 'q_drip_'+est.id+'_s'+stepNum+'_'+Date.now();
  const qItem = {
    id: qid,
    owner: est.owner||'Homeowner', addr: est.addr||'', email: est.email||'',
    sqft: mainStruct.sqft||0, pitch: mainStruct.pitch||'6/12',
    mat: matMap[String(mainStruct.mat||mainStruct.material)]||'Architectural Shingle',
    structures: est.structures||[], total: est.total||0,
    photo_data: est.photo_data||null, photo_url: est.photo_url||(pin?pin.photo_url:null)||null,
    status: 'pending', lobId:null, mailedAt:null,
    at: new Date().toISOString(),
    drip_step: stepNum, drip_est_id: est.id
  };
  if(!S.queue) S.queue=[];
  S.queue.unshift(qItem);
  sbSaveQueueItem(qItem);
  // Mark step as queued
  if(est.drip && est.drip.steps[stepNum-1]) est.drip.steps[stepNum-1].queueId = qid;
}

function scheduleDripStep(est, step){
  // Store as a scheduled queue item (status='scheduled') — visible in queue but won't send until sendAt date
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const mainStruct = (est.structures||[])[0]||{};
  const matMap = {'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
  const qid = 'q_drip_'+est.id+'_s'+step.step+'_'+Date.now();
  const qItem = {
    id: qid,
    owner: est.owner||'Homeowner', addr: est.addr||'', email: est.email||'',
    sqft: mainStruct.sqft||0, pitch: mainStruct.pitch||'6/12',
    mat: matMap[String(mainStruct.mat||mainStruct.material)]||'Architectural Shingle',
    structures: est.structures||[], total: est.total||0,
    photo_data: est.photo_data||null, photo_url: est.photo_url||(pin?pin.photo_url:null)||null,
    status: 'scheduled', lobId:null, mailedAt:null,
    at: step.sendAt,
    drip_step: step.step, drip_est_id: est.id,
    scheduled_send_at: step.sendAt
  };
  if(!S.queue) S.queue=[];
  S.queue.push(qItem);
  sbSaveQueueItem(qItem);
  step.queueId = qid;
}

function _processDripScheduleSync(){
  const now = new Date();
  let changed = false;
  (S.queue||[]).forEach(item=>{
    if(item.status==='scheduled' && item.scheduled_send_at){
      if(new Date(item.scheduled_send_at) <= now){
        item.status = 'pending';
        if(sb) sb.from('queue').update({status:'pending'}).eq('id',item.id).then(()=>{});
        changed = true;
      }
    }
  });
  if(changed) save();
}

// Check scheduled drip items on app load and when queue renders — promote to 'pending' if sendAt has passed
// Also auto-fires items that are past their sendAt and have a postcard design uploaded
async function autoFireDueDripSteps(){
  if(!S.cfg || !S.cfg.dripEnabled) return; // only fire if drip is enabled
  const now = new Date();
  const due = (S.queue||[]).filter(q=>
    q.drip_step &&
    q.status === 'pending' &&
    q.scheduled_send_at &&
    new Date(q.scheduled_send_at) <= now
    // house photo is generated dynamically — no uploaded design required
  );
  for(const item of due){
    console.log('[BidDrop] Auto-firing drip step', item.drip_step, 'for', item.addr);
    await sendDripPostcard(item.id);
  }
}

async function sendDripPostcard(id){
  const item = S.queue.find(x=>x.id===id);
  if(!item || item.status==='sent') return;
  if(!masterLobKey) await fetchMasterLobKey();
  if(!masterLobKey) return;
  const co = S.cfg.companyName||'Your Roofing Co';
  const fromRaw = S.cfg.companyAddr||'123 Main St, Detroit, MI, 48000';
  const fp = fromRaw.split(',').map(s=>s.trim());
  const tp = item.addr.split(',').map(s=>s.trim());
  const toLine1 = tp[0]||'';
  const toCity  = tp[1]||'';
  let   toState = tp[2]||'MI';
  let   toZip   = tp[3]||'';
  if((!toZip || toZip==='00000') && toState && toState.includes(' ')){
    const parts=toState.split(' '); toZip=parts.pop(); toState=parts.join(' ');
  }
  if(!toZip) toZip='00000';
  toState = toStateAbbr(toState);
  // Generate the front HTML using house photo + configurable step message
  const msg = getDripStepMessage(item.drip_step);
  const frontHtml = buildDripPostcardFrontHtml({
    photoUrl: item.photo_url || item.photo_data || null,
    headline: msg.headline,
    subtext:  msg.subtext,
    companyName: co,
    estimateTotal: item.total || 0,
    address: item.addr || '',
    phone: S.cfg.companyPhone || '',
    logoUrl: S.cfg.logoData || '',
  });
  const backHtml = buildPostcardBack({
    fromName: co,
    fromAddr: fromRaw,
    fromCity: '',
    fromPhone: S.cfg.companyPhone||'',
    logoUrl: S.cfg.logoData||'',
    toName: item.owner||'Homeowner',
    toAddr: item.addr
  });
  try{
    // Send via secure server-side proxy — Lob key never exposed in browser
    const d = await adminAPI('lob-postcard', { payload: {
      description: 'Drip Step '+item.drip_step+' — '+item.addr,
      to:{name:item.owner,address_line1:toLine1,address_city:toCity,address_state:toState,address_zip:toZip,address_country:'US'},
      from:{name:co,address_line1:fp[0]||'123 Main St',address_city:fp[1]||'Detroit',address_state:fp[2]||'MI',address_zip:fp[3]||'48000',address_country:'US'},
      front: frontHtml,
      back: backHtml,
      size: '6x9',
      use_type: 'marketing'
    }});
    if(d && d.id){
      item.status='sent'; item.mailedAt=new Date().toISOString(); item.lobId=d.id;
      sbSaveQueueItem(item).catch(e=>console.warn('Queue save:',e));
      // Auto-unlock print for the linked estimate
      _unlockPrintForEstimate(item.estId);
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; updateCreditBadge(); }
      addAct('Drip Step '+item.drip_step+' postcard mailed to <strong>'+escHtml(item.addr)+'</strong>','converted');
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
          sent_at: new Date().toISOString()
        }).then(({error})=>{ if(error) console.warn('mailer_log insert:',error.message); });
      }
      save(); renderQueue();
      toast('📮 Drip Step '+item.drip_step+' auto-mailed to '+item.addr,'success');
      // Sync to GHL contact timeline (fire-and-forget)
      ghlAddDripNote(item.owner, item.addr, item.drip_step, item.mailedAt).catch(e=>console.warn('[GHL drip note]',e));
    } else {
      item.status='failed'; save(); renderQueue();
      console.warn('[BidDrop] Drip send failed:', d.error?.message);
    }
  } catch(e){ item.status='failed'; save(); renderQueue(); console.warn('[BidDrop] Drip send error:',e); }
}

function processDripSchedule(){
  const now = new Date();
  let changed = false;
  (S.queue||[]).forEach(item=>{
    if(item.status==='scheduled' && item.scheduled_send_at){
      if(new Date(item.scheduled_send_at) <= now){
        item.status = 'pending';
        sbSaveQueueItem(item);
        changed = true;
        toast('📬 Drip step '+item.drip_step+' ready to send for '+item.addr,'info');
      }
    }
  });
  if(changed){ save(); renderQueue(); }
}

// Cancel all pending drip steps for an estimate
function cancelDrip(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est||!est.drip) return;
  const stepIds = est.drip.steps.map(s=>s.queueId).filter(Boolean);
  S.queue = (S.queue||[]).filter(q=>{
    if(stepIds.includes(q.id) && q.status!=='sent'){
      // Remove from Supabase too
      if(sb) sb.from('queue').delete().eq('id',q.id).then(()=>{});
      return false;
    }
    return true;
  });
  delete est.drip;
  save(); renderEstimatesTab(); renderQueue();
  toast('Drip sequence cancelled','info');
}

// toggleDripEnabled is no longer needed — the label+checkbox handles clicks natively via onchange
// Update visual state of drip toggle to match checkbox
function updateDripStepPreview(step){
  const hEl = document.getElementById('s-drip'+step+'-headline');
  const sEl = document.getElementById('s-drip'+step+'-subtext');
  const defaults = {
    2: { headline: 'Still thinking it over?', subtext: "Your estimate is still valid. We'd love to help." },
    3: { headline: 'Storm season is coming.', subtext: "Now's the time to protect your home. Call us today." },
    4: { headline: 'Final notice.', subtext: 'Your estimate expires soon. Secure your spot before prices rise.' },
    5: { headline: "We're still here for you.", subtext: "Your roof won't fix itself. Let's get started today." },
    6: { headline: 'One last thing...', subtext: "We'd love to earn your business. Call us anytime." },
  };
  const d = defaults[step] || { headline: '', subtext: '' };
  const headline = (hEl && hEl.value) ? hEl.value : d.headline;
  const subtext  = (sEl && sEl.value) ? sEl.value : d.subtext;
  const ph = document.getElementById('s-drip'+step+'-preview-headline');
  const ps = document.getElementById('s-drip'+step+'-preview-subtext');
  if(ph) ph.textContent = headline;
  if(ps) ps.textContent = subtext;
}
function updateAllDripPreviews(){
  [2,3,4,5,6].forEach(s=>updateDripStepPreview(s));
}
function openDripPreviewLightbox(step){
  const stepLabels = { 2:'Step 2 — Follow-Up · Day 7', 3:'Step 3 — Urgency · Day 14', 4:'Step 4 — Final Notice · Day 21 (FREE)', 5:'Step 5 — Re-Engage · Day 30 (FREE)', 6:'Step 6 — Final Goodbye · Day 45 (FREE)' };
  const accentColors = { 2:'rgba(242,92,5,.9)', 3:'rgba(242,92,5,.9)', 4:'rgba(34,197,94,.9)', 5:'rgba(34,197,94,.9)', 6:'rgba(34,197,94,.9)' };
  const dayBadges = { 2:'DAY 7', 3:'DAY 14', 4:'DAY 21 · FREE', 5:'DAY 30 · FREE', 6:'DAY 45 · FREE' };
  const hEl = document.getElementById('s-drip'+step+'-headline');
  const sEl = document.getElementById('s-drip'+step+'-subtext');
  const defaults = {
    2: { headline: 'Still thinking it over?', subtext: "Your estimate is still valid. We'd love to help." },
    3: { headline: 'Storm season is coming.', subtext: "Now's the time to protect your home. Call us today." },
    4: { headline: 'Final notice.', subtext: 'Your estimate expires soon. Secure your spot before prices rise.' },
    5: { headline: "We're still here for you.", subtext: "Your roof won't fix itself. Let's get started today." },
    6: { headline: 'One last thing...', subtext: "We'd love to earn your business. Call us anytime." },
  };
  const d = defaults[step] || { headline: '', subtext: '' };
  const headline = (hEl && hEl.value) ? hEl.value : d.headline;
  const subtext  = (sEl && sEl.value) ? sEl.value : d.subtext;
  const accent   = accentColors[step];
  const badge    = dayBadges[step];
  const label    = stepLabels[step] || 'Step '+step;
  const existing = document.getElementById('drip-preview-lightbox');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'drip-preview-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:50000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.7);letter-spacing:.5px;text-transform:uppercase;">${label}</div>
    <div style="position:relative;width:540px;height:360px;border-radius:12px;overflow:hidden;background:#111827;box-shadow:0 20px 60px rgba(0,0,0,.6);">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.05) 0%,rgba(0,0,0,.7) 100%);"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;color:rgba(255,255,255,.25);font-size:14px;">🏠 House photo will appear here</div>
      </div>
      <div style="position:absolute;bottom:0;left:0;right:0;padding:28px;">
        <div style="font-size:28px;font-weight:900;color:#fff;line-height:1.2;margin-bottom:8px;text-shadow:0 2px 8px rgba(0,0,0,.5);">${headline}</div>
        <div style="font-size:16px;color:rgba(255,255,255,.85);line-height:1.5;text-shadow:0 1px 4px rgba(0,0,0,.5);">${subtext}</div>
      </div>
      <div style="position:absolute;top:16px;left:16px;background:${accent};border-radius:5px;padding:4px 12px;font-size:12px;font-weight:800;color:#fff;letter-spacing:.5px;">${badge}</div>
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,.4);">Click outside or press Esc to close</div>
  `;
  document.body.appendChild(overlay);
  const closeOnEsc = (e)=>{ if(e.key==='Escape'){ overlay.remove(); document.removeEventListener('keydown',closeOnEsc); } };
  document.addEventListener('keydown',closeOnEsc);
}
function updateDripToggleLabel(){
  const ck = document.getElementById('s-drip-enabled');
  const lbl = document.getElementById('drip-toggle-label');
  const track = document.getElementById('drip-toggle-track');
  const knob = document.getElementById('drip-toggle-knob');
  if(!ck) return;
  const on = ck.checked;
  if(lbl) lbl.textContent = on ? 'On' : 'Off';
  if(track) track.style.background = on ? 'var(--accent)' : 'var(--border)';
  if(knob) knob.style.left = on ? '22px' : '2px';
}

// ═══════════════════════════════
