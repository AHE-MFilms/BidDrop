// BidDrop — Modal helpers, toast, credit lookup, auth helpers
// Extracted from index.html inline block

// ═══════════════════════════════════════════════════════════════
//  GLOBAL ERROR BOUNDARY
//  Catches any uncaught JS error or unhandled promise rejection
//  and shows a non-blocking toast instead of silently freezing.
// ═══════════════════════════════════════════════════════════════
(function _installErrorBoundary() {
  // Prevent double-install on hot reload
  if (window.__bdErrorBoundaryInstalled) return;
  window.__bdErrorBoundaryInstalled = true;

  function _showErrorToast(msg, source) {
    // Use the app's own toast() if available, otherwise fall back to console
    if (typeof toast === 'function') {
      toast('⚠️ ' + (msg || 'Unexpected error') + (source ? ' [' + source + ']' : ''), 'error');
    } else {
      console.error('[BidDrop error boundary]', msg, source);
    }
  }

  // Synchronous errors (TypeError: Cannot read properties of null, etc.)
  window.addEventListener('error', function(e) {
    // Ignore cross-origin script errors (no useful info available)
    if (!e.message || e.message === 'Script error.') return;
    // Ignore ResizeObserver loop limit exceeded (harmless browser noise)
    if (e.message && e.message.includes('ResizeObserver loop')) return;
    var src = e.filename ? e.filename.split('/').pop() + ':' + e.lineno : '';
    _showErrorToast(e.message, src);
    // Don't suppress — let it still log to console for debugging
  });

  // Unhandled promise rejections (async function throws, fetch fails, etc.)
  window.addEventListener('unhandledrejection', function(e) {
    var msg = e.reason
      ? (e.reason.message || String(e.reason)).substring(0, 120)
      : 'Unhandled promise rejection';
    // Ignore Supabase realtime channel noise
    if (msg.includes('channel') || msg.includes('WebSocket')) return;
    _showErrorToast(msg, 'async');
  });
})();

//  MODAL / TOAST / UTILS
// ═══════════════════════════════




// ═══════════════════════════════
//  LOOKUP CREDITS
// ═══════════════════════════════




// ═══════════════════════════════
//  GHL INTEGRATION
// ═══════════════════════════════



// ═══════════════════════════════
//  AUTH HELPERS
// ═══════════════════════════════



function applyRoleUI(){
  // Hide settings gear from reps
  const gear = document.querySelector('.icon-btn[onclick="openSettings()"]');
  const gearNav = document.querySelector('.bnav-btn[onclick="openSettings()"]');
  if(gear) gear.style.display = isAdminOrAbove() ? 'flex' : 'none';
  if(gearNav) gearNav.style.display = isAdminOrAbove() ? 'flex' : 'none';
  // Show Admin Panel button in nav for super_admin
  const adminPanelBtn = document.getElementById('admin-panel-tab-btn');
  if(adminPanelBtn) adminPanelBtn.style.display = isSuperAdmin() ? 'flex' : 'none';
  // Show Agency tab only for super_admin
  const agencyTabBtn = document.getElementById('agency-tab-btn');
  if(agencyTabBtn) agencyTabBtn.style.display = isSuperAdmin() ? 'flex' : 'none';
  // Update user badge
  const badge = document.getElementById('user-badge');
  if(badge && currentProfile){
    badge.textContent = (currentProfile.name||currentProfile.email||'User').split(' ')[0];
    badge.title = currentProfile.role.replace('_',' ').toUpperCase();
  }
  // Sync hamburger nav menu visibility
  if(typeof syncNavRoleUI === 'function') syncNavRoleUI();
  // Plan-based UI gates
  applyPlanUI();
}
function applyPlanUI(){
  // Estimate Page Settings section — Pro+ only
  const epBadge = document.getElementById('estimate-page-plan-badge');
  if(epBadge) epBadge.style.display = isPlanAtLeast('pro') ? 'none' : 'inline-block';
  const epSection = document.getElementById('estimate-page-settings-section');
  if(epSection) epSection.style.opacity = isPlanAtLeast('pro') ? '1' : '0.5';
  // GHL settings section — Pro+ only
  const ghlSection = document.querySelector('.stab-card-body #stab-body-integrations');
  // (GHL is shown to all but gates on send)
  // Quote page settings — Pro+ only (show slug input only for Pro+)
  // (Quote page slug is admin-set, not user-facing in settings)
}

// ═══════════════════════════════
