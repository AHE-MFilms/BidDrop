// BidDrop — Authentication: sign-in bootstrap, login/logout, password reset
// Depends on: state.js (S, sb, currentUser, currentProfile, currentAccount), api.js (load, save, accountRowToCfg, adminAPI), ui.js (toast, openM, closeM, goTab)

async function onSignedIn(user){
  currentUser = user;
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  try {
    // Load profile — session.user is already valid because we deferred
    // this call outside the onAuthStateChange mutex via setTimeout
    const {data:profile, error:profErr} = await sb.from('user_profiles').select('*').eq('id', user.id).single();

    if(profErr || !profile){
      // First time — check if super admin by email
      if(currentUser.email === OWNER_EMAIL){
        const {error:insErr} = await sb.from('user_profiles').insert({
          id: currentUser.id, account_id: null, role: 'super_admin',
          name: 'John Bujak', email: currentUser.email
        });
        if(insErr) throw new Error('Could not create super_admin profile: '+insErr.message);
        const {data:p2} = await sb.from('user_profiles').select('*').eq('id', currentUser.id).single();
        currentProfile = p2;
      } else {
        throw new Error('No profile found. Contact your administrator.');
      }
    } else {
      currentProfile = profile;
    }

    // Load account config
    if(currentProfile && currentProfile.account_id){
      const {data:account, error:acctErr} = await sb.from('accounts').select('*').eq('id', currentProfile.account_id).single();
      if(acctErr) throw new Error('Could not load account: '+acctErr.message);
      currentAccount = account;
      if(account) S.cfg = accountRowToCfg(account);
    }

    // Block access if account is deactivated (trial expired, manually deactivated, etc.)
    if(currentAccount && currentAccount.active === false){
      showLoginScreen();
      if(err) err.innerHTML = '<div style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px 18px;text-align:left;margin-top:8px;">'
        + '<p style="color:#fca5a5;font-weight:700;margin:0 0 6px 0;font-size:15px;">&#9940; Account Deactivated</p>'
        + '<p style="color:#fca5a5;margin:0;font-size:13px;line-height:1.5;">Your BidDrop account has been deactivated. This may be because your free trial has ended.</p>'
        + '<p style="color:#fca5a5;margin:8px 0 0 0;font-size:13px;">Please contact <a href="mailto:support@biddrop.io" style="color:#F97316;">support@biddrop.io</a> to reactivate your account.</p>'
        + '</div>';
      try { await sb.auth.signOut(); } catch(_){}
      return;
    }

    // Check if user must change their password on first login
    if(currentProfile.must_change_password){
      showSetNewPassword();
      window._mustChangePwUserId = currentUser.id;
      return;
    }
    // Hide login, show app
    hideLoginScreen();
    // Only apply localStorage cache if no account was loaded from DB.
    // When an account IS loaded, the DB is the source of truth and we must
    // NOT let stale localStorage data overwrite the correct company config.
    if(!currentAccount) load();
    applyBrand();
    // Agency model: fetch master Lob key from AHE account (service role — clients cannot read this)
    await fetchMasterLobKey();
    // Fetch platform-wide Blitz Promo config from agency account row
    fetchBlitzPromo();
    initMap();
    setTimeout(restoreStormState, 1500);
    setTimeout(initStormNotifications, 2000);
    renderStructures();
    updatePreview();
    applyRoleUI();
    if(isSuperAdmin()) initCoSwitcher();
    // Load data from Supabase
    await loadPinsFromSupabase();
    await loadQueueFromSupabase();
    if(currentAccount) subscribeRealtime();
    toast('Welcome, '+(currentProfile.name||currentUser.email).split(' ')[0]+'! 👋','success');
    updateOfflineBanner();
    // Initialize credit badge
    updateCreditBadge();
    // Fetch live credit balance in background on every login
    (async()=>{
      try{
        const sess2 = (await sb.auth.getSession()).data.session;
        if(sess2){
          const _vaId2 = currentAccount?.id ? '&viewingAccountId='+encodeURIComponent(currentAccount.id) : '';
          const r2 = await fetch('/api/credits?action=balance'+_vaId2,{ headers:{ 'Authorization':'Bearer '+sess2.access_token } });
          if(r2.ok){ const b2=await r2.json(); S.cfg.mailerCredits=b2.paid_credits; S.cfg.freeMailerCreditsUsed=b2.free_used; updateCreditBadge(); }
        }
      }catch(_){}
    })();
    // Handle Stripe redirect params
    const _urlParams = new URLSearchParams(window.location.search);
    if(_urlParams.get('credits_success')){
      history.replaceState({}, '', window.location.pathname);
      // Refresh credit balance from server
      try{
        const _vaIdBal = currentAccount?.id ? '&viewingAccountId='+encodeURIComponent(currentAccount.id) : '';
        const bal = await fetch('/api/credits?action=balance'+_vaIdBal, { headers:{ 'Authorization':'Bearer '+(await sb.auth.getSession()).data.session?.access_token } });
        if(bal.ok){ const b=await bal.json(); S.cfg.mailerCredits=b.paid_credits; S.cfg.freeMailerCreditsUsed=b.free_used; updateCreditBadge(); }
      }catch(_){}
      toast('✅ Credits added to your account!','success');
      showBuyCreditsModal();
    } else if(_urlParams.get('credits_cancelled')){
      history.replaceState({}, '', window.location.pathname);
      toast('Credit purchase cancelled.','info');
    }
    // PWA install is now handled by the header button (#pwa-hdr-btn) — no banner needed
    // Mark app as fully initialized — prevents duplicate onSignedIn calls on token refresh
    _appInitialized = true;
    // Always open on the canvas map after login
    goTab('map');

  } catch(e) {
    console.error('[onSignedIn] error:', e);
    if(err) err.textContent = 'Login error: '+e.message;
    if(btn){ btn.textContent='Sign In'; btn.disabled=false; }
    showLoginScreen();
    try { await sb.auth.signOut(); } catch(_){}
  }
}

function onSignedOut(){
  _appInitialized = false; // allow onSignedIn to run again on next login
  currentUser = null;
  currentProfile = null;
  currentAccount = null;
  S.pins = [];
  S.estimates = [];
  S.queue = [];
  totalPinCount = 0;
  pinListPage = 0;
  _lastViewportBounds = null;
  if(clusterGroup){ try{ clusterGroup.clearLayers(); }catch(e){} clusterGroup=null; }
  markers = {};
  if(realtimeChannel){ sb.removeChannel(realtimeChannel); realtimeChannel=null; }
  clearZonesState();
  // Clear cached company config so the next user doesn't inherit a stale account
  try{ localStorage.removeItem('bd_v1'); }catch(e){}
  showLoginScreen();
}

function showLoginScreen(){
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('main-app').style.display='none';
  // Always reset the login form to a clean, ready state
  // This prevents the "Signing in..." freeze after sign-out
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  if(btn){ btn.textContent='Sign In'; btn.disabled=false; }
  if(err){ err.textContent=''; }
  // Ensure the login card is visible (not stuck on forgot-pw or set-pw views)
  const card = document.getElementById('login-card');
  const forgot = document.getElementById('forgot-pw-view');
  const setPw = document.getElementById('set-pw-view');
  if(card){ card.style.display='block'; }
  if(forgot){ forgot.style.display='none'; }
  if(setPw){ setPw.style.display='none'; }
}

function hideLoginScreen(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('main-app').style.display='flex';
}

async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value.trim();
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-error');
  if(!email||!pass){err.textContent='Enter email and password.';return;}
  btn.textContent='Signing in...'; btn.disabled=true; err.textContent='';
  // Sign in — onAuthStateChange SIGNED_IN will fire and load the app
  const {error} = await sb.auth.signInWithPassword({email, password:pass});
  if(error){
    err.textContent = error.message;
    btn.textContent='Sign In'; btn.disabled=false;
  }
  // On success: onAuthStateChange SIGNED_IN fires → onSignedIn handles the rest
}

// ─── FORGOT PASSWORD FLOW ───────────────────────────────────────────────────

function showForgotPassword(){
  document.getElementById('login-card').style.display = 'none';
  document.getElementById('forgot-pw-view').style.display = 'block';
  document.getElementById('set-pw-view').style.display = 'none';
  document.getElementById('forgot-msg').textContent = '';
  document.getElementById('forgot-email').value = document.getElementById('login-email').value || '';
  document.getElementById('forgot-email').focus();
}

function showSignIn(){
  document.getElementById('login-card').style.display = 'block';
  document.getElementById('forgot-pw-view').style.display = 'none';
  document.getElementById('set-pw-view').style.display = 'none';
}

function showSetNewPassword(){
  // Called when Supabase fires PASSWORD_RECOVERY event (user clicked reset link)
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-card').style.display = 'none';
  document.getElementById('forgot-pw-view').style.display = 'none';
  document.getElementById('set-pw-view').style.display = 'block';
  document.getElementById('set-pw-msg').textContent = '';
  setTimeout(()=>document.getElementById('new-pw').focus(), 100);
}

async function doForgotPassword(){
  const email = document.getElementById('forgot-email').value.trim();
  const btn   = document.getElementById('forgot-btn');
  const msg   = document.getElementById('forgot-msg');
  if(!email){ msg.style.color='var(--danger)'; msg.textContent='Please enter your email address.'; return; }
  btn.textContent = 'Sending...'; btn.disabled = true; msg.textContent = '';
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://biddrop.us'
    });
    if(error) throw error;
    msg.style.color = '#1a7f4b';
    msg.textContent = '✅ Reset link sent! Check your email.';
    btn.textContent = 'Sent!';
    // Don't re-enable — prevent double sends
  } catch(e){
    msg.style.color = 'var(--danger)';
    msg.textContent = 'Error: '+(e.message||'Could not send reset email.');
    btn.textContent = 'Send Reset Link'; btn.disabled = false;
  }
}

async function doSetNewPassword(){
  const pw1  = document.getElementById('new-pw').value;
  const pw2  = document.getElementById('new-pw-confirm').value;
  const btn  = document.getElementById('set-pw-btn');
  const msg  = document.getElementById('set-pw-msg');
  if(!pw1 || pw1.length < 6){ msg.style.color='var(--danger)'; msg.textContent='Password must be at least 6 characters.'; return; }
  if(pw1 !== pw2){ msg.style.color='var(--danger)'; msg.textContent='Passwords do not match.'; return; }
  btn.textContent = 'Updating...'; btn.disabled = true; msg.textContent = '';
  try {
    const { error } = await sb.auth.updateUser({ password: pw1 });
    if(error) throw error;
    window._inPasswordRecovery = false;
    // Clear the recovery hash from the URL so a page refresh doesn't re-trigger recovery
    if(window.history && window.history.replaceState){
      window.history.replaceState(null, '', window.location.pathname);
    }
    msg.style.color = '#1a7f4b';
    msg.textContent = '✅ Password updated! Loading your account...';
    // Clear must_change_password flag if this was a first-login forced change
    if(window._mustChangePwUserId){
      await sb.from('user_profiles')
        .update({ must_change_password: false })
        .eq('id', window._mustChangePwUserId);
      window._mustChangePwUserId = null;
      // Update the in-memory profile so onSignedIn doesn't intercept again
      if(currentProfile) currentProfile.must_change_password = false;
    }
    // Supabase keeps the session active after updateUser — sign in to the app
    setTimeout(async ()=>{
      const { data:{ session } } = await sb.auth.getSession();
      if(session) await onSignedIn(session.user);
      else showSignIn();
    }, 1200);
  } catch(e){
    msg.style.color = 'var(--danger)';
    msg.textContent = 'Error: '+(e.message||'Could not update password.');
    btn.textContent = 'Update Password'; btn.disabled = false;
  }
}

async function doLogout(){
  // Wipe all Supabase localStorage keys BEFORE signOut() so the client
  // starts clean — this clears any stale locks without creating a new client
  // (creating a new client would break the onAuthStateChange listener)
  Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
  try { await sb.auth.signOut(); } catch(e) { console.warn('signOut error:', e); }
  // onAuthStateChange SIGNED_OUT fires → onSignedOut() → showLoginScreen()
}
