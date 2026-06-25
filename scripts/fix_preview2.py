with open('index.html', 'r') as f:
    lines = f.readlines()

start = None
end = None
for i, line in enumerate(lines):
    if 'async function previewPostcard6x9(id)' in line:
        start = i
    if start is not None and i > start and line.startswith('function printQueuePreview'):
        end = i
        break

print(f"Replacing lines {start+1} to {end} ({end-start} lines)")

new_func = """async function previewPostcard6x9(id){
  const item = S.queue.find(x=>x.id===id); if(!item) return;
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

  const isMobile = window.innerWidth <= 768;
  const modal = document.createElement('div');
  modal.id = 'm-postcard6x9-preview';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,16,26,0.97);display:flex;flex-direction:column;';

  if(isMobile){
    modal.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;flex-shrink:0;border-bottom:1px solid #2E4060;">' +
        '<div style="font-family:Oswald,sans-serif;font-size:17px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;">\uD83C\uDFE0 Postcard Preview</div>' +
        '<button onclick="document.getElementById(\'m-postcard6x9-preview\').remove()" style="background:#2E4060;border:none;color:#F0F6FF;font-size:13px;font-weight:700;padding:8px 18px;border-radius:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;">\u2715 Close</button>' +
      '</div>' +
      '<div style="display:flex;padding:12px 16px 8px;flex-shrink:0;">' +
        '<button id="pc-tab-front" onclick="window._switchPcTab(\'front\')" style="flex:1;padding:12px 0;border:none;border-radius:10px 0 0 10px;font-family:Barlow,sans-serif;font-size:15px;font-weight:700;cursor:pointer;background:#F25C05;color:#fff;-webkit-tap-highlight-color:transparent;">\uD83D\uDCF8 FRONT</button>' +
        '<button id="pc-tab-back" onclick="window._switchPcTab(\'back\')" style="flex:1;padding:12px 0;border:1px solid #2E4060;border-left:none;border-radius:0 10px 10px 0;font-family:Barlow,sans-serif;font-size:15px;font-weight:700;cursor:pointer;background:#1A2333;color:#6688A8;-webkit-tap-highlight-color:transparent;">\uD83D\uDCCB BACK</button>' +
      '</div>' +
      '<div style="flex:1;overflow:hidden;padding:0 12px 16px;display:flex;flex-direction:column;min-height:0;">' +
        '<div id="pc-card-container" style="flex:1;position:relative;border-radius:12px;overflow:hidden;border:2px solid #F25C05;min-height:0;">' +
          '<div id="pc-frame-wrap-front" style="position:absolute;inset:0;overflow:hidden;">' +
            '<iframe id="pc6x9-front-frame" frameborder="0" style="border:none;display:block;"></iframe>' +
          '</div>' +
          '<div id="pc-frame-wrap-back" style="position:absolute;inset:0;overflow:hidden;display:none;">' +
            '<iframe id="pc6x9-back-frame" frameborder="0" style="border:none;display:block;"></iframe>' +
          '</div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:8px;font-size:11px;color:#6688A8;flex-shrink:0;">Actual print size: 9\u2033\u00d76\u2033 \u00b7 Tap FRONT / BACK to switch</div>' +
      '</div>';
    document.body.appendChild(modal);

    window._switchPcTab = function(side){
      const fw = document.getElementById('pc-frame-wrap-front');
      const bw = document.getElementById('pc-frame-wrap-back');
      const tf = document.getElementById('pc-tab-front');
      const tb = document.getElementById('pc-tab-back');
      if(!fw||!bw) return;
      if(side==='front'){
        fw.style.display=''; bw.style.display='none';
        tf.style.background='#F25C05'; tf.style.color='#fff'; tf.style.border='none';
        tb.style.background='#1A2333'; tb.style.color='#6688A8'; tb.style.border='1px solid #2E4060';
      } else {
        fw.style.display='none'; bw.style.display='';
        tb.style.background='#F25C05'; tb.style.color='#fff'; tb.style.border='none';
        tf.style.background='#1A2333'; tf.style.color='#6688A8'; tf.style.border='1px solid #2E4060';
      }
    };

    setTimeout(function(){
      const container = document.getElementById('pc-card-container');
      if(!container) return;
      const cW = container.offsetWidth;
      const cH = container.offsetHeight;
      const scale = Math.min(cW/864, cH/576);
      ['front','back'].forEach(function(side){
        const frame = document.getElementById('pc6x9-'+side+'-frame');
        const html  = side==='front' ? frontHtml : backHtml;
        if(!frame) return;
        frame.style.width='864px'; frame.style.height='576px';
        frame.style.transform='scale('+scale+')'; frame.style.transformOrigin='top left';
        frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
      });
    }, 200);

  } else {
    modal.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 14px;flex-shrink:0;border-bottom:1px solid #2E4060;">' +
        '<div style="font-family:Oswald,sans-serif;font-size:20px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;">\uD83C\uDFE0 6\u00d79 Postcard Preview</div>' +
        '<button onclick="document.getElementById(\'m-postcard6x9-preview\').remove()" style="background:#2E4060;border:none;color:#F0F6FF;font-size:13px;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;">\u2715 Close</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#6688A8;padding:12px 24px 0;">Front (house photo) on the left \u00b7 Back (estimate + address) on the right. Actual print size: 9\u2033\u00d76\u2033.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 24px 24px;flex:1;overflow:hidden;min-height:0;">' +
        '<div style="display:flex;flex-direction:column;min-height:0;">' +
          '<div style="font-size:11px;font-weight:700;color:#A8BECE;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">\uD83D\uDCF8 Front</div>' +
          '<div id="pc-front-scaler" style="position:relative;border-radius:10px;overflow:hidden;border:2px solid #2E4060;">' +
            '<iframe id="pc6x9-front-frame" frameborder="0" style="border:none;display:block;"></iframe>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;min-height:0;">' +
          '<div style="font-size:11px;font-weight:700;color:#A8BECE;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">\uD83D\uDCCB Back</div>' +
          '<div id="pc-back-scaler" style="position:relative;border-radius:10px;overflow:hidden;border:2px solid #2E4060;">' +
            '<iframe id="pc6x9-back-frame" frameborder="0" style="border:none;display:block;"></iframe>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    setTimeout(function(){
      ['front','back'].forEach(function(side){
        const frame  = document.getElementById('pc6x9-'+side+'-frame');
        const scaler = document.getElementById('pc-'+side+'-scaler');
        const html   = side==='front' ? frontHtml : backHtml;
        if(!frame||!scaler) return;
        const cW = scaler.offsetWidth;
        const scale = cW/864;
        frame.style.width='864px'; frame.style.height='576px';
        frame.style.transform='scale('+scale+')'; frame.style.transformOrigin='top left';
        scaler.style.height=Math.round(576*scale)+'px';
        frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
      });
    }, 200);
  }
}
"""

new_lines = new_func.splitlines(keepends=True)

result = lines[:start] + new_lines + lines[end:]

with open('index.html', 'w') as f:
    f.writelines(result)

print(f"Done. Replaced {end-start} lines with {len(new_lines)} lines.")
