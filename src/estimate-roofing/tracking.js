// ── Share ──────────────────────────────────────────────────────────────────
function shareEst(){
  if(navigator.share){navigator.share({title:'My Roofing Estimate',url:location.href});}
  else{navigator.clipboard.writeText(location.href).then(()=>alert('Link copied!'));}
}

// ── Fade In ────────────────────────────────────────────────────────────────
function initFade(){
  const els=document.querySelectorAll('.ep-fade,.ep-fade-d1,.ep-fade-d2');
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('vis');obs.unobserve(e.target);}});
  },{threshold:0.06});
  els.forEach(el=>obs.observe(el));
}

// ── Track ──────────────────────────────────────────────────────────────────
function trackView(){
  try{fetch(API_BASE+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'track_view',id:_estId,seconds:0})});}catch(e){}
  // If opened from a QR code context (direct URL visit from postcard), also track as QR scan.
  // We detect QR context by: (a) ?src=qr param, (b) no HTTP referrer (direct scan), or (c) referrer is a QR code service.
  try{
    const params = new URLSearchParams(window.location.search);
    const srcParam = params.get('src') || params.get('source') || '';
    const ref = document.referrer || '';
    const isQr = srcParam === 'qr' || srcParam === 'postcard' ||
                 (!ref && !window._qrTracked) ||
                 ref.includes('qrserver.com') || ref.includes('qr.io');
    if(isQr && !window._qrTracked){
      window._qrTracked = true;
      fetch(API_BASE+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'track_qr_scan',id:_estId})}).catch(()=>{});
    }
  }catch(e){}
}

// ── Retargeting pixel helper ────────────────────────────────────────────────
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
function showError(){$('ep-loading').style.display='none';$('ep-error').style.display='flex';}

init();
