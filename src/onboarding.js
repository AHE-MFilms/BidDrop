// BidDrop — Onboarding Checklist (Build 15)
// Persistent sidebar card shown to new users until all steps are complete.
// Progress stored in accounts.onboarding_steps_json via S.cfg.onboardingSteps.
// Supports collapse/expand (arrow) and permanent dismiss (×).
// Depends on: state.js (S, currentAccount, sb), api.js (save), trades.js (goTab)

// Step definitions — id must be stable (used as keys in the DB)
const ONBOARDING_STEPS = [
  { id: 'logo',     label: 'Upload your logo',                  icon: '🖼',  action: ()=>goTab('settings'), actionLabel: 'Go to Settings' },
  { id: 'phone',    label: 'Add your company phone & address',  icon: '📞',  action: ()=>goTab('settings'), actionLabel: 'Go to Settings' },
  { id: 'color',    label: 'Set your brand color',              icon: '🎨',  action: ()=>goTab('settings'), actionLabel: 'Go to Settings' },
  { id: 'design',   label: 'Design your postcard',              icon: '📬',  action: ()=>goTab('designs'),  actionLabel: 'Open Postcard Designer' },
  { id: 'pin',      label: 'Drop your first pin on the map',    icon: '📍',  action: ()=>goTab('map'),      actionLabel: 'Open Map' },
  { id: 'estimate', label: 'Build your first estimate',         icon: '📋',  action: ()=>goTab('estimate'), actionLabel: 'Open Estimator' },
  { id: 'mailer',   label: 'Send your first mailer',            icon: '✉️',  action: ()=>goTab('mailqueue'),actionLabel: 'Open Mail Queue' },
  { id: 'ghl',      label: 'Connect GHL integration',           icon: '🔗',  action: ()=>goTab('settings'), actionLabel: 'Go to Settings', planGate: 'pro' },
  { id: 'license',  label: 'Add your contractor license #',      icon: '📜',  action: ()=>goTab('settings'), actionLabel: 'Go to Settings' },
];

// Track collapsed state in memory (not persisted — resets on reload)
let _obCollapsed = false;

// Returns the current onboarding steps object, initializing if null
function getOnboardingSteps() {
  if (!S.cfg.onboardingSteps) S.cfg.onboardingSteps = {};
  return S.cfg.onboardingSteps;
}

// Auto-detect completed steps based on current S.cfg state
function autoDetectCompletedSteps() {
  const steps = getOnboardingSteps();
  let changed = false;

  if (!steps.logo     && S.cfg.logoData)                                                          { steps.logo     = true; changed = true; }
  if (!steps.phone    && S.cfg.companyPhone && S.cfg.companyAddr)                                 { steps.phone    = true; changed = true; }
  if (!steps.color    && S.cfg.brandColor && S.cfg.brandColor !== '#F25C05')                      { steps.color    = true; changed = true; }
  if (!steps.design   && (S.cfg.canvasDesignFrontJson || S.cfg.postcardDesigns?.length))          { steps.design   = true; changed = true; }
  if (!steps.pin      && S.pins && S.pins.filter(p=>!p.deleted_at).length > 0)                   { steps.pin      = true; changed = true; }
  if (!steps.estimate && S.estimates && S.estimates.length > 0)                                   { steps.estimate = true; changed = true; }
  if (!steps.ghl      && (S.cfg.ghlOauthLocationId || S.cfg.ghlLocationId))                      { steps.ghl      = true; changed = true; }
  if (!steps.license  && S.cfg.licenseNum && S.cfg.licenseNum.trim())                            { steps.license  = true; changed = true; }

  if (changed) save();
  return steps;
}

// Mark a step as manually completed
function markOnboardingStep(stepId) {
  const steps = getOnboardingSteps();
  if (!steps[stepId]) {
    steps[stepId] = true;
    S.cfg.onboardingSteps = steps;
    save();
    renderOnboardingChecklist();
  }
}

// Mark the mailer step complete — called from mail-queue-lob.js after first send
function markMailerStepComplete() {
  markOnboardingStep('mailer');
}

// Check if all applicable steps are done (respecting plan gates)
function isOnboardingComplete() {
  const steps = autoDetectCompletedSteps();
  const plan = (S.cfg.plan||'payg').toLowerCase();
  const isPro = ['monthly','pro','agency','enterprise'].includes(plan);
  return ONBOARDING_STEPS
    .filter(s => !s.planGate || (s.planGate === 'pro' && isPro))
    .every(s => steps[s.id]);
}

// Dismiss the checklist permanently (marks all steps done + removes card)
function dismissOnboarding() {
  const steps = getOnboardingSteps();
  ONBOARDING_STEPS.forEach(s => { steps[s.id] = true; });
  S.cfg.onboardingSteps = steps;
  save();
  const el = document.getElementById('bd-onboarding-card');
  if (el) el.remove();
}

// Toggle collapsed/expanded state
function toggleOnboardingCollapse() {
  _obCollapsed = !_obCollapsed;
  const body  = document.getElementById('bd-ob-body');
  const arrow = document.getElementById('bd-ob-arrow');
  if (!body || !arrow) return;
  if (_obCollapsed) {
    body.style.display  = 'none';
    arrow.style.transform = 'rotate(-90deg)';
  } else {
    body.style.display  = 'block';
    arrow.style.transform = 'rotate(0deg)';
  }
}

// Render the onboarding checklist card into the sidebar
function renderOnboardingChecklist() {
  // Remove existing card
  const existing = document.getElementById('bd-onboarding-card');
  if (existing) existing.remove();

  // Don't show if complete
  if (isOnboardingComplete()) return;

  const steps = autoDetectCompletedSteps();
  const plan = (S.cfg.plan||'payg').toLowerCase();
  const isPro = ['monthly','pro','agency','enterprise'].includes(plan);

  const applicableSteps = ONBOARDING_STEPS.filter(s => !s.planGate || (s.planGate === 'pro' && isPro));
  const completedCount  = applicableSteps.filter(s => steps[s.id]).length;
  const totalCount      = applicableSteps.length;
  const pct             = Math.round((completedCount / totalCount) * 100);

  // Build step rows HTML
  const stepsHtml = applicableSteps.map(s => {
    const done = !!steps[s.id];
    return `
      <div class="bd-ob-step${done ? ' done' : ''}" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <div onclick="markOnboardingStep('${s.id}')" title="Mark complete"
          style="width:18px;height:18px;border-radius:50%;border:2px solid ${done ? '#22c55e' : 'rgba(255,255,255,.25)'};background:${done ? '#22c55e' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:11px;color:#fff;">
          ${done ? '✓' : ''}
        </div>
        <span style="flex:1;font-size:12px;color:${done ? 'var(--muted)' : 'var(--text)'};text-decoration:${done ? 'line-through' : 'none'};line-height:1.3;">${s.icon} ${s.label}</span>
        ${!done ? `<button onclick="(${s.action.toString()})()" style="font-size:10px;background:rgba(249,115,22,.15);color:var(--accent);border:1px solid rgba(249,115,22,.3);border-radius:5px;padding:2px 7px;cursor:pointer;white-space:nowrap;flex-shrink:0;">${s.actionLabel}</button>` : ''}
      </div>`;
  }).join('');

  const card = document.createElement('div');
  card.id = 'bd-onboarding-card';
  card.style.cssText = 'margin:10px 10px 0;background:var(--card2);border:1px solid rgba(249,115,22,.3);border-radius:10px;flex-shrink:0;overflow:hidden;';

  card.innerHTML = `
    <!-- Header row: always visible -->
    <div onclick="toggleOnboardingCollapse()" style="display:flex;align-items:center;gap:6px;padding:10px 12px;cursor:pointer;user-select:none;">
      <span style="font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);flex:1;">🚀 Getting Started</span>
      <span style="font-size:11px;color:var(--muted);font-weight:600;margin-right:4px;">${completedCount}/${totalCount}</span>
      <!-- Collapse arrow -->
      <span id="bd-ob-arrow" style="color:var(--muted);font-size:13px;transition:transform .2s;transform:${_obCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};line-height:1;">▾</span>
      <!-- Dismiss × — stops click from bubbling to collapse toggle -->
      <button onclick="event.stopPropagation();dismissOnboarding()" title="Dismiss permanently"
        style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;line-height:1;padding:0 0 0 6px;margin-left:2px;">×</button>
    </div>

    <!-- Collapsible body -->
    <div id="bd-ob-body" style="display:${_obCollapsed ? 'none' : 'block'};padding:0 12px 12px;">
      <!-- Progress bar -->
      <div style="background:rgba(255,255,255,.08);border-radius:4px;height:4px;margin-bottom:10px;overflow:hidden;">
        <div style="background:var(--accent);height:100%;width:${pct}%;border-radius:4px;transition:width .3s ease;"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${completedCount} of ${totalCount} steps complete</div>
      <div>${stepsHtml}</div>
    </div>
  `;

  // Insert after the user strip (before the nav)
  const nav = document.querySelector('#bd-sidebar .bd-sb-nav');
  if (nav) {
    nav.parentNode.insertBefore(card, nav);
  }
}

// Show a persistent yellow warning banner if the roofer has no license number
function renderLicenseBanner() {
  const existing = document.getElementById('bd-license-banner');
  if (existing) existing.remove();
  // Only show to admins who are missing their license number
  if (!isAdminOrAbove()) return;
  if (S.cfg.licenseNum && S.cfg.licenseNum.trim()) return; // already set
  const banner = document.createElement('div');
  banner.id = 'bd-license-banner';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#1c1917;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 16px;box-shadow:0 -2px 12px rgba(0,0,0,.25);';
  banner.innerHTML = `
    <span>⚠️ Your contractor license number is missing — required for postcards and estimate pages.</span>
    <button onclick="goTab('settings');document.getElementById('bd-license-banner')?.remove()" style="background:#1c1917;color:#fbbf24;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;">Add License →</button>
    <button onclick="document.getElementById('bd-license-banner')?.remove()" style="background:none;border:none;color:#1c1917;font-size:18px;cursor:pointer;line-height:1;opacity:.6;">×</button>
  `;
  document.body.appendChild(banner);
}

// Called from auth.js after account loads — initialize the checklist
function initOnboarding() {
  // Only show to admins (not reps)
  if (!isAdminOrAbove()) return;
  // Slight delay to let S.pins / S.estimates load
  setTimeout(() => {
    renderOnboardingChecklist();
    renderLicenseBanner();
  }, 1200);
}
