// src/history.js
// History tab — mailer log, credit purchases, campaign history.
// Depends on: sb (supabase client), S.cfg, currentAccount, adminAPI(), toast()
// Extracted from index.html — Tier 2 modularization
// Note: escHtml() is also defined in ui.js; this copy is kept for isolation.

let _histMailers = [];
let _histCredits = [];
let _histPage = 1;
const HIST_PAGE_SIZE = 25;

async function loadHistory(){
  // Update balance display
  // Show total credits: free remaining + paid (same as header badge)
  const planFreeMapH = {starter:0,pro:0,agency:0,enterprise:0};
  const freeLimitH = planFreeMapH[(S.cfg.plan||'starter').toLowerCase()] || 0;
  const freeLeftH  = Math.max(0, freeLimitH - (S.cfg.freeMailerCreditsUsed || 0));
  const paidH      = S.cfg.mailerCredits || 0;
  const totalBal  = freeLeftH + paidH;
  const el = document.getElementById('hist-credits-balance');
  if(el) el.textContent = totalBal + ' credits';

  // Load mailer_log
  const mailRes = await sb.from('mailer_log')
    .select('*')
    .eq('account_id', currentAccount.id)
    .order('sent_at', {ascending: false})
    .limit(1000);
  _histMailers = mailRes.data || [];

  // Load credit_purchases
  const credRes = await sb.from('credit_purchases')
    .select('*')
    .eq('account_id', currentAccount.id)
    .eq('status', 'completed')
    .order('completed_at', {ascending: false})
    .limit(500);
  _histCredits = credRes.data || [];

  _histPage = 1;
  renderHistMailers();
  renderHistCredits();
}

function histTab(tab){
  document.getElementById('hist-panel-mailers')?.style && (document.getElementById('hist-panel-mailers').style.display = tab==='mailers' ? '' : 'none');
  document.getElementById('hist-panel-credits')?.style && (document.getElementById('hist-panel-credits').style.display = tab==='credits' ? '' : 'none');
  const campPanel = document.getElementById('hist-panel-campaigns');
  if(campPanel) campPanel.style.display = tab==='campaigns' ? '' : 'none';
  const mBtn = document.getElementById('hist-tab-mailers');
  const cBtn = document.getElementById('hist-tab-credits');
  const campBtn = document.getElementById('hist-tab-campaigns');
  if(mBtn){
    mBtn.style.borderBottomColor = tab==='mailers' ? 'var(--accent)' : 'transparent';
    mBtn.style.color = tab==='mailers' ? 'var(--accent)' : 'var(--muted)';
  }
  if(cBtn){
    cBtn.style.borderBottomColor = tab==='credits' ? 'var(--accent)' : 'transparent';
    cBtn.style.color = tab==='credits' ? 'var(--accent)' : 'var(--muted)';
  }
  if(campBtn){
    campBtn.style.borderBottomColor = tab==='campaigns' ? 'var(--accent)' : 'transparent';
    campBtn.style.color = tab==='campaigns' ? 'var(--accent)' : 'var(--muted)';
  }
  if(tab==='campaigns') loadCampaignHistory();
}
async function loadCampaignHistory(){
  const el = document.getElementById('hist-campaigns-table');
  if(!el) return;
  el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">Loading…</div>';
  try{
    const data = await adminAPI('campaign-list', { targetAccountId: currentAccount ? currentAccount.id : null });
    const campaigns = (data && data.campaigns) || [];
    if(!campaigns.length){
      el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">No campaigns yet. Launch a Nearby Campaign from any pin popup.</div>';
      return;
    }
    const rows = campaigns.map(function(c){
      const d = new Date(c.campaign_date);
      const dateStr = d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
      const statusColor = c.status==='active' ? 'var(--accent)' : c.status==='completed' ? 'var(--success)' : 'var(--muted)';
      const pinList = (c.pin_ids||[]).slice(0,5).join(', ') + ((c.pin_ids||[]).length>5 ? ' …' : '');
      return '<div style="display:grid;grid-template-columns:1fr auto;align-items:start;padding:14px 18px;border-bottom:1px solid var(--border);gap:12px;">'+
        '<div>'+
          '<div style="font-weight:600;color:var(--text);font-size:14px;margin-bottom:3px;">📍 '+escHtml(c.source_address||'Unknown address')+'</div>'+
          '<div style="font-size:12px;color:var(--muted);margin-bottom:6px;">'+dateStr+' · '+escHtml(c.rep_email||'')+' · <span style="color:var(--text);">'+c.home_count+' homes</span></div>'+
          '<div style="display:flex;gap:12px;font-size:12px;">'+
            '<span style="color:var(--info);">&#8679; '+c.ghl_pushed+' to GHL</span>'+
            '<span style="color:var(--success);">&#128236; '+c.postcards_sent+' postcards</span>'+
          '</div>'+
        '</div>'+
        '<div style="text-align:right;">'+
          '<span style="background:rgba(242,92,5,.12);border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:11px;font-weight:700;color:'+statusColor+';text-transform:uppercase;">'+c.status+'</span>'+
        '</div>'+
      '</div>';
    }).join('');
    el.innerHTML = rows;
  } catch(e){
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--danger);">Failed to load campaigns: '+escHtml(e.message||String(e))+'</div>';
  }
}
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderHistMailers(){
  const search = (document.getElementById('hist-search')?.value||'').toLowerCase();
  const typeFilter = document.getElementById('hist-type-filter')?.value||'';
  let rows = _histMailers.filter(r=>{
    const matchSearch = !search || (r.owner_name||'').toLowerCase().includes(search) || (r.address||'').toLowerCase().includes(search);
    const matchType = !typeFilter || (r.mailer_type||'postcard') === typeFilter;
    return matchSearch && matchType;
  });
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / HIST_PAGE_SIZE));
  if(_histPage > pages) _histPage = 1;
  const slice = rows.slice((_histPage-1)*HIST_PAGE_SIZE, _histPage*HIST_PAGE_SIZE);

  const el = document.getElementById('hist-mailers-table');
  if(!el) return;
  if(!slice.length){
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">No mailers found.</div>';
    const _hmp=document.getElementById('hist-mailers-pagination'); if(_hmp) _hmp.innerHTML='';
    return;
  }

  let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:var(--panel);border-bottom:1px solid var(--border);">
        <th style="padding:11px 16px;text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Date</th>
        <th style="padding:11px 16px;text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Homeowner</th>
        <th style="padding:11px 16px;text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Address</th>
        <th style="padding:11px 16px;text-align:right;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Estimate</th>
        <th style="padding:11px 16px;text-align:center;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Type</th>
        <th style="padding:11px 16px;text-align:center;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Credits</th>
      </tr>
    </thead>
    <tbody>`;

  slice.forEach((r,i)=>{
    const date = r.sent_at ? new Date(r.sent_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const type = r.mailer_type === 'letter' ? 'Letter' : 'Postcard';
    const typeColor = r.mailer_type === 'letter' ? '#3B82F6' : 'var(--accent)';
    const est = r.estimate_total ? '$'+Number(r.estimate_total).toLocaleString() : '—';
    const bg = i%2===0 ? 'var(--card)' : 'var(--panel)';
    html += `<tr style="background:${bg};border-bottom:1px solid var(--border);">
      <td style="padding:11px 16px;color:var(--muted);white-space:nowrap;">${date}</td>
      <td style="padding:11px 16px;color:var(--text);font-weight:500;">${escHtml(r.owner_name||'—')}</td>
      <td style="padding:11px 16px;color:var(--muted);">${escHtml(r.address||'—')}</td>
      <td style="padding:11px 16px;text-align:right;color:var(--accent);font-weight:600;">${est}</td>
      <td style="padding:11px 16px;text-align:center;"><span style="background:${typeColor}22;color:${typeColor};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;">${type}</span></td>
      <td style="padding:11px 16px;text-align:center;color:var(--muted);">${r.credits_used ?? (r.mailer_type === 'lookup' ? 1 : 16)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  el.innerHTML = html;

  // Pagination
  const pg = document.getElementById('hist-mailers-pagination');
  if(pages <= 1){ pg.innerHTML=''; return; }
  let pgHtml = `<span style="color:var(--muted);font-size:12px;align-self:center;">${total} total</span>`;
  for(let p=1;p<=pages;p++){
    const active = p===_histPage;
    pgHtml += `<button onclick="_histPage=${p};renderHistMailers()" style="width:32px;height:32px;border-radius:6px;border:1px solid ${active?'var(--accent)':'var(--border)'};background:${active?'var(--accent)':'var(--card)'};color:${active?'#fff':'var(--text)'};cursor:pointer;font-size:13px;">${p}</button>`;
  }
  pg.innerHTML = pgHtml;
}

function renderHistCredits(){
  const el = document.getElementById('hist-credits-table');
  if(!el) return;
  if(!_histCredits.length){
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted);">No credit purchases found.</div>';
    return;
  }

  let html = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:var(--panel);border-bottom:1px solid var(--border);">
        <th style="padding:11px 16px;text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Date</th>
        <th style="padding:11px 16px;text-align:left;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Package</th>
        <th style="padding:11px 16px;text-align:right;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Credits</th>
        <th style="padding:11px 16px;text-align:right;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Amount Paid</th>
        <th style="padding:11px 16px;text-align:center;color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Status</th>
      </tr>
    </thead>
    <tbody>`;

  _histCredits.forEach((r,i)=>{
    const date = (r.completed_at||r.created_at) ? new Date(r.completed_at||r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const credits = r.credits_purchased ? '+'+r.credits_purchased : '—';
    const amount = r.amount_cents ? '$'+(r.amount_cents/100).toFixed(2) : '—';
    const bg = i%2===0 ? 'var(--card)' : 'var(--panel)';
    // Derive pack label from credits
    let label = r.credits_purchased + ' Credits';
    if(r.credits_purchased===50) label='Starter Pack (50 credits)';
    else if(r.credits_purchased===200) label='Growth Pack (200 credits)';
    else if(r.credits_purchased===500) label='Pro Pack (500 credits)';
    else if(r.credits_purchased===1000) label='Agency Pack (1,000 credits)';
    html += `<tr style="background:${bg};border-bottom:1px solid var(--border);">
      <td style="padding:11px 16px;color:var(--muted);white-space:nowrap;">${date}</td>
      <td style="padding:11px 16px;color:var(--text);font-weight:500;">${label}</td>
      <td style="padding:11px 16px;text-align:right;color:#22C55E;font-weight:700;">${credits}</td>
      <td style="padding:11px 16px;text-align:right;color:var(--text);">${amount}</td>
      <td style="padding:11px 16px;text-align:center;"><span style="background:#22C55E22;color:#22C55E;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;">Completed</span></td>
    </tr>`;
  });

  html += `</tbody></table>`;
  el.innerHTML = html;
}

