// src/photo.js
// Logo, headshot, review, postcard photo uploads; drip postcard HTML builder;
// postcard/letter preview modals; estimate photo lightbox; home/damage photo capture.
// Depends on: sb, S.cfg, S.pins, currentAccount, uploadToStorage(), toast()
// Extracted from index.html — Tier 4 modularization

function handleLogoUpload(inp){
  if(!inp.files||!inp.files[0])return;
  const file = inp.files[0];
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const path = acctId + '/cfg/logo.' + ext;
  toast('Uploading logo…','info');
  uploadToStorage(file, path, 800, 0.9, mime).then(url=>{
    if(url){
      S.cfg.logoData = url;
      const prev=document.getElementById('logo-preview');
      if(prev){prev.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:100%;object-fit:contain;">';prev.style.cursor='zoom-in';prev.onclick=()=>openBrandingLightbox(url,'Company Logo');}
      save();updatePreview();toast('Logo uploaded!','success');
    } else {
      // Fallback: store as base64 if upload fails
      const r2 = new FileReader();
      r2.onload = ev=>{
        S.cfg.logoData = ev.target.result;
        const prev=document.getElementById('logo-preview');
        if(prev){prev.innerHTML='<img src="'+ev.target.result+'" style="max-width:100%;max-height:100%;object-fit:contain;">';prev.style.cursor='zoom-in';prev.onclick=()=>openBrandingLightbox(ev.target.result,'Company Logo');}
        save();updatePreview();toast('Logo saved locally','info');
      };
      r2.readAsDataURL(file);
    }
  });
}

function handleHeadshotUpload(inp){
  if(!inp.files||!inp.files[0])return;
  const file = inp.files[0];
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const path = acctId + '/cfg/headshot.png';
  toast('Uploading headshot…','info');
  uploadToStorage(file, path, 600, 0.92, 'image/png').then(url=>{
    if(url){
      S.cfg.headshot = url;
      const prev=document.getElementById('headshot-preview');
      if(prev){prev.innerHTML='<img src="'+url+'" style="max-width:100%;max-height:100%;object-fit:contain;">';prev.style.cursor='zoom-in';prev.onclick=()=>openBrandingLightbox(url,'Rep Headshot');}
      save();updatePreview();toast('Headshot uploaded!','success');
    } else {
      const r2 = new FileReader();
      r2.onload = ev=>{
        const img=new Image();
        img.onload=()=>{
          const canvas=document.createElement('canvas');
          const MAX=600; let w=img.width,h=img.height;
          if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}
          canvas.width=w;canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          const data=canvas.toDataURL('image/png');
          S.cfg.headshot=data;
          const prev=document.getElementById('headshot-preview');
          if(prev){prev.innerHTML='<img src="'+data+'" style="max-width:100%;max-height:100%;object-fit:contain;">';prev.style.cursor='zoom-in';prev.onclick=()=>openBrandingLightbox(data,'Rep Headshot');}
          save();updatePreview();toast('Headshot saved locally','info');
        };
        img.src=ev.target.result;
      };
      r2.readAsDataURL(file);
    }
  });
}
function clearHeadshot(){
  S.cfg.headshot=null;
  const prev=document.getElementById('headshot-preview');
  if(prev)prev.innerHTML='No photo';
  save();updatePreview();
}
function handleReviewUpload(inp,slot){
  if(!inp.files||!inp.files[0])return;
  const file = inp.files[0];
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const path = acctId + '/cfg/review-' + slot + '.jpg';
  toast('Uploading review image…','info');
  uploadToStorage(file, path, 900, 0.88, 'image/jpeg').then(url=>{
    if(url){
      S.cfg['review'+slot] = url;
      const prev=document.getElementById('review'+slot+'-preview');
      if(prev){prev.innerHTML='<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';prev.style.cursor='zoom-in';prev.onclick=()=>openBrandingLightbox(url,'Review Image '+slot);}
      save();updatePreview();toast('Review '+slot+' uploaded!','success');
    } else {
      const r2 = new FileReader();
      r2.onload = ev=>{
        const img=new Image();
        img.onload=()=>{
          const canvas=document.createElement('canvas');
          const MAX=900; let w=img.width,h=img.height;
          if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
          canvas.width=w;canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          const data=canvas.toDataURL('image/jpeg',.88);
          S.cfg['review'+slot]=data;
          const prev=document.getElementById('review'+slot+'-preview');
          if(prev){prev.innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';prev.style.cursor='zoom-in';prev.onclick=()=>openBrandingLightbox(data,'Review Image '+slot);}
          save();updatePreview();toast('Review '+slot+' saved locally','info');
        };
        img.src=ev.target.result;
      };
      r2.readAsDataURL(file);
    }
  });
}
function clearReview(slot){
  S.cfg['review'+slot]=null;
  const prev=document.getElementById('review'+slot+'-preview');
  if(prev)prev.innerHTML='No image';
  save();updatePreview();
}

function clearLogo(){
  S.cfg.logoData=null;
  const prev=document.getElementById('logo-preview');
  if(prev)prev.innerHTML='No logo';
  save();updatePreview();
}

// ── DRIP POSTCARD UPLOAD HANDLERS ────────────────────────────────────────────
function handlePostcardUpload(inp, step){
  if(!inp.files||!inp.files[0]) return;
  const file = inp.files[0];
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const path = acctId + '/cfg/postcard-step' + step + '.jpg';
  toast('Uploading postcard design…','info');
  uploadToStorage(file, path, 1800, 0.92, 'image/jpeg').then(url=>{
    if(url){
      S.cfg['postcardStep'+step] = url;
      const prev = document.getElementById('pc'+step+'-preview');
      if(prev) prev.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';
      save(); toast('Postcard Step '+step+' uploaded!','success');
    } else {
      const r2 = new FileReader();
      r2.onload = ev => {
        S.cfg['postcardStep'+step] = ev.target.result;
        const prev = document.getElementById('pc'+step+'-preview');
        if(prev) prev.innerHTML = '<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">';
        save(); toast('Postcard Step '+step+' saved!','success');
      };
      r2.readAsDataURL(file);
    }
  });
}

function clearPostcard(step){
  S.cfg['postcardStep'+step] = null;
  const prev = document.getElementById('pc'+step+'-preview');
  if(prev) prev.innerHTML = 'No design<br>uploaded';
  save();
}

// Called when drip modal opens — show postcard thumbnails and missing warnings
// Build the drip postcard front as an HTML string using the house photo + step message
// Returns an HTML string suitable for Lob's front parameter
function buildDripPostcardFrontHtml({ photoUrl, headline, subtext, companyName, estimateTotal, address, phone, logoUrl }){
  // Use the same 864x576 (6x9) format as the main postcard for visual consistency
  const cfg   = S.cfg || {};
  const color = cfg.brandColor || '#F25C05';
  const co    = companyName || cfg.companyName || 'Your Roofing Co';
  const ph    = phone || cfg.companyPhone || '(000) 000-0000';
  const total = estimateTotal || 0;
  const escH  = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  // Parse address for short display
  const parts = (address||'').split(',');
  const shortAddr = parts[0] ? parts[0].trim() : (address||'');
  const cityState = parts.slice(1,3).map(s=>s.trim()).join(', ');
  const photoStyle = photoUrl
    ? `background-image:url('${escH(photoUrl)}');background-size:cover;background-position:center;`
    : `background:#1a2333;`;
  // Financing
  const finEnabled = cfg.financingEnabled !== false;
  const finApr  = parseFloat(cfg.financingApr)  || 9.99;
  const finTerm = parseInt(cfg.financingTerm)   || 60;
  const finDown = parseFloat(cfg.financingDown) || 0;
  let finMo = 0;
  if(finEnabled && total){
    const loan = total * (1 - finDown/100);
    const r = finApr / 100 / 12;
    finMo = r===0 ? Math.round(loan/finTerm) : Math.round(loan * r * Math.pow(1+r,finTerm) / (Math.pow(1+r,finTerm)-1));
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=864">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;position:relative;}
  .photo-bg{position:absolute;inset:0;${photoStyle}}
  .photo-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.25) 0%,rgba(0,0,0,.1) 40%,rgba(0,0,0,.65) 75%,rgba(0,0,0,.85) 100%);}
  .content{position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:34px 38px;}
  .top-bar{display:flex;justify-content:space-between;align-items:flex-start;}
  .logo-wrap img{max-height:53px;max-width:192px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6));}
  .logo-wrap .co-name{font-size:22px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);letter-spacing:1px;}
  .badge{background:${color};color:#fff;font-size:13px;font-weight:800;padding:8px 18px;border-radius:30px;letter-spacing:.5px;text-transform:uppercase;box-shadow:0 3px 12px rgba(0,0,0,.4);white-space:nowrap;}
  .bottom{}
  .headline{font-size:38px;font-weight:900;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.8);line-height:1.1;margin-bottom:10px;letter-spacing:-0.5px;}
  .subtext-line{font-size:16px;color:rgba(255,255,255,.9);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:14px;font-weight:500;line-height:1.4;}
  .addr-line{font-size:16px;color:rgba(255,255,255,.85);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:14px;font-weight:600;}
  .price-strip{background:${color};display:inline-flex;align-items:center;gap:20px;padding:12px 24px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.5);}
  .price-main{font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px;}
  .price-label{font-size:11px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.5px;line-height:1.3;}
  .price-divider{width:1px;height:36px;background:rgba(255,255,255,.3);}
  .phone-line{margin-top:14px;font-size:16px;color:rgba(255,255,255,.85);font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.6);letter-spacing:.3px;}
</style>
</head>
<body>
  <div class="photo-bg"></div>
  <div class="content">
    <div class="top-bar">
      <div class="logo-wrap">
        ${logoUrl ? `<img src="${escH(logoUrl)}" alt="${escH(co)}">` : `<div class="co-name">${escH(co)}</div>`}
      </div>
      <div class="badge">Follow-Up</div>
    </div>
    <div class="bottom">
      <div class="headline">${escH(headline)}</div>
      <div class="subtext-line">${escH(subtext)}</div>
      <div class="addr-line">&#128205; ${escH(shortAddr)}${cityState ? ', '+escH(cityState) : ''}</div>
      ${total ? `<div class="price-strip">
        <div>
          <div class="price-label">Your Estimate</div>
          <div class="price-main">$${Number(total).toLocaleString()}</div>
        </div>
        ${finMo ? `<div class="price-divider"></div><div><div class="price-label">As Low As</div><div class="price-main">$${finMo.toLocaleString()}<span style="font-size:16px;font-weight:600;">/mo</span></div></div>` : ''}
      </div>` : ''}
      <div class="phone-line">&#128222; ${escH(ph)}</div>
    </div>
  </div>
</body>
</html>`;
}

// ── Inject m-campaign-postcard modal into page DOM (once) ─────────────────────
(function(){
  if(document.getElementById('m-campaign-postcard')) return;
  const _wrap = document.createElement('div');
  _wrap.innerHTML = `<!-- Nearby Campaign Postcard Modal -->
<div id="m-campaign-postcard" class="modal-overlay" style="display:none;z-index:9000;">
  <div class="modal-box" style="max-width:520px;width:95%;background:var(--panel);border-radius:14px;padding:24px;position:relative;">
    <button onclick="closeM('m-campaign-postcard')" style="position:absolute;top:14px;right:14px;background:none;border:none;color:var(--mid);font-size:20px;cursor:pointer;line-height:1;">✕</button>
    <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:4px;">📮 Nearby Campaign</div>
    <div id="coi-postcard-subtitle" style="font-size:12px;color:var(--muted);margin-bottom:18px;">Sending to <span id="coi-postcard-count" style="color:#F25C05;font-weight:700;">0</span> homes</div>

    <!-- Job photo upload -->
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Job Photo (becomes postcard front)</div>
      <div id="coi-photo-drop" onclick="document.getElementById('coi-photo-inp').click()" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color .2s;background:var(--card2);">
        <div id="coi-photo-preview" style="display:none;"><img id="coi-photo-img" style="max-height:140px;max-width:100%;border-radius:8px;object-fit:contain;"></div>
        <div id="coi-photo-placeholder" style="color:var(--muted);font-size:13px;">📷 Click to upload job photo<br><span style="font-size:11px;">JPG, PNG — will be used as postcard front image</span></div>
      </div>
      <input type="file" id="coi-photo-inp" accept="image/*" style="display:none;" onchange="handleCOIPhotoUpload(this)">
    </div>

    <!-- Headline -->
    <div style="margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Postcard Headline</div>
      <input id="coi-headline" type="text" value="We just finished a project in your neighborhood!" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;font-family:var(--font-b);" placeholder="We just finished a deck 3 houses away!">
    </div>

    <!-- Subtext -->
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:var(--mid);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Subtext</div>
      <input id="coi-subtext" type="text" value="Your neighbors love the results. Want a free quote?" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;font-family:var(--font-b);" placeholder="Call us for a free estimate!">
    </div>

    <!-- Cost estimate -->
    <div id="coi-cost-bar" style="background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:12px;color:var(--muted);">Estimated cost: <span id="coi-cost-est" style="color:var(--text);font-weight:700;">—</span></div>
      <div style="font-size:11px;color:var(--muted);">$1.50/postcard via Lob</div>
    </div>

    <div style="display:flex;gap:10px;">
      <button onclick="closeM('m-campaign-postcard')" style="flex:1;background:none;border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>
      <button onclick="sendCampaignPostcards()" id="btn-send-campaign" style="flex:2;background:#F25C05;border:none;border-radius:8px;padding:10px;color:#fff;font-size:13px;font-weight:800;cursor:pointer;">📮 Send Campaign</button>
    </div>
    <div id="coi-send-progress" style="display:none;margin-top:14px;">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px;">Sending postcards…</div>
      <div style="background:var(--card2);border-radius:6px;height:6px;overflow:hidden;"><div id="coi-progress-bar" style="height:100%;background:#F25C05;width:0%;transition:width .3s;border-radius:6px;"></div></div>
      <div id="coi-progress-text" style="font-size:11px;color:var(--muted);margin-top:4px;">0 / 0 sent</div>
    </div>
  </div>
</div>`;
  document.body.appendChild(_wrap.firstElementChild);
})();


// Get the drip message config for a given step number (2, 3, 4)
function getDripStepMessage(step){
  const cfg = S.cfg || {};
  const defaults = {
    2: { headline: 'Still thinking it over?',           subtext: "Your estimate is still valid. We'd love to help." },
    3: { headline: 'Storm season is coming.',            subtext: "Now's the time to protect your home. Call us today." },
    4: { headline: 'Final notice.',                      subtext: 'Your estimate expires soon. Secure your spot before prices rise.' },
  };
  const d = defaults[step] || { headline: 'Follow-Up', subtext: '' };
  return {
    headline: cfg['drip'+step+'Headline'] || d.headline,
    subtext:  cfg['drip'+step+'Subtext']  || d.subtext,
  };
}

function refreshDripPostcardPreviews(){
  const est = (S.estimates||[]).find(e=>e.id===_dripEstId) || {};
  const cfg = S.cfg || {};
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const photoUrl = est.photo_url || (pin && pin.photo_url) || est.photo_data || null;
  const toName      = est.owner || 'Homeowner';
  const toAddrShort = (est.addr||'').split(',').slice(0,2).join(', ');
  const fromName    = cfg.companyName || 'Your Company';
  const fromAddr    = cfg.companyAddress || '1 Company Dr';
  const placeholder = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect width=%22300%22 height=%22200%22 fill=%22%23111827%22/><text x=%22150%22 y=%2290%22 text-anchor=%22middle%22 fill=%22%236B7280%22 font-size=%2214%22 font-family=%22Arial%22>House photo</text><text x=%22150%22 y=%22112%22 text-anchor=%22middle%22 fill=%22%236B7280%22 font-size=%2212%22 font-family=%22Arial%22>will appear here</text></svg>';
  [2,3,4,5,6].forEach(step=>{
    const msg     = getDripStepMessage(step);
    const thumb   = document.getElementById('drip-pc'+step+'-thumb');
    const missing = document.getElementById('drip-pc'+step+'-missing');
    const frontWrap = document.getElementById('drip-pc'+step+'-front-wrap');
    const backFrom= document.getElementById('drip-pc'+step+'-back-from');
    const backTo  = document.getElementById('drip-pc'+step+'-back-to');
    // Build proper 6x9 iframe front
    const frontHtml = buildDripPostcardFrontHtml({
      photoUrl: photoUrl||null, headline: msg.headline, subtext: msg.subtext,
      companyName: fromName, companyAddress: fromAddr, phone: cfg.phone||'',
      logoUrl: cfg.logoData||'', repHeadshot: cfg.repHeadshot||'', repName: cfg.repName||'',
      total: est.total||0, finMo: est.finMo||0
    });
    if(frontWrap){
      frontWrap.style.cssText = 'position:relative;width:100%;padding-top:66.67%;overflow:hidden;border-radius:5px;border:1px solid var(--border);';
      const encodedHtml = frontHtml.replace(/"/g,'&quot;').replace(/`/g,'&#96;');
      frontWrap.innerHTML = `<iframe srcdoc="${encodedHtml}"
        style="position:absolute;top:0;left:0;width:864px;height:576px;border:none;transform-origin:top left;pointer-events:none;max-width:none;"
        scrolling="no" data-drip-iframe="1"></iframe>`;
      const applyScale = () => {
        const iframe = frontWrap.querySelector('iframe');
        if(iframe){ const w=frontWrap.offsetWidth||200; iframe.style.transform='scale('+(w/864)+')'; }
      };
      requestAnimationFrame(applyScale);
      setTimeout(applyScale, 100);
    }
    if(backFrom) backFrom.innerHTML = '<strong>'+fromName+'</strong><br>'+fromAddr;
    if(backTo)   backTo.innerHTML   = '<strong>'+toName+'</strong><br>'+toAddrShort;
    if(thumb) thumb.style.display = 'block';
    if(missing) missing.style.display = 'none';
  });
}
// Preview the drip postcard front in a full-screen lightbox (uses house photo + message)
function previewDripFront(step){
  const est = (S.estimates||[]).find(e=>e.id===_dripEstId) || {};
  const cfg = S.cfg || {};
  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const photoUrl = est.photo_url || (pin && pin.photo_url) || est.photo_data || null;
  const msg = getDripStepMessage(step);
  const stepNames = {2:'Step 2 — Follow-Up (Day 7)',3:'Step 3 — Urgency (Day 14)',4:'Step 4 — Final (Day 28)'};
  const label = stepNames[step] || 'Step '+step;
  const existing = document.getElementById('drip-front-lightbox');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'drip-front-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="width:100%;max-width:700px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="color:#fff;font-weight:700;font-size:14px;">&#128247; Postcard Front — ${label}</span>
        <button onclick="document.getElementById('drip-front-lightbox').remove()" style="background:none;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 12px;color:#fff;font-size:13px;cursor:pointer;">&#10005; Close</button>
      </div>
      <div style="position:relative;border-radius:10px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.6);">
        ${photoUrl
          ? `<img src="${photoUrl}" style="width:100%;display:block;aspect-ratio:3/2;object-fit:cover;">`
          : '<div style="width:100%;aspect-ratio:3/2;background:linear-gradient(135deg,#1a1a2e,#16213e);display:flex;align-items:center;justify-content:center;color:#6B7280;font-size:14px;">House photo will appear here</div>'
        }
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.1) 0%,rgba(0,0,0,.65) 100%);"></div>
        <div style="position:absolute;top:5%;right:4%;background:#E8531A;color:#fff;font-size:9px;font-weight:700;padding:3px 12px;border-radius:20px;letter-spacing:.5px;">YOUR ROOF ASSESSMENT IS READY</div>
        <div style="position:absolute;bottom:0;left:0;right:0;padding:5% 6% 6%;">
          <div style="font-size:clamp(18px,3.5vw,32px);font-weight:900;color:#fff;line-height:1.1;margin-bottom:8px;text-shadow:0 2px 8px rgba(0,0,0,.6);">${escHtml(msg.headline)}</div>
          <div style="font-size:clamp(10px,1.5vw,14px);color:rgba(255,255,255,.88);line-height:1.4;text-shadow:0 1px 4px rgba(0,0,0,.5);">${escHtml(msg.subtext)}</div>
          ${est.total ? `<div style="margin-top:10px;background:rgba(232,83,26,.9);color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:20px;display:inline-block;">$${Number(est.total).toLocaleString()} Estimate</div>` : ''}
        </div>
      </div>
      <div style="text-align:center;margin-top:10px;color:rgba(255,255,255,.5);font-size:11px;">Actual print size: 6&#215;4&#8243; &bull; House photo + your message &bull; Click outside to close</div>
    </div>`;
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
// Preview drip front from the Estimates "Postcards" modal (no _dripEstId context)
function previewDripFrontFromEstimate(step, estId){
  const origId = _dripEstId;
  _dripEstId = estId;
  previewDripFront(step);
  _dripEstId = origId;
}



function previewPostcardFront(step){
  const url = S.cfg && S.cfg['postcardStep'+step];
  if(!url){ toast('No postcard design uploaded for this step','error'); return; }
  const stepNames = {2:'Step 2 — Follow-Up (Day 7)',3:'Step 3 — Urgency (Day 14)',4:'Step 4 — Final (Day 28)'};
  const label = stepNames[step] || 'Step '+step;
  // Create lightbox overlay
  const overlay = document.createElement('div');
  overlay.id = 'pc-front-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="width:100%;max-width:700px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="color:#fff;font-weight:700;font-size:14px;">📮 Postcard Front — ${label}</span>
        <button onclick="document.getElementById('pc-front-lightbox').remove()" style="background:none;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 12px;color:#fff;font-size:13px;cursor:pointer;">✕ Close</button>
      </div>
      <img src="${url}" style="width:100%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6);display:block;">
      <div style="text-align:center;margin-top:10px;color:rgba(255,255,255,.5);font-size:11px;">Click anywhere outside to close</div>
    </div>
  `;
  overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Preview the postcard back in an in-page lightbox (matches front card behavior)
function previewPostcardBackLightbox(step, toName, toAddr, fromName, fromAddr, fromCity, fromPhone, logoUrl){
  const stepNames = {2:'Step 2 — Follow-Up (Day 7)',3:'Step 3 — Urgency (Day 14)',4:'Step 4 — Final (Day 28)'};
  const label = stepNames[step] || 'Step '+step;
  const existing = document.getElementById('pc-back-lightbox');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'pc-back-lightbox';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
  // Build the back inline — enforced 6x9 landscape (3:2) aspect ratio
  const backInner = `
    <div style="width:100%;max-width:720px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="color:#fff;font-weight:700;font-size:14px;">📮 Postcard Back — ${label}</span>
        <button onclick="document.getElementById('pc-back-lightbox').remove()" style="background:none;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:4px 12px;color:#fff;font-size:13px;cursor:pointer;">✕ Close</button>
      </div>
      <!-- 6x9 postcard = 9in wide x 6in tall = 3:2 ratio. We enforce this with padding-top trick -->
      <div style="position:relative;width:100%;padding-top:66.67%;background:#fff;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;">
        <div style="position:absolute;inset:0;display:flex;font-family:Arial,sans-serif;">
          <!-- Left side: return address (3.5in of 6in = 58%) -->
          <div style="width:58%;border-right:1px solid #ccc;padding:6% 5%;display:flex;flex-direction:column;justify-content:space-between;">
            <div>${logoUrl?'<img src="'+logoUrl+'" style="max-height:15%;max-width:45%;object-fit:contain;margin-bottom:4%;display:block;">':''}<div style="font-size:1.6vw;color:#333;line-height:1.6;"><strong style="font-size:1.8vw;">${fromName}</strong><br>${fromAddr}${fromCity?'<br>'+fromCity:''}</div></div>
            <div style="font-size:1.1vw;color:#bbb;border-top:1px dashed #ddd;padding-top:3%;letter-spacing:2px;">|||||||||||||||||||||||||||||||||||||||||||||</div>
          </div>
          <!-- Right side: indicia + recipient address (2.5in of 6in = 42%) -->
          <div style="width:42%;padding:6% 5%;display:flex;flex-direction:column;justify-content:space-between;">
            <div style="border:1px solid #333;padding:2% 3%;font-size:1.1vw;color:#333;text-align:center;align-self:flex-end;"><strong style="font-size:1.4vw;display:block;">PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000</div>
            <div style="font-size:1.6vw;color:#111;line-height:1.6;"><strong style="font-size:1.8vw;">${toName}</strong><br><span style="font-size:1.2vw;color:#555;font-style:italic;">Or Current Resident</span><br>${toAddr.split(',').map(l=>l.trim()).join('<br>')}</div>
            <div style="font-size:1.0vw;color:#bbb;border-top:1px dashed #ddd;padding-top:3%;letter-spacing:2px;">DELIVERY POINT BARCODE</div>
          </div>
        </div>
      </div>
      <div style="text-align:center;margin-top:10px;color:rgba(255,255,255,.5);font-size:11px;">6×9 postcard back — actual print size. Click anywhere outside to close</div>
    </div>`;
  overlay.innerHTML = backInner;
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

// Preview the auto-generated postcard back side — now uses lightbox (matches front)
function previewPostcardBack(step){
  const est = (S.estimates||[]).find(e=>e.id===_dripEstId);
  const cfg = S.cfg || {};
  const toName   = (est && est.owner)   || 'Homeowner';
  const toAddr   = (est && est.addr)    || '123 Main St';
  const fromName = cfg.companyName      || 'Your Company';
  const fromAddr = cfg.companyAddress   || '1 Company Dr';
  const fromCity = cfg.companyCity      || '';
  const fromPhone= cfg.phone            || '';
  const logoUrl  = cfg.logoData         || '';
  previewPostcardBackLightbox(step, toName, toAddr, fromName, fromAddr, fromCity, fromPhone, logoUrl);
}

// ── Photo Lightbox (estimate admin view) ─────────────────────────────────────
function openEstPhotoLightbox(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  // Collect all photos from all categories
  const photos = [];
  // Front / house photos
  const allPhotos = est.all_photos || {};
  const cats = [
    { key:'home', label:'Front of Home' },
    { key:'damage', label:'Damage' },
    { key:'additional', label:'Additional' }
  ];
  cats.forEach(({key, label})=>{
    const arr = allPhotos[key] || [];
    arr.forEach((p,i)=>{
      const src = (typeof p === 'string') ? p : (p.data || p.url || '');
      if(src) photos.push({ src, label: label + (arr.length>1?' '+(i+1):'') });
    });
  });
  // Legacy single photo_url / photo_data
  if(!photos.length){
    const src = est.photo_data || est.photo_url || '';
    if(src) photos.push({ src, label:'Property Photo' });
  }
  // Damage photos (legacy separate field)
  if(est.damage_photos && Array.isArray(est.damage_photos)){
    est.damage_photos.forEach((p,i)=>{
      const src = (typeof p === 'string') ? p : (p.data || p.url || '');
      if(src && !photos.find(x=>x.src===src)) photos.push({ src, label:'Damage '+(i+1) });
    });
  }
  if(!photos.length){ toast('No photos for this estimate','info'); return; }
  const lb = document.getElementById('m-photo-lightbox');
  const titleEl = document.getElementById('plb-title');
  const imgEl = document.getElementById('plb-img');
  const stripEl = document.getElementById('plb-strip');
  if(!lb||!imgEl||!stripEl) return;
  titleEl.textContent = est.addr || 'Property Photos';
  // Show main image
  imgEl.src = photos[0].src;
  // Build thumbnail strip
  stripEl.innerHTML = photos.map((p,i)=>`
    <img src="${p.src}" title="${p.label}" onclick="document.getElementById('plb-img').src='${p.src}';document.getElementById('plb-title').textContent='${(est.addr||'').replace(/'/g,"'")} — ${p.label}';" style="width:72px;height:54px;object-fit:cover;border-radius:5px;cursor:pointer;border:2px solid ${i===0?'var(--accent)':'rgba(255,255,255,.2)'};transition:border-color .15s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='${i===0?'var(--accent)':'rgba(255,255,255,.2)'}'">
  `).join('');
  lb.style.display = 'flex';
}
function closePhotoLightbox(){
  const lb = document.getElementById('m-photo-lightbox');
  if(lb){ lb.style.display='none'; const img=document.getElementById('plb-img'); if(img) img.src=''; }
}
// Open the photo lightbox for a single branding image (logo, headshot, review)
function openBrandingLightbox(src, label){
  if(!src) return;
  const lb = document.getElementById('m-photo-lightbox');
  const titleEl = document.getElementById('plb-title');
  const imgEl = document.getElementById('plb-img');
  const stripEl = document.getElementById('plb-strip');
  if(!lb||!imgEl) return;
  titleEl.textContent = label || 'Image Preview';
  imgEl.src = src;
  if(stripEl) stripEl.innerHTML = '';
  lb.style.display = 'flex';
}
// Auto-unlock print for an estimate when a mailer is successfully sent (free reprint forever after)
function _unlockPrintForEstimate(estId){
  if(!estId) return;
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(est && !est.printPaid){
    est.printPaid = true;
    // Persist to Supabase silently
    if(sb) sb.from('estimates').update({print_paid:true}).eq('id',estId).then(({error})=>{
      if(error) console.warn('[BidDrop] print_paid unlock error:',error.message);
    });
  }
}

// Build the standard USPS-compliant postcard back side HTML
function buildPostcardBack({ toName, toAddr, fromName, fromAddr, fromCity, fromPhone, logoUrl }){
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:6in;height:4in;font-family:Arial,sans-serif;background:#fff;display:flex;overflow:hidden;}
  .left{width:3.5in;height:4in;border-right:1px solid #ccc;padding:0.25in;display:flex;flex-direction:column;justify-content:space-between;}
  .right{width:2.5in;height:4in;padding:0.25in;display:flex;flex-direction:column;justify-content:space-between;}
  .return-addr{font-size:8pt;color:#333;line-height:1.5;}
  .return-addr .co{font-weight:700;font-size:9pt;}
  .logo{max-width:1.2in;max-height:0.5in;object-fit:contain;margin-bottom:6px;}
  .indicia{border:1px solid #333;padding:4px 8px;text-align:center;font-size:7pt;color:#333;line-height:1.4;width:1.1in;align-self:flex-end;}
  .indicia strong{display:block;font-size:9pt;}
  .to-addr{font-size:10pt;line-height:1.6;color:#111;}
  .to-addr .name{font-weight:700;font-size:11pt;}
  .barcode-area{border-top:1px dashed #ccc;padding-top:6px;font-size:7pt;color:#aaa;text-align:center;letter-spacing:2px;}
  .divider{border:none;border-top:1px solid #e0e0e0;margin:6px 0;}
</style>
</head>
<body>
  <div class="left">
    <div>
      ${logoUrl ? '<img src="'+logoUrl+'" class="logo" alt="Logo">' : ''}
      <div class="return-addr">
        <div class="co">${fromName}</div>
        <div>${fromAddr}</div>
        <div>${fromCity}</div>
        ${fromPhone ? '<div>'+fromPhone+'</div>' : ''}
      </div>
    </div>
    <div class="barcode-area">|||||||||||||||||||||||||||||||||||||||</div>
  </div>
  <div class="right">
    <div class="indicia">
      <strong>PRSRT STD</strong>
      U.S. POSTAGE<br>PAID<br>PERMIT #000
    </div>
    <div class="to-addr">
      <div class="name">${toName}</div>
      <div style="font-size:8pt;color:#555;font-style:italic;margin-bottom:4px;">Or Current Resident</div>
      <hr class="divider">
      ${toAddr.split(',').map(l=>'<div>'+l.trim()+'</div>').join('')}
    </div>
    <div class="barcode-area" style="font-size:6pt;">DELIVERY POINT BARCODE</div>
  </div>
</body>
</html>`;
}


// Postcard Preview — uses same layout as the Estimator preview panel
async function previewEstimatePostcard(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }

  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  let photoUrl = est.photo_url || est.photo_data || null;
  if(!photoUrl && pin){
    const ap = pin.all_photos || {};
    const fp = (ap.front||[])[0] || null;
    if(fp) photoUrl = fp;
    if(!photoUrl) photoUrl = pin.photo_url || null;
  }
  if(!photoUrl){
    try{
      const MB = window._mapboxToken || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
      const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(est.addr)+'.json?country=us&types=address&limit=1&access_token='+MB);
      const geoData = await geoRes.json();
      if(geoData.features && geoData.features[0]){
        const [lon,lat] = geoData.features[0].center;
        photoUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;
      }
    } catch(e){ console.warn('[BidDrop] Geocode for postcard preview failed:',e); }
  }

  const syntheticItem = {
    id:         est.id || null,
    slug:       (S.cfg&&S.cfg.companyName?S.cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'roofing'),
    addr:       est.addr  || '',
    owner:      est.owner || 'Homeowner',
    total:      est.total || 0,
    finMo:      est.finMo || 0,
    photo_url:  (photoUrl && photoUrl.startsWith('http')) ? photoUrl : null,
    photo_data: (photoUrl && !photoUrl.startsWith('http')) ? photoUrl : null,
  };

  await _showPostcardCanvasModal('m-est-pc-modal', est.owner||'Homeowner', est.addr||'', syntheticItem);
}

// Preview the letter/mailer for a saved estimate (loads estimate data into estimator temporarily)
function previewEstimateLetter(estId){
  var est = (S.estimates||[]).find(function(e){ return e.id===estId; });
  if(!est){ toast('Estimate not found','error'); return; }
  var savedOwner = document.getElementById('e-owner').value;
  var savedAddr  = document.getElementById('e-addr').value;
  var savedPhoto = window._homePhotoData;
  var savedStructures = JSON.parse(JSON.stringify(structures));
  document.getElementById('e-owner').value = est.owner || '';
  document.getElementById('e-addr').value  = est.addr  || '';
  if(est.structures && est.structures.length){ structures = JSON.parse(JSON.stringify(est.structures)); }
  window._homePhotoData = est.photo_data || est.photo_url || null;
  calcP(); updatePreview();
  var mailerEl   = document.getElementById('mailer-preview');
  var mailerHtml = mailerEl ? mailerEl.innerHTML : '';
  document.getElementById('e-owner').value = savedOwner;
  document.getElementById('e-addr').value  = savedAddr;
  window._homePhotoData = savedPhoto;
  structures = savedStructures;
  calcP(); updatePreview();
  var existing = document.getElementById('m-letter-preview-modal');
  if(existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'm-letter-preview-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(5,10,20,0.95);display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:20px 16px 40px;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);';
  var ownerEsc = (est.owner||'Homeowner').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var addrEsc  = (est.addr||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var printBtn = '<button style="background:#1f3d68;border:1px solid #2E4060;color:#C8D8E8;font-size:13px;font-weight:700;padding:9px 16px;border-radius:8px;cursor:pointer;white-space:nowrap;" id="ltr-print-btn">&#128424; Print</button>';
  var closeBtn = '<button style="background:#1e2d42;border:1px solid #2E4060;color:#C8D8E8;font-size:13px;font-weight:700;padding:9px 20px;border-radius:8px;cursor:pointer;white-space:nowrap;" id="ltr-close-btn">&times; Close</button>';
  modal.innerHTML = '<div style="width:100%;max-width:760px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-shrink:0;"><div><div style="font-family:Oswald,sans-serif;font-size:18px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;">&#128065; Letter Preview</div><div style="font-size:12px;color:#6688A8;margin-top:2px;">' + ownerEsc + ' &mdash; ' + addrEsc + '</div></div><div style="display:flex;gap:8px;flex-shrink:0;">' + printBtn + closeBtn + '</div></div><div id="letter-preview-pages" style="width:100%;max-width:760px;display:flex;flex-direction:column;gap:24px;">' + mailerHtml + '</div>';
  document.body.appendChild(modal);
  modal.querySelector('#ltr-print-btn').addEventListener('click', function(){
    var qpc = document.getElementById('queue-preview-content');
    var pages = document.getElementById('letter-preview-pages');
    if(qpc && pages) qpc.innerHTML = pages.innerHTML;
    printQueuePreview();
  });
  modal.querySelector('#ltr-close-btn').addEventListener('click', function(){
    modal.remove();
  });
  modal.querySelector('#ltr-close-btn').addEventListener('mouseover', function(){
    this.style.background='#F25C05'; this.style.borderColor='#F25C05'; this.style.color='#fff';
  });
  modal.querySelector('#ltr-close-btn').addEventListener('mouseout', function(){
    this.style.background='#1e2d42'; this.style.borderColor='#2E4060'; this.style.color='#C8D8E8';
  });
  setTimeout(function(){
    var container = modal.querySelector('#letter-preview-pages');
    if(!container) return;
    var pages = container.querySelectorAll('.ml-page');
    var containerW = container.offsetWidth;
    var pageNativeW = 720;
    var scale = Math.min(1, containerW / pageNativeW);
    pages.forEach(function(page){
      page.style.transformOrigin = 'top left';
      page.style.transform = 'scale(' + scale + ')';
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:' + Math.round(pageNativeW * scale) + 'px;height:' + Math.round(page.offsetHeight * scale) + 'px;overflow:hidden;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5);';
      page.parentNode.insertBefore(wrapper, page);
      wrapper.appendChild(page);
    });
  }, 60);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  function _ltrEsc(e){ if(e.key==='Escape'){ modal.remove(); document.removeEventListener('keydown',_ltrEsc); } }
  document.addEventListener('keydown', _ltrEsc);
}

// LEGACY: old drip-sequence preview (Steps 2/3/4) kept for reference
function showEstimatePostcards(estId){
  const est = (S.estimates||[]).find(e=>e.id===estId);
  if(!est){ toast('Estimate not found','error'); return; }
  const cfg = S.cfg || {};
  const steps = [
    { num:2, label:'Step 2 — Day 7', name:'Follow-Up Postcard' },
    { num:3, label:'Step 3 — Day 14', name:'Urgency Postcard' },
    { num:4, label:'Step 4 — Day 28', name:'Final Postcard' }
  ];
  // Remove any existing modal
  const existing = document.getElementById('m-est-postcards');
  if(existing) existing.remove();

  const toName   = est.owner   || 'Homeowner';
  const toAddr   = est.addr    || '123 Main St';
  const fromName = cfg.companyName    || 'Your Company';
  const fromAddr = cfg.companyAddress || '1 Company Dr';
  const fromCity = cfg.companyCity    || '';
  const fromPhone= cfg.phone          || '';
  const logoUrl  = cfg.logoData       || '';

  const pin = (S.pins||[]).find(p=>p.id===est.pinId);
  const photoUrl = est.photo_url || (pin && pin.photo_url) || est.photo_data || null;
  const cards = steps.map(s=>{
    const msg = getDripStepMessage(s.num);
    const _dripFrontHtml = buildDripPostcardFrontHtml({
      photoUrl, headline: msg.headline, subtext: msg.subtext,
      companyName: fromName, companyAddress: fromAddr, phone: fromPhone,
      logoUrl, repHeadshot: cfg.repHeadshot||'', repName: cfg.repName||'',
      total: est.total||0, finMo: est.finMo||0
    });
    const frontHtml = `<div style="margin-bottom:8px;">
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin-bottom:4px;">&#9650; FRONT</div>
      <div style="position:relative;width:100%;padding-top:66.67%;overflow:hidden;border-radius:6px;cursor:zoom-in;" onclick="previewDripFrontFromEstimate(${s.num},'${estId}')" title="Click to enlarge — 6x9 Postcard">
        <iframe srcdoc="${_dripFrontHtml.replace(/"/g,'&quot;').replace(/\`/g,'&#96;')}"
          style="position:absolute;top:0;left:0;width:864px;height:576px;border:none;transform-origin:top left;pointer-events:none;"
          scrolling="no" id="drip-est-iframe-${s.num}"></iframe>
      </div>
      <div style="text-align:center;font-size:9px;color:#6B7280;margin-top:2px;">Click front to enlarge</div>
    </div>`;

    const _tn = toName.replace(/'/g,"\\'"); const _ta = toAddr.replace(/'/g,"\\'");
    const _fn = fromName.replace(/'/g,"\\'"); const _fa = fromAddr.replace(/'/g,"\\'");
    const _fc = fromCity.replace(/'/g,"\\'"); const _fp = fromPhone.replace(/'/g,"\\'");
    const _lu = logoUrl.replace(/'/g,"\\'");

    return `<div style="background:#111827;border:1px solid #374151;border-radius:10px;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="background:#7C3AED;color:#fff;border-radius:6px;padding:3px 10px;font-size:11px;font-weight:700;">${s.label}</span>
        <span style="color:#9CA3AF;font-size:11px;">${s.name}</span>
      </div>
      ${frontHtml}
      <div style="font-size:10px;font-weight:700;color:#9CA3AF;letter-spacing:1px;margin-bottom:4px;">▼ BACK (AUTO-GENERATED)</div>
      <div style="background:#fff;border-radius:6px;padding:10px;display:flex;gap:8px;font-family:Arial,sans-serif;min-height:90px;cursor:zoom-in;" onclick="previewPostcardBackLightbox(${s.num},'${_tn}','${_ta}','${_fn}','${_fa}','${_fc}','${_fp}','${_lu}')" title="Click to enlarge">
        <div style="flex:1.4;border-right:1px solid #ccc;padding-right:8px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>${logoUrl?'<img src="'+logoUrl+'" style="max-height:28px;max-width:80px;object-fit:contain;margin-bottom:4px;">':''}<div style="font-size:8px;color:#333;line-height:1.5;"><strong>${fromName}</strong><br>${fromAddr}${fromCity?'<br>'+fromCity:''}</div></div>
          <div style="font-size:6px;color:#bbb;border-top:1px dashed #ddd;padding-top:3px;letter-spacing:1px;">|||||||||||||||||||||||||||||</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">
          <div style="border:1px solid #333;padding:3px 5px;font-size:6px;color:#333;text-align:center;align-self:flex-end;"><strong style="font-size:7px;">PRSRT STD</strong><br>U.S. POSTAGE<br>PAID<br>PERMIT #000</div>
          <div style="font-size:8px;color:#111;line-height:1.5;"><strong>${toName}</strong><br>${toAddr.split(',').slice(0,2).join(', ')}</div>
          <div style="font-size:5px;color:#bbb;border-top:1px dashed #ddd;padding-top:3px;letter-spacing:1px;">DELIVERY POINT BARCODE</div>
        </div>
      </div>
      <div style="margin-top:4px;text-align:center;font-size:9px;color:#6B7280;">Click back to enlarge</div>
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'm-est-postcards';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `<div style="background:#0d1117;border:1px solid #374151;border-radius:14px;width:100%;max-width:900px;max-height:90vh;overflow-y:auto;padding:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <h2 style="color:#fff;font-size:16px;margin:0;">&#128247; Drip Postcard Preview</h2>
        <div style="color:#9CA3AF;font-size:12px;margin-top:2px;">${escHtml(toName)} — ${escHtml(toAddr)}</div>
      </div>
      <button onclick="document.getElementById('m-est-postcards').remove()" style="background:none;border:none;color:#9CA3AF;font-size:20px;cursor:pointer;">&#10005;</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">${cards}</div>
  </div>`;
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
  requestAnimationFrame(()=>{
    [2,3,4,5,6].forEach(n=>{
      const iframe = document.getElementById('drip-est-iframe-'+n);
      if(!iframe) return;
      const container = iframe.parentElement;
      if(!container) return;
      const w = container.offsetWidth;
      if(w>0) iframe.style.transform = 'scale('+(w/864)+')';
    });
  });
}

function handleHomePhoto(inp){
  if(!inp.files||!inp.files[0])return;
  const file = inp.files[0];
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const pinSuffix = currentEstPinId || ('tmp-'+Date.now());
  const path = acctId + '/pins/' + pinSuffix + '/home.jpg';
  toast('Uploading home photo…','info');
  uploadToStorage(file, path, 800, 0.82, 'image/jpeg').then(url=>{
    const data = url || null;
    if(data){
      window._homePhotoData = data;
      try{ sessionStorage.setItem('bd_home_photo_'+(currentEstPinId||'_'), data); }catch(e){}
      const prev=document.getElementById('home-photo-preview');
      if(prev)prev.innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover;">';
      const clr=document.getElementById('clear-photo-btn');
      if(clr)clr.style.display='block';
      updatePreview();
      if(window._previewMode==='postcard') _refreshPostcardPreview();
      _persistHomePhotoToSupabase();
      toast('📷 Photo added to mailer!','success');
    } else {
      // Fallback to base64
      const r2 = new FileReader();
      r2.onload = ev=>{
        const img=new Image();
        img.onload=()=>{
          const canvas=document.createElement('canvas');
          const MAX=800; let w=img.width,h=img.height;
          if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
          canvas.width=w;canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          const b64=canvas.toDataURL('image/jpeg',.82);
          window._homePhotoData=b64;
          try{ sessionStorage.setItem('bd_home_photo_'+(currentEstPinId||'_'), b64); }catch(e){}
          const prev=document.getElementById('home-photo-preview');
          if(prev)prev.innerHTML='<img src="'+b64+'" style="width:100%;height:100%;object-fit:cover;">';
          const clr=document.getElementById('clear-photo-btn');
          if(clr)clr.style.display='block';
          updatePreview();
          if(window._previewMode==='postcard') _refreshPostcardPreview();
          _persistHomePhotoToSupabase();
          toast('📷 Photo added (local)','info');
        };
        img.src=ev.target.result;
      };
      r2.readAsDataURL(file);
    }
  });
}

function clearHomePhoto(){
  window._homePhotoData=null;
  try{ if(currentEstPinId) sessionStorage.removeItem('bd_home_photo_'+currentEstPinId); sessionStorage.removeItem('bd_home_photo__'); }catch(e){}
  const prev=document.getElementById('home-photo-preview');
  if(prev)prev.innerHTML='No photo';
  const clr=document.getElementById('clear-photo-btn');
  if(clr)clr.style.display='none';
  updatePreview();
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED PHOTO SYSTEM
// _allPhotos = { front:[], damage:[], angles:[], other:[] }  (max 3 each)
// The first 'front' photo drives the mailer; falls back to satellite if empty.
// ═══════════════════════════════════════════════════════════════════════════
window._allPhotos = { front:[], damage:[], angles:[], buildings:[], other:[] };
const PHOTO_CATS = [
  { key:'front',     icon:'🏠', label:'Front of Home',          hint:'Straight-on shot of the front of the house — appears on the mailer' },
  { key:'damage',    icon:'🔍', label:'Roof Damage',             hint:'Close-ups of missing shingles, hail hits, granule loss, moss, etc.' },
  { key:'angles',    icon:'📐', label:'Additional Angles',       hint:'Side views, back of house, garage, detached structures' },
  { key:'buildings', icon:'🏗', label:'Additional Buildings',    hint:'Detached garage, shed, barn, or other structures on the property' },
  { key:'other',     icon:'📎', label:'Something Else',          hint:'Gutters, fascia, notes, or anything that does not fit above' },
];

function _syncLegacyFromAllPhotos(){
  // Keep legacy _homePhotoData and _damagePhotos in sync so existing mailer code still works
  const front = window._allPhotos.front || [];
  window._homePhotoData = front[0] || null;
  // damage = all non-front photos flattened
  const dmg = [
    ...(window._allPhotos.damage||[]),
    ...(window._allPhotos.angles||[]),
    ...(window._allPhotos.other||[])
  ];
  window._damagePhotos = dmg;
  // Update home photo preview in estimator if visible
  const prev = document.getElementById('home-photo-preview');
  if(prev){
    if(window._homePhotoData){
      prev.innerHTML = '<img src="'+window._homePhotoData+'" style="width:100%;height:100%;object-fit:cover;">';
    } else {
      prev.innerHTML = 'No photo';
    }
  }
  const clr = document.getElementById('clear-photo-btn');
  if(clr) clr.style.display = window._homePhotoData ? 'block' : 'none';
  // Refresh the estimator photo strip thumbnail
  _refreshEstimatorPhotoStrip();
}

function _refreshEstimatorPhotoStrip(){
  const strip = document.getElementById('est-photo-strip');
  if(!strip) return;
  const all = [
    ...(window._allPhotos.front||[]),
    ...(window._allPhotos.damage||[]),
    ...(window._allPhotos.angles||[]),
    ...(window._allPhotos.other||[])
  ];
  if(!all.length){ strip.innerHTML='<span style="color:var(--muted);font-size:12px;">No photos yet</span>'; return; }
  strip.innerHTML = all.map((src,i)=>'<img src="'+src+'" onclick="openPhotoModal()" title="Click to manage photos" style="width:52px;height:52px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid '+(i===0?'var(--accent)':'var(--border)')+';" onerror="this.style.display=\'none\'">' ).join('');
}

function _refreshPinModalPhotoStrip(){
  const strip = document.getElementById('pin-modal-photo-strip');
  if(!strip) return;
  const all = [
    ...(window._allPhotos.front||[]),
    ...(window._allPhotos.damage||[]),
    ...(window._allPhotos.angles||[]),
    ...(window._allPhotos.other||[])
  ];
  if(!all.length){ strip.style.display='none'; return; }
  strip.style.display='flex';
  strip.innerHTML = all.map((src,i)=>
    '<img src="'+src+'" title="'+(i===0?'Front of Home — Mailer Photo':'Photo')+'" style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:2px solid '+(i===0?'var(--accent)':'var(--border)')+'" onerror="this.style.display=\'none\'">'
  ).join('');
  // Also update the Add Photos button label to show count
  const btn = strip.previousElementSibling;
  if(btn && btn.tagName==='BUTTON'){
    btn.innerHTML = '📷 Photos (' + all.length + ') — tap to manage';
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
  }
}

function _loadAllPhotosFromPin(pin){
  // Migrate legacy fields into _allPhotos on load
  const ap = { front:[], damage:[], angles:[], buildings:[], other:[] };
  // Prefer structured all_photos if stored
  if(pin && pin.all_photos && typeof pin.all_photos==='object'){
    ['front','damage','angles','buildings','other'].forEach(k=>{ ap[k] = Array.isArray(pin.all_photos[k]) ? [...pin.all_photos[k]] : []; });
  } else {
    // Migrate: photo_url/photo_data → front, damage_photos → damage
    const fp = pin && (pin.photo_url || pin.photo_data);
    if(fp) ap.front.push(fp);
    const dp = (pin && pin.damage_photos) || [];
    dp.forEach(p=>{ if(p && !ap.front.includes(p)) ap.damage.push(p); });
  }
  window._allPhotos = ap;
  _syncLegacyFromAllPhotos();
}

function _loadAllPhotosFromEst(est, pin){
  const ap = { front:[], damage:[], angles:[], buildings:[], other:[] };
  // Prefer pin.all_photos when it has more photos than est.all_photos
  // (Manage Photos saves to pin; estimate snapshot may be stale)
  const estAP  = (est && est.all_photos && typeof est.all_photos==='object') ? est.all_photos : null;
  const pinAP  = (pin && pin.all_photos && typeof pin.all_photos==='object') ? pin.all_photos : null;
  const estCnt = estAP ? ['front','damage','angles','buildings','other'].reduce((n,k)=>n+(Array.isArray(estAP[k])?estAP[k].length:0),0) : 0;
  const pinCnt = pinAP ? ['front','damage','angles','buildings','other'].reduce((n,k)=>n+(Array.isArray(pinAP[k])?pinAP[k].length:0),0) : 0;
  // Use whichever source has more photos (pin wins ties when both have same count > 0)
  const src = (pinCnt >= estCnt && pinCnt > 0) ? pinAP : (estAP || pinAP);
  if(src){
    ['front','damage','angles','buildings','other'].forEach(k=>{ ap[k] = Array.isArray(src[k]) ? [...src[k]] : []; });
  } else {
    // Migrate legacy
    const fp = (est && (est.photo_data || est.photo_url)) || (pin && (pin.photo_url || pin.photo_data));
    if(fp) ap.front.push(fp);
    const dp = (est && est.damage_photos) || (pin && pin.damage_photos) || [];
    dp.forEach(p=>{ if(p && !ap.front.includes(p)) ap.damage.push(p); });
  }
  window._allPhotos = ap;
  _syncLegacyFromAllPhotos();
}

function _clearAllPhotos(){
  window._allPhotos = { front:[], damage:[], angles:[], buildings:[], other:[] };
  _syncLegacyFromAllPhotos();
}
function _allPhotosCount(){
  const ap = window._allPhotos || {};
  return (ap.front||[]).length + (ap.damage||[]).length + (ap.angles||[]).length + (ap.buildings||[]).length + (ap.other||[]).length;
}

// Strip base64 data URLs from all_photos before saving to Supabase
// (base64 images can be 500KB+ each and exceed JSONB limits)
function _allPhotosForSupabase(ap){
  if(!ap) return null;
  const keys = ['front','damage','angles','buildings','other'];
  const out = {};
  let hasAny = false;
  keys.forEach(k=>{
    out[k] = (Array.isArray(ap[k]) ? ap[k] : []).filter(s=>s && s.startsWith('http'));
    if(out[k].length) hasAny = true;
  });
  return hasAny ? out : null;
}

function openPhotoModal(pinId){
  // If a pinId is passed (from map popup), store it so uploads attach to that pin
  if(pinId) window._photoModalPinId = pinId;
  else window._photoModalPinId = currentEstPinId || null;
  // Always reload photos from the authoritative source before rendering:
  // - If a real pin ID was passed, load from that pin (and its linked estimate)
  // - If called from estimator (no pinId or pinId='pin'), keep window._allPhotos as-is
  const realPinId = window._photoModalPinId;
  if(realPinId && realPinId !== 'pin'){
    const pin = S.pins && S.pins.find(p=>p.id===realPinId);
    if(pin){
      // Prefer the estimate's all_photos if it has more (may have been updated more recently)
      const linkedEst = (S.estimates||[]).find(e=>e.pinId===realPinId && !e.deletedAt && !e.isRevision);
      if(linkedEst && linkedEst.all_photos){
        _loadAllPhotosFromEst(linkedEst, pin);
      } else {
        _loadAllPhotosFromPin(pin);
      }
    }
  }
  renderPhotoModal();
  openM('m-photos');
}

function renderPhotoModal(){
  const body = document.getElementById('photo-modal-body');
  if(!body) return;
  body.innerHTML = PHOTO_CATS.map(cat=>{
    const photos = (window._allPhotos[cat.key] || []);
    const canAdd = photos.length < 3;
    const inputId = 'photo-inp-'+cat.key;
    const thumbs = photos.map((src,i)=>{
      return '<div style="position:relative;display:inline-block;">'
        +'<img src="'+src+'" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid '+(cat.key==='front'&&i===0?'var(--accent)':'var(--border)')+';" onerror="this.style.display=\'none\'">'
        +(cat.key==='front'&&i===0?'<div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:9px;font-weight:700;background:var(--accent);color:#fff;border-radius:0 0 6px 6px;padding:1px 0;">MAILER</div>':'')
        +'<button onclick="_removePhotoFromCat(\''+cat.key+'\','+i+')" style="position:absolute;top:-6px;right:-6px;background:#EF4444;border:none;border-radius:50%;width:18px;height:18px;color:#fff;font-size:11px;cursor:pointer;line-height:18px;text-align:center;padding:0;">&times;</button>'
        +'</div>';
    }).join('');
    return '<div style="margin-bottom:20px;padding:14px;background:var(--card);border:1px solid var(--border);border-radius:10px;">'
      +'<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;">'
      +'<div><div style="font-size:14px;font-weight:700;color:var(--text);">'+cat.icon+' '+cat.label+'</div>'
      +'<div style="font-size:11px;color:var(--muted);margin-top:2px;">'+cat.hint+'</div></div>'
      +'<span style="font-size:11px;color:var(--muted);white-space:nowrap;margin-left:8px;">'+photos.length+'/3</span>'
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      +thumbs
      +(canAdd
        ? '<button onclick="_openPhotoModalSheet(\''+cat.key+'\')" style="width:80px;height:80px;border:2px dashed var(--border);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);font-size:11px;text-align:center;gap:4px;background:none;"><span style="font-size:22px;">+</span><span>Add Photo</span></button>'
        : '')
      +'</div>'
      +'</div>';
  }).join('');
}

function _openPhotoModalSheet(catKey){
  showPhotoActionSheet(function(files){
    if(!files||!files[0]) return;
    _handlePhotoModalUpload({files: files}, catKey);
  }, {multiple: false});
}
function _removePhotoFromCat(catKey, idx){
  if(!window._allPhotos[catKey]) return;
  window._allPhotos[catKey].splice(idx, 1);
  _syncLegacyFromAllPhotos();
  _persistAllPhotos();
  renderPhotoModal();
  updatePreview();
  if(window._previewMode==='postcard') _refreshPostcardPreview();
}

function _handlePhotoModalUpload(inp, catKey){
  if(!inp.files||!inp.files[0]) return;
  const file = inp.files[0];
  const acctId = (currentAccount && currentAccount.id) || 'shared';
  const pinId = window._photoModalPinId || currentEstPinId || ('tmp-'+Date.now());
  const ts = Date.now();
  const path = acctId+'/pins/'+pinId+'/'+catKey+'_'+ts+'.jpg';
  toast('Uploading photo…','info');
  uploadToStorage(file, path, 900, 0.85, 'image/jpeg').then(url=>{
    const src = url || null;
    if(src){
      _addPhotoToCat(catKey, src);
      toast('📷 Photo saved!','success');
    } else {
      // Fallback: base64
      const r = new FileReader();
      r.onload = ev=>{
        const img = new Image();
        img.onload = ()=>{
          const canvas = document.createElement('canvas');
          const MAX=900; let w=img.width,h=img.height;
          if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
          canvas.width=w;canvas.height=h;
          canvas.getContext('2d').drawImage(img,0,0,w,h);
          const b64 = canvas.toDataURL('image/jpeg',.85);
          _addPhotoToCat(catKey, b64);
          toast('📷 Photo saved (local)','info');
        };
        img.src = ev.target.result;
      };
      r.readAsDataURL(file);
    }
  });
}

function _addPhotoToCat(catKey, src){
  if(!window._allPhotos[catKey]) window._allPhotos[catKey]=[];
  if(window._allPhotos[catKey].length >= 3){ toast('Max 3 photos per category','warn'); return; }
  window._allPhotos[catKey].push(src);
  _syncLegacyFromAllPhotos();
  _persistAllPhotos();
  renderPhotoModal();
  updatePreview();
  if(window._previewMode==='postcard') _refreshPostcardPreview();
}

function _persistAllPhotos(){
  // Save to the current pin in Supabase if we have one
  const pinId = window._photoModalPinId || currentEstPinId;
  if(!pinId || !sb) return;
  const pin = S.pins && S.pins.find(p=>p.id===pinId);
  if(pin){
    const newAllPhotos = JSON.parse(JSON.stringify(window._allPhotos));
    pin.all_photos = newAllPhotos;
    // Also keep legacy fields in sync
    const frontUrl = (newAllPhotos.front||[]).find(s=>s&&s.startsWith('http')) || null;
    pin.photo_url = frontUrl || pin.photo_url || null;
    pin.damage_photos = window._damagePhotos.length ? [...window._damagePhotos] : null;
    // Strip base64 before Supabase save (base64 can be 500KB+ and exceed JSONB limits)
    const apForSB = _allPhotosForSupabase(newAllPhotos);
    const dmgForSB = (pin.damage_photos||[]).filter(s=>s&&s.startsWith('http'));
    sb.from('pins').update({
      all_photos: apForSB,
      photo_url: pin.photo_url,
      damage_photos: dmgForSB.length ? dmgForSB : null,
      updated_at: new Date().toISOString()
    }).eq('id', pinId).then(({error})=>{
      if(error) console.warn('[BidDrop] _persistAllPhotos pin update:', error.message);
    });
    // ── CRITICAL FIX: also update the linked estimate record so Edit Estimate
    //    always sees the latest photos (not the stale snapshot saved when estimate was created)
    const linkedEst = (S.estimates||[]).find(e=>e.pinId===pinId && !e.deletedAt && !e.isRevision);
    if(linkedEst){
      linkedEst.all_photos = newAllPhotos;
      linkedEst.photo_url = pin.photo_url || linkedEst.photo_url;
      linkedEst.damage_photos = pin.damage_photos || linkedEst.damage_photos;
      // Also update pin.estimate JSONB snapshot
      if(pin.estimate) pin.estimate.all_photos = newAllPhotos;
      sb.from('estimates').update({
        all_photos: apForSB,
        photo_url: pin.photo_url || null,
        damage_photos: dmgForSB.length ? dmgForSB : null,
        updated_at: new Date().toISOString()
      }).eq('id', linkedEst.id).then(({error})=>{
        if(error) console.warn('[BidDrop] _persistAllPhotos est update:', error.message);
      });
    }
    save();
  }
}

// ── Auto-save helpers ────────────────────────────────────────────────────────

// Save the home photo (window._homePhotoData) to the current pin AND estimate in Supabase
function _persistHomePhotoToSupabase(){
  const pinId = currentEstPinId;
  if(!pinId || !sb || !window._homePhotoData) return;
  const pin = (S.pins||[]).find(p=>p.id===pinId);
  if(pin){
    pin.photo_url = window._homePhotoData.startsWith('http') ? window._homePhotoData : pin.photo_url;
    pin.photo_data = !window._homePhotoData.startsWith('http') ? window._homePhotoData : null;
    sb.from('pins').update({
      photo_url: pin.photo_url || null,
      updated_at: new Date().toISOString()
    }).eq('id', pinId).then(()=>{});
  }
  // Also update the estimate record if one exists
  const est = (S.estimates||[]).find(e=>e.pinId===pinId && !e.deletedAt && !e.isRevision);
  if(est){
    const photoUrl = window._homePhotoData.startsWith('http') ? window._homePhotoData : null;
    const photoData = !window._homePhotoData.startsWith('http') ? window._homePhotoData : null;
    est.photo_url = photoUrl || est.photo_url;
    est.photo_data = photoData || est.photo_data;
    sb.from('estimates').update({
      photo_url: est.photo_url || null,
      photo_data: est.photo_data || null,
      updated_at: new Date().toISOString()
    }).eq('id', est.id).then(()=>{});
  }
}

// Auto-save the current estimate form state to Supabase when leaving the estimator tab
function _autoSaveEstimateOnLeave(){
  if(!currentEstPinId || !sb || !currentAccount) return;
  try{
    const pin = (S.pins||[]).find(p=>p.id===currentEstPinId);
    if(!pin) return;
    // Skip autosave if the pin hasn't been persisted to Supabase yet.
    // New pins get a local temp ID like 'p1234567890' (digit-only suffix).
    // Supabase assigns a UUID (e.g. '550e8400-e29b-41d4-a716-446655440000').
    // Saving an estimate with a non-existent pin_id causes a FK constraint error.
    const isLocalTempId = /^p\d+$/.test(currentEstPinId);
    if(isLocalTempId) return;
    const owner = (document.getElementById('e-owner')||{}).value||'';
    const email = (document.getElementById('e-email')||{}).value||'';
    const addr  = (document.getElementById('e-addr')||{}).value||pin.address||'';
    const total = (structures||[]).reduce((sum,s)=>sum+(typeof calcStructPrice==='function'?calcStructPrice(s):0),0);
    const photoUrl  = window._homePhotoData && window._homePhotoData.startsWith('http') ? window._homePhotoData : null;
    const photoData = window._homePhotoData && !window._homePhotoData.startsWith('http') ? window._homePhotoData : null;
    const allPhotos = window._allPhotos ? JSON.parse(JSON.stringify(window._allPhotos)) : null;
    const dmgPhotos = (window._damagePhotos||[]).length ? [...window._damagePhotos] : null;
    const sky  = (document.getElementById('a-sky')||{}).checked||false;
    const skyQ = parseInt((document.getElementById('a-sky-q')||{}).value||1);
    const chim = (document.getElementById('a-chim')||{}).checked||false;
    const gut  = (document.getElementById('a-gut')||{}).checked||false;
    const gutQ = parseInt((document.getElementById('a-gut-q')||{}).value||120);
    const iws  = (document.getElementById('a-iws')||{}).checked||false;

    // Update in-memory pin
    pin.estimate = { owner, email, total, structures:(structures||[]).map(s=>({...s})) };
    pin.at_est = new Date().toISOString();
    if(photoUrl) pin.photo_url = photoUrl;
    if(allPhotos) pin.all_photos = allPhotos;
    if(dmgPhotos) pin.damage_photos = dmgPhotos;

    // Upsert to estimates table (create or update existing draft)
    const existing = (S.estimates||[]).find(e=>e.pinId===currentEstPinId && !e.deletedAt && !e.isRevision);
    const estId = (existing && existing.id) || window._editingEstimateId || ('e'+Date.now());
    const estRow = {
      id: estId,
      account_id: currentAccount.id,
      pin_id: currentEstPinId,
      addr, owner, email,
      rep: (currentProfile&&currentProfile.name)||'',
      total,
      structures: (structures||[]).map(s=>({...s})),
      photo_url: photoUrl||null,
      photo_data: photoData||null,
      all_photos: allPhotos||null,
      damage_photos: dmgPhotos||null,
      skylight: sky, skylight_qty: skyQ,
      chimney: chim, gutters: gut, gutter_lf: gutQ,
      ice_water_shield: iws,
      // solar columns removed — not in DB schema yet
      version: (existing&&existing.version)||1,
      is_revision: false,
      saved_at: new Date().toISOString(),
      deleted_at: null
    };
    sb.from('estimates').upsert(estRow, {onConflict:'id'}).then(({error})=>{
      if(error) console.warn('[AutoSave] estimate:', error.message);
      else{
        // Keep in-memory S.estimates in sync
        if(existing){
          Object.assign(existing, {
            addr, owner, email, total,
            structures: estRow.structures,
            photo_url: photoUrl||existing.photo_url,
            photo_data: photoData||existing.photo_data,
            all_photos: allPhotos||existing.all_photos,
            damage_photos: dmgPhotos||existing.damage_photos,
            skylight: sky, skylightQty: skyQ,
            chimney: chim, gutters: gut, gutterLf: gutQ,
            iceWaterShield: iws,
            solar: estRow.solar, solarKw: estRow.solar_kw, solarFlat: estRow.solar_flat, solarPrice: estRow.solar_price,
            savedAt: estRow.saved_at
          });
        } else {
          S.estimates.unshift({
            id: estId, pinId: currentEstPinId,
            addr, owner, email, total,
            structures: estRow.structures,
            photo_url: photoUrl||null, photo_data: photoData||null,
            all_photos: allPhotos||null, damage_photos: dmgPhotos||null,
            skylight: sky, skylightQty: skyQ,
            chimney: chim, gutters: gut, gutterLf: gutQ,
            iceWaterShield: iws,
            solar: estRow.solar, solarKw: estRow.solar_kw, solarFlat: estRow.solar_flat, solarPrice: estRow.solar_price,
            version: 1, isRevision: false,
            savedAt: estRow.saved_at
          });
          window._editingEstimateId = estId;
        }
      }
    });
    // Also keep pin.estimate in sync
    sb.from('pins').update({
      estimate: pin.estimate,
      photo_url: photoUrl||null,
      all_photos: allPhotos||null,
      damage_photos: dmgPhotos||null,
      updated_at: new Date().toISOString()
    }).eq('id', currentEstPinId).then(()=>{});
  }catch(e){ console.warn('[AutoSave] _autoSaveEstimateOnLeave error:', e); }
}

