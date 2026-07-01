// BidDrop — Modal helpers, toast, credit lookup, auth helpers
// Extracted from index.html inline block

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
