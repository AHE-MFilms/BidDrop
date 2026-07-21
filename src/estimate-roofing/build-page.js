// ── Build Page ─────────────────────────────────────────────────────────────
// ── Brand color auto-contrast helper ──────────────────────────────────────
// Converts any brand color to a version readable on dark (#0D1117) backgrounds.
// If the color is too dark (luminance < 0.18), it's lightened to a safe gold.
function hexToRgb(h){
  h=h.replace('#','');
  if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};
}
function relativeLuminance(h){
  const{r,g,b}=hexToRgb(h);
  const c=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
function brandForDark(hex){
  // Ensure minimum contrast ratio ~4.5:1 against #0D1117 (lum≈0.003)
  // Threshold: if lum < 0.18, lighten to a warm gold that always reads well
  if(!hex||!/^#[0-9a-fA-F]{3,6}$/.test(hex))return'#E89A48';
  const lum=relativeLuminance(hex);
  if(lum>=0.18)return hex; // already light enough
  // Blend toward #FFD08A until readable
  const{r,g,b}=hexToRgb(hex);
  const t=Math.min(1,(0.18-lum)/0.18);
  const tr=0xFF,tg=0xD0,tb=0x8A;
  const nr=Math.round(r+(tr-r)*t);
  const ng=Math.round(g+(tg-g)*t);
  const nb=Math.round(b+(tb-b)*t);
  return'#'+[nr,ng,nb].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function buildPage(firstName,lastName,email,phone){
  const est=_est,acct=_acct;
  const brand=acct.brandColor||'#C97D2E';
  // Auto-lighten brand color for dark-background pages so any client color stays readable
  const brandDark=brandForDark(brand);
  // Inject brand color as CSS var
  document.documentElement.style.setProperty('--brand',brandDark);
  document.documentElement.style.setProperty('--amber',brandDark);
  // Derived amber-lt (lighter)
  document.documentElement.style.setProperty('--amber-lt',brandDark);

  // ── Topbar ──
  $('ep-co-name').textContent=acct.companyName||'Your Roofing Company';
  $('ep-co-tagline').textContent=(acct.yearsInBusiness?'Est. '+(new Date().getFullYear()-parseInt(acct.yearsInBusiness))+' · ':'')+' Licensed & Insured';
  const badge=$('ep-co-badge');
  if(acct.logoData){badge.innerHTML=`<img src="${acct.logoData}" alt="">`;}  
  else{badge.textContent=initials(acct.companyName);}
  // ── Sticky bar ──
  $('ep-sticky-name').textContent=acct.companyName||'Your Roofing Company';
  const yib=acct.yearsInBusiness?'Est. '+(new Date().getFullYear()-parseInt(acct.yearsInBusiness))+' · ':'';
  $('ep-sticky-tag').textContent=yib+'Licensed & Insured';
  const stickyLogo=$('ep-sticky-logo');
  if(acct.logoData){
    stickyLogo.innerHTML=`<img src="${acct.logoData}" alt="" style="width:100%;height:100%;object-fit:contain;">`;
  } else {
    $('ep-sticky-logo-init').textContent=initials(acct.companyName);
  }
  const acctPhone=acct.companyPhone||acct.phone||'';
  if(acctPhone){
    $('ep-sticky-phone').href='tel:'+acctPhone.replace(/[^0-9+]/g,'');
    $('ep-sticky-phone-num').textContent=acctPhone;
    $('ep-sticky-phone').addEventListener('click',function(){
      firePixels('CallClicked',{value:_est?_est.total:0,currency:'USD',content_name:_est?_est.addr:''});
      try{fetch(API_BASE+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'track_event',id:_estId,event:'call_click',data:{}})});}catch(e){}
    },{once:true});
  } else {
    $('ep-sticky-phone').style.display='none';
  }
  const schedLink=acct.bookingUrl||acct.scheduleLink||acct.calendarLink||'';
  if(schedLink){
    $('ep-sticky-cta').href=schedLink;
    $('ep-sticky-cta').target='_blank';
    $('ep-sticky-cta').addEventListener('click',function(){
      firePixels('BookingClicked',{value:_est?_est.total:0,currency:'USD',content_name:_est?_est.addr:''});
      try{fetch(API_BASE+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'track_event',id:_estId,event:'booking_click',data:{}})});}catch(e){}
    },{once:true});
  } else{$('ep-sticky-cta').style.display='none';}

  // ── Property card ──
  const structs=est.structures||[];
  const rawSqft=est.sqft||(structs[0]&&structs[0].sqft)||0;
  const pitch=structs[0]?pitchLabel(structs[0].pitch):'—';
  const estDate=fmtDate(est.savedAt);
  const expDate=est.expiresAt?fmtDate(est.expiresAt):'';
  const repName=est.rep||acct.repName||'';
  const propItems=[
    {icon:'🏠',val:est.addr||'Property Address',lbl:'Property Address'},
    {icon:'📋',val:_estId.replace('est_','EST-'),lbl:'Estimate Number'},
    estDate?{icon:'📅',val:estDate,lbl:'Estimate Date'}:null,
    repName?{icon:'👷',val:repName,lbl:'Your Rep'}:null,
    expDate?{icon:'⏱️',val:(est.expiresAt&&new Date(est.expiresAt)<new Date()?'Expired — ':'Valid Through ')+expDate,lbl:'Estimate Expiration'}:null,
  ].filter(Boolean);
  $('ep-prop-row').innerHTML=propItems.map(p=>`
    <div class="ep-prop-item">
      <div class="ep-prop-icon">${p.icon}</div>
      <div>
        <strong>${esc(p.val)}</strong>
        <span>${esc(p.lbl)}</span>
      </div>
    </div>`).join('');

  // ── Hero photo ──
  const heroImg=est.photoUrl||((est.allPhotos&&est.allPhotos.front&&est.allPhotos.front[0])||null);
  if(heroImg){
    $('ep-hero-photo-wrap').innerHTML=`<img class="ep-hero-photo" src="${heroImg}" alt="Property photo" loading="eager">`;
  }

  // ── Materials ──
  const MATS=[
    {key:'1.3',name:'Architectural',   desc:'Most popular — dimensional look, 30-year warranty.',       mc:'#3b82f6',badge:'Most Popular',bb:'rgba(59,130,246,.12)', bc:'#3b82f6'},
    {key:'1.8',name:'Designer Shingle',desc:'Premium curb appeal with enhanced impact resistance.',     mc:'#8b5cf6',badge:'Premium',     bb:'rgba(139,92,246,.12)', bc:'#8b5cf6'},
    {key:'2.5',name:'Metal Roofing',   desc:'50+ year lifespan, energy efficient, maintenance-free.',  mc:'#10b981',badge:'Best Value',  bb:'rgba(16,185,129,.12)', bc:'#10b981'},
  ];
  // ── Price override: if set, hide material selector and show fixed price ──
  if(est.priceOverride){
    const matSec=$('ep-mat-section');
    if(matSec) matSec.style.display='none';
    $('ep-price').textContent=Math.round(est.priceOverride).toLocaleString();
    $('ep-monthly').textContent=acct.financingEnabled!==false?fmtMo(est.priceOverride,acct.financingApr,acct.financingTerm):'';
    if(acct.financingEnabled!==false&&acct.financingApr){const _d=$('ep-monthly-dagger');const _d2=$('ep-fin-inline-disc');if(_d)_d.style.display='block';if(_d2)_d2.style.display='block';}
  } else {
    const avail=MATS.filter(m=>(_prices[m.key]||0)>0);
    if(!avail.length){$('ep-mat-grid').closest('section').style.display='none';}
    const estMat=est.mat||'1.3';
    const selMat=avail.find(m=>m.key===estMat)||avail[0];
    window._M=avail;window._E=est;window._A=acct;window._P=_prices;

    $('ep-mat-grid').innerHTML=avail.map(m=>{
      const p=_prices[m.key]||0;
      const mo=acct.financingEnabled!==false?fmtMo(p,acct.financingApr,acct.financingTerm):'';
      const act=m.key===(selMat?.key||'1.3');
      return`<div class="ep-mat-card${act?' active':''}" style="--mc:${m.mc};" onclick="selectMat('${m.key}')">
        <div class="ep-mat-check">✓</div>
        <span class="ep-mat-badge" style="background:${m.bb};color:${m.bc};">${m.badge}</span>
        <div class="ep-mat-name">${m.name}</div>
        <div class="ep-mat-desc">${m.desc}</div>
        <div class="ep-mat-price" style="color:${m.mc};">${fmt(p)}</div>
        ${mo?`<div class="ep-mat-mo">${mo}</div>`:''}
      </div>`;
    }).join('');

    const sp=_prices[selMat?.key||'1.3']||0;
    $('ep-price').textContent=Math.round(sp).toLocaleString();
    $('ep-monthly').textContent=acct.financingEnabled!==false?fmtMo(sp,acct.financingApr,acct.financingTerm):'';
    if(acct.financingEnabled!==false&&acct.financingApr){const _d=$('ep-monthly-dagger');const _d2=$('ep-fin-inline-disc');if(_d)_d.style.display='block';if(_d2)_d2.style.display='block';}
  }

  // ── Roof Details ──
  $('ep-detail-grid').innerHTML=`
    <div class="ep-detail-box"><div class="ep-detail-val" style="color:${brand};">${rawSqft?Math.round(rawSqft).toLocaleString()+' sq ft':'—'}</div><div class="ep-detail-label">Roof Area</div></div>
    <div class="ep-detail-box"><div class="ep-detail-val">${pitch}</div><div class="ep-detail-label">Roof Pitch</div></div>
    ${acct.warrantyYears?`<div class="ep-detail-box"><div class="ep-detail-val" style="color:${brand};">${esc(acct.warrantyYears)} yr</div><div class="ep-detail-label">Warranty</div></div>`:''}`;

  // ── Greeting ──
  const greetingEl=$('ep-greeting');
  const greetingText=$('ep-greeting-text');
  if(greetingEl&&greetingText){
    const fn=firstName||est.homeownerFirstName||'';
    const addr=est.addr?est.addr.split(',')[0]:'';
    const coName=acct.companyName||'our team';
    let p1=fn?`<strong>${esc(fn)}</strong>, we looked at your home via satellite`:`We analyzed the property via satellite`;
    if(addr) p1+=` at <strong>${esc(addr)}</strong>`;
    p1+=` \u2014 and based on the satellite imagery and property data, it may be time for a roof replacement. We built this estimate so you have a real number before anyone knocks on your door.`;
    const p2=`We used satellite imagery and property data to build this estimate — no scheduled inspection required, no surprises. Your number is right here.`;
    const p3=`Questions? ${esc(coName)} is here to help.`;
    greetingText.innerHTML=`<p class="ep-greeting-text">${p1}</p><p class="ep-greeting-text">${p2}</p><p class="ep-greeting-text">${p3}</p>`;
    greetingEl.style.display='block';
  }
  // ── Photos ──
  renderPhotos(est);

  // ── Video ──
  const vid=est.repVideoUrl||'';
  if(vid){
    let embedHtml='';
    // YouTube (watch, youtu.be, embed, shorts)
    const ytMatch=vid.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
    if(ytMatch) embedHtml=`<iframe src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&playsinline=1" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe>`;
    // Vimeo (standard + unlisted with hash)
    if(!embedHtml){
      const vmMatch=vid.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?/);
      if(vmMatch){ const h=vmMatch[2]?`&h=${vmMatch[2]}`:''; embedHtml=`<iframe src="https://player.vimeo.com/video/${vmMatch[1]}?badge=0&autopause=0${h}" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen></iframe>`; }
    }
    // Loom
    if(!embedHtml){
      const lmMatch=vid.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
      if(lmMatch) embedHtml=`<iframe src="https://www.loom.com/embed/${lmMatch[1]}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true" allowfullscreen></iframe>`;
    }
    if(embedHtml){
      $('ep-video-section').style.display='block';
      $('ep-video-inner').innerHTML=embedHtml;
      $('ep-video-title').textContent=(_gcd.videoTitle||'A message from your contractor').replace(/your (estimator|rep)/i,'your contractor');
    }
  }

  // ── Rep Bio Row (top of page) — always use acct.repName (company owner from settings) ──
  const repDisplayName=acct.repName||acct.companyName||'Your Estimator';
  // Rep title: roofer setting > global CMS default > hardcoded
  const repDisplayTitle=(acct.repTitle||_gcd.repTitle||'Project Advisor');
  const ini=initials(repDisplayName);
  $('ep-repbio-name').textContent=repDisplayName;
  $('ep-repbio-title').textContent=repDisplayTitle+' · '+(acct.companyName||'');
  if(est.inspectionNote){
    // Roofer wrote a custom note for this specific estimate — always use it
    $('ep-repbio-notes').textContent=est.inspectionNote;
  } else {
    // Fall back: global CMS default > hardcoded default
    $('ep-repbio-notes').textContent=_gcd.repBio||'Welcome! This report was prepared to give you a clear starting point for your roofing project. When you\'re ready, we\'ll review the details with you, answer your questions, and confirm everything during an on-site visit.';
  }
  if(acct.headshot){
    $('ep-repbio-avatar').outerHTML=`<img class="ep-repbio-avatar" src="${acct.headshot}" alt="${esc(repDisplayName)}">`;
  } else {
    $('ep-repbio-avatar').textContent=ini;
  }
  // ── About ── (always show company owner from account settings, not per-estimate rep)
  const ownerName=acct.repName||acct.companyName||'Your Estimator';
  const ownerTitle=acct.repTitle||'Owner';
  const ownerIni=initials(ownerName);
  if(acct.headshot){
    $('ep-owner-photo-wrap').innerHTML=`<img class="ep-owner-photo" src="${acct.headshot}" alt="">`;
  } else {
    $('ep-owner-initials').textContent=ownerIni;
  }
  $('ep-owner-name').textContent=ownerName;
  $('ep-owner-title').textContent=ownerTitle+' · '+(acct.companyName||'');
  let ownerLinks='';
  if(acct.companyPhone)ownerLinks+=`<a href="tel:${acct.companyPhone}" class="ep-owner-link"><span class="contact-icon">📞</span>${esc(acct.companyPhone)}</a>`;
  if(acct.bookingUrl)ownerLinks+=`<a href="${acct.bookingUrl}" target="_blank" class="ep-owner-link"><span class="contact-icon">📅</span>Schedule a Free Visit</a>`;
  $('ep-owner-links').innerHTML=ownerLinks;

  $('ep-about-stats').innerHTML=[
    {num:(acct.yearsInBusiness||'5').replace(/\++$/,'')+'+'  ,lbl:'Years in Business'},
    {num:(acct.warrantyYears||'10')+'yr'  ,lbl:'Warranty'},
    {num:'5★'                             ,lbl:'Google Rated'},
  ].map(s=>`<div class="ep-stat-box"><div class="ep-stat-num">${esc(s.num)}</div><div class="ep-stat-label">${esc(s.lbl)}</div></div>`).join('');

  if(acct.companyBio)$('ep-about-body').textContent=acct.companyBio;
  else $('ep-about-body').textContent='We\'re a family-run roofing company that treats every home like our own. Straightforward pricing, quality craftsmanship, and a team that stands behind every project \u2014 start to finish.';

  const diffs=[acct.diff1,acct.diff2,acct.diff3,acct.diff4,acct.diff5,acct.diff6].filter(Boolean);
  $('ep-creds').innerHTML=diffs.map(d=>`<li><div class="ep-check">✓</div>${esc(d)}</li>`).join('');
  $('ep-service-badges').innerHTML=['Roof Replacement','Storm Damage','Insurance Claims','Gutters','Skylights','Free Estimates'].map(s=>`<span class="ep-service-badge">${s}</span>`).join('');

  // ── Reviews ──
  loadReviews(acct);

  // ── CTA ──
  let ctaBtns='';
  if(acct.companyPhone)ctaBtns+=`<a href="tel:${acct.companyPhone}" class="ep-btn-primary">📞 Call Now</a>`;
  if(acct.bookingUrl)ctaBtns+=`<a href="${acct.bookingUrl}" target="_blank" class="ep-btn-secondary">📅 Schedule a Free Visit</a>`;
  ctaBtns+=`<button class="ep-btn-secondary" onclick="shareEst()">🔗 Share Estimate</button>`;
  $('ep-cta-btns').innerHTML=ctaBtns;

  let strip='';
  if(acct.companyPhone)strip+=`<a href="tel:${acct.companyPhone}" class="ep-contact-item"><span class="ep-contact-icon">📞</span><div class="ep-contact-label">Call Us</div><div class="ep-contact-value">${esc(acct.companyPhone)}</div></a>`;
  if(acct.bookingUrl)strip+=`<a href="${acct.bookingUrl}" target="_blank" class="ep-contact-item"><span class="ep-contact-icon">📅</span><div class="ep-contact-label">Schedule</div><div class="ep-contact-value">Free Visit</div></a>`;
  if(acct.companyAddr)strip+=`<div class="ep-contact-item"><span class="ep-contact-icon">📍</span><div class="ep-contact-label">Office</div><div class="ep-contact-value">${esc(acct.companyAddr)}</div></div>`;
  $('ep-contact-strip').innerHTML=strip;

  // ── Footer ──
  $('ep-footer-co').textContent='© '+new Date().getFullYear()+' '+(acct.companyName||'Your Roofing Company');

  // ── Legal disclaimers ──
  (function(){
    const legalEl = $('ep-legal-block');
    if(!legalEl) return;
    const lines = [];
    // Estimate disclaimer
    lines.push('This project report is a preliminary estimate based on satellite-derived property measurements and current regional material pricing. It is not a contract, guarantee, or final bid. Actual costs may vary based on roof pitch, structural complexity, local labor rates, material availability, and findings from an on-site inspection. A licensed contractor must perform a physical assessment before any final pricing is confirmed.');
    // Financing disclaimer
    if(acct.financingEnabled !== false && acct.financingApr && acct.financingTerm){
      lines.push('Monthly payment estimates are for illustrative purposes only. Example: a loan of the estimated project amount at ' + (acct.financingApr||9.99) + '% APR for ' + (acct.financingTerm||60) + ' months with $0 down. Actual rate, term, and monthly payment will vary based on creditworthiness and lender approval. Financing is subject to credit approval by a third-party lender. BidDrop and the contractor listed above are not lenders and do not guarantee financing availability.');
    }
    // Satellite / AI disclaimer
    lines.push('Roof measurements are generated using aerial imagery and AI-assisted analysis. Results are estimates only and may differ from field measurements. BidDrop makes no warranty, express or implied, as to the accuracy of satellite-derived measurements.');
    legalEl.innerHTML = lines.map((t,i) => `<p style="font-size:10.5px;color:rgba(255,255,255,.38);line-height:1.65;max-width:760px;margin:0 auto ${i<lines.length-1?'12px':'16px'};text-align:center;">${t}</p>`).join('');
  })();

  // ── Show page ──
  $('ep-page').style.display='block';
  initFade();
  trackView();
  // ── Fire retargeting pixels ──────────────────────────────────────────────
  firePixels('EstimateViewed', { value: est.total || 0, currency: 'USD', content_name: est.addr || '' });
  // ── Inject dynamic SEO (title, meta, schema) after data is loaded ────────
  injectSEO();
}
