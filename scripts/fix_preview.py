with open('index.html', 'r') as f:
    content = f.read()

old_func = '''async function previewPostcard6x9(id){
  const item = S.queue.find(x=>x.id===id); if(!item) return;
  // If no house photo, try to get Mapbox satellite image
  let previewItem = {...item};
  if(!previewItem.photo_url && !previewItem.photo_data){
    try{
      const MB = window._mapboxToken || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
      const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(item.addr)+'.json?country=us&types=address&limit=1&access_token='+MB);
      const geoData = await geoRes.json();
      if(geoData.features && geoData.features[0]){
        const [lon, lat] = geoData.features[0].center;
        previewItem.photo_url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;
      }
    } catch(e){ console.warn('[BidDrop] Geocode for postcard preview failed:', e); }
  }
  const frontHtml = buildPostcard6x9FrontHtml(previewItem);
  const backHtml  = buildPostcard6x9BackHtml(item);
  // Build or reuse a postcard preview modal
  let modal = document.getElementById('m-postcard6x9-preview');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'overlay';
    modal.id = 'm-postcard6x9-preview';
    modal.dataset.dynamic = '1';
    modal.addEventListener('click', e=>{ if(e.target===modal) closeM('m-postcard6x9-preview'); });
    modal.innerHTML = `
      <div class="modal" style="max-width:1050px;width:97vw;max-height:92vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <div class="modal-title" style="margin-bottom:0;">🏠 6×9 Postcard Preview</div>
          <button class="btn-cancel" onclick="closeM('m-postcard6x9-preview')" style="padding:8px 14px;">Close</button>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px;">Front (house photo) on the left · Back (estimate + address) on the right. Actual print size: 9&quot;×6&quot;.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--mid);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Front</div>
            <iframe id="pc6x9-front-frame" style="width:100%;aspect-ratio:9/6;border:1px solid var(--border);border-radius:8px;" frameborder="0"></iframe>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--mid);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;">Back</div>
            <iframe id="pc6x9-back-frame" style="width:100%;aspect-ratio:9/6;border:1px solid var(--border);border-radius:8px;" frameborder="0"></iframe>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  openM('m-postcard6x9-preview');
  // Write HTML into iframes after modal is visible
  setTimeout(()=>{
    const frontFrame = document.getElementById('pc6x9-front-frame');
    const backFrame  = document.getElementById('pc6x9-back-frame');
    if(frontFrame){ frontFrame.contentDocument.open(); frontFrame.contentDocument.write(frontHtml); frontFrame.contentDocument.close(); }
    if(backFrame){  backFrame.contentDocument.open();  backFrame.contentDocument.write(backHtml);  backFrame.contentDocument.close(); }
    // Scale both iframes to fit their containers
    [frontFrame, backFrame].forEach(f=>{
      if(!f) return;
      const scaler = f.parentElement;
      const containerW = scaler ? scaler.offsetWidth : 480;
      const scale = containerW / 864;
      f.style.width = '864px'; f.style.height = '576px';
      f.style.transform = `scale(${scale})`; f.style.transformOrigin = 'top left';
      if(scaler) scaler.style.height = Math.round(576*scale)+'px';
    });
  }, 150);
}'''

new_func = '''async function previewPostcard6x9(id){
  const item = S.queue.find(x=>x.id===id); if(!item) return;
  // If no house photo, try to get Mapbox satellite image
  let previewItem = {...item};
  if(!previewItem.photo_url && !previewItem.photo_data){
    try{
      const MB = window._mapboxToken || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
      const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(item.addr)+'.json?country=us&types=address&limit=1&access_token='+MB);
      const geoData = await geoRes.json();
      if(geoData.features && geoData.features[0]){
        const [lon, lat] = geoData.features[0].center;
        previewItem.photo_url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;
      }
    } catch(e){ console.warn('[BidDrop] Geocode for postcard preview failed:', e); }
  }
  const frontHtml = buildPostcard6x9FrontHtml(previewItem);
  const backHtml  = buildPostcard6x9BackHtml(item);

  // Remove any existing preview overlay
  const existing = document.getElementById('m-postcard6x9-preview');
  if(existing) existing.remove();

  // Detect mobile
  const isMobile = window.innerWidth <= 768;

  // Build a fresh full-screen overlay every time
  const modal = document.createElement('div');
  modal.id = 'm-postcard6x9-preview';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,16,26,0.97);display:flex;flex-direction:column;';

  if(isMobile){
    // MOBILE: full-screen tab-based card viewer
    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;flex-shrink:0;border-bottom:1px solid #2E4060;">
        <div style="font-family:'Oswald',sans-serif;font-size:17px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;">🏠 Postcard Preview</div>
        <button onclick="document.getElementById('m-postcard6x9-preview').remove()" style="background:#2E4060;border:none;color:#F0F6FF;font-size:13px;font-weight:700;padding:8px 18px;border-radius:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;">✕ Close</button>
      </div>
      <div style="display:flex;gap:0;padding:12px 16px 8px;flex-shrink:0;">
        <button id="pc-tab-front" onclick="window._switchPcTab('front')" style="flex:1;padding:12px 0;border:none;border-radius:10px 0 0 10px;font-family:'Barlow',sans-serif;font-size:15px;font-weight:700;cursor:pointer;background:#F25C05;color:#fff;-webkit-tap-highlight-color:transparent;">📸 FRONT</button>
        <button id="pc-tab-back" onclick="window._switchPcTab('back')" style="flex:1;padding:12px 0;border:none;border-radius:0 10px 10px 0;font-family:'Barlow',sans-serif;font-size:15px;font-weight:700;cursor:pointer;background:#1A2333;color:#6688A8;border:1px solid #2E4060;-webkit-tap-highlight-color:transparent;">📋 BACK</button>
      </div>
      <div style="flex:1;overflow:hidden;padding:0 12px 16px;display:flex;flex-direction:column;min-height:0;">
        <div id="pc-card-container" style="flex:1;position:relative;border-radius:12px;overflow:hidden;border:2px solid #F25C05;min-height:0;">
          <div id="pc-frame-wrap-front" style="position:absolute;inset:0;overflow:hidden;">
            <iframe id="pc6x9-front-frame" frameborder="0" style="border:none;display:block;"></iframe>
          </div>
          <div id="pc-frame-wrap-back" style="position:absolute;inset:0;overflow:hidden;display:none;">
            <iframe id="pc6x9-back-frame" frameborder="0" style="border:none;display:block;"></iframe>
          </div>
        </div>
        <div style="text-align:center;margin-top:8px;font-size:11px;color:#6688A8;flex-shrink:0;">Actual print size: 9\u2033\u00d76\u2033 &nbsp;\u00b7&nbsp; Tap FRONT / BACK to switch</div>
      </div>`;
    document.body.appendChild(modal);

    window._switchPcTab = function(side){
      const frontWrap = document.getElementById('pc-frame-wrap-front');
      const backWrap  = document.getElementById('pc-frame-wrap-back');
      const tabFront  = document.getElementById('pc-tab-front');
      const tabBack   = document.getElementById('pc-tab-back');
      if(!frontWrap || !backWrap) return;
      if(side==='front'){
        frontWrap.style.display=''; backWrap.style.display='none';
        tabFront.style.background='#F25C05'; tabFront.style.color='#fff'; tabFront.style.border='none';
        tabBack.style.background='#1A2333'; tabBack.style.color='#6688A8'; tabBack.style.border='1px solid #2E4060';
      } else {
        frontWrap.style.display='none'; backWrap.style.display='';
        tabBack.style.background='#F25C05'; tabBack.style.color='#fff'; tabBack.style.border='none';
        tabFront.style.background='#1A2333'; tabFront.style.color='#6688A8'; tabFront.style.border='1px solid #2E4060';
      }
    };

    setTimeout(()=>{
      const container = document.getElementById('pc-card-container');
      if(!container) return;
      const containerW = container.offsetWidth;
      const containerH = container.offsetHeight;
      const scaleW = containerW / 864;
      const scaleH = containerH / 576;
      const scale = Math.min(scaleW, scaleH);
      ['front','back'].forEach(side=>{
        const frame = document.getElementById('pc6x9-'+ side +'-frame');
        const html  = side==='front' ? frontHtml : backHtml;
        if(!frame) return;
        frame.style.width  = '864px';
        frame.style.height = '576px';
        frame.style.transform = 'scale('+scale+')';
        frame.style.transformOrigin = 'top left';
        frame.contentDocument.open();
        frame.contentDocument.write(html);
        frame.contentDocument.close();
      });
    }, 200);

  } else {
    // DESKTOP: side-by-side layout
    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 14px;flex-shrink:0;border-bottom:1px solid #2E4060;">
        <div style="font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;">🏠 6\u00d79 Postcard Preview</div>
        <button onclick="document.getElementById('m-postcard6x9-preview').remove()" style="background:#2E4060;border:none;color:#F0F6FF;font-size:13px;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;">✕ Close</button>
      </div>
      <div style="font-size:12px;color:#6688A8;padding:12px 24px 0;">Front (house photo) on the left \u00b7 Back (estimate + address) on the right. Actual print size: 9\u2033\u00d76\u2033.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 24px 24px;flex:1;overflow:hidden;min-height:0;">
        <div style="display:flex;flex-direction:column;min-height:0;">
          <div style="font-size:11px;font-weight:700;color:#A8BECE;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">📸 Front</div>
          <div id="pc-front-scaler" style="position:relative;border-radius:10px;overflow:hidden;border:2px solid #2E4060;">
            <iframe id="pc6x9-front-frame" frameborder="0" style="border:none;display:block;"></iframe>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;min-height:0;">
          <div style="font-size:11px;font-weight:700;color:#A8BECE;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">📋 Back</div>
          <div id="pc-back-scaler" style="position:relative;border-radius:10px;overflow:hidden;border:2px solid #2E4060;">
            <iframe id="pc6x9-back-frame" frameborder="0" style="border:none;display:block;"></iframe>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    setTimeout(()=>{
      ['front','back'].forEach(side=>{
        const frame   = document.getElementById('pc6x9-'+ side +'-frame');
        const scaler  = document.getElementById('pc-'+ side +'-scaler');
        const html    = side==='front' ? frontHtml : backHtml;
        if(!frame || !scaler) return;
        const containerW = scaler.offsetWidth;
        const scale = containerW / 864;
        frame.style.width  = '864px';
        frame.style.height = '576px';
        frame.style.transform = 'scale('+scale+')';
        frame.style.transformOrigin = 'top left';
        scaler.style.height = Math.round(576*scale)+'px';
        frame.contentDocument.open();
        frame.contentDocument.write(html);
        frame.contentDocument.close();
      });
    }, 200);
  }
}'''

if old_func in content:
    content = content.replace(old_func, new_func)
    print("SUCCESS: previewPostcard6x9 replaced")
else:
    print("ERROR: Old function not found exactly")
    if 'async function previewPostcard6x9(id)' in content:
        print("  Function exists but text mismatch")

with open('index.html', 'w') as f:
    f.write(content)
