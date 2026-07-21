// ── Photo Gallery — labeled thumbnail grid with lightbox ──────────────────────
let _allPhotosFlat=[];
let _lbSectionLabels={};
function renderPhotos(est){
  const ap=est.allPhotos||{};
  const front=ap.front||(est.photoUrl?[est.photoUrl]:[]);
  const damage=ap.damage||est.damagePhotos||[];
  const angles=ap.angles||[];
  const buildings=ap.buildings||[];
  const other=ap.other||[];
  // Categories in display order
  const cats=[
    {label:'Front of Home',photos:front},
    {label:'Roof Damage',photos:damage},
    {label:'Additional Angles',photos:angles},
    {label:'Additional Buildings',photos:buildings},
    {label:'Additional Photos',photos:other},
  ].filter(c=>c.photos.length>0);
  if(!cats.length)return;
  // Build flat list for lightbox navigation
  _allPhotosFlat=[];
  const catOffsets=[];
  cats.forEach(c=>{
    catOffsets.push(_allPhotosFlat.length);
    _allPhotosFlat.push(...c.photos);
  });
  // Build globalIdx → label map for lightbox section labels
  _lbSectionLabels={};
  cats.forEach((cat,ci)=>{
    const offset=catOffsets[ci];
    cat.photos.forEach((_,pi)=>{ _lbSectionLabels[offset+pi]=cat.label; });
  });
  // Render category blocks
  const container=$('ep-photo-cats');
  container.innerHTML=cats.map((cat,ci)=>{
    const offset=catOffsets[ci];
    const show=cat.photos.slice(0,4); // show up to 4 thumbs per category
    const extra=cat.photos.length-show.length;
    const isSingle=show.length===1;
    const thumbsHtml=show.map((src,ti)=>{
      const globalIdx=offset+ti;
      const isLast=ti===show.length-1&&extra>0;
      return`<div class="ep-photo-cat-thumb" onclick="openLBFlat(${globalIdx})">` +
        `<img src="${src}" alt="" loading="lazy">` +
        (isLast?`<div class="ep-photo-cat-count">+${extra} more</div>`:'') +
        `</div>`;
    }).join('');
    return`<div class="ep-photo-cat">` +
      `<span class="ep-photo-cat-label">${cat.label}</span>` +
      `<div class="ep-photo-cat-thumbs${isSingle?' single':''}">${thumbsHtml}</div>` +
      `</div>`;
  }).join('');
  $('ep-gallery-section').style.display='block';
}
function openLBFlat(idx){
  _lbGallery=_allPhotosFlat;
  _lbIdx=idx||0;
  _lbShow();
  $('ep-lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}

// ── Lightbox ───────────────────────────────────────────────────────────────
let _lbGallery=[],_lbIdx=0;
function openLBG(gid,idx){
  _lbGallery=_galleries[gid]||[];
  _lbIdx=idx||0;
  _lbShow();
  $('ep-lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}
function openLB(src){
  _lbGallery=[src];
  _lbIdx=0;
  _lbShow();
  $('ep-lightbox').classList.add('open');
  document.body.style.overflow='hidden';
}
function _lbShow(){
  $('ep-lightbox-img').src=_lbGallery[_lbIdx];
  const c=$('ep-lightbox-counter');
  if(c)c.textContent=(_lbIdx+1)+' / '+_lbGallery.length;
  const lbl=$('ep-lightbox-label');
  if(lbl){const sec=_lbSectionLabels[_lbIdx];lbl.textContent=sec||'';lbl.style.display=sec?'block':'none';}
  const prev=$('ep-lightbox-prev'),next=$('ep-lightbox-next');
  if(prev)prev.style.display=_lbGallery.length>1?'flex':'none';
  if(next)next.style.display=_lbGallery.length>1?'flex':'none';
}
function lbNav(dir){
  _lbIdx=(_lbIdx+dir+_lbGallery.length)%_lbGallery.length;
  _lbShow();
}
function closeLightbox(){$('ep-lightbox').classList.remove('open');document.body.style.overflow='';}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')closeLightbox();
  if(e.key==='ArrowLeft')lbNav(-1);
  if(e.key==='ArrowRight')lbNav(1);
});
