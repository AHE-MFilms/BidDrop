// BidDrop — Plan-Specific Activation Checklist
// Persistent sidebar card for admins. Progress is stored in
// accounts.onboarding_steps_json via S.cfg.onboardingSteps.
// Depends on: state.js (S, currentAccount), api.js (save), trades.js (goTab).

const ACTIVATION_VERSION = 1;

const PLAN_ACTIVATION_CHECKLISTS = {
  payg: {
    label: 'Launch your first neighborhood',
    detail: 'Start with one property, prove the workflow, then scale when you are ready.',
    steps: [
      { id: 'payg_first_pin', label: 'Drop your first pin', icon: '📍', auto: 'pin', action: 'map', actionLabel: 'Open Map' },
      { id: 'payg_first_estimate', label: 'Build your first estimate', icon: '📋', auto: 'estimate', action: 'estimate', actionLabel: 'Open Estimator' },
      { id: 'payg_brand_basics', label: 'Add company phone and branding', icon: '🏷️', auto: 'brand', action: 'profile', actionLabel: 'Open Profile' }
    ]
  },
  monthly: {
    label: 'Set up your field-sales team',
    detail: 'Connect your sales workflow before your first active canvass.',
    steps: [
      { id: 'monthly_first_teammate', label: 'Invite your first teammate', icon: '👥', action: 'invite', actionLabel: 'Invite Team' },
      { id: 'monthly_connect_crm', label: 'Connect GoHighLevel or another CRM', icon: '🔗', auto: 'crm', action: 'integrations', actionLabel: 'Open Integrations' },
      { id: 'monthly_first_pin', label: 'Drop your first pin', icon: '📍', auto: 'pin', action: 'map', actionLabel: 'Open Map' }
    ]
  },
  digital_growth: {
    label: 'Start your growth partnership',
    detail: 'Give the AHE team the inputs needed to begin your growth plan.',
    steps: [
      { id: 'growth_kickoff', label: 'Book your growth kickoff', icon: '📅', action: 'kickoff', actionLabel: 'Request Kickoff' },
      { id: 'growth_assets', label: 'Send your logo, service area, and best project photos', icon: '📤', action: 'assets', actionLabel: 'Send Assets' },
      { id: 'growth_brand_profile', label: 'Complete your BidDrop company profile', icon: '🏷️', auto: 'brand', action: 'profile', actionLabel: 'Open Profile' }
    ]
  },
  omnipresent: {
    label: 'Begin your omnipresent rollout',
    detail: 'Coordinate your team and brand inputs so AHE can start the full marketing rollout.',
    steps: [
      { id: 'omni_kickoff', label: 'Book your strategy kickoff', icon: '📅', action: 'kickoff', actionLabel: 'Request Kickoff' },
      { id: 'omni_assets', label: 'Send your brand and project assets', icon: '📤', action: 'assets', actionLabel: 'Send Assets' },
      { id: 'omni_first_teammate', label: 'Invite your field-sales lead', icon: '👥', action: 'invite', actionLabel: 'Invite Team' }
    ]
  }
};

let _obCollapsed = false;

function getOnboardingSteps() {
  if (!S.cfg.onboardingSteps || typeof S.cfg.onboardingSteps !== 'object') S.cfg.onboardingSteps = {};
  return S.cfg.onboardingSteps;
}

function getActivationPlan() {
  const plan = String(S.cfg.plan || 'payg').toLowerCase();
  if (['monthly', 'pro', 'agency', 'enterprise'].includes(plan)) return 'monthly';
  if (plan === 'digital_growth') return 'digital_growth';
  if (plan === 'omnipresent') return 'omnipresent';
  return 'payg';
}

function getActivationState() {
  const onboarding = getOnboardingSteps();
  const plan = getActivationPlan();
  const current = onboarding.activation;
  if (!current || current.version !== ACTIVATION_VERSION || current.plan !== plan) {
    onboarding.activation = { version: ACTIVATION_VERSION, plan, completed: {}, dismissed: false };
  }
  return onboarding.activation;
}

function getActivationChecklist() {
  return PLAN_ACTIVATION_CHECKLISTS[getActivationPlan()] || PLAN_ACTIVATION_CHECKLISTS.payg;
}

function activationAutoComplete(kind) {
  if (kind === 'pin') return !!(S.pins && S.pins.some(pin => !pin.deleted_at));
  if (kind === 'estimate') return !!(S.estimates && S.estimates.length);
  if (kind === 'crm') return !!(S.cfg.ghlOauthLocationId || S.cfg.ghlLocationId || S.cfg.jnApiKey || S.cfg.jobberApiKey || S.cfg.webhookUrl);
  if (kind === 'brand') return !!(S.cfg.companyPhone && S.cfg.companyAddr && (S.cfg.logoData || S.cfg.brandColor));
  return false;
}

function autoDetectCompletedSteps() {
  const state = getActivationState();
  const checklist = getActivationChecklist();
  let changed = false;
  checklist.steps.forEach(step => {
    if (!state.completed[step.id] && step.auto && activationAutoComplete(step.auto)) {
      state.completed[step.id] = true;
      changed = true;
    }
  });
  if (changed) save();
  return state;
}

function markOnboardingStep(stepId) {
  const state = getActivationState();
  if (!state.completed[stepId]) {
    state.completed[stepId] = true;
    save();
    renderOnboardingChecklist();
  }
}

// Retained for mail-queue callers from the prior generic checklist.
function markMailerStepComplete() {
  const state = getActivationState();
  state.completed.mailer = true;
  save();
}

function isOnboardingComplete() {
  const state = autoDetectCompletedSteps();
  return getActivationChecklist().steps.every(step => state.completed[step.id]);
}

function dismissOnboarding() {
  const state = getActivationState();
  state.dismissed = true;
  save();
  document.getElementById('bd-onboarding-card')?.remove();
}

function toggleOnboardingCollapse() {
  _obCollapsed = !_obCollapsed;
  const body = document.getElementById('bd-ob-body');
  const arrow = document.getElementById('bd-ob-arrow');
  if (body) body.style.display = _obCollapsed ? 'none' : 'block';
  if (arrow) arrow.style.transform = _obCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
}

function runOnboardingAction(action) {
  if (action === 'map') return goTab('map');
  if (action === 'estimate') return goTab('estimate');
  if (action === 'profile') {
    goTab('settings');
    return setTimeout(() => typeof switchSettingsTab === 'function' && switchSettingsTab('profile'), 200);
  }
  if (action === 'integrations') {
    goTab('settings');
    return setTimeout(() => typeof switchSettingsTab === 'function' && switchSettingsTab('integrations'), 200);
  }
  if (action === 'invite') {
    goTab('settings');
    return setTimeout(() => {
      if (typeof openInviteRepModal === 'function') openInviteRepModal();
      else toast('Open Settings → Team Members to invite a teammate.', 'info');
    }, 250);
  }
  if (action === 'kickoff') {
    window.location.href = 'mailto:support@biddrop.io?subject=' + encodeURIComponent('BidDrop growth kickoff request');
    return;
  }
  if (action === 'assets') {
    window.location.href = 'mailto:support@biddrop.io?subject=' + encodeURIComponent('BidDrop brand and project assets') + '&body=' + encodeURIComponent('Company name:\nService area:\nWebsite:\nBest project-photo link:\nNotes for the AHE team:');
  }
}

function renderOnboardingChecklist() {
  document.getElementById('bd-onboarding-card')?.remove();
  if (!isAdminOrAbove()) return;

  const state = autoDetectCompletedSteps();
  const checklist = getActivationChecklist();
  if (state.dismissed || isOnboardingComplete()) return;

  const completedCount = checklist.steps.filter(step => state.completed[step.id]).length;
  const totalCount = checklist.steps.length;
  const pct = Math.round((completedCount / totalCount) * 100);
  const stepsHtml = checklist.steps.map(step => {
    const done = !!state.completed[step.id];
    return `<div class="bd-ob-step${done ? ' done' : ''}" style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);">
      <div onclick="markOnboardingStep('${step.id}')" title="Mark complete" style="width:18px;height:18px;border-radius:50%;border:2px solid ${done ? '#22c55e' : 'rgba(255,255,255,.25)'};background:${done ? '#22c55e' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:11px;color:#fff;">${done ? '✓' : ''}</div>
      <span style="flex:1;font-size:12px;color:${done ? 'var(--muted)' : 'var(--text)'};text-decoration:${done ? 'line-through' : 'none'};line-height:1.3;">${step.icon} ${step.label}</span>
      ${!done ? `<button onclick="runOnboardingAction('${step.action}')" style="font-size:10px;background:rgba(249,115,22,.15);color:var(--accent);border:1px solid rgba(249,115,22,.3);border-radius:5px;padding:3px 7px;cursor:pointer;white-space:nowrap;flex-shrink:0;">${step.actionLabel}</button>` : ''}
    </div>`;
  }).join('');

  const card = document.createElement('div');
  card.id = 'bd-onboarding-card';
  card.style.cssText = 'margin:10px 10px 0;background:var(--card2);border:1px solid rgba(249,115,22,.3);border-radius:10px;flex-shrink:0;overflow:hidden;';
  card.innerHTML = `<div onclick="toggleOnboardingCollapse()" style="display:flex;align-items:center;gap:6px;padding:10px 12px;cursor:pointer;user-select:none;">
      <span style="font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);flex:1;">🚀 ${checklist.label}</span>
      <span style="font-size:11px;color:var(--muted);font-weight:600;margin-right:4px;">${completedCount}/${totalCount}</span>
      <span id="bd-ob-arrow" style="color:var(--muted);font-size:13px;transition:transform .2s;transform:${_obCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'};line-height:1;">▾</span>
      <button onclick="event.stopPropagation();dismissOnboarding()" title="Hide checklist" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;line-height:1;padding:0 0 0 6px;margin-left:2px;">×</button>
    </div>
    <div id="bd-ob-body" style="display:${_obCollapsed ? 'none' : 'block'};padding:0 12px 12px;">
      <div style="font-size:11px;color:var(--muted);line-height:1.35;margin:0 0 9px;">${checklist.detail}</div>
      <div style="background:rgba(255,255,255,.08);border-radius:4px;height:4px;margin-bottom:10px;overflow:hidden;"><div style="background:var(--accent);height:100%;width:${pct}%;border-radius:4px;transition:width .3s ease;"></div></div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${completedCount} of ${totalCount} activation steps complete</div>
      <div>${stepsHtml}</div>
    </div>`;
  const nav = document.querySelector('#bd-sidebar .bd-sb-nav');
  if (nav) nav.parentNode.insertBefore(card, nav);
}

// Keep the existing non-blocking license reminder, while honoring the user's
// state-specific licensing rules by never using it as a checklist requirement.
function renderLicenseBanner() {
  const existing = document.getElementById('bd-license-banner');
  if (existing) existing.remove();
  if (!isAdminOrAbove() || (S.cfg.licenseNum && S.cfg.licenseNum.trim())) return;
  const banner = document.createElement('div');
  banner.id = 'bd-license-banner';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#f59e0b;color:#1c1917;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 16px;box-shadow:0 -2px 12px rgba(0,0,0,.25);';
  banner.innerHTML = `<span>⚠️ Check your local licensing requirements before using contractor-license details on marketing materials.</span><button onclick="goTab('settings');document.getElementById('bd-license-banner')?.remove()" style="background:#1c1917;color:#fbbf24;border:none;border-radius:6px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer;">Review Settings →</button><button onclick="document.getElementById('bd-license-banner')?.remove()" style="background:none;border:none;color:#1c1917;font-size:18px;cursor:pointer;line-height:1;opacity:.6;">×</button>`;
  document.body.appendChild(banner);
}

function initOnboarding() {
  if (!isAdminOrAbove()) return;
  setTimeout(() => {
    renderOnboardingChecklist();
    renderLicenseBanner();
  }, 1200);
}
