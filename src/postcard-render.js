// BidDrop — Postcard canvas renderers and HTML builders (pure functions, no side effects)
// Depends on: state.js (S, PITCHLBL, MATLBL), ui.js (escHtml)

function loadImg(url){
  return new Promise(resolve=>{
    if(!url){resolve(null);return;}
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=url;
  });
}
// Helper: draw rounded rectangle
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
// Helper: wrap text to fit width, returns array of lines
function wrapText(ctx,text,maxWidth){
  const words=text.split(' ');const lines=[];
  let line='';
  for(const w of words){
    const test=line?line+' '+w:w;
    if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w;}
    else line=test;
  }
  if(line)lines.push(line);
  return lines;
}

// ═══════════════════════════════════════════════════════════
// POSTCARD DESIGNER — Live Preview
// ═══════════════════════════════════════════════════════════
async function pcPreviewRefresh(){
  // Build a temporary cfg from current form values without saving
  const v=id=>{ const el=document.getElementById(id); return el?(el.value||''):''; };
  const tmpCfg=Object.assign({},S.cfg||{},{
    postcardDesign:(document.querySelector('input[name="pc-design"]:checked')||{value:'1'}).value,
    postcardHeadline1:v('s-pc-headline1')||'It might be time for a new roof.',
    postcardHeadline2:v('s-pc-headline2')||'But don\'t worry, we can help!',
    postcardBadgeText:v('s-pc-badge-text')||'',
    postcardBadgeColor:v('s-pc-badge-color')||S.cfg?.brandColor||'#F25C05',
    postcardBackBadgeText:v('s-pc-back-badge-text')||'',
    postcardBackBadgeColor:v('s-pc-back-badge-color')||S.cfg?.brandColor||'#F25C05',
    postcardHook:v('s-pc-hook'),
    postcardWhy:v('s-pc-why'),
    postcardQuote:v('s-pc-quote'),
    postcardGuarantee:v('s-pc-guarantee'),
    postcardScanCta:v('s-pc-scan-cta')||'SCAN TO BOOK',
    postcardScanSub:v('s-pc-scan-sub')||'No-pressure booking',
    postcardPhotoLayout:(document.querySelector('input[name="pc-photo-layout"]:checked')||{value:'single'}).value,
    postcardShowPrice:!!(document.getElementById('s-pc-show-price')&&document.getElementById('s-pc-show-price').checked),
    postcardShowMonthly:!!(document.getElementById('s-pc-show-monthly')&&document.getElementById('s-pc-show-monthly').checked),
    postcardShowPhone:!!(document.getElementById('s-pc-show-phone')&&document.getElementById('s-pc-show-phone').checked),
    postcardShowPriceBack:!!(document.getElementById('s-pc-show-price-back')&&document.getElementById('s-pc-show-price-back').checked),
    postcardHl1Size:parseInt(v('s-pc-hl1-sz'))||160,
    postcardHl2Size:parseInt(v('s-pc-hl2-sz'))||160,
    postcardHookSize:parseInt(v('s-pc-hook-sz'))||36,
    postcardWhySize:parseInt(v('s-pc-why-sz'))||30,
    postcardQuoteSize:parseInt(v('s-pc-quote-sz'))||32,
    postcardGuarSize:parseInt(v('s-pc-guar-sz'))||26,
    postcardPhoneSize:parseInt(v('s-pc-phone-sz'))||42,
    postcardAddrSize:parseInt(v('s-pc-addr-sz'))||62,
    postcardPriceSize:parseInt(v('s-pc-price-sz'))||78,
  });
  // Build a sample item for preview
  const sampleItem={
    addr:(S.cfg?.companyName?S.cfg.companyName+' Sample Address':'123 Sample Street, Your City, MI 48000'),
    total:8500,
    id:null,
    photo_url:null,
    all_photos:[],
  };
  // Temporarily swap cfg
  const origCfg=S.cfg;
  S.cfg=tmpCfg;
  const spinner=document.getElementById('pc-preview-spinner');
  if(spinner) spinner.style.display='block';
  try{
    const frontDataUrl = await renderFrontCanvasForDesign(sampleItem, tmpCfg.postcardDesign||'1');
    const backDataUrl=await renderPostcard6x9BackCanvas(sampleItem);
    // Render into preview canvases
    function renderToCanvas(canvasId,dataUrl){
      const canvas=document.getElementById(canvasId);
      if(!canvas||!dataUrl)return;
      const img=new Image();
      img.onload=()=>{
        canvas.width=img.width;canvas.height=img.height;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0);
      };
      img.src=dataUrl;
    }
    renderToCanvas('pc-preview-front',frontDataUrl);
    renderToCanvas('pc-preview-back',backDataUrl);
    toast('Preview updated!');
  } catch(err){
    console.error('pcPreviewRefresh error',err);
    toast('Preview error: '+err.message,'error');
  } finally {
    S.cfg=origCfg;
    if(spinner) spinner.style.display='none';
  }
}
async function renderPostcard6x9FrontCanvas(item){
  const cfg=S.cfg||{};
  // Lob 6x9 postcard: 2775x1875px portrait at 300dpi (9.25"x6.25" bleed)
  const W=2775,H=1875;
  const PAD=94; // safe zone ~0.31" (slightly more than 1/4")
  const color=cfg.brandColor||'#F25C05';
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||'(000) 000-0000';
  const total=item.total||0;
  const addr=item.addr||'';
  const shortAddr=addr.split(',')[0]||addr;
  const cityState=addr.split(',').slice(1,3).join(',').trim();
  const addrLine=shortAddr+(cityState?', '+cityState:'');
  const finEnabled=cfg.financingEnabled!==false;
  const finApr=parseFloat(cfg.financingApr)||9.99;
  const finTerm=parseInt(cfg.financingTerm)||60;
  const finDown=parseFloat(cfg.financingDown)||0;
  let finMo=0;
  if(finEnabled&&total){const loan=total*(1-finDown/100);const r=finApr/100/12;finMo=r===0?Math.round(loan/finTerm):Math.round(loan*r*Math.pow(1+r,finTerm)/(Math.pow(1+r,finTerm)-1));}
  const housePhotoUrl=item.photo_url||(item.photo_data&&item.photo_data.startsWith('http')?item.photo_data:null);
  const logoUrl=(cfg.logoData&&cfg.logoData.startsWith('http'))?cfg.logoData:null;
  // New designer config fields
  const hl1Txt=cfg.postcardHeadline1||'It might be time for a new roof.';
  const hl2Txt=cfg.postcardHeadline2||'But don\'t worry, we can help!';
  const badgeTxtCfg=cfg.postcardBadgeText||'';
  const badgeColorCfg=cfg.postcardBadgeColor||color;
  const hl1Size=cfg.postcardHl1Size||160;
  const hl2Size=cfg.postcardHl2Size||160;
  const addrSize=cfg.postcardAddrSize||62;
  const priceSize=cfg.postcardPriceSize||78;
  const showPrice=cfg.postcardShowPrice!==false;
  const showMonthly=cfg.postcardShowMonthly!==false;
  const showPhone=cfg.postcardShowPhone!==false;
  const photoLayout=cfg.postcardPhotoLayout||'single';
  // Load extra photos for multi-photo layouts
  const extraPhoto1Url=item.all_photos&&item.all_photos[0]?item.all_photos[0]:null;
  const extraPhoto2Url=item.all_photos&&item.all_photos[1]?item.all_photos[1]:null;
  const [houseImg,logoImg,extraImg1,extraImg2]=await Promise.all([loadImg(housePhotoUrl),loadImg(logoUrl),loadImg(extraPhoto1Url),loadImg(extraPhoto2Url)]);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  // ── Background: photo layout ──────────────────────────────────────────────
  function drawCover(img,x,y,w,h){
    if(!img){ctx.fillStyle='#1a2333';ctx.fillRect(x,y,w,h);return;}
    const scale=Math.max(w/img.width,h/img.height);
    const sw=img.width*scale,sh=img.height*scale;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    ctx.drawImage(img,x+(w-sw)/2,y+(h-sh)/2,sw,sh);
    ctx.restore();
  }
  if(photoLayout==='split2'){
    const halfW=Math.round(W/2);
    drawCover(houseImg,0,0,halfW,H);
    drawCover(extraImg1||houseImg,halfW,0,W-halfW,H);
    // Thin divider
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(halfW-2,0,4,H);
  } else if(photoLayout==='grid3'){
    const topH=Math.round(H*0.6);
    const botH=H-topH;
    const halfW=Math.round(W/2);
    drawCover(houseImg,0,0,W,topH);
    drawCover(extraImg1||houseImg,0,topH,halfW,botH);
    drawCover(extraImg2||extraImg1||houseImg,halfW,topH,W-halfW,botH);
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,topH-2,W,4);
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(halfW-2,topH,4,botH);
  } else {
    drawCover(houseImg,0,0,W,H);
  }
  // Gradient overlay — kept light so the house photo stays bright and vivid
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(0,0,0,0.10)');
  grad.addColorStop(0.4,'rgba(0,0,0,0.05)');
  grad.addColorStop(0.72,'rgba(0,0,0,0.35)');
  grad.addColorStop(1,'rgba(0,0,0,0.60)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  // TOP ROW: logo/company name (left) + badge pill (right)
  const topY=PAD+8;
  if(logoImg){
    const lh=Math.min(110,logoImg.height);const lw=Math.round(logoImg.width*(lh/logoImg.height));
    ctx.drawImage(logoImg,PAD,topY,lw,lh);
  } else {
    ctx.fillStyle='#fff';ctx.font='bold 70px Arial';
    ctx.fillText(co,PAD,topY+70);
  }
  // Badge pill (only render if text is set)
  if(badgeTxtCfg){
    ctx.font='bold 42px Arial';
    const btw=ctx.measureText(badgeTxtCfg).width;
    const bx=W-PAD-btw-56,by=topY,bw=btw+56,bh=72,br=36;
    ctx.fillStyle=badgeColorCfg;
    roundRect(ctx,bx,by,bw,bh,br);ctx.fill();
    ctx.fillStyle='#fff';ctx.textBaseline='middle';
    ctx.fillText(badgeTxtCfg,bx+28,by+bh/2);
    ctx.textBaseline='alphabetic';
  }
  // HEADLINE (bottom-left area) — truncate with ellipsis if too wide
  function fitText(ctx,text,maxW){
    if(!text) return '';
    if(ctx.measureText(text).width<=maxW) return text;
    let t=text;
    while(t.length>0&&ctx.measureText(t+'…').width>maxW) t=t.slice(0,-1);
    return t+'…';
  }
  const maxTxtW=W-PAD*2-40;
  ctx.fillStyle='#fff';
  ctx.font='bold '+hl1Size+'px Arial';
  const hl1Y=H-(showPrice?530:420);
  ctx.fillText(fitText(ctx,hl1Txt,maxTxtW),PAD,hl1Y);
  ctx.font='bold '+hl2Size+'px Arial';
  ctx.fillText(fitText(ctx,hl2Txt,maxTxtW),PAD,hl1Y+hl2Size+20);
  // Address line
  ctx.font='bold '+addrSize+'px Arial';ctx.fillStyle='rgba(255,255,255,0.92)';
  ctx.fillText('\u{1F4CD} '+addrLine,PAD,H-(showPrice?268:180));
  // Phone (optional)
  if(showPhone){
    ctx.fillStyle='rgba(255,255,255,0.85)';ctx.font='bold 52px Arial';
    ctx.fillText('\u{1F4DE} '+ph,PAD,H-(showPrice?196:110));
  }
  // Price pill (optional)
  if(showPrice){
    const showMo=showMonthly&&finEnabled&&finMo>0;
    const priceBoxW=showMo?820:420,priceBoxH=140,priceBoxY=H-PAD-priceBoxH;
    ctx.fillStyle=color;
    roundRect(ctx,PAD,priceBoxY,priceBoxW,priceBoxH,18);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.8)';ctx.font='32px Arial';
    ctx.fillText('ESTIMATED TOTAL',PAD+28,priceBoxY+38);
    ctx.fillStyle='#fff';ctx.font='bold '+priceSize+'px Arial';
    ctx.fillText('$'+total.toLocaleString(),PAD+28,priceBoxY+priceSize+40);
    if(showMo){
      ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillRect(PAD+410,priceBoxY+18,3,104);
      ctx.fillStyle='rgba(255,255,255,0.8)';ctx.font='32px Arial';
      ctx.fillText('AS LOW AS',PAD+438,priceBoxY+38);
      ctx.fillStyle='#fff';ctx.font='bold '+priceSize+'px Arial';
      ctx.fillText('$'+finMo.toLocaleString()+'/mo',PAD+438,priceBoxY+priceSize+40);
    }
  }
  return canvas.toDataURL('image/jpeg',0.92);
}

// ── DESIGN 2: Neighborhood Bold ──────────────────────────────────────────────
// Left panel: dark navy + bold headline | Right panel: house photo | Bottom bar: brand color
async function renderPostcard6x9FrontCanvasD2(item){
  // ── Design 2: "Neighborhood Bold" — matches reference layout exactly ──────
  // Full-bleed house photo bg | Left dark-navy panel | Yellow accent | Bullet services
  // Bottom bar: white left (logo+name) | red right (CTA+phone+website)
  const cfg=S.cfg||{};
  const W=2775,H=1875;
  const PAD=110;
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||'(000) 000-0000';
  const site=(cfg.companyWebsite||cfg.website||'').replace(/^https?:\/\//,'');
  const housePhotoUrl=item.photo_url||(item.photo_data&&item.photo_data.startsWith('http')?item.photo_data:null);
  const logoUrl=(cfg.logoData&&cfg.logoData.startsWith('http'))?cfg.logoData:null;
  const [houseImg,logoImg]=await Promise.all([loadImg(housePhotoUrl),loadImg(logoUrl)]);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');

  const BOTTOM_BAR_H=310;
  const MAIN_H=H-BOTTOM_BAR_H;
  const LEFT_W=Math.round(W*0.46);

  // ── FULL-BLEED HOUSE PHOTO (entire card background) ───────────────────────
  if(houseImg){
    const scale=Math.max(W/houseImg.width,H/houseImg.height);
    const sw=houseImg.width*scale,sh=houseImg.height*scale;
    ctx.drawImage(houseImg,(W-sw)/2,(H-sh)/2,sw,sh);
  } else {
    ctx.fillStyle='#2a4a6a';
    ctx.fillRect(0,0,W,H);
  }

  // ── LEFT PANEL: dark navy overlay ────────────────────────────────────────
  // Solid navy for left portion, fading to transparent on right edge
  const navyGrad=ctx.createLinearGradient(0,0,LEFT_W+200,0);
  navyGrad.addColorStop(0,'rgba(15,30,60,0.97)');
  navyGrad.addColorStop(LEFT_W/(LEFT_W+200),'rgba(15,30,60,0.97)');
  navyGrad.addColorStop(1,'rgba(15,30,60,0)');
  ctx.fillStyle=navyGrad;
  ctx.fillRect(0,0,LEFT_W+200,MAIN_H);

  // ── TOP LINE: small white text ────────────────────────────────────────────
  const topLine = cfg.postcardD2TopLine || 'PROTECT YOUR HOME WITH';
  ctx.fillStyle='#ffffff';
  ctx.font='bold 88px Arial';
  ctx.textBaseline='alphabetic';
  ctx.fillText(topLine, PAD, PAD+80);

  // ── ACCENT LINE: large yellow italic bold ─────────────────────────────────
  const accentLine = cfg.postcardD2Accent || 'AFFORDABLE';
  ctx.fillStyle='#FFD700';
  ctx.font='italic bold 200px Arial';
  ctx.fillText(accentLine, PAD, PAD+80+220);

  // ── HEADLINE LINES: very large white bold ─────────────────────────────────
  const hl1 = (cfg.postcardD2Headline||'ROOFING').toUpperCase();
  const hl2 = (cfg.postcardD2Headline2||'SOLUTIONS!').toUpperCase();
  ctx.fillStyle='#ffffff';
  ctx.font='bold 260px Arial';
  ctx.fillText(hl1, PAD, PAD+80+220+280);
  ctx.fillText(hl2, PAD, PAD+80+220+280+290);

  // ── BULLET LIST ───────────────────────────────────────────────────────────
  const bullets=[
    cfg.postcardD2Bullet1||'ROOFING',
    cfg.postcardD2Bullet2||'SIDING',
    cfg.postcardD2Bullet3||'GUTTERS'
  ].filter(Boolean);
  ctx.fillStyle='#ffffff';
  ctx.font='bold 110px Arial';
  let bY = PAD+80+220+280+290+130;
  bullets.forEach(b=>{
    ctx.fillText('\u2022  '+b, PAD, bY);
    bY+=130;
  });

  // ── STARBURST BADGE (top-right corner) ───────────────────────────────────
  const badge1 = cfg.postcardD2Badge1||'FREE';
  const badge2 = cfg.postcardD2Badge2||'GUTTERS';
  const badgeSub = cfg.postcardD2BadgeSub||'With this card. Offer expires\n30 days from mail date.';
  if(badge1||badge2){
    const bCX=W-340, bCY=300, bR=280;
    // Draw starburst
    ctx.save();
    ctx.translate(bCX,bCY);
    ctx.fillStyle='#FFD700';
    ctx.beginPath();
    const pts=16;
    for(let i=0;i<pts*2;i++){
      const angle=(Math.PI/pts)*i - Math.PI/2;
      const r=i%2===0?bR:bR*0.78;
      const x=Math.cos(angle)*r, y=Math.sin(angle)*r;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.closePath();
    ctx.fill();
    // Badge text
    ctx.fillStyle='#1a1a1a';
    ctx.font='bold 130px Arial';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(badge1,0,-60);
    ctx.font='bold 110px Arial';
    ctx.fillText(badge2,0,60);
    // Fine print
    if(badgeSub){
      ctx.font='42px Arial';
      ctx.fillStyle='#333';
      const subLines=badgeSub.split('\n');
      subLines.forEach((sl,si)=>ctx.fillText(sl,0,170+si*50));
    }
    ctx.textAlign='left';
    ctx.textBaseline='alphabetic';
    ctx.restore();
  }

  // ── BOTTOM BAR ────────────────────────────────────────────────────────────
  const BAR_SPLIT=Math.round(W*0.36);
  // White left section
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,MAIN_H,BAR_SPLIT,BOTTOM_BAR_H);
  // Red right section (use brand color or fallback red)
  const barColor=cfg.postcardD2BarColor||'#CC1111';
  ctx.fillStyle=barColor;
  ctx.fillRect(BAR_SPLIT,MAIN_H,W-BAR_SPLIT,BOTTOM_BAR_H);

  // Logo + company name in white section
  const logoMaxH=180, logoMaxW=BAR_SPLIT-PAD*2;
  if(logoImg){
    const lh=Math.min(logoMaxH,logoImg.height);
    const lw=Math.min(logoMaxW,Math.round(logoImg.width*(lh/logoImg.height)));
    const lx=PAD;
    const ly=MAIN_H+(BOTTOM_BAR_H-lh)/2;
    ctx.drawImage(logoImg,lx,ly,lw,lh);
  } else {
    ctx.fillStyle='#1a2a4a';
    ctx.font='bold 90px Arial';
    ctx.textBaseline='middle';
    ctx.fillText(co,PAD,MAIN_H+BOTTOM_BAR_H/2);
    ctx.textBaseline='alphabetic';
  }

  // CTA + phone + website in red section
  const cta = cfg.postcardD2Cta||'SCHEDULE A FREE ESTIMATE TODAY!';
  const ctaX = BAR_SPLIT + 80;
  const ctaW = W - BAR_SPLIT - 80;
  ctx.fillStyle='#ffffff';
  ctx.font='bold 68px Arial';
  ctx.textBaseline='alphabetic';
  ctx.fillText(cta, ctaX, MAIN_H+90);
  ctx.font='bold 160px Arial';
  ctx.fillText(ph, ctaX, MAIN_H+260);
  if(site){
    ctx.font='70px Arial';
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.fillText(site, ctaX, MAIN_H+BOTTOM_BAR_H-20);
  }
  ctx.textBaseline='alphabetic';

  return canvas.toDataURL('image/jpeg',0.92);
}

async function renderPostcard6x9BackCanvas(item){
  // ── New canvas designer path (Build 13) ──
  // If the account has a saved Fabric canvas back design, render it instead
  if (typeof S !== 'undefined' && S.cfg && S.cfg.canvasDesignBackJson) {
    try {
      return await _renderFabricJsonToDataUrl(S.cfg.canvasDesignBackJson, 2775, 1875);
    } catch(e) {
      console.warn('[BidDrop] Canvas designer back render failed, falling back to legacy:', e.message);
    }
  }
  // ── Legacy path ──
  // Lob 6x9 back: 2775x1875px landscape (9.25"x6.25" bleed at 300dpi)
  // Lob ink-free zone: bottom-right 1200x712px — MUST stay blank/white
  const W=2775, H=1875;
  const LOB_ADDR_W=1200, LOB_ADDR_H=712;
  const SAFE=75;

  const cfg=S.cfg||{};
  const color=cfg.brandColor||'#F25C05';
  const darkColor='#1a1a1a';
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||'(000) 000-0000';
  const repName=cfg.repName||'';
  const repTitle=cfg.repTitle||'';
  const total=item.total||0;
  const finEnabled=cfg.financingEnabled!==false;
  const finApr=parseFloat(cfg.financingApr)||9.99;
  const finTerm=parseInt(cfg.financingTerm)||60;
  const finDown=parseFloat(cfg.financingDown)||0;
  let finMo=0;
  if(finEnabled&&total){const loan=total*(1-finDown/100);const r=finApr/100/12;finMo=r===0?Math.round(loan/finTerm):Math.round(loan*r*Math.pow(1+r,finTerm)/(Math.pow(1+r,finTerm)-1));}
  const hook=cfg.postcardHook||'Every roof tells a story. Yours says it might be time for new shingles. We measured your home from satellite imagery to give you an accurate starting estimate \u2014 no scheduled visit required.';
  const why=cfg.postcardWhy||'We identified your home because your roof shows possible signs of age or wear. This estimate is based on satellite measurements and may vary after an on-site inspection. You control the next step \u2014 scan the QR code to schedule your free in-home inspection now.';
  const pcQuote=cfg.postcardQuote||'';
  const guarantee=cfg.postcardGuarantee||'\u2713 Your specific roof was measured — not a template quote  \u2713 Real price. Real numbers. Real timeline.  \u2713 You decide what happens next';
  const badges=[cfg.diff1||'Fully Licensed & Fully Insured',cfg.diff2||'Factory-Certified Installers',cfg.diff3||'Clear, Line-by-Line Estimates'].filter(Boolean).slice(0,3);
  // Designer font sizes
  const backBadgeTxt=cfg.postcardBackBadgeText||'';
  const backBadgeColor=cfg.postcardBackBadgeColor||color;
  const hookSize=cfg.postcardHookSize||36;
  const whySize=cfg.postcardWhySize||30;
  const quoteSize=cfg.postcardQuoteSize||32;
  const guarSize=cfg.postcardGuarSize||26;
  const phoneSize=cfg.postcardPhoneSize||42;
  const scanCta=cfg.postcardScanCta||'SCAN TO BOOK';
  const scanSub=cfg.postcardScanSub||'No-pressure booking';
  const urgencyDate=new Date();urgencyDate.setDate(urgencyDate.getDate()+90);
  const urgencyStr=urgencyDate.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const headshotUrl=cfg.headshot||null;
  const headshotPos=parseFloat(cfg.headshotPos||'30')/100;
  const logoUrl=(cfg.logoData&&cfg.logoData.startsWith('http'))?cfg.logoData:null;
  const trackedUrl=item.id
    ? 'https://biddrop.us/'+(item.slug||'roofing')+'/'+encodeURIComponent(item.id)
    : (cfg.bookingUrl||'https://biddrop.us');
  const qrUrl=trackedUrl?'https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=4&data='+encodeURIComponent(trackedUrl):'';

  const [headshotImg,logoImg,qrImg]=await Promise.all([loadImg(headshotUrl),loadImg(logoUrl),loadImg(qrUrl)]);

  const canvas=document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');

  // ═══════════════════════════════════════════════════════════
  // LAYOUT (2775 x 1875):
  //
  //  ┌──────────────────────────────────────────────────────────┐
  //  │  HERO dark bg  (full width, top 52%)                     │
  //  │  [HEADSHOT left 30%]  [LOGO+BADGE+HOOK+PRICE right 70%]  │
  //  │  [lower-third name right-aligned over headshot bottom]   │
  //  ├──────────────────────────────────────────────────────────┤
  //  │  BOTTOM white (full width, bottom 48%)                   │
  //  │  LEFT col (0..~1400px): WHY + badges + urgency           │
  //  │  MID col (~1400..~1575px): QR + phone + guarantee        │
  //  │  RIGHT 1200px bottom 712px = LOB ADDR ZONE (blank)       │
  //  └──────────────────────────────────────────────────────────┘
  // ═══════════════════════════════════════════════════════════

  const HERO_H=Math.round(H*0.52); // 975px
  const BOTTOM_Y=HERO_H;
  const BOTTOM_H=H-HERO_H;         // 900px
  const HS_W=Math.round(W*0.30);   // 832px headshot column

  // ── HERO BACKGROUND ──────────────────────────────────────────
  ctx.fillStyle=darkColor;
  ctx.fillRect(0,0,W,HERO_H);
  ctx.fillStyle=color;
  ctx.fillRect(0,HERO_H-10,W,10);

  // ── HEADSHOT ─────────────────────────────────────────────────
  if(headshotImg){
    const scale=Math.max(HS_W/headshotImg.width, HERO_H/headshotImg.height);
    const dw=Math.round(headshotImg.width*scale);
    const dh=Math.round(headshotImg.height*scale);
    const dy=Math.round((HERO_H-dh)*headshotPos);
    ctx.save();
    ctx.beginPath();ctx.rect(0,0,HS_W,HERO_H);ctx.clip();
    ctx.drawImage(headshotImg,0,dy,dw,dh);
    // Fade right edge into dark bg
    const grad=ctx.createLinearGradient(HS_W-220,0,HS_W,0);
    grad.addColorStop(0,'rgba(26,26,26,0)');
    grad.addColorStop(1,'rgba(26,26,26,1)');
    ctx.fillStyle=grad;
    ctx.fillRect(HS_W-220,0,220,HERO_H);
    ctx.restore();

    // ── LOWER THIRD: right-aligned inside headshot, above fade ──
    if(repName){
      const FADE_START=HS_W-220; // where the fade begins — stay left of this
      const LT_RIGHT=FADE_START-20; // right edge of lower third bar
      const LT_H=repTitle?130:90;
      const LT_Y=HERO_H-LT_H-16;
      // Measure text to size the bar
      ctx.font='bold 52px Arial';
      const nameW=ctx.measureText(repName).width;
      ctx.font='36px Arial';
      const titleW=repTitle?ctx.measureText(repTitle).width:0;
      const barW=Math.max(nameW,titleW)+60;
      const LT_X=LT_RIGHT-barW;
      // Semi-transparent dark bar
      ctx.fillStyle='rgba(0,0,0,0.75)';
      roundRect(ctx,LT_X,LT_Y,barW,LT_H,8);ctx.fill();
      // Orange left accent
      ctx.fillStyle=color;
      ctx.fillRect(LT_X,LT_Y,8,LT_H);
      // Name — right-aligned
      ctx.font='bold 52px Arial';ctx.fillStyle='#ffffff';
      ctx.textAlign='right';
      ctx.fillText(repName,LT_RIGHT-10,LT_Y+62);
      if(repTitle){
        ctx.font='36px Arial';ctx.fillStyle='rgba(255,255,255,0.75)';
        ctx.fillText(repTitle,LT_RIGHT-10,LT_Y+108);
      }
      ctx.textAlign='left';
    }
  }

  // ── HERO RIGHT: LOGO + BADGE + HOOK + PRICE + STARS ──────────
  const HR_X=HS_W+50;
  const HR_W=W-HR_X-SAFE;
  let hy=SAFE+10;

  // Logo
  if(logoImg){
    const lh=72;const lw=Math.round(logoImg.width*(lh/logoImg.height));
    ctx.drawImage(logoImg,HR_X,hy,Math.min(lw,340),lh);
    hy+=lh+24;
  } else {
    ctx.font='bold 52px Arial';ctx.fillStyle='#ffffff';
    ctx.fillText(co,HR_X,hy+52);hy+=76;
  }

  // Badge pill (only render if text is set)
  if(backBadgeTxt){
    ctx.font='bold 36px Arial';
    const pillW=ctx.measureText(backBadgeTxt).width+48;
    ctx.fillStyle=backBadgeColor;
    roundRect(ctx,HR_X,hy,pillW,60,10);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillText(backBadgeTxt,HR_X+24,hy+42);
    hy+=80;
  }
  // Hook quote
  const hookLineH=Math.round(hookSize*1.38);
  ctx.font='italic '+hookSize+'px Georgia, serif';ctx.fillStyle='rgba(255,255,255,0.88)';
  const hookLines=wrapText(ctx,hook,HR_W);
  hookLines.slice(0,3).forEach((l,i)=>{ctx.fillText(l,HR_X,hy+hookSize+i*hookLineH);});
  hy+=Math.min(hookLines.length,3)*hookLineH+28;;

  // Price bar (optional — controlled by postcardShowPriceBack setting)
  const showPriceBack=cfg.postcardShowPriceBack!==false;
  if(showPriceBack){
  const PB_H=finMo?200:160;
  ctx.fillStyle=color;
  roundRect(ctx,HR_X,hy,HR_W,PB_H,18);ctx.fill();
  if(finMo){
    const col2X=HR_X+Math.round(HR_W/2)+10;
    ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font='bold 30px Arial';
    ctx.fillText('ESTIMATED TOTAL',HR_X+24,hy+42);
    ctx.fillStyle='#fff';ctx.font='bold 100px Arial';
    ctx.fillText('$'+total.toLocaleString(),HR_X+24,hy+158);
    ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillRect(col2X-10,hy+18,3,PB_H-36);
    ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font='bold 30px Arial';
    ctx.fillText('AS LOW AS',col2X,hy+42);
    ctx.fillStyle='#fff';ctx.font='bold 100px Arial';
    ctx.fillText('$'+finMo.toLocaleString()+'/mo',col2X,hy+158);
  } else {
    ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font='bold 32px Arial';
    ctx.fillText('YOUR ESTIMATE',HR_X+24,hy+46);
    ctx.fillStyle='#fff';ctx.font='bold 110px Arial';
    ctx.fillText('$'+total.toLocaleString(),HR_X+24,hy+164);
  }
  hy+=PB_H+24;
  } // end showPriceBack

  // Stars + review (only render if a real customer quote is provided)
  if(pcQuote){
    ctx.font='46px Arial';ctx.fillStyle='#f59e0b';
    ctx.fillText('\u2605\u2605\u2605\u2605\u2605',HR_X,hy+46);hy+=64;
    const qLineH=Math.round(quoteSize*1.36);
    ctx.font='italic '+quoteSize+'px Georgia, serif';ctx.fillStyle='rgba(255,255,255,0.80)';
    const qLines=wrapText(ctx,pcQuote,HR_W);
    qLines.slice(0,2).forEach((l,i)=>{ctx.fillText(l,HR_X,hy+quoteSize+i*qLineH);});
  }

  // ── BOTTOM SECTION (white) ────────────────────────────────────
  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,BOTTOM_Y,W,BOTTOM_H);
  ctx.fillStyle=color;ctx.fillRect(0,BOTTOM_Y,W,8);

  // Bottom content safe width (avoid Lob address zone)
  // Lob addr zone: right 1200px, bottom 712px
  // So content can use full width above (H - LOB_ADDR_H) = above y=1163
  // And left (W - LOB_ADDR_W) = left of x=1575 in the bottom 712px
  // Strategy: two columns within x=SAFE..x=1500 (safe left of Lob zone)
  const CONTENT_RIGHT=W-LOB_ADDR_W-SAFE; // x=1500
  const LEFT_COL_W=Math.round(CONTENT_RIGHT*0.60); // ~900px
  const RIGHT_COL_X=LEFT_COL_W+SAFE*2;             // ~1050px
  const RIGHT_COL_W=CONTENT_RIGHT-LEFT_COL_W-SAFE*2; // ~375px

  let by=BOTTOM_Y+SAFE;

  // WHY WAS THIS SENT TO YOU?
  ctx.font='bold 34px Arial';ctx.fillStyle=color;
  ctx.fillText('HOW WE CAN HELP',SAFE,by+34);by+=52;
  const whyLineH=Math.round(whySize*1.4);
  ctx.font=whySize+'px Arial';ctx.fillStyle='#374151';
  const whyLines=wrapText(ctx,why,LEFT_COL_W-SAFE);
  whyLines.slice(0,6).forEach((l,i)=>{ctx.fillText(l,SAFE,by+whySize+i*whyLineH);});
  by+=Math.min(whyLines.length,6)*whyLineH+24;

  // Badges
  ctx.font='bold 28px Arial';
  let bx2=SAFE;
  badges.forEach(b=>{
    const label='\u2713 '+b;
    const bw2=ctx.measureText(label).width+26;
    if(bx2+bw2>LEFT_COL_W+SAFE){return;}
    ctx.fillStyle='#fff7ed';ctx.strokeStyle=color;ctx.lineWidth=2;
    roundRect(ctx,bx2,by,bw2,46,7);ctx.fill();ctx.stroke();
    ctx.fillStyle=color;ctx.fillText(label,bx2+13,by+33);
    bx2+=bw2+12;
  });
  by+=60;

  // Urgency
  ctx.font='30px Arial';ctx.fillStyle='#6b7280';
  const urgPrefix='\u23F0 Estimate valid until ';
  ctx.fillText(urgPrefix,SAFE,by+30);
  const uw=ctx.measureText(urgPrefix).width;
  ctx.font='bold 30px Arial';ctx.fillStyle='#dc2626';
  ctx.fillText(urgencyStr,SAFE+uw,by+30);

  // RIGHT COLUMN: QR stacked vertically + phone + guarantee
  // Safe bottom = H - SAFE = 1800px. Budget: QR(180)+labels(70)+phone(60)+guarantee(50) = 360px → fits in 900px bottom section
  const BOTTOM_SAFE=H-SAFE; // 1800px
  let ry2=BOTTOM_Y+SAFE;
  if(qrImg){
    const QR_SIZE=180; // reduced from 240 to save vertical space
    ctx.drawImage(qrImg,RIGHT_COL_X,ry2,QR_SIZE,QR_SIZE);
    ry2+=QR_SIZE+10;
    ctx.font='bold 28px Arial';ctx.fillStyle='#111827';
    ctx.fillText(scanCta,RIGHT_COL_X,ry2+28);
    ry2+=38;
    ctx.font='22px Arial';ctx.fillStyle='#6b7280';
    ctx.fillText(scanSub,RIGHT_COL_X,ry2+24);
    ry2+=36;
  }
  ctx.font='bold '+phoneSize+'px Arial';ctx.fillStyle='#111827';
  ctx.fillText(ph,RIGHT_COL_X,ry2+phoneSize);ry2+=phoneSize+16;
  // Guarantee checkmarks removed per design update
  // LEFT COLUMN: logo in remaining white space below urgency
  if(logoImg){
    const logoMaxH=140;const logoMaxW=500;
    const logoAspect=logoImg.width/logoImg.height;
    let lw=Math.min(logoMaxW,logoMaxH*logoAspect);
    let lh=Math.round(lw/logoAspect);
    if(lh>logoMaxH){lh=logoMaxH;lw=Math.round(lh*logoAspect);}
    const logoY=by+40;
    if(logoY+lh < H-SAFE){
      ctx.globalAlpha=1.0;
      ctx.drawImage(logoImg,SAFE,logoY,lw,lh);
      ctx.globalAlpha=1.0;
    }
  }
  // ── FINE PRINT: satellite disclaimer + Reg Z disclosure ────────────────────
  // Placed in bottom-left white section above safe margin
  const FINE_MAX_W=W-LOB_ADDR_W-SAFE*2;
  ctx.font='18px Arial';ctx.fillStyle='#9ca3af';
  const satDisclaimer='Estimate based on satellite imagery. Subject to on-site verification.';
  const priceDisclaimer='This estimate does not reflect a final project price. Actual cost may vary after on-site inspection.';
  if(finMo>0){
    const loan=Math.round(total*(1-(parseFloat(cfg.financingDown)||0)/100));
    const regZ='*Monthly payment based on $'+loan.toLocaleString()+' financed at '+(parseFloat(cfg.financingApr)||9.99)+'% APR for '+(parseInt(cfg.financingTerm)||60)+' months with $0 down. Subject to credit approval.';
    const regZLines=wrapText(ctx,regZ,FINE_MAX_W);
    // Stack: regZ (top) → priceDisclaimer → satDisclaimer (bottom)
    const regZStartY=H-SAFE-22-(regZLines.length>1?22:0)-26-22;
    regZLines.slice(0,2).forEach((l,i)=>{ctx.fillText(l,SAFE,regZStartY+i*22);});
    ctx.fillText(priceDisclaimer,SAFE,H-SAFE-22-22);
    ctx.fillText(satDisclaimer,SAFE,H-SAFE-22);
  } else {
    ctx.fillText(priceDisclaimer,SAFE,H-SAFE-22-22);
    ctx.fillText(satDisclaimer,SAFE,H-SAFE-22);
  }

  // ── LOB ADDRESS ZONE: pure white ──────────────────────────────
  ctx.fillStyle='#ffffff';
  ctx.fillRect(W-LOB_ADDR_W, H-LOB_ADDR_H, LOB_ADDR_W, LOB_ADDR_H);

  return canvas.toDataURL('image/jpeg',0.92);
}
// Build the 6×9 postcard FRONT — full-bleed house photo with overlay
function buildPostcard6x9FrontHtml(item){
  const cfg=S.cfg||{};
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||cfg.phone||'(000) 000-0000';
  const color=cfg.brandColor||'#F25C05';
  const total=item.total||0;
  const logoUrl=(cfg.logoData&&!cfg.logoData.startsWith('data:'))?cfg.logoData:'';
  const addr=item.addr||'';
  const shortAddr=addr.split(',')[0]||addr;
  const cityState=addr.split(',').slice(1,3).join(',').trim();
  const housePhoto=item.photo_url||item.photo_data||null;
  const finEnabled=cfg.financingEnabled!==false;
  const finApr=parseFloat(cfg.financingApr)||9.99;
  const finTerm=parseInt(cfg.financingTerm)||60;
  const finDown=parseFloat(cfg.financingDown)||0;
  let finMo=0;
  if(finEnabled&&total){const loan=total*(1-finDown/100);const r=finApr/100/12;finMo=r===0?Math.round(loan/finTerm):Math.round(loan*r*Math.pow(1+r,finTerm)/(Math.pow(1+r,finTerm)-1));}
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,sans-serif;position:relative;background:#1a2333}
.bg-img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block;z-index:0}
.bg-overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:linear-gradient(to bottom,rgba(0,0,0,.25) 0%,rgba(0,0,0,.1) 40%,rgba(0,0,0,.65) 75%,rgba(0,0,0,.85) 100%);z-index:1}
.c{position:relative;z-index:2;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:40px 44px}
.tb{display:flex;justify-content:space-between;align-items:flex-start}
.logo img{max-height:53px;max-width:192px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}
.logo .cn{font-size:22px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.7);letter-spacing:1px}
.bge{background:${color};color:#fff;font-size:13px;font-weight:800;padding:8px 18px;border-radius:30px;text-transform:uppercase;box-shadow:0 3px 12px rgba(0,0,0,.4);white-space:nowrap}
.hl{font-size:38px;font-weight:900;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.8);line-height:1.1;margin-bottom:10px}
.al{font-size:18px;color:rgba(255,255,255,.92);text-shadow:0 2px 6px rgba(0,0,0,.7);margin-bottom:14px;font-weight:600}
.ps{background:${color};display:inline-flex;align-items:center;gap:20px;padding:12px 24px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.5)}
.pm{font-size:32px;font-weight:900;color:#fff;letter-spacing:-1px}
.pl{font-size:11px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.5px;line-height:1.3}
.pd{width:1px;height:36px;background:rgba(255,255,255,.3)}
.ph{margin-top:14px;font-size:16px;color:rgba(255,255,255,.85);font-weight:700;text-shadow:0 2px 6px rgba(0,0,0,.6)}
</style></head><body>
${housePhoto?`<img class="bg-img" src="${housePhoto}" alt="">`:''}
<div class="bg-overlay"></div>
<div class="c">
<div class="tb">
<div class="logo">${logoUrl?`<img src="${logoUrl}" alt="${escHtml(co)}">`:`<div class="cn">${escHtml(co)}</div>`}</div>
<div class="bge">Your Roof Estimate Is Ready</div>
</div>
<div>
<div class="hl">It might be time for a new roof.<br>But don't worry, we can help!</div>
<div class="al">&#128205; ${escHtml(shortAddr)}${cityState?', '+escHtml(cityState):''}</div>
<div class="ps">
<div><div class="pl">Estimated Total</div><div class="pm">$${total.toLocaleString()}</div></div>
${finMo?`<div class="pd"></div><div><div class="pl">As Low As</div><div class="pm">$${finMo.toLocaleString()}<span style="font-size:16px;font-weight:600">/mo</span></div></div>`:''}
</div>
<div class="ph">&#128222; ${escHtml(ph)}</div>
</div>
</div>
</body></html>`;
}
function buildPostcard6x9FrontHtmlD2(item){
  // Design 2: matches reference image exactly
  // Full-bleed house photo | Left navy overlay | Yellow italic accent | Bullets | Starburst badge | Split bottom bar
  const cfg=S.cfg||{};
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||cfg.phone||'(000) 000-0000';
  const site=(cfg.companyWebsite||cfg.website||'').replace(/^https?:\/\//,'');
  const barColor=cfg.postcardD2BarColor||'#CC1111';
  const logoUrl=(cfg.logoData&&!cfg.logoData.startsWith('data:'))?cfg.logoData:'';
  const housePhoto=item.photo_url||item.photo_data||null;
  const topLine  = escHtml(cfg.postcardD2TopLine||'PROTECT YOUR HOME WITH');
  const accent   = escHtml(cfg.postcardD2Accent||'AFFORDABLE');
  const hl1      = escHtml((cfg.postcardD2Headline||'ROOFING').toUpperCase());
  const hl2      = escHtml((cfg.postcardD2Headline2||'SOLUTIONS!').toUpperCase());
  const b1=escHtml(cfg.postcardD2Bullet1||'ROOFING');
  const b2=escHtml(cfg.postcardD2Bullet2||'SIDING');
  const b3=escHtml(cfg.postcardD2Bullet3||'GUTTERS');
  const badge1   = escHtml(cfg.postcardD2Badge1||'FREE');
  const badge2   = escHtml(cfg.postcardD2Badge2||'GUTTERS');
  const badgeSub = escHtml(cfg.postcardD2BadgeSub||'With this card. Offer expires 30 days from mail date.');
  const cta      = escHtml(cfg.postcardD2Cta||'SCHEDULE A FREE ESTIMATE TODAY!');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:864px;height:576px;overflow:hidden;font-family:Arial,sans-serif;position:relative}
.card{width:864px;height:576px;position:relative;overflow:hidden}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center}
.bg-fallback{position:absolute;inset:0;background:#2a4a6a}
.navy{position:absolute;top:0;left:0;width:48%;height:83%;background:linear-gradient(to right,rgba(15,30,60,0.97) 80%,rgba(15,30,60,0))}
.content{position:absolute;top:0;left:0;width:46%;height:83%;padding:20px 24px 0;display:flex;flex-direction:column;justify-content:flex-start}
.top-line{font-size:13px;font-weight:700;color:#fff;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:2px}
.accent-line{font-size:32px;font-weight:900;font-style:italic;color:#FFD700;line-height:1;margin-bottom:2px;text-transform:uppercase}
.hl1{font-size:46px;font-weight:900;color:#fff;line-height:0.95;text-transform:uppercase;letter-spacing:-1px}
.hl2{font-size:46px;font-weight:900;color:#fff;line-height:0.95;text-transform:uppercase;letter-spacing:-1px;margin-bottom:10px}
.bullets{list-style:none;margin-top:6px}
.bullets li{font-size:18px;font-weight:700;color:#fff;line-height:1.5;text-transform:uppercase}
.bullets li::before{content:"\\2022  "}
.badge{position:absolute;top:6px;right:6px;width:120px;height:120px}
.badge svg{width:120px;height:120px}
.badge-text{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.badge-l1{font-size:22px;font-weight:900;color:#1a1a1a;line-height:1}
.badge-l2{font-size:18px;font-weight:900;color:#1a1a1a;line-height:1}
.badge-sub{font-size:7px;color:#333;margin-top:2px;line-height:1.2;max-width:80px}
.bar{position:absolute;bottom:0;left:0;right:0;height:17%;display:flex}
.bar-left{width:36%;background:#fff;display:flex;align-items:center;padding:0 14px;gap:8px}
.bar-logo{max-height:44px;max-width:100px;object-fit:contain}
.bar-co{font-size:16px;font-weight:900;color:#1a2a4a;letter-spacing:0.5px}
.bar-right{flex:1;background:${barColor};display:flex;flex-direction:column;justify-content:center;padding:0 16px}
.bar-cta{font-size:10px;font-weight:700;color:#fff;letter-spacing:0.5px;text-transform:uppercase}
.bar-ph{font-size:26px;font-weight:900;color:#fff;letter-spacing:0.5px;line-height:1}
.bar-web{font-size:10px;color:rgba(255,255,255,0.85)}
</style></head><body>
<div class="card">
${housePhoto?`<img class="bg" src="${housePhoto}" alt="">`:'<div class="bg-fallback"></div>'}
<div class="navy"></div>
<div class="content">
  <div class="top-line">${topLine}</div>
  <div class="accent-line">${accent}</div>
  <div class="hl1">${hl1}</div>
  <div class="hl2">${hl2}</div>
  <ul class="bullets">
    ${b1?`<li>${b1}</li>`:''}
    ${b2?`<li>${b2}</li>`:''}
    ${b3?`<li>${b3}</li>`:''}
  </ul>
</div>
<div class="badge">
  <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <polygon points="60,2 67,22 87,10 82,31 104,30 92,47 112,58 96,68 104,90 82,86 80,108 62,95 44,108 42,86 20,90 28,68 12,58 32,47 20,30 42,31 37,10 57,22" fill="#FFD700"/>
  </svg>
  <div class="badge-text">
    <div class="badge-l1">${badge1}</div>
    <div class="badge-l2">${badge2}</div>
    <div class="badge-sub">${badgeSub}</div>
  </div>
</div>
<div class="bar">
  <div class="bar-left">
    ${logoUrl?`<img class="bar-logo" src="${logoUrl}" alt="${co}">`:`<div class="bar-co">${escHtml(co)}</div>`}
  </div>
  <div class="bar-right">
    <div class="bar-cta">${cta}</div>
    <div class="bar-ph">${escHtml(ph)}</div>
    ${site?`<div class="bar-web">${site}</div>`:''}
  </div>
</div>
</div>
<\/body><\/html>`;
}

function buildPostcard6x9BackHtml(item){
  const cfg=S.cfg||{};
  const addr=item.addr||'';
  const owner=item.owner||'Homeowner';
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||cfg.phone||'(000) 000-0000';
  const color=cfg.brandColor||'#F25C05';
  const total=item.total||0;
  const logoUrl=(cfg.logoData&&!cfg.logoData.startsWith('data:'))?cfg.logoData:'';
  const fromRaw=cfg.companyAddr||cfg.companyAddress||'123 Main St, Detroit, MI 48000';
  const trackedUrl=item.id
    ? 'https://biddrop.us/'+(item.slug||'roofing')+'/'+encodeURIComponent(item.id)
    : (cfg.bookingUrl||'https://biddrop.us');
  const qrUrl=trackedUrl?'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data='+encodeURIComponent(trackedUrl):'';
  const finEnabled=cfg.financingEnabled!==false;
  const finApr=parseFloat(cfg.financingApr)||9.99;
  const finTerm=parseInt(cfg.financingTerm)||60;
  const finDown=parseFloat(cfg.financingDown)||0;
  let finMo=0;
  if(finEnabled&&total){const loan=total*(1-finDown/100);const r=finApr/100/12;finMo=r===0?Math.round(loan/finTerm):Math.round(loan*r*Math.pow(1+r,finTerm)/(Math.pow(1+r,finTerm)-1));}
  const hook=cfg.postcardHook||'Every roof tells a story. Yours says it might be time for new shingles. We measured your home from satellite imagery to give you an accurate starting estimate \u2014 no scheduled visit required.';
  const why=cfg.postcardWhy||'We identified your home because your roof shows possible signs of age or wear. This estimate is based on satellite measurements and may vary after an on-site inspection. You control the next step \u2014 scan the QR code to schedule your free in-home inspection now.';
  const pcQuote=cfg.postcardQuote||'';
  const guarantee=cfg.postcardGuarantee||'\u2713 Your specific roof was measured — not a template quote  \u2713 Real price. Real numbers. Real timeline.  \u2713 You decide what happens next';
  const headshotData=(cfg.headshot&&!cfg.headshot.startsWith('data:'))?cfg.headshot:'';
  const repName=cfg.repName||'';
  const repTitle=cfg.repTitle||'Owner';
  const badges=[cfg.diff1||'Licensed & Insured',cfg.diff2||'Manufacturer Certified',cfg.diff3||'Workmanship Warranty'].filter(Boolean).slice(0,3);
  const urgencyDate=new Date();urgencyDate.setDate(urgencyDate.getDate()+90);
  const urgencyStr=urgencyDate.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:864px;height:576px;font-family:Arial,sans-serif;background:#fff;display:flex;overflow:hidden}
.L{width:528px;height:576px;padding:18px 22px;display:flex;flex-direction:column;justify-content:space-between;border-right:2px solid #eee;overflow:hidden}
.R{width:336px;height:576px;padding:18px 22px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
.tr{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.logo img{max-height:36px;max-width:130px;object-fit:contain}
.logo .cn{font-size:13px;font-weight:900;color:${color}}
.hs{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${color};flex-shrink:0}
.ri{font-size:8.5px;color:#555;line-height:1.3}
.ri strong{display:block;font-size:10px;color:#111;font-weight:800}
.hook{font-size:9.5px;color:#333;line-height:1.4;margin-bottom:4px;font-style:italic;border-left:3px solid ${color};padding-left:7px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wh{font-size:7.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:${color};margin-bottom:2px}
.why{font-size:8.5px;color:#444;line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}
.sq{font-size:8.5px;color:#333;font-style:italic;background:#fffbf0;border:1px solid #f0e0b0;border-radius:4px;padding:3px 6px;margin-bottom:4px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sr{color:#f59e0b;font-size:9px;letter-spacing:1px;margin-bottom:1px}
.bdg{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:4px}
.b{font-size:7px;font-weight:700;color:${color};border:1px solid ${color};border-radius:3px;padding:1px 4px;white-space:nowrap}
.urg{font-size:8px;color:#888;margin-bottom:3px}
.urg strong{color:#c53030}
.ps{background:${color};display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:6px}
.pm{font-size:18px;font-weight:900;color:#fff;line-height:1}
.pl{font-size:7.5px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.4px}
.pd{width:1px;height:20px;background:rgba(255,255,255,.3)}
.phl{font-size:9px;color:#555;font-weight:700}
.gt{font-size:7.5px;font-weight:700;color:#555;margin-top:2px;line-height:1.6;}
.ra{font-size:8px;color:#333;line-height:1.5}
.ra .rc{font-weight:700;font-size:9px}
.pb{border:1.5px solid #333;padding:4px 7px;text-align:center;font-size:8px;color:#333;line-height:1.4;width:96px;align-self:flex-end}
.pb strong{display:block;font-size:9.5px;letter-spacing:.3px}
.ta{font-size:12px;line-height:1.6;color:#111}
.ta .tn{font-weight:700;font-size:13px}
.bc{font-size:7px;color:#ccc;letter-spacing:2px;text-align:center;border-top:1px dashed #ddd;padding-top:3px}
</style></head><body>
<div class="L">
<div>
<div class="tr">
<div class="logo">${logoUrl?`<img src="${logoUrl}" alt="${escHtml(co)}">`:`<div class="cn">${escHtml(co)}</div>`}</div>
${headshotData?`<img src="${headshotData}" class="hs" alt="${escHtml(repName)}"><div class="ri"><strong>${escHtml(repName||co)}</strong>${escHtml(repTitle)}</div>`:''}
</div>
<div class="hook">${escHtml(hook)}</div>
<div class="wh">How We Can Help</div>
<div class="why">${escHtml(why)}</div>
${pcQuote?`<div class="sq"><div class="sr">&#9733;&#9733;&#9733;&#9733;&#9733;</div>${escHtml(pcQuote)}</div>`:''}
<div class="bdg">${badges.map(b=>`<span class="b">&#10003; ${escHtml(b)}</span>`).join('')}</div>
<div class="urg">&#9200; Estimate valid until <strong>${urgencyStr}</strong></div>
</div>
<div>
<div class="ps">
<div><div class="pl">Your Estimate</div><div class="pm">$${total.toLocaleString()}</div></div>
${finMo?`<div class="pd"></div><div><div class="pl">As Low As</div><div class="pm">$${finMo.toLocaleString()}<span style="font-size:12px">/mo</span></div></div>`:''}
</div>
<div style="display:flex;align-items:center;gap:8px;margin-top:5px">
${qrUrl?`<div style="text-align:center;flex-shrink:0"><img src="${qrUrl}" style="width:38px;height:38px;border-radius:3px;display:block"><div style="font-size:6px;color:#888;text-transform:uppercase;margin-top:1px">Scan to Book</div></div>`:''}
<div><div class="phl">&#128222; ${escHtml(ph)}</div></div>
</div>
</div>
</div>
<div class="R">
<div>
<div class="ra">
<div class="rc">${escHtml(co)}</div>
${fromRaw.split(',').map(l=>`<div>${escHtml(l.trim())}</div>`).join('')}
${ph?`<div>${escHtml(ph)}</div>`:''}
</div>
</div>
<div class="pb"><strong>PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000</div>
<div class="ta">
<div class="tn">${escHtml(owner)}</div>
<hr style="border:none;border-top:1px solid #eee;margin:4px 0">
${addr.split(',').map(l=>`<div>${escHtml(l.trim())}</div>`).join('')}
</div>
<div class="bc">DELIVERY POINT BARCODE</div>
</div>
</body></html>`;
}
function buildLobMailerHtml(item){
  const cfg      = S.cfg;
  const owner    = item.owner || 'Homeowner';
  const addr     = item.addr  || '';
  const co       = cfg.companyName   || 'Your Roofing Co';
  const coAddr   = cfg.companyAddr   || '';
  const ph       = cfg.companyPhone  || '(000) 000-0000';
  const accent   = cfg.brandColor    || '#F25C05';
  const rep      = cfg.repName       || co;
  const repTitle = cfg.repTitle      || 'Roofing Consultant';
  const lic      = cfg.licenseNum    || '';
  const yrs      = cfg.yearsInBusiness || '5+';
  const warr     = cfg.warrantyYears || '10';
  const logoUrl  = (cfg.logoData && cfg.logoData.startsWith('http')) ? cfg.logoData : '';
  const hsUrl    = (cfg.headshotData && cfg.headshotData.startsWith('http')) ? cfg.headshotData : '';
  const bookUrl  = cfg.bookingUrl || 'https://biddrop.us';
  const qrSrc    = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=4&data=' + encodeURIComponent(bookUrl);

  const total    = item.total || 0;
  const finEnabled = cfg.financingEnabled !== false;
  const finApr   = parseFloat(cfg.financingApr) || 9.99;
  const finTerm  = parseInt(cfg.financingTerm) || 60;
  const finDown  = parseFloat(cfg.financingDown) || 0;
  let finMo = 0;
  if(finEnabled && total){
    const loan = total * (1 - finDown/100);
    const r = finApr/100/12;
    finMo = r===0 ? Math.round(loan/finTerm) : Math.round(loan*r*Math.pow(1+r,finTerm)/(Math.pow(1+r,finTerm)-1));
  }

  const hookTxt  = cfg.hookLetter || 'Every roof tells a story. Yours says it\'s time for new shingles. That\'s why we measured your home from satellite imagery — to give you an exact price before we ever knock on your door. You control the next step — no contractor showing up unannounced.';
  const aboutCo  = cfg.aboutCompany || 'We are a local roofing company that believes in straight answers. No runaround, no pressure \u2014 just honest work from a crew that stands behind every job.';
  const diff1    = cfg.diff1 || 'Licensed, Bonded & Insured';
  const diff2    = cfg.diff2 || 'Manufacturer Certified';
  const diff3    = cfg.diff3 || 'Workmanship Warranty';
  const diff4    = cfg.diff4 || 'Financing Available';
  const diff5    = cfg.diff5 || 'Local Crews';

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  const addrParts = addr.split(',').map(s=>s.trim()).filter(Boolean);
  const ownerFirst = owner.split(' ')[0] || owner;

  // ── PAGE 1 ──────────────────────────────────────────────────────────────────
  const p1 = `
<div class="bd-page">
  <div class="bd-top-bar">
    <div class="bd-top-left">
      ${logoUrl ? `<img src="${esc(logoUrl)}" class="bd-logo" alt="${esc(co)}">` : `<span class="bd-co-name">${esc(co)}</span>`}
      <div class="bd-co-meta">${esc(coAddr)}${lic ? ' &nbsp;&bull;&nbsp; Lic. '+esc(lic) : ''}</div>
    </div>
    <div class="bd-top-right">
      <div class="bd-addr-block">
        <div class="bd-addr-name">${esc(owner)}</div>
        ${addrParts.map(l=>`<div class="bd-addr-line">${esc(l)}</div>`).join('')}
      </div>
    </div>
  </div>
  <div class="bd-rule"></div>

  <div class="bd-body">
    <div class="bd-salutation">Dear ${esc(ownerFirst)},</div>
    <div class="bd-hook">${esc(hookTxt)}</div>

    <div class="bd-estimate-box">
      <div class="bd-est-label">YOUR ESTIMATE</div>
      <div class="bd-est-amount">$${total.toLocaleString()}</div>
      ${finMo ? `<div class="bd-est-fin">or as low as <strong>$${finMo.toLocaleString()}/mo</strong> &nbsp;&middot;&nbsp; ${finApr}% APR &nbsp;&middot;&nbsp; ${finTerm} mo &nbsp;&middot;&nbsp; $0 down</div>` : ''}
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
        ${hsUrl ? `<img src="${esc(hsUrl)}" class="bd-headshot" alt="${esc(rep)}">` : ''}
        <div class="bd-rep-name">${esc(rep)}</div>
        <div class="bd-rep-title">${esc(repTitle)}</div>
        <div class="bd-rep-phone">${esc(ph)}</div>
      </div>
    </div>
  </div>

  <div class="bd-footer-bar">
    <div class="bd-footer-left">
      <div class="bd-footer-phone">${esc(ph)}</div>
      <div class="bd-footer-sub">Call or text to schedule</div>
    </div>
    <div class="bd-footer-center">
      <img src="${esc(qrSrc)}" class="bd-qr" alt="Scan to book">
      <div class="bd-qr-label">Scan to Book</div>
    </div>
    <div class="bd-footer-right">
      <div class="bd-footer-co">${esc(co)}</div>
      <div class="bd-footer-meta">${esc(coAddr)}</div>
      ${lic ? `<div class="bd-footer-meta">Lic. ${esc(lic)}</div>` : ''}
      <div class="bd-footer-meta">${new Date().getFullYear()}</div>
    </div>
  </div>
</div>`;

  // ── PAGE 2 — Estimate Detail ─────────────────────────────────────────────────
  const structs = item.structures || [];
  const structRows = structs.length ? structs.map(s=>`
    <tr>
      <td>${esc(s.label||'Roof')}</td>
      <td>${s.sqft ? s.sqft.toLocaleString()+' sq ft' : '\u2014'}</td>
      <td>${esc(s.material||'\u2014')}</td>
      <td>$${(s.price||0).toLocaleString()}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;color:#888">No structures added yet</td></tr>`;

  const p2 = `
<div class="bd-page">
  <div class="bd-top-bar">
    <div class="bd-top-left">
      ${logoUrl ? `<img src="${esc(logoUrl)}" class="bd-logo" alt="${esc(co)}">` : `<span class="bd-co-name">${esc(co)}</span>`}
    </div>
    <div class="bd-top-right">
      <span class="bd-page-label">Estimate Detail &nbsp;&middot;&nbsp; Page 2 of 3</span>
    </div>
  </div>
  <div class="bd-rule"></div>

  <div class="bd-body">
    <div class="bd-section-head" style="margin-bottom:16px">Price Breakdown</div>
    <table class="bd-table">
      <thead>
        <tr>
          <th>Structure</th>
          <th>Size</th>
          <th>Material</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        ${structRows}
        <tr class="bd-total-row">
          <td colspan="3"><strong>Total Investment</strong></td>
          <td><strong>$${total.toLocaleString()}</strong></td>
        </tr>
        ${finMo ? `<tr class="bd-fin-row"><td colspan="3">Monthly Financing (${finApr}% APR, ${finTerm} mo, $0 down)</td><td>$${finMo.toLocaleString()}/mo</td></tr>` : ''}
      </tbody>
    </table>

    <div class="bd-notice">Financing estimate based on ${finApr}% APR, ${finTerm}-month term, subject to credit approval. Actual rate may vary.</div>

    <div class="bd-section-head" style="margin-top:32px;margin-bottom:16px">What&rsquo;s Included</div>
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
    <div class="bd-footer-left"><div class="bd-footer-phone">${esc(ph)}</div></div>
    <div class="bd-footer-right"><div class="bd-footer-co">${esc(co)} &nbsp;&bull;&nbsp; ${esc(coAddr)}</div></div>
  </div>
</div>`;

  // ── PAGE 3 — Next Steps ──────────────────────────────────────────────────────
  const p3 = `
<div class="bd-page">
  <div class="bd-top-bar">
    <div class="bd-top-left">
      ${logoUrl ? `<img src="${esc(logoUrl)}" class="bd-logo" alt="${esc(co)}">` : `<span class="bd-co-name">${esc(co)}</span>`}
    </div>
    <div class="bd-top-right">
      <span class="bd-page-label">Next Steps &nbsp;&middot;&nbsp; Page 3 of 3</span>
    </div>
  </div>
  <div class="bd-rule"></div>

  <div class="bd-body">
    <div class="bd-section-head" style="margin-bottom:24px">Ready to Move Forward?</div>
    <div class="bd-steps">
      <div class="bd-step">
        <div class="bd-step-num" style="background:${esc(accent)}">1</div>
        <div class="bd-step-body">
          <div class="bd-step-title">Call or Text Us</div>
          <div class="bd-step-desc">Reach out to ${esc(rep)} directly at ${esc(ph)}. We&rsquo;ll answer any questions and schedule a time that works for you.</div>
        </div>
      </div>
      <div class="bd-step">
        <div class="bd-step-num" style="background:${esc(accent)}">2</div>
        <div class="bd-step-body">
          <div class="bd-step-title">We Come to You</div>
          <div class="bd-step-desc">A member of our crew visits the property to confirm measurements and walk you through the scope of work in person.</div>
        </div>
      </div>
      <div class="bd-step">
        <div class="bd-step-num" style="background:${esc(accent)}">3</div>
        <div class="bd-step-body">
          <div class="bd-step-title">We Get to Work</div>
          <div class="bd-step-desc">Once you sign off, we schedule your job and complete the installation. Most roofs are done in a single day.</div>
        </div>
      </div>
    </div>

    <div class="bd-cta-box" style="border-color:${esc(accent)}">
      <div class="bd-cta-phone" style="color:${esc(accent)}">${esc(ph)}</div>
      <div class="bd-cta-sub">Call or text &nbsp;&bull;&nbsp; ${esc(rep)}, ${esc(repTitle)}</div>
      <div style="margin-top:16px;display:flex;align-items:center;gap:16px">
        <img src="${esc(qrSrc)}" style="width:80px;height:80px;border-radius:4px" alt="Scan to book">
        <div style="font-size:12px;color:#555">Scan to book online &mdash; no phone call required</div>
      </div>
    </div>
  </div>

  <div class="bd-footer-bar">
    <div class="bd-footer-left"><div class="bd-footer-phone">${esc(ph)}</div></div>
    <div class="bd-footer-right">
      <div class="bd-footer-co">${esc(co)}</div>
      <div class="bd-footer-meta">${esc(coAddr)}${lic ? ' &nbsp;&bull;&nbsp; Lic. '+esc(lic) : ''} &nbsp;&bull;&nbsp; ${new Date().getFullYear()}</div>
    </div>
  </div>
</div>`;

  // ── WRAPPER ──────────────────────────────────────────────────────────────────
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#f4f4f4;color:#111}
.bd-page{width:816px;min-height:1056px;background:#fff;margin:0 auto 40px;display:flex;flex-direction:column;page-break-after:always}
.bd-top-bar{display:flex;justify-content:space-between;align-items:flex-start;padding:28px 40px 0}
.bd-logo{max-height:40px;max-width:160px;object-fit:contain}
.bd-co-name{font-family:'DM Serif Display',serif;font-size:22px;color:${accent}}
.bd-co-meta{font-size:11px;color:#888;margin-top:3px}
.bd-addr-block{text-align:right}
.bd-addr-name{font-size:13px;font-weight:700;color:#111}
.bd-addr-line{font-size:12px;color:#555}
.bd-page-label{font-size:12px;color:#888;font-weight:500}
.bd-rule{height:3px;background:${accent};margin:16px 40px 0}
.bd-body{flex:1;padding:32px 40px}
.bd-salutation{font-family:'DM Serif Display',serif;font-size:26px;color:#111;margin-bottom:12px}
.bd-hook{font-size:14px;line-height:1.7;color:#333;margin-bottom:28px;max-width:600px}
.bd-estimate-box{border:2px solid ${accent};border-radius:4px;padding:20px 28px;margin-bottom:28px;display:inline-block;min-width:320px}
.bd-est-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${accent};font-weight:700;margin-bottom:6px}
.bd-est-amount{font-family:'DM Serif Display',serif;font-size:48px;color:#111;line-height:1}
.bd-est-fin{font-size:12px;color:#555;margin-top:8px}
.bd-two-col{display:flex;gap:40px}
.bd-col-left{flex:1}
.bd-col-right{width:180px;text-align:center}
.bd-section-head{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#888;font-weight:700;margin-bottom:10px}
.bd-about-text{font-size:13px;line-height:1.65;color:#333;margin-bottom:14px}
.bd-cred-row{display:flex;flex-wrap:wrap;gap:6px}
.bd-cred{font-size:11px;color:#333;border:1px solid #ccc;border-radius:2px;padding:3px 8px;white-space:nowrap}
.bd-headshot{width:100px;height:100px;border-radius:50%;object-fit:cover;border:2px solid ${accent};margin-bottom:8px}
.bd-rep-name{font-size:14px;font-weight:700;color:#111}
.bd-rep-title{font-size:12px;color:#666;margin-bottom:4px}
.bd-rep-phone{font-size:13px;color:${accent};font-weight:600}
.bd-footer-bar{background:#111;display:flex;justify-content:space-between;align-items:center;padding:16px 40px;margin-top:auto}
.bd-footer-left{}
.bd-footer-center{text-align:center}
.bd-footer-right{text-align:right}
.bd-footer-phone{font-family:'DM Serif Display',serif;font-size:22px;color:#fff}
.bd-footer-sub{font-size:10px;color:#aaa;margin-top:2px}
.bd-footer-co{font-size:13px;font-weight:600;color:#fff}
.bd-footer-meta{font-size:10px;color:#aaa;margin-top:2px}
.bd-qr{width:52px;height:52px;border-radius:3px;display:block;margin:0 auto}
.bd-qr-label{font-size:9px;color:#aaa;text-transform:uppercase;letter-spacing:1px;margin-top:3px;text-align:center}
.bd-table{width:100%;border-collapse:collapse;font-size:13px}
.bd-table th{text-align:left;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;padding:8px 0;border-bottom:2px solid #eee}
.bd-table td{padding:10px 0;border-bottom:1px solid #f0f0f0;color:#333}
.bd-total-row td{font-size:15px;color:#111;border-top:2px solid #111;border-bottom:none;padding-top:14px}
.bd-fin-row td{font-size:12px;color:#666;border-bottom:none}
.bd-notice{font-size:11px;color:#999;margin-top:16px;line-height:1.5}
.bd-included-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
.bd-inc-item{font-size:13px;color:#333;padding:4px 0}
.bd-steps{display:flex;flex-direction:column;gap:24px;margin-bottom:32px}
.bd-step{display:flex;gap:20px;align-items:flex-start}
.bd-step-num{width:36px;height:36px;border-radius:50%;color:#fff;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.bd-step-title{font-size:15px;font-weight:700;color:#111;margin-bottom:4px}
.bd-step-desc{font-size:13px;color:#555;line-height:1.6}
.bd-cta-box{border:2px solid;border-radius:4px;padding:24px 28px;text-align:center}
.bd-cta-phone{font-family:'DM Serif Display',serif;font-size:36px}
.bd-cta-sub{font-size:13px;color:#666;margin-top:4px}
@media print{.bd-page{margin:0;page-break-after:always}}
</style></head><body>
${p1}${p2}${p3}
</body></html>`;
}


// ─────────────────────────────────────────────────────────────────────────────
// renderDesignBackCanvas(cfg, overrides)
// Renders the back of a custom-uploaded design postcard.
// Same dark/white split layout as the estimate back but:
//   - No pricing / estimate summary
//   - QR links to bookingUrl (not estimate page)
//   - All text driven by per-design overrides (falling back to cfg/S.cfg)
// Returns a data URL (JPEG).
// ─────────────────────────────────────────────────────────────────────────────
async function renderDesignBackCanvas(cfg, overrides){
  cfg = cfg || (window.S && window.S.cfg) || {};
  overrides = overrides || {};
  function ov(key){ return overrides[key] !== undefined && overrides[key] !== '' ? overrides[key] : (cfg[key] || null); }

  const W=2775, H=1875, SAFE=75;
  const LOB_ADDR_W=1200, LOB_ADDR_H=712;
  const color      = ov('brandColor')            || '#F25C05';
  const darkColor  = '#1a1a1a';
  const co         = ov('companyName')            || 'Your Roofing Co';
  const ph         = ov('companyPhone')           || '(000) 000-0000';
  const repName    = ov('repName')                || '';
  const repTitle   = ov('repTitle')               || '';
  const backBadgeTxt   = ov('postcardBackBadgeText')  || '';
  const backBadgeColor = ov('postcardBackBadgeColor') || color;
  const hook           = ov('postcardHook')           || 'Every roof tells a story. Yours says it\'s time for new shingles. That\'s why we measured your home from satellite imagery — to give you an exact price before we ever knock on your door.';
  const why            = ov('postcardWhy')            || 'We identified your home because your roof shows signs of age or damage. You control the next step — scan the QR code, call us, or ignore. No contractor showing up unannounced.';
  const pcQuote        = ov('postcardQuote')          || '';
  const guarantee      = ov('postcardGuarantee')      || '\u2713 Your specific roof was measured — not a template quote  \u2713 Real price. Real numbers. Real timeline.  \u2713 You decide what happens next';
  const scanCta        = ov('postcardScanCta')        || 'SCAN TO BOOK';
  const scanSub        = ov('postcardScanSub')        || 'No-pressure booking';
  const whyLabel       = ov('postcardWhyLabel')       || 'HOW WE CAN HELP';
  const badges = [
    ov('diff1') || 'Licensed, Bonded & Insured',
    ov('diff2') || 'Manufacturer Certified',
    ov('diff3') || 'Itemized Pricing'
  ].filter(Boolean).slice(0, 3);
  const hookSize  = parseInt(ov('postcardHookSize'))  || 36;
  const whySize   = parseInt(ov('postcardWhySize'))   || 30;
  const quoteSize = parseInt(ov('postcardQuoteSize')) || 32;
  const guarSize  = parseInt(ov('postcardGuarSize'))  || 26;
  const phoneSize = parseInt(ov('postcardPhoneSize')) || 42;
  const bookingUrl = ov('bookingUrl') || 'https://biddrop.us';
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=4&data=' + encodeURIComponent(bookingUrl);
  const headshotUrl = (cfg.headshotData && cfg.headshotData.startsWith('http')) ? cfg.headshotData : null;
  const logoUrl     = (cfg.logoData     && cfg.logoData.startsWith('http'))     ? cfg.logoData     : null;
  const headshotPos = parseFloat(cfg.headshotPos || '30') / 100;
  const [headshotImg, logoImg, qrImg] = await Promise.all([
    loadImg(headshotUrl), loadImg(logoUrl), loadImg(qrUrl)
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const HERO_H   = Math.round(H * 0.52);
  const BOTTOM_Y = HERO_H;
  const BOTTOM_H = H - HERO_H;
  const HS_W     = Math.round(W * 0.30);
  const HR_X     = HS_W + SAFE;
  const HR_W     = W - HR_X - SAFE;
  // HERO BG
  ctx.fillStyle = darkColor; ctx.fillRect(0, 0, W, HERO_H);
  ctx.fillStyle = color; ctx.fillRect(0, HERO_H - 10, W, 10);
  // HEADSHOT
  if(headshotImg){
    const scale = Math.max(HS_W / headshotImg.width, HERO_H / headshotImg.height);
    const dw = Math.round(headshotImg.width * scale);
    const dh = Math.round(headshotImg.height * scale);
    const dy = Math.round((HERO_H - dh) * headshotPos);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, HS_W, HERO_H); ctx.clip();
    ctx.drawImage(headshotImg, 0, dy, dw, dh);
    const grad = ctx.createLinearGradient(HS_W - 220, 0, HS_W, 0);
    grad.addColorStop(0, 'rgba(26,26,26,0)'); grad.addColorStop(1, 'rgba(26,26,26,1)');
    ctx.fillStyle = grad; ctx.fillRect(HS_W - 220, 0, 220, HERO_H);
    ctx.restore();
    if(repName){
      const FADE_START = HS_W - 220, LT_RIGHT = FADE_START - 20;
      const LT_H = repTitle ? 110 : 76, LT_Y = HERO_H - LT_H - 40;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, LT_Y, LT_RIGHT, LT_H);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'right';
      ctx.fillText(repName, LT_RIGHT - 16, LT_Y + 50);
      if(repTitle){ ctx.font = '32px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fillText(repTitle, LT_RIGHT - 16, LT_Y + 94); }
      ctx.textAlign = 'left';
    }
  }
  // HERO RIGHT: company name + badge + hook + stars + quote (NO pricing)
  let hy = SAFE;
  ctx.font = 'bold 62px Arial'; ctx.fillStyle = '#fff';
  ctx.fillText(co, HR_X, hy + 62); hy += 80;
  if(backBadgeTxt){
    ctx.font = 'bold 36px Arial';
    const pillW = ctx.measureText(backBadgeTxt).width + 48;
    ctx.fillStyle = backBadgeColor; roundRect(ctx, HR_X, hy, pillW, 60, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(backBadgeTxt, HR_X + 24, hy + 42); hy += 80;
  }
  const hookLineH = Math.round(hookSize * 1.38);
  ctx.font = 'italic ' + hookSize + 'px Georgia, serif'; ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const hookLines = wrapText(ctx, hook, HR_W);
  hookLines.slice(0, 3).forEach((l, i) => { ctx.fillText(l, HR_X, hy + hookSize + i * hookLineH); });
  hy += Math.min(hookLines.length, 3) * hookLineH + 28;
  if(pcQuote){
    ctx.font = '46px Arial'; ctx.fillStyle = '#f59e0b';
    ctx.fillText('\u2605\u2605\u2605\u2605\u2605', HR_X, hy + 46); hy += 64;
    const qLineH = Math.round(quoteSize * 1.36);
    ctx.font = 'italic ' + quoteSize + 'px Georgia, serif'; ctx.fillStyle = 'rgba(255,255,255,0.80)';
    const qLines = wrapText(ctx, pcQuote, HR_W);
    qLines.slice(0, 2).forEach((l, i) => { ctx.fillText(l, HR_X, hy + quoteSize + i * qLineH); });
  }
  // BOTTOM white section
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, BOTTOM_Y, W, BOTTOM_H);
  ctx.fillStyle = color; ctx.fillRect(0, BOTTOM_Y, W, 8);
  const CONTENT_RIGHT = W - LOB_ADDR_W - SAFE;
  const LEFT_COL_W    = Math.round(CONTENT_RIGHT * 0.60);
  const RIGHT_COL_X   = LEFT_COL_W + SAFE * 2;
  const RIGHT_COL_W   = CONTENT_RIGHT - LEFT_COL_W - SAFE * 2;
  let by = BOTTOM_Y + SAFE;
  ctx.font = 'bold 34px Arial'; ctx.fillStyle = color;
  ctx.fillText(whyLabel, SAFE, by + 34); by += 52;
  const whyLineH = Math.round(whySize * 1.4);
  ctx.font = whySize + 'px Arial'; ctx.fillStyle = '#374151';
  const whyLines = wrapText(ctx, why, LEFT_COL_W - SAFE);
  whyLines.slice(0, 6).forEach((l, i) => { ctx.fillText(l, SAFE, by + whySize + i * whyLineH); });
  by += Math.min(whyLines.length, 6) * whyLineH + 24;
  ctx.font = 'bold 28px Arial';
  let bx2 = SAFE;
  badges.forEach(b => {
    const label = '\u2713 ' + b; const bw2 = ctx.measureText(label).width + 26;
    if(bx2 + bw2 > LEFT_COL_W + SAFE){ return; }
    ctx.fillStyle = '#fff7ed'; ctx.strokeStyle = color; ctx.lineWidth = 2;
    roundRect(ctx, bx2, by, bw2, 46, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.fillText(label, bx2 + 13, by + 33); bx2 += bw2 + 12;
  });
  by += 60;
  if(logoImg){
    const logoMaxH = 140, logoMaxW = 500, logoAspect = logoImg.width / logoImg.height;
    let lw = Math.min(logoMaxW, logoMaxH * logoAspect);
    let lh = Math.round(lw / logoAspect);
    if(lh > logoMaxH){ lh = logoMaxH; lw = Math.round(lh * logoAspect); }
    const logoY = by + 40;
    if(logoY + lh < H - SAFE){ ctx.drawImage(logoImg, SAFE, logoY, lw, lh); }
  }
  const BOTTOM_SAFE = H - SAFE;
  let ry2 = BOTTOM_Y + SAFE;
  if(qrImg){
    const QR_SIZE = 180;
    ctx.drawImage(qrImg, RIGHT_COL_X, ry2, QR_SIZE, QR_SIZE); ry2 += QR_SIZE + 10;
    ctx.font = 'bold 28px Arial'; ctx.fillStyle = '#111827';
    ctx.fillText(scanCta, RIGHT_COL_X, ry2 + 28); ry2 += 38;
    ctx.font = '22px Arial'; ctx.fillStyle = '#6b7280';
    ctx.fillText(scanSub, RIGHT_COL_X, ry2 + 24); ry2 += 36;
  }
  ctx.font = 'bold ' + phoneSize + 'px Arial'; ctx.fillStyle = '#111827';
  ctx.fillText(ph, RIGHT_COL_X, ry2 + phoneSize); ry2 += phoneSize + 16;
  // Guarantee checkmarks removed per design update
  // ── FINE PRINT: satellite disclaimer (secondary renderer) ────────────────────
  const FINE_MAX_W2 = W - LOB_ADDR_W - SAFE * 2;
  ctx.font = '18px Arial'; ctx.fillStyle = '#9ca3af';
  ctx.fillText('This estimate does not reflect a final project price. Actual cost may vary after on-site inspection.', SAFE, H - SAFE - 22 - 22);
  ctx.fillText('Estimate based on satellite imagery. Subject to on-site verification.', SAFE, H - SAFE - 22);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(W - LOB_ADDR_W, H - LOB_ADDR_H, LOB_ADDR_W, LOB_ADDR_H);
  return canvas.toDataURL('image/jpeg', 0.92);
}

// ─────────────────────────────────────────────────────────────────────────────
// renderCustomBackCanvas(backImageSrc, cfg)
// Renders the back of a postcard using a client-uploaded back image.
// Overlays: QR code (bottom-left zone), address block white rect, postage white rect.
// Returns a data URL (JPEG).
// ─────────────────────────────────────────────────────────────────────────────
async function renderCustomBackCanvas(backImageSrc, cfg) {
  cfg = cfg || (window.S && window.S.cfg) || {};

  // Canvas: 2775 x 1875 px (Lob 6x9 landscape with 0.25" bleed at 300 DPI)
  const W = 2775, H = 1875;

  // ── Zones measured from official 2775x1875 Lob template ─────────────────
  // QR code zone (bottom-left white box)
  // QR zone: x=211..672, y=1251..1728
  const QR_X = 211, QR_Y = 1251, QR_W = 461, QR_H = 477;

  // Address zone (cream "LEAVE EMPTY" box, right side)
  // Address zone: x=1314..2775, y=1049..1875 (user-measured)
  const ADDR_X = 1314, ADDR_Y = 1049, ADDR_W = 1461, ADDR_H = 826;

  // Postage / indicia zone (top-right grey box)
  // Postage/indicia zone: Lob spec 1.5"x1.25" flush top-right corner
  const POST_X = 2325, POST_Y = 0, POST_W = 450, POST_H = 375;

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1. Draw uploaded back image (cover-fit to fill canvas)
  const backImg = await loadImg(backImageSrc);
  if (backImg) {
    const scale = Math.max(W / backImg.width, H / backImg.height);
    const dw = Math.round(backImg.width * scale);
    const dh = Math.round(backImg.height * scale);
    const dx = Math.round((W - dw) / 2);
    const dy = Math.round((H - dh) / 2);
    ctx.drawImage(backImg, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. White out address zone
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ADDR_X, ADDR_Y, ADDR_W, ADDR_H);

  // 3. White out postage/indicia zone
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(POST_X, POST_Y, POST_W, POST_H);

  // 4. White out QR zone and draw QR code
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(QR_X, QR_Y, QR_W, QR_H);

  const bookingUrl = cfg.bookingUrl || 'https://biddrop.us';
  const qrApiUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=4&data=' + encodeURIComponent(bookingUrl);
  const qrImg = await loadImg(qrApiUrl);
  if (qrImg) {
    // Draw QR with small padding inside the white box
    const pad = 20;
    ctx.drawImage(qrImg, QR_X + pad, QR_Y + pad, QR_W - pad*2, QR_H - pad*2);
    // "SCAN TO BOOK" label below QR
    const scanCta = cfg.postcardScanCta || 'SCAN TO BOOK';
    const scanSub = cfg.postcardScanSub || 'No-pressure booking';
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.fillText(scanCta, QR_X, QR_Y + QR_H + 40);
    ctx.font = '24px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(scanSub, QR_X, QR_Y + QR_H + 72);
  }

  return canvas.toDataURL('image/jpeg', 0.92);
}
