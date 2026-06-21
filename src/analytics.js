// src/analytics.js
// Analytics dashboard — postcard stats, scan tracking, team leaderboard.
// Depends on: sb, S.cfg, currentAccount, adminAPI(), toast(), Chart.js (global)
// Extracted from index.html — Tier 3 modularization

let _anChartPostcards=null, _anChartScans=null, _anChartStatus=null;
async function deleteAnalyticsRow(estId, btn){
  if(!confirm('Delete this estimate record from analytics? This cannot be undone.')) return;
  btn.disabled = true;
  btn.textContent = '…';
  try{
    const { error } = await sb.from('estimates').delete().eq('id', estId);
    if(error) throw error;
    // Remove the row from the DOM
    const tr = btn.closest('tr');
    if(tr) tr.remove();
    toast('Estimate deleted from analytics','success');
  } catch(e){
    btn.disabled = false;
    btn.textContent = '🗑';
    toast('Failed to delete: '+(e.message||e),'error');
  }
}

async function loadAnalytics(){
  if(!currentAccount) return;
  const periodEl = document.getElementById('an-period');
  const period = periodEl ? periodEl.value : '30';
  const cutoff = period==='all' ? null : new Date(Date.now()-parseInt(period)*86400000);
  // Helper to set stat card value
  function setStat(id, val){ const el=document.getElementById(id); if(el) el.textContent=val; }
  setStat('an-postcards','…'); setStat('an-scans','…'); setStat('an-open-rate','…');
  setStat('an-signed','…'); setStat('an-estimates','…'); setStat('an-pins','…');
  setStat('an-pipeline','…'); setStat('an-close-rate','…');
  try{
    // ── Local data (already loaded) ──────────────────────────────────────────
    const filteredPins = cutoff ? S.pins.filter(p=>new Date(p.at)>=cutoff) : S.pins;
    const totalPins = filteredPins.length;
    const signedPins = filteredPins.filter(p=>(p.status||'').toLowerCase()==='signed').length;
    // ── Estimates from Supabase ───────────────────────────────────────────────
    // Use only guaranteed-safe columns (no qr_scan_count/page_views which may not exist yet)
    let estBaseQ = sb.from('estimates').select('id,addr,owner,rep,total,mat,created_at,qr_scan_count,page_views,booking_clicks,call_clicks,page_first_viewed_at')
      .eq('account_id', currentAccount.id);
    if(cutoff) estBaseQ = estBaseQ.gte('created_at', cutoff.toISOString());
    const estResult = await estBaseQ.order('created_at',{ascending:false}).limit(2000);
    const {data:estimates} = estResult;
    const ests = estimates||[];
    const totalEsts = ests.length;
    const totalPipeline = ests.reduce((s,e)=>s+(Number(e.total)||0),0);
    const totalScans = ests.reduce((s,e)=>s+(e.qr_scan_count||0),0);
    const totalPageViews = ests.reduce((s,e)=>s+(e.page_views||0),0);
    const totalBookingClicks = ests.reduce((s,e)=>s+(e.booking_clicks||0),0);
    const totalCallClicks = ests.reduce((s,e)=>s+(e.call_clicks||0),0);
    // ── Mail queue from Supabase ──────────────────────────────────────────────
    let qQuery = sb.from('queue').select('id,created_at,status,addr,owner,rep_name')
      .eq('account_id', currentAccount.id);
    if(cutoff) qQuery = qQuery.gte('created_at', cutoff.toISOString());
    const {data:queue} = await qQuery.limit(5000);
    const q = queue||[];
    const totalPostcards = q.filter(m=>m.status==='sent'||m.status==='pending'||m.status==='queued').length;
    // Engagement Rate: % of estimates that have been scanned or viewed
    const engagedEsts = ests.filter(e=>(e.qr_scan_count||0)>0||(e.page_views||0)>0).length;
    const openRate = totalEsts>0 ? Math.round(engagedEsts/totalEsts*100) : 0;
    const closeRate = totalEsts>0 ? Math.round(signedPins/totalEsts*100) : 0;
    // ── Set stats ─────────────────────────────────────────────────────────────
    setStat('an-postcards', totalPostcards.toLocaleString());
    setStat('an-scans', totalScans.toLocaleString());
    setStat('an-open-rate', openRate+'%');
    setStat('an-signed', signedPins.toLocaleString());
    setStat('an-estimates', totalEsts.toLocaleString());
    setStat('an-pins', totalPins.toLocaleString());
    setStat('an-pipeline', totalPipeline>0?'$'+Math.round(totalPipeline).toLocaleString():'$0');
    setStat('an-close-rate', closeRate+'%');
    // ── Retargeting stats ─────────────────────────────────────────────────────
    setStat('an-page-views', totalPageViews.toLocaleString());
    setStat('an-booking-clicks', totalBookingClicks.toLocaleString());
    setStat('an-call-clicks', totalCallClicks.toLocaleString());
    // Page View Rate: % of estimates where homeowner actually viewed the estimate page
    const uniqueViewers = ests.filter(e=>(e.page_views||0)>0).length;
    const viewRate = totalEsts>0 ? Math.round(uniqueViewers/totalEsts*100) : 0;
    setStat('an-view-rate', viewRate+'%');
    // ── Daily postcards chart ─────────────────────────────────────────────────
    const days = []; const dayLabels = [];
    const numDays = period==='all'?30:Math.min(parseInt(period),90);
    for(let i=numDays-1;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      days.push(d.toDateString());
      dayLabels.push(d.toLocaleDateString('en-US',{month:'numeric',day:'numeric'}));
    }
    const postcardsByDay = days.map(ds=>q.filter(m=>new Date(m.created_at).toDateString()===ds).length);
    const scansByDay = days.map(ds=>ests.filter(e=>(e.qr_scan_count||0)>0&&new Date(e.created_at).toDateString()===ds).reduce((s,e)=>s+(e.qr_scan_count||0),0));
    // Render charts using Chart.js (already loaded for dashboard)
    if(typeof Chart !== 'undefined'){
      const chartOpts = {
        type:'bar',
        options:{
          responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false}},
          scales:{x:{ticks:{color:'#888',font:{size:9}},grid:{color:'rgba(255,255,255,.04)'}},y:{ticks:{color:'#888',font:{size:9}},grid:{color:'rgba(255,255,255,.06)'},beginAtZero:true}}
        }
      };
      const pcCtx = document.getElementById('an-chart-postcards');
      if(pcCtx){
        if(_anChartPostcards) _anChartPostcards.destroy();
        _anChartPostcards = new Chart(pcCtx.getContext('2d'), {...chartOpts, data:{labels:dayLabels,datasets:[{data:postcardsByDay,backgroundColor:'rgba(242,92,5,.7)',borderRadius:3}]}});
      }
      const scCtx = document.getElementById('an-chart-scans');
      if(scCtx){
        if(_anChartScans) _anChartScans.destroy();
        _anChartScans = new Chart(scCtx.getContext('2d'), {...chartOpts, data:{labels:dayLabels,datasets:[{data:scansByDay,backgroundColor:'rgba(59,130,246,.7)',borderRadius:3}]}});
      }
      // Status donut
      const statusCounts = {};
      S.pins.forEach(p=>{ const s=p.status||'Active'; statusCounts[s]=(statusCounts[s]||0)+1; });
      const stCtx = document.getElementById('an-chart-status');
      if(stCtx){
        if(_anChartStatus) _anChartStatus.destroy();
        const stLabels=Object.keys(statusCounts); const stData=stLabels.map(k=>statusCounts[k]);
        const stColors=['#F25C05','#22C55E','#3B82F6','#F59E0B','#A855F7','#EF4444'];
        _anChartStatus = new Chart(stCtx.getContext('2d'), {type:'doughnut',data:{labels:stLabels,datasets:[{data:stData,backgroundColor:stColors.slice(0,stLabels.length),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:'#aaa',font:{size:10},boxWidth:10}}}}});
      }
    }
    // ── Rep performance table ─────────────────────────────────────────────────
    const repMap={};
    ests.forEach(e=>{
      const rep=e.rep||'Unknown';
      if(!repMap[rep]) repMap[rep]={name:rep,pins:0,estimates:0,mailers:0,scans:0,signed:0,pipeline:0};
      repMap[rep].estimates++;
      repMap[rep].scans+=(e.qr_scan_count||0);
      repMap[rep].pipeline+=(Number(e.total)||0);
    });
    filteredPins.forEach(p=>{
      const rep=p.rep||'Unknown';
      if(!repMap[rep]) repMap[rep]={name:rep,pins:0,estimates:0,mailers:0,scans:0,signed:0,pipeline:0};
      repMap[rep].pins++;
      if((p.status||'').toLowerCase()==='signed') repMap[rep].signed++;
    });
    q.forEach(m=>{
      // Use rep_name from queue item (set when mailer was sent); only attribute to known reps
      const rep=m.rep_name||null;
      if(!rep) return; // skip queue items with no rep_name (old records before migration)
      if(!repMap[rep]) repMap[rep]={name:rep,pins:0,estimates:0,mailers:0,scans:0,signed:0,pipeline:0};
      repMap[rep].mailers++;
    });
    const reps=Object.values(repMap).sort((a,b)=>b.estimates-a.estimates);
    const tbody=document.getElementById('an-rep-table');
    if(tbody){
      tbody.innerHTML = reps.length ? reps.map(r=>'<tr style="border-bottom:1px solid var(--border);">'+
        '<td style="padding:9px 14px;font-weight:700;color:var(--text);">'+escHtml(r.name)+'</td>'+
        '<td style="padding:9px 14px;text-align:center;color:var(--accent);font-weight:700;">'+r.pins+'</td>'+
        '<td style="padding:9px 14px;text-align:center;color:#A855F7;font-weight:700;">'+r.estimates+'</td>'+
        '<td style="padding:9px 14px;text-align:center;color:#3B82F6;font-weight:700;">'+r.mailers+'</td>'+
        '<td style="padding:9px 14px;text-align:center;color:#F59E0B;font-weight:700;">'+r.scans+'</td>'+
        '<td style="padding:9px 14px;text-align:center;color:#22C55E;font-weight:700;">'+r.signed+'</td>'+
        '<td style="padding:9px 14px;text-align:center;color:var(--text);font-weight:700;">'+(r.pipeline?'$'+Math.round(r.pipeline).toLocaleString():'—')+'</td>'+
      '</tr>').join('') : '<tr><td colspan="7" style="padding:18px;text-align:center;color:var(--muted);">No data yet.</td></tr>';
    }
    // ── Per-estimate engagement table ────────────────────────────────────────
    const estTbody = document.getElementById('an-est-table');
    if(estTbody){
      const estsWithActivity = ests
        .filter(e=>(e.qr_scan_count||0)+(e.page_views||0)+(e.booking_clicks||0)+(e.call_clicks||0)>0)
        .sort((a,b)=>((b.page_views||0)+(b.qr_scan_count||0))-(((a.page_views||0)+(a.qr_scan_count||0))));
      const allEsts = [...estsWithActivity, ...ests.filter(e=>!estsWithActivity.includes(e))].slice(0,50);
      if(allEsts.length){
        estTbody.innerHTML = allEsts.map(e=>{
          const scans = e.qr_scan_count||0;
          const views = e.page_views||0;
          const bookings = e.booking_clicks||0;
          const calls = e.call_clicks||0;
          const firstViewed = e.page_first_viewed_at ? new Date(e.page_first_viewed_at).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'}) : '—';
          const hasActivity = scans+views+bookings+calls > 0;
          return '<tr style="border-bottom:1px solid var(--border);'+(hasActivity?'':'opacity:.5')+'">' +
            '<td style="padding:9px 14px;font-weight:600;color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(e.addr||'—')+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:var(--text);font-weight:700;">'+(e.total?'$'+Math.round(e.total).toLocaleString():'—')+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(scans>0?'#F59E0B':'var(--muted)')+';font-weight:'+(scans>0?'700':'400')+';">'+scans+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(views>0?'#3B82F6':'var(--muted)')+';font-weight:'+(views>0?'700':'400')+';">'+views+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(bookings>0?'#22C55E':'var(--muted)')+';font-weight:'+(bookings>0?'700':'400')+';">'+bookings+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(calls>0?'#A855F7':'var(--muted)')+';font-weight:'+(calls>0?'700':'400')+';">'+calls+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:var(--muted);font-size:11px;">'+firstViewed+'</td>'+
            '<td style="padding:9px 14px;text-align:center;">'+(e.id?'<a href="https://biddrop.us/'+(e.slug||'roofing')+'/'+encodeURIComponent(e.id)+'" target="_blank" style="color:var(--accent);font-size:11px;font-weight:700;text-decoration:none;">View ↗</a>':'—')+'</td>'+
            '<td style="padding:9px 14px;text-align:center;">'+(e.id?'<button onclick="deleteAnalyticsRow(\''+e.id+'\',this)" style="background:transparent;border:1px solid #EF444455;border-radius:5px;padding:3px 8px;color:#EF4444;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">🗑</button>':'')+'</td>'+
          '</tr>';
        }).join('');
      } else {
        estTbody.innerHTML = '<tr><td colspan="9" style="padding:18px;text-align:center;color:var(--muted);">No estimates in this period. Send some postcards to start tracking!</td></tr>';
      }
    }
    // ── Material breakdown ────────────────────────────────────────────────────
    const matMap={};
    ests.forEach(e=>{ if(e.mat){ matMap[e.mat]=(matMap[e.mat]||0)+1; } });
    const matEl=document.getElementById('an-materials');
    if(matEl){
      const sorted=Object.entries(matMap).sort((a,b)=>b[1]-a[1]);
      if(sorted.length){
        const max=sorted[0][1];
        matEl.innerHTML=sorted.map(([mat,cnt])=>'<div style="margin-bottom:8px;">'+
          '<div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="font-size:12px;color:var(--text);">'+escHtml(mat)+'</span><span style="font-size:12px;font-weight:700;color:var(--accent);">'+cnt+'</span></div>'+
          '<div style="background:var(--border);border-radius:4px;height:6px;"><div style="background:var(--accent);border-radius:4px;height:6px;width:'+Math.round(cnt/max*100)+'%;"></div></div>'+
        '</div>').join('');
      } else {
        matEl.innerHTML='<div style="color:var(--muted);font-size:12px;padding:12px 0;">No estimate data yet.</div>';
      }
    }
  }catch(e){
    console.error('[BidDrop] Analytics error:',e.message||e);
    // Show 0 instead of Err so the UI doesn't look broken on empty accounts
    setStat('an-postcards','0'); setStat('an-scans','0');
    setStat('an-open-rate','0%'); setStat('an-signed','0');
    setStat('an-estimates','0'); setStat('an-pins','0');
    setStat('an-pipeline','$0'); setStat('an-close-rate','0%');
    setStat('an-page-views','0'); setStat('an-booking-clicks','0');
    setStat('an-call-clicks','0'); setStat('an-view-rate','0%');
  }
}


async function renderTeam(){
  const el=document.getElementById('team-list');
  if(!el) return;
  // Super admin with no account: show nothing
  if(!currentAccount){
    el.innerHTML='<div style="text-align:center;padding:18px;color:var(--muted);font-size:11px;">No account loaded.</div>';
    return;
  }
  // Load real team members from Supabase
  const {data:profiles, error} = await sb.from('user_profiles').select('id,name,email,role,phone').eq('account_id', currentAccount.id);
  if(error || !profiles || !profiles.length){
    el.innerHTML='<div style="text-align:center;padding:18px;color:var(--muted);font-size:11px;">No team members yet. Use Admin Panel to add users.</div>';
    return;
  }
  const canRemove = isAdminOrAbove();
  el.innerHTML = profiles.map(p=>{
    // Count pins and estimates for this rep from already-loaded S.pins
    const repName = (p.name||p.email||'').toLowerCase();
    const pinCount = S.pins.filter(pin=>(pin.rep||'').toLowerCase()===repName).length;
    const estCount = S.pins.filter(pin=>(pin.rep||'').toLowerCase()===repName && pin.estimate).length;
    const initials = (p.name||p.email||'?').charAt(0).toUpperCase();
    const editBtn = canRemove
      ? '<button onclick="editTeamMember(\''+p.id+'\',\''+escJs(p.name||'')+'\',\''+escJs(p.email||'')+'\',\''+escJs(p.phone||'')+'\',\''+escJs(p.role||'rep')+'\')" '+
        'title="Edit member" style="background:none;border:1px solid var(--border);border-radius:5px;color:var(--muted);cursor:pointer;font-size:11px;padding:2px 8px;font-weight:600;" '+
        'onmouseover="this.style.borderColor=\'var(--accent)\';this.style.color=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--muted)\'">✏️ Edit</button>'
      : '';
    const removeBtn = canRemove
      ? '<button onclick="removeTeamMember(\''+p.id+'\',\''+escJs(p.name||p.email)+'\')" '+
        'title="Remove from team" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 4px;line-height:1;" '+
        'onmouseover="this.style.color=\'var(--danger)\'" onmouseout="this.style.color=\'var(--muted)\'">×</button>'
      : '';
    return '<div class="team-row">'+
      '<div class="t-avatar">'+initials+'</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div class="t-name">'+escHtml(p.name||p.email||'Unnamed')+'</div>'+
        '<div class="t-stats"><b>'+pinCount+'</b> pins · <b>'+estCount+'</b> est. · '+escHtml(p.email||'')+'</div>'+
      '</div>'+
      editBtn+
      removeBtn+
      '</div>';
  }).join('');
}

function editTeamMember(profileId, name, email, phone, role){
  // Build modal
  const existing = document.getElementById('edit-member-modal');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'edit-member-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;width:100%;max-width:420px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-family:var(--font-h);font-size:15px;font-weight:700;color:var(--text);">EDIT TEAM MEMBER</div>
        <button onclick="document.getElementById('edit-member-modal').remove()" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;line-height:1;">&times;</button>
      </div>
      <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--muted);margin-bottom:4px;">NAME</label>
      <input id="em-name" value="${escHtml(name)}" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;margin-bottom:12px;box-sizing:border-box;" />
      <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--muted);margin-bottom:4px;">EMAIL</label>
      <input id="em-email" value="${escHtml(email)}" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;margin-bottom:12px;box-sizing:border-box;" />
      <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--muted);margin-bottom:4px;">PHONE</label>
      <input id="em-phone" value="${escHtml(phone)}" placeholder="(555) 555-5555" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;margin-bottom:12px;box-sizing:border-box;" />
      <label style="display:block;font-size:11px;font-weight:700;letter-spacing:.5px;color:var(--muted);margin-bottom:4px;">ROLE</label>
      <select id="em-role" style="width:100%;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;margin-bottom:20px;box-sizing:border-box;">
        <option value="admin" ${role==='admin'?'selected':''}>Admin</option>
        <option value="rep" ${role==='rep'?'selected':''}>Rep (Field)</option>
      </select>
      <button onclick="saveTeamMember('${profileId}')" style="width:100%;background:var(--accent);border:none;border-radius:8px;padding:12px;color:#fff;font-family:var(--font-h);font-size:13px;font-weight:700;cursor:pointer;">SAVE CHANGES</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
}
async function saveTeamMember(profileId){
  const name = document.getElementById('em-name').value.trim();
  const email = document.getElementById('em-email').value.trim();
  const phone = document.getElementById('em-phone').value.trim();
  const role = document.getElementById('em-role').value;
  if(!name){ toast('Name is required','error'); return; }
  const {error} = await sb.from('user_profiles').update({name, email, phone, role}).eq('id', profileId);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Member updated','success');
  document.getElementById('edit-member-modal').remove();
  renderTeam();
}
async function removeTeamMember(profileId, name){
  if(!confirm('Remove '+name+' from the team?\n\nThis removes their profile but does NOT delete their login. You can re-add them via Admin Panel.')) return;
  const {error} = await sb.from('user_profiles').delete().eq('id', profileId);
  if(error){ toast('Error removing member: '+error.message,'error'); return; }
  toast(name+' removed from team','success');
  renderTeam();
}

function addTeamMember(){
  // Open the Admin Panel tab
  goTab('admin');
}

function bumpTeam(name,field){
  if(!name||name==='Unknown')return;
  let m=S.team.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!m){m={name,pins:0,ests:0};S.team.push(m);}
  m[field]=(m[field]||0)+1;
}

