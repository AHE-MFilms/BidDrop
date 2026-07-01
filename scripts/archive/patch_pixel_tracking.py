"""
Patch script: Add Meta Pixel + Google Tag retargeting to BidDrop
Changes:
  1. index.html — Settings UI: add Meta Pixel ID + Google Tag ID fields
  2. index.html — accountRowToCfg: map new DB fields
  3. index.html — syncAccountToSupabase: persist new fields
  4. index.html — saveSettings: read new fields from form
  5. index.html — QR URL in postcards: use biddrop.us/e/{id} instead of estimate.biddrop.us
  6. index.html — updatePreview QR: use estimate page URL when estimate ID exists
  7. api/estimate.js — return metaPixelId + googleTagId in account object
  8. estimate.html — fire Meta Pixel + Google Tag events on page load and CTA clicks
"""

import re

# ─────────────────────────────────────────────────────────────────────────────
# 1. index.html patches
# ─────────────────────────────────────────────────────────────────────────────
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1a. Settings UI: add pixel fields after s-bio ────────────────────────────
old_bio_field = '          <div class="fg stab-full" style="margin-top:4px;"><label class="fl">Company Bio <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);font-size:10px;">&#8212; shown on homeowner estimate pages</span></label><textarea class="fi" id="s-bio" rows="3" placeholder="We\'re a family-owned roofing company serving Metro Detroit for 20+ years. We specialize in storm damage restoration and insurance claims, making the process seamless for homeowners." style="resize:vertical;min-height:80px;"></textarea></div>\n        </div>\n      </div>\n      <!-- FULL WIDTH: Share & Embed -->'

new_bio_field = '''          <div class="fg stab-full" style="margin-top:4px;"><label class="fl">Company Bio <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);font-size:10px;">&#8212; shown on homeowner estimate pages</span></label><textarea class="fi" id="s-bio" rows="3" placeholder="We\'re a family-owned roofing company serving Metro Detroit for 20+ years. We specialize in storm damage restoration and insurance claims, making the process seamless for homeowners." style="resize:vertical;min-height:80px;"></textarea></div>
          <!-- Retargeting Pixels -->
          <div style="margin-top:18px;padding:14px;background:rgba(59,130,246,.07);border:1px solid rgba(59,130,246,.2);border-radius:10px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#3B82F6;margin-bottom:10px;">&#127919; Retargeting Pixels <span style="font-size:9px;font-weight:600;padding:2px 7px;border-radius:10px;background:#3B82F6;color:#fff;margin-left:6px;">PRO+</span></div>
            <div style="font-size:11px;color:var(--muted);margin-bottom:12px;">When a homeowner scans your postcard QR code and views their estimate page, BidDrop fires your pixel events automatically — building your retargeting audience in Meta Ads &amp; Google Ads.</div>
            <div class="frow">
              <div class="fg"><label class="fl">Meta Pixel ID <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);font-size:10px;">&#8212; from Meta Events Manager</span></label><input class="fi" id="s-meta-pixel-id" placeholder="1234567890123456" autocomplete="off"></div>
              <div class="fg"><label class="fl">Google Tag ID <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);font-size:10px;">&#8212; e.g. G-XXXXXXXXXX or AW-XXXXXXXXX</span></label><input class="fi" id="s-google-tag-id" placeholder="G-XXXXXXXXXX" autocomplete="off"></div>
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:6px;">Events fired: <strong>EstimateViewed</strong> (when homeowner opens their page) · <strong>BookingClicked</strong> (when they tap Schedule) · <strong>CallClicked</strong> (when they tap your phone number)</div>
          </div>
        </div>
      </div>
      <!-- FULL WIDTH: Share & Embed -->'''

if old_bio_field in html:
    html = html.replace(old_bio_field, new_bio_field, 1)
    print("✅ 1a. Settings UI pixel fields added")
else:
    print("❌ 1a. Settings UI — old string not found")

# ── 1b. accountRowToCfg: add metaPixelId + googleTagId ──────────────────────
old_cfg_end = "    companyBio: row.company_bio || '',\n  };\n}"

new_cfg_end = """    companyBio: row.company_bio || '',
    metaPixelId: row.meta_pixel_id || '',
    googleTagId: row.google_tag_id || '',
  };
}"""

if old_cfg_end in html:
    html = html.replace(old_cfg_end, new_cfg_end, 1)
    print("✅ 1b. accountRowToCfg updated")
else:
    print("❌ 1b. accountRowToCfg — old string not found")

# ── 1c. syncAccountToSupabase: persist pixel fields ─────────────────────────
old_sync_end = "    company_bio: cfg.companyBio||null\n  }).eq('id', currentAccount.id);"

new_sync_end = """    company_bio: cfg.companyBio||null,
    meta_pixel_id: cfg.metaPixelId||null,
    google_tag_id: cfg.googleTagId||null
  }).eq('id', currentAccount.id);"""

if old_sync_end in html:
    html = html.replace(old_sync_end, new_sync_end, 1)
    print("✅ 1c. syncAccountToSupabase updated")
else:
    print("❌ 1c. syncAccountToSupabase — old string not found")

# ── 1d. saveSettings: read pixel fields from form ───────────────────────────
old_save_end = "    companyBio: (document.getElementById('s-bio')||{}).value || ''\n  };"

new_save_end = """    companyBio: (document.getElementById('s-bio')||{}).value || '',
    metaPixelId: (document.getElementById('s-meta-pixel-id')||{}).value || '',
    googleTagId: (document.getElementById('s-google-tag-id')||{}).value || ''
  };"""

if old_save_end in html:
    html = html.replace(old_save_end, new_save_end, 1)
    print("✅ 1d. saveSettings updated")
else:
    print("❌ 1d. saveSettings — old string not found")

# ── 1e. Load pixel fields into Settings form ─────────────────────────────────
old_load_bio = "  const sBioEl = document.getElementById('s-bio'); if(sBioEl) sBioEl.value=c.companyBio||'';"

new_load_bio = """  const sBioEl = document.getElementById('s-bio'); if(sBioEl) sBioEl.value=c.companyBio||'';
  const sMetaPixelEl = document.getElementById('s-meta-pixel-id'); if(sMetaPixelEl) sMetaPixelEl.value=c.metaPixelId||'';
  const sGoogleTagEl = document.getElementById('s-google-tag-id'); if(sGoogleTagEl) sGoogleTagEl.value=c.googleTagId||'';"""

if old_load_bio in html:
    html = html.replace(old_load_bio, new_load_bio, 1)
    print("✅ 1e. Settings form load updated")
else:
    print("❌ 1e. Settings form load — old string not found")

# ── 1f. QR URL in postcard canvas: use biddrop.us/e/{id} ────────────────────
old_qr1 = "  const trackedUrl=item.id?'https://biddrop.americashomeexperts.com/r/'+encodeURIComponent(item.id):(cfg.bookingUrl||'');\n  const qrUrl=trackedUrl?'https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=4&data='+encodeURIComponent(trackedUrl):'';\n  const [headshotImg,logoImg,qrImg]=await Promise.all([loadImg(headshotUrl),loadImg(logoUrl),loadImg(qrUrl)]);\n  const canvas=document.createElement('canvas');\n  canvas.width=W; canvas.height=H;\n  const ctx=canvas.getContext('2d');\n  // ═══════════════════════════════════════════════════════════\n  // LAYOUT (2775 x 1875):"

new_qr1 = """  // QR encodes the per-estimate page URL (biddrop.us/e/{id}) for tracking + retargeting
  // Falls back to booking URL if no estimate ID, then to app homepage
  const trackedUrl=item.id
    ? 'https://biddrop.us/e/'+encodeURIComponent(item.id)
    : (cfg.bookingUrl||'https://biddrop.us');
  const qrUrl=trackedUrl?'https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=4&data='+encodeURIComponent(trackedUrl):'';
  const [headshotImg,logoImg,qrImg]=await Promise.all([loadImg(headshotUrl),loadImg(logoUrl),loadImg(qrUrl)]);
  const canvas=document.createElement('canvas');
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext('2d');
  // ═══════════════════════════════════════════════════════════
  // LAYOUT (2775 x 1875):"""

count1 = html.count(old_qr1)
if count1 > 0:
    html = html.replace(old_qr1, new_qr1)
    print(f"✅ 1f. QR URL updated in postcard canvas ({count1} occurrence(s))")
else:
    print("❌ 1f. QR URL — old string not found, trying alternate...")
    # Try finding the pattern differently
    idx = html.find("'https://biddrop.americashomeexperts.com/r/'")
    print(f"   Found americashomeexperts/r/ at index: {idx}")
    if idx > 0:
        print(f"   Context: {repr(html[idx-50:idx+150])}")

# ── 1g. Update /r/ redirect in postcard canvas (Design 2 if present) ─────────
old_qr2 = "  const trackedUrl=item.id?'https://biddrop.americashomeexperts.com/r/'+encodeURIComponent(item.id):(cfg.bookingUrl||'');\n  const qrUrl=trackedUrl?'https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=4&data='+encodeURIComponent(trackedUrl):'';"

new_qr2 = """  const trackedUrl=item.id
    ? 'https://biddrop.us/e/'+encodeURIComponent(item.id)
    : (cfg.bookingUrl||'https://biddrop.us');
  const qrUrl=trackedUrl?'https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=4&data='+encodeURIComponent(trackedUrl):'';"""

count2 = html.count(old_qr2)
if count2 > 0:
    html = html.replace(old_qr2, new_qr2)
    print(f"✅ 1g. QR URL updated in additional canvas(es) ({count2} occurrence(s))")
else:
    print("ℹ️  1g. No additional QR URL instances found (ok if Design 2 uses same block)")

# ── 1h. Update openEstimatePage to use biddrop.us/e/ ─────────────────────────
old_open_est = "function openEstimatePage(eid){\n  const slug=(S.cfg&&S.cfg.companyName?S.cfg.companyName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''):'roofing');\n  window.open('https://estimate.biddrop.us/'+slug+'/'+eid,'_blank','noopener,noreferrer');\n}"

new_open_est = """function openEstimatePage(eid){
  // Use biddrop.us/e/{id} — clean URL that fires retargeting pixels
  window.open('https://biddrop.us/e/'+encodeURIComponent(eid),'_blank','noopener,noreferrer');
}"""

if old_open_est in html:
    html = html.replace(old_open_est, new_open_est, 1)
    print("✅ 1h. openEstimatePage URL updated")
else:
    print("❌ 1h. openEstimatePage — old string not found")

# ── 1i. Update Preview page link in estimator to use biddrop.us/e/ ───────────
old_preview_link = "window.open('https://estimate.biddrop.us/'+slug+'/'+currentEstRecord.id,'_blank','noopener,noreferrer');"

new_preview_link = "window.open('https://biddrop.us/e/'+encodeURIComponent(currentEstRecord.id),'_blank','noopener,noreferrer');"

count_pl = html.count(old_preview_link)
if count_pl > 0:
    html = html.replace(old_preview_link, new_preview_link)
    print(f"✅ 1i. Preview page link updated ({count_pl} occurrence(s))")
else:
    print("❌ 1i. Preview page link — old string not found")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("\n--- index.html done ---\n")

# ─────────────────────────────────────────────────────────────────────────────
# 2. api/estimate.js — return metaPixelId + googleTagId
# ─────────────────────────────────────────────────────────────────────────────
with open('api/estimate.js', 'r', encoding='utf-8') as f:
    est = f.read()

old_acct_select = "const acctR = await sbFetch(`accounts?id=eq.${encodeURIComponent(est.account_id)}&select=id,company_name,company_phone,company_addr,brand_color,logo_data,headshot,rep_name,rep_title,booking_url,diff1,diff2,diff3,diff4,diff5,diff6,years_in_business,warranty_years,financing_enabled,financing_apr,financing_term,financing_down,cost_architectural,cost_3tab,cost_designer,cost_metal,cost_tearoff,cost_ice_water,cost_felts,cost_dumpster,overhead,margin,estimate_page_expires_days,estimate_page_countdown,active,company_bio`);"

new_acct_select = "const acctR = await sbFetch(`accounts?id=eq.${encodeURIComponent(est.account_id)}&select=id,company_name,company_phone,company_addr,brand_color,logo_data,headshot,rep_name,rep_title,booking_url,diff1,diff2,diff3,diff4,diff5,diff6,years_in_business,warranty_years,financing_enabled,financing_apr,financing_term,financing_down,cost_architectural,cost_3tab,cost_designer,cost_metal,cost_tearoff,cost_ice_water,cost_felts,cost_dumpster,overhead,margin,estimate_page_expires_days,estimate_page_countdown,active,company_bio,meta_pixel_id,google_tag_id,google_place_id`);"

if old_acct_select in est:
    est = est.replace(old_acct_select, new_acct_select, 1)
    print("✅ 2a. estimate.js account SELECT updated")
else:
    print("❌ 2a. estimate.js account SELECT — old string not found")

old_acct_obj_end = "          companyBio: acct.company_bio || '',\n          googlePlaceId: acct.google_place_id || null,"

new_acct_obj_end = """          companyBio: acct.company_bio || '',
          googlePlaceId: acct.google_place_id || null,
          metaPixelId: acct.meta_pixel_id || null,
          googleTagId: acct.google_tag_id || null,"""

if old_acct_obj_end in est:
    est = est.replace(old_acct_obj_end, new_acct_obj_end, 1)
    print("✅ 2b. estimate.js account object updated with pixel fields")
else:
    print("❌ 2b. estimate.js account object — old string not found")
    # Try alternate
    old_alt = "          companyBio: acct.company_bio || '',\n          googlePlaceId: acct.google_place_id || null\n        }"
    if old_alt in est:
        new_alt = """          companyBio: acct.company_bio || '',
          googlePlaceId: acct.google_place_id || null,
          metaPixelId: acct.meta_pixel_id || null,
          googleTagId: acct.google_tag_id || null
        }"""
        est = est.replace(old_alt, new_alt, 1)
        print("✅ 2b. estimate.js account object updated (alternate match)")
    else:
        idx = est.find('googlePlaceId')
        print(f"   googlePlaceId context: {repr(est[idx-20:idx+120])}")

with open('api/estimate.js', 'w', encoding='utf-8') as f:
    f.write(est)

print("\n--- api/estimate.js done ---\n")

# ─────────────────────────────────────────────────────────────────────────────
# 3. estimate.html — inject Meta Pixel + Google Tag on page load + CTA clicks
# ─────────────────────────────────────────────────────────────────────────────
with open('estimate.html', 'r', encoding='utf-8') as f:
    ep = f.read()

# 3a. After buildPage is called (line ~878), inject pixel scripts
old_track_view = "  trackView();\n}"

new_track_view = """  trackView();
  // ── Fire retargeting pixels ──────────────────────────────────────────────
  firePixels('EstimateViewed', { value: est.total || 0, currency: 'USD', content_name: est.addr || '' });
}"""

if old_track_view in ep:
    ep = ep.replace(old_track_view, new_track_view, 1)
    print("✅ 3a. estimate.html trackView + pixel fire added")
else:
    print("❌ 3a. estimate.html trackView — old string not found")

# 3b. Add firePixels function before showError
old_show_error = "function showError(){$('ep-loading').style.display='none';$('ep-error').style.display='flex';}"

new_show_error = """// ── Retargeting pixel helper ────────────────────────────────────────────────
// Fires Meta Pixel + Google Tag events for the account AND the AHE platform pixel
const AHE_META_PIXEL = '1234567890'; // AHE platform-level pixel (fires on ALL estimate pages)
function firePixels(eventName, params){
  const acct = _acct || {};
  const clientPixelId = acct.metaPixelId || null;
  const clientGtagId  = acct.googleTagId  || null;
  // ── Meta Pixel ────────────────────────────────────────────────────────────
  function loadAndFireMeta(pixelId){
    if(!pixelId) return;
    if(typeof fbq === 'undefined'){
      // Inject Meta Pixel base code
      (function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)})(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    }
    fbq('init', pixelId);
    fbq('track', 'PageView');
    fbq('trackCustom', eventName, params);
  }
  // Fire AHE platform pixel (always)
  loadAndFireMeta(AHE_META_PIXEL);
  // Fire client's own pixel (if configured)
  if(clientPixelId && clientPixelId !== AHE_META_PIXEL) loadAndFireMeta(clientPixelId);
  // ── Google Tag ────────────────────────────────────────────────────────────
  if(clientGtagId){
    if(typeof gtag === 'undefined'){
      const s=document.createElement('script');
      s.async=true;
      s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(clientGtagId);
      document.head.appendChild(s);
      window.dataLayer=window.dataLayer||[];
      window.gtag=function(){window.dataLayer.push(arguments);}
      gtag('js',new Date());
      gtag('config',clientGtagId);
    }
    // Map BidDrop event names to Google standard events
    const gEventMap = {
      'EstimateViewed': 'view_item',
      'BookingClicked': 'begin_checkout',
      'CallClicked':    'contact'
    };
    const gEvent = gEventMap[eventName] || eventName;
    gtag('event', gEvent, { event_category: 'BidDrop', event_label: eventName, value: params.value || 0 });
  }
}
function showError(){$('ep-loading').style.display='none';$('ep-error').style.display='flex';}"""

if old_show_error in ep:
    ep = ep.replace(old_show_error, new_show_error, 1)
    print("✅ 3b. estimate.html firePixels function added")
else:
    print("❌ 3b. estimate.html showError — old string not found")

# 3c. Fire BookingClicked when sticky CTA is clicked
# Find the sticky CTA button and add onclick pixel fire
old_sticky_cta = "const schedLink=acct.bookingUrl||acct.scheduleLink||acct.calendarLink||'';\n  if(schedLink){$('ep-sticky-cta').href=schedLink;$('ep-sticky-cta').target='_blank';}\n  else{$('ep-sticky-cta').style.display='none';}"

new_sticky_cta = """const schedLink=acct.bookingUrl||acct.scheduleLink||acct.calendarLink||'';
  if(schedLink){
    $('ep-sticky-cta').href=schedLink;
    $('ep-sticky-cta').target='_blank';
    $('ep-sticky-cta').addEventListener('click',function(){
      firePixels('BookingClicked',{value:_est?_est.total:0,currency:'USD',content_name:_est?_est.addr:''});
      try{fetch('/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'track_event',id:_estId,event:'booking_click',data:{}})});}catch(e){}
    },{once:true});
  } else{$('ep-sticky-cta').style.display='none';}"""

if old_sticky_cta in ep:
    ep = ep.replace(old_sticky_cta, new_sticky_cta, 1)
    print("✅ 3c. estimate.html BookingClicked pixel added")
else:
    print("❌ 3c. estimate.html sticky CTA — old string not found")

# 3d. Fire CallClicked when phone is tapped
old_sticky_phone = "  if(acctPhone){\n    $('ep-sticky-phone').href='tel:'+acctPhone.replace(/[^0-9+]/g,'');\n    $('ep-sticky-phone-num').textContent=acctPhone;\n  } else {\n    $('ep-sticky-phone').style.display='none';\n  }"

new_sticky_phone = """  if(acctPhone){
    $('ep-sticky-phone').href='tel:'+acctPhone.replace(/[^0-9+]/g,'');
    $('ep-sticky-phone-num').textContent=acctPhone;
    $('ep-sticky-phone').addEventListener('click',function(){
      firePixels('CallClicked',{value:_est?_est.total:0,currency:'USD',content_name:_est?_est.addr:''});
      try{fetch('/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'track_event',id:_estId,event:'call_click',data:{}})});}catch(e){}
    },{once:true});
  } else {
    $('ep-sticky-phone').style.display='none';
  }"""

if old_sticky_phone in ep:
    ep = ep.replace(old_sticky_phone, new_sticky_phone, 1)
    print("✅ 3d. estimate.html CallClicked pixel added")
else:
    print("❌ 3d. estimate.html sticky phone — old string not found")

with open('estimate.html', 'w', encoding='utf-8') as f:
    f.write(ep)

print("\n--- estimate.html done ---\n")
print("All patches complete!")
