// src/insurance-mode.js
// Level 1 Xactimate-Style Insurance Scope — estimate mode toggle, line-item engine,
// RCV / ACV / O&P / Depreciation calculations, and insurance PDF generation.
// Depends on: S.cfg (state.js), structures (global), calcStructPrice(), calcP(),
//             buildProposalHTML() (proposal.js), escHtml() (ui.js)

// ─── State ───────────────────────────────────────────────────────────────────
let _estMode = 'sales'; // 'sales' | 'insurance'

// ─── Xactimate component rates ($/unit) — editable via Settings in future ────
const XAC_RATES = {
  underlayment:   22,   // $/SQ — synthetic underlayment
  iceWater:       42,   // $/SQ — ice & water shield (eaves + valleys; ~15% of total SQ)
  starterStrip:  1.85,  // $/LF
  hipRidge:       3.20, // $/LF
  dripEdge:       1.45, // $/LF
  ridgeVent:      8.50, // $/LF
  pipeJack:       48,   // $/EA
  stepFlashing:   14,   // $/EA (per linear foot of step flashing)
  debrisHaulOff: 350,   // $/load
  permit:        285,   // $/EA
};

// Steep slope surcharge thresholds (pitch multiplier → surcharge % of subtotal)
const STEEP_SURCHARGE = [
  { minPitch: 1.302, label: '10/12', pct: 0.08 }, // 10/12+
  { minPitch: 1.250, label: '9/12',  pct: 0.05 }, // 9/12
  { minPitch: 1.202, label: '8/12',  pct: 0.03 }, // 8/12
  { minPitch: 1.158, label: '7/12',  pct: 0.02 }, // 7/12
];

// High roof (stories) surcharge
const STORIES_SURCHARGE = [
  { minStories: 2.5, label: '3+ stories', pct: 0.08 },
  { minStories: 2,   label: '2 stories',  pct: 0.04 },
  { minStories: 1.5, label: '1.5 stories',pct: 0.02 },
];

// ─── Mode Toggle ─────────────────────────────────────────────────────────────
function setEstMode(mode) {
  _estMode = mode;
  const salesBtn = document.getElementById('est-mode-sales');
  const insBtn   = document.getElementById('est-mode-ins');
  const insSection = document.getElementById('ins-claim-section');
  const propBtn  = document.getElementById('open-proposal-btn');

  if (mode === 'insurance') {
    if (salesBtn) { salesBtn.style.background = 'none'; salesBtn.style.color = 'var(--muted)'; }
    if (insBtn)   { insBtn.style.background = 'rgba(59,130,246,.2)'; insBtn.style.color = '#60A5FA'; insBtn.style.border = '1px solid rgba(59,130,246,.4)'; }
    if (insSection) insSection.style.display = 'block';
    // Change proposal button label
    if (propBtn) propBtn.innerHTML = '🏛 Insurance Scope PDF';
    calcInsuranceTotals();
  } else {
    if (salesBtn) { salesBtn.style.background = 'var(--accent)'; salesBtn.style.color = '#fff'; salesBtn.style.border = 'none'; }
    if (insBtn)   { insBtn.style.background = 'none'; insBtn.style.color = 'var(--muted)'; insBtn.style.border = 'none'; }
    if (insSection) insSection.style.display = 'none';
    if (propBtn) propBtn.innerHTML = '📄 Proposal';
  }
}

// ─── Auto-calculate depreciation from roof age ───────────────────────────────
function autoCalcDepreciation() {
  const ageEl  = document.getElementById('ins-roof-age');
  const deprEl = document.getElementById('ins-depr-pct');
  if (!ageEl || !deprEl) return;
  const age = parseFloat(ageEl.value) || 0;
  if (age <= 0) { deprEl.value = '0'; calcInsuranceTotals(); return; }
  // Standard depreciation: 1.5% per year, capped at 70%
  const pct = Math.min(Math.round(age * 1.5), 70);
  deprEl.value = String(pct);
  calcInsuranceTotals();
}

// ─── Build Xactimate line items from current structures ──────────────────────
function buildXacLineItems() {
  if (!structures || !structures.length) return [];
  const items = [];

  structures.forEach((s, idx) => {
    const sqft = parseFloat(s.sqft) || 0;
    if (!sqft) return;
    const pitchMult = parseFloat(s.pitch) || 1.118;
    const sq = Math.round((sqft / 100) * 1.10 * pitchMult * 10) / 10; // actual roof squares w/ 10% waste
    const stories = parseFloat(s.stories) || 1;
    const matKey = s.mat || '1.3';
    const matLabel = (typeof MATLBL !== 'undefined' ? MATLBL[matKey] : null) || 'Architectural Shingle';
    const name = s.name || ('Structure ' + (idx + 1));

    // Estimate perimeter and hip/ridge from sq (rough approximation)
    const footprintSqft = sqft;
    const side = Math.sqrt(footprintSqft); // approximate side length
    const perimeterLF = Math.round(side * 4);
    const hipRidgeLF  = Math.round(side * 1.2);
    const dripEdgeLF  = Math.round(perimeterLF * 1.05);
    const ridgeVentLF = Math.round(side * 0.6);
    const iceWaterSQ  = Math.round(sq * 0.15 * 10) / 10; // ~15% of total SQ for eaves+valleys
    const pipeJacks   = Math.max(1, Math.round(sq / 10)); // ~1 per 10 SQ
    const stepFlashLF = Math.round(side * 0.8);

    // Xactimate code, description, unit, qty, unit price
    items.push({ code:'RFG-SHNG-R&R', cat:'RFG', desc:`R&R ${matLabel} — ${name}`, unit:'SQ', qty:sq, unitPrice: Math.round(calcStructPrice(s) / sq) || 312, lineTotal: calcStructPrice(s) });
    items.push({ code:'RFG-UNDR-SYN', cat:'RFG', desc:'R&R Synthetic underlayment', unit:'SQ', qty:sq, unitPrice: XAC_RATES.underlayment, lineTotal: Math.round(XAC_RATES.underlayment * sq) });
    items.push({ code:'RFG-ICW-SHLD', cat:'RFG', desc:'R&R Ice & water shield (eaves + valleys)', unit:'SQ', qty:iceWaterSQ, unitPrice: XAC_RATES.iceWater, lineTotal: Math.round(XAC_RATES.iceWater * iceWaterSQ) });
    items.push({ code:'RFG-STRT-SHP', cat:'RFG', desc:'R&R Starter strip shingles', unit:'LF', qty:perimeterLF, unitPrice: XAC_RATES.starterStrip, lineTotal: Math.round(XAC_RATES.starterStrip * perimeterLF) });
    items.push({ code:'RFG-RDGE-CAP', cat:'RFG', desc:'R&R Hip & ridge cap shingles', unit:'LF', qty:hipRidgeLF, unitPrice: XAC_RATES.hipRidge, lineTotal: Math.round(XAC_RATES.hipRidge * hipRidgeLF) });
    items.push({ code:'RFG-DRPE-ALU', cat:'RFG', desc:'R&R Drip edge — aluminum (eaves + rakes)', unit:'LF', qty:dripEdgeLF, unitPrice: XAC_RATES.dripEdge, lineTotal: Math.round(XAC_RATES.dripEdge * dripEdgeLF) });
    items.push({ code:'RFG-VENT-RDG', cat:'RFG', desc:'R&R Ridge vent', unit:'LF', qty:ridgeVentLF, unitPrice: XAC_RATES.ridgeVent, lineTotal: Math.round(XAC_RATES.ridgeVent * ridgeVentLF) });
    items.push({ code:'RFG-PPJK-RBR', cat:'RFG', desc:`R&R Pipe jack flashing (${pipeJacks} unit${pipeJacks>1?'s':''})`, unit:'EA', qty:pipeJacks, unitPrice: XAC_RATES.pipeJack, lineTotal: Math.round(XAC_RATES.pipeJack * pipeJacks) });
    items.push({ code:'RFG-STPF-ALU', cat:'RFG', desc:'R&R Step flashing', unit:'LF', qty:stepFlashLF, unitPrice: XAC_RATES.stepFlashing, lineTotal: Math.round(XAC_RATES.stepFlashing * stepFlashLF) });
  });

  // Shared items (once per job)
  items.push({ code:'GNL-HAUL-DEB', cat:'GNL', desc:'Roof debris haul-off', unit:'Load', qty:1, unitPrice: XAC_RATES.debrisHaulOff, lineTotal: XAC_RATES.debrisHaulOff });
  items.push({ code:'GNL-PRMT-COD', cat:'GNL', desc:'Permit & code upgrade', unit:'EA', qty:1, unitPrice: XAC_RATES.permit, lineTotal: XAC_RATES.permit });

  return items;
}

// ─── Calculate insurance totals and update DOM ────────────────────────────────
function calcInsuranceTotals() {
  if (_estMode !== 'insurance') return;
  if (!structures || !structures.length) return;

  const items = buildXacLineItems();
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

  // Steep slope surcharge (based on highest pitch among structures)
  const maxPitch = structures.reduce((mx, s) => Math.max(mx, parseFloat(s.pitch) || 1.118), 0);
  let steepPct = 0, steepLabel = '';
  for (const t of STEEP_SURCHARGE) {
    if (maxPitch >= t.minPitch) { steepPct = t.pct; steepLabel = t.label + ' pitch'; break; }
  }
  const steepAmt = Math.round(subtotal * steepPct);

  // High roof surcharge (based on highest stories)
  const maxStories = structures.reduce((mx, s) => Math.max(mx, parseFloat(s.stories) || 1), 0);
  let storiesPct = 0, storiesLabel = '';
  for (const t of STORIES_SURCHARGE) {
    if (maxStories >= t.minStories) { storiesPct = t.pct; storiesLabel = t.label; break; }
  }
  const storiesAmt = Math.round(subtotal * storiesPct);

  // O&P
  const opToggle = document.getElementById('ins-op-toggle');
  const opPct    = opToggle && opToggle.checked ? (parseFloat((document.getElementById('ins-op-pct') || {}).value) || 20) : 0;
  const opBase   = subtotal + steepAmt + storiesAmt;
  const opAmt    = Math.round(opBase * opPct / 100);

  // Tax
  const taxPct = parseFloat(S.cfg.taxRate) || 0;
  const taxAmt = Math.round((opBase + opAmt) * taxPct / 100);

  // RCV
  const rcv = opBase + opAmt + taxAmt;

  // Depreciation
  const deprPct = parseFloat((document.getElementById('ins-depr-pct') || {}).value) || 0;
  const deprAmt = Math.round(rcv * deprPct / 100);

  // ACV
  const acv = rcv - deprAmt;

  // Deductible
  const ded = parseFloat((document.getElementById('ins-deductible') || {}).value) || 0;

  // Payout
  const payout = Math.max(0, acv - ded);

  // ── Update DOM ──
  const $ = id => document.getElementById(id);
  const fmt = n => '$' + Math.round(n).toLocaleString();

  if ($('ins-t-subtotal'))  $('ins-t-subtotal').textContent  = fmt(subtotal);

  const steepRow = $('ins-steep-row');
  if (steepRow) { steepRow.style.display = steepAmt > 0 ? 'flex' : 'none'; }
  if ($('ins-steep-lbl'))   $('ins-steep-lbl').textContent   = `Steep slope surcharge (${steepLabel})`;
  if ($('ins-t-steep'))     $('ins-t-steep').textContent     = fmt(steepAmt);

  const storiesRow = $('ins-stories-row');
  if (storiesRow) { storiesRow.style.display = storiesAmt > 0 ? 'flex' : 'none'; }
  if ($('ins-stories-lbl')) $('ins-stories-lbl').textContent = `High roof surcharge (${storiesLabel})`;
  if ($('ins-t-stories'))   $('ins-t-stories').textContent   = fmt(storiesAmt);

  const opRow = $('ins-op-row');
  if (opRow) { opRow.style.display = opPct > 0 ? 'flex' : 'none'; }
  if ($('ins-op-lbl'))      $('ins-op-lbl').textContent      = `O&P (${opPct}%)`;
  if ($('ins-t-op'))        $('ins-t-op').textContent        = fmt(opAmt);

  if ($('ins-tax-pct-lbl')) $('ins-tax-pct-lbl').textContent = String(taxPct);
  if ($('ins-t-tax'))       $('ins-t-tax').textContent       = fmt(taxAmt);

  if ($('ins-t-rcv'))       $('ins-t-rcv').textContent       = fmt(rcv);

  if ($('ins-depr-pct-lbl'))$('ins-depr-pct-lbl').textContent= String(deprPct);
  if ($('ins-t-depr'))      $('ins-t-depr').textContent      = '−' + fmt(deprAmt);

  if ($('ins-t-acv'))       $('ins-t-acv').textContent       = fmt(acv);
  if ($('ins-t-ded'))       $('ins-t-ded').textContent       = '−' + fmt(ded);
  if ($('ins-t-payout'))    $('ins-t-payout').textContent    = fmt(payout);

  return { subtotal, steepAmt, storiesAmt, opAmt, taxAmt, rcv, deprAmt, acv, ded, payout, items, opPct, taxPct, deprPct, steepLabel, storiesLabel };
}

// ─── Build Insurance Scope PDF HTML ──────────────────────────────────────────
function buildInsuranceScopeHTML(forPrint) {
  const cfg     = S.cfg;
  const owner   = (document.getElementById('e-owner')   || {}).value || 'Homeowner';
  const addr    = (document.getElementById('e-addr')    || {}).value || 'Property Address';
  const co      = cfg.companyName  || 'Your Roofing Co';
  const coAddr  = cfg.companyAddr  || '';
  const coPh    = cfg.companyPhone || '';
  const coEmail = cfg.companyEmail || '';
  const lic     = cfg.licenseNum   || '';
  const color   = cfg.brandColor   || '#F25C05';
  const logoHtml = cfg.logoData
    ? `<img src="${cfg.logoData}" style="max-height:60px;max-width:180px;object-fit:contain;display:block;">`
    : `<div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;color:${color};letter-spacing:1px;">${escHtml(co)}</div>`;

  const claimNum   = (document.getElementById('ins-claim-num')   || {}).value || '';
  const carrier    = (document.getElementById('ins-carrier')      || {}).value || '';
  const dol        = (document.getElementById('ins-dol')          || {}).value || '';
  const policy     = (document.getElementById('ins-policy')       || {}).value || '';
  const adjuster   = (document.getElementById('ins-adjuster')     || {}).value || '';
  const adjPhone   = (document.getElementById('ins-adj-phone')    || {}).value || '';
  const priceList  = (document.getElementById('ins-price-list')   || {}).value || '';

  const totals = calcInsuranceTotals() || {};
  const { subtotal=0, steepAmt=0, storiesAmt=0, opAmt=0, taxAmt=0, rcv=0, deprAmt=0, acv=0, ded=0, payout=0, items=[], opPct=20, taxPct=0, deprPct=0, steepLabel='', storiesLabel='' } = totals;

  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }).toUpperCase();
  const estNum = 'BD-' + Date.now().toString(36).toUpperCase().slice(-6);
  const fmt = n => '$' + Math.round(n).toLocaleString();

  // Line items table rows
  const lineItemsHtml = items.map((li, idx) => {
    const bg = idx % 2 === 0 ? '#fff' : '#f9fafb';
    return `<tr style="background:${bg};">
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;color:#374151;">${escHtml(li.desc)}<br><span style="font-size:9px;color:#9ca3af;">${escHtml(li.code)}</span></td>
      <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:10px;color:#6b7280;font-weight:700;">${escHtml(li.cat)}</td>
      <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:11px;color:#6b7280;">${escHtml(li.unit)}</td>
      <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:11px;color:#374151;">${li.qty}</td>
      <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:11px;color:#374151;">$${li.unitPrice.toLocaleString()}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;font-size:11px;color:#111827;">${fmt(li.lineTotal)}</td>
    </tr>`;
  }).join('');

  // Pitch/stories info
  const maxPitch = structures.reduce((mx, s) => Math.max(mx, parseFloat(s.pitch) || 1.118), 0);
  const maxStories = structures.reduce((mx, s) => Math.max(mx, parseFloat(s.stories) || 1), 0);
  const pitchLabel = (typeof PITCHLBL !== 'undefined' ? PITCHLBL[String(maxPitch)] : null) || (maxPitch + 'x');
  const totalSQ = structures.reduce((sum, s) => {
    const sqft = parseFloat(s.sqft) || 0;
    const pm = parseFloat(s.pitch) || 1.118;
    return sum + Math.round((sqft / 100) * 1.10 * pm * 10) / 10;
  }, 0);
  const totalSqft = structures.reduce((sum, s) => sum + (parseFloat(s.sqft) || 0), 0);
  const storiesLbl = maxStories >= 2.5 ? '3+ stories' : maxStories >= 2 ? '2 stories' : maxStories >= 1.5 ? '1.5 stories' : '1 story';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Insurance Scope — ${escHtml(addr)}</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Barlow',sans-serif;color:#111827;background:#fff;font-size:12px;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{margin:0.5in;size:letter;}}
  .ins-badge{display:inline-block;background:#1e40af;color:#fff;font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;border-radius:4px;padding:2px 8px;}
</style>
</head>
<body>
<div style="max-width:820px;margin:0 auto;">

  <!-- ══ HEADER ══ -->
  <div style="padding:28px 36px 20px;border-bottom:3px solid ${color};">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        ${logoHtml}
        ${lic ? `<div style="font-size:10px;color:#6b7280;margin-top:3px;">License #${escHtml(lic)}</div>` : ''}
        ${coPh ? `<div style="font-size:10px;color:#6b7280;">${escHtml(coPh)}</div>` : ''}
        ${coEmail ? `<div style="font-size:10px;color:#6b7280;">${escHtml(coEmail)}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <span class="ins-badge">Insurance Scope</span>
        <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;color:#111827;margin-top:6px;">SCOPE OF LOSS</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px;">Estimate #${estNum} &nbsp;·&nbsp; ${today}</div>
      </div>
    </div>
  </div>

  <!-- ══ CLAIM INFO ══ -->
  <div style="padding:16px 36px;background:#f8fafc;border-bottom:1px solid #e5e7eb;">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
      ${claimNum ? `<div><div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;margin-bottom:2px;">Claim #</div><div style="font-size:12px;font-weight:700;color:#111827;">${escHtml(claimNum)}</div></div>` : ''}
      ${carrier   ? `<div><div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;margin-bottom:2px;">Carrier</div><div style="font-size:12px;font-weight:700;color:#111827;">${escHtml(carrier)}</div></div>` : ''}
      ${dol       ? `<div><div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;margin-bottom:2px;">Date of Loss</div><div style="font-size:12px;font-weight:700;color:#111827;">${new Date(dol).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div></div>` : ''}
      ${policy    ? `<div><div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;margin-bottom:2px;">Policy #</div><div style="font-size:12px;color:#374151;">${escHtml(policy)}</div></div>` : ''}
      ${adjuster  ? `<div><div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;margin-bottom:2px;">Adjuster</div><div style="font-size:12px;color:#374151;">${escHtml(adjuster)}${adjPhone ? ' · ' + escHtml(adjPhone) : ''}</div></div>` : ''}
      ${priceList ? `<div><div style="font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#6b7280;margin-bottom:2px;">Price List</div><div style="font-size:12px;font-weight:700;color:#1e40af;">${escHtml(priceList)}</div></div>` : ''}
    </div>
  </div>

  <!-- ══ PROPERTY ══ -->
  <div style="padding:16px 36px;border-bottom:1px solid #e5e7eb;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:16px;font-weight:700;color:#111827;">${escHtml(owner)}</div>
        <div style="font-size:12px;color:#374151;margin-top:2px;">${escHtml(addr)}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#374151;">
        <div>Area: <strong>${totalSqft.toLocaleString()} SF (${totalSQ} SQ)</strong></div>
        <div>Pitch: <strong>${escHtml(pitchLabel)}</strong></div>
        <div>Stories: <strong>${escHtml(storiesLbl)}</strong></div>
      </div>
    </div>
  </div>

  <!-- ══ LINE ITEMS ══ -->
  <div style="padding:20px 36px;">
    <div style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;color:#111827;letter-spacing:.5px;margin-bottom:12px;text-transform:uppercase;">Scope of Work — Line Items</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <thead>
        <tr style="background:#111827;color:#fff;">
          <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:700;">Description</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;width:40px;">Cat</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;width:45px;">Unit</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;width:45px;">Qty</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px;font-weight:700;width:80px;">Unit $</th>
          <th style="padding:8px 10px;text-align:right;font-size:11px;font-weight:700;width:80px;">RCV</th>
        </tr>
      </thead>
      <tbody>${lineItemsHtml}</tbody>
    </table>

    <!-- ══ TOTALS ══ -->
    <div style="display:flex;justify-content:flex-end;">
      <div style="min-width:300px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:14px;">
        <div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;font-size:12px;"><span>Subtotal (materials + labor)</span><span>${fmt(subtotal)}</span></div>
        ${steepAmt > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;font-size:12px;"><span>Steep slope surcharge (${escHtml(steepLabel)})</span><span>${fmt(steepAmt)}</span></div>` : ''}
        ${storiesAmt > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;font-size:12px;"><span>High roof surcharge (${escHtml(storiesLabel)})</span><span>${fmt(storiesAmt)}</span></div>` : ''}
        ${opAmt > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;font-size:12px;"><span>Overhead & Profit (${opPct}%)</span><span>${fmt(opAmt)}</span></div>` : ''}
        ${taxAmt > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;font-size:12px;"><span>Sales Tax (${taxPct}%)</span><span>${fmt(taxAmt)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid #1e40af;margin-top:4px;font-weight:700;color:#1e40af;font-size:13px;"><span>RCV (Replacement Cost Value)</span><span>${fmt(rcv)}</span></div>
        ${deprAmt > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#dc2626;font-size:12px;"><span>Less Depreciation (${deprPct}%)</span><span>−${fmt(deprAmt)}</span></div>` : ''}
        ${deprAmt > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;font-size:12px;"><span>ACV (Actual Cash Value)</span><span>${fmt(acv)}</span></div>` : ''}
        ${ded > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;color:#dc2626;font-size:12px;"><span>Less Deductible</span><span>−${fmt(ded)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:2px solid #16a34a;margin-top:4px;font-weight:700;color:#16a34a;font-size:13px;"><span>Estimated Insurance Payout</span><span>${fmt(payout)}</span></div>
      </div>
    </div>

    <!-- ══ SUPPLEMENT NOTICE ══ -->
    <div style="margin-top:24px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:12px;font-size:11px;color:#92400e;">
      <strong>⚠ Supplement Notice:</strong> This estimate includes all standard line items per Xactimate price list${priceList ? ' <strong>' + escHtml(priceList) + '</strong>' : ''}. Items including starter strip, hip/ridge cap, pipe jacks, and steep slope surcharge are included per manufacturer requirements and local building code. O&P applies per the three-trade rule. Additional supplements may be submitted upon discovery of hidden damage.
    </div>

    <!-- ══ SIGNATURE ══ -->
    <div style="margin-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:32px;">
      <div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Contractor Signature</div>
        <div style="border-bottom:2px solid #111827;height:40px;margin-bottom:4px;"></div>
        <div style="font-size:10px;color:#9ca3af;">${escHtml(co)}</div>
      </div>
      <div>
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Date</div>
        <div style="border-bottom:2px solid #111827;height:40px;margin-bottom:4px;"></div>
      </div>
    </div>

    <!-- ══ FOOTER ══ -->
    <div style="margin-top:28px;padding-top:10px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:9px;color:#9ca3af;">Generated by BidDrop · biddrop.us &nbsp;·&nbsp; Insurance Scope${priceList ? ' · Price List: ' + escHtml(priceList) : ''}</div>
      <div style="font-size:9px;color:#9ca3af;">Estimate #${estNum} · ${today}</div>
    </div>
  </div>

</div>
${forPrint ? '<script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>' : ''}
</body>
</html>`;
}

// ─── Print / open insurance scope PDF ────────────────────────────────────────
async function printInsuranceScopePDF() {
  const _unlocked = await requirePinUnlocked(currentEstPinId);
  if(!_unlocked) return;
  const html = buildInsuranceScopeHTML(true);
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { toast('Please allow popups to print', 'warning'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ─── Hook into existing proposal button ──────────────────────────────────────
// Called from the proposal button onclick — routes to correct PDF based on mode
function openProposalOrInsurance() {
  if (_estMode === 'insurance') {
    printInsuranceScopePDF();
  } else {
    openProposalModal();
  }
}
