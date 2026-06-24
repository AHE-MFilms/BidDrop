// BidDrop — Postcard Templates T3–T6 (trade-specific front canvas renderers)
// Appended to postcard-render.js at build time; all functions are global.
// All templates: 2775×1875px at 300dpi, pull brand from S.cfg

// ── TEMPLATE 3: Storm / Wind Damage ──────────────────────────────────────────
// Layout: Full-bleed roof photo | Dark overlay | Brand-color diagonal slash
// Bottom bar: white left (logo+address) | brand-color right (phone+CTA)
async function renderPostcard6x9FrontCanvasT3(item){
  const cfg=S.cfg||{};
  const W=2775,H=1875,PAD=110;
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||'(000) 000-0000';
  const site=cfg.website||'';
  const color=cfg.brandColor||'#F25C05';
  const logoUrl=(cfg.logoData&&cfg.logoData.startsWith('http'))?cfg.logoData:null;
  const housePhotoUrl=item.photo_url||(item.all_photos&&item.all_photos[0])||null;
  const hl1=cfg.postcardT3Headline1||'YOU HAVE';
  const hl2=cfg.postcardT3Headline2||'WIND DAMAGE';
  const sub=cfg.postcardT3Sub||'Should you make a claim?';
  const cta=cfg.postcardT3Cta||'Call for an in-depth analysis.';
  const addrLine=(item.addr||'').split(',').slice(0,2).join(',');
  const [houseImg,logoImg]=await Promise.all([loadImg(housePhotoUrl),loadImg(logoUrl)]);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  // Background photo
  if(houseImg){
    const scale=Math.max(W/houseImg.width,H/houseImg.height);
    const sw=houseImg.width*scale,sh=houseImg.height*scale;
    ctx.drawImage(houseImg,(W-sw)/2,(H-sh)/2,sw,sh);
  } else { ctx.fillStyle='#2a3a4a';ctx.fillRect(0,0,W,H); }
  // Dark overlay top 70%
  const grad=ctx.createLinearGradient(0,0,0,H*0.75);
  grad.addColorStop(0,'rgba(10,15,25,0.85)');
  grad.addColorStop(1,'rgba(10,15,25,0.10)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
  // Brand-color diagonal slash accent bar
  const slashY=Math.round(H*0.20);
  ctx.save();
  ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(0,slashY);ctx.lineTo(W*0.60,slashY);
  ctx.lineTo(W*0.60+100,slashY+100);ctx.lineTo(0,slashY+100);
  ctx.closePath();ctx.fill();
  ctx.restore();
  // Sub text on slash
  ctx.fillStyle='#fff';ctx.font='bold 62px Arial';ctx.textBaseline='middle';
  ctx.fillText(sub,PAD,slashY+50);ctx.textBaseline='alphabetic';
  // Headline above slash
  ctx.fillStyle='rgba(255,255,255,0.88)';ctx.font='bold 140px Arial';
  ctx.fillText(hl1,PAD,slashY-30);
  // Big headline below slash
  ctx.fillStyle='#fff';ctx.font='italic bold 310px Arial';
  ctx.fillText(hl2,PAD,slashY+100+320);
  // CTA line
  ctx.fillStyle='rgba(255,255,255,0.78)';ctx.font='68px Arial';
  ctx.fillText(cta,PAD,slashY+100+320+90);
  // Bottom bar
  const BAR_H=270,BAR_Y=H-BAR_H,SPLIT=Math.round(W*0.42);
  ctx.fillStyle='#fff';ctx.fillRect(0,BAR_Y,SPLIT,BAR_H);
  ctx.fillStyle=color;ctx.fillRect(SPLIT,BAR_Y,W-SPLIT,BAR_H);
  if(logoImg){
    const lh=Math.min(160,logoImg.height);const lw=Math.round(logoImg.width*(lh/logoImg.height));
    ctx.drawImage(logoImg,PAD,BAR_Y+(BAR_H-lh)/2,lw,lh);
  } else {
    ctx.fillStyle='#1a1a1a';ctx.font='bold 80px Arial';ctx.textBaseline='middle';
    ctx.fillText(co,PAD,BAR_Y+BAR_H/2);ctx.textBaseline='alphabetic';
  }
  ctx.fillStyle='#666';ctx.font='52px Arial';
  ctx.fillText(addrLine,PAD,BAR_Y+BAR_H-28);
  const ctaX=SPLIT+80;
  ctx.fillStyle='#fff';ctx.font='bold 56px Arial';
  ctx.fillText('Call '+co,ctaX,BAR_Y+90);
  ctx.font='bold 150px Arial';
  ctx.fillText(ph,ctaX,BAR_Y+BAR_H-28);
  if(site){ctx.font='52px Arial';ctx.fillStyle='rgba(255,255,255,0.82)';ctx.fillText(site,ctaX,BAR_Y+BAR_H+60);}
  return canvas.toDataURL('image/jpeg',0.92);
}

// ── TEMPLATE 4: Solar ─────────────────────────────────────────────────────────
// Layout: Left dark-navy panel (headline + bullets) | Right: house photo
// Yellow sun accent | Bottom bar: logo left | phone+CTA right
async function renderPostcard6x9FrontCanvasT4(item){
  const cfg=S.cfg||{};
  const W=2775,H=1875,PAD=110;
  const co=cfg.companyName||'Your Solar Co';
  const ph=cfg.companyPhone||'(000) 000-0000';
  const color=cfg.brandColor||'#F25C05';
  const logoUrl=(cfg.logoData&&cfg.logoData.startsWith('http'))?cfg.logoData:null;
  const housePhotoUrl=item.photo_url||(item.all_photos&&item.all_photos[0])||null;
  const hl1=cfg.postcardT4Headline1||'YOUR HOME IS';
  const hl2=cfg.postcardT4Headline2||'SOLAR READY';
  const accent=cfg.postcardT4Accent||'SAVE UP TO 80%';
  const sub=cfg.postcardT4Sub||'on your electric bill with solar';
  const cta=cfg.postcardT4Cta||'FREE Solar Assessment';
  const b1=cfg.postcardT4Bullet1||'No upfront cost options';
  const b2=cfg.postcardT4Bullet2||'Federal tax credit eligible';
  const b3=cfg.postcardT4Bullet3||'30-year panel warranty';
  const [houseImg,logoImg]=await Promise.all([loadImg(housePhotoUrl),loadImg(logoUrl)]);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  const LEFT_W=Math.round(W*0.46);
  const BOTTOM_BAR_H=280,MAIN_H=H-BOTTOM_BAR_H;
  if(houseImg){
    const scale=Math.max((W-LEFT_W)/houseImg.width,MAIN_H/houseImg.height);
    const sw=houseImg.width*scale,sh=houseImg.height*scale;
    ctx.save();ctx.beginPath();ctx.rect(LEFT_W,0,W-LEFT_W,MAIN_H);ctx.clip();
    ctx.drawImage(houseImg,LEFT_W+(W-LEFT_W-sw)/2,(MAIN_H-sh)/2,sw,sh);
    ctx.restore();
  } else { ctx.fillStyle='#1a3a5c';ctx.fillRect(LEFT_W,0,W-LEFT_W,MAIN_H); }
  const navyGrad=ctx.createLinearGradient(0,0,LEFT_W+120,0);
  navyGrad.addColorStop(0,'rgba(8,20,50,0.98)');
  navyGrad.addColorStop(LEFT_W/(LEFT_W+120),'rgba(8,20,50,0.97)');
  navyGrad.addColorStop(1,'rgba(8,20,50,0)');
  ctx.fillStyle=navyGrad;ctx.fillRect(0,0,LEFT_W+120,MAIN_H);
  ctx.save();ctx.globalAlpha=0.22;ctx.fillStyle='#FFD700';
  ctx.beginPath();ctx.arc(LEFT_W-60,160,200,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;ctx.restore();
  ctx.fillStyle='#FFD700';ctx.font='italic bold 120px Arial';
  ctx.fillText(accent,PAD,PAD+110);
  ctx.fillStyle='rgba(255,255,255,0.78)';ctx.font='66px Arial';
  ctx.fillText(sub,PAD,PAD+200);
  ctx.fillStyle='#fff';ctx.font='bold 190px Arial';
  ctx.fillText(hl1,PAD,PAD+200+210);
  ctx.fillText(hl2,PAD,PAD+200+210+210);
  ctx.font='bold 88px Arial';ctx.fillStyle='rgba(255,255,255,0.88)';
  let bY=PAD+200+210+210+130;
  [b1,b2,b3].forEach(b=>{ctx.fillText('\u2600  '+b,PAD,bY);bY+=108;});
  const SPLIT=Math.round(W*0.38);
  ctx.fillStyle='#fff';ctx.fillRect(0,MAIN_H,SPLIT,BOTTOM_BAR_H);
  ctx.fillStyle=color;ctx.fillRect(SPLIT,MAIN_H,W-SPLIT,BOTTOM_BAR_H);
  if(logoImg){
    const lh=Math.min(170,logoImg.height);const lw=Math.round(logoImg.width*(lh/logoImg.height));
    ctx.drawImage(logoImg,PAD,MAIN_H+(BOTTOM_BAR_H-lh)/2,lw,lh);
  } else {
    ctx.fillStyle='#1a1a1a';ctx.font='bold 80px Arial';ctx.textBaseline='middle';
    ctx.fillText(co,PAD,MAIN_H+BOTTOM_BAR_H/2);ctx.textBaseline='alphabetic';
  }
  const ctaX=SPLIT+80;
  ctx.fillStyle='#fff';ctx.font='bold 68px Arial';
  ctx.fillText(cta,ctaX,MAIN_H+100);
  ctx.font='bold 155px Arial';
  ctx.fillText(ph,ctaX,MAIN_H+BOTTOM_BAR_H-28);
  return canvas.toDataURL('image/jpeg',0.92);
}

// ── TEMPLATE 5: Gutters / Leaf Guard ─────────────────────────────────────────
// Layout: Left dark panel (headline + bullets) | Right: house photo
// Brand-color accent bar | White bottom bar with phone right-aligned
async function renderPostcard6x9FrontCanvasT5(item){
  const cfg=S.cfg||{};
  const W=2775,H=1875,PAD=110;
  const co=cfg.companyName||'Your Gutter Co';
  const ph=cfg.companyPhone||'(000) 000-0000';
  const color=cfg.brandColor||'#F25C05';
  const logoUrl=(cfg.logoData&&cfg.logoData.startsWith('http'))?cfg.logoData:null;
  const housePhotoUrl=item.photo_url||(item.all_photos&&item.all_photos[0])||null;
  const hl1=cfg.postcardT5Headline1||"DON'T FALL";
  const hl2=cfg.postcardT5Headline2||'VICTIM TO';
  const hl3=cfg.postcardT5Headline3||'CLOGGED GUTTERS';
  const accent=cfg.postcardT5Accent||'PROTECT YOUR HOME';
  const b1=cfg.postcardT5Bullet1||'Locally owned & operated';
  const b2=cfg.postcardT5Bullet2||'HAAG Certified';
  const b3=cfg.postcardT5Bullet3||'Licensed and Insured';
  const cta=cfg.postcardT5Cta||'FREE Gutter Inspection';
  const [houseImg,logoImg]=await Promise.all([loadImg(housePhotoUrl),loadImg(logoUrl)]);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  const LEFT_W=Math.round(W*0.44);
  const BOTTOM_BAR_H=260,MAIN_H=H-BOTTOM_BAR_H;
  if(houseImg){
    const scale=Math.max((W-LEFT_W)/houseImg.width,MAIN_H/houseImg.height);
    const sw=houseImg.width*scale,sh=houseImg.height*scale;
    ctx.save();ctx.beginPath();ctx.rect(LEFT_W,0,W-LEFT_W,MAIN_H);ctx.clip();
    ctx.drawImage(houseImg,LEFT_W+(W-LEFT_W-sw)/2,(MAIN_H-sh)/2,sw,sh);
    ctx.restore();
  } else { ctx.fillStyle='#1a2a1a';ctx.fillRect(LEFT_W,0,W-LEFT_W,MAIN_H); }
  const panelGrad=ctx.createLinearGradient(0,0,LEFT_W+100,0);
  panelGrad.addColorStop(0,'rgba(12,28,12,0.98)');
  panelGrad.addColorStop(LEFT_W/(LEFT_W+100),'rgba(12,28,12,0.97)');
  panelGrad.addColorStop(1,'rgba(12,28,12,0)');
  ctx.fillStyle=panelGrad;ctx.fillRect(0,0,LEFT_W+100,MAIN_H);
  ctx.fillStyle=color;ctx.fillRect(0,Math.round(H*0.08),LEFT_W,80);
  ctx.fillStyle='#fff';ctx.font='bold 56px Arial';ctx.textBaseline='middle';
  ctx.fillText(accent,PAD,Math.round(H*0.08)+40);ctx.textBaseline='alphabetic';
  const baseY=Math.round(H*0.08)+80;
  ctx.fillStyle='#fff';ctx.font='bold 195px Arial';ctx.fillText(hl1,PAD,baseY+220);
  ctx.fillStyle=color;ctx.font='italic bold 175px Arial';ctx.fillText(hl2,PAD,baseY+220+195);
  ctx.fillStyle='#fff';ctx.font='bold 135px Arial';ctx.fillText(hl3,PAD,baseY+220+195+155);
  ctx.font='bold 78px Arial';ctx.fillStyle='rgba(255,255,255,0.85)';
  let bY=baseY+220+195+155+120;
  [b1,b2,b3].forEach(b=>{ctx.fillText('\u2713  '+b,PAD,bY);bY+=98;});
  ctx.fillStyle='#fff';ctx.fillRect(0,MAIN_H,W,BOTTOM_BAR_H);
  ctx.fillStyle=color;ctx.fillRect(0,MAIN_H,8,BOTTOM_BAR_H);
  if(logoImg){
    const lh=Math.min(150,logoImg.height);const lw=Math.round(logoImg.width*(lh/logoImg.height));
    ctx.drawImage(logoImg,PAD+16,MAIN_H+(BOTTOM_BAR_H-lh)/2,lw,lh);
  } else {
    ctx.fillStyle='#1a1a1a';ctx.font='bold 80px Arial';ctx.textBaseline='middle';
    ctx.fillText(co,PAD+16,MAIN_H+BOTTOM_BAR_H/2);ctx.textBaseline='alphabetic';
  }
  ctx.fillStyle=color;ctx.font='bold 155px Arial';ctx.textAlign='right';
  ctx.fillText(ph,W-PAD,MAIN_H+BOTTOM_BAR_H-28);
  ctx.font='bold 68px Arial';ctx.fillStyle='#333';
  ctx.fillText(cta,W-PAD,MAIN_H+90);
  ctx.textAlign='left';
  return canvas.toDataURL('image/jpeg',0.92);
}

// ── TEMPLATE 6: General Roofing (Free Inspection) ────────────────────────────
// Layout: Full-bleed house photo | Dark overlay | Center panel with headline
// Starburst badge top-right | Bottom logo bar
async function renderPostcard6x9FrontCanvasT6(item){
  const cfg=S.cfg||{};
  const W=2775,H=1875,PAD=110;
  const co=cfg.companyName||'Your Roofing Co';
  const ph=cfg.companyPhone||'(000) 000-0000';
  const site=cfg.website||'';
  const color=cfg.brandColor||'#F25C05';
  const logoUrl=(cfg.logoData&&cfg.logoData.startsWith('http'))?cfg.logoData:null;
  const housePhotoUrl=item.photo_url||(item.all_photos&&item.all_photos[0])||null;
  const hl1=cfg.postcardT6Headline1||'FREE ROOF';
  const hl2=cfg.postcardT6Headline2||'INSPECTION';
  const sub=cfg.postcardT6Sub||'Your neighbors are getting theirs. Are you next?';
  const badge1=cfg.postcardT6Badge1||'FREE';
  const badge2=cfg.postcardT6Badge2||'ESTIMATE';
  const b1=cfg.postcardT6Bullet1||'Licensed & Insured';
  const b2=cfg.postcardT6Bullet2||'5-Star Rated';
  const b3=cfg.postcardT6Bullet3||'Same-Day Response';
  const [houseImg,logoImg]=await Promise.all([loadImg(housePhotoUrl),loadImg(logoUrl)]);
  const canvas=document.createElement('canvas');
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');
  if(houseImg){
    const scale=Math.max(W/houseImg.width,H/houseImg.height);
    const sw=houseImg.width*scale,sh=houseImg.height*scale;
    ctx.drawImage(houseImg,(W-sw)/2,(H-sh)/2,sw,sh);
  } else { ctx.fillStyle='#2a3040';ctx.fillRect(0,0,W,H); }
  ctx.fillStyle='rgba(10,15,30,0.60)';ctx.fillRect(0,0,W,H);
  const PNL_W=1700,PNL_H=960,PNL_X=(W-PNL_W)/2,PNL_Y=(H-PNL_H)/2;
  ctx.fillStyle='rgba(10,15,30,0.88)';
  roundRect(ctx,PNL_X,PNL_Y,PNL_W,PNL_H,28);ctx.fill();
  ctx.strokeStyle=color;ctx.lineWidth=9;
  roundRect(ctx,PNL_X,PNL_Y,PNL_W,PNL_H,28);ctx.stroke();
  if(logoImg){
    const lh=100;const lw=Math.round(logoImg.width*(lh/logoImg.height));
    ctx.drawImage(logoImg,PNL_X+(PNL_W-lw)/2,PNL_Y+40,lw,lh);
  }
  ctx.fillStyle=color;ctx.font='bold 260px Arial';ctx.textAlign='center';
  ctx.fillText(hl1,W/2,PNL_Y+280);
  ctx.fillStyle='#fff';ctx.font='bold 200px Arial';
  ctx.fillText(hl2,W/2,PNL_Y+500);
  ctx.font='60px Arial';ctx.fillStyle='rgba(255,255,255,0.78)';
  ctx.fillText(sub,W/2,PNL_Y+600);
  ctx.font='bold 68px Arial';ctx.fillStyle='rgba(255,255,255,0.88)';
  ctx.fillText(b1+' \u2022 '+b2+' \u2022 '+b3,W/2,PNL_Y+710);
  ctx.fillStyle=color;ctx.font='bold 130px Arial';
  ctx.fillText(ph,W/2,PNL_Y+880);
  ctx.textAlign='left';
  // Starburst badge
  const bCX=W-320,bCY=280,bR=260;
  ctx.save();ctx.translate(bCX,bCY);
  ctx.fillStyle=color;
  ctx.beginPath();
  for(let i=0;i<32;i++){
    const angle=(Math.PI/16)*i-Math.PI/2;
    const r=i%2===0?bR:bR*0.78;
    const x=Math.cos(angle)*r,y=Math.sin(angle)*r;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff';ctx.font='bold 120px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(badge1,0,-60);ctx.font='bold 100px Arial';ctx.fillText(badge2,0,60);
  ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.restore();
  ctx.fillStyle='rgba(0,0,0,0.72)';ctx.fillRect(0,H-160,W,160);
  ctx.fillStyle=color;ctx.fillRect(0,H-160,W,8);
  ctx.fillStyle='#fff';ctx.font='bold 80px Arial';ctx.textBaseline='middle';
  ctx.fillText(co,PAD,H-80);
  if(site){ctx.fillStyle='rgba(255,255,255,0.72)';ctx.font='60px Arial';ctx.textAlign='right';ctx.fillText(site,W-PAD,H-80);ctx.textAlign='left';}
  ctx.textBaseline='alphabetic';
  return canvas.toDataURL('image/jpeg',0.92);
}
