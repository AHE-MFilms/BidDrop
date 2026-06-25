// BidDrop — API layer: adminAPI, localStorage persistence, Supabase account sync
// Depends on: state.js (sb, S, currentAccount, currentProfile, isAdminOrAbove, DEFAULTS)

function load(){
  // localStorage fallback for offline/before auth
  try{const d=localStorage.getItem('bd_v1');if(d){const p=JSON.parse(d);S.cfg={...S.cfg,...(p.cfg||{})};}}catch(e){}
}

function save(){
  // Always save cfg to localStorage as cache
  try{localStorage.setItem('bd_v1',JSON.stringify({cfg:S.cfg}));}catch(e){}
  // If logged in, persist account config to Supabase
  if(currentAccount && sb && isAdminOrAbove()){
    syncAccountToSupabase().catch(e=>console.warn('Supabase save error:',e));
  }
}

async function syncAccountToSupabase(){
  if(!currentAccount) return;
  const cfg = S.cfg;
  // ── Core save (all columns that exist in the original schema) ──
  const {error: syncErr} = await sb.from('accounts').update({
    company_name: cfg.companyName, company_phone: cfg.companyPhone,
    company_addr: cfg.companyAddr, rep_name: cfg.repName,
    rep_title: cfg.repTitle, license_num: cfg.licenseNum,
    years_in_business: cfg.yearsInBusiness, warranty_years: cfg.warrantyYears,
    brand_color: cfg.brandColor, booking_url: cfg.bookingUrl, lead_alert_email: cfg.leadAlertEmail||null,
    hook_letter: cfg.hookLetter, why_received: cfg.whyReceived,
    postcard_hook: cfg.postcardHook, postcard_why: cfg.postcardWhy,
    postcard_quote: cfg.postcardQuote, postcard_guarantee: cfg.postcardGuarantee,
    postcard_headline1: cfg.postcardHeadline1||null,
    postcard_headline2: cfg.postcardHeadline2||null,
    postcard_badge_text: cfg.postcardBadgeText||null,
    postcard_badge_color: cfg.postcardBadgeColor||null,
    postcard_back_badge_text: cfg.postcardBackBadgeText||null,
    postcard_back_badge_color: cfg.postcardBackBadgeColor||null,
    postcard_scan_cta: cfg.postcardScanCta||null,
    postcard_scan_sub: cfg.postcardScanSub||null,
    postcard_photo_layout: cfg.postcardPhotoLayout||'single',
    postcard_show_price: cfg.postcardShowPrice!==false,
    postcard_show_monthly: cfg.postcardShowMonthly!==false,
    postcard_show_phone: cfg.postcardShowPhone!==false,
    postcard_hl1_size: cfg.postcardHl1Size||160,
    postcard_hl2_size: cfg.postcardHl2Size||160,
    postcard_hook_size: cfg.postcardHookSize||36,
    postcard_why_size: cfg.postcardWhySize||30,
    postcard_quote_size: cfg.postcardQuoteSize||32,
    postcard_guar_size: cfg.postcardGuarSize||26,
    postcard_phone_size: cfg.postcardPhoneSize||42,
    postcard_addr_size: cfg.postcardAddrSize||62,
    postcard_price_size: cfg.postcardPriceSize||78,
    financing_enabled: cfg.financingEnabled, financing_apr: cfg.financingApr,
    financing_term: cfg.financingTerm, financing_down: cfg.financingDown,
    diff1: cfg.diff1, diff2: cfg.diff2, diff3: cfg.diff3,
    diff4: cfg.diff4, diff5: cfg.diff5, diff6: cfg.diff6,
    // rep_video_url_default omitted — column not in DB schema
    offer_siding: cfg.offerSiding, offer_windows: cfg.offerWindows,
    offer_gutters: cfg.offerGutters, offer_custom: cfg.offerCustom,
    offer_solar: cfg.offerSolar,
    cost_solar_per_watt: cfg.costSolarPerWatt||3.50,
    referral_amt: cfg.referralAmt, referral_text: cfg.referralText,
    cost_architectural: cfg.costArchitectural, cost_3tab: cfg.cost3Tab,
    cost_designer: cfg.costDesigner, cost_metal: cfg.costMetal,
    cost_tearoff: cfg.costTearoff, cost_ice_water: cfg.costIceWater,
    cost_felts: cfg.costFelts, cost_dumpster: cfg.costDumpster,
    cost_skylight: cfg.costSkylight, cost_chimney: cfg.costChimney,
    cost_gutter: cfg.costGutter, overhead: cfg.overhead, margin: cfg.margin,
    ghl_api_key: cfg.ghlApiKey, ghl_location_id: cfg.ghlLocationId,
    ghl_pipeline_id: cfg.ghlPipelineId, ghl_stage_id: cfg.ghlStageId,
    ghl_sms_tpl: cfg.ghlSmsTpl||null, ghl_email_tpl: cfg.ghlEmailTpl||null,
    jn_api_key: cfg.jnApiKey||null, jn_record_type: cfg.jnRecordType||null, jn_status: cfg.jnStatus||null,
    jobber_api_key: cfg.jobberApiKey||null, webhook_url: cfg.webhookUrl||null,
    // lob_key and rentcast_key intentionally omitted — both are master keys stored only on the agency account row
    logo_data: cfg.logoData,
    headshot: cfg.headshot, headshot_pos: cfg.headshotPos,
    review1: cfg.review1, review2: cfg.review2,
    postcard_step2: cfg.postcardStep2||null,
    postcard_step3: cfg.postcardStep3||null,
    postcard_step4: cfg.postcardStep4||null,
    drip2_headline: cfg.drip2Headline||null,
    drip2_subtext:  cfg.drip2Subtext||null,
    drip3_headline: cfg.drip3Headline||null,
    drip3_subtext:  cfg.drip3Subtext||null,
    drip4_headline: cfg.drip4Headline||null,
    drip4_subtext:  cfg.drip4Subtext||null,
    drip5_headline: cfg.drip5Headline||null,
    drip5_subtext:  cfg.drip5Subtext||null,
    drip6_headline: cfg.drip6Headline||null,
    drip6_subtext:  cfg.drip6Subtext||null,
    drip_enabled: cfg.dripEnabled||false,
    drip_steps_json: cfg.dripStepsJson ? JSON.stringify(cfg.dripStepsJson) : null,
    postcard_designs_json: (cfg.postcardDesigns && cfg.postcardDesigns.length) ? JSON.stringify(cfg.postcardDesigns) : null,
    company_bio: cfg.companyBio||null,
    meta_pixel_id: cfg.metaPixelId||null,
    google_tag_id: cfg.googleTagId||null,
    google_place_id: cfg.googlePlaceId||null,
    tax_rate: cfg.taxRate||0
  }).eq('id', currentAccount.id);
  if(syncErr) console.error('[BidDrop] syncAccountToSupabase error:', syncErr.message, syncErr);
  else console.log('[BidDrop] Account synced to Supabase OK');

  // ── Build 10 columns: trade system + QB/CompanyCam (added via run-migration) ──
  // Saved separately so a missing column doesn't break the core save above
  const b10payload = {};
  if(cfg.tradePricingJson !== undefined) b10payload.trade_pricing_json = cfg.tradePricingJson ? JSON.stringify(cfg.tradePricingJson) : null;
  if(cfg.tradeStatuses !== undefined)    b10payload.trade_statuses_json = cfg.tradeStatuses ? JSON.stringify(cfg.tradeStatuses) : null;
  if(cfg.tradePostcardCopy !== undefined) b10payload.trade_postcard_copy_json = cfg.tradePostcardCopy ? JSON.stringify(cfg.tradePostcardCopy) : null;
  if(cfg.companyCamKey !== undefined)    b10payload.companycam_key = cfg.companyCamKey||null;
  if(cfg.qbAccessToken !== undefined)    b10payload.qb_access_token = cfg.qbAccessToken||null;
  if(cfg.qbRefreshToken !== undefined)   b10payload.qb_refresh_token = cfg.qbRefreshToken||null;
  if(cfg.qbRealmId !== undefined)        b10payload.qb_realm_id = cfg.qbRealmId||null;
  // Template designer fields (Build 11)
  if(cfg.tplHeadline1 !== undefined)    b10payload.tpl_headline1 = cfg.tplHeadline1||null;
  if(cfg.tplHeadline2 !== undefined)    b10payload.tpl_headline2 = cfg.tplHeadline2||null;
  if(cfg.tplSubhead !== undefined)      b10payload.tpl_subhead = cfg.tplSubhead||null;
  if(cfg.tplBullet1 !== undefined)      b10payload.tpl_bullet1 = cfg.tplBullet1||null;
  if(cfg.tplBullet2 !== undefined)      b10payload.tpl_bullet2 = cfg.tplBullet2||null;
  if(cfg.tplBullet3 !== undefined)      b10payload.tpl_bullet3 = cfg.tplBullet3||null;
  if(cfg.tplCtaLabel !== undefined)     b10payload.tpl_cta_label = cfg.tplCtaLabel||null;
  if(cfg.tplAccentColor !== undefined)  b10payload.tpl_accent_color = cfg.tplAccentColor||null;
  if(cfg.tplHeroUrl !== undefined)      b10payload.tpl_hero_url = cfg.tplHeroUrl||null;
  if(cfg.tplLogoScale !== undefined)    b10payload.tpl_logo_scale = cfg.tplLogoScale != null ? cfg.tplLogoScale : null;
  if(cfg.tplHeroScale !== undefined)    b10payload.tpl_hero_scale = cfg.tplHeroScale != null ? cfg.tplHeroScale : null;
  if(cfg.tplLogoWhiten !== undefined)   b10payload.tpl_logo_whiten = cfg.tplLogoWhiten != null ? cfg.tplLogoWhiten : null;
  // Pixel fields (Build 12)
  if(cfg.pixelId !== undefined)              b10payload.pixel_id = cfg.pixelId||null;
  if(cfg.pixelResolutionKey !== undefined)   b10payload.pixel_resolution_key = cfg.pixelResolutionKey||null;
  // Canvas designer fields (Build 13) — new Fabric-based postcard designer
  if(cfg.canvasDesignFrontJson !== undefined) b10payload.canvas_design_front_json = cfg.canvasDesignFrontJson ? JSON.stringify(cfg.canvasDesignFrontJson) : null;
  if(cfg.canvasDesignBackJson !== undefined)  b10payload.canvas_design_back_json  = cfg.canvasDesignBackJson  ? JSON.stringify(cfg.canvasDesignBackJson)  : null;
  if(cfg.canvasTemplateId !== undefined)      b10payload.canvas_template_id       = cfg.canvasTemplateId||null;
  if(cfg.canvasTemplateName !== undefined)    b10payload.canvas_template_name     = cfg.canvasTemplateName||null;
  if(Object.keys(b10payload).length){
    const {error: b10Err} = await sb.from('accounts').update(b10payload).eq('id', currentAccount.id);
    if(b10Err) console.warn('[BidDrop] Build 10 columns not yet migrated (run Admin → Run Migration):', b10Err.message);
  }
}

function accountRowToCfg(row){
  return {
    companyName: row.company_name||'Your Roofing Co',
    companyPhone: row.company_phone||'',
    companyAddr: row.company_addr||'',
    repName: row.rep_name||'', repTitle: row.rep_title||'',
    licenseNum: row.license_num||'',
    yearsInBusiness: row.years_in_business||'5+',
    warrantyYears: row.warranty_years||'10',
    brandColor: row.brand_color||'#F25C05',
    bookingUrl: row.booking_url||'',
    leadAlertEmail: row.lead_alert_email||'',
    hookLetter: row.hook_letter||DEFAULTS.hookLetter,
    whyReceived: row.why_received||DEFAULTS.whyReceived,
    postcardHook: row.postcard_hook||DEFAULTS.postcardHook,
    postcardWhy: row.postcard_why||DEFAULTS.postcardWhy,
    postcardQuote: row.postcard_quote||DEFAULTS.postcardQuote,
    postcardGuarantee: row.postcard_guarantee||DEFAULTS.postcardGuarantee,
    postcardHeadline1: row.postcard_headline1||'We Assessed',
    postcardHeadline2: row.postcard_headline2||'Your Roof.',
    postcardBadgeText: row.postcard_badge_text||'YOUR ROOF ESTIMATE IS READY',
    postcardBadgeColor: row.postcard_badge_color||row.brand_color||'#F25C05',
    postcardBackBadgeText: row.postcard_back_badge_text||'YOUR ROOF ESTIMATE IS READY',
    postcardBackBadgeColor: row.postcard_back_badge_color||row.brand_color||'#F25C05',
    postcardScanCta: row.postcard_scan_cta||'SCAN TO BOOK',
    postcardScanSub: row.postcard_scan_sub||'No-pressure booking',
    postcardPhotoLayout: row.postcard_photo_layout||'single',
    postcardShowPrice: row.postcard_show_price!==false,
    postcardShowMonthly: row.postcard_show_monthly!==false,
    postcardShowPhone: row.postcard_show_phone!==false,
    postcardHl1Size: row.postcard_hl1_size||160,
    postcardHl2Size: row.postcard_hl2_size||160,
    postcardHookSize: row.postcard_hook_size||36,
    postcardWhySize: row.postcard_why_size||30,
    postcardQuoteSize: row.postcard_quote_size||32,
    postcardGuarSize: row.postcard_guar_size||26,
    postcardPhoneSize: row.postcard_phone_size||42,
    postcardAddrSize: row.postcard_addr_size||62,
    postcardPriceSize: row.postcard_price_size||78,
    financingEnabled: row.financing_enabled!==false,
    financingApr: row.financing_apr||9.99,
    financingTerm: row.financing_term||60,
    financingDown: row.financing_down||0,
    diff1: row.diff1||'Licensed, Bonded & Insured',
    diff2: row.diff2||'Manufacturer Certified',
    diff3: row.diff3||'Itemized Pricing for Transparency',
    diff4: row.diff4||'Workmanship Warranty',
    diff5: row.diff5||'Financing Available',
    diff6: row.diff6||'Local Crews',
    offerSiding: row.offer_siding!==false,
    offerWindows: !!row.offer_windows,
    offerGutters: row.offer_gutters!==false,
    repVideoUrl: row.rep_video_url_default||'',
    offerSolar: !!row.offer_solar,
    offerCustom: row.offer_custom||'',
    costSolarPerWatt: parseFloat(row.cost_solar_per_watt)||3.50,
    referralAmt: row.referral_amt||'250',
    referralText: row.referral_text||'',
    costArchitectural: row.cost_architectural||300,
    cost3Tab: row.cost_3tab||220,
    costDesigner: row.cost_designer||420,
    costMetal: row.cost_metal||680,
    costTearoff: row.cost_tearoff||75,
    costIceWater: row.cost_ice_water||42,
    costFelts: row.cost_felts||22,
    costDumpster: row.cost_dumpster||450,
    costSkylight: row.cost_skylight||375,
    costChimney: row.cost_chimney||295,
    costGutter: row.cost_gutter||9,
    overhead: row.overhead||15,
    margin: row.margin||20,
    ghlApiKey: row.ghl_api_key||'',
    ghlLocationId: row.ghl_location_id||'',
    ghlPipelineId: row.ghl_pipeline_id||'',
    ghlStageId: row.ghl_stage_id||'',
    ghlSmsTpl: row.ghl_sms_tpl||DEFAULTS.ghlSmsTpl,
    ghlEmailTpl: row.ghl_email_tpl||DEFAULTS.ghlEmailTpl,
    jnApiKey: row.jn_api_key||'',
    jobberApiKey: row.jobber_api_key||'',
    webhookUrl: row.webhook_url||'',
    jnRecordType: row.jn_record_type||'Customer',
    jnStatus: row.jn_status||'Lead',
    // lobKey and rentcastKey intentionally not loaded from client account rows — master keys used at agency level
    logoData: row.logo_data||null,
    headshot: row.headshot||null,
    headshotPos: row.headshot_pos||'30',
    review1: row.review1||null,
    review2: row.review2||null,
    postcardStep2: row.postcard_step2||null,
    postcardStep3: row.postcard_step3||null,
    postcardStep4: row.postcard_step4||null,
    drip2Headline: row.drip2_headline||null,
    drip2Subtext:  row.drip2_subtext||null,
    drip3Headline: row.drip3_headline||null,
    drip3Subtext:  row.drip3_subtext||null,
    drip4Headline: row.drip4_headline||null,
    drip4Subtext:  row.drip4_subtext||null,
    drip5Headline: row.drip5_headline||null,
    drip5Subtext:  row.drip5_subtext||null,
    drip6Headline: row.drip6_headline||null,
    drip6Subtext:  row.drip6_subtext||null,
    dripEnabled: row.drip_enabled||false,
    dripStepsJson: row.drip_steps_json ? (typeof row.drip_steps_json==='string' ? JSON.parse(row.drip_steps_json) : row.drip_steps_json) : null,
    postcardDesigns: row.postcard_designs_json ? (typeof row.postcard_designs_json==='string' ? JSON.parse(row.postcard_designs_json) : row.postcard_designs_json) : [],
    plan:             (row.plan||'starter').toLowerCase(),
    enablePostcard:   row.enable_postcard!==false,
    enableLetter:     row.enable_letter!==false,
    lookupCredits:    row.lookup_credits    || 0,
    freeLookupsUsed:  row.free_lookups_used || 0,
    freeLookupsReset: row.free_lookups_reset|| null,
    freeLookupsLimit: row.free_lookups_limit || 20,
    mailerCredits:          row.mailer_credits           || 0,
    freeMailerCreditsUsed:  row.free_mailer_credits_used || 0,
    freeMailerCreditsReset: row.free_mailer_credits_reset|| null,
    companyBio: row.company_bio || '',
    metaPixelId: row.meta_pixel_id || '',
    googleTagId: row.google_tag_id || '',
    googlePlaceId: row.google_place_id || '',
    taxRate: parseFloat(row.tax_rate)||0,
    enabledTrades: (()=>{
      const arr = Array.isArray(row.enabled_trades) ? row.enabled_trades : ['roofing'];
      const obj = {};
      arr.forEach(t => { obj[t] = true; });
      return obj;
    })(),
    // ── Trade system (Build 10) ──
    tradePricingJson: row.trade_pricing_json ? (typeof row.trade_pricing_json==='string' ? JSON.parse(row.trade_pricing_json) : row.trade_pricing_json) : null,
    tradeStatuses: row.trade_statuses_json ? (typeof row.trade_statuses_json==='string' ? JSON.parse(row.trade_statuses_json) : row.trade_statuses_json) : null,
    tradePostcardCopy: row.trade_postcard_copy_json ? (typeof row.trade_postcard_copy_json==='string' ? JSON.parse(row.trade_postcard_copy_json) : row.trade_postcard_copy_json) : null,
    companyCamKey: row.companycam_key||null,
    qbAccessToken: row.qb_access_token||null,
    qbRefreshToken: row.qb_refresh_token||null,
    qbRealmId: row.qb_realm_id||null,
    // ── Template designer fields (Build 11) ──
    tplHeadline1:   row.tpl_headline1||null,
    tplHeadline2:   row.tpl_headline2||null,
    tplSubhead:     row.tpl_subhead||null,
    tplBullet1:     row.tpl_bullet1||null,
    tplBullet2:     row.tpl_bullet2||null,
    tplBullet3:     row.tpl_bullet3||null,
    tplCtaLabel:    row.tpl_cta_label||null,
    tplAccentColor: row.tpl_accent_color||null,
    tplHeroUrl:     row.tpl_hero_url||null,
    tplLogoScale:   row.tpl_logo_scale != null ? row.tpl_logo_scale : null,
    tplHeroScale:   row.tpl_hero_scale != null ? row.tpl_hero_scale : null,
    tplLogoWhiten:  row.tpl_logo_whiten != null ? row.tpl_logo_whiten : null,
    // ── Pixel fields (Build 12) ──
    pixelId:             row.pixel_id||null,
    pixelResolutionKey:  row.pixel_resolution_key||null,
    // ── Canvas designer fields (Build 13) ──
    canvasDesignFrontJson: row.canvas_design_front_json ? (typeof row.canvas_design_front_json==='string' ? JSON.parse(row.canvas_design_front_json) : row.canvas_design_front_json) : null,
    canvasDesignBackJson:  row.canvas_design_back_json  ? (typeof row.canvas_design_back_json==='string'  ? JSON.parse(row.canvas_design_back_json)  : row.canvas_design_back_json)  : null,
    canvasTemplateId:   row.canvas_template_id||null,
    canvasTemplateName: row.canvas_template_name||null,
  };
}
