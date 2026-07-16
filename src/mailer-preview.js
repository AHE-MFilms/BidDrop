// src/mailer-preview.js
// Estimator live preview panel — letter/postcard/proposal mode switcher,
// canvas postcard modal, fullscreen preview, proposal preview refresh.
// Depends on: S.cfg, S.pins, currentAccount, calcP() (estimates-calc.js),
//             buildProposalHTML() (proposal.js), toast()
// Extracted from index.html — Tier 5 modularization

function updatePreview(){
  const owner  = document.getElementById('e-owner').value || 'Homeowner';
  const addr   = document.getElementById('e-addr').value  || '—';
  const cfg    = S.cfg;
  const co     = cfg.companyName   || 'Your Roofing Co';
  const coAddr = cfg.companyAddr   || '';
  const ph     = cfg.companyPhone  || '(000) 000-0000';
  const color  = cfg.brandColor    || '#F25C05';
  const rep    = cfg.repName       || co;
  const repTitle= cfg.repTitle      || '';
  const hsPos  = cfg.headshotPos   || '30';
  const lic    = cfg.licenseNum    || '';
  const yrs    = cfg.yearsInBusiness || '5+';
  const warr   = cfg.warrantyYears || '10';
  const hook   = cfg.hookLetter    || 'We tapped your address on a satellite map, measured your roof remotely, and built this estimate before we ever reached out. You\u2019re not getting a sales pitch \u2014 you\u2019re getting a real number, built from real data, with no visit required to get it.';
  const why    = cfg.whyReceived   || 'We used satellite imagery to measure your roof remotely — square footage, pitch, and condition indicators — and built a real price based on your home’s actual data. No guessing. No inspection required to get started.';
  // Auto-calculate financing
  const finEnabled = cfg.financingEnabled !== false;
  const finApr  = parseFloat(cfg.financingApr)  || 9.99;
  const finTerm = parseInt(cfg.financingTerm)   || 60;
  const finDown = parseFloat(cfg.financingDown) || 0;
  function calcMonthly(total){
    const loan = total * (1 - finDown/100);
    if(!loan) return 0;
    const r = finApr / 100 / 12;
    if(r === 0) return Math.round(loan / finTerm);
    return Math.round(loan * r * Math.pow(1+r,finTerm) / (Math.pow(1+r,finTerm)-1));
  }
  // finMo/finTrm computed after grandTotal below

  const logoImg = cfg.logoData
    ? '<img src="'+cfg.logoData+'" style="max-height:46px;max-width:150px;object-fit:contain;display:block;">'
    : '<div style="font-family:\'Oswald\',sans-serif;font-size:20px;font-weight:700;color:'+color+';">'+escHtml(co)+'</div>';

  const _letterFrontPhoto = ((window._allPhotos && window._allPhotos.front)||[])[0] || window._homePhotoData || null;
  const homePhoto = _letterFrontPhoto
    ? '<img src="'+_letterFrontPhoto+'" style="width:100%;max-height:200px;object-fit:cover;border-radius:6px;margin-bottom:16px;display:block;">'
    : '';
  // Damage photos section for estimate/PDF
  const dmgPhotos = (window._damagePhotos && window._damagePhotos.length) ? window._damagePhotos : [];
  // Collect all per-structure photos
  const structPhotoBlocks = structures.filter(s=>s.photos&&s.photos.length).map((s,si)=>{
    const cols = Math.min(s.photos.length, 3);
    return '<div style="margin-bottom:12px;">'+
      '<div style="font-size:9px;font-weight:700;color:#F25C05;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Bldg '+(si+1)+' — '+escHtml(s.name||'Structure '+(si+1))+'</div>'+
      '<div style="display:grid;grid-template-columns:repeat('+cols+',1fr);gap:6px;">'+
      s.photos.slice(0,3).map((src,pi)=>'<div><img src="'+src+'" style="width:100%;height:110px;object-fit:cover;border-radius:6px;display:block;"><div style="font-size:9px;color:#888;text-align:center;margin-top:2px;">Photo '+(pi+1)+'</div></div>').join('')+
      '</div></div>';
  }).join('');
  const hasAnyPhotos = dmgPhotos.length >= 1 || structPhotoBlocks.length > 0;
  const damageSection = hasAnyPhotos
    ? '<div style="margin:18px 0;padding:14px;background:#f8f8f8;border-radius:8px;border:1px solid #e0e0e0;">'+
        '<div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#F25C05;margin-bottom:10px;">DAMAGE ASSESSMENT — PHOTOS</div>'+
        (dmgPhotos.length >= 1
          ? '<div style="display:grid;grid-template-columns:repeat('+Math.min(dmgPhotos.length,3)+',1fr);gap:8px;margin-bottom:'+(structPhotoBlocks.length?'14px':'0')+';">'+
            dmgPhotos.slice(0,3).map((src,i)=>'<div><img src="'+src+'" style="width:100%;height:120px;object-fit:cover;border-radius:6px;display:block;"><div style="font-size:9px;color:#888;text-align:center;margin-top:3px;">Photo '+(i+1)+'</div></div>').join('')+
            '</div>' : '')+
        structPhotoBlocks+
        '<div style="font-size:10px;color:#666;margin-top:8px;font-style:italic;">Photos taken at time of assessment. Damage visible includes missing/broken shingles, granule loss, and structural wear.</div>'+
      '</div>'
    : '';
  // Damage photos for the mailer letter
  const damageMailerSection = hasAnyPhotos
    ? '<div style="margin:14px 0;padding:10px;background:#f9f9f9;border-radius:6px;border:1px solid #e8e8e8;">'+
        '<div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#F25C05;margin-bottom:8px;">DAMAGE ASSESSMENT PHOTOS</div>'+
        (dmgPhotos.length >= 1
          ? '<div style="display:grid;grid-template-columns:repeat('+Math.min(dmgPhotos.length,3)+',1fr);gap:6px;margin-bottom:'+(structPhotoBlocks.length?'10px':'0')+';">'+
            dmgPhotos.slice(0,3).map(src=>'<img src="'+src+'" style="width:100%;height:100px;object-fit:cover;border-radius:4px;display:block;">').join('')+
            '</div>' : '')+
        structures.filter(s=>s.photos&&s.photos.length).map((s,si)=>{
          return '<div style="margin-bottom:8px;"><div style="font-size:8px;font-weight:700;color:#F25C05;margin-bottom:4px;">Bldg '+(si+1)+' — '+escHtml(s.name||'Structure '+(si+1))+'</div>'+
            '<div style="display:grid;grid-template-columns:repeat('+Math.min(s.photos.length,3)+',1fr);gap:4px;">'+
            s.photos.slice(0,3).map(src=>'<img src="'+src+'" style="width:100%;height:80px;object-fit:cover;border-radius:4px;display:block;">').join('')+
            '</div></div>';
        }).join('')+
      '</div>'
    : '';
  const headshot    = cfg.headshot    || null;
  const review1     = cfg.review1     || null;
  const review2     = cfg.review2     || null;
  const bookingUrl  = cfg.bookingUrl  || '';
  // QR: always point to homeowner estimate page; fall back to booking URL if no ID
  const _previewEstId = window._editingEstimateId || null;
  const _previewSlug = cfg.companyName ? cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') : 'roofing';
  const _previewEstUrl = _previewEstId
    ? 'https://biddrop.us/'+_previewSlug+'/'+encodeURIComponent(_previewEstId)
    : (bookingUrl || 'https://biddrop.us');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=6&data='+encodeURIComponent(_previewEstUrl);

  // ── Calc totals ────────────────────────────────────────────
  // Trade-aware variables
  const _activeTr = window._activeTrade;
  const _isNonRoofing = _activeTr && _activeTr !== 'roofing';
  const TRADE_WHY_MAP = {
    solar:"We analyzed your roof's solar potential and identified your home as an excellent candidate for solar panels. Your roof orientation, pitch, and sun exposure make it ideal for generating clean energy and reducing your monthly utility bills.",
    fencing:"We identified your property as a great candidate for a new fence installation. Whether for privacy, security, or curb appeal, we can provide a professional installation with quality materials built to last.",
    siding:"We tapped your home on the map and built this estimate based on your property data. New siding improves energy efficiency, protects against moisture, and dramatically boosts curb appeal.",
    gutters:"We inspected your home's drainage system and identified your gutters as a candidate for replacement or upgrade. Properly functioning gutters protect your foundation, landscaping, and siding from water damage.",
    insulation:"We tapped your home on the map and built this estimate based on your property data. Improved insulation can reduce heating and cooling costs by up to 20% and improve year-round comfort.",
    paint:"We tapped your home on the map and built this estimate based on your property data. Exterior painting protects against weather damage, prevents wood rot, and significantly improves curb appeal.",
    doors:"We identified your home as a candidate for door replacement or upgrade. New entry and interior doors improve energy efficiency, security, and the overall aesthetic of your home.",
    windows:"We identified your home as a candidate for window replacement. New energy-efficient windows can reduce heating and cooling costs by up to 15% and eliminate drafts and condensation issues."
  };
  const TRADE_HOOK_MAP = {
    solar:"Most homeowners don't realize how much they're overpaying for electricity. I skip the sales pitch and lead with real numbers — here's exactly what solar would cost and save for your home.",
    fencing:"Most homeowners get overcharged for fencing because contractors don't lead with their pricing. I do things differently — here's your upfront, itemized fence estimate with no surprises.",
    siding:"Most homeowners are surprised by how much new siding can transform a home — and by how affordable it can be when you work with a contractor who leads with transparent pricing.",
    gutters:"Most homeowners don't think about gutters until there's a problem. We identify homes that need attention before damage occurs and send your estimate directly — no visit required.",
    insulation:"Most homeowners are losing hundreds of dollars a year through poor insulation without knowing it. I skip the energy audit sales pitch and lead directly with what it would cost to fix it.",
    paint:"Most homeowners are tired of waiting through a long sales visit just to get a number. We build your estimate upfront and send it directly, so you can decide on your own terms.",
    doors:"Most homeowners don't realize how much a new door can improve their home's security, energy efficiency, and curb appeal. I lead with transparent pricing so you can decide without pressure.",
    windows:"Most homeowners are overpaying for heating and cooling because of old, inefficient windows. I skip the sales pitch and lead with a real number — here's what new windows would cost for your home."
  };
  const _tradeWhy = _isNonRoofing ? (TRADE_WHY_MAP[_activeTr] || why) : why;
  const _tradeHook = _isNonRoofing ? (TRADE_HOOK_MAP[_activeTr] || hook) : hook;
  let grandTotal = 0;
  let structSectionsP2 = '';  // page 2 detail boxes
  if(structures.length){
    structures.forEach((s,i)=>{
      const sp = calcStructPrice(s);
      grandTotal += sp;
      const sq = ((parseFloat(s.sqft)||0)/100*1.12*(parseFloat(s.pitch)||1.118)).toFixed(1);
      const col = i===0 ? color : '#444';
      structSectionsP2 +=
        '<div class="ml-box" style="border:2px solid '+col+';margin-bottom:14px;">'+
        '<div class="ml-box-hdr" style="background:'+col+';">'+escHtml((s.name||'Structure '+(i+1)).toUpperCase())+'</div>'+
        '<div class="ml-rows">'+
        '<div class="ml-row"><span class="rl">Roof Area</span><span class="rv">'+(s.sqft?Number(s.sqft).toLocaleString()+' sq ft':'—')+' ('+sq+' sq)</span></div>'+
        '<div class="ml-row"><span class="rl">Pitch</span><span class="rv">'+(PITCHLBL[s.pitch]||s.pitch)+'</span></div>'+
        '<div class="ml-row"><span class="rl">Material</span><span class="rv">'+(MATLBL[s.mat]||s.mat)+'</span></div>'+
        '<div class="ml-row"><span class="rl">Stories</span><span class="rv">'+s.stories+'</span></div>'+
        '<div class="ml-row"><span class="rl">Tear-off & Disposal</span><span class="rv">Included</span></div>'+
        '<div class="ml-row"><span class="rl">Felt / Synthetic Underlayment</span><span class="rv">Included</span></div>'+
        '</div>'+
        '<div class="ml-subtotal" style="background:'+col+';">'+
        '<span class="ml-subtotal-lbl">'+escHtml((s.name||'Structure').toUpperCase())+' SUBTOTAL</span>'+
        '<span class="ml-subtotal-amt">$'+sp.toLocaleString()+'</span>'+
        '</div></div>';
    });

    // Add-ons
    let addsTotal=0; let addRows='';
    const c2=S.cfg;
    if(document.getElementById('a-sky')&&document.getElementById('a-sky').checked){
      const q=parseInt(document.getElementById('a-sky-q').value)||1;
      const amt=(parseFloat(c2.costSkylight)||375)*q;
      addsTotal+=amt;
      addRows+='<div class="ml-row"><span class="rl">Skylights (×'+q+')</span><span class="rv">$'+amt.toLocaleString()+'</span></div>';
    }
    if(document.getElementById('a-chim')&&document.getElementById('a-chim').checked){
      const amt=parseFloat(c2.costChimney)||295; addsTotal+=amt;
      addRows+='<div class="ml-row"><span class="rl">Chimney Flashing</span><span class="rv">$'+amt+'</span></div>';
    }
    if(document.getElementById('a-gut')&&document.getElementById('a-gut').checked){
      const lf=parseInt(document.getElementById('a-gut-q').value)||120;
      const amt=(parseFloat(c2.costGutter)||9)*lf; addsTotal+=amt;
      addRows+='<div class="ml-row"><span class="rl">Gutters ('+lf+' lf)</span><span class="rv">$'+amt.toLocaleString()+'</span></div>';
    }
    if(document.getElementById('a-iws')&&document.getElementById('a-iws').checked){
      const iwsAmt=(parseFloat(c2.costIceWater)||42)*structures.reduce(function(sum,s){var sqft=parseFloat(s.sqft)||0;var pitchMult=parseFloat(s.pitch)||1.118;return sum+(sqft/100*1.10*pitchMult);},0);
      addsTotal+=iwsAmt;
      addRows+='<div class="ml-row"><span class="rl">Ice & Water Shield</span><span class="rv">$'+iwsAmt.toLocaleString()+'</span></div>';
    }
    const solarAmt=getSolarPrice();
    if(solarAmt>0){
      addsTotal+=solarAmt;
      const solarKw=parseFloat((document.getElementById('a-solar-kw')||{}).value||0);
      const solarLabel=solarKw>0?'Solar ('+solarKw+' kW)':'Solar Add-On';
      addRows+='<div class="ml-row"><span class="rl">&#9728;&#65039; '+solarLabel+'</span><span class="rv">$'+solarAmt.toLocaleString()+'</span></div>';
    }
    if(addsTotal){
      grandTotal+=addsTotal;
      structSectionsP2+='<div class="ml-box" style="border:2px solid #888;margin-bottom:14px;">'+
        '<div class="ml-box-hdr" style="background:#666;">ADD-ONS</div>'+
        '<div class="ml-rows">'+addRows+'</div>'+
        '<div class="ml-subtotal" style="background:#555;"><span class="ml-subtotal-lbl">ADD-ONS SUBTOTAL</span><span class="ml-subtotal-amt">$'+addsTotal.toLocaleString()+'</span></div>'+
        '</div>';
    }
  } else {
    structSectionsP2='<div style="padding:20px;text-align:center;color:#999;font-style:italic;">No structures added yet.</div>';
  }

  // If non-roofing trade is active, override grandTotal with trade total
  if(_isNonRoofing){
    const _bundleItems = window._tradeBundle || [];
    const _bundleTotal = _bundleItems.reduce((s,b)=>s+b.total,0);
    const _currentTotal = window._currentTradeTotal || 0;
    const _alreadyInBundle = _bundleItems.some(b=>b.trade===_activeTr);
    const _tradeGrand = _bundleTotal > 0
      ? (_bundleTotal + (!_alreadyInBundle && _currentTotal > 0 ? _currentTotal : 0))
      : _currentTotal;
    if(_tradeGrand > 0) grandTotal = _tradeGrand;
  }
  // Compute finMo now that grandTotal is final
  const finMo  = (finEnabled && grandTotal) ? calcMonthly(grandTotal) : 0;
  const finTrm = finApr+'% APR · '+finTerm+' mo · $0 down';
  const finDisc = 'Financing estimate based on '+finApr+'% APR, '+finTerm+'-month term, subject to credit approval.';


  const pageHdr = (pageNum) =>
    '<div class="ml-hdr">'+
    '<div>'+logoImg+'<div class="ml-co-info" style="margin-top:4px;">'+escHtml(coAddr).replace(/,/g,'<br>')+'<br>'+escHtml(ph)+(lic?'<br>'+escHtml(lic):'')+'</div></div>'+
    '<div class="ml-addr-blk"><strong>'+escHtml(owner)+'</strong><br>'+escHtml(addr).split(',').join('<br>')+'<br><span style="font-size:9px;color:#aaa;margin-top:3px;display:block;">Page '+pageNum+' of 4</span></div>'+
    '</div>'+
    '<div class="ml-stripe" style="background:'+color+';"></div>';

  const pageFooter = () =>
    '<div class="ml-footer" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">'+
    '<span>'+escHtml(co)+' · '+escHtml(ph)+(lic?' · '+escHtml(lic):'')+' · Licensed &amp; Insured · '+new Date().getFullYear()+'</span>'+
    '<img src="'+AHE_LOGO+'" style="height:22px;opacity:.7;object-fit:contain;flex-shrink:0;">'+
    '</div>';

  // ── Differentiators ──────────────────────────
  const diffs = [
    cfg.diff1||'Licensed, Bonded & Insured',
    cfg.diff2||'Manufacturer Certified',
    cfg.diff3||'Itemized Pricing for Transparency',
    cfg.diff4||'Workmanship Warranty',
    cfg.diff5||'Financing Available',
    cfg.diff6||'Local Crews'
  ].filter(d=>d.trim());
  const competitorNegs = ['Insufficient','Rarely','No','State Minimum','No','Outside Crews'];

  // ── Services for Page 4 ──────────────────────
  const svcDefs = [];
  if(cfg.offerSiding) svcDefs.push({icon:'🏠',name:'SIDING',bullets:['James Hardie Install','30 Year Warranty','Fiber Cement Strength']});
  if(cfg.offerWindows) svcDefs.push({icon:'🪟',name:'WINDOWS',bullets:['Energy Efficient','100% Virgin Vinyl','Low-E Glass']});
  if(cfg.offerGutters) svcDefs.push({icon:'🌊',name:'GUTTERS',bullets:['Seamless Gutters','Hidden Fasteners','Rust-Free Aluminum']});
  if(cfg.offerSolar) svcDefs.push({icon:'☀️',name:'SOLAR',bullets:['Reduce Energy Bills','Federal Tax Credit','Increase Home Value']});
  if(cfg.offerCustom&&cfg.offerCustom.trim()) svcDefs.push({icon:'⭐',name:cfg.offerCustom.toUpperCase(),bullets:[]});

  const servicesHtml = svcDefs.length
    ? '<div class="ml-services-grid">'+
        svcDefs.map(s=>
          '<div class="ml-svc-card" style="border-color:'+color+'33;">'+
          '<div class="ml-svc-icon">'+s.icon+'</div>'+
          '<div class="ml-svc-name" style="color:'+color+';">'+escHtml(s.name)+'</div>'+
          '</div>'
        ).join('')+
      '</div>'
    : '';

  const refAmt  = cfg.referralAmt  || '250';
  const refText = cfg.referralText || 'For every customer you send our way who moves forward with a project, we\'ll send you a Visa gift card as a thank you.';

  // ════════════════════════════════════════════
  //  PAGE 1 — Hook + Price
  // ════════════════════════════════════════════
  const ctaBand =
        // Dark CTA strip with strong contrast
        '<div style="background:#1a1a1a;display:flex;align-items:center;gap:0;">'+
        '<div style="flex:1;padding:11px 18px;border-right:1px solid rgba(255,255,255,.1);">'+
        '<div style="font-size:8px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:2px;">Call or Text to Schedule</div>'+
        '<div style="font-family:Oswald,sans-serif;font-size:26px;font-weight:700;color:#fff;white-space:nowrap;line-height:1;">'+escHtml(ph)+'</div>'+
        '<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:3px;">Estimate locked 30 days &nbsp;·&nbsp; Built by satellite &nbsp;·&nbsp; No visit required</div>'+
        '</div>'+
        '<div style="flex:0 0 auto;padding:10px 16px;display:flex;flex-direction:column;align-items:center;gap:3px;">'+
        (qrUrl
          ? '<img src="'+qrUrl+'" style="width:68px;height:68px;border-radius:5px;background:#fff;display:block;">'+
            '<div style="font-size:7px;color:rgba(255,255,255,.45);letter-spacing:.8px;text-transform:uppercase;margin-top:2px;">Scan to Book</div>'
          : '<div style="width:68px;height:68px;border:1px dashed rgba(255,255,255,.2);border-radius:5px;display:flex;align-items:center;justify-content:center;">'+
            '<div style="font-size:8px;color:rgba(255,255,255,.25);text-align:center;line-height:1.4;">Add URL<br>for QR</div>'+
            '</div>'+
            '<div style="font-size:7px;color:rgba(255,255,255,.25);letter-spacing:.8px;text-transform:uppercase;margin-top:2px;">Scan to Book</div>'
        )+
        '</div>'+
        '</div>';

    const page1 =
    '<div class="ml-page" data-page="1">'+
    pageHdr(1)+
    '<div class="ml-body">'+
    // Photo + greeting side by side
    '<div style="display:table;width:100%;border-collapse:separate;border-spacing:12px 0;margin:0 -12px 10px;">'+
    '<div style="display:table-cell;width:160px;vertical-align:top;">'+
    (_letterFrontPhoto
      ? '<div style="width:160px;height:130px;border-radius:6px;overflow:hidden;border:1px solid #e8e8e8;">'+
        '<img src="'+_letterFrontPhoto+'" style="width:100%;height:100%;object-fit:cover;display:block;">'+
        '</div>'
      : '<div style="width:160px;height:130px;border-radius:6px;border:1px dashed #ddd;"></div>'
    )+
    '</div>'+
    '<div style="display:table-cell;vertical-align:top;">'+
    '<div class="ml-greeting">Dear '+escHtml(owner)+',</div>'+
    '<p style="font-size:11px;line-height:1.6;color:#333;margin:5px 0 0;">'+escHtml(_tradeHook||hook)+'</p>'+
    '</div>'+
    '</div>'+

    // Two-column: Why Received (left) + How We Stand Out (right)
    '<div style="display:table;width:100%;border-collapse:separate;border-spacing:10px 0;margin:0 -10px;">'+
    '<div style="display:table-cell;width:50%;vertical-align:top;">'+
    '<div class="ml-section-hdr" style="background:'+color+';display:block;">Why Was This Sent to You?</div>'+
    '<p style="font-size:10px;line-height:1.6;color:#555;margin:4px 0 0;">'+escHtml(_tradeWhy||why)+'</p>'+damageMailerSection+
    '</div>'+
    '<div style="display:table-cell;width:50%;vertical-align:top;">'+
    '<div class="ml-section-hdr" style="background:#222;display:block;">How We Stand Out</div>'+
    '<ul class="ml-diff-list" style="margin:4px 0 0;">'+
    diffs.map(d=>'<li><span class="ml-diff-check" style="color:'+color+';">✓</span><span>'+escHtml(d)+'</span></li>').join('')+
    '</ul>'+
    '</div>'+
    '</div>'+

    // Hero band
    (headshot
      ? // HEADSHOT: price left, circle rep right
        '<div style="position:relative;overflow:hidden;background:'+color+';padding:18px 20px 18px 20px;">'+
        // Subtle geometric SVG overlay
        '<svg style="position:absolute;right:0;top:0;width:55%;height:100%;opacity:.08;" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">'+
        '<polygon points="0,0 200,0 200,120" fill="#fff"/>'+
        '<circle cx="160" cy="20" r="70" fill="none" stroke="#fff" stroke-width="18"/>'+
        '<circle cx="160" cy="20" r="100" fill="none" stroke="#fff" stroke-width="10"/>'+
        '</svg>'+
        // Left: price stack
        '<div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;">'+
        '<div>'+
        '<div style="font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:4px;">Your Total Investment</div>'+
        '<div style="font-family:Oswald,sans-serif;font-size:44px;font-weight:700;line-height:1;color:#fff;">$'+(grandTotal?grandTotal.toLocaleString():'—')+'</div>'+
        (finMo
          ? '<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;background:rgba(0,0,0,.25);border-radius:20px;padding:4px 12px;">'+
            '<span style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.7);">Financing</span>'+
            '<span style="font-family:Oswald,sans-serif;font-size:16px;font-weight:700;color:#fff;">$'+finMo.toLocaleString()+'/mo</span>'+
            '<span style="font-size:9px;color:rgba(255,255,255,.6);">'+escHtml(finTrm)+'</span>'+
            '</div>'
          : ''
        )+
        '</div>'+
        // Right: rep circle
        '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">'+
        '<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.9);box-shadow:0 0 0 4px rgba(255,255,255,.2);">'+
        '<img src="'+headshot+'" style="width:100%;height:100%;object-fit:cover;object-position:center '+hsPos+'%;">'+
        '</div>'+
        '<div style="text-align:center;">'+
        '<div style="font-family:Oswald,sans-serif;font-size:12px;font-weight:700;color:#fff;letter-spacing:.3px;">'+escHtml(rep)+'</div>'+
        (repTitle?'<div style="font-size:8px;color:rgba(255,255,255,.7);letter-spacing:.6px;text-transform:uppercase;">'+escHtml(repTitle)+'</div>':'')+
        '</div>'+
        '</div>'+
        '</div>'+
        '</div>'+
        ctaBand
      : // NO HEADSHOT: centered price
        '<div style="position:relative;overflow:hidden;background:'+color+';padding:18px 20px 18px 20px;">'+
        // Subtle geometric SVG overlay
        '<svg style="position:absolute;right:0;top:0;width:55%;height:100%;opacity:.08;" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">'+
        '<polygon points="0,0 200,0 200,120" fill="#fff"/>'+
        '<circle cx="160" cy="20" r="70" fill="none" stroke="#fff" stroke-width="18"/>'+
        '<circle cx="160" cy="20" r="100" fill="none" stroke="#fff" stroke-width="10"/>'+
        '</svg>'+
        // Left: price stack
        '<div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;">'+
        '<div>'+
        '<div style="font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:4px;">Your Total Investment</div>'+
        '<div style="font-family:Oswald,sans-serif;font-size:44px;font-weight:700;line-height:1;color:#fff;">$'+(grandTotal?grandTotal.toLocaleString():'—')+'</div>'+
        (finMo
          ? '<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;background:rgba(0,0,0,.25);border-radius:20px;padding:4px 12px;">'+
            '<span style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,.7);">Financing</span>'+
            '<span style="font-family:Oswald,sans-serif;font-size:16px;font-weight:700;color:#fff;">$'+finMo.toLocaleString()+'/mo</span>'+
            '<span style="font-size:9px;color:rgba(255,255,255,.6);">'+escHtml(finTrm)+'</span>'+
            '</div>'
          : ''
        )+
        '</div>'+
        '</div>'+
        '</div>'+
        ctaBand
    )+
    '</div>'+
    (finMo?'<div style="padding:5px 24px 0;font-size:8px;color:#aaa;font-style:italic;">'+finDisc+'</div>':'')+
    pageFooter()+
    '</div>';

  // ════════════════════════════════════════════
  //  PAGE 2 — Estimate Detail
  // ════════════════════════════════════════════
  const page2 =
    '<div class="ml-page" data-page="2">'+
    pageHdr(2)+
    '<div class="ml-body">'+
    '<div style="font-family:Oswald,sans-serif;font-size:18px;font-weight:700;letter-spacing:.5px;margin-bottom:2px;color:#1a1a1a;">ROOF ESTIMATE</div>'+
    '<div style="font-size:10px;color:#888;margin-bottom:10px;">Detailed breakdown for '+escHtml(addr)+'</div>'+
    structSectionsP2+
    '<div class="ml-grand">'+
    '<span class="ml-grand-lbl">TOTAL INVESTMENT</span>'+
    '<span class="ml-grand-amt">$'+(grandTotal?grandTotal.toLocaleString():'0')+'</span>'+
    '</div>'+
    (finMo?'<div style="text-align:center;margin-top:7px;font-size:11px;color:#555;">Est. Financing: <strong style="color:'+color+';">$'+finMo.toLocaleString()+'/mo</strong> · '+escHtml(finTrm)+'</div>':'')+
    '<div style="margin-top:10px;padding:9px 12px;background:#f8f8f8;border-radius:6px;font-size:9px;color:#888;line-height:1.65;">'+
    '<strong style="color:#555;display:block;margin-bottom:3px;">Every installation includes:</strong>'+
    'Complete tear-off &amp; disposal · Synthetic underlayment · Ice &amp; water shield · Drip edge flashing · Ridge cap shingles · Workmanship warranty · Licensed &amp; insured crews'+
    '</div>'+
    '<div style="margin-top:7px;font-size:8px;color:#bbb;line-height:1.5;">Estimates are created using satellite imagery. Final pricing confirmed at assessment. Factors that may affect price include skylights, chimneys, special vents, plywood decking, and manufacturer price increases.</div>'+
    '</div>'+
    pageFooter()+
    '</div>';

  // ════════════════════════════════════════════
  //  PAGE 2 — PROPOSAL: Good / Better / Best
  // ════════════════════════════════════════════
  // Compute tax
  const taxRate = parseFloat(S.cfg.taxRate)||0;
  const taxAmt  = Math.round(grandTotal * taxRate / 100);
  const totalWithTax = grandTotal + taxAmt;
  // GBB tier pricing — driven by material $/sq keys from S.cfg (Settings → Pricing → Proposal Tiers)
  const _gbbCfg = S.cfg || {};
  const gbbLabelGood   = _gbbCfg.gbbGoodLabel   || 'Good';
  const gbbLabelBetter = _gbbCfg.gbbBetterLabel || 'Better';
  const gbbLabelBest   = _gbbCfg.gbbBestLabel   || 'Best';
  const gbbSubGood     = _gbbCfg.gbbGoodMat     || 'Architectural Shingle';
  const gbbSubBetter   = _gbbCfg.gbbBetterMat   || 'Impact-Resistant Class 4';
  const gbbSubBest     = _gbbCfg.gbbBestMat     || 'Designer / Premium';
  const gbbDescGood    = _gbbCfg.gbbGoodDesc    || '25-yr warranty · Standard performance · Great value';
  const gbbDescBetter  = _gbbCfg.gbbBetterDesc  || 'Hail protection · Insurance discount · 30-yr warranty';
  const gbbDescBest    = _gbbCfg.gbbBestDesc    || 'Lifetime warranty · Premium curb appeal · Top-tier';
  const gbbColorGood   = _gbbCfg.gbbGoodColor   || '#22C55E';
  const gbbColorBetter = _gbbCfg.gbbBetterColor || color; // uses brand color
  const gbbColorBest   = _gbbCfg.gbbBestColor   || '#A855F7';
  // Calculate tier totals by re-running calcStructPrice with each tier's material key
  // This gives exact $/sq prices, not an approximation
  const gbbMatGood   = String(_gbbCfg.gbbGoodMatKey   || '1.3');
  const gbbMatBetter = String(_gbbCfg.gbbBetterMatKey || '1.5');
  const gbbMatBest   = String(_gbbCfg.gbbBestMatKey   || '1.8');
  function gbbTotalForMat(matKey) {
    if (!window.structures || !window.calcStructPrice) return grandTotal;
    let t = 0;
    structures.forEach(s => {
      const orig = s.mat;
      s.mat = matKey;
      t += calcStructPrice(s);
      s.mat = orig;
    });
    // Add non-material add-ons (solar, skylights, etc.) from grandTotal minus current structure total
    const structOnly = structures.reduce((a,s)=>{ const o=s.mat; s.mat=gbbMatBetter; const v=calcStructPrice(s); s.mat=o; return a+v; }, 0);
    const addons = Math.max(0, grandTotal - structOnly);
    return Math.round(t + addons);
  }
  const totGood   = gbbTotalForMat(gbbMatGood);
  const totBetter = grandTotal; // Better = current estimate (already uses Better mat)
  const totBest   = gbbTotalForMat(gbbMatBest);
  const taxGood   = Math.round(totGood   * taxRate / 100);
  const taxBetter = Math.round(totBetter * taxRate / 100);
  const taxBest   = Math.round(totBest   * taxRate / 100);
  const finGood   = (finEnabled && totGood)   ? calcMonthly(totGood)   : 0;
  const finBetter = (finEnabled && totBetter) ? calcMonthly(totBetter) : 0;
  const finBest   = (finEnabled && totBest)   ? calcMonthly(totBest)   : 0;
  const isProposalMode = (window._previewMode === 'proposal');
  const page2Proposal =
    '<div class="ml-page" data-page="2">'+
    pageHdr(2)+
    '<div class="ml-body">'+
    '<div style="font-family:Oswald,sans-serif;font-size:18px;font-weight:700;letter-spacing:.5px;margin-bottom:2px;color:#1a1a1a;">YOUR ROOFING PROPOSAL</div>'+
    '<div style="font-size:10px;color:#888;margin-bottom:12px;">Choose the option that fits your needs — '+escHtml(addr)+'</div>'+
    // GBB cards — labels/colors/descriptions driven by S.cfg (Settings → Pricing → Proposal Tiers)
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">'+
    // GOOD
    '<div style="border:2px solid '+gbbColorGood+';border-radius:8px;overflow:hidden;">'+
    '<div style="background:'+gbbColorGood+';color:#fff;font-family:Oswald,sans-serif;font-size:13px;font-weight:700;padding:7px 10px;text-align:center;letter-spacing:.5px;">🟢 '+escHtml(gbbLabelGood.toUpperCase())+'</div>'+
    '<div style="padding:10px;background:#f9fdf9;">'+
    '<div style="font-size:9px;color:#555;font-weight:700;margin-bottom:4px;">'+escHtml(gbbSubGood)+'</div>'+
    '<div style="font-size:8px;color:#777;margin-bottom:8px;line-height:1.5;">'+escHtml(gbbDescGood)+'</div>'+
    '<div style="font-size:18px;font-weight:700;color:#1a1a1a;font-family:Oswald,sans-serif;">$'+(totGood+taxGood).toLocaleString()+'</div>'+
    (taxRate>0?'<div style="font-size:8px;color:#888;">incl. '+taxRate+'% tax ($'+taxGood.toLocaleString()+')</div>':'')+
    (finGood?'<div style="font-size:9px;color:'+gbbColorGood+';font-weight:700;margin-top:4px;">~$'+finGood.toLocaleString()+'/mo</div>':'')+
    '</div></div>'+
    // BETTER
    '<div style="border:2px solid '+gbbColorBetter+';border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.12);">'+
    '<div style="background:'+gbbColorBetter+';color:#fff;font-family:Oswald,sans-serif;font-size:13px;font-weight:700;padding:7px 10px;text-align:center;letter-spacing:.5px;">⭐ '+escHtml(gbbLabelBetter.toUpperCase())+' — POPULAR</div>'+
    '<div style="padding:10px;background:#fffdf9;">'+
    '<div style="font-size:9px;color:#555;font-weight:700;margin-bottom:4px;">'+escHtml(gbbSubBetter)+'</div>'+
    '<div style="font-size:8px;color:#777;margin-bottom:8px;line-height:1.5;">'+escHtml(gbbDescBetter)+'</div>'+
    '<div style="font-size:18px;font-weight:700;color:#1a1a1a;font-family:Oswald,sans-serif;">$'+(totBetter+taxBetter).toLocaleString()+'</div>'+
    (taxRate>0?'<div style="font-size:8px;color:#888;">incl. '+taxRate+'% tax ($'+taxBetter.toLocaleString()+')</div>':'')+
    (finBetter?'<div style="font-size:9px;color:'+gbbColorBetter+';font-weight:700;margin-top:4px;">~$'+finBetter.toLocaleString()+'/mo</div>':'')+
    '</div></div>'+
    // BEST
    '<div style="border:2px solid '+gbbColorBest+';border-radius:8px;overflow:hidden;">'+
    '<div style="background:'+gbbColorBest+';color:#fff;font-family:Oswald,sans-serif;font-size:13px;font-weight:700;padding:7px 10px;text-align:center;letter-spacing:.5px;">🟣 '+escHtml(gbbLabelBest.toUpperCase())+'</div>'+
    '<div style="padding:10px;background:#fdf9ff;">'+
    '<div style="font-size:9px;color:#555;font-weight:700;margin-bottom:4px;">'+escHtml(gbbSubBest)+'</div>'+
    '<div style="font-size:8px;color:#777;margin-bottom:8px;line-height:1.5;">'+escHtml(gbbDescBest)+'</div>'+
    '<div style="font-size:18px;font-weight:700;color:#1a1a1a;font-family:Oswald,sans-serif;">$'+(totBest+taxBest).toLocaleString()+'</div>'+
    (taxRate>0?'<div style="font-size:8px;color:#888;">incl. '+taxRate+'% tax ($'+taxBest.toLocaleString()+')</div>':'')+
    (finBest?'<div style="font-size:9px;color:'+gbbColorBest+';font-weight:700;margin-top:4px;">~$'+finBest.toLocaleString()+'/mo</div>':'')+
    '</div></div>'+
    '</div>'+
    // Line items
    '<div style="border:1px solid #e5e5e5;border-radius:6px;overflow:hidden;margin-bottom:10px;">'+
    '<div style="background:#1a1a1a;color:#fff;font-family:Oswald,sans-serif;font-size:11px;font-weight:700;padding:6px 12px;letter-spacing:.5px;">SCOPE OF WORK — SELECTED OPTION</div>'+
    structSectionsP2+
    (taxRate>0?'<div class="ml-row" style="border-top:1px solid #e5e5e5;"><span class="rl" style="font-weight:700;">Sales Tax ('+taxRate+'%)</span><span class="rv" style="font-weight:700;">$'+taxBetter.toLocaleString()+'</span></div>':'')+
    '</div>'+
    '<div class="ml-grand">'+
    '<span class="ml-grand-lbl">TOTAL INVESTMENT</span>'+
    '<span class="ml-grand-amt">$'+(totBetter+taxBetter).toLocaleString()+'</span>'+
    '</div>'+
    (finBetter?'<div style="text-align:center;margin-top:7px;font-size:11px;color:#555;">Est. Financing: <strong style="color:'+color+';">$'+finBetter.toLocaleString()+'/mo</strong> · '+escHtml(finTrm)+'</div>':'')+
    '<div style="margin-top:7px;font-size:8px;color:#bbb;line-height:1.5;">Estimates are created using satellite imagery. Final pricing confirmed at assessment. Factors that may affect price include skylights, chimneys, special vents, plywood decking, and manufacturer price increases.</div>'+
    '</div>'+
    pageFooter()+
    '</div>';
  // ════════════════════════════════════════════
  //  PAGE 3 — The Company Difference
  // ════════════════════════════════════════════
  const compareRows = diffs.map((d,i)=>{
    const neg = competitorNegs[i] || 'Rarely';
    return '<tr>'+
      '<td class="ct-feat">'+escHtml(d)+'</td>'+
      '<td class="ct-us" style="background:'+color+';">✓</td>'+
      '<td class="ct-them">'+escHtml(neg)+'</td>'+
      '</tr>';
  });
  // Add static rows
  const staticRows = [
    ['Years in Business', yrs, '1–2 Years'],
    ['Workmanship Warranty', warr+' Years', 'State Minimum'],
  ].map(([feat,us,them])=>
    '<tr><td class="ct-feat">'+escHtml(feat)+'</td>'+
    '<td class="ct-us" style="background:'+color+';">'+escHtml(us)+'</td>'+
    '<td class="ct-them">'+escHtml(them)+'</td></tr>'
  );

  const page3 =
    '<div class="ml-page" data-page="3">'+
    '<div class="ml-p3-banner" style="background:'+color+';">'+
    '<div class="ml-p3-title">THE '+escHtml(co.toUpperCase())+' DIFFERENCE</div>'+
    '<div class="ml-p3-sub">We protect what matters most. Selecting the right contractor is crucial.</div>'+
    '</div>'+
    '<div class="ml-body" style="padding-top:10px;">'+
    '<p style="font-size:10px;line-height:1.6;color:#555;margin-bottom:10px;">Your roof is one of the most important investments you\'ll make for your home and family. It\'s important to us that your questions are answered and that you have all the information necessary to make the best decision.</p>'+
    '<table class="ml-compare-table">'+
    '<thead><tr>'+
    '<th style="text-align:left;background:#f8f8f8;color:#777;"></th>'+
    '<th style="background:'+color+';color:#fff;border-radius:4px 4px 0 0;">'+escHtml(co)+'</th>'+
    '<th style="background:#eee;color:#888;">Typical Contractor</th>'+
    '</tr></thead>'+
    '<tbody>'+staticRows.join('')+compareRows.join('')+'</tbody>'+
    '</table>'+
    '</div>'+
    pageFooter()+
    '</div>';

  // ════════════════════════════════════════════
  //  PAGE 4 — We Also Offer + Referral
  // ════════════════════════════════════════════
  const page4 =
    '<div class="ml-page" data-page="4">'+
    pageHdr(4)+
    '<div class="ml-body">'+
    (svcDefs.length>0
      ? '<div class="ml-p4-title">WE ALSO OFFER</div>'+servicesHtml
      : '')+
    // Review images grid
    ((review1||review2)
      ? '<div style="margin-top:16px;">'+
        '<div class="ml-section-hdr" style="background:#1a1a1a;margin-bottom:10px;">What Our Customers Say</div>'+
        '<div class="ml-reviews-grid">'+
        (review1?'<img src="'+review1+'" class="ml-review-img" alt="Customer Review">':'<div class="ml-review-slot">Review image 1</div>')+
        (review2?'<img src="'+review2+'" class="ml-review-img" alt="Customer Review">':'<div class="ml-review-slot">Review image 2</div>')+
        '</div>'+
        '</div>'
      : ''
    )+

    '<div style="margin-top:'+(svcDefs.length||review1||review2?'10':'0')+'px;">'+
    '<div class="ml-section-hdr" style="background:'+color+';">Referral Program</div>'+
    '<div class="ml-referral-box" style="background:#f8f8f8;border:2px solid '+color+'22;">'+
    '<div class="ml-ref-badge"><div class="ref-amt">$'+escHtml(refAmt)+'</div>VISA GIFT CARD</div>'+
    '<div class="ml-ref-content">'+
    '<div class="ml-ref-title">Share &amp; Get Rewarded</div>'+
    '<div class="ml-ref-body">'+escHtml(refText)+'</div>'+
    '<div style="margin-top:8px;font-size:11px;font-weight:700;color:'+color+';">Call '+escHtml(ph)+' and mention this mailer</div>'+
    '</div></div></div>'+
    '</div>'+
    pageFooter()+
    '</div>';

  // ════════════════════════════════════════════
  //  PAGE 4 — PROPOSAL: E-Sign / Acceptance
  // ════════════════════════════════════════════
  const page4Proposal =
    '<div class="ml-page" data-page="4">'+
    pageHdr(4)+
    '<div class="ml-body">'+
    '<div style="font-family:Oswald,sans-serif;font-size:16px;font-weight:700;letter-spacing:.5px;margin-bottom:4px;color:#1a1a1a;">PROPOSAL ACCEPTANCE</div>'+
    '<div style="font-size:10px;color:#888;margin-bottom:14px;">Review and sign below to accept this proposal. Your signature is legally binding under the U.S. ESIGN Act.</div>'+
    // Summary box
    '<div style="border:2px solid '+color+';border-radius:8px;padding:12px;margin-bottom:14px;background:#fffdf9;">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">'+
    '<div>'+
    '<div style="font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Property</div>'+
    '<div style="font-size:11px;font-weight:700;color:#1a1a1a;">'+escHtml(addr)+'</div>'+
    '<div style="font-size:10px;color:#555;margin-top:6px;">'+escHtml(owner)+'</div>'+
    '</div>'+
    '<div style="text-align:right;">'+
    '<div style="font-size:9px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;">Accepted Total</div>'+
    '<div style="font-family:Oswald,sans-serif;font-size:22px;font-weight:700;color:'+color+';">$'+(totBetter+taxBetter).toLocaleString()+'</div>'+
    (taxRate>0?'<div style="font-size:8px;color:#aaa;">incl. '+taxRate+'% tax</div>':'')+
    '</div>'+
    '</div>'+
    '</div>'+
    // Terms
    '<div style="font-size:8.5px;color:#555;line-height:1.6;margin-bottom:14px;padding:10px;background:#f8f8f8;border-radius:6px;">'+
    '<strong style="color:#333;display:block;margin-bottom:4px;">Terms & Conditions</strong>'+
    'This proposal is valid for 30 days from the date of issue. A 50% deposit is required to schedule work. Final pricing is subject to confirmation upon physical inspection. '+
    'All work will be performed in accordance with local building codes. Manufacturer warranties apply to materials; workmanship warranty as stated. '+
    'Homeowner is responsible for HOA approvals where applicable. Payment in full is due upon project completion.'+
    '</div>'+
    // Signature block
    '<div style="border:2px solid #1a1a1a;border-radius:8px;padding:14px;margin-bottom:10px;">'+
    '<div style="font-size:10px;font-weight:700;color:#1a1a1a;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">&#9997; Customer Acceptance</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px;">'+
    '<div>'+
    '<div style="font-size:8px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;">Print Full Name</div>'+
    '<div style="border-bottom:1.5px solid #1a1a1a;height:28px;"></div>'+
    '</div>'+
    '<div>'+
    '<div style="font-size:8px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;">Date</div>'+
    '<div style="border-bottom:1.5px solid #1a1a1a;height:28px;"></div>'+
    '</div>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;">'+
    '<div>'+
    '<div style="font-size:8px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;">Signature</div>'+
    '<div style="border-bottom:1.5px solid #1a1a1a;height:36px;"></div>'+
    '<div style="font-size:7.5px;color:#aaa;margin-top:3px;">By signing, I agree this constitutes my legal electronic/written signature</div>'+
    '</div>'+
    '<div>'+
    '<div style="font-size:8px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;">Option Selected</div>'+
    '<div style="border-bottom:1.5px solid #1a1a1a;height:36px;"></div>'+
    '</div>'+
    '</div>'+
    '</div>'+
    // Contractor signature
    '<div style="border:1px solid #e5e5e5;border-radius:6px;padding:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;">'+
    '<div>'+
    '<div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;">Authorized by</div>'+
    '<div style="font-size:11px;font-weight:700;color:#1a1a1a;">'+escHtml(rep)+'</div>'+
    '<div style="font-size:9px;color:#555;">'+escHtml(co)+' · '+escHtml(ph)+(lic?' · Lic# '+escHtml(lic):'')+'</div>'+
    '</div>'+
    '<div style="text-align:right;">'+
    '<div style="font-size:8px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;">Proposal Date</div>'+
    '<div style="font-size:10px;font-weight:700;color:#1a1a1a;">'+new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+'</div>'+
    '</div>'+
    '</div>'+
    '</div>'+
    pageFooter()+
    '</div>';
  document.getElementById('mailer-preview').innerHTML = isProposalMode ? (page1 + page2Proposal + page3 + page4Proposal) : (page1 + page2 + page3 + page4);

  // If postcard mode is active, also refresh the postcard preview
  if(window._previewMode === 'postcard') _refreshPostcardPreview();
}

// ── Preview mode toggle (Letter / Postcard) ──────────────────────────────────
let _previewMode = 'letter';

function setPreviewMode(mode){
  _previewMode = mode;
  const letterWrap   = document.getElementById('mailer-preview');
  const pcWrap       = document.getElementById('postcard-preview-wrap');
  const propWrap     = document.getElementById('proposal-preview-wrap');
  const tabLetter    = document.getElementById('preview-tab-letter');
  const tabProposal  = document.getElementById('preview-tab-proposal');
  const tabPostcard  = document.getElementById('preview-tab-postcard');
  if(!letterWrap || !pcWrap) return;
  // Reset all tabs
  [tabLetter, tabProposal, tabPostcard].forEach(t=>{ if(t){ t.style.background='var(--card2)'; t.style.color='var(--muted)'; } });
  if(mode === 'postcard'){
    letterWrap.style.display  = 'none';
    if(propWrap) propWrap.style.display = 'none';
    pcWrap.style.display      = 'block';
    if(tabPostcard){ tabPostcard.style.background = 'var(--accent)'; tabPostcard.style.color = '#fff'; }
    _refreshPostcardPreview();
  } else if(mode === 'proposal'){
    letterWrap.style.display  = 'none';
    pcWrap.style.display      = 'none';
    if(propWrap) propWrap.style.display = 'block';
    if(tabProposal){ tabProposal.style.background = '#1a3a6b'; tabProposal.style.color = '#60a5fa'; }
    _refreshProposalPreview();
  } else {
    letterWrap.style.display  = '';
    if(propWrap) propWrap.style.display = 'none';
    pcWrap.style.display      = 'none';
    if(tabLetter){ tabLetter.style.background = 'var(--accent)'; tabLetter.style.color = '#fff'; }
    updatePreview();
  }
}

function _refreshProposalPreview(){
  const iframe = document.getElementById('prop-preview-iframe');
  const scaler = document.getElementById('prop-preview-scaler');
  if(!iframe) return;
  // Build the proposal HTML
  const html = buildProposalHTML(false);
  iframe.srcdoc = html;
  // Scale iframe to fit container width
  setTimeout(()=>{
    const containerW = (scaler ? scaler.offsetWidth : 680) || 680;
    const scale = containerW / 850;
    iframe.style.transform = 'scale('+scale+')';
    iframe.style.transformOrigin = 'top left';
    if(scaler) scaler.style.height = Math.round(1100 * scale) + 'px';
  }, 100);
  // Update print cost badge — free if estimate already has print_paid
  const estId = window._editingEstimateId || null;
  const est = estId ? (S.estimates||[]).find(e=>e.id===estId) : null;
  const badge = document.getElementById('prop-print-cost-badge');
  if(badge){
    if(est && est.printPaid){
      badge.textContent = 'FREE (already unlocked)';
      badge.style.background = 'rgba(34,197,94,.25)';
    } else {
      // Check if a postcard was sent for this estimate
      const qItem = (S.queue||[]).find(q=>(q.estId===estId || (est && q.addr===(est.addr||''))) && q.status==='sent');
      if(qItem){
        badge.textContent = 'FREE (postcard sent)';
        badge.style.background = 'rgba(34,197,94,.25)';
      } else {
        badge.textContent = '1 Credit';
        badge.style.background = 'rgba(255,255,255,.2)';
      }
    }
  }
}

function _scalePostcardPreviews(){
  const frontFrame  = document.getElementById('pc-front-preview');
  const backFrame   = document.getElementById('pc-back-preview');
  const frontScaler = document.getElementById('pc-front-scaler');
  const backScaler  = document.getElementById('pc-back-scaler');
  if(!frontScaler || !frontFrame) return;
  const containerW = frontScaler.offsetWidth || 640;
  const scale = containerW / 864;
  const scaledH = Math.round(576 * scale);
  [frontFrame, backFrame].forEach(f=>{ if(f){ f.style.transform = `scale(${scale})`; f.style.transformOrigin = 'top left'; } });
  [frontScaler, backScaler].forEach(s=>{ if(s){ s.style.height = scaledH + 'px'; } });
}


// ── Shared canvas postcard preview modal ──────────────────────────────────────
async function _showPostcardCanvasModal(modalId, ownerLabel, addrLabel, item){
  const existing = document.getElementById(modalId);
  if(existing) existing.remove();

  // Show loading modal immediately
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = [
    'position:fixed;inset:0;z-index:10100;',
    'background:rgba(5,10,20,0.95);',
    'display:flex;flex-direction:column;align-items:center;',
    'overflow-y:auto;padding:20px 16px 40px;',
    '-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);'
  ].join('');
  modal.innerHTML = `
    <div style="width:100%;max-width:780px;display:flex;align-items:center;justify-content:space-between;
                margin-bottom:16px;flex-shrink:0;">
      <div>
        <div style="font-family:Oswald,sans-serif;font-size:18px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;">
          &#127968; Postcard Preview
        </div>
        <div style="font-size:12px;color:#6688A8;margin-top:2px;">
          ${escHtml(ownerLabel)} &mdash; ${escHtml(addrLabel)}
        </div>
      </div>
      <button onclick="document.getElementById('${modalId}').remove()"
        style="background:#1e2d42;border:1px solid #2E4060;color:#C8D8E8;font-size:13px;font-weight:700;
               padding:9px 20px;border-radius:8px;cursor:pointer;white-space:nowrap;flex-shrink:0;"
        onmouseover="this.style.background='#F25C05';this.style.borderColor='#F25C05';this.style.color='#fff';"
        onmouseout="this.style.background='#1e2d42';this.style.borderColor='#2E4060';this.style.color='#C8D8E8';">
        &times; Close
      </button>
    </div>
    <div style="width:100%;max-width:780px;font-size:11px;color:#96B0C8;
                margin-bottom:16px;text-align:center;flex-shrink:0;">
      6&times;9 postcard &mdash; front on top, back below. Actual print size: 9&Prime;&times;6&Prime;.
    </div>
    <div style="width:100%;max-width:780px;margin-bottom:18px;flex-shrink:0;">
      <div style="font-size:10px;font-weight:700;color:#C8D8E8;text-transform:uppercase;
                  letter-spacing:.5px;margin-bottom:8px;">Front &mdash; House Photo</div>
      <div id="${modalId}-front" style="width:100%;border-radius:8px;border:1px solid #2E4060;
                                        overflow:hidden;background:#1a2333;min-height:80px;
                                        display:flex;align-items:center;justify-content:center;">
        <div style="color:#6688A8;font-size:13px;">Rendering&hellip;</div>
      </div>
    </div>
    <div style="width:100%;max-width:780px;flex-shrink:0;">
      <div style="font-size:10px;font-weight:700;color:#C8D8E8;text-transform:uppercase;
                  letter-spacing:.5px;margin-bottom:8px;">Back &mdash; Estimate Summary</div>
      <div id="${modalId}-back" style="width:100%;border-radius:8px;border:1px solid #2E4060;
                                       overflow:hidden;background:#fff;min-height:80px;
                                       display:flex;align-items:center;justify-content:center;">
        <div style="color:#6688A8;font-size:13px;">Rendering&hellip;</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  function _esc(e){ if(e.key==='Escape'){ modal.remove(); document.removeEventListener('keydown',_esc); } }
  document.addEventListener('keydown', _esc);

  // Render canvases
  const [frontDataUrl, backDataUrl] = await Promise.all([
    renderFrontCanvasForDesign(item),
    renderPostcard6x9BackCanvas(item)
  ]);

  const frontEl = document.getElementById(modalId+'-front');
  const backEl  = document.getElementById(modalId+'-back');
  if(frontEl && frontDataUrl){
    frontEl.innerHTML = '<img src="'+frontDataUrl+'" style="width:100%;height:auto;display:block;">';
  }
  if(backEl && backDataUrl){
    backEl.innerHTML = '<img src="'+backDataUrl+'" style="width:100%;height:auto;display:block;">';
  }
}

async function previewEstimatorPostcardFullscreen(){
  // Build a synthetic item from current estimator state (same as _refreshPostcardPreview)
  const addr  = document.getElementById('e-addr')  ? document.getElementById('e-addr').value.trim()  : '';
  const owner = document.getElementById('e-owner') ? document.getElementById('e-owner').value.trim() : 'Homeowner';
  const grand = calcP ? calcP() : 0;
  const _frontPhoto = ((window._allPhotos && window._allPhotos.front)||[])[0] || window._homePhotoData || null;
  const fakeItem = {
    id: window._editingEstimateId || null,
    slug: (S.cfg&&S.cfg.companyName?S.cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'roofing'),
    addr, owner,
    total: grand,
    structures: JSON.parse(JSON.stringify(structures||[])),
    photo_url:  (_frontPhoto && _frontPhoto.startsWith('http'))  ? _frontPhoto : null,
    photo_data: (_frontPhoto && !_frontPhoto.startsWith('http')) ? _frontPhoto : null,
    damage_photos: window._damagePhotos || [],
    all_photos: window._allPhotos ? JSON.parse(JSON.stringify(window._allPhotos)) : null
  };
  // If no house photo, try geocoding
  if(!fakeItem.photo_url && !fakeItem.photo_data && addr){
    try{
      const MB = window._mapboxToken || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
      const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(addr)+'.json?country=us&types=address&limit=1&access_token='+MB);
      const geoData = await geoRes.json();
      if(geoData.features && geoData.features[0]){
        const [lon,lat] = geoData.features[0].center;
        fakeItem.photo_url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;
      }
    } catch(e){}
  }
  await _showPostcardCanvasModal('m-est-postcard-fullscreen', owner||'Homeowner', addr||'', fakeItem);
}

async function _refreshPostcardPreview(){
  // Build a synthetic queue item from current estimator state
  const addr  = document.getElementById('e-addr')  ? document.getElementById('e-addr').value.trim()  : '';
  const owner = document.getElementById('e-owner') ? document.getElementById('e-owner').value.trim() : 'Homeowner';
  const grand = calcP ? calcP() : 0;
  const _frontPhoto = ((window._allPhotos && window._allPhotos.front)||[])[0] || window._homePhotoData || null;
  const fakeItem = {
    id: window._editingEstimateId || null,
    slug: (S.cfg&&S.cfg.companyName?S.cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'roofing'),
    addr, owner,
    total: grand,
    structures: JSON.parse(JSON.stringify(structures||[])),
    photo_url:  (_frontPhoto && _frontPhoto.startsWith('http'))  ? _frontPhoto : null,
    photo_data: (_frontPhoto && !_frontPhoto.startsWith('http')) ? _frontPhoto : null,
    damage_photos: window._damagePhotos || [],
    all_photos: window._allPhotos ? JSON.parse(JSON.stringify(window._allPhotos)) : null
  };

  // If no house photo, try geocoding first
  if(!fakeItem.photo_url && !fakeItem.photo_data && addr){
    try{
      const MB = window._mapboxToken || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
      const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(addr)+'.json?country=us&types=address&limit=1&access_token='+MB);
      const geoData = await geoRes.json();
      if(geoData.features && geoData.features[0]){
        const [lon,lat] = geoData.features[0].center;
        fakeItem.photo_url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;
      }
    } catch(e){}
  }

  const frontFrame = document.getElementById('pc-front-preview');
  const backFrame  = document.getElementById('pc-back-preview');
  if(!frontFrame && !backFrame) return;

  // Show loading state
  if(frontFrame) frontFrame.style.opacity='0.4';
  if(backFrame)  backFrame.style.opacity='0.4';

  const [frontDataUrl, backDataUrl] = await Promise.all([
    renderFrontCanvasForDesign(fakeItem),
    renderPostcard6x9BackCanvas(fakeItem)
  ]);

  // pc-front-preview and pc-back-preview are iframes in the estimator panel.
  // Replace them with img tags inside their parent containers.
  if(frontFrame){
    const parent = frontFrame.parentElement;
    if(parent && frontDataUrl){
      // Replace iframe with img if not already done
      if(frontFrame.tagName === 'IFRAME'){
        const img = document.createElement('img');
        img.id = 'pc-front-preview';
        img.style.cssText = 'width:100%;height:auto;display:block;border-radius:5px;';
        img.src = frontDataUrl;
        parent.replaceChild(img, frontFrame);
      } else {
        frontFrame.src = frontDataUrl;
        frontFrame.style.opacity='1';
      }
    }
  }
  if(backFrame){
    const parent = backFrame.parentElement;
    if(parent && backDataUrl){
      if(backFrame.tagName === 'IFRAME'){
        const img = document.createElement('img');
        img.id = 'pc-back-preview';
        img.style.cssText = 'width:100%;height:auto;display:block;border-radius:5px;';
        img.src = backDataUrl;
        parent.replaceChild(img, backFrame);
      } else {
        backFrame.src = backDataUrl;
        backFrame.style.opacity='1';
      }
    }
  }
  setTimeout(_scalePostcardPreviews, 80);
}

