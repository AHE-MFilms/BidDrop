// ── Apply Global Content Defaults (SuperAdmin CMS) ────────────────────────────
// Sets static copy from DB. Called once after API response. Roofer-specific
// overrides happen later in renderPage() and take precedence over these.
function applyGlobalContent(){
  const g=_gcd;
  if(!g||!Object.keys(g).length)return;
  // Gate screen
  const setTxt=(id,val)=>{const el=document.getElementById(id);if(el&&val)el.textContent=val;};
  const setInner=(id,val)=>{const el=document.getElementById(id);if(el&&val)el.innerHTML=val;};
  setTxt('ep-gate-title',   g.gateTitle);
  setTxt('ep-gate-sub',     g.gateSub);
  setTxt('ep-gate-privacy', g.gatePrivacy);
  if(g.gateBtn){const b=document.getElementById('ep-gate-btn');if(b)b.textContent=g.gateBtn;}
  // Hero
  setTxt('ep-hero-tag-text', g.heroTag);
  if(g.heroHeadline){
    const h=document.getElementById('ep-hero-headline');
    if(h)h.innerHTML=g.heroHeadline.replace(/\n/g,'<br>');
  }
  // Rep bio
  setTxt('ep-repbio-title', g.repTitle);
  setTxt('ep-repbio-notes', g.repBio);
  setTxt('ep-video-title',  g.videoTitle);
  // About / Reviews / CTA
  if(g.aboutTitle){
    const el=document.getElementById('ep-about-title');
    if(el)el.innerHTML=g.aboutTitle.replace(/\n/g,'<br>');
  }
  if(g.reviewsTitle){
    const el=document.getElementById('ep-reviews-title');
    if(el)el.innerHTML=g.reviewsTitle.replace(/\n/g,'<br>');
  }
  if(g.ctaTitle){
    const el=document.getElementById('ep-cta-title');
    if(el)el.innerHTML=g.ctaTitle.replace(/\n/g,'<br>');
  }
  setTxt('ep-cta-sub', g.ctaSub);
}

// ── Init ───────────────────────────────────────────────────────────────────
function init(){
  const parts=location.pathname.split('/').filter(Boolean);
  _estId=parts[parts.length-1]||'';
  if(!_estId){showError();return;}
  fetch(API_BASE+'/api/estimate?action=get&id='+encodeURIComponent(_estId))
    .then(r=>r.json())
    .then(d=>{
      if(!d||!d.estimate){showError();return;}
      _est=d.estimate;_acct=d.account;
      // Apply global content defaults from SuperAdmin CMS (site-wide fallbacks)
      _gcd=d.globalContent||{};
      applyGlobalContent();
      // ── Expiration check (non-blocking — page stays live, just shows a notice) ──
      if(_est.expiresAt){
        const expiry=new Date(_est.expiresAt);
        if(!isNaN(expiry) && expiry < new Date()){
          // Show a slim banner but DO NOT block the page
          const banner=$('ep-expired-banner');
          if(banner){
            const co=_acct&&_acct.companyName?_acct.companyName:'the roofing company';
            const ph=_acct&&(_acct.companyPhone||_acct.phone);
            const expStr=expiry.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
            const phStr=ph?' — Call '+ph:'';
            $('ep-expired-banner-msg').textContent='⏰ This estimate expired on '+expStr+'. Contact '+co+' for an updated quote'+phStr+'.';
            banner.style.display='block';
          }
        }
      }
      // Use server-computed prices (overhead/margin never sent to browser)
      if(_acct.prices){
        Object.assign(_prices,_acct.prices);
      } else {
        // Fallback: compute client-side if server didn't supply (old API)
        const MATS=['1.0','1.3','1.8','2.5'];
        MATS.forEach(k=>{_prices[k]=computePrice(_est.structures||[],k,_acct);});
      }
      // Show gate if account has it enabled (always show for now)
      showGate();
    })
    .catch(()=>showError());
}

function showGate(){
  $('ep-loading').style.display='none';
  // Pre-fill gate logo with company logo or name
  if(_acct){
    const gl=$('ep-gate-logo');
    if(_acct.logoData){gl.innerHTML=`<img src="${_acct.logoData}" alt="">`;}
    else{gl.innerHTML=`<div class="ep-gate-logo-text" style="color:var(--amber-lt);">${esc(_acct.companyName||'BidDrop')}</div>`;}
  }
  // Show the property address so homeowner knows it's real and personalized
  if(_est && _est.addr){
    const addrBox=$('ep-gate-address-box'), addrText=$('ep-gate-address-text');
    if(addrBox && addrText){
      addrText.textContent=_est.addr;
      addrBox.style.display='flex';
    }
  }
  // Pre-load homeowner name from the estimate so GHL matches the existing contact
  if(_est && _est.owner){
    const parts=(_est.owner||'').trim().split(/\s+/);
    const gFirst=$('g-first'), gLast=$('g-last');
    if(gFirst && !gFirst.value) gFirst.value=parts[0]||'';
    if(gLast  && !gLast.value)  gLast.value=parts.slice(1).join(' ')||'';
  }
  // Pre-load email/phone if already on the estimate
  if(_est && _est.email){
    const gEmail=$('g-email'); if(gEmail && !gEmail.value) gEmail.value=_est.email;
  }
  if(_est && _est.phone){
    const gPhone=$('g-phone'); if(gPhone && !gPhone.value) gPhone.value=fmtPhoneDisplay(_est.phone);
  }
  $('ep-gate').style.display='flex';
  // Scroll to top of gate
  $('ep-gate').scrollTop=0;
}

// Format a phone number as (xxx) xxx-xxxx while the user types
function fmtPhoneDisplay(v){
  const d=(v||'').replace(/\D/g,'').slice(0,10);
  if(d.length<=3) return d;
  if(d.length<=6) return '('+d.slice(0,3)+') '+d.slice(3);
  return '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6);
}
function onGatePhoneInput(el){
  const raw=(el.value||'').replace(/\D/g,'').slice(0,10);
  el.value=fmtPhoneDisplay(raw);
  // Always move cursor to end — prevents the "digits inserting in the middle" glitch
  const end=el.value.length;
  try{el.setSelectionRange(end,end);}catch(e){}
}

function submitGate(){
  const first=($('g-first').value||'').trim();
  const last=($('g-last').value||'').trim();
  const email=($('g-email').value||'').trim();
  const phone=($('g-phone').value||'').trim();
  const phoneDigits=phone.replace(/\D/g,'');
  let valid=true;
  // Phone is required
  const phoneInput=$('g-phone'), phoneErr=$('ep-err-phone');
  if(!phoneDigits || phoneDigits.length < 7){
    phoneInput.classList.add('ep-err');
    phoneErr.classList.add('show');
    valid=false;
  } else {
    phoneInput.classList.remove('ep-err');
    phoneErr.classList.remove('show');
  }
  // Email is required and must be valid
  const emailInput=$('g-email'), emailErr=$('ep-err-email');
  if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    emailInput.classList.add('ep-err');
    emailErr.classList.add('show');
    valid=false;
  } else {
    emailInput.classList.remove('ep-err');
    emailErr.classList.remove('show');
  }
  if(!valid){
    // Scroll to first error
    const firstErr=document.querySelector('.ep-err');
    if(firstErr) firstErr.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  // Consent checkbox
  const consentEl=$('g-consent');
  if(consentEl && !consentEl.checked){
    consentEl.style.outline='2px solid #E89A48';
    consentEl.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  if(consentEl) consentEl.style.outline='';
  $('ep-gate').style.display='none';
  buildPage(first,last,email,phone);
  // Capture lead
  try{fetch(API_BASE+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'capture_lead',estimate_id:_estId,first_name:first,last_name:last,email,phone})});}catch(e){}
}
