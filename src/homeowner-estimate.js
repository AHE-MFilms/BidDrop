// src/homeowner-estimate.js
// Homeowner-facing estimate page (/e/[id]) — self-contained route that
// renders the full estimate UI, nearby campaign panel, GHL/tracerfy bulk send.
// Depends on: sb, adminAPI(), toast(), haversineM()
// Extracted from index.html — Tier 5 modularization
// Self-contained escHtml (this file loads before map-core.js)
function _esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

async function initEstimatePage(estId) {
  // Hide the main app shell entirely
  document.body.innerHTML = '';
  document.documentElement.style.cssText = 'height:auto!important;overflow:visible!important;';
  document.body.style.cssText = 'margin:0;padding:0;background:#0a0f16;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#fff;min-height:100vh;overflow-x:hidden;overflow-y:auto!important;height:auto!important;';

  // Loading screen
  const loader = document.createElement('div');
  loader.id = 'ep-loader';
  loader.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:16px;';
  loader.innerHTML = '<div style="width:48px;height:48px;border:4px solid rgba(255,255,255,.15);border-top-color:#F25C05;border-radius:50%;animation:ep-spin 0.8s linear infinite;"></div><div style="color:rgba(255,255,255,.5);font-size:14px;">Loading your estimate\u2026</div>';
  document.body.appendChild(loader);

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ep-spin{to{transform:rotate(360deg)}}
    @keyframes ep-fade{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes ep-pulse{0%,100%{opacity:1}50%{opacity:.6}}
    *{box-sizing:border-box;}
    html{scroll-behavior:smooth;}
    body{-webkit-font-smoothing:antialiased;}
    .ep-fade{animation:ep-fade 0.5s ease forwards;}
    .ep-fade-d1{animation:ep-fade 0.5s ease 0.1s both;}
    .ep-fade-d2{animation:ep-fade 0.5s ease 0.2s both;}
    .ep-fade-d3{animation:ep-fade 0.5s ease 0.3s both;}

    /* Sticky header */
    .ep-header{position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:rgba(10,15,22,.85);border-bottom:1px solid rgba(255,255,255,.08);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
    .ep-header-logo{height:36px;max-width:140px;object-fit:contain;}
    .ep-header-cta{display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:50px;border:none;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;white-space:nowrap;transition:transform .15s,opacity .15s;}
    .ep-header-cta:hover{transform:scale(1.04);opacity:.92;}
    .ep-header-cta svg{flex-shrink:0;}

    /* Hero */
    .ep-hero{position:relative;width:100%;height:320px;overflow:hidden;}
    @media(max-width:480px){.ep-hero{height:260px;}}
    .ep-hero-img{width:100%;height:100%;object-fit:cover;display:block;}
    .ep-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,15,22,.2) 0%,rgba(10,15,22,.85) 100%);}
    .ep-hero-content{position:absolute;bottom:0;left:0;right:0;padding:24px 20px;}
    .ep-hero-label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;opacity:.7;margin-bottom:6px;}
    .ep-hero-addr{font-size:20px;font-weight:800;line-height:1.25;text-shadow:0 2px 8px rgba(0,0,0,.5);}
    @media(max-width:480px){.ep-hero-addr{font-size:17px;}}

    /* Video section */
    .ep-video-wrap{position:relative;width:100%;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:16/9;}
    .ep-video-wrap video,.ep-video-wrap iframe{width:100%;height:100%;display:block;border:none;}
    .ep-video-label{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.5;margin-bottom:10px;}

    /* Sections */
    .ep-section{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:20px;padding:22px;margin-bottom:16px;}
    .ep-section-title{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;opacity:.5;margin-bottom:16px;}

    /* Material cards */
    .ep-mat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
    @media(max-width:500px){.ep-mat-grid{grid-template-columns:repeat(2,1fr);}}
    .ep-mat-card{cursor:pointer;border:2px solid rgba(255,255,255,.08);border-radius:16px;padding:14px 10px;background:rgba(255,255,255,.04);transition:all .2s;text-align:center;position:relative;}
    .ep-mat-card:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);}
    .ep-mat-card.active{border-color:var(--ep-brand,#F25C05);background:rgba(242,92,5,.1);box-shadow:0 0 0 3px rgba(242,92,5,.15);}
    .ep-mat-icon{font-size:22px;margin-bottom:6px;}
    .ep-mat-name{font-size:12px;font-weight:700;line-height:1.3;margin-bottom:2px;}
    .ep-mat-desc{font-size:10px;opacity:.5;margin-bottom:6px;}
    .ep-mat-popular{font-size:9px;font-weight:800;letter-spacing:.5px;padding:2px 7px;border-radius:20px;margin-bottom:6px;display:inline-block;}
    .ep-mat-price{font-size:15px;font-weight:900;}

    /* Price display */
    .ep-price-hero{text-align:center;padding:20px 0 8px;}
    .ep-price-label{font-size:12px;opacity:.5;margin-bottom:4px;}
    .ep-price-amount{font-size:52px;font-weight:900;line-height:1;letter-spacing:-2px;}
    @media(max-width:480px){.ep-price-amount{font-size:42px;}}
    .ep-price-monthly{font-size:14px;opacity:.6;margin-top:6px;}

    /* Trust bar */
    .ep-trust-bar{display:flex;gap:0;border-radius:16px;overflow:hidden;margin-bottom:16px;}
    .ep-trust-item{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);padding:16px 10px;text-align:center;}
    .ep-trust-item:not(:last-child){border-right:none;}
    .ep-trust-item:first-child{border-radius:16px 0 0 16px;}
    .ep-trust-item:last-child{border-radius:0 16px 16px 0;}
    .ep-trust-num{font-size:26px;font-weight:900;line-height:1;}
    .ep-trust-label{font-size:10px;opacity:.45;margin-top:3px;line-height:1.3;}

    /* Badges */
    .ep-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:6px 12px;font-size:12px;font-weight:600;}

    /* Rep card */
    .ep-rep-card{display:flex;align-items:center;gap:16px;}
    .ep-rep-avatar{width:60px;height:60px;border-radius:50%;object-fit:cover;flex-shrink:0;}
    .ep-rep-avatar-placeholder{width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;}

    /* CTA section */
    .ep-cta-section{border-radius:24px;padding:28px 20px;margin-bottom:16px;text-align:center;}
    .ep-cta-headline{font-size:22px;font-weight:900;margin-bottom:6px;line-height:1.2;}
    .ep-cta-sub{font-size:14px;opacity:.65;margin-bottom:22px;}
    .ep-btn-primary{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:17px 20px;border:none;border-radius:14px;font-size:16px;font-weight:800;cursor:pointer;letter-spacing:.2px;transition:transform .15s,opacity .15s;text-decoration:none;color:#fff;}
    .ep-btn-primary:hover{transform:translateY(-1px);opacity:.92;}
    .ep-btn-secondary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px 20px;border:2px solid rgba(255,255,255,.15);border-radius:14px;font-size:15px;font-weight:700;cursor:pointer;background:rgba(255,255,255,.04);color:#fff;transition:all .2s;text-decoration:none;}
    .ep-btn-secondary:hover{border-color:rgba(255,255,255,.35);background:rgba(255,255,255,.08);}

    /* Countdown */
    .ep-countdown{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,rgba(185,28,28,.3),rgba(124,10,10,.4));border:1px solid rgba(220,38,38,.3);border-radius:16px;padding:16px 20px;margin-bottom:16px;}
    .ep-countdown-icon{font-size:28px;flex-shrink:0;}
    .ep-countdown-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;opacity:.8;margin-bottom:2px;}
    .ep-countdown-val{font-size:24px;font-weight:900;}

    /* Photos */
    .ep-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;}
    .ep-photo{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;cursor:pointer;transition:transform .2s,opacity .2s;display:block;}
    .ep-photo:hover{transform:scale(1.03);opacity:.9;}
    .ep-photo-label{font-size:10px;opacity:.4;text-align:center;margin-top:4px;}

    /* Lightbox */
    .ep-lightbox{display:none;position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:9999;align-items:center;justify-content:center;padding:20px;}
    .ep-lightbox.open{display:flex;}
    .ep-lightbox img{max-width:100%;max-height:90vh;border-radius:10px;object-fit:contain;}
    .ep-lightbox-close{position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;}

    /* Breakdown table */
    .ep-breakdown-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;}
    .ep-breakdown-row:last-child{border-bottom:none;}
    .ep-breakdown-total{font-size:15px;font-weight:800;padding-top:12px;margin-top:4px;border-top:2px solid rgba(255,255,255,.1);}

    /* Footer */
    .ep-footer{text-align:center;padding:32px 20px 48px;opacity:.3;font-size:12px;}
    .ep-footer-logo{height:28px;object-fit:contain;margin-bottom:10px;display:block;margin-left:auto;margin-right:auto;}
  `;
  document.head.appendChild(style);

  // Fetch estimate data
  let data;
  try {
    const r = await fetch('/api/estimate?action=get&id=' + encodeURIComponent(estId));
    if (!r.ok) throw new Error('Not found');
    data = await r.json();
  } catch(e) {
    loader.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-size:56px;margin-bottom:16px;">\uD83C\uDFE0</div><div style="font-size:22px;font-weight:800;margin-bottom:8px;">Estimate Not Found</div><div style="color:rgba(255,255,255,.5);font-size:14px;">This estimate link may have expired or been removed.</div></div>';
    return;
  }

  const est = data.estimate;
  const acct = data.account;
  const brand = acct.brandColor || '#F25C05';
  document.documentElement.style.setProperty('--ep-brand', brand);

  // Pricing engine
  function calcStructPrice(s, cfg) {
    const sqft = parseFloat(s.sqft) || 0; if (!sqft) return 0;
    const pitchMult = parseFloat(s.pitch) || 1.118;
    const complexity = parseFloat(s.complexity) || 1.12;
    const stories = parseFloat(s.stories) || 1;
    const sq = sqft / 100 * 1.10 * pitchMult;
    const stMult = stories <= 1 ? 1 : stories <= 1.5 ? 1.08 : stories <= 2 ? 1.16 : 1.25;
    // Per-square mode
    if ((cfg.pricingMode || 'detailed') === 'per_square') {
      const ppsMap = { '1.3': cfg.ppsArchitectural||450, '1.8': cfg.ppsDesigner||580, '1.5': cfg.ppsImpact||520, '2.5': cfg.ppsMetal||950, '0.9': cfg.ppsFlat||400, '3.2': cfg.ppsTile||1400 };
      const pps = ppsMap[String(s.mat)] || cfg.ppsArchitectural || 450;
      return Math.round(sq * pps * stMult * complexity);
    }
    // Detailed mode
    const matCostMap = { '1.0': cfg.cost3Tab, '1.3': cfg.costArchitectural, '1.8': cfg.costDesigner, '1.5': cfg.costImpact, '2.5': cfg.costMetal, '0.9': cfg.costFlat, '3.2': cfg.costTile };
    const matCost = matCostMap[String(s.mat)] || cfg.costArchitectural;
    const tearoff = cfg.costTearoff * sq;
    const felts = cfg.costFelts * sq;
    const dumpster = cfg.costDumpster;
    const labor = matCost * sq * stMult * complexity;
    const sub = labor + tearoff + felts + dumpster;
    const ovh = sub * cfg.overhead / 100;
    const mgn = (sub + ovh) * cfg.margin / 100;
    return Math.round(sub + ovh + mgn);
  }
  function calcTotal(matKey, cfg) {
    const structs = (est.structures || []).map(s => ({ ...s, mat: matKey }));
    return structs.reduce((sum, s) => sum + calcStructPrice(s, cfg), 0);
  }

  const cfg = {
    pricingMode: acct.pricingMode || 'detailed',
    cost3Tab: acct.cost3Tab || 220,
    costArchitectural: acct.costArchitectural || 300,
    costDesigner: acct.costDesigner || 420,
    costImpact: acct.costImpact || 380,
    costMetal: acct.costMetal || 680,
    costFlat: acct.costFlat || 320,
    costTile: acct.costTile || 950,
    ppsArchitectural: acct.ppsArchitectural || 450,
    ppsDesigner: acct.ppsDesigner || 580,
    ppsImpact: acct.ppsImpact || 520,
    ppsMetal: acct.ppsMetal || 950,
    ppsFlat: acct.ppsFlat || 400,
    ppsTile: acct.ppsTile || 1400,
    costTearoff: acct.costTearoff || 75,
    costIceWater: acct.costIceWater || 42,
    costFelts: acct.costFelts || 22,
    costDumpster: acct.costDumpster || 450,
    overhead: acct.overhead || 15,
    margin: acct.margin || 20,
  };

  const ALL_MAT_OPTIONS = [
    { key: '1.3', label: 'Architectural', desc: 'Most Popular', icon: '\u2B50', popular: true,  flag: 'matArch' },
    { key: '1.8', label: 'Designer',      desc: 'Premium Look', icon: '\uD83D\uDC8E',           flag: 'matDes' },
    { key: '1.5', label: 'Impact-Resistant', desc: 'Class 4 / Hail', icon: '\uD83D\uDEE1\uFE0F', flag: 'matImpact' },
    { key: '2.5', label: 'Metal Roofing', desc: 'Lifetime',     icon: '\uD83C\uDFE0',           flag: 'matMetal' },
    { key: '0.9', label: 'Flat / TPO',    desc: 'Low-Slope',    icon: '\uD83D\uDCCF',           flag: 'matFlat' },
    { key: '3.2', label: 'Tile / Clay',   desc: 'Classic Style',icon: '\uD83C\uDFDB\uFE0F',    flag: 'matTile' },
  ];
  // Filter to only materials the roofer has enabled (matArch defaults to true if not set)
  const MAT_OPTIONS = ALL_MAT_OPTIONS.filter(m => {
    if (m.flag === 'matArch') return acct.matArch !== false;
    return !!acct[m.flag];
  });
  // Ensure at least one option is shown (fallback to Architectural)
  if (MAT_OPTIONS.length === 0) MAT_OPTIONS.push(ALL_MAT_OPTIONS[0]);

  let currentMat = (est.structures && est.structures[0] && est.structures[0].mat) || '1.3';

  // Collect all photos
  const allPhotos = [];
  if (est.photoUrl) allPhotos.push({ url: est.photoUrl, label: 'Home' });
  if (est.allPhotos) {
    const ap = est.allPhotos;
    if (ap.front && ap.front.length) ap.front.forEach(u => allPhotos.push({ url: u, label: 'Home' }));
    if (ap.roof && ap.roof.length) ap.roof.forEach(u => allPhotos.push({ url: u, label: 'Roof' }));
    if (ap.damage && ap.damage.length) ap.damage.forEach(u => allPhotos.push({ url: u, label: 'Damage' }));
    if (ap.extra && ap.extra.length) ap.extra.forEach(u => allPhotos.push({ url: u, label: 'Additional' }));
  }
  if (est.damagePhotos && est.damagePhotos.length) {
    est.damagePhotos.forEach(u => { if (!allPhotos.find(p => p.url === u)) allPhotos.push({ url: u, label: 'Damage' }); });
  }

  // Financing calc
  function monthlyPayment(total) {
    if (!acct.financingEnabled) return null;
    const apr = (acct.financingApr || 9.99) / 100 / 12;
    const n = acct.financingTerm || 60;
    const principal = total - (total * (acct.financingDown || 0) / 100);
    if (apr === 0) return Math.round(principal / n);
    return Math.round(principal * apr * Math.pow(1 + apr, n) / (Math.pow(1 + apr, n) - 1));
  }

  // Helper: embed video URL (YouTube / Vimeo / direct)
  function videoEmbedHtml(url) {
    if (!url) return '';
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) {
      return `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1" allowfullscreen allow="autoplay; encrypted-media" frameborder="0"></iframe>`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0" allowfullscreen frameborder="0"></iframe>`;
    }
    return `<video src="${url}" controls playsinline preload="metadata" style="width:100%;height:100%;display:block;"></video>`;
  }

  // Build page HTML
  function buildPage() {
    const total = calcTotal(currentMat, cfg);
    const monthly = monthlyPayment(total);
    const matLabel = (MAT_OPTIONS.find(m => m.key === currentMat) || {}).label || 'Architectural';
    const pitchMap = { '1.054': '4/12 Low', '1.083': '5/12', '1.118': '6/12 Standard', '1.158': '7/12', '1.202': '8/12 Moderate', '1.250': '9/12', '1.302': '10/12 Steep', '1.357': '11/12', '1.414': '12/12 Very Steep',
      // legacy keys
      '1.0': '4/12 Low', '1.07': '5/12', '1.15': '6/12 Standard', '1.23': '7/12', '1.31': '8/12 Moderate', '1.40': '9/12', '1.50': '10/12 Steep', '1.65': '11/12', '1.80': '12/12 Very Steep' };
    const firstStruct = (est.structures || [])[0] || {};
    const pitchLabel = pitchMap[String(firstStruct.pitch)] || 'Standard';
    const sqft = (est.structures || []).reduce((s, st) => s + (parseFloat(st.sqft) || 0), 0);

    // ── Sticky header ──────────────────────────────────────────────────────
    const headerHtml = `
      <header class="ep-header">
        ${acct.logoData
          ? `<img src="${acct.logoData}" class="ep-header-logo" alt="${acct.companyName}">`
          : `<div style="font-size:15px;font-weight:800;letter-spacing:-.3px;">${acct.companyName || 'Your Roofer'}</div>`
        }
        ${acct.companyPhone
          ? `<a href="tel:${acct.companyPhone}" onclick="epTrackEvent('call')" class="ep-header-cta" style="background:${brand};color:#fff;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
              Call Now
            </a>`
          : ''
        }
      </header>`;

    // ── Hero ───────────────────────────────────────────────────────────────
    const heroPhoto = allPhotos.length ? allPhotos[0].url : null;
    const heroHtml = heroPhoto
      ? `<div class="ep-hero">
          <img src="${heroPhoto}" class="ep-hero-img" alt="Your Home">
          <div class="ep-hero-overlay"></div>
          <div class="ep-hero-content ep-fade">
            <div class="ep-hero-label">\uD83D\uDCCB Your Personalized Estimate</div>
            <div class="ep-hero-addr">${est.addr || 'Your Property'}</div>
          </div>
        </div>`
      : `<div style="background:linear-gradient(135deg,rgba(242,92,5,.15),rgba(10,15,22,0));padding:40px 20px 24px;text-align:center;">
          <div class="ep-hero-label">\uD83D\uDCCB Your Personalized Estimate</div>
          <div class="ep-hero-addr" style="font-size:22px;">${est.addr || 'Your Property'}</div>
        </div>`;

    // ── Welcome card ────────────────────────────────────────────────────────
    const ownerFirstName = (est.owner || '').split(' ')[0] || 'Homeowner';
    const bioText = _esc(acct.companyBio) || `${_esc(acct.companyName)} is a locally owned roofing company proudly serving homeowners in your area. We specialize in full roof replacements, storm damage restoration, and working directly with insurance companies to make the process as smooth as possible. Our team is fully licensed, bonded, and insured — and we stand behind every job with a written workmanship warranty.`;
    const inspNote = est.inspectionNote || '';
    const welcomeHtml = `
      <div class="ep-section ep-fade" style="padding:24px 20px 20px;">
        <div style="font-size:22px;font-weight:800;margin-bottom:4px;">Welcome, ${ownerFirstName}! <span style="font-size:20px;">👋</span></div>
        <div style="font-size:14px;color:rgba(255,255,255,.55);margin-bottom:16px;">${_esc(acct.companyName)}</div>
        <p style="font-size:14px;line-height:1.7;color:rgba(255,255,255,.8);margin:0 0 ${inspNote ? '16px' : '0'};">${bioText}</p>
        ${inspNote ? `
        <div style="background:rgba(255,255,255,.06);border-left:3px solid ${brand};border-radius:0 12px 12px 0;padding:14px 16px;margin-top:4px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${brand};margin-bottom:6px;">📋 What We Found At Your Property</div>
          <p style="font-size:13px;line-height:1.65;color:rgba(255,255,255,.85);margin:0;">${_esc(inspNote)}</p>
        </div>` : ''}
      </div>`;
    // ── Countdown ──────────────────────────────────────────────────────────
    let countdownHtml = '';
    if (est.expiresAt) {
      const exp = new Date(est.expiresAt);
      const now = new Date();
      const diff = exp - now;
      if (diff > 0) {
        const days = Math.floor(diff / 86400000);
        const hrs = Math.floor((diff % 86400000) / 3600000);
        countdownHtml = `
          <div class="ep-countdown ep-fade-d1">
            <div class="ep-countdown-icon">\u23F0</div>
            <div>
              <div class="ep-countdown-label">This Estimate Expires In</div>
              <div id="ep-countdown-val" class="ep-countdown-val">${days > 0 ? days + 'd ' + hrs + 'h' : hrs + 'h'}</div>
            </div>
          </div>`;
      }
    }

    // ── Video ──────────────────────────────────────────────────────────────
    const videoHtml = est.repVideoUrl ? `
      <div class="ep-section ep-fade-d1" style="padding:16px;">
        <div class="ep-video-label">\uD83C\uDFA5 Message From Your Rep</div>
        <div class="ep-video-wrap">${videoEmbedHtml(est.repVideoUrl)}</div>
      </div>` : '';

    // ── Material selector ──────────────────────────────────────────────────
    const matTabsHtml = `
      <div class="ep-section ep-fade-d2">
        <div class="ep-section-title">Choose Your Material</div>
        <div class="ep-mat-grid">
          ${MAT_OPTIONS.map(m => {
            const mTotal = calcTotal(m.key, cfg);
            return `
            <div class="ep-mat-card${m.key === currentMat ? ' active' : ''}" onclick="epSelectMat('${m.key}')" data-mat="${m.key}">
              <div class="ep-mat-icon">${m.icon}</div>
              <div class="ep-mat-name">${m.label}</div>
              <div class="ep-mat-desc">${m.desc}</div>
              ${m.popular ? `<div class="ep-mat-popular" style="background:${brand};color:#fff;">POPULAR</div>` : '<div style="height:18px;"></div>'}
              <div class="ep-mat-price" style="color:${m.key === currentMat ? brand : 'rgba(255,255,255,.7)'};">$${mTotal.toLocaleString()}</div>
            </div>`;
          }).join('')}
        </div>
        <div class="ep-price-hero">
          <div class="ep-price-label">Selected: ${matLabel}</div>
          <div id="ep-total" class="ep-price-amount" style="color:${brand};">$${total.toLocaleString()}</div>
          ${monthly ? `<div class="ep-price-monthly">or ~<span id="ep-monthly">$${monthly}</span>/mo with financing</div>` : ''}
        </div>
      </div>`;

    // ── Trust bar ──────────────────────────────────────────────────────────
    const trustItems = [];
    if (acct.yearsInBusiness) trustItems.push({ num: acct.yearsInBusiness + '+', label: 'Years in Business' });
    if (acct.warrantyYears) trustItems.push({ num: acct.warrantyYears, label: 'Year Warranty' });
    trustItems.push({ num: '5\u2605', label: 'Rated' });
    const trustHtml = `
      <div class="ep-trust-bar ep-fade-d2">
        ${trustItems.map(t => `
          <div class="ep-trust-item">
            <div class="ep-trust-num" style="color:${brand};">${t.num}</div>
            <div class="ep-trust-label">${t.label}</div>
          </div>`).join('')}
      </div>`;

    // ── Roof details ───────────────────────────────────────────────────────
    const detailsHtml = `
      <div class="ep-section ep-fade-d2">
        <div class="ep-section-title">\uD83D\uDCCF Roof Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:${(est.skylight || est.chimney || est.gutters) ? '12px' : '0'};">
          ${sqft ? `<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:11px;opacity:.45;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Roof Area</div><div style="font-size:28px;font-weight:900;color:${brand};">${sqft.toLocaleString()}</div><div style="font-size:11px;opacity:.4;">sq ft</div></div>` : ''}
          ${pitchLabel ? `<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:16px;text-align:center;"><div style="font-size:11px;opacity:.45;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Pitch</div><div style="font-size:16px;font-weight:800;margin-top:6px;">${pitchLabel}</div></div>` : ''}
        </div>
        ${(est.skylight || est.chimney || est.gutters || est.solar) ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${est.skylight ? `<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px 14px;font-size:12px;font-weight:600;">\u2600\uFE0F Skylight${est.skylightQty > 1 ? ' \xd7' + est.skylightQty : ''}</div>` : ''}
          ${est.chimney ? `<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px 14px;font-size:12px;font-weight:600;">\uD83E\uDDF1 Chimney</div>` : ''}
          ${est.gutters ? `<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px 14px;font-size:12px;font-weight:600;">\uD83D\uDCA7 Gutters ${est.gutterLf || 120} LF</div>` : ''}
          ${est.solar ? `<div style="background:rgba(255,200,0,.08);border:1px solid rgba(255,200,0,.2);border-radius:10px;padding:10px 14px;font-size:12px;font-weight:600;">&#9728;&#65039; Solar${est.solarKw ? ' ' + est.solarKw + ' kW' : ''} &mdash; $${(est.solarPrice||0).toLocaleString()}</div>` : ''}
        </div>` : ''}
      </div>`;

    // ── Photos ─────────────────────────────────────────────────────────────
    const photosHtml = allPhotos.length > 1 ? `
      <div class="ep-section ep-fade-d3">
        <div class="ep-section-title">\uD83D\uDCF8 Property Photos</div>
        <div class="ep-photo-grid">
          ${allPhotos.map((p, i) => `
            <div>
              <img src="${p.url}" class="ep-photo" alt="${p.label}" onclick="epOpenLightbox(${i})" loading="lazy">
              <div class="ep-photo-label">${p.label}</div>
            </div>`).join('')}
        </div>
      </div>` : '';

    // ── Why Choose Us ──────────────────────────────────────────────────────
    const badges = [acct.diff1, acct.diff2, acct.diff3, acct.diff4, acct.diff5, acct.diff6].filter(Boolean);
    const badgesHtml = badges.length ? `
      <div class="ep-section ep-fade-d3">
        <div class="ep-section-title">\uD83C\uDFC6 Why Choose Us</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${badges.map(b => `<span class="ep-badge">\u2713 ${_esc(b)}</span>`).join('')}
        </div>
      </div>` : '';

    // ── Rep card ───────────────────────────────────────────────────────────
    const repHtml = `
      <div class="ep-section ep-fade-d3">
        <div class="ep-rep-card">
          ${acct.headshot
            ? `<img src="${acct.headshot}" class="ep-rep-avatar" style="border:2px solid ${brand};" alt="Rep">`
            : `<div class="ep-rep-avatar-placeholder">\uD83D\uDC64</div>`
          }
          <div>
            <div style="font-size:16px;font-weight:800;">${_esc(acct.repName || est.rep || 'Your Rep')}</div>
            <div style="font-size:13px;opacity:.5;margin-top:2px;">${_esc(acct.repTitle || 'Roofing Specialist')}</div>
            <div style="font-size:12px;opacity:.35;margin-top:2px;">${_esc(acct.companyName)}</div>
          </div>
        </div>
      </div>`;

    // ── CTA section ────────────────────────────────────────────────────────
    const ctaHtml = `
      <div class="ep-cta-section ep-fade-d3" style="background:linear-gradient(135deg,rgba(242,92,5,.18),rgba(242,92,5,.06));border:1px solid rgba(242,92,5,.25);">
        <div class="ep-cta-headline">Ready to Get Started?</div>
        <div class="ep-cta-sub">Lock in this estimate before it expires</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${acct.companyPhone
            ? `<a href="tel:${acct.companyPhone}" onclick="epTrackEvent('call')" class="ep-btn-primary" style="background:${brand};">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                Call ${acct.companyPhone}
              </a>`
            : ''
          }
          ${acct.bookingUrl
            ? `<a href="${acct.bookingUrl}" target="_blank" class="ep-btn-secondary">
                \uD83D\uDCC5 Schedule a Free Assessment
              </a>`
            : ''
          }
          <button class="ep-btn-secondary" onclick="epShare()" style="cursor:pointer;">
            \uD83D\uDCE4 Share This Estimate
          </button>
        </div>
      </div>`;

    // ── Footer ─────────────────────────────────────────────────────────────
    const footerHtml = `
      <div class="ep-footer">
        ${acct.logoData ? `<img src="${acct.logoData}" class="ep-footer-logo" alt="Logo">` : ''}
        <div style="font-weight:700;">${_esc(acct.companyName)}</div>
        ${acct.companyAddr ? `<div style="margin-top:3px;">${acct.companyAddr}</div>` : ''}
        <div style="margin-top:8px;">Estimate prepared ${new Date(est.savedAt).toLocaleDateString()}</div>
        <div style="margin-top:4px;font-size:10px;">Powered by BidDrop</div>
      </div>`;

    return `
      ${headerHtml}
      <div style="max-width:600px;margin:0 auto;padding-bottom:40px;">
        ${heroHtml}
        ${welcomeHtml}
        <div style="padding:16px 16px 0;">
          ${countdownHtml}
          ${videoHtml}
          ${matTabsHtml}
          ${trustHtml}
          ${detailsHtml}
          ${photosHtml}
          ${badgesHtml}
          ${repHtml}
          ${ctaHtml}
          ${footerHtml}
        </div>
      </div>
      <div class="ep-lightbox" id="ep-lightbox" onclick="epCloseLightbox()">
        <button class="ep-lightbox-close" onclick="epCloseLightbox()">&times;</button>
        <img id="ep-lightbox-img" src="" alt="Photo">
      </div>`;
  }

  // Remove loader and render page
  loader.remove();
  document.body.innerHTML = buildPage();

  // Track page view
  const _epStart = Date.now();
  fetch('/api/estimate?action=track_view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'track_view', id: estId, seconds: 0 }) }).catch(() => {});
  // Track QR scan — postcard QR codes always link to /e/[id]?src=qr; also track direct visits
  const _epSrc = new URLSearchParams(window.location.search).get('src') || 'direct';
  if (_epSrc === 'qr') {
    fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'track_qr_scan', id: estId }) }).catch(() => {});
  }
  window.addEventListener('beforeunload', () => {
    const secs = Math.round((Date.now() - _epStart) / 1000);
    navigator.sendBeacon('/api/estimate', JSON.stringify({ action: 'track_view', id: estId, seconds: secs }));
  });

  // Countdown live update
  if (est.expiresAt) {
    setInterval(() => {
      const el = document.getElementById('ep-countdown-val');
      if (!el) return;
      const diff = new Date(est.expiresAt) - new Date();
      if (diff <= 0) { el.textContent = 'Expired'; return; }
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      el.textContent = days > 0 ? `${days}d ${hrs}h` : `${hrs}h ${mins}m`;
    }, 60000);
  }

  // Global functions
  window.epSelectMat = function(matKey) {
    currentMat = matKey;
    fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'track_event', id: estId, event: 'mat_click', data: { mat: matKey } }) }).catch(() => {});
    const scrollY = window.scrollY;
    document.body.innerHTML = buildPage();
    window.scrollTo(0, scrollY);
    if (est.expiresAt) {
      setInterval(() => {
        const el = document.getElementById('ep-countdown-val');
        if (!el) return;
        const diff = new Date(est.expiresAt) - new Date();
        if (diff <= 0) { el.textContent = 'Expired'; return; }
        const days = Math.floor(diff / 86400000);
        const hrs = Math.floor((diff % 86400000) / 3600000);
        el.textContent = days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
      }, 60000);
    }
  };

  window.epTrackEvent = function(ev) {
    fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'track_event', id: estId, event: ev }) }).catch(() => {});
  };

  window.epShare = function() {
    if (navigator.share) {
      navigator.share({ title: 'Roofing Estimate — ' + (est.addr || ''), url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => alert('Link copied!')).catch(() => {});
    }
  };

  window.epOpenLightbox = function(idx) {
    const lb = document.getElementById('ep-lightbox');
    const img = document.getElementById('ep-lightbox-img');
    if (lb && img) { img.src = allPhotos[idx].url; lb.classList.add('open'); }
  };

  window.epCloseLightbox = function() {
    const lb = document.getElementById('ep-lightbox');
    if (lb) lb.classList.remove('open');
  };
}
