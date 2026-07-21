// ── Material Select ────────────────────────────────────────────────────────
function selectMat(key){
  // If price override is active, material selection is disabled
  if(_est && _est.priceOverride) return;
  const mats=window._M||[],acct=window._A||{},prices=window._P||{};
  const m=mats.find(x=>x.key===key);if(!m)return;
  document.querySelectorAll('.ep-mat-card').forEach(c=>c.classList.remove('active'));
  const card=document.querySelector(`.ep-mat-card[onclick="selectMat('${key}')"]`);
  if(card)card.classList.add('active');
  const p=prices[key]||0;
  $('ep-price').textContent=Math.round(p).toLocaleString();
  $('ep-monthly').textContent=acct.financingEnabled!==false?fmtMo(p,acct.financingApr,acct.financingTerm):'';
  try{fetch(API_BASE+'/api/estimate',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'track_event',id:_estId,event:'mat_click',data:{mat:key}})});}catch(e){}
}
