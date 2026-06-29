// BidDrop — Credit badge, buy credits modal, Stripe checkout
// Depends on: state.js (S, currentAccount), ui.js (toast, openM, closeM), api.js (adminAPI)

function updateCreditBadge(){
  const badge = document.getElementById('credit-badge-label');
  if(!badge) return;
  // Use mailerCredits (new model: 1 credit = $4 = 1 postcard)
  const plan = (S.cfg.plan||'starter').toLowerCase();
  const planFreeMap = {starter:0,pro:0,agency:0,enterprise:0};
  const freeLimit = planFreeMap[plan] || 0;
  const freeLeft = Math.max(0, freeLimit - (S.cfg.freeMailerCreditsUsed||0));
  const paid     = S.cfg.mailerCredits || 0;
  const total    = freeLeft + paid;
  if(total > 0){
    badge.textContent = total + ' credits';
    document.getElementById('credit-badge-btn').style.borderColor = 'rgba(255,255,255,.15)';
  } else {
    badge.textContent = 'Buy Credits';
    document.getElementById('credit-badge-btn').style.borderColor = '#ef4444';
  }
  // Update the Mail Queue credits bar total
  const qTotal = document.getElementById('qcb-total');
  if(qTotal) qTotal.textContent = total;
  // Color the buy button red if out of credits
  const buyBtn = document.querySelector('#queue-credits-bar button');
  if(buyBtn){
    if(total === 0){
      buyBtn.style.background = '#ef4444';
      buyBtn.textContent = 'Out of Credits — Buy Now';
    } else {
      buyBtn.style.background = 'var(--accent)';
      buyBtn.textContent = '+ Buy Credits';
    }
  }
  // Keep sidebar credit label in sync with badge
  if(typeof updateSidebarBadge === 'function') updateSidebarBadge();
}

async function showBuyCreditsModal(){
  // Show cached balance immediately, then refresh from server
  const totalEl = document.getElementById('cb-total-credits');
  const total = S.cfg.mailerCredits || 0;
  if(totalEl) totalEl.textContent = total;
  openM('m-buy-credits');
  // Refresh balance from server in background
  try{
    const sess = (await sb.auth.getSession()).data.session;
    if(sess){
      const _vaIdC = window.currentAccount?.id ? '&viewingAccountId='+encodeURIComponent(window.currentAccount.id) : '';
      const r = await fetch('/api/credits?action=balance'+_vaIdC,{ headers:{ 'Authorization':'Bearer '+sess.access_token } });
      if(r.ok){
        const b = await r.json();
        S.cfg.mailerCredits = b.paid_credits;
        updateCreditBadge();
        if(totalEl) totalEl.textContent = S.cfg.mailerCredits || 0;
      }
    }
  }catch(_){}
}

async function buyCredits(packId, btn){
  try{
    const sess = (await sb.auth.getSession()).data.session;
    if(!sess){ toast('Please sign in first.','error'); return; }
    if(!btn) btn = document.querySelector(`[onclick*="'${packId}'"]`);
    const origText = btn.innerHTML;
    btn.innerHTML = '<span style="opacity:.5;">Loading...</span>';
    btn.disabled = true;
    const _vaIdCo = window.currentAccount?.id || null;
    const r = await fetch('/api/credits?action=checkout',{
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+sess.access_token },
      body: JSON.stringify({ pack_id: packId, viewingAccountId: _vaIdCo })
    });
    const data = await r.json();
    btn.innerHTML = origText;
    btn.disabled = false;
    if(data.checkout_url){
      window.location.href = data.checkout_url;
    } else {
      toast('Error: '+(data.error||'Could not start checkout'),'error');
    }
  }catch(e){
    toast('Error: '+e.message,'error');
  }
}
