// src/subscription.js
// Stripe billing portal — open portal, switch plan, cancel now, load status.
// Depends on: sb, adminAPI(), toast(), S.cfg, currentAccount

async function openBillingPortal() {
  const btn = document.getElementById('btn-manage-subscription');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening portal...'; }
  try {
    const sess = (await sb.auth.getSession()).data.session;
    if (!sess) { toast('Please log in first.', 'error'); return; }
    const _vaIdBp = (typeof currentAccount !== 'undefined' && currentAccount?.id) || null;
    const r = await fetch('/api/credits?action=billing-portal', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewingAccountId: _vaIdBp })
    });
    const d = await r.json();
    if (!r.ok || !d.portal_url) {
      toast(d.error || 'Could not open billing portal. Please contact support@biddrop.io.', 'error');
      return;
    }
    window.open(d.portal_url, '_blank');
  } catch (e) {
    toast('Error opening billing portal: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '&#128179; Manage Payment Method'; }
  }
}

async function switchPlan(newPlan) {
  const planLabel = newPlan === 'monthly' ? 'Monthly ($99/mo)' : 'Pay-as-you-go (Free)';
  const confirmMsg = newPlan === 'payg'
    ? 'Downgrade to Pay-as-you-go?\n\nYour Monthly subscription will be cancelled immediately. You will lose your 20 included credits/month and GHL sub-account access.\n\nAre you sure?'
    : 'Upgrade to Monthly ($99/mo)?\n\nYou will be charged $99 today and every month going forward. You\'ll get 20 credits/month and a GHL sub-account.\n\nContinue?';
  bdConfirm(confirmMsg, async () => {
    const btnPayg = document.getElementById('btn-switch-payg');
    const btnMonthly = document.getElementById('btn-switch-monthly');
    if (btnPayg) btnPayg.disabled = true;
    if (btnMonthly) btnMonthly.disabled = true;
    try {
      const sess = (await sb.auth.getSession()).data.session;
      if (!sess) { toast('Please log in first.', 'error'); return; }
      const _vaId = (typeof currentAccount !== 'undefined' && currentAccount?.id) || null;
      const r = await fetch('/api/credits?action=change-plan', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewingAccountId: _vaId, newPlan })
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Could not switch plan. Please contact support@biddrop.io.', 'error'); return; }
      toast('Plan changed to ' + planLabel + '!', 'success');
      // Update S.cfg.plan and refresh UI
      if (S && S.cfg) S.cfg.plan = newPlan;
      if (currentAccount) currentAccount.plan = newPlan;
      loadBillingStatus();
    } catch (e) {
      toast('Error switching plan: ' + e.message, 'error');
    } finally {
      if (btnPayg) btnPayg.disabled = false;
      if (btnMonthly) btnMonthly.disabled = false;
    }
  });
}

async function confirmCancelNow() {
  bdConfirm('Cancel your BidDrop subscription?\n\nThis takes effect IMMEDIATELY. Your account will drop to the free Pay-as-you-go plan right now.\n\n⚠️ If you have a GHL sub-account, contact support to cancel it separately.\n\nAre you sure?', async () => {
    const btn = document.getElementById('btn-cancel-subscription');
    if (btn) { btn.disabled = true; btn.textContent = 'Cancelling...'; }
    try {
      const sess = (await sb.auth.getSession()).data.session;
      if (!sess) { toast('Please log in first.', 'error'); return; }
      const _vaIdCn = (typeof currentAccount !== 'undefined' && currentAccount?.id) || null;
      const r = await fetch('/api/credits?action=cancel-now', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewingAccountId: _vaIdCn })
      });
      const d = await r.json();
      if (!r.ok) { toast(d.error || 'Could not cancel. Please contact support@biddrop.io.', 'error'); return; }
      toast('Subscription cancelled. You are now on the free plan.', 'info');
      if (S && S.cfg) S.cfg.plan = 'payg';
      if (currentAccount) currentAccount.plan = 'payg';
      loadBillingStatus();
    } catch (e) {
      toast('Error cancelling: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✕ Cancel Subscription'; }
    }
  });
}

// Keep legacy name for any callers
const confirmCancelSubscription = confirmCancelNow;

async function reactivateSubscription() {
  // Legacy — redirect to upgrade flow
  switchPlan('monthly');
}

async function loadBillingStatus() {
  if (!currentAccount) return;
  try {
    const { data: acct } = await sb.from('accounts').select('cancel_at_period_end,payment_failed,plan').eq('id', currentAccount.id).single();
    if (!acct) return;
    const plan = (acct.plan || 'payg').toLowerCase();
    const statusRow = document.getElementById('billing-status-row');
    const badge = document.getElementById('current-plan-badge');
    const cardPayg = document.getElementById('plan-card-payg');
    const cardMonthly = document.getElementById('plan-card-monthly');
    const btnSwitchPayg = document.getElementById('btn-switch-payg');
    const btnSwitchMonthly = document.getElementById('btn-switch-monthly');

    // Highlight active plan card
    if (cardPayg && cardMonthly) {
      if (plan === 'monthly') {
        cardMonthly.style.border = '2px solid var(--accent)';
        cardPayg.style.border = '2px solid var(--border)';
        cardPayg.style.opacity = '0.7';
        cardMonthly.style.opacity = '1';
        if (btnSwitchMonthly) { btnSwitchMonthly.textContent = '✓ Current Plan'; btnSwitchMonthly.disabled = true; btnSwitchMonthly.style.opacity = '0.5'; }
        if (btnSwitchPayg) { btnSwitchPayg.textContent = 'Downgrade to Free'; btnSwitchPayg.disabled = false; btnSwitchPayg.style.opacity = '1'; }
      } else {
        cardPayg.style.border = '2px solid var(--accent)';
        cardMonthly.style.border = '2px solid var(--border)';
        cardMonthly.style.opacity = '0.7';
        cardPayg.style.opacity = '1';
        if (btnSwitchPayg) { btnSwitchPayg.textContent = '✓ Current Plan'; btnSwitchPayg.disabled = true; btnSwitchPayg.style.opacity = '0.5'; }
        if (btnSwitchMonthly) { btnSwitchMonthly.textContent = 'Upgrade to Monthly'; btnSwitchMonthly.disabled = false; btnSwitchMonthly.style.opacity = '1'; }
      }
    }

    // Badge
    if (badge) {
      const planNames = { monthly: 'Monthly — $99/mo', payg: 'Pay-as-you-go — Free' };
      badge.innerHTML = '📋 Current plan: <strong>' + (planNames[plan] || plan) + '</strong>';
    }

    // Status alerts
    if (statusRow) {
      if (acct.payment_failed) {
        statusRow.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:10px 14px;font-size:12px;color:#dc2626;font-weight:600;">⚠️ Payment failed — please update your payment method via "Manage Payment Method".</div>';
      } else {
        statusRow.innerHTML = '';
      }
    }
  } catch (e) { /* silent */ }
}
