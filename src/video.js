// ── VIDEO HELPERS ────────────────────────────────────────────────────────────
// Extracted from index.html — pure video embed/upload helpers
// Dependencies: toast() [ui.js], sb [global], scheduleDraftSave [index.html]
function videoEmbedPreview(url){
  if(!url) return '';
  // YouTube (watch, embed, youtu.be, shorts)
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  if(ytMatch) return `<iframe src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1&playsinline=1" frameborder="0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen style="width:100%;height:100%;display:block;"></iframe>`;
  // Vimeo (standard + unlisted /video/ID/hash)
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?/);
  if(vimeoMatch){ const h=vimeoMatch[2]?`&h=${vimeoMatch[2]}`:''; return `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}?badge=0&autopause=0${h}" frameborder="0" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen style="width:100%;height:100%;display:block;"></iframe>`; }
  // Loom
  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if(loomMatch) return `<iframe src="https://www.loom.com/embed/${loomMatch[1]}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true" frameborder="0" allowfullscreen style="width:100%;height:100%;display:block;"></iframe>`;
  return '';
}
function updateRepVideoPreview(url){
  const wrap = document.getElementById('s-rep-video-preview');
  if(!wrap) return;
  const html = videoEmbedPreview(url);
  if(html){ wrap.innerHTML=html; wrap.style.display='block'; }
  else { wrap.innerHTML=''; wrap.style.display='none'; }
}
function onEstVideoUrlInput(){
  const url = (document.getElementById('e-video')||{}).value||'';
  const wrap = document.getElementById('e-video-preview-wrap');
  const clearBtn = document.getElementById('e-video-clear-btn');
  const html = videoEmbedPreview(url);
  if(wrap){ if(html){ wrap.innerHTML=html; wrap.style.display='block'; } else { wrap.innerHTML=''; wrap.style.display='none'; } }
  if(clearBtn) clearBtn.style.display = url ? 'block' : 'none';
  scheduleDraftSave();
}
async function handleEstVideoUpload(inp){
  if(!inp.files||!inp.files[0]) return;
  const file = inp.files[0];
  if(file.size > 100*1024*1024){ toast('Video must be under 100 MB','error'); return; }
  const statusEl = document.getElementById('e-video-status');
  const labelEl  = document.getElementById('e-video-upload-label');
  const clearBtn = document.getElementById('e-video-clear-btn');
  if(statusEl){ statusEl.textContent='⏳ Uploading...'; statusEl.style.display='block'; }
  if(labelEl) labelEl.textContent='⏳ Uploading...';
  try{
    const session = await sb.auth.getSession();
    const jwt = session?.data?.session?.access_token;
    const acctId = currentAccount?.id || 'unknown';
    const ext = file.name.split('.').pop().toLowerCase();
    const path = acctId + '/videos/rep-' + Date.now() + '.' + ext;
    // Read as base64
    const dataUrl = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(file); });
    const resp = await fetch('/api/admin?action=upload-photo', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${jwt}`},
      body: JSON.stringify({ path, dataUrl, mimeType: file.type||'video/mp4' })
    });
    if(!resp.ok) throw new Error('Upload failed: '+resp.status);
    const {url} = await resp.json();
    const videoEl = document.getElementById('e-video');
    if(videoEl) videoEl.value = url;
    const wrap = document.getElementById('e-video-preview-wrap');
    if(wrap){ wrap.innerHTML=`<video src="${url}" controls playsinline preload="metadata" style="width:100%;height:100%;display:block;"></video>`; wrap.style.display='block'; }
    if(statusEl){ statusEl.textContent='✅ Uploaded!'; setTimeout(()=>{ statusEl.style.display='none'; },3000); }
    if(labelEl) labelEl.textContent='🎥 Replace Video';
    if(clearBtn) clearBtn.style.display='block';
    scheduleDraftSave();
    toast('Video uploaded!','success');
  }catch(err){
    console.error('Video upload error:',err);
    if(statusEl){ statusEl.textContent='❌ Upload failed — try a smaller file or paste a URL'; statusEl.style.color='#ef4444'; }
    if(labelEl) labelEl.textContent='🎥 Upload Video';
    toast('Video upload failed','error');
  }
}
function clearEstVideo(){
  const videoEl = document.getElementById('e-video');
  if(videoEl) videoEl.value = '';
  const wrap = document.getElementById('e-video-preview-wrap');
  if(wrap){ wrap.innerHTML=''; wrap.style.display='none'; }
  const clearBtn = document.getElementById('e-video-clear-btn');
  if(clearBtn) clearBtn.style.display='none';
  const statusEl = document.getElementById('e-video-status');
  if(statusEl){ statusEl.textContent=''; statusEl.style.display='none'; }
  const labelEl = document.getElementById('e-video-upload-label');
  if(labelEl) labelEl.textContent='🎥 Upload Video';
  scheduleDraftSave();
}
