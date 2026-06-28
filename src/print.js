// ── PRINT & PREVIEW HELPERS ──────────────────────────────────────────────────
// Extracted from index.html — pure print window builders and financing preview
// Dependencies: S [state.js], escHtml [index.html], getMailerStyles [this file]
async function printNow(){
  if(!isPlanAtLeast('pro')){ showPlanUpgradePrompt('Print Now','pro'); return; }
  const _unlocked = await requirePinUnlocked(currentEstPinId);
  if(!_unlocked) return;
  // Build full print window and immediately trigger print
  const content = document.getElementById('mailer-preview').innerHTML;
  const win = window.open('','_blank','width=900,height=1100');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>BidDrop — Print</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:letter;margin:0.5in;}
  body{background:#fff;font-family:'Barlow',sans-serif;}
  .mailer{max-width:7.5in;margin:0 auto;}
  .ml-page{page-break-after:always;margin-bottom:0;width:7.5in !important;height:10in !important;max-height:10in !important;overflow:hidden !important;box-shadow:none !important;}
  .ml-page:last-child{page-break-after:avoid;}
  ${getMailerStyles()}
</style>
</head>
<body>
<div class="mailer">${content}</div>
<script>
  window.onload=function(){
    // Small delay to let fonts/images load
    setTimeout(function(){window.print();},800);
  };
<\/script>
</div><!-- /main-app -->
</body>
</html>`);
  win.document.close();
}

// ═══════════════════════════════
//  FINANCING PREVIEW (Settings modal)
// ═══════════════════════════════
function updateFinPreview(){
  const el=document.getElementById('fin-preview-val');
  if(!el)return;
  const apr=parseFloat(document.getElementById('s-fin-apr').value)||9.99;
  const term=parseInt(document.getElementById('s-fin-term').value)||60;
  const down=parseFloat(document.getElementById('s-fin-down').value)||0;
  const total=parseInt((document.getElementById('e-total').textContent||'').replace(/[^0-9]/g,''))||0;
  if(!total){el.textContent='—';return;}
  const loan=total*(1-down/100);
  const r=apr/100/12;
  const mo=r===0?Math.round(loan/term):Math.round(loan*r*Math.pow(1+r,term)/(Math.pow(1+r,term)-1));
  el.textContent='$'+mo.toLocaleString();
}

// ═══════════════════════════════
//  PRINT PREVIEW
// ═══════════════════════════════
function printPreview(){
  if(!isPlanAtLeast('pro')){ showPlanUpgradePrompt('Print Preview','pro'); return; }
  const content=document.getElementById('mailer-preview').innerHTML;
  const win=window.open('','_blank','width=900,height=1100');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Mailer Print Preview</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  @page{size:letter;margin:0.5in;}
  body{background:#e5e5e5;font-family:'Barlow',sans-serif;}
  .preview-wrap{max-width:8.5in;margin:0 auto;padding:20px;}
  .preview-label{background:#333;color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 14px;border-radius:4px 4px 0 0;display:inline-block;margin-top:16px;}
  .page-sheet{background:#fff;width:7.5in;height:10in;max-height:10in;margin:0 auto 0;padding:0;box-shadow:0 4px 24px rgba(0,0,0,.25);page-break-after:always;overflow:hidden;}
  .page-sheet:last-child{page-break-after:avoid;}
  /* Inherit all mailer styles */
  ${getMailerStyles()}
  @media print{
    body{background:#fff;}
    .preview-wrap{padding:0;}
    .preview-label{display:none;}
    .page-sheet{box-shadow:none;margin:0;width:100%;}
  }
</style>
</head>
<body>
<div class="preview-wrap">${content}</div>
<script>
  // Fix page sheets sizing
  document.querySelectorAll('.ml-page').forEach((p,i)=>{
    p.style.pageBreakAfter='always';
    p.style.marginBottom='0';
    p.style.boxShadow='none';
  });
  // Auto-fit pages into letter-sized boxes
  setTimeout(()=>{
    const pages=document.querySelectorAll('.ml-page');
    pages.forEach(p=>{
      const wrap=document.createElement('div');
      wrap.className='page-sheet';
      p.parentNode.insertBefore(wrap,p);
      wrap.appendChild(p);
      // Scale if overflowing
      const ph=p.scrollHeight, sh=960; // 10in at 96dpi
      if(ph>sh){ const scale=sh/ph; p.style.transform='scale('+scale+')'; p.style.transformOrigin='top left'; wrap.style.height=(sh)+'px'; wrap.style.overflow='hidden'; }
    });
  },500);
<\/script>
</body>
</html>`);
  win.document.close();
}

function getMailerStyles(){
  // Extract mailer-related CSS from the page stylesheet
  const sheets=Array.from(document.styleSheets);
  let css='';
  for(const sheet of sheets){
    try{
      const rules=Array.from(sheet.cssRules||[]);
      for(const rule of rules){
        const txt=rule.cssText||'';
        if(txt.includes('ml-')||txt.includes('mailer')){css+=txt+'\n';}
      }
    }catch(e){}
  }
  return css;
}

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
}
