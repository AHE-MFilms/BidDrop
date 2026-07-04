// BidDrop — Onboarding Checklist (Build 14)
// Persistent sidebar card shown to new users until all steps are complete.
// Progress stored in accounts.onboarding_steps_json via S.cfg.onboardingSteps.
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
];

// Returns the current onboarding steps object, initializing if null
function getOnboardingSteps() {
  if (!S.cfg.onboardingSteps) {
    S.cfg.onboardingSteps = {};
  }
  return S.cfg.onboardingSteps;
}

// Auto-detect completed steps based on current S.cfg state
function autoDetectCompletedSteps() {
  const steps = getOnboardingSteps();
  let changed = false;

  // Logo uploaded
  if (!steps.logo && S.cfg.logoData) { steps.logo = true; changed = true; }
  // Phone AND address filled
  if (!steps.phone && S.cfg.companyPhone && S.cfg.companyAddr) { steps.phone = true; changed = true; }
  // Brand color changed from default
  if (!steps.color && S.cfg.brandColor && S.cfg.brandColor !== '#F25C05') { steps.color = true; changed = true; }
  // Postcard design exists (canvas or legacy)
  if (!steps.design && (S.cfg.canvasDesignFrontJson || S.cfg.postcardDesigns?.length)) { steps.design = true; changed = true; }
  // Pins dropped — checked via S.pins array
  if (!steps.pin && S.pins && S.pins.filter(p=>!p.deleted_at).length > 0) { steps.pin = true; changed = true; }
  // Estimates built
  if (!steps.estimate && S.estimates && S.estimates.length > 0) { steps.estimate = true; changed = true; }
  // GHL connected (oauth or api key)
  if (!steps.ghl && (S.cfg.ghlOauthLocationId || S.cfg.ghlLocationId)) { steps.ghl = true; changed = true; }

  if (changed) {
    save(); // persist to Supabase
  }
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
  const plan = (S.cfg.plan||'starter').toLowerCase();
  const isPro = ['pro','agency','enterprise'].includes(plan);
  return ONBOARDING_STEPS
    .filter(s => !s.planGate || (s.planGate === 'pro' && isPro))
    .every(s => steps[s.id]);
}

// Dismiss the checklist permanently (marks all steps done)
function dismissOnboarding() {
  const steps = getOnboardingSteps();
  ONBOARDING_STEPS.forEach(s => { steps[s.id] = true; });
  S.cfg.onboardingSteps = steps;
  save();
  const el = document.getElementById('bd-onboarding-card');
  if (el) el.remove();
}

// Render the onboarding checklist card into the sidebar
function renderOnboardingChecklist() {
  // Remove existing card
  const existing = document.getElementById('bd-onboarding-card');
  if (existing) existing.remove();

  // Don't show if complete
  if (isOnboardingComplete()) return;

  const steps = autoDetectCompletedSteps();
  const plan = (S.cfg.plan||'starter').toLowerCase();
  const isPro = ['pro','agency','enterprise'].includes(plan);

  const applicableSteps = ONBOARDING_STEPS.filter(s => !s.planGate || (s.planGate === 'pro' && isPro));
  const completedCount = applicableSteps.filter(s => steps[s.id]).length;
  const totalCount = applicableSteps.length;
  const pct = Math.round((completedCount / totalCount) * 100);

  // Build step rows HTML
  const stepsHtml = applicableSteps.map(s => {
    const done = !!steps[s.id];
    return `
      <div class="bd-ob-step ${done ? 'done' : ''}" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <div class="bd-ob-check" onclick="markOnboardingStep('${s.id}')" title="Mark complete" style="width:18px;height:18px;border-radius:50%;border:2px solid ${done ? '#22c55e' : 'rgba(255,255,255,.25)'};background:${done ? '#22c55e' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:11px;color:#fff;">
          ${done ? '✓' : ''}
        </div>
        <span style="flex:1;font-size:12px;color:${done ? 'var(--muted)' : 'var(--text)'};text-decoration:${done ? 'line-through' : 'none'};line-height:1.3;">${s.icon} ${s.label}</span>
        ${!done ? `<button onclick="${s.action.toString().replace(/\(\)=>/,'').replace(/\(\)/,'')}" style="font-size:10px;background:rgba(249,115,22,.15);color:var(--accent);border:1px solid rgba(249,115,22,.3);border-radius:5px;padding:2px 7px;cursor:pointer;white-space:nowrap;flex-shrink:0;">${s.actionLabel}</button>` : ''}
      </div>`;
  }).join('');

  const card = document.createElement('div');
  card.id = 'bd-onboarding-card';
  card.style.cssText = 'margin:10px 10px 0;background:var(--card2);border:1px solid rgba(249,115,22,.3);border-radius:10px;padding:12px;flex-shrink:0;';
  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--accent);">🚀 Getting Started</div>
      <button onclick="dismissOnboarding()" title="Dismiss" style="background:none;border:none;color:var(--muted);font-size:16px;cursor:pointer;line-height:1;padding:0;">×</button>
    </div>
    <!-- Progress bar -->
    <div style="background:rgba(255,255,255,.08);border-radius:4px;height:5px;margin-bottom:10px;overflow:hidden;">
      <div style="background:var(--accent);height:100%;width:${pct}%;border-radius:4px;transition:width .3s ease;"></div>
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">${completedCount} of ${totalCount} steps complete</div>
    <div class="bd-ob-steps">${stepsHtml}</div>
  `;

  // Insert after the user strip (before the nav)
  const nav = document.querySelector('#bd-sidebar .bd-sb-nav');
  if (nav) {
    nav.parentNode.insertBefore(card, nav);
  }
}

// Called from auth.js after account loads — initialize the checklist
function initOnboarding() {
  // Only show to admins (not reps)
  if (!isAdminOrAbove()) return;
  // Slight delay to let S.pins / S.estimates load
  setTimeout(() => {
    renderOnboardingChecklist();
  }, 1200);
}
