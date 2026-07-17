// src/mailer-preview.js
// Estimator live preview panel — letter/postcard/proposal mode switcher,
// canvas postcard modal, fullscreen preview, proposal preview refresh.
// Depends on: S.cfg, S.pins, currentAccount, calcP() (estimates-calc.js),
//             buildProposalHTML() (proposal.js), toast()
// Extracted from index.html — Tier 5 modularization

function updatePreview(){
  const owner  = document.getElementById('e-owner').value || 'Homeowner';
  const addr   = document.getElementById('e-addr').value  || '';
  const cfg    = S.cfg;
  const co     = cfg.companyName   || 'Your Roofing Co';
  const coAddr = cfg.companyAddr   || '';
  const ph     = cfg.companyPhone  || '(000) 000-0000';
  const accent = cfg.brandColor    || '#F25C05';
  const rep    = cfg.repName       || co;
  const repTitle = cfg.repTitle    || 'Roofing Consultant';
  const lic    = cfg.licenseNum    || '';
  const yrs    = cfg.yearsInBusiness || '5+';
  const warr   = cfg.warrantyYears || '10';
  const logoUrl = (cfg.logoData && cfg.logoData.startsWith('http')) ? cfg.logoData : '';
  const hsUrl   = (cfg.headshotData && cfg.headshotData.startsWith('http')) ? cfg.headshotData : '';
  const bookUrl = cfg.bookingUrl || 'https://biddrop.us';

  // QR code
  const _previewEstId = window._editingEstimateId || null;
  const _previewSlug = co.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=' + encodeURIComponent(
    _previewEstId ? 'https://biddrop.us/'+_previewSlug+'/'+encodeURIComponent(_previewEstId) : bookUrl
  );

  // Financing
  const finEnabled = cfg.financingEnabled !== false;
  const finApr  = parseFloat(cfg.financingApr)  || 9.99;
  const finTerm = parseInt(cfg.financingTerm)   || 60;
  const finDown = parseFloat(cfg.financingDown) || 0;
  function calcMonthly(total){
    const loan = total * (1 - finDown/100);
    const r = finApr/100/12;
    return r===0 ? Math.round(loan/finTerm) : Math.round(loan*r*Math.pow(1+r,finTerm)/(Math.pow(1+r,finTerm)-1));
  }

  // Structures & totals
  // window._structures is populated by calcP() in estimates-calc.js
  const structures = (window._structures || []).filter(s=>s && s.price > 0);
  const grandTotal = (window._calcDisplayFinal && window._calcDisplayFinal > 0)
    ? window._calcDisplayFinal
    : structures.reduce((a,s)=>a+(s.price||0),0);
  const finMo = (finEnabled && grandTotal) ? calcMonthly(grandTotal) : 0;
  const finDisc = 'Financing estimate based on '+finApr+'% APR, '+finTerm+'-month term, subject to credit approval.';

  // Copy fields
  const hookTxt  = cfg.hookLetter   || 'We looked up your address, measured your roof using satellite data, and put together a real price — before we ever reached out. No appointment needed. No one coming to your door. Your number is right here.';
  const aboutCo  = cfg.aboutCompany || 'We are a local roofing company that believes in straight answers. No runaround, no pressure — just honest work from a crew that stands behind every job.';
  const diff1    = cfg.diff1 || 'Licensed, Bonded & Insured';
  const diff2    = cfg.diff2 || 'Manufacturer Certified';
  const diff3    = cfg.diff3 || 'Workmanship Warranty';
  const diff4    = cfg.diff4 || 'Financing Available';
  const diff5    = cfg.diff5 || 'Local Crews';

  // Photos
  const _letterFrontPhoto = ((window._allPhotos && window._allPhotos.front)||[])[0] || window._homePhotoData || null;
  const dmgPhotos = (window._damagePhotos && window._damagePhotos.length) ? window._damagePhotos.slice(0,3) : [];

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const addrParts = addr.split(',').map(s=>s.trim()).filter(Boolean);
  const ownerFirst = owner.split(' ')[0] || owner;

  // ── Shared styles ──────────────────────────────────────────────────────────
  const sharedStyles = `
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      .bd-page{width:100%;background:#fff;margin-bottom:0;font-family:'Inter',sans-serif;color:#111;page-break-after:always}
      .bd-top-bar{display:flex;justify-content:space-between;align-items:flex-start;padding:28px 40px 0}
      .bd-logo{max-height:40px;max-width:160px;object-fit:contain}
      .bd-co-name{font-family:'DM Serif Display',serif;font-size:22px;color:${accent}}
      .bd-co-meta{font-size:11px;color:#888;margin-top:3px}
      .bd-addr-block{text-align:right}
      .bd-addr-name{font-size:13px;font-weight:700;color:#111}
      .bd-addr-line{font-size:12px;color:#555}
      .bd-page-label{font-size:12px;color:#888;font-weight:500}
      .bd-rule{height:3px;background:${accent};margin:16px 40px 0}
      .bd-body{flex:1;padding:28px 40px}
      .bd-salutation{font-family:'DM Serif Display',serif;font-size:28px;color:#111;margin-bottom:12px}
      .bd-hook{font-size:14px;line-height:1.75;color:#333;margin-bottom:28px;max-width:580px}
      .bd-estimate-box{border:2px solid ${accent};padding:20px 28px;margin-bottom:28px;display:inline-block;min-width:300px}
      .bd-est-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:6px}
      .bd-est-amount{font-family:'DM Serif Display',serif;font-size:52px;color:#111;line-height:1}
      .bd-est-fin{font-size:12px;color:#555;margin-top:8px}
      .bd-two-col{display:flex;gap:40px}
      .bd-col-left{flex:1}
      .bd-col-right{width:180px;text-align:center}
      .bd-section-head{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:700;margin-bottom:10px}
      .bd-about-text{font-size:13px;line-height:1.65;color:#333;margin-bottom:14px}
      .bd-cred-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      .bd-cred{font-size:11px;color:#333;border:1px solid #ccc;padding:3px 9px;white-space:nowrap}
      .bd-headshot{width:100px;height:100px;border-radius:50%;object-fit:cover;border:2px solid ${accent};margin-bottom:8px}
      .bd-rep-name{font-size:14px;font-weight:700;color:#111}
      .bd-rep-title{font-size:12px;color:#666;margin-bottom:4px}
      .bd-rep-phone{font-size:13px;color:${accent};font-weight:600}
      .bd-footer-bar{background:#111;display:flex;justify-content:space-between;align-items:center;padding:16px 40px}
      .bd-footer-phone{font-family:'DM Serif Display',serif;font-size:22px;color:#fff}
      .bd-footer-sub{font-size:10px;color:#aaa;margin-top:2px}
      .bd-footer-co{font-size:13px;font-weight:600;color:#fff}
      .bd-footer-meta{font-size:10px;color:#aaa;margin-top:2px}
      .bd-qr{width:52px;height:52px;display:block;margin:0 auto}
      .bd-qr-label{font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-top:3px;text-align:center}
      .bd-table{width:100%;border-collapse:collapse;font-size:13px}
      .bd-table th{text-align:left;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;padding:8px 0;border-bottom:2px solid #eee}
      .bd-table td{padding:10px 0;border-bottom:1px solid #f0f0f0;color:#333}
      .bd-total-row td{font-size:15px;color:#111;border-top:2px solid #111;border-bottom:none;padding-top:14px;font-weight:700}
      .bd-fin-row td{font-size:12px;color:#666;border-bottom:none}
      .bd-notice{font-size:11px;color:#999;margin-top:14px;line-height:1.5}
      .bd-included-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
      .bd-inc-item{font-size:13px;color:#333;padding:4px 0}
      .bd-steps{display:flex;flex-direction:column;gap:24px;margin-bottom:32px}
      .bd-step{display:flex;gap:20px;align-items:flex-start}
      .bd-step-num{width:36px;height:36px;border-radius:50%;color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${accent}}
      .bd-step-title{font-size:15px;font-weight:700;color:#111;margin-bottom:4px}
      .bd-step-desc{font-size:13px;color:#555;line-height:1.6}
      .bd-cta-box{border:2px solid ${accent};padding:24px 28px;text-align:center;margin-top:8px}
      .bd-cta-phone{font-family:'DM Serif Display',serif;font-size:36px;color:${accent}}
      .bd-cta-sub{font-size:13px;color:#666;margin-top:4px}
      .bd-photo{width:100%;max-height:200px;object-fit:cover;display:block;margin-bottom:20px}
      .bd-dmg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
      .bd-dmg-photo{width:100%;height:110px;object-fit:cover;display:block}
    </style>`;

  // ── PAGE 1 ─────────────────────────────────────────────────────────────────
  const page1 = `<div class="bd-page">
  ${sharedStyles}
  <div class="bd-top-bar">
    <div>
      ${logoUrl ? '<img src="'+esc(logoUrl)+'" class="bd-logo" alt="'+esc(co)+'">' : '<span class="bd-co-name">'+esc(co)+'</span>'}
      <div class="bd-co-meta">${esc(coAddr)}${lic ? ' &nbsp;&bull;&nbsp; Lic. '+esc(lic) : ''}</div>
    </div>
    <div class="bd-addr-block">
      <div class="bd-addr-name">${esc(owner)}</div>
      ${addrParts.map(l=>'<div class="bd-addr-line">'+esc(l)+'</div>').join('')}
    </div>
  </div>
  <div class="bd-rule"></div>
  <div class="bd-body">
    ${_letterFrontPhoto ? '<img src="'+_letterFrontPhoto+'" class="bd-photo">' : ''}
    <div class="bd-salutation">Dear ${esc(ownerFirst)},</div>
    <div class="bd-hook">${esc(hookTxt)}</div>
    <div class="bd-estimate-box">
      <div class="bd-est-label">Your Estimate</div>
      <div class="bd-est-amount">$${grandTotal ? grandTotal.toLocaleString() : '—'}</div>
      ${finMo ? '<div class="bd-est-fin">or as low as <strong>$'+finMo.toLocaleString()+'/mo</strong> &nbsp;&middot;&nbsp; '+finApr+'% APR &nbsp;&middot;&nbsp; '+finTerm+' mo &nbsp;&middot;&nbsp; $0 down</div>' : ''}
    </div>
    <div class="bd-two-col">
      <div class="bd-col-left">
        <div class="bd-section-head">About ${esc(co)}</div>
        <div class="bd-about-text">${esc(aboutCo)}</div>
        <div class="bd-cred-row">
          <span class="bd-cred">${esc(diff1)}</span>
          <span class="bd-cred">${esc(diff2)}</span>
          <span class="bd-cred">${esc(diff3)}</span>
          <span class="bd-cred">${esc(diff4)}</span>
          <span class="bd-cred">${esc(diff5)}</span>
        </div>
      </div>
      <div class="bd-col-right">
        <div class="bd-section-head">Your Rep</div>
        ${hsUrl ? '<img src="'+esc(hsUrl)+'" class="bd-headshot" alt="'+esc(rep)+'">' : ''}
        <div class="bd-rep-name">${esc(rep)}</div>
        <div class="bd-rep-title">${esc(repTitle)}</div>
        <div class="bd-rep-phone">${esc(ph)}</div>
      </div>
    </div>
  </div>
  <div class="bd-footer-bar">
    <div>
      <div class="bd-footer-phone">${esc(ph)}</div>
      <div class="bd-footer-sub">Call or text to schedule</div>
    </div>
    <div style="text-align:center">
      <img src="${esc(qrUrl)}" class="bd-qr" alt="QR">
      <div class="bd-qr-label">Scan to Book</div>
    </div>
    <div style="text-align:right">
      <div class="bd-footer-co">${esc(co)}</div>
      <div class="bd-footer-meta">${esc(coAddr)}</div>
      ${lic ? '<div class="bd-footer-meta">Lic. '+esc(lic)+'</div>' : ''}
    </div>
  </div>
</div>`;

  // ── PAGE 2 — Estimate Detail ───────────────────────────────────────────────
  const structRows = structures.length
    ? structures.map(s=>'<tr><td>'+esc(s.name||s.label||'Roof')+'</td><td>'+(s.sqft?(s.sqft.toLocaleString()+' sq ft'):'—')+'</td><td>'+esc(s.material||'—')+'</td><td>$'+(s.price||0).toLocaleString()+'</td></tr>').join('')
    : '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:20px 0">No structures added yet</td></tr>';

  const page2 = `<div class="bd-page" style="padding-top:0">
  <div class="bd-top-bar">
    <div>
      ${logoUrl ? '<img src="'+esc(logoUrl)+'" class="bd-logo" alt="'+esc(co)+'">' : '<span class="bd-co-name">'+esc(co)+'</span>'}
    </div>
    <span class="bd-page-label">Estimate Detail &nbsp;&middot;&nbsp; Page 2 of 3</span>
  </div>
  <div class="bd-rule"></div>
  <div class="bd-body">
    ${dmgPhotos.length ? '<div class="bd-section-head" style="margin-bottom:10px">Assessment Photos</div><div class="bd-dmg-grid">'+dmgPhotos.map(src=>'<img src="'+src+'" class="bd-dmg-photo">').join('')+'</div>' : ''}
    <div class="bd-section-head" style="margin-bottom:14px">Price Breakdown</div>
    <table class="bd-table">
      <thead><tr><th>Structure</th><th>Size</th><th>Material</th><th>Price</th></tr></thead>
      <tbody>
        ${structRows}
        <tr class="bd-total-row">
          <td colspan="3">Total Investment</td>
          <td>$${grandTotal ? grandTotal.toLocaleString() : '—'}</td>
        </tr>
        ${finMo ? '<tr class="bd-fin-row"><td colspan="3">Monthly Financing ('+finApr+'% APR, '+finTerm+' mo, $0 down)</td><td>$'+finMo.toLocaleString()+'/mo</td></tr>' : ''}
      </tbody>
    </table>
    ${finMo ? '<div class="bd-notice">'+esc(finDisc)+'</div>' : ''}
    <div class="bd-section-head" style="margin-top:28px;margin-bottom:14px">What&rsquo;s Included</div>
    <div class="bd-included-grid">
      <div class="bd-inc-item">&bull; Full tear-off of existing materials</div>
      <div class="bd-inc-item">&bull; Deck inspection &amp; repair</div>
      <div class="bd-inc-item">&bull; Ice &amp; water shield</div>
      <div class="bd-inc-item">&bull; Synthetic underlayment</div>
      <div class="bd-inc-item">&bull; New shingles (manufacturer spec)</div>
      <div class="bd-inc-item">&bull; Ridge cap &amp; ventilation</div>
      <div class="bd-inc-item">&bull; Flashing at all penetrations</div>
      <div class="bd-inc-item">&bull; Full cleanup &amp; haul-away</div>
    </div>
  </div>
  <div class="bd-footer-bar">
    <div><div class="bd-footer-phone">${esc(ph)}</div></div>
    <div style="text-align:right"><div class="bd-footer-co">${esc(co)}</div><div class="bd-footer-meta">${esc(coAddr)}</div></div>
  </div>
</div>`;

  // ── PAGE 3 — Next Steps ────────────────────────────────────────────────────
  const page3 = `<div class="bd-page" style="padding-top:0">
  <div class="bd-top-bar">
    <div>
      ${logoUrl ? '<img src="'+esc(logoUrl)+'" class="bd-logo" alt="'+esc(co)+'">' : '<span class="bd-co-name">'+esc(co)+'</span>'}
    </div>
    <span class="bd-page-label">Next Steps &nbsp;&middot;&nbsp; Page 3 of 3</span>
  </div>
  <div class="bd-rule"></div>
  <div class="bd-body">
    <div class="bd-section-head" style="margin-bottom:24px">Ready to Move Forward?</div>
    <div class="bd-steps">
      <div class="bd-step">
        <div class="bd-step-num">1</div>
        <div>
          <div class="bd-step-title">Call or Text Us</div>
          <div class="bd-step-desc">Reach out to ${esc(rep)} directly at ${esc(ph)}. We&rsquo;ll answer any questions and schedule a time that works for you.</div>
        </div>
      </div>
      <div class="bd-step">
        <div class="bd-step-num">2</div>
        <div>
          <div class="bd-step-title">We Come to You</div>
          <div class="bd-step-desc">A member of our crew visits the property to confirm measurements and walk you through the scope of work in person.</div>
        </div>
      </div>
      <div class="bd-step">
        <div class="bd-step-num">3</div>
        <div>
          <div class="bd-step-title">We Get to Work</div>
          <div class="bd-step-desc">Once you sign off, we schedule your job and complete the installation. Most roofs are done in a single day.</div>
        </div>
      </div>
    </div>
    <div class="bd-cta-box">
      <div class="bd-cta-phone">${esc(ph)}</div>
      <div class="bd-cta-sub">${esc(rep)}${repTitle ? ', '+esc(repTitle) : ''}</div>
      <div style="margin-top:16px;display:flex;align-items:center;justify-content:center;gap:16px">
        <img src="${esc(qrUrl)}" style="width:80px;height:80px" alt="QR">
        <div style="font-size:12px;color:#555;text-align:left">Scan to book online<br>No phone call required</div>
      </div>
    </div>
  </div>
  <div class="bd-footer-bar">
    <div><div class="bd-footer-phone">${esc(ph)}</div></div>
    <div style="text-align:right">
      <div class="bd-footer-co">${esc(co)}</div>
      <div class="bd-footer-meta">${esc(coAddr)}${lic ? ' &nbsp;&bull;&nbsp; Lic. '+esc(lic) : ''}</div>
    </div>
  </div>
</div>`;

  const isProposalMode = (window._previewMode === 'proposal');
  document.getElementById('mailer-preview').innerHTML = page1 + page2 + page3;
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

