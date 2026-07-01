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
    postcardHeadline1:v('s-pc-headline1')||'We Assessed',
    postcardHeadline2:v('s-pc-headline2')||'Your Roof.',
    postcardBadgeText:v('s-pc-badge-text')||'YOUR ROOF ESTIMATE IS READY',
    postcardBadgeColor:v('s-pc-badge-color')||S.cfg?.brandColor||'#F25C05',
    postcardBackBadgeText:v('s-pc-back-badge-text')||'YOUR ROOF ESTIMATE IS READY',
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
  const hl1Txt=cfg.postcardHeadline1||'We Assessed';
  const hl2Txt=cfg.postcardHeadline2||'Your Roof.';
  const badgeTxtCfg=cfg.postcardBadgeText||'YOUR ROOF ESTIMATE IS READY';
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
  // Badge pill
  ctx.font='bold 42px Arial';
  const btw=ctx.measureText(badgeTxtCfg).width;
  const bx=W-PAD-btw-56,by=topY,bw=btw+56,bh=72,br=36;
  ctx.fillStyle=badgeColorCfg;
  roundRect(ctx,bx,by,bw,bh,br);ctx.fill();
  ctx.fillStyle='#fff';ctx.textBaseline='middle';
  ctx.fillText(badgeTxtCfg,bx+28,by+bh/2);
  ctx.textBaseline='alphabetic';
  // HEADLINE (bottom-left area)
  ctx.fillStyle='#fff';
  ctx.font='bold '+hl1Size+'px Arial';
  const hl1Y=H-(showPrice?530:420);
  ctx.fillText(hl1Txt,PAD,hl1Y);
  ctx.font='bold '+hl2Size+'px Arial';
  ctx.fillText(hl2Txt,PAD,hl1Y+hl2Size+20);
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
  const hook=cfg.postcardHook||'Most homeowners dread the pushy roofing salesman. I do things differently \u2014 I lead with my price, no pressure, no games. Your estimate is ready.';
  const why=cfg.postcardWhy||'We assessed your neighborhood and identified your home as a candidate for roof replacement. We look for things like missing shingles, moss, algae, buckling, granule loss, and age. The average roof lasts 18\u201320 years.';
  const pcQuote=cfg.postcardQuote||'"They replaced our roof in one day, no mess, no drama." \u2014 Mike D., Canton MI';
  const guarantee=cfg.postcardGuarantee||'No door-knocking. No pressure. Just your price.';
  const badges=[cfg.diff1||'Licensed, Bonded & Insured',cfg.diff2||'Manufacturer Certified',cfg.diff3||'Itemized Pricing'].filter(Boolean).slice(0,3);
  // Designer font sizes
  const backBadgeTxt=cfg.postcardBackBadgeText||'YOUR ROOF ESTIMATE IS READY';
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

  // Badge pill
  ctx.font='bold 36px Arial';
  const pillLabel=backBadgeTxt;
  const pillW=ctx.measureText(pillLabel).width+48;
  ctx.fillStyle=backBadgeColor;
  roundRect(ctx,HR_X,hy,pillW,60,10);ctx.fill();
  ctx.fillStyle='#fff';ctx.fillText(pillLabel,HR_X+24,hy+42);
  hy+=80;
  // Hook quote
  const hookLineH=Math.round(hookSize*1.38);
  ctx.font='italic '+hookSize+'px Georgia, serif';ctx.fillStyle='rgba(255,255,255,0.88)';
  const hookLines=wrapText(ctx,hook,HR_W);
  hookLines.slice(0,3).forEach((l,i)=>{ctx.fillText(l,HR_X,hy+hookSize+i*hookLineH);});
  hy+=Math.min(hookLines.length,3)*hookLineH+28;;

  // Price bar
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

  // Stars + review
  ctx.font='46px Arial';ctx.fillStyle='#f59e0b';
  ctx.fillText('\u2605\u2605\u2605\u2605\u2605',HR_X,hy+46);hy+=64;
  if(pcQuote){
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

  // WHY DID YOU RECEIVE THIS?
  ctx.font='bold 34px Arial';ctx.fillStyle=color;
  ctx.fillText('WHY DID YOU RECEIVE THIS?',SAFE,by+34);by+=52;
  const whyLineH=Math.round(whySize*1.4);
  ctx.font=whySize+'px Arial';ctx.fillStyle='#374151';
  const whyLines=wrapText(ctx,why,LEFT_COL_W-SAFE);
  whyLines.slice(0,4).forEach((l,i)=>{ctx.fillText(l,SAFE,by+whySize+i*whyLineH);});
  by+=Math.min(whyLines.length,4)*whyLineH+24;

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
  // Guarantee — clamp to RIGHT_COL_W so it never bleeds into Lob address zone
  if(ry2+50 < BOTTOM_SAFE){
    const gLineH=Math.round(guarSize*1.4);
    ctx.font='bold '+guarSize+'px Arial';ctx.fillStyle=color;
    const gLines=wrapText(ctx,guarantee,RIGHT_COL_W);
    gLines.forEach((l,i)=>{
      const lineY=ry2+guarSize+i*gLineH;
      if(lineY < BOTTOM_SAFE){ctx.fillText(l,RIGHT_COL_X,lineY);}
    });
  }
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
<div class="hl">We Assessed<br>Your Roof.</div>
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
  const hook=cfg.postcardHook||'I lead with my price — no pressure, no games. Your estimate is ready.';
  const why=cfg.postcardWhy||'We assessed your neighborhood and identified your home as a candidate for roof replacement based on age, condition, and storm history.';
  const pcQuote=cfg.postcardQuote||'';
  const guarantee=cfg.postcardGuarantee||'No door-knocking. No pressure. Just your price.';
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
.why{font-size:8.5px;color:#444;line-height:1.4;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
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
.gt{font-size:7.5px;font-weight:700;color:#555;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
<div class="wh">Why Did You Receive This?</div>
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
<div><div class="phl">&#128222; ${escHtml(ph)}</div>${guarantee?`<div class="gt">${escHtml(guarantee)}</div>`:''}</div>
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
  const cfg    = S.cfg;
  const owner  = item.owner || 'Homeowner';
  const addr   = item.addr  || '';
  const co     = cfg.companyName   || 'Your Roofing Co';
  const coAddr = cfg.companyAddr   || '';
  const ph     = cfg.companyPhone  || '(000) 000-0000';
  const color  = cfg.brandColor    || '#F25C05';
  const rep    = cfg.repName       || co;
  const repTitle= cfg.repTitle     || '';
  const hsPos  = cfg.headshotPos   || '30';
  const lic    = cfg.licenseNum    || '';
  const yrs    = cfg.yearsInBusiness || '5+';
  const warr   = cfg.warrantyYears || '10';
  const hook   = cfg.hookLetter    || 'Most homeowners are tired of door-knockers, pushy salespeople, and high prices when it comes to getting a new roof. I skip the hassle and lead with my price.';
  const why    = cfg.whyReceived   || 'We assessed your neighborhood and identified your home as a candidate for roof replacement. We look for things like missing shingles, moss, algae, buckling, and granule loss.';

  // Financing
  const finEnabled = cfg.financingEnabled !== false;
  const finApr  = parseFloat(cfg.financingApr)  || 9.99;
  const finTerm = parseInt(cfg.financingTerm)   || 60;
  const finDown = parseFloat(cfg.financingDown) || 0;
  function calcMo(total){
    const loan = total * (1 - finDown/100);
    if(!loan) return 0;
    const r = finApr / 100 / 12;
    if(r === 0) return Math.round(loan / finTerm);
    return Math.round(loan * r * Math.pow(1+r,finTerm) / (Math.pow(1+r,finTerm)-1));
  }

  // Images — use stored URLs/base64 from item + cfg
  const homePhotoSrc = item.photo_url || item.photo_data || null;
  const dmgPhotos    = Array.isArray(item.damage_photos) ? item.damage_photos : [];
  const headshot     = cfg.headshot  || null;
  const review1      = cfg.review1   || null;
  const review2      = cfg.review2   || null;
  const bookingUrl   = cfg.bookingUrl || '';
  // QR: always point to homeowner estimate page; fall back to booking URL if no ID
  const _lobEstId = item.estId || item.estimate_id || null;
  const _lobSlug = cfg.companyName ? cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') : 'roofing';
  const _lobEstUrl = _lobEstId
    ? 'https://biddrop.us/'+_lobSlug+'/'+encodeURIComponent(_lobEstId)
    : (bookingUrl || 'https://biddrop.us');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=6&data='+encodeURIComponent(_lobEstUrl);

  // Logo
  const logoImg = cfg.logoData
    ? '<img src="'+cfg.logoData+'" style="max-height:46px;max-width:150px;object-fit:contain;display:block;">'
    : '<div style="font-family:Oswald,sans-serif;font-size:20px;font-weight:700;color:'+color+';">'+escHtml(co)+'</div>';

  // Structures & totals
  const iStructures = Array.isArray(item.structures) ? item.structures : [];
  let grandTotal = item.total || 0;
  let structSectionsP2 = '';
  if(iStructures.length){
    iStructures.forEach((s,i)=>{
      const sp = calcStructPrice ? calcStructPrice(s) : (s.price||0);
      const sq = ((parseFloat(s.sqft)||0)/100*1.12*(parseFloat(s.pitch)||1.118)).toFixed(1);
      const col = i===0 ? color : '#444';
      structSectionsP2 +=
        '<div style="border:2px solid '+col+';border-radius:6px;overflow:hidden;margin-bottom:10px;">'+
        '<div style="padding:7px 14px;background:'+col+';font-family:Oswald,sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#fff;">'+escHtml((s.name||'Structure '+(i+1)).toUpperCase())+'</div>'+
        '<div style="background:#f8f8f8;">'+
        '<div style="display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #eee;font-size:10px;"><span style="color:#555;">Roof Area</span><span style="font-weight:600;color:#1a1a1a;">'+(s.sqft?Number(s.sqft).toLocaleString()+' sq ft':'—')+' ('+sq+' sq)</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #eee;font-size:10px;"><span style="color:#555;">Pitch</span><span style="font-weight:600;color:#1a1a1a;">'+(PITCHLBL[s.pitch]||s.pitch)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #eee;font-size:10px;"><span style="color:#555;">Material</span><span style="font-weight:600;color:#1a1a1a;">'+(MATLBL[s.mat]||s.mat)+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #eee;font-size:10px;"><span style="color:#555;">Stories</span><span style="font-weight:600;color:#1a1a1a;">'+s.stories+'</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #eee;font-size:10px;"><span style="color:#555;">Tear-off &amp; Disposal</span><span style="font-weight:600;color:#1a1a1a;">Included</span></div>'+
        '<div style="display:flex;justify-content:space-between;padding:5px 14px;font-size:10px;"><span style="color:#555;">Felt / Synthetic Underlayment</span><span style="font-weight:600;color:#1a1a1a;">Included</span></div>'+
        '</div>'+
        '<div style="display:flex;justify-content:space-between;padding:8px 14px;background:'+col+';color:#fff;">'+
        '<span style="font-family:Oswald,sans-serif;font-size:11px;font-weight:600;letter-spacing:.5px;">'+escHtml((s.name||'Structure').toUpperCase())+' SUBTOTAL</span>'+
        '<span style="font-family:Oswald,sans-serif;font-size:15px;font-weight:700;">$'+sp.toLocaleString()+'</span>'+
        '</div></div>';
    });
  } else {
    structSectionsP2='<div style="padding:20px;text-align:center;color:#999;font-style:italic;">No structures added.</div>';
  }

  const finMo  = (finEnabled && grandTotal) ? calcMo(grandTotal) : 0;
  const finTrm = finApr+'% APR · '+finTerm+' mo · $0 down';
  const finDisc = 'Financing estimate based on '+finApr+'% APR, '+finTerm+'-month term, subject to credit approval.';

  // Differentiators
  const diffs = [
    cfg.diff1||'Licensed, Bonded & Insured',
    cfg.diff2||'Manufacturer Certified',
    cfg.diff3||'Itemized Pricing for Transparency',
    cfg.diff4||'Workmanship Warranty',
    cfg.diff5||'Financing Available',
    cfg.diff6||'Local Crews'
  ].filter(d=>d.trim());
  const competitorNegs = ['Insufficient','Rarely','No','State Minimum','No','Outside Crews'];

  // Services (page 4)
  const svcDefs = [];
  if(cfg.offerSiding)  svcDefs.push({icon:'🏠',name:'SIDING',bullets:['James Hardie Install','30 Year Warranty','Fiber Cement Strength']});
  if(cfg.offerWindows) svcDefs.push({icon:'🪟',name:'WINDOWS',bullets:['Energy Efficient','100% Virgin Vinyl','Low-E Glass']});
  if(cfg.offerGutters) svcDefs.push({icon:'🌊',name:'GUTTERS',bullets:['Seamless Gutters','Hidden Fasteners','Rust-Free Aluminum']});
  if(cfg.offerCustom&&cfg.offerCustom.trim()) svcDefs.push({icon:'⭐',name:cfg.offerCustom.toUpperCase(),bullets:[]});
  const servicesHtml = svcDefs.length
    ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0;">'+
        svcDefs.map(s=>
          '<div style="display:inline-flex;align-items:center;gap:5px;border:1.5px solid '+color+'33;border-radius:20px;padding:4px 10px;">'+
          '<span style="font-size:13px;line-height:1;">'+s.icon+'</span>'+
          '<span style="font-family:Oswald,sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;color:'+color+';">'+escHtml(s.name)+'</span>'+
          '</div>'
        ).join('')+
      '</div>'
    : '';

  const refAmt  = cfg.referralAmt  || '250';
  const refText = cfg.referralText || "For every customer you send our way who moves forward with a project, we'll send you a Visa gift card as a thank you.";

  // Damage photos section
  const hasPhotos = dmgPhotos.length > 0;
  const damageMailerSection = hasPhotos
    ? '<div style="margin:14px 0;padding:10px;background:#f9f9f9;border-radius:6px;border:1px solid #e8e8e8;">'+
        '<div style="font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:'+color+';margin-bottom:8px;">DAMAGE ASSESSMENT PHOTOS</div>'+
        '<div style="display:grid;grid-template-columns:repeat('+Math.min(dmgPhotos.length,3)+',1fr);gap:6px;">'+
        dmgPhotos.slice(0,3).map(src=>'<img src="'+src+'" style="width:100%;height:100px;object-fit:cover;border-radius:4px;display:block;">').join('')+
        '</div></div>'
    : '';

  // Shared helpers
  function pageHdr(n){
    return '<div style="padding:14px 24px;display:flex;justify-content:space-between;align-items:flex-start;">'+
      '<div>'+logoImg+'<div style="font-size:10px;color:#666;margin-top:3px;line-height:1.6;">'+escHtml(coAddr).replace(/,/g,'<br>')+'<br>'+escHtml(ph)+(lic?'<br>'+escHtml(lic):'')+'</div></div>'+
      '<div style="text-align:right;font-size:11px;color:#444;line-height:1.8;"><strong>'+escHtml(owner)+'</strong><br>'+escHtml(addr).split(',').join('<br>')+'<br><span style="font-size:9px;color:#aaa;margin-top:3px;display:block;">Page '+n+' of 4</span></div>'+
      '</div>'+
      '<div style="height:5px;background:'+color+';"></div>';
  }
  function pageFooter(){
    return '<div style="padding:7px 24px;border-top:1px solid #eee;font-size:9px;color:#aaa;line-height:1.6;text-align:center;">'+
      escHtml(co)+' · '+escHtml(ph)+(lic?' · '+escHtml(lic):'')+' · Licensed &amp; Insured · '+new Date().getFullYear()+
      '</div>';
  }

  // CTA band
  const ctaBand =
    '<div style="background:#1a1a1a;display:flex;align-items:center;gap:0;">'+
    '<div style="flex:1;padding:11px 18px;border-right:1px solid rgba(255,255,255,.1);">'+
    '<div style="font-size:8px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:2px;">Call or Text to Schedule</div>'+
    '<div style="font-family:Oswald,sans-serif;font-size:26px;font-weight:700;color:#fff;white-space:nowrap;line-height:1;">'+escHtml(ph)+'</div>'+
    '<div style="font-size:9px;color:rgba(255,255,255,.4);margin-top:3px;">Estimate locked 30 days &nbsp;·&nbsp; No door-knock &nbsp;·&nbsp; No pressure</div>'+
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

  // ── PAGE 1 — Hook + Price ──────────────────────────────────────────────
  const page1 =
    '<div style="background:#fff;overflow:hidden;width:7.5in;min-height:10in;max-height:10in;box-sizing:border-box;page-break-after:always;">'+
    pageHdr(1)+
    '<div style="padding:16px 24px;">'+
    '<div style="display:table;width:100%;border-collapse:separate;border-spacing:12px 0;margin:0 -12px 10px;">'+
    '<div style="display:table-cell;width:160px;vertical-align:top;">'+
    (homePhotoSrc
      ? '<div style="width:160px;height:130px;border-radius:6px;overflow:hidden;border:1px solid #e8e8e8;">'+
        '<img src="'+homePhotoSrc+'" style="width:100%;height:100%;object-fit:cover;display:block;">'+
        '</div>'
      : '<div style="width:160px;height:130px;border-radius:6px;border:1px dashed #ddd;"></div>'
    )+
    '</div>'+
    '<div style="display:table-cell;vertical-align:top;">'+
    '<div style="font-size:13px;margin-bottom:7px;color:#2a2a2a;">Dear '+escHtml(owner)+',</div>'+
    '<p style="font-size:11px;line-height:1.6;color:#333;margin:5px 0 0;">'+escHtml(_tradeHook||hook)+'</p>'+
    '</div>'+
    '</div>'+
    '<div style="display:table;width:100%;border-collapse:separate;border-spacing:10px 0;margin:0 -10px;">'+
    '<div style="display:table-cell;width:50%;vertical-align:top;">'+
    '<div style="font-weight:700;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#fff;padding:5px 11px;border-radius:4px;margin:10px 0 6px;display:block;background:'+color+';">Why Did You Receive This?</div>'+
    '<p style="font-size:10px;line-height:1.6;color:#555;margin:4px 0 0;">'+escHtml(_tradeWhy||why)+'</p>'+damageMailerSection+
    '</div>'+
    '<div style="display:table-cell;width:50%;vertical-align:top;">'+
    '<div style="font-weight:700;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#fff;padding:5px 11px;border-radius:4px;margin:10px 0 6px;display:block;background:#222;">How We Stand Out</div>'+
    '<ul style="list-style:none;margin:4px 0 0;padding:0;">'+
    diffs.map(d=>'<li style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:11px;color:#333;"><span style="font-size:14px;flex-shrink:0;margin-top:1px;color:'+color+';">✓</span><span>'+escHtml(d)+'</span></li>').join('')+
    '</ul>'+
    '</div>'+
    '</div>'+
    (headshot
      ? '<div style="position:relative;overflow:hidden;background:'+color+';padding:18px 20px;">'+
        '<svg style="position:absolute;right:0;top:0;width:55%;height:100%;opacity:.08;" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice">'+
        '<polygon points="0,0 200,0 200,120" fill="#fff"/>'+
        '<circle cx="160" cy="20" r="70" fill="none" stroke="#fff" stroke-width="18"/>'+
        '</svg>'+
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
        '<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">'+
        '<div style="width:80px;height:80px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,.9);">'+
        '<img src="'+headshot+'" style="width:100%;height:100%;object-fit:cover;object-position:center '+hsPos+'%;">'+
        '</div>'+
        '<div style="text-align:center;">'+
        '<div style="font-family:Oswald,sans-serif;font-size:12px;font-weight:700;color:#fff;letter-spacing:.3px;">'+escHtml(rep)+'</div>'+
        (repTitle?'<div style="font-size:8px;color:rgba(255,255,255,.7);letter-spacing:.6px;text-transform:uppercase;">'+escHtml(repTitle)+'</div>':'')+
        '</div>'+
        '</div>'+
        '</div>'+
        '</div>'+ctaBand
      : '<div style="position:relative;overflow:hidden;background:'+color+';padding:18px 20px;">'+
        '<div style="position:relative;z-index:1;">'+
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
        '</div>'+ctaBand
    )+
    '</div>'+
    (finMo?'<div style="padding:5px 24px 0;font-size:8px;color:#aaa;font-style:italic;">'+finDisc+'</div>':'')+
    pageFooter()+
    '</div>';

  // ── PAGE 2 — Estimate Detail ───────────────────────────────────────────
  const page2 =
    '<div style="background:#fff;overflow:hidden;width:7.5in;min-height:10in;max-height:10in;box-sizing:border-box;page-break-after:always;">'+
    pageHdr(2)+
    '<div style="padding:16px 24px;">'+
    '<div style="font-family:Oswald,sans-serif;font-size:18px;font-weight:700;letter-spacing:.5px;margin-bottom:2px;color:#1a1a1a;">ROOF ESTIMATE</div>'+
    '<div style="font-size:10px;color:#888;margin-bottom:10px;">Detailed breakdown for '+escHtml(addr)+'</div>'+
    structSectionsP2+
    '<div style="display:flex;justify-content:space-between;padding:10px 16px;background:#1a1a1a;color:#fff;border-radius:6px;margin-top:8px;">'+
    '<span style="font-family:Oswald,sans-serif;font-size:13px;font-weight:600;letter-spacing:.5px;">TOTAL INVESTMENT</span>'+
    '<span style="font-family:Oswald,sans-serif;font-size:22px;font-weight:700;">$'+(grandTotal?grandTotal.toLocaleString():'0')+'</span>'+
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

  // ── PAGE 3 — The Company Difference ───────────────────────────────────
  const compareRows = diffs.map((d,i)=>{
    const neg = competitorNegs[i] || 'Rarely';
    return '<tr>'+
      '<td style="font-weight:600;color:#333;width:42%;padding:6px 10px;border-bottom:1px solid #eee;">'+escHtml(d)+'</td>'+
      '<td style="text-align:center;color:#fff;font-weight:700;background:'+color+';padding:6px 10px;border-bottom:1px solid #eee;">✓</td>'+
      '<td style="text-align:center;color:#999;font-style:italic;padding:6px 10px;border-bottom:1px solid #eee;">'+escHtml(neg)+'</td>'+
      '</tr>';
  });
  const staticRows = [
    ['Years in Business', yrs, '1–2 Years'],
    ['Workmanship Warranty', warr+' Years', 'State Minimum'],
  ].map(([feat,us,them])=>
    '<tr>'+
    '<td style="font-weight:600;color:#333;width:42%;padding:6px 10px;border-bottom:1px solid #eee;">'+escHtml(feat)+'</td>'+
    '<td style="text-align:center;color:#fff;font-weight:700;background:'+color+';padding:6px 10px;border-bottom:1px solid #eee;">'+escHtml(us)+'</td>'+
    '<td style="text-align:center;color:#999;font-style:italic;padding:6px 10px;border-bottom:1px solid #eee;">'+escHtml(them)+'</td>'+
    '</tr>'
  );
  const page3 =
    '<div style="background:#fff;overflow:hidden;width:7.5in;min-height:10in;max-height:10in;box-sizing:border-box;page-break-after:always;">'+
    '<div style="padding:16px 24px;text-align:center;background:'+color+';">'+
    '<div style="font-family:Oswald,sans-serif;font-size:22px;font-weight:700;color:#fff;letter-spacing:1px;">THE '+escHtml(co.toUpperCase())+' DIFFERENCE</div>'+
    '<div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:4px;">We protect what matters most. Selecting the right contractor is crucial.</div>'+
    '</div>'+
    '<div style="padding:16px 24px;">'+
    '<p style="font-size:10px;line-height:1.6;color:#555;margin-bottom:10px;">Your roof is one of the most important investments you\'ll make for your home and family. It\'s important to us that your questions are answered and that you have all the information necessary to make the best decision.</p>'+
    '<table style="width:100%;border-collapse:collapse;font-size:11px;">'+
    '<thead><tr>'+
    '<th style="text-align:left;background:#f8f8f8;color:#777;padding:6px 10px;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.6px;text-transform:uppercase;"></th>'+
    '<th style="background:'+color+';color:#fff;border-radius:4px 4px 0 0;padding:6px 10px;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.6px;text-transform:uppercase;">'+escHtml(co)+'</th>'+
    '<th style="background:#eee;color:#888;padding:6px 10px;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.6px;text-transform:uppercase;">Typical Contractor</th>'+
    '</tr></thead>'+
    '<tbody>'+staticRows.join('')+compareRows.join('')+'</tbody>'+
    '</table>'+
    '</div>'+
    pageFooter()+
    '</div>';

  // ── PAGE 4 — We Also Offer + Referral ─────────────────────────────────
  const page4 =
    '<div style="background:#fff;overflow:hidden;width:7.5in;min-height:10in;max-height:10in;box-sizing:border-box;page-break-after:avoid;">'+
    pageHdr(4)+
    '<div style="padding:16px 24px;">'+
    (svcDefs.length>0
      ? '<div style="font-family:Oswald,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#999;margin-bottom:4px;">WE ALSO OFFER</div>'+servicesHtml
      : '')+
    ((review1||review2)
      ? '<div style="margin-top:16px;">'+
        '<div style="font-weight:700;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#fff;padding:5px 11px;border-radius:4px;margin:10px 0 6px;display:block;background:#1a1a1a;">What Our Customers Say</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0 0;">'+
        (review1?'<img src="'+review1+'" style="width:100%;border-radius:8px;display:block;" alt="Customer Review">':'<div style="border:2px dashed #e0e0e0;border-radius:8px;padding:20px;text-align:center;color:#ccc;font-size:11px;font-style:italic;">Review image 1</div>')+
        (review2?'<img src="'+review2+'" style="width:100%;border-radius:8px;display:block;" alt="Customer Review">':'<div style="border:2px dashed #e0e0e0;border-radius:8px;padding:20px;text-align:center;color:#ccc;font-size:11px;font-style:italic;">Review image 2</div>')+
        '</div>'+
        '</div>'
      : ''
    )+
    '<div style="margin-top:'+(svcDefs.length||review1||review2?'10':'0')+'px;">'+
    '<div style="font-weight:700;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#fff;padding:5px 11px;border-radius:4px;margin:10px 0 6px;display:block;background:'+color+';">Referral Program</div>'+
    '<div style="border-radius:8px;padding:12px;margin-top:10px;display:flex;gap:12px;align-items:flex-start;background:#f8f8f8;border:2px solid '+color+'22;">'+
    '<div style="width:78px;height:60px;background:linear-gradient(135deg,#1a5276,#2e86c1);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-family:Oswald,sans-serif;font-size:11px;font-weight:700;text-align:center;line-height:1.3;letter-spacing:.3px;"><div style="font-size:20px;">$'+escHtml(refAmt)+'</div>VISA GIFT CARD</div>'+
    '<div>'+
    '<div style="font-family:Oswald,sans-serif;font-size:16px;font-weight:700;margin-bottom:5px;">Share &amp; Get Rewarded</div>'+
    '<div style="font-size:11px;color:#555;line-height:1.6;">'+escHtml(refText)+'</div>'+
    '<div style="margin-top:8px;font-size:11px;font-weight:700;color:'+color+';">Call '+escHtml(ph)+' and mention this mailer</div>'+
    '</div></div></div>'+
    '</div>'+
    pageFooter()+
    '</div>';

  // ── Assemble full Lob HTML document ───────────────────────────────────
  const mailerCss = `
    *{margin:0;padding:0;box-sizing:border-box;}
    @page{size:letter;margin:0;}
    body{background:#fff;font-family:'Barlow',Helvetica,Arial,sans-serif;color:#1a1a1a;}
    .lob-wrap{width:7.5in;margin:0 auto;}
  `;

  return '<!DOCTYPE html><html><head><meta charset="UTF-8">'+
    '<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow:wght@300;400;500;600;700&display=swap" rel="stylesheet">'+
    '<style>'+mailerCss+'</style>'+
    '</head><body>'+
    '<div class="lob-wrap">'+page1+page2+page3+page4+'</div>'+
    '</body></html>';
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
  const backBadgeTxt   = ov('postcardBackBadgeText')  || 'YOUR ROOF ESTIMATE IS READY';
  const backBadgeColor = ov('postcardBackBadgeColor') || color;
  const hook           = ov('postcardHook')           || 'Most homeowners dread the pushy roofing salesman. I do things differently \u2014 I lead with my price, no pressure, no games. Your estimate is ready.';
  const why            = ov('postcardWhy')            || 'We assessed your neighborhood and identified your home as a candidate for roof replacement. We look for things like missing shingles, moss, algae, buckling, granule loss, and age. The average roof lasts 18\u201320 years.';
  const pcQuote        = ov('postcardQuote')          || '"They replaced our roof in one day, no mess, no drama." \u2014 Mike D., Canton MI';
  const guarantee      = ov('postcardGuarantee')      || 'No door-knocking. No pressure. Just your price.';
  const scanCta        = ov('postcardScanCta')        || 'SCAN TO BOOK';
  const scanSub        = ov('postcardScanSub')        || 'No-pressure booking';
  const whyLabel       = ov('postcardWhyLabel')       || 'WHY DID YOU RECEIVE THIS?';
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
  ctx.font = 'bold 36px Arial';
  const pillW = ctx.measureText(backBadgeTxt).width + 48;
  ctx.fillStyle = backBadgeColor; roundRect(ctx, HR_X, hy, pillW, 60, 10); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillText(backBadgeTxt, HR_X + 24, hy + 42); hy += 80;
  const hookLineH = Math.round(hookSize * 1.38);
  ctx.font = 'italic ' + hookSize + 'px Georgia, serif'; ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const hookLines = wrapText(ctx, hook, HR_W);
  hookLines.slice(0, 3).forEach((l, i) => { ctx.fillText(l, HR_X, hy + hookSize + i * hookLineH); });
  hy += Math.min(hookLines.length, 3) * hookLineH + 28;
  ctx.font = '46px Arial'; ctx.fillStyle = '#f59e0b';
  ctx.fillText('\u2605\u2605\u2605\u2605\u2605', HR_X, hy + 46); hy += 64;
  if(pcQuote){
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
  whyLines.slice(0, 4).forEach((l, i) => { ctx.fillText(l, SAFE, by + whySize + i * whyLineH); });
  by += Math.min(whyLines.length, 4) * whyLineH + 24;
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
  if(ry2 + 50 < BOTTOM_SAFE){
    const gLineH = Math.round(guarSize * 1.4);
    ctx.font = 'bold ' + guarSize + 'px Arial'; ctx.fillStyle = color;
    const gLines = wrapText(ctx, guarantee, RIGHT_COL_W);
    gLines.forEach((l, i) => {
      const lineY = ry2 + guarSize + i * gLineH;
      if(lineY < BOTTOM_SAFE){ ctx.fillText(l, RIGHT_COL_X, lineY); }
    });
  }
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
  const ADDR_X = 970, ADDR_Y = 937, ADDR_W = 1707, ADDR_H = 689;

  // Postage / indicia zone (top-right grey box)
  const POST_X = 2083, POST_Y = 0, POST_W = 691, POST_H = 466;

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
