// src/homeowner-quote.js
// Homeowner-facing quote page (/q/[slug]) — self-contained route that
// intercepts before app boot, renders the quote UI, handles send-postcard modal.
// Depends on: sb, adminAPI(), toast()
// Extracted from index.html — Tier 5 modularization


async function initQuotePage(slug) {
  // Inject quote page CSS
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --qbg: #080D14;
      --qpanel: #0F1623;
      --qcard: #141E2E;
      --qborder: #1E3050;
      --qaccent: #F25C05;
      --qsuccess: #22C55E;
      --qdanger: #EF4444;
      --qtext: #E8EFF8;
      --qmuted: #5A7A9A;
      --qmid: #8BA8C4;
      --qfont-h: 'Oswald', sans-serif;
      --qfont-b: 'Barlow', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--qbg); color: var(--qtext); font-family: var(--qfont-b); min-height: 100vh; overflow-x: hidden; }
    #q-root { min-height: 100vh; display: flex; flex-direction: column; }

    /* ── Hero ── */
    #q-hero {
      background: linear-gradient(160deg, #0A1220 0%, #0F1A2E 50%, #0A1220 100%);
      padding: 28px 20px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    #q-hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(242,92,5,.12) 0%, transparent 70%);
      pointer-events: none;
    }
    #q-logo { max-height: 64px; max-width: 220px; object-fit: contain; margin-bottom: 16px; filter: drop-shadow(0 2px 12px rgba(242,92,5,.3)); }
    #q-logo-text { font-family: var(--qfont-h); font-size: 22px; font-weight: 700; letter-spacing: 1px; color: var(--qtext); margin-bottom: 16px; }
    #q-headline {
      font-family: var(--qfont-h);
      font-size: clamp(26px, 6vw, 44px);
      font-weight: 700;
      letter-spacing: .5px;
      line-height: 1.1;
      background: linear-gradient(135deg, #fff 0%, #F25C05 60%, #FF8C42 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
    }
    #q-subhead { font-size: 15px; color: var(--qmid); max-width: 480px; margin: 0 auto 20px; line-height: 1.5; }
    #q-phone-link { display: inline-flex; align-items: center; gap: 6px; color: var(--qaccent); font-weight: 700; font-size: 15px; text-decoration: none; border: 1px solid rgba(242,92,5,.3); border-radius: 20px; padding: 6px 16px; transition: background .2s; }
    #q-phone-link:hover { background: rgba(242,92,5,.1); }

    /* ── Trust badges ── */
    #q-trust {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      padding: 16px 20px;
      background: rgba(255,255,255,.02);
      border-bottom: 1px solid var(--qborder);
    }
    .q-badge {
      display: flex; align-items: center; gap: 5px;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--qborder);
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 11px;
      font-weight: 600;
      color: var(--qmid);
      letter-spacing: .3px;
    }
    .q-badge .q-badge-icon { font-size: 13px; }

    /* ── Steps ── */
    #q-steps { flex: 1; padding: 24px 20px 40px; max-width: 600px; margin: 0 auto; width: 100%; }
    .q-step { display: none; }
    .q-step.active { display: block; animation: qFadeIn .35s ease; }
    @keyframes qFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

    .q-step-label {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
      color: var(--qaccent); margin-bottom: 12px;
    }
    .q-step-label .q-step-num {
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--qaccent); color: #fff;
      font-size: 10px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .q-step-title { font-family: var(--qfont-h); font-size: 22px; font-weight: 700; margin-bottom: 6px; letter-spacing: .3px; }
    .q-step-sub { font-size: 13px; color: var(--qmid); margin-bottom: 20px; line-height: 1.5; }

    /* ── Address input ── */
    #q-addr-wrap { position: relative; margin-bottom: 12px; }
    #q-addr-input {
      width: 100%;
      background: var(--qcard);
      border: 1.5px solid var(--qborder);
      border-radius: 12px;
      padding: 14px 48px 14px 16px;
      color: var(--qtext);
      font-family: var(--qfont-b);
      font-size: 15px;
      outline: none;
      transition: border-color .2s;
    }
    #q-addr-input:focus { border-color: var(--qaccent); }
    #q-addr-input::placeholder { color: var(--qmuted); }
    #q-addr-spinner {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      width: 20px; height: 20px; border: 2.5px solid var(--qborder);
      border-top-color: var(--qaccent); border-radius: 50%;
      display: none;
    }
    #q-addr-spinner.spin { display: block; animation: qSpin .7s linear infinite; }
    @keyframes qSpin { to { transform: translateY(-50%) rotate(360deg); } }

    /* ── Autocomplete dropdown ── */
    #q-addr-suggestions {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: var(--qcard); border: 1px solid var(--qborder); border-radius: 10px;
      overflow: hidden; z-index: 100; display: none;
      box-shadow: 0 8px 32px rgba(0,0,0,.5);
    }
    #q-addr-suggestions.open { display: block; }
    .q-sug-item {
      padding: 10px 14px; font-size: 13px; cursor: pointer;
      border-bottom: 1px solid var(--qborder); transition: background .15s;
    }
    .q-sug-item:last-child { border-bottom: none; }
    .q-sug-item:hover { background: rgba(242,92,5,.1); }

    /* ── Satellite preview ── */
    #q-sat-wrap {
      border-radius: 12px; overflow: hidden;
      border: 1.5px solid var(--qborder);
      margin-bottom: 16px;
      position: relative;
      background: var(--qcard);
      min-height: 200px;
      display: none;
    }
    #q-sat-wrap.visible { display: block; animation: qFadeIn .4s ease; }
    #q-sat-img { width: 100%; display: block; }
    #q-sat-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, transparent 50%, rgba(8,13,20,.8) 100%);
    }
    #q-sat-label {
      position: absolute; bottom: 10px; left: 12px; right: 12px;
      font-size: 11px; color: rgba(255,255,255,.6);
    }
    #q-sat-loading {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: var(--qcard);
    }
    #q-sat-loading .q-sat-spin {
      width: 32px; height: 32px; border: 3px solid var(--qborder);
      border-top-color: var(--qaccent); border-radius: 50%;
      animation: qSpin .7s linear infinite;
    }

    /* ── CTA button ── */
    .q-btn-primary {
      width: 100%;
      background: linear-gradient(135deg, #F25C05, #E04800);
      border: none; border-radius: 12px;
      padding: 16px 24px;
      color: #fff; font-family: var(--qfont-h);
      font-size: 17px; font-weight: 700; letter-spacing: .8px;
      cursor: pointer; transition: transform .15s, box-shadow .15s;
      box-shadow: 0 4px 20px rgba(242,92,5,.35);
      text-transform: uppercase;
    }
    .q-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(242,92,5,.45); }
    .q-btn-primary:active { transform: translateY(0); }
    .q-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
    .q-btn-secondary {
      width: 100%; background: transparent;
      border: 1.5px solid var(--qborder); border-radius: 12px;
      padding: 13px 24px; color: var(--qmid);
      font-family: var(--qfont-b); font-size: 14px;
      cursor: pointer; transition: border-color .15s, color .15s;
      margin-top: 10px;
    }
    .q-btn-secondary:hover { border-color: var(--qaccent); color: var(--qaccent); }

    /* ── Price reveal ── */
    #q-price-card {
      background: linear-gradient(135deg, var(--qcard) 0%, #1A2840 100%);
      border: 1.5px solid var(--qborder);
      border-radius: 16px; padding: 28px 24px; text-align: center;
      margin-bottom: 20px;
      position: relative; overflow: hidden;
    }
    #q-price-card::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(242,92,5,.08) 0%, transparent 70%);
      pointer-events: none;
    }
    #q-price-label { font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: var(--qmuted); margin-bottom: 8px; }
    #q-price-range {
      font-family: var(--qfont-h); font-size: clamp(32px, 8vw, 52px);
      font-weight: 700; letter-spacing: .5px;
      background: linear-gradient(135deg, #fff 0%, #F25C05 70%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 6px;
    }
    #q-price-sqft { font-size: 13px; color: var(--qmuted); margin-bottom: 16px; }
    #q-price-disclaimer { font-size: 11px; color: var(--qmuted); line-height: 1.5; }
    #q-sat-thumb {
      width: 100%; max-height: 160px; object-fit: cover;
      border-radius: 10px; margin-bottom: 14px; display: none;
    }
    #q-sat-thumb.visible { display: block; }

    /* ── Lead form ── */
    .q-field { margin-bottom: 14px; }
    .q-label { font-size: 11px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; color: var(--qmuted); margin-bottom: 6px; display: block; }
    .q-input {
      width: 100%;
      background: var(--qcard);
      border: 1.5px solid var(--qborder);
      border-radius: 10px;
      padding: 13px 14px;
      color: var(--qtext);
      font-family: var(--qfont-b);
      font-size: 15px;
      outline: none;
      transition: border-color .2s;
    }
    .q-input:focus { border-color: var(--qaccent); }
    .q-input::placeholder { color: var(--qmuted); }
    #q-submit-error { font-size: 12px; color: var(--qdanger); margin-bottom: 10px; display: none; }
    #q-submit-spinner {
      display: inline-block; width: 18px; height: 18px;
      border: 2.5px solid rgba(255,255,255,.3);
      border-top-color: #fff; border-radius: 50%;
      animation: qSpin .7s linear infinite; vertical-align: middle; margin-right: 6px;
      display: none;
    }

    /* ── Confirmation ── */
    #q-confirm-card {
      background: linear-gradient(135deg, #0D1F14 0%, #0F2318 100%);
      border: 1.5px solid rgba(34,197,94,.25);
      border-radius: 16px; padding: 32px 24px; text-align: center;
      margin-bottom: 20px;
    }
    #q-confirm-icon { font-size: 48px; margin-bottom: 16px; }
    #q-confirm-title { font-family: var(--qfont-h); font-size: 26px; font-weight: 700; color: var(--qsuccess); margin-bottom: 10px; }
    #q-confirm-sub { font-size: 14px; color: var(--qmid); line-height: 1.6; margin-bottom: 20px; }

    /* ── Footer ── */
    #q-footer {
      padding: 20px;
      text-align: center;
      font-size: 11px;
      color: var(--qmuted);
      border-top: 1px solid var(--qborder);
    }
    #q-footer a { color: var(--qmuted); text-decoration: none; }

    /* ── Progress dots ── */
    #q-progress {
      display: flex; justify-content: center; gap: 6px;
      padding: 16px 0 4px;
    }
    .q-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--qborder); transition: background .3s, transform .3s;
    }
    .q-dot.active { background: var(--qaccent); transform: scale(1.3); }
    .q-dot.done { background: var(--qsuccess); }

    /* ── Financing teaser ── */
    #q-financing {
      background: rgba(34,197,94,.06);
      border: 1px solid rgba(34,197,94,.2);
      border-radius: 10px; padding: 12px 16px;
      font-size: 12px; color: var(--qmid);
      margin-bottom: 16px; line-height: 1.5;
    }
    #q-financing strong { color: var(--qsuccess); }

    /* ── Differentiators ── */
    #q-diffs {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 8px; margin-bottom: 20px;
    }
    .q-diff {
      background: var(--qcard); border: 1px solid var(--qborder);
      border-radius: 10px; padding: 10px 12px;
      font-size: 12px; color: var(--qmid);
      display: flex; align-items: center; gap: 6px;
    }
    .q-diff::before { content: '✓'; color: var(--qsuccess); font-weight: 700; flex-shrink: 0; }

    /* ── Loading overlay ── */
    #q-loading {
      position: fixed; inset: 0; background: var(--qbg);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; flex-direction: column; gap: 16px;
    }
    #q-loading .q-load-spin {
      width: 40px; height: 40px; border: 3px solid var(--qborder);
      border-top-color: var(--qaccent); border-radius: 50%;
      animation: qSpin .7s linear infinite;
    }
    #q-loading .q-load-text { font-size: 13px; color: var(--qmuted); }

    /* ── Error screen ── */
    #q-error {
      display: none; flex-direction: column; align-items: center;
      justify-content: center; min-height: 100vh;
      padding: 40px 24px; text-align: center;
    }
    #q-error.visible { display: flex; }
    #q-error-icon { font-size: 48px; margin-bottom: 16px; }
    #q-error-title { font-family: var(--qfont-h); font-size: 24px; font-weight: 700; margin-bottom: 10px; }
    #q-error-sub { font-size: 14px; color: var(--qmid); }
  `;
  document.head.appendChild(style);

  // Hide the app body content
  document.body.innerHTML = `
    <div id="q-loading">
      <div class="q-load-spin"></div>
      <div class="q-load-text">Loading your estimate tool…</div>
    </div>
    <div id="q-error">
      <div id="q-error-icon">🔍</div>
      <div id="q-error-title">Page Not Found</div>
      <div id="q-error-sub">This quote link doesn't exist or has been deactivated.</div>
    </div>
    <div id="q-root" style="display:none;"></div>
  `;

  // Fetch account config
  let cfg;
  try {
    const r = await fetch('/api/quote?action=account&slug=' + encodeURIComponent(slug));
    if (!r.ok) throw new Error('not found');
    cfg = await r.json();
  } catch (e) {
    document.getElementById('q-loading').style.display = 'none';
    document.getElementById('q-error').classList.add('visible');
    return;
  }

  // Build the page
  const MB = ['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
  const brandColor = cfg.brandColor || '#F25C05';

  // Inject brand color override
  const brandStyle = document.createElement('style');
  brandStyle.textContent = `:root { --qaccent: ${brandColor}; }`;
  document.head.appendChild(brandStyle);

  // Build trust badges
  const badges = [
    cfg.yearsInBusiness ? `<div class="q-badge"><span class="q-badge-icon">🏆</span>${cfg.yearsInBusiness} Years in Business</div>` : '',
    cfg.warrantyYears   ? `<div class="q-badge"><span class="q-badge-icon">🛡</span>${cfg.warrantyYears}-Year Warranty</div>` : '',
    cfg.diff1 ? `<div class="q-badge"><span class="q-badge-icon">✓</span>${cfg.diff1}</div>` : '',
    cfg.diff2 ? `<div class="q-badge"><span class="q-badge-icon">✓</span>${cfg.diff2}</div>` : '',
    cfg.financingEnabled ? `<div class="q-badge"><span class="q-badge-icon">💳</span>Financing Available</div>` : '',
  ].filter(Boolean).join('');

  // Build differentiators grid
  const diffItems = [cfg.diff3, cfg.diff4, cfg.diff5, cfg.diff6].filter(Boolean)
    .map(d => `<div class="q-diff">${d}</div>`).join('');

  // Financing monthly estimate helper
  function monthlyPayment(total) {
    const apr = parseFloat(cfg.financingApr) || 9.99;
    const term = parseInt(cfg.financingTerm) || 60;
    const down = parseFloat(cfg.financingDown) || 0;
    const principal = total - down;
    const r = apr / 100 / 12;
    if (r === 0) return (principal / term).toFixed(0);
    return Math.round(principal * r * Math.pow(1+r, term) / (Math.pow(1+r, term) - 1));
  }

  // Pricing engine (mirrors calcStructPrice from the app)
  function calcQuotePrice(sqft, cfg) {
    if (!sqft) return 0;
    const pitchMult = 1.118; // default 6/12 pitch
    const complexity = 1.12;
    const stories = 1;
    const sq = sqft / 100 * 1.10 * pitchMult;
    const stMult = 1;
    const matCost = parseFloat(cfg.costArchitectural) || 300;
    const tearoff = (parseFloat(cfg.costTearoff) || 75) * sq;
    const felts = (parseFloat(cfg.costFelts) || 22) * sq;
    const dumpster = parseFloat(cfg.costDumpster) || 450;
    const labor = matCost * sq * stMult * complexity;
    const sub = labor + tearoff + felts + dumpster;
    const ovh = sub * (parseFloat(cfg.overhead) || 15) / 100;
    const mgn = (sub + ovh) * (parseFloat(cfg.margin) || 20) / 100;
    return Math.round(sub + ovh + mgn);
  }

  // Render the page
  const root = document.getElementById('q-root');
  root.innerHTML = `
    <div id="q-hero">
      ${cfg.logoData ? `<img id="q-logo" src="${cfg.logoData}" alt="${cfg.companyName}">` : `<div id="q-logo-text">${cfg.companyName}</div>`}
      <div id="q-headline">Get Your Free<br>Roof Estimate</div>
      <div id="q-subhead">Find out what your roof replacement costs in under 60 seconds — no sales pitch, no pressure.</div>
      ${cfg.companyPhone ? `<a id="q-phone-link" href="tel:${cfg.companyPhone}">📞 ${cfg.companyPhone}</a>` : ''}
    </div>

    ${badges ? `<div id="q-trust">${badges}</div>` : ''}

    <div id="q-progress">
      <div class="q-dot active" id="qdot-1"></div>
      <div class="q-dot" id="qdot-2"></div>
      <div class="q-dot" id="qdot-3"></div>
      <div class="q-dot" id="qdot-4"></div>
    </div>

    <div id="q-steps">

      <!-- STEP 1: Address -->
      <div class="q-step active" id="qstep-1">
        <div class="q-step-label"><div class="q-step-num">1</div>Your Property</div>
        <div class="q-step-title">What's your address?</div>
        <div class="q-step-sub">We'll pull up a satellite view of your roof to calculate the square footage.</div>
        <div id="q-addr-wrap">
          <input id="q-addr-input" type="text" placeholder="123 Main St, City, State" autocomplete="off" autocorrect="off" spellcheck="false">
          <div id="q-addr-spinner"></div>
          <div id="q-addr-suggestions"></div>
        </div>
        <div id="q-sat-wrap">
          <div id="q-sat-loading"><div class="q-sat-spin"></div></div>
          <img id="q-sat-img" src="" alt="Satellite view" onload="document.getElementById('q-sat-loading').style.display='none'">
          <div id="q-sat-overlay"></div>
          <div id="q-sat-label">📍 Satellite view — your roof measurement area</div>
        </div>
        <button class="q-btn-primary" id="q-step1-btn" onclick="qStep1Next()" disabled>Calculate My Estimate →</button>
        <div style="font-size:11px;color:var(--qmuted);text-align:center;margin-top:10px;">We use satellite imagery to estimate your roof size. No in-person visit required.</div>
      </div>

      <!-- STEP 2: Price reveal -->
      <div class="q-step" id="qstep-2">
        <div class="q-step-label"><div class="q-step-num">2</div>Your Estimate</div>
        <div class="q-step-title">Here's your price range</div>
        <div class="q-step-sub">Based on your roof size and current material costs in your area.</div>
        <img id="q-sat-thumb" src="" alt="Your roof">
        <div id="q-price-card">
          <div id="q-price-label">Estimated Replacement Cost</div>
          <div id="q-price-range">—</div>
          <div id="q-price-sqft">Estimated roof area: <strong id="q-sqft-display">—</strong> sq ft</div>
          <div id="q-price-disclaimer">This is a preliminary estimate based on satellite measurements. Final pricing may vary based on pitch, complexity, and material selection. A free on-site assessment will confirm exact pricing.</div>
        </div>
        ${cfg.financingEnabled ? `<div id="q-financing">💳 <strong>As low as $<span id="q-monthly">—</span>/mo</strong> with ${cfg.financingApr}% APR financing over ${cfg.financingTerm} months. Ask about our financing options.</div>` : ''}
        ${diffItems ? `<div id="q-diffs">${diffItems}</div>` : ''}
        <button class="q-btn-primary" onclick="qStep2Next()">Get My Full Estimate →</button>
        <button class="q-btn-secondary" onclick="qGoStep(1)">← Change Address</button>
      </div>

      <!-- STEP 3: Lead capture -->
      <div class="q-step" id="qstep-3">
        <div class="q-step-label"><div class="q-step-num">3</div>Your Contact Info</div>
        <div class="q-step-title">Where should we send it?</div>
        <div class="q-step-sub">A roofing specialist will reach out to confirm your estimate and schedule a free assessment.</div>
        <div class="q-field">
          <label class="q-label">Your Name *</label>
          <input class="q-input" id="q-lead-name" type="text" placeholder="John Smith" autocomplete="name">
        </div>
        <div class="q-field">
          <label class="q-label">Phone Number *</label>
          <input class="q-input" id="q-lead-phone" type="tel" placeholder="(313) 555-0100" autocomplete="tel" oninput="qFormatPhone(this)">
        </div>
        <div class="q-field">
          <label class="q-label">Email Address</label>
          <input class="q-input" id="q-lead-email" type="email" placeholder="john@email.com" autocomplete="email">
        </div>
        <div id="q-submit-error"></div>
        <button class="q-btn-primary" id="q-submit-btn" onclick="qSubmitLead()">
          <span id="q-submit-spinner"></span>
          Get My Full Estimate — It's Free
        </button>
        <div style="font-size:11px;color:var(--qmuted);text-align:center;margin-top:10px;">🔒 Your info is private. No spam, ever. We'll only contact you about your estimate.</div>
        <button class="q-btn-secondary" onclick="qGoStep(2)">← Back to Estimate</button>
      </div>

      <!-- STEP 4: Confirmation -->
      <div class="q-step" id="qstep-4">
        <div id="q-confirm-card">
          <div id="q-confirm-icon">🎉</div>
          <div id="q-confirm-title">You're All Set!</div>
          <div id="q-confirm-sub">We've received your request and a roofing specialist from <strong>${cfg.companyName}</strong> will be in touch shortly to confirm your estimate and schedule a free assessment.<br><br>Estimated response time: <strong>within 24 hours</strong></div>
          ${cfg.bookingUrl ? `<a href="${cfg.bookingUrl}" target="_blank" class="q-btn-primary" style="display:block;text-decoration:none;text-align:center;">📅 Schedule My Assessment Now</a>` : ''}
        </div>
        <div style="background:var(--qcard);border:1px solid var(--qborder);border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:12px;color:var(--qmuted);margin-bottom:8px;">Questions? Call or text us directly:</div>
          ${cfg.companyPhone ? `<a href="tel:${cfg.companyPhone}" style="font-family:var(--qfont-h);font-size:20px;font-weight:700;color:var(--qaccent);text-decoration:none;">${cfg.companyPhone}</a>` : `<div style="font-size:14px;color:var(--qmid);">${cfg.companyName}</div>`}
        </div>
      </div>

    </div>

    <div id="q-footer">
      Powered by <strong>BidDrop</strong> · <a href="https://biddrop.io" target="_blank">biddrop.io</a>
    </div>
  `;

  // Hide loading, show root
  document.getElementById('q-loading').style.display = 'none';
  root.style.display = 'flex';

  // ── State ──────────────────────────────────────────────────────────────────
  let qCurrentStep = 1;
  let qSelectedAddress = null;
  let qLat = null, qLon = null;
  let qSqft = 0;
  let qTotal = 0;
  let qSatUrl = null;
  let qSugTimeout = null;

  // ── Step navigation ────────────────────────────────────────────────────────
  window.qGoStep = function(n) {
    document.getElementById('qstep-' + qCurrentStep).classList.remove('active');
    document.getElementById('qdot-' + qCurrentStep).classList.remove('active');
    document.getElementById('qdot-' + qCurrentStep).classList.add('done');
    qCurrentStep = n;
    document.getElementById('qstep-' + n).classList.add('active');
    document.getElementById('qdot-' + n).classList.add('active');
    // Scroll to top of steps
    const stepsEl = document.getElementById('q-steps');
    if (stepsEl) stepsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Address autocomplete ───────────────────────────────────────────────────
  const addrInput = document.getElementById('q-addr-input');
  const sugBox = document.getElementById('q-addr-suggestions');
  const spinner = document.getElementById('q-addr-spinner');
  const step1Btn = document.getElementById('q-step1-btn');

  addrInput.addEventListener('input', function() {
    clearTimeout(qSugTimeout);
    const q = this.value.trim();
    if (q.length < 3) { sugBox.classList.remove('open'); return; }
    qSugTimeout = setTimeout(() => qFetchSuggestions(q), 300);
  });

  addrInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      sugBox.classList.remove('open');
      const first = sugBox.querySelector('.q-sug-item');
      if (first) first.click();
    }
  });

  document.addEventListener('click', function(e) {
    if (!addrInput.contains(e.target) && !sugBox.contains(e.target)) {
      sugBox.classList.remove('open');
    }
  });

  async function qFetchSuggestions(q) {
    spinner.classList.add('spin');
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=us&types=address&limit=5&access_token=${MB}`;
      const r = await fetch(url);
      const data = await r.json();
      const features = data.features || [];
      sugBox.innerHTML = features.map(f =>
        `<div class="q-sug-item" data-lat="${f.center[1]}" data-lon="${f.center[0]}" data-addr="${f.place_name}">${f.place_name}</div>`
      ).join('');
      if (features.length) {
        sugBox.classList.add('open');
        sugBox.querySelectorAll('.q-sug-item').forEach(el => {
          el.addEventListener('click', function() {
            qSelectAddress(this.dataset.addr, parseFloat(this.dataset.lat), parseFloat(this.dataset.lon));
          });
        });
      } else {
        sugBox.classList.remove('open');
      }
    } catch (e) {}
    spinner.classList.remove('spin');
  }

  function qSelectAddress(addr, lat, lon) {
    qSelectedAddress = addr;
    qLat = lat;
    qLon = lon;
    addrInput.value = addr;
    sugBox.classList.remove('open');
    step1Btn.disabled = false;
    // Show satellite image
    qSatUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lon},${lat},19,0/900x500@2x?access_token=${MB}`;
    const satWrap = document.getElementById('q-sat-wrap');
    const satImg = document.getElementById('q-sat-img');
    const satLoading = document.getElementById('q-sat-loading');
    satLoading.style.display = 'flex';
    satImg.src = qSatUrl;
    satWrap.classList.add('visible');
    // Estimate sqft from satellite (rough: 2000 sqft average for residential)
    // We use a simple heuristic based on zoom level 19 pixel analysis
    // Default to 2000 sqft as a reasonable starting estimate
    qSqft = 2000;
  }

  // ── Step 1 → 2 ────────────────────────────────────────────────────────────
  window.qStep1Next = function() {
    if (!qSelectedAddress) return;
    // Calculate price
    qTotal = calcQuotePrice(qSqft, cfg);
    const low = Math.round(qTotal * 0.85 / 100) * 100;
    const high = Math.round(qTotal * 1.15 / 100) * 100;
    document.getElementById('q-price-range').textContent = `$${low.toLocaleString()} – $${high.toLocaleString()}`;
    document.getElementById('q-sqft-display').textContent = qSqft.toLocaleString();
    if (cfg.financingEnabled) {
      const mo = monthlyPayment(qTotal);
      const moEl = document.getElementById('q-monthly');
      if (moEl) moEl.textContent = mo.toLocaleString();
    }
    // Show sat thumb in step 2
    if (qSatUrl) {
      const thumb = document.getElementById('q-sat-thumb');
      thumb.src = qSatUrl;
      thumb.classList.add('visible');
    }
    qGoStep(2);
  };

  // ── Step 2 → 3 ────────────────────────────────────────────────────────────
  window.qStep2Next = function() {
    qGoStep(3);
  };

  // ── Phone formatter ────────────────────────────────────────────────────────
  window.qFormatPhone = function(el) {
    let v = el.value.replace(/\D/g,'');
    if(v.length>10) v=v.slice(0,10);
    if(v.length>=7) el.value='('+v.slice(0,3)+') '+v.slice(3,6)+'-'+v.slice(6);
    else if(v.length>=4) el.value='('+v.slice(0,3)+') '+v.slice(3);
    else if(v.length>0) el.value='('+v;
  };

  // ── Submit lead ────────────────────────────────────────────────────────────
  window.qSubmitLead = async function() {
    const name  = document.getElementById('q-lead-name').value.trim();
    const phone = document.getElementById('q-lead-phone').value.trim();
    const email = document.getElementById('q-lead-email').value.trim();
    const errEl = document.getElementById('q-submit-error');
    const btn   = document.getElementById('q-submit-btn');
    const spinEl = document.getElementById('q-submit-spinner');

    errEl.style.display = 'none';
    if (!name) { errEl.textContent = 'Please enter your name.'; errEl.style.display = 'block'; return; }
    if (!phone || phone.replace(/\D/g,'').length < 10) { errEl.textContent = 'Please enter a valid 10-digit phone number.'; errEl.style.display = 'block'; return; }

    btn.disabled = true;
    spinEl.style.display = 'inline-block';

    try {
      const payload = {
        action: 'submit_lead',
        slug,
        name,
        phone,
        email: email || null,
        address: qSelectedAddress,
        sqft: qSqft,
        total: qTotal,
        lat: qLat,
        lon: qLon,
        mat: '1.3',
      };
      const r = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Submission failed');
      qGoStep(4);
    } catch (e) {
      errEl.textContent = 'Something went wrong. Please try again or call us directly.';
      errEl.style.display = 'block';
      btn.disabled = false;
       spinEl.style.display = 'none';
    }
  };
}

// ── SEND POSTCARD CHOICE MODAL ───────────────────────────────────────────────
let _spmQueueId = null;
let _spmChoice  = null;

function openSendPostcardModal(queueId){
  _spmQueueId = queueId;
  _spmChoice  = null;
  const item = (S.queue||[]).find(x=>x.id===queueId);
  const lbl = document.getElementById('spm-homeowner');
  if(lbl && item) lbl.textContent = item.owner + ' — ' + item.addr;
  // Reset selection
  ['single','blitz'].forEach(k=>{
    const el = document.getElementById('spm-opt-'+k);
    if(el){ el.style.borderColor='var(--border)'; el.style.background=''; }
  });
  const btn = document.getElementById('spm-confirm-btn');
  if(btn){ btn.textContent='Select an option above'; btn.style.opacity='.4'; btn.style.pointerEvents='none'; }
  openM('m-send-postcard');
}

function spmSelect(choice){
  _spmChoice = choice;
  ['single','blitz'].forEach(k=>{
    const el = document.getElementById('spm-opt-'+k);
    if(!el) return;
    if(k===choice){
      el.style.borderColor = choice==='blitz' ? '#a855f7' : 'var(--accent)';
      el.style.background  = choice==='blitz' ? 'rgba(168,85,247,.08)' : 'rgba(249,115,22,.08)';
    } else {
      el.style.borderColor='var(--border)'; el.style.background='';
    }
  });
  const btn = document.getElementById('spm-confirm-btn');
  if(btn){
    if(choice==='single'){
      btn.textContent='🏠 Send 1 Postcard — 1 Credit';
      btn.style.background='var(--accent)';
    } else {
      btn.textContent='🔥 Start Follow-Up Blitz — 3 Credits (6 Postcards)';
      btn.style.background='#7C3AED';
    }
    btn.style.opacity='1'; btn.style.pointerEvents='auto';
  }
}

function spmConfirm(){
  if(!_spmChoice || !_spmQueueId) return;
  closeM('m-send-postcard');
  if(_spmChoice==='single'){
    sendLobPostcard6x9(_spmQueueId);
  } else {
    openBlitzFromQueue(_spmQueueId);
  }
}


