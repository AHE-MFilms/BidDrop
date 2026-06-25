// src/subscription.js
// Stripe billing portal — open portal, cancel, reactivate, load status.
// Depends on: sb, adminAPI(), toast(), S.cfg
// Extracted from index.html — Tier 3 modularization

async function openBillingPortal() {
  const btn = document.getElementById('btn-manage-subscription');
  if (btn) { btn.disabled = true; btn.textContent = 'Opening portal...'; }
  try {
    const sess = (await sb.auth.getSession()).data.session;
    if (!sess) { toast('Please log in first.', 'error'); return; }
    const r = await fetch('/api/credits?action=billing-portal', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' }
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
    if (btn) { btn.disabled = false; btn.innerHTML = '&#128179; Manage Subscription'; }
  }
}
async function confirmCancelSubscription() {
  bdConfirm('Cancel your BidDrop subscription?\n\nYour plan will remain active until the end of the current billing period. After that, your account will be deactivated.\n\nAre you sure you want to cancel?', async ()=>{
  const btn = document.getElementById('btn-cancel-subscription');
  if (btn) { btn.disabled = true; btn.textContent = 'Cancelling...'; }
  try {
    const sess = (await sb.auth.getSession()).data.session;
    if (!sess) { toast('Please log in first.', 'error'); return; }
    const r = await fetch('/api/credits?action=cancel-subscription', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' }
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Could not cancel subscription. Please contact support@biddrop.io.', 'error'); return; }
    const endDate = d.current_period_end ? new Date(d.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'end of billing period';
    toast('Subscription cancelled. Access continues until ' + endDate + '.', 'info');
    const cancelBtn = document.getElementById('btn-cancel-subscription');
    const reactivateBtn = document.getElementById('btn-reactivate-subscription');
    const statusRow = document.getElementById('billing-status-row');
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (reactivateBtn) reactivateBtn.style.display = '';
    if (statusRow) statusRow.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:10px 14px;font-size:12px;color:#dc2626;font-weight:600;">&#9888; Subscription cancelled \u2014 access ends ' + endDate + '. Click \u201cUndo Cancellation\u201d to keep your plan.</div>';
  } catch (e) {
    toast('Error cancelling subscription: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Cancel Plan'; }
  }
  }); // end bdConfirm
}
async function reactivateSubscription() {
  const btn = document.getElementById('btn-reactivate-subscription');
  if (btn) { btn.disabled = true; btn.textContent = 'Reactivating...'; }
  try {
    const sess = (await sb.auth.getSession()).data.session;
    if (!sess) { toast('Please log in first.', 'error'); return; }
    const r = await fetch('/api/credits?action=reactivate-subscription', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' }
    });
    const d = await r.json();
    if (!r.ok) { toast(d.error || 'Could not reactivate. Please contact support@biddrop.io.', 'error'); return; }
    toast('Subscription reactivated! Your plan will continue as normal.', 'success');
    const cancelBtn = document.getElementById('btn-cancel-subscription');
    const reactivateBtn = document.getElementById('btn-reactivate-subscription');
    const statusRow = document.getElementById('billing-status-row');
    if (cancelBtn) cancelBtn.style.display = '';
    if (reactivateBtn) reactivateBtn.style.display = 'none';
    if (statusRow) statusRow.innerHTML = '';
  } catch (e) {
    toast('Error reactivating: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '&#9989; Undo Cancellation'; }
  }
}
async function loadBillingStatus() {
  if (!currentAccount) return;
  try {
    const { data: acct } = await sb.from('accounts').select('cancel_at_period_end,payment_failed').eq('id', currentAccount.id).single();
    if (!acct) return;
    const statusRow = document.getElementById('billing-status-row');
    const cancelBtn = document.getElementById('btn-cancel-subscription');
    const reactivateBtn = document.getElementById('btn-reactivate-subscription');
    if (!statusRow) return;
    if (acct.payment_failed) {
      statusRow.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:10px 14px;font-size:12px;color:#dc2626;font-weight:600;">&#9888; Payment failed \u2014 please update your payment method via \u201cManage Subscription\u201d.</div>';
    } else if (acct.cancel_at_period_end) {
      statusRow.innerHTML = '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:10px 14px;font-size:12px;color:#dc2626;font-weight:600;">&#9888; Subscription is set to cancel at end of billing period. Click \u201cUndo Cancellation\u201d to keep your plan.</div>';
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (reactivateBtn) reactivateBtn.style.display = '';
    }
  } catch (e) { /* silent */ }
}



