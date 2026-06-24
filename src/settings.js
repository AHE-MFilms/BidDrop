// src/settings.js
// Settings tab — open/save company config, brand colors, embed card, pricing mode.
// Depends on: sb, S.cfg, currentAccount, adminAPI(), toast(), applyBrand()
// Extracted from index.html — Tier 3 modularization

function openSettings(){
  const c=S.cfg;
  document.getElementById('s-co').value=c.companyName||'';
  document.getElementById('s-addr').value=c.companyAddr||'';
  document.getElementById('s-ph').value=c.companyPhone||'';
  document.getElementById('s-rep').value=c.repName||'';
  document.getElementById('s-lic').value=c.licenseNum||'';
  document.getElementById('s-yrs').value=c.yearsInBusiness||'5+';
  document.getElementById('s-warr').value=c.warrantyYears||'10';
  const sBioEl = document.getElementById('s-bio'); if(sBioEl) sBioEl.value=c.companyBio||'';
  const sMetaPixelEl = document.getElementById('s-meta-pixel-id'); if(sMetaPixelEl) sMetaPixelEl.value=c.metaPixelId||'';
  const sGoogleTagEl = document.getElementById('s-google-tag-id'); if(sGoogleTagEl) sGoogleTagEl.value=c.googleTagId||'';
  const sGooglePlaceEl = document.getElementById('s-google-place-id'); if(sGooglePlaceEl) sGooglePlaceEl.value=c.googlePlaceId||'';
  document.getElementById('s-hook').value=c.hookLetter||'';
  document.getElementById('s-why').value=c.whyReceived||'';
  document.getElementById('s-pc-hook').value=c.postcardHook||'';
  document.getElementById('s-pc-why').value=c.postcardWhy||'';
  document.getElementById('s-pc-quote').value=c.postcardQuote||'';
  document.getElementById('s-pc-guarantee').value=c.postcardGuarantee||'';
  // New designer fields
  const _pcH1=document.getElementById('s-pc-headline1'); if(_pcH1) _pcH1.value=c.postcardHeadline1||'We Assessed';
  const _pcH2=document.getElementById('s-pc-headline2'); if(_pcH2) _pcH2.value=c.postcardHeadline2||'Your Roof.';
  const _pcBadgeTxt=document.getElementById('s-pc-badge-text'); if(_pcBadgeTxt) _pcBadgeTxt.value=c.postcardBadgeText||'YOUR ROOF ESTIMATE IS READY';
  const _pcBadgeClr=document.getElementById('s-pc-badge-color'); if(_pcBadgeClr) _pcBadgeClr.value=c.postcardBadgeColor||c.brandColor||'#F25C05';
  const _pcBackBadgeTxt=document.getElementById('s-pc-back-badge-text'); if(_pcBackBadgeTxt) _pcBackBadgeTxt.value=c.postcardBackBadgeText||'YOUR ROOF ESTIMATE IS READY';
  const _pcBackBadgeClr=document.getElementById('s-pc-back-badge-color'); if(_pcBackBadgeClr) _pcBackBadgeClr.value=c.postcardBackBadgeColor||c.brandColor||'#F25C05';
  const _pcScanCta=document.getElementById('s-pc-scan-cta'); if(_pcScanCta) _pcScanCta.value=c.postcardScanCta||'SCAN TO BOOK';
  const _pcScanSub=document.getElementById('s-pc-scan-sub'); if(_pcScanSub) _pcScanSub.value=c.postcardScanSub||'No-pressure booking';
  // Font size sliders
  function _setSz(id,valId,val){ const el=document.getElementById(id); if(el){el.value=val; const vEl=document.getElementById(valId); if(vEl) vEl.textContent=val;} }
  _setSz('s-pc-hl1-sz','s-pc-hl1-sz-val',c.postcardHl1Size||160);
  _setSz('s-pc-hl2-sz','s-pc-hl2-sz-val',c.postcardHl2Size||160);
  _setSz('s-pc-hook-sz','s-pc-hook-sz-val',c.postcardHookSize||36);
  _setSz('s-pc-why-sz','s-pc-why-sz-val',c.postcardWhySize||30);
  _setSz('s-pc-quote-sz','s-pc-quote-sz-val',c.postcardQuoteSize||32);
  _setSz('s-pc-guar-sz','s-pc-guar-sz-val',c.postcardGuarSize||26);
  _setSz('s-pc-phone-sz','s-pc-phone-sz-val',c.postcardPhoneSize||42);
  _setSz('s-pc-addr-sz','s-pc-addr-sz-val',c.postcardAddrSize||62);
  _setSz('s-pc-price-sz','s-pc-price-sz-val',c.postcardPriceSize||78);
  // Photo layout
  const _pcPhotoLayout=c.postcardPhotoLayout||'single';
  const _pcPhotoEl=document.getElementById('s-pc-photo-'+_pcPhotoLayout); if(_pcPhotoEl) _pcPhotoEl.checked=true;
  // Show/hide toggles
  const _pcShowPrice=document.getElementById('s-pc-show-price'); if(_pcShowPrice) _pcShowPrice.checked=c.postcardShowPrice!==false;
  const _pcShowMonthly=document.getElementById('s-pc-show-monthly'); if(_pcShowMonthly) _pcShowMonthly.checked=c.postcardShowMonthly!==false;
  const _pcShowPhone=document.getElementById('s-pc-show-phone'); if(_pcShowPhone) _pcShowPhone.checked=c.postcardShowPhone!==false;
  // Design selector
  const _pcDes=c.postcardDesign||'1';
  const _pcDesEl=document.getElementById('s-pc-design-'+_pcDes);
  if(_pcDesEl)_pcDesEl.checked=true;
  const _isBuiltinTpl=['t3','t4','t5','t6'].includes(_pcDes);
  document.getElementById('s-pc-d1-fields').style.display=(_pcDes==='2'||_isBuiltinTpl)?'none':'';
  document.getElementById('s-pc-d2-fields').style.display=_pcDes==='2'?'':'none';
  document.getElementById('s-pc-d2-topline').value=c.postcardD2TopLine||'';
  document.getElementById('s-pc-d2-accent').value=c.postcardD2Accent||'';
  document.getElementById('s-pc-d2-headline').value=c.postcardD2Headline||'';
  document.getElementById('s-pc-d2-headline2').value=c.postcardD2Headline2||'';
  document.getElementById('s-pc-d2-bullet1').value=c.postcardD2Bullet1||'';
  document.getElementById('s-pc-d2-bullet2').value=c.postcardD2Bullet2||'';
  document.getElementById('s-pc-d2-bullet3').value=c.postcardD2Bullet3||'';
  document.getElementById('s-pc-d2-badge1').value=c.postcardD2Badge1||'';
  document.getElementById('s-pc-d2-badge2').value=c.postcardD2Badge2||'';
  document.getElementById('s-pc-d2-badgesub').value=c.postcardD2BadgeSub||'';
  document.getElementById('s-pc-d2-cta').value=c.postcardD2Cta||'';
  document.getElementById('s-pc-d2-barcolor').value=c.postcardD2BarColor||'#CC1111';
  document.getElementById('s-fin-enabled').checked=c.financingEnabled!==false;
  document.getElementById('s-fin-apr').value=c.financingApr||9.99;
  document.getElementById('s-fin-term').value=c.financingTerm||60;
  document.getElementById('s-fin-down').value=c.financingDown||0;
  document.getElementById('s-d1').value=c.diff1||'';
  document.getElementById('s-d2').value=c.diff2||'';
  document.getElementById('s-d3').value=c.diff3||'';
  document.getElementById('s-d4').value=c.diff4||'';
  document.getElementById('s-d5').value=c.diff5||'';
  document.getElementById('s-d6').value=c.diff6||'';
  document.getElementById('s-off-sid').checked=!!c.offerSiding;
  document.getElementById('s-off-win').checked=!!c.offerWindows;
  document.getElementById('s-off-gut').checked=!!c.offerGutters;
  document.getElementById('s-off-custom').value=c.offerCustom||'';
  document.getElementById('s-refamt').value=c.referralAmt||'250';
  document.getElementById('s-reftext').value=c.referralText||'';
  // Material visibility toggles
  const el=id=>document.getElementById(id);
  if(el('s-mat-arch'))   el('s-mat-arch').checked   = c.matArch   !== false;
  if(el('s-mat-des'))    el('s-mat-des').checked    = !!c.matDes;
  if(el('s-mat-impact')) el('s-mat-impact').checked = !!c.matImpact;
  if(el('s-mat-metal'))  el('s-mat-metal').checked  = !!c.matMetal;
  if(el('s-mat-flat'))   el('s-mat-flat').checked   = !!c.matFlat;
  if(el('s-mat-tile'))   el('s-mat-tile').checked   = !!c.matTile;
  // Pricing mode
  setPricingMode(c.pricingMode||'detailed');
  // Per-square rates
  if(el('s-pps-arch')) el('s-pps-arch').value=c.ppsArchitectural||450;
  if(el('s-pps-des'))  el('s-pps-des').value=c.ppsDesigner||580;
  if(el('s-pps-impact')) el('s-pps-impact').value=c.ppsImpact||520;
  if(el('s-pps-metal')) el('s-pps-metal').value=c.ppsMetal||950;
  if(el('s-pps-flat')) el('s-pps-flat').value=c.ppsFlat||400;
  if(el('s-pps-tile')) el('s-pps-tile').value=c.ppsTile||1400;
  // Detailed material costs
  el('s-carch').value=c.costArchitectural||300;
  el('s-cdes').value=c.costDesigner||420;
  if(el('s-cimpact')) el('s-cimpact').value=c.costImpact||380;
  el('s-cmetal').value=c.costMetal||680;
  if(el('s-cflat')) el('s-cflat').value=c.costFlat||320;
  if(el('s-ctile')) el('s-ctile').value=c.costTile||950;
  document.getElementById('s-tear').value=c.costTearoff||75;
  document.getElementById('s-ice').value=c.costIceWater||42;
  document.getElementById('s-felt').value=c.costFelts||22;
  document.getElementById('s-dump').value=c.costDumpster||450;
  document.getElementById('s-sky').value=c.costSkylight||375;
  document.getElementById('s-chim').value=c.costChimney||295;
  document.getElementById('s-gut').value=c.costGutter||9;
  const solarPwEl=document.getElementById('s-solar-pw'); if(solarPwEl) solarPwEl.value=c.solarPricePerWatt||c.costSolarPerWatt||3.50;
  // ── Load Solar pricing fields ──
  const _sset=(id,val)=>{const e=document.getElementById(id);if(e)e.value=val;};
  const _sck=(id,val)=>{const e=document.getElementById(id);if(e)e.checked=!!val;};
  _sset('s-solar-min-kw', c.solarMinKw||4);
  _sset('s-solar-max-kw', c.solarMaxKw||20);
  _sset('s-solar-install-days', c.solarInstallDays||2);
  _sset('s-solar-battery', c.solarBattery||8000);
  _sset('s-solar-panel-upgrade', c.solarPanelUpgrade||150);
  _sset('s-solar-elec-upgrade', c.solarElecUpgrade||2500);
  _sset('s-solar-roof-reinforce', c.solarRoofReinforce||1500);
  _sset('s-solar-fed-credit', c.solarFedCredit||30);
  _sset('s-solar-state-rebate', c.solarStateRebate||0);
  _sset('s-solar-utility-rebate', c.solarUtilityRebate||0);
  _sset('s-solar-monthly-savings', c.solarMonthlySavings||150);
  _sset('s-solar-ovh', c.solarOverhead||12);
  _sset('s-solar-mgn', c.solarMargin||18);
  _sset('s-solar-tax', c.solarTax||0);
  _sck('s-solar-fin-enabled', c.solarFinEnabled!==false);
  _sset('s-solar-fin-apr', c.solarFinApr||4.99);
  _sset('s-solar-fin-term', c.solarFinTerm||180);
  // ── Load Fencing pricing fields ──
  _sck('s-fen-wood',    c.fenWood!==false);
  _sck('s-fen-vinyl',   !!c.fenVinyl);
  _sck('s-fen-chain',   !!c.fenChain);
  _sck('s-fen-aluminum',!!c.fenAluminum);
  _sck('s-fen-split',   !!c.fenSplit);
  _sck('s-fen-cedar',   !!c.fenCedar);
  _sset('s-fen-wood-plf',    c.fenWoodPlf||28);
  _sset('s-fen-vinyl-plf',   c.fenVinylPlf||35);
  _sset('s-fen-chain-plf',   c.fenChainPlf||18);
  _sset('s-fen-alum-plf',    c.fenAlumPlf||45);
  _sset('s-fen-split-plf',   c.fenSplitPlf||22);
  _sset('s-fen-cedar-plf',   c.fenCedarPlf||38);
  _sset('s-fen-gate-single', c.fenGateSingle||350);
  _sset('s-fen-gate-double', c.fenGateDouble||650);
  _sset('s-fen-removal',     c.fenRemoval||5);
  _sset('s-fen-post-concrete',c.fenPostConcrete||25);
  _sset('s-fen-ovh', c.fenOverhead||15);
  _sset('s-fen-mgn', c.fenMargin||20);
  _sset('s-fen-tax', c.fenTax||0);
  _sck('s-fen-fin-enabled', c.fenFinEnabled!==false);
  _sset('s-fen-fin-apr', c.fenFinApr||9.99);
  _sset('s-fen-fin-term', c.fenFinTerm||60);
  // ── Load Gutters pricing fields ──
  _sset('s-gut-alum5',    c.gutAlum5||6.00);   _sset('s-gut-alum6',    c.gutAlum6||8.00);
  _sset('s-gut-seamless', c.gutSeamless||9.00); _sset('s-gut-copper',   c.gutCopper||22.00);
  _sset('s-gut-halfrnd',  c.gutHalfrnd||10.00); _sset('s-gut-vinyl',    c.gutVinyl||4.50);
  _sset('s-gut-guard',    c.gutGuard||5.00);    _sset('s-gut-downspout',c.gutDownspout||75);
  _sset('s-gut-ds-ext',   c.gutDsExt||25);      _sset('s-gut-removal',  c.gutRemoval||1.50);
  _sset('s-gut-fascia',   c.gutFascia||8.00);   _sset('s-gut-endcaps',  c.gutEndcaps||12);
  _sset('s-gut-ovh', c.gutOverhead||15); _sset('s-gut-mgn', c.gutMargin||20); _sset('s-gut-tax', c.gutTax||0);
  _sck('s-gut-fin-enabled', c.gutFinEnabled!==false); _sset('s-gut-fin-apr', c.gutFinApr||9.99); _sset('s-gut-fin-term', c.gutFinTerm||36);
  // ── Load Insulation pricing fields ──
  _sset('s-ins-blow-r30',   c.insBlowR30||1.20);  _sset('s-ins-blow-r38',   c.insBlowR38||1.50);
  _sset('s-ins-cell-r30',   c.insCellR30||1.10);  _sset('s-ins-cell-r38',   c.insCellR38||1.40);
  _sset('s-ins-foam-open',  c.insFoamOpen||1.50); _sset('s-ins-foam-closed', c.insFoamClosed||3.00);
  _sset('s-ins-batt-r13',   c.insBattR13||0.65);  _sset('s-ins-batt-r19',   c.insBattR19||0.85);
  _sset('s-ins-removal',    c.insRemoval||0.75);   _sset('s-ins-airsealing', c.insAirsealing||350);
  _sset('s-ins-vapor',      c.insVapor||0.45);     _sset('s-ins-hatch',      c.insHatch||125);
  _sset('s-ins-ovh', c.insOverhead||15); _sset('s-ins-mgn', c.insMargin||20); _sset('s-ins-tax', c.insTax||0);
  _sck('s-ins-fin-enabled', c.insFinEnabled!==false); _sset('s-ins-fin-apr', c.insFinApr||9.99); _sset('s-ins-fin-term', c.insFinTerm||36);
  // ── Load Exterior Paint pricing fields ──
  _sset('s-pnt-siding-1c', c.pntSiding1c||1.50); _sset('s-pnt-siding-2c', c.pntSiding2c||2.25);
  _sset('s-pnt-trim-1c',   c.pntTrim1c||2.00);   _sset('s-pnt-trim-2c',   c.pntTrim2c||3.00);
  _sset('s-pnt-deck-1c',   c.pntDeck1c||1.75);   _sset('s-pnt-deck-2c',   c.pntDeck2c||2.75);
  _sset('s-pnt-masonry',   c.pntMasonry||2.50);   _sset('s-pnt-garage-door', c.pntGarageDoor||150);
  _sset('s-pnt-powerwash', c.pntPowerwash||0.35); _sset('s-pnt-caulk',     c.pntCaulk||1.25);
  _sset('s-pnt-primer',    c.pntPrimer||0.50);    _sset('s-pnt-stain',     c.pntStain||1.80);
  _sset('s-pnt-ovh', c.pntOverhead||15); _sset('s-pnt-mgn', c.pntMargin||20); _sset('s-pnt-tax', c.pntTax||0);
  _sck('s-pnt-fin-enabled', c.pntFinEnabled!==false); _sset('s-pnt-fin-apr', c.pntFinApr||9.99); _sset('s-pnt-fin-term', c.pntFinTerm||24);
  // ── Load Doors pricing fields ──
  _sset('s-dor-steel-entry',   c.dorSteelEntry||850);   _sset('s-dor-fiber-entry',   c.dorFiberEntry||1200);
  _sset('s-dor-wood-entry',    c.dorWoodEntry||1500);   _sset('s-dor-double-entry',  c.dorDoubleEntry||2800);
  _sset('s-dor-storm-std',     c.dorStormStd||450);     _sset('s-dor-storm-full',    c.dorStormFull||650);
  _sset('s-dor-screen',        c.dorScreen||300);        _sset('s-dor-sliding',       c.dorSliding||1800);
  _sset('s-dor-garage-single', c.dorGarageSingle||1100); _sset('s-dor-garage-double', c.dorGarageDouble||1800);
  _sset('s-dor-garage-insul',  c.dorGarageInsul||1400); _sset('s-dor-opener',        c.dorOpener||350);
  _sset('s-dor-frame-repair',  c.dorFrameRepair||200);  _sset('s-dor-hardware',      c.dorHardware||125);
  _sset('s-dor-weatherstrip',  c.dorWeatherstrip||75);  _sset('s-dor-paint',         c.dorPaint||150);
  _sset('s-dor-ovh', c.dorOverhead||15); _sset('s-dor-mgn', c.dorMargin||20); _sset('s-dor-tax', c.dorTax||0);
  _sset('s-win-dbl-hung', c.winDblHung||450); _sset('s-win-casement', c.winCasement||550); _sset('s-win-picture', c.winPicture||400);
  _sset('s-win-sliding', c.winSliding||480); _sset('s-win-bay', c.winBay||1800); _sset('s-win-skylight', c.winSkylight||1200);
  _sset('s-win-storm', c.winStorm||200); _sset('s-win-egress', c.winEgress||2500);
  _sset('s-win-lowe', c.winLowe||75); _sset('s-win-triple', c.winTriple||120); _sset('s-win-trim', c.winTrim||85); _sset('s-win-removal', c.winRemoval||50);
  _sset('s-win-cnt-sm', c.winCntSm||9); _sset('s-win-cnt-md', c.winCntMd||13); _sset('s-win-cnt-lg', c.winCntLg||18); _sset('s-win-cnt-xl', c.winCntXl||25);
  _sset('s-win-ovh', c.winOverhead||15); _sset('s-win-mgn', c.winMargin||20); _sset('s-win-tax', c.winTax||0);
  _sck('s-dor-fin-enabled', c.dorFinEnabled!==false); _sset('s-dor-fin-apr', c.dorFinApr||9.99); _sset('s-dor-fin-term', c.dorFinTerm||36);
  // ── Load Siding pricing fields ──
  _sck('s-sid-vinyl',    c.sidVinyl!==false);
  _sck('s-sid-hardie',   !!c.sidHardie);
  _sck('s-sid-wood',     !!c.sidWood);
  _sck('s-sid-eng-wood', !!c.sidEngWood);
  _sck('s-sid-metal',    !!c.sidMetal);
  _sck('s-sid-stucco',   !!c.sidStucco);
  _sset('s-sid-vinyl-psf',    c.sidVinylPsf||4.50);
  _sset('s-sid-hardie-psf',   c.sidHardiePsf||8.00);
  _sset('s-sid-wood-psf',     c.sidWoodPsf||7.00);
  _sset('s-sid-engwood-psf',  c.sidEngWoodPsf||6.50);
  _sset('s-sid-metal-psf',    c.sidMetalPsf||9.00);
  _sset('s-sid-stucco-psf',   c.sidStuccoPsf||10.00);
  _sset('s-sid-removal',      c.sidRemoval||1.50);
  _sset('s-sid-housewrap',    c.sidHousewrap||0.75);
  _sset('s-sid-trim',         c.sidTrim||6.00);
  _sset('s-sid-corners',      c.sidCorners||45);
  _sset('s-sid-window-wrap',  c.sidWindowWrap||85);
  _sset('s-sid-insulation',   c.sidInsulation||0.50);
  _sset('s-sid-ovh', c.sidOverhead||15);
  _sset('s-sid-mgn', c.sidMargin||20);
  _sset('s-sid-tax', c.sidTax||0);
  _sck('s-sid-fin-enabled', c.sidFinEnabled!==false);
  _sset('s-sid-fin-apr', c.sidFinApr||9.99);
  _sset('s-sid-fin-term', c.sidFinTerm||60);
  // Restore pricing sub-tab
  restorePricingTab();
  // Refresh trade toggles and selector
  if(typeof refreshAllTradeToggles==='function') refreshAllTradeToggles();
  if(typeof renderTradeSelector==='function') renderTradeSelector();
  const repVidEl=document.getElementById('s-rep-video-url'); if(repVidEl){ repVidEl.value=c.repVideoUrl||''; updateRepVideoPreview(c.repVideoUrl||''); }
  const offSolarEl=document.getElementById('s-off-solar'); if(offSolarEl) offSolarEl.checked=!!c.offerSolar;
  // Show/hide solar add-on row in estimate builder
  const solarRow=document.getElementById('solar-addon-row'); if(solarRow) solarRow.style.display=c.offerSolar?'block':'none';
  document.getElementById('s-ovh').value=c.overhead||15;
  document.getElementById('s-mgn').value=c.margin||20;
  const _stax=document.getElementById('s-tax'); if(_stax) _stax.value=c.taxRate||0;
  document.getElementById('s-color').value=c.brandColor||'#F25C05';
  document.getElementById('s-ghl-key').value=c.ghlApiKey||'';
  // Check GHL OAuth connection status
  setTimeout(ghlCheckOAuthStatus, 100);
  document.getElementById('s-ghl-loc').value=c.ghlLocationId||'';
  document.getElementById('s-ghl-pipe').value=c.ghlPipelineId||'';
  document.getElementById('s-ghl-sms-tpl').value=c.ghlSmsTpl||DEFAULTS.ghlSmsTpl;
  document.getElementById('s-ghl-email-tpl').value=c.ghlEmailTpl||DEFAULTS.ghlEmailTpl;
  // JobNimbus settings
  const _jnKey=document.getElementById('s-jn-key'); if(_jnKey) _jnKey.value=c.jnApiKey||'';
  const _jnRt=document.getElementById('s-jn-record-type'); if(_jnRt) _jnRt.value=c.jnRecordType||'Customer';
  const _jnSt=document.getElementById('s-jn-status'); if(_jnSt) _jnSt.value=c.jnStatus||'Lead';
  const _jobberEl=document.getElementById('s-jobber-key'); if(_jobberEl) _jobberEl.value=c.jobberApiKey||'';
  const _webhookEl=document.getElementById('s-webhook-url'); if(_webhookEl) _webhookEl.value=c.webhookUrl||'';
  // CompanyCam settings
  if(typeof initCompanyCamSettings === 'function') initCompanyCamSettings();
  // QuickBooks settings
  if(typeof initQBSettings === 'function') initQBSettings();
  setTimeout(refreshAllIntStatuses, 150);
  // Restore stage dropdown — if stages already fetched, keep selection
  const stgSel=document.getElementById('s-ghl-stage');
  if(stgSel){
    if(c.ghlStageId && !Array.from(stgSel.options).find(o=>o.value===c.ghlStageId)){
      const opt=document.createElement('option');
      opt.value=c.ghlStageId; opt.textContent='Saved stage ('+c.ghlStageId.slice(0,8)+'...)';
      stgSel.appendChild(opt);
    }
    if(c.ghlStageId) stgSel.value=c.ghlStageId;
  }
  // Integrations card (GHL, JobNimbus) — visible to all admins; RentCast/Lob sub-sections remain super_admin only
  const intCard = document.getElementById('stab-integrations-card');
  if(intCard) intCard.style.display = isAdminOrAbove() ? 'block' : 'none';
  // Show Lob and RentCast key fields only to super_admin
  const lobSection = document.getElementById('lob-settings-section');
  if(lobSection) lobSection.style.display = isSuperAdmin() ? 'block' : 'none';
  const rcSection = document.getElementById('rentcast-settings-section');
  if(rcSection) rcSection.style.display = isSuperAdmin() ? 'block' : 'none';
  if(isSuperAdmin()){
    const lobEl = document.getElementById('s-lob'); if(lobEl) lobEl.value = masterLobKey||'';
    const rcKeyEl = document.getElementById('s-rentcast-key'); if(rcKeyEl) rcKeyEl.value = masterRentcastKey||'';
  }
  const lp=document.getElementById('logo-preview');
  if(lp){
    lp.innerHTML=c.logoData?'<img src="'+c.logoData+'" style="max-width:100%;max-height:100%;object-fit:contain;">':'No logo';
    if(c.logoData){lp.style.cursor='zoom-in';lp.onclick=()=>openBrandingLightbox(c.logoData,'Company Logo');}else{lp.style.cursor='';lp.onclick=null;}
  }
  document.getElementById('s-reptitle').value=c.repTitle||'';
  document.getElementById('s-hspos').value=c.headshotPos||'30';
  document.getElementById('s-bookingurl').value=c.bookingUrl||'';
  document.getElementById('s-lead-alert-email').value=c.leadAlertEmail||'';
  const hp=document.getElementById('headshot-preview');
  if(hp){
    hp.innerHTML=c.headshot?'<img src="'+c.headshot+'" style="width:100%;height:100%;object-fit:cover;object-position:center '+((c.headshotPos||'30')+'%')+'">' :'No photo';
    if(c.headshot){hp.style.cursor='zoom-in';hp.onclick=()=>openBrandingLightbox(c.headshot,'Rep Headshot');}else{hp.style.cursor='';hp.onclick=null;}
  }
  const r1p=document.getElementById('review1-preview');
  if(r1p){
    r1p.innerHTML=c.review1?'<img src="'+c.review1+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">':'No image';
    if(c.review1){r1p.style.cursor='zoom-in';r1p.onclick=()=>openBrandingLightbox(c.review1,'Review Image 1');}else{r1p.style.cursor='';r1p.onclick=null;}
  }
  const r2p=document.getElementById('review2-preview');
  if(r2p){
    r2p.innerHTML=c.review2?'<img src="'+c.review2+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">':'No image';
    if(c.review2){r2p.style.cursor='zoom-in';r2p.onclick=()=>openBrandingLightbox(c.review2,'Review Image 2');}else{r2p.style.cursor='';r2p.onclick=null;}
  }
  [2,3,4,5,6].forEach(step=>{
    const pcp=document.getElementById('pc'+step+'-preview');
    const url=c['postcardStep'+step];
    if(pcp)pcp.innerHTML=url?'<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">':'No design<br>uploaded';
  });
  // Load drip enabled toggle
  const dripCk = document.getElementById('s-drip-enabled');
  if(dripCk){ dripCk.checked = !!c.dripEnabled; updateDripToggleLabel(); }
  // Load drip message fields
  const dripMsgFields = [
    ['s-drip2-headline','drip2Headline','Still thinking it over?'],
    ['s-drip2-subtext','drip2Subtext',"Your estimate is still valid. We'd love to help."],
    ['s-drip3-headline','drip3Headline','Storm season is coming.'],
    ['s-drip3-subtext','drip3Subtext',"Now's the time to protect your home. Call us today."],
    ['s-drip4-headline','drip4Headline','Final notice.'],
    ['s-drip4-subtext','drip4Subtext','Your estimate expires soon. Secure your spot before prices rise.'],
    ['s-drip5-headline','drip5Headline',"We're still here for you."],
    ['s-drip5-subtext','drip5Subtext',"Your roof won't fix itself. Let's get started today."],
    ['s-drip6-headline','drip6Headline','One last thing...'],
    ['s-drip6-subtext','drip6Subtext',"We'd love to earn your business. Call us anytime."],
  ];
  dripMsgFields.forEach(([id,key,def])=>{ const el=document.getElementById(id); if(el) el.value=c[key]||def; });
  // Sync live previews with loaded values
  updateAllDripPreviews();
  // Only admins can see the drip toggle section
  const dripToggleSec = document.getElementById('drip-toggle-section');
  if(dripToggleSec) dripToggleSec.style.display = isAdminOrAbove() ? 'flex' : 'none';
  // Attach financing preview listeners
  ['s-fin-apr','s-fin-term','s-fin-down'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){el.removeEventListener('input',updateFinPreview);el.addEventListener('input',updateFinPreview);}
  });
  const finCk=document.getElementById('s-fin-enabled');
  if(finCk){finCk.removeEventListener('change',updateFinPreview);finCk.addEventListener('change',updateFinPreview);}
  updateFinPreview();
  // Show drip card only for admins
  const dripCard = document.getElementById('stab-drip-card');
  if(dripCard) dripCard.style.display = isAdminOrAbove() ? 'block' : 'none';
  // Postcard design radio button show/hide
  document.querySelectorAll('input[name="pc-design"]').forEach(r=>{
    r.removeEventListener('change',r._pcDesignHandler||null);
    r._pcDesignHandler=()=>{
      const v=document.querySelector('input[name="pc-design"]:checked')?.value||'1';
      const _isB=['t3','t4','t5','t6'].includes(v);
      document.getElementById('s-pc-d1-fields').style.display=(v==='2'||_isB)?'none':'';
      document.getElementById('s-pc-d2-fields').style.display=v==='2'?'':'';
    };
    r.addEventListener('change',r._pcDesignHandler);
  });
  // Populate Share & Embed card
  populateEmbedCard();
  // Billing card — only show to account admins (not super_admin, not reps)
  const billingCard = document.getElementById('stab-billing-card');
  if(billingCard) billingCard.style.display = (isAdminOrAbove() && !isSuperAdmin()) ? 'block' : 'none';
  // Load billing status (cancel_at_period_end, payment_failed)
  if(isAdminOrAbove() && !isSuperAdmin()) loadBillingStatus();
  // Load trade-specific settings (Build 10)
  if(typeof loadTradeStatusSettings === 'function') loadTradeStatusSettings();
  if(typeof loadTradePostcardCopySettings === 'function') loadTradePostcardCopySettings();
}
function populateEmbedCard(){
  const slug = currentAccount && currentAccount.slug;
  const noSlug = document.getElementById('embed-no-slug');
  const hasSlug = document.getElementById('embed-has-slug');
  if(!noSlug || !hasSlug) return;
  if(!slug){
    noSlug.style.display='block'; hasSlug.style.display='none'; return;
  }
  noSlug.style.display='none'; hasSlug.style.display='block';
  const url = 'https://biddrop.us/q/'+slug;
  const urlEl = document.getElementById('embed-url-display');
  const openEl = document.getElementById('embed-url-open');
  const btnEl = document.getElementById('embed-btn-code');
  const iframeEl = document.getElementById('embed-iframe-code');
  if(urlEl) urlEl.textContent = url;
  if(openEl){ openEl.href = url; }
  if(btnEl) btnEl.textContent = '<a href="'+url+'" target="_blank" style="display:inline-block;background:#F25C05;color:#fff;font-family:sans-serif;font-size:16px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;">Get a Free Roof Estimate</a>';
  if(iframeEl) iframeEl.textContent = '<iframe src="'+url+'" width="100%" height="720" frameborder="0" style="border:none;border-radius:12px;" title="Free Roof Estimate"></iframe>';
}
function copyEmbedText(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  const text = el.textContent || el.innerText || '';
  navigator.clipboard.writeText(text).then(()=>toast('Copied!','success')).catch(()=>{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy');
    document.body.removeChild(ta); toast('Copied!','success');
  });
}

function setPricingMode(mode){
  const modeVal=document.getElementById('s-pricing-mode-val');
  const persqBtn=document.getElementById('s-mode-persq');
  const detBtn=document.getElementById('s-mode-detailed');
  const persqFields=document.getElementById('s-persq-fields');
  const detFields=document.getElementById('s-detailed-fields');
  if(!modeVal)return;
  modeVal.value=mode;
  if(mode==='per_square'){
    if(persqBtn){persqBtn.style.background='var(--accent)';persqBtn.style.color='#fff';persqBtn.style.borderColor='var(--accent)';}
    if(detBtn){detBtn.style.background='transparent';detBtn.style.color='var(--mid)';detBtn.style.borderColor='var(--border)';}
    if(persqFields)persqFields.style.display='block';
    if(detFields)detFields.style.display='none';
  }else{
    if(detBtn){detBtn.style.background='var(--accent)';detBtn.style.color='#fff';detBtn.style.borderColor='var(--accent)';}
    if(persqBtn){persqBtn.style.background='transparent';persqBtn.style.color='var(--mid)';persqBtn.style.borderColor='var(--border)';}
    if(persqFields)persqFields.style.display='none';
    if(detFields)detFields.style.display='block';
  }
  // Update live cfg so estimate recalculates immediately
  if(S.cfg)S.cfg.pricingMode=mode;
  if(typeof calcP==='function')calcP();
}

function saveSettings(){
  const n=id=>parseFloat(document.getElementById(id).value)||0;
  const v=id=>document.getElementById(id).value;
  const ck=id=>document.getElementById(id).checked;
  S.cfg={
    companyName:v('s-co')||'Your Roofing Co',
    companyAddr:v('s-addr'),
    companyPhone:v('s-ph'),
    repName:v('s-rep'),
    licenseNum:v('s-lic'),
    yearsInBusiness:v('s-yrs')||'5+',
    warrantyYears:v('s-warr')||'10',
    hookLetter:v('s-hook'),
    whyReceived:v('s-why'),
    postcardHook:v('s-pc-hook'),
    postcardWhy:v('s-pc-why'),
    postcardQuote:v('s-pc-quote'),
    postcardGuarantee:v('s-pc-guarantee'),
    postcardDesign:(document.querySelector('input[name="pc-design"]:checked')||{value:'1'}).value,
    // New designer fields
    postcardHeadline1:v('s-pc-headline1')||'We Assessed',
    postcardHeadline2:v('s-pc-headline2')||'Your Roof.',
    postcardBadgeText:v('s-pc-badge-text')||'YOUR ROOF ESTIMATE IS READY',
    postcardBadgeColor:v('s-pc-badge-color')||'#F25C05',
    postcardBackBadgeText:v('s-pc-back-badge-text')||'YOUR ROOF ESTIMATE IS READY',
    postcardBackBadgeColor:v('s-pc-back-badge-color')||'#F25C05',
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
    postcardD2TopLine:v('s-pc-d2-topline'),
    postcardD2Accent:v('s-pc-d2-accent'),
    postcardD2Headline:v('s-pc-d2-headline'),
    postcardD2Headline2:v('s-pc-d2-headline2'),
    postcardD2Bullet1:v('s-pc-d2-bullet1'),
    postcardD2Bullet2:v('s-pc-d2-bullet2'),
    postcardD2Bullet3:v('s-pc-d2-bullet3'),
    postcardD2Badge1:v('s-pc-d2-badge1'),
    postcardD2Badge2:v('s-pc-d2-badge2'),
    postcardD2BadgeSub:v('s-pc-d2-badgesub'),
    postcardD2Cta:v('s-pc-d2-cta'),
    postcardD2BarColor:v('s-pc-d2-barcolor')||'#CC1111',
    financingEnabled:ck('s-fin-enabled'),
    financingApr:parseFloat(v('s-fin-apr'))||9.99,
    financingTerm:parseInt(v('s-fin-term'))||60,
    financingDown:parseFloat(v('s-fin-down'))||0,
    diff1:v('s-d1'), diff2:v('s-d2'), diff3:v('s-d3'),
    diff4:v('s-d4'), diff5:v('s-d5'), diff6:v('s-d6'),
    offerSiding:ck('s-off-sid'), offerWindows:ck('s-off-win'), offerGutters:ck('s-off-gut'),
    repVideoUrl:v('s-rep-video-url')||'',
    offerSolar:ck('s-off-solar'),
    costSolarPerWatt:parseFloat(v('s-solar-pw'))||3.50,
    offerCustom:v('s-off-custom'),
    referralAmt:v('s-refamt')||'250',
    referralText:v('s-reftext'),
    matArch:  ck('s-mat-arch'),  matDes:    ck('s-mat-des'),
    matImpact:ck('s-mat-impact'), matMetal:  ck('s-mat-metal'),
    matFlat:  ck('s-mat-flat'),   matTile:   ck('s-mat-tile'),
    pricingMode:(document.getElementById('s-pricing-mode-val')||{value:'detailed'}).value||'detailed',
    pricePerSquare:n('s-pps')||450,
    ppsArchitectural:n('s-pps-arch')||450, ppsDesigner:n('s-pps-des')||580,
    ppsImpact:n('s-pps-impact')||520, ppsMetal:n('s-pps-metal')||950,
    ppsFlat:n('s-pps-flat')||400, ppsTile:n('s-pps-tile')||1400,
    cost3Tab:220, costArchitectural:n('s-carch')||300,
    costDesigner:n('s-cdes')||420, costImpact:n('s-cimpact')||380,
    costMetal:n('s-cmetal')||680, costFlat:n('s-cflat')||320, costTile:n('s-ctile')||950,
    costTearoff:n('s-tear')||75, costIceWater:n('s-ice')||42,
    costFelts:n('s-felt')||22, costDumpster:n('s-dump')||450,
    costSkylight:n('s-sky')||375, costChimney:n('s-chim')||295, costGutter:n('s-gut')||9,
    overhead:n('s-ovh')||15, margin:n('s-mgn')||20, taxRate:n('s-tax')||0,
    // ── Solar pricing ──
    solarPricePerWatt:parseFloat(v('s-solar-pw'))||3.50,
    solarMinKw:parseFloat(v('s-solar-min-kw'))||4,
    solarMaxKw:parseFloat(v('s-solar-max-kw'))||20,
    solarInstallDays:parseInt(v('s-solar-install-days'))||2,
    solarBattery:n('s-solar-battery')||8000,
    solarPanelUpgrade:n('s-solar-panel-upgrade')||150,
    solarElecUpgrade:n('s-solar-elec-upgrade')||2500,
    solarRoofReinforce:n('s-solar-roof-reinforce')||1500,
    solarFedCredit:n('s-solar-fed-credit')||30,
    solarStateRebate:n('s-solar-state-rebate')||0,
    solarUtilityRebate:n('s-solar-utility-rebate')||0,
    solarMonthlySavings:n('s-solar-monthly-savings')||150,
    solarOverhead:n('s-solar-ovh')||12,
    solarMargin:n('s-solar-mgn')||18,
    solarTax:n('s-solar-tax')||0,
    solarFinEnabled:ck('s-solar-fin-enabled'),
    solarFinApr:parseFloat(v('s-solar-fin-apr'))||4.99,
    solarFinTerm:parseInt(v('s-solar-fin-term'))||180,
    // ── Fencing pricing ──
    fenWood:ck('s-fen-wood'), fenVinyl:ck('s-fen-vinyl'), fenChain:ck('s-fen-chain'),
    fenAluminum:ck('s-fen-aluminum'), fenSplit:ck('s-fen-split'), fenCedar:ck('s-fen-cedar'),
    fenWoodPlf:n('s-fen-wood-plf')||28, fenVinylPlf:n('s-fen-vinyl-plf')||35,
    fenChainPlf:n('s-fen-chain-plf')||18, fenAlumPlf:n('s-fen-alum-plf')||45,
    fenSplitPlf:n('s-fen-split-plf')||22, fenCedarPlf:n('s-fen-cedar-plf')||38,
    fenGateSingle:n('s-fen-gate-single')||350, fenGateDouble:n('s-fen-gate-double')||650,
    fenRemoval:n('s-fen-removal')||5, fenPostConcrete:n('s-fen-post-concrete')||25,
    fenOverhead:n('s-fen-ovh')||15, fenMargin:n('s-fen-mgn')||20, fenTax:n('s-fen-tax')||0,
    fenFinEnabled:ck('s-fen-fin-enabled'),
    fenFinApr:parseFloat(v('s-fen-fin-apr'))||9.99,
    fenFinTerm:parseInt(v('s-fen-fin-term'))||60,
    // ── Siding pricing ──
    sidVinyl:ck('s-sid-vinyl'), sidHardie:ck('s-sid-hardie'), sidWood:ck('s-sid-wood'),
    sidEngWood:ck('s-sid-eng-wood'), sidMetal:ck('s-sid-metal'), sidStucco:ck('s-sid-stucco'),
    sidVinylPsf:parseFloat(v('s-sid-vinyl-psf'))||4.50,
    sidHardiePsf:parseFloat(v('s-sid-hardie-psf'))||8.00,
    sidWoodPsf:parseFloat(v('s-sid-wood-psf'))||7.00,
    sidEngWoodPsf:parseFloat(v('s-sid-engwood-psf'))||6.50,
    sidMetalPsf:parseFloat(v('s-sid-metal-psf'))||9.00,
    sidStuccoPsf:parseFloat(v('s-sid-stucco-psf'))||10.00,
    sidRemoval:parseFloat(v('s-sid-removal'))||1.50,
    sidHousewrap:parseFloat(v('s-sid-housewrap'))||0.75,
    sidTrim:parseFloat(v('s-sid-trim'))||6.00,
    sidCorners:n('s-sid-corners')||45,
    sidWindowWrap:n('s-sid-window-wrap')||85,
    sidInsulation:parseFloat(v('s-sid-insulation'))||0.50,
    sidOverhead:n('s-sid-ovh')||15,
    sidMargin:n('s-sid-mgn')||20,
    sidTax:n('s-sid-tax')||0,
    sidFinEnabled:ck('s-sid-fin-enabled'),
    sidFinApr:parseFloat(v('s-sid-fin-apr'))||9.99,
    sidFinTerm:parseInt(v('s-sid-fin-term'))||60,
    // ── Gutters pricing ──
    gutAlum5:parseFloat(v('s-gut-alum5'))||6.00, gutAlum6:parseFloat(v('s-gut-alum6'))||8.00,
    gutSeamless:parseFloat(v('s-gut-seamless'))||9.00, gutCopper:parseFloat(v('s-gut-copper'))||22.00,
    gutHalfrnd:parseFloat(v('s-gut-halfrnd'))||10.00, gutVinyl:parseFloat(v('s-gut-vinyl'))||4.50,
    gutGuard:parseFloat(v('s-gut-guard'))||5.00, gutDownspout:n('s-gut-downspout')||75,
    gutDsExt:n('s-gut-ds-ext')||25, gutRemoval:parseFloat(v('s-gut-removal'))||1.50,
    gutFascia:parseFloat(v('s-gut-fascia'))||8.00, gutEndcaps:n('s-gut-endcaps')||12,
    gutOverhead:n('s-gut-ovh')||15, gutMargin:n('s-gut-mgn')||20, gutTax:n('s-gut-tax')||0,
    gutFinEnabled:ck('s-gut-fin-enabled'), gutFinApr:parseFloat(v('s-gut-fin-apr'))||9.99, gutFinTerm:parseInt(v('s-gut-fin-term'))||36,
    // ── Insulation pricing ──
    insBlowR30:parseFloat(v('s-ins-blow-r30'))||1.20, insBlowR38:parseFloat(v('s-ins-blow-r38'))||1.50,
    insCellR30:parseFloat(v('s-ins-cell-r30'))||1.10, insCellR38:parseFloat(v('s-ins-cell-r38'))||1.40,
    insFoamOpen:parseFloat(v('s-ins-foam-open'))||1.50, insFoamClosed:parseFloat(v('s-ins-foam-closed'))||3.00,
    insBattR13:parseFloat(v('s-ins-batt-r13'))||0.65, insBattR19:parseFloat(v('s-ins-batt-r19'))||0.85,
    insRemoval:parseFloat(v('s-ins-removal'))||0.75, insAirsealing:n('s-ins-airsealing')||350,
    insVapor:parseFloat(v('s-ins-vapor'))||0.45, insHatch:n('s-ins-hatch')||125,
    insOverhead:n('s-ins-ovh')||15, insMargin:n('s-ins-mgn')||20, insTax:n('s-ins-tax')||0,
    insFinEnabled:ck('s-ins-fin-enabled'), insFinApr:parseFloat(v('s-ins-fin-apr'))||9.99, insFinTerm:parseInt(v('s-ins-fin-term'))||36,
    // ── Exterior Paint pricing ──
    pntSiding1c:parseFloat(v('s-pnt-siding-1c'))||1.50, pntSiding2c:parseFloat(v('s-pnt-siding-2c'))||2.25,
    pntTrim1c:parseFloat(v('s-pnt-trim-1c'))||2.00, pntTrim2c:parseFloat(v('s-pnt-trim-2c'))||3.00,
    pntDeck1c:parseFloat(v('s-pnt-deck-1c'))||1.75, pntDeck2c:parseFloat(v('s-pnt-deck-2c'))||2.75,
    pntMasonry:parseFloat(v('s-pnt-masonry'))||2.50, pntGarageDoor:n('s-pnt-garage-door')||150,
    pntPowerwash:parseFloat(v('s-pnt-powerwash'))||0.35, pntCaulk:parseFloat(v('s-pnt-caulk'))||1.25,
    pntPrimer:parseFloat(v('s-pnt-primer'))||0.50, pntStain:parseFloat(v('s-pnt-stain'))||1.80,
    pntOverhead:n('s-pnt-ovh')||15, pntMargin:n('s-pnt-mgn')||20, pntTax:n('s-pnt-tax')||0,
    pntFinEnabled:ck('s-pnt-fin-enabled'), pntFinApr:parseFloat(v('s-pnt-fin-apr'))||9.99, pntFinTerm:parseInt(v('s-pnt-fin-term'))||24,
    // ── Doors pricing ──
    dorSteelEntry:n('s-dor-steel-entry')||850, dorFiberEntry:n('s-dor-fiber-entry')||1200,
    dorWoodEntry:n('s-dor-wood-entry')||1500, dorDoubleEntry:n('s-dor-double-entry')||2800,
    dorStormStd:n('s-dor-storm-std')||450, dorStormFull:n('s-dor-storm-full')||650,
    dorScreen:n('s-dor-screen')||300, dorSliding:n('s-dor-sliding')||1800,
    dorGarageSingle:n('s-dor-garage-single')||1100, dorGarageDouble:n('s-dor-garage-double')||1800,
    dorGarageInsul:n('s-dor-garage-insul')||1400, dorOpener:n('s-dor-opener')||350,
    dorFrameRepair:n('s-dor-frame-repair')||200, dorHardware:n('s-dor-hardware')||125,
    dorWeatherstrip:n('s-dor-weatherstrip')||75, dorPaint:n('s-dor-paint')||150,
    dorOverhead:n('s-dor-ovh')||15, dorMargin:n('s-dor-mgn')||20, dorTax:n('s-dor-tax')||0,
    winDblHung:n('s-win-dbl-hung')||450, winCasement:n('s-win-casement')||550, winPicture:n('s-win-picture')||400,
    winSliding:n('s-win-sliding')||480, winBay:n('s-win-bay')||1800, winSkylight:n('s-win-skylight')||1200,
    winStorm:n('s-win-storm')||200, winEgress:n('s-win-egress')||2500,
    winLowe:n('s-win-lowe')||75, winTriple:n('s-win-triple')||120, winTrim:n('s-win-trim')||85, winRemoval:n('s-win-removal')||50,
    winCntSm:n('s-win-cnt-sm')||9, winCntMd:n('s-win-cnt-md')||13, winCntLg:n('s-win-cnt-lg')||18, winCntXl:n('s-win-cnt-xl')||25,
    winOverhead:n('s-win-ovh')||15, winMargin:n('s-win-mgn')||20, winTax:n('s-win-tax')||0,
    dorFinEnabled:ck('s-dor-fin-enabled'), dorFinApr:parseFloat(v('s-dor-fin-apr'))||9.99, dorFinTerm:parseInt(v('s-dor-fin-term'))||36,
    brandColor:v('s-color')||'#F25C05',
    ghlApiKey:v('s-ghl-key'),
    ghlLocationId:v('s-ghl-loc'),
    ghlPipelineId:v('s-ghl-pipe'),
    ghlStageId:document.getElementById('s-ghl-stage').value||'',
    ghlSmsTpl:v('s-ghl-sms-tpl')||DEFAULTS.ghlSmsTpl,
    ghlEmailTpl:v('s-ghl-email-tpl')||DEFAULTS.ghlEmailTpl,
    jnApiKey:(document.getElementById('s-jn-key')||{}).value||'',
    jobberApiKey:(document.getElementById('s-jobber-key')||{}).value||'',
    webhookUrl:(document.getElementById('s-webhook-url')||{}).value||'',
    jnRecordType:(document.getElementById('s-jn-record-type')||{}).value||'Customer',
    jnStatus:(document.getElementById('s-jn-status')||{}).value||'Lead',
    // lobKey and rentcastKey intentionally excluded from client cfg — master keys at agency level only
    logoData:S.cfg.logoData||null,
    headshot:S.cfg.headshot||null,
    review1:S.cfg.review1||null,
    review2:S.cfg.review2||null,
    postcardStep2:S.cfg.postcardStep2||null,
    postcardStep3:S.cfg.postcardStep3||null,
    postcardStep4:S.cfg.postcardStep4||null,
    drip2Headline: (document.getElementById('s-drip2-headline')||{}).value || S.cfg.drip2Headline || 'Still thinking it over?',
    drip2Subtext:  (document.getElementById('s-drip2-subtext')||{}).value  || S.cfg.drip2Subtext  || "Your estimate is still valid. We'd love to help.",
    drip3Headline: (document.getElementById('s-drip3-headline')||{}).value || S.cfg.drip3Headline || 'Storm season is coming.',
    drip3Subtext:  (document.getElementById('s-drip3-subtext')||{}).value  || S.cfg.drip3Subtext  || "Now's the time to protect your home. Call us today.",
    drip4Headline: (document.getElementById('s-drip4-headline')||{}).value || S.cfg.drip4Headline || 'Final notice.',
    drip4Subtext:  (document.getElementById('s-drip4-subtext')||{}).value  || S.cfg.drip4Subtext  || 'Your estimate expires soon. Secure your spot before prices rise.',
    drip5Headline: (document.getElementById('s-drip5-headline')||{}).value || S.cfg.drip5Headline || "We're still here for you.",
    drip5Subtext:  (document.getElementById('s-drip5-subtext')||{}).value  || S.cfg.drip5Subtext  || "Your roof won't fix itself. Let's get started today.",
    drip6Headline: (document.getElementById('s-drip6-headline')||{}).value || S.cfg.drip6Headline || 'One last thing...',
    drip6Subtext:  (document.getElementById('s-drip6-subtext')||{}).value  || S.cfg.drip6Subtext  || "We'd love to earn your business. Call us anytime.",
    repTitle:document.getElementById('s-reptitle').value||'',
    headshotPos:document.getElementById('s-hspos').value||'30',
    bookingUrl:document.getElementById('s-bookingurl').value||'',
    leadAlertEmail:document.getElementById('s-lead-alert-email').value.trim()||'',
    dripEnabled: isAdminOrAbove() ? !!(document.getElementById('s-drip-enabled') && document.getElementById('s-drip-enabled').checked) : (S.cfg.dripEnabled||false),
    companyBio: (document.getElementById('s-bio')||{}).value || '',
    metaPixelId: (document.getElementById('s-meta-pixel-id')||{}).value || '',
    googleTagId: (document.getElementById('s-google-tag-id')||{}).value || '',
    googlePlaceId: (document.getElementById('s-google-place-id')||{}).value || '',
    // ── Trade system (Build 10) ──
    // tradePricingJson: built from all trade pricing fields above — persisted as JSONB blob
    tradePricingJson: _buildTradePricingJson(),
    // tradeStatuses: read from trade status settings UI
    tradeStatuses: _readTradeStatuses(),
    // tradePostcardCopy: read from trade postcard copy UI
    tradePostcardCopy: _readTradePostcardCopy(),
    // Preserve QB/CompanyCam tokens (not editable in Settings UI, set via dedicated flows)
    companyCamKey: S.cfg.companyCamKey||null,
    qbAccessToken: S.cfg.qbAccessToken||null,
    qbRefreshToken: S.cfg.qbRefreshToken||null,
    qbRealmId: S.cfg.qbRealmId||null
  };
  applyBrand();save();updatePreview();
  // Update solar add-on row visibility immediately after save
  const _solarRowAfterSave=document.getElementById('solar-addon-row');
  if(_solarRowAfterSave) _solarRowAfterSave.style.display=S.cfg.offerSolar?'block':'none';
  // Super admin: persist master Lob and RentCast keys directly to agency account row (never touches client rows)
  if(isSuperAdmin() && sb){
    const newLobKey = document.getElementById('s-lob') ? document.getElementById('s-lob').value.trim() : '';
    const newRcKey  = document.getElementById('s-rentcast-key') ? document.getElementById('s-rentcast-key').value.trim() : '';
    const updates = {};
    if(newLobKey !== masterLobKey){ masterLobKey = newLobKey; updates.lob_key = newLobKey; }
    if(newRcKey  !== masterRentcastKey){ masterRentcastKey = newRcKey; updates.rentcast_key = newRcKey; }
    if(Object.keys(updates).length){
      sb.from('accounts').update(updates).eq('id', AGENCY_ACCOUNT_ID)
        .then(({error})=>{ if(error) console.warn('Master key save error:',error.message); });
    }
  }
  toast('Settings saved!','success');
}

function applyBrand(){
  // Update solar add-on row visibility based on current cfg
  const _solarRowBrand=document.getElementById('solar-addon-row');
  if(_solarRowBrand) _solarRowBrand.style.display=(S.cfg&&S.cfg.offerSolar)?'block':'none';
  const aheImg = document.getElementById('ahe-hdr-logo');
  if(aheImg) aheImg.src = AHE_LOGO;
  const loginLogo = document.getElementById('ahe-login-logo');
  if(loginLogo) loginLogo.src = AHE_LOGO;
  const loginLogoTop = document.getElementById('ahe-login-logo-top');
  if(loginLogoTop) loginLogoTop.src = AHE_LOGO;
  // NOTE: --accent is always fixed BidDrop orange (#F25C05) for the app UI.
  // Brand color (S.cfg.brandColor) is only used in postcard/letter print output.
  // Do NOT change --accent here.
  const coSubEl = document.getElementById('co-sub');
  if(coSubEl){
    if(isSuperAdmin()){
      coSubEl.style.display='none'; // switcher replaces it for super_admin
    } else {
      coSubEl.style.display='';
      coSubEl.textContent=S.cfg.companyName?' · '+S.cfg.companyName:'';
    }
  }
  // Update switcher label if visible
  updateCoSwitcherLabel();
}

function hexToRgba(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

