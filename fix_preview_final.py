import sys

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start = None
end = None
for i, line in enumerate(lines):
    if 'async function previewPostcard6x9(id)' in line:
        start = i
    if start is not None and i > start and line.startswith('function printQueuePreview'):
        end = i
        break

if start is None or end is None:
    print(f"ERROR: start={start}, end={end}")
    sys.exit(1)

print(f"Replacing lines {start+1} to {end} ({end-start} lines)")

# New function - ASCII only, no emoji unicode surrogates
new_func_lines = [
"async function previewPostcard6x9(id){\n",
"  const item = S.queue.find(x=>x.id===id); if(!item) return;\n",
"  let previewItem = {...item};\n",
"  if(!previewItem.photo_url && !previewItem.photo_data){\n",
"    try{\n",
"      const MB = window._mapboxToken || ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');\n",
"      const geoRes = await fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/'+encodeURIComponent(item.addr)+'.json?country=us&types=address&limit=1&access_token='+MB);\n",
"      const geoData = await geoRes.json();\n",
"      if(geoData.features && geoData.features[0]){\n",
"        const [lon, lat] = geoData.features[0].center;\n",
"        previewItem.photo_url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x600@2x?access_token=${MB}`;\n",
"      }\n",
"    } catch(e){ console.warn('[BidDrop] Geocode for postcard preview failed:', e); }\n",
"  }\n",
"  const frontHtml = buildPostcard6x9FrontHtml(previewItem);\n",
"  const backHtml  = buildPostcard6x9BackHtml(item);\n",
"  const existing = document.getElementById('m-postcard6x9-preview');\n",
"  if(existing) existing.remove();\n",
"  const isMobile = window.innerWidth <= 768;\n",
"  const modal = document.createElement('div');\n",
"  modal.id = 'm-postcard6x9-preview';\n",
"  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,16,26,0.97);display:flex;flex-direction:column;';\n",
"  if(isMobile){\n",
"    // MOBILE: full-screen tab-based viewer\n",
"    const mHtml = [\n",
"      '<div style=\"display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;flex-shrink:0;border-bottom:1px solid #2E4060;\">',\n",
"        '<div style=\"font-family:Oswald,sans-serif;font-size:17px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;\">&#127968; Postcard Preview</div>',\n",
"        '<button onclick=\"document.getElementById(\\'m-postcard6x9-preview\\').remove()\" style=\"background:#2E4060;border:none;color:#F0F6FF;font-size:13px;font-weight:700;padding:8px 18px;border-radius:8px;cursor:pointer;-webkit-tap-highlight-color:transparent;\">&times; Close</button>',\n",
"      '</div>',\n",
"      '<div style=\"display:flex;padding:12px 16px 8px;flex-shrink:0;\">',\n",
"        '<button id=\"pc-tab-front\" onclick=\"window._switchPcTab(\\'front\\')\" style=\"flex:1;padding:12px 0;border:none;border-radius:10px 0 0 10px;font-family:Barlow,sans-serif;font-size:15px;font-weight:700;cursor:pointer;background:#F25C05;color:#fff;-webkit-tap-highlight-color:transparent;\">FRONT</button>',\n",
"        '<button id=\"pc-tab-back\" onclick=\"window._switchPcTab(\\'back\\')\" style=\"flex:1;padding:12px 0;border:1px solid #2E4060;border-left:none;border-radius:0 10px 10px 0;font-family:Barlow,sans-serif;font-size:15px;font-weight:700;cursor:pointer;background:#1A2333;color:#6688A8;-webkit-tap-highlight-color:transparent;\">BACK</button>',\n",
"      '</div>',\n",
"      '<div style=\"flex:1;overflow:hidden;padding:0 12px 16px;display:flex;flex-direction:column;min-height:0;\">',\n",
"        '<div id=\"pc-card-container\" style=\"flex:1;position:relative;border-radius:12px;overflow:hidden;border:2px solid #F25C05;min-height:0;\">',\n",
"          '<div id=\"pc-frame-wrap-front\" style=\"position:absolute;inset:0;overflow:hidden;\">',\n",
"            '<iframe id=\"pc6x9-front-frame\" frameborder=\"0\" style=\"border:none;display:block;\"></iframe>',\n",
"          '</div>',\n",
"          '<div id=\"pc-frame-wrap-back\" style=\"position:absolute;inset:0;overflow:hidden;display:none;\">',\n",
"            '<iframe id=\"pc6x9-back-frame\" frameborder=\"0\" style=\"border:none;display:block;\"></iframe>',\n",
"          '</div>',\n",
"        '</div>',\n",
"        '<div style=\"text-align:center;margin-top:8px;font-size:11px;color:#6688A8;flex-shrink:0;\">Actual print size: 9&Prime;&times;6&Prime; &middot; Tap FRONT / BACK to switch</div>',\n",
"      '</div>'\n",
"    ].join('');\n",
"    modal.innerHTML = mHtml;\n",
"    document.body.appendChild(modal);\n",
"    window._switchPcTab = function(side){\n",
"      const fw = document.getElementById('pc-frame-wrap-front');\n",
"      const bw = document.getElementById('pc-frame-wrap-back');\n",
"      const tf = document.getElementById('pc-tab-front');\n",
"      const tb = document.getElementById('pc-tab-back');\n",
"      if(!fw||!bw) return;\n",
"      if(side==='front'){\n",
"        fw.style.display=''; bw.style.display='none';\n",
"        tf.style.background='#F25C05'; tf.style.color='#fff'; tf.style.border='none';\n",
"        tb.style.background='#1A2333'; tb.style.color='#6688A8'; tb.style.border='1px solid #2E4060';\n",
"      } else {\n",
"        fw.style.display='none'; bw.style.display='';\n",
"        tb.style.background='#F25C05'; tb.style.color='#fff'; tb.style.border='none';\n",
"        tf.style.background='#1A2333'; tf.style.color='#6688A8'; tf.style.border='1px solid #2E4060';\n",
"      }\n",
"    };\n",
"    setTimeout(function(){\n",
"      const container = document.getElementById('pc-card-container');\n",
"      if(!container) return;\n",
"      const cW = container.offsetWidth;\n",
"      const cH = container.offsetHeight;\n",
"      const scale = Math.min(cW/864, cH/576);\n",
"      ['front','back'].forEach(function(side){\n",
"        const frame = document.getElementById('pc6x9-'+side+'-frame');\n",
"        const html  = side==='front' ? frontHtml : backHtml;\n",
"        if(!frame) return;\n",
"        frame.style.width='864px'; frame.style.height='576px';\n",
"        frame.style.transform='scale('+scale+')'; frame.style.transformOrigin='top left';\n",
"        frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();\n",
"      });\n",
"    }, 200);\n",
"  } else {\n",
"    // DESKTOP: side-by-side layout\n",
"    const dHtml = [\n",
"      '<div style=\"display:flex;align-items:center;justify-content:space-between;padding:20px 24px 14px;flex-shrink:0;border-bottom:1px solid #2E4060;\">',\n",
"        '<div style=\"font-family:Oswald,sans-serif;font-size:20px;font-weight:700;color:#F0F6FF;letter-spacing:.5px;\">&#127968; 6&times;9 Postcard Preview</div>',\n",
"        '<button onclick=\"document.getElementById(\\'m-postcard6x9-preview\\').remove()\" style=\"background:#2E4060;border:none;color:#F0F6FF;font-size:13px;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;\">&times; Close</button>',\n",
"      '</div>',\n",
"      '<div style=\"font-size:12px;color:#6688A8;padding:12px 24px 0;\">Front (house photo) on the left &middot; Back (estimate + address) on the right. Actual print size: 9&Prime;&times;6&Prime;.</div>',\n",
"      '<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:16px 24px 24px;flex:1;overflow:hidden;min-height:0;\">',\n",
"        '<div style=\"display:flex;flex-direction:column;min-height:0;\">',\n",
"          '<div style=\"font-size:11px;font-weight:700;color:#A8BECE;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;\">FRONT</div>',\n",
"          '<div id=\"pc-front-scaler\" style=\"position:relative;border-radius:10px;overflow:hidden;border:2px solid #2E4060;\">',\n",
"            '<iframe id=\"pc6x9-front-frame\" frameborder=\"0\" style=\"border:none;display:block;\"></iframe>',\n",
"          '</div>',\n",
"        '</div>',\n",
"        '<div style=\"display:flex;flex-direction:column;min-height:0;\">',\n",
"          '<div style=\"font-size:11px;font-weight:700;color:#A8BECE;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;\">BACK</div>',\n",
"          '<div id=\"pc-back-scaler\" style=\"position:relative;border-radius:10px;overflow:hidden;border:2px solid #2E4060;\">',\n",
"            '<iframe id=\"pc6x9-back-frame\" frameborder=\"0\" style=\"border:none;display:block;\"></iframe>',\n",
"          '</div>',\n",
"        '</div>',\n",
"      '</div>'\n",
"    ].join('');\n",
"    modal.innerHTML = dHtml;\n",
"    document.body.appendChild(modal);\n",
"    setTimeout(function(){\n",
"      ['front','back'].forEach(function(side){\n",
"        const frame  = document.getElementById('pc6x9-'+side+'-frame');\n",
"        const scaler = document.getElementById('pc-'+side+'-scaler');\n",
"        const html   = side==='front' ? frontHtml : backHtml;\n",
"        if(!frame||!scaler) return;\n",
"        const cW = scaler.offsetWidth;\n",
"        const scale = cW/864;\n",
"        frame.style.width='864px'; frame.style.height='576px';\n",
"        frame.style.transform='scale('+scale+')'; frame.style.transformOrigin='top left';\n",
"        scaler.style.height=Math.round(576*scale)+'px';\n",
"        frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();\n",
"      });\n",
"    }, 200);\n",
"  }\n",
"}\n",
]

result = lines[:start] + new_func_lines + lines[end:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.writelines(result)

print(f"Done. Replaced {end-start} lines with {len(new_func_lines)} lines.")
print(f"New total lines: {len(result)}")
