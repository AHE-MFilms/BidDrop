with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update the estimates SELECT to include page_views, booking_clicks, call_clicks, page_first_viewed_at
old_est_select = "let estBaseQ = sb.from('estimates').select('id,addr,owner,total,qr_scan_count,rep,material,created_at,status').eq('account_id', currentAccount.id).is('deleted_at',null);"

new_est_select = "let estBaseQ = sb.from('estimates').select('id,addr,owner,total,qr_scan_count,page_views,booking_clicks,call_clicks,page_first_viewed_at,rep,material,created_at,status').eq('account_id', currentAccount.id).is('deleted_at',null);"

if old_est_select in html:
    html = html.replace(old_est_select, new_est_select, 1)
    print("OK: estimates SELECT updated")
else:
    # Try to find it
    idx = html.find("'estimates').select('id,addr,owner,total,qr_scan_count")
    if idx >= 0:
        print(f"WARN: found at {idx}: {repr(html[idx:idx+200])}")
    else:
        print("FAIL: estimates SELECT not found")

# 2. Add page_views / booking_clicks / call_clicks aggregation after totalScans
old_total_scans = "    const totalScans = ests.reduce((s,e)=>s+(e.qr_scan_count||0),0);\n    // ── Mail queue from Supabase"

new_total_scans = """    const totalScans = ests.reduce((s,e)=>s+(e.qr_scan_count||0),0);
    const totalPageViews = ests.reduce((s,e)=>s+(e.page_views||0),0);
    const totalBookingClicks = ests.reduce((s,e)=>s+(e.booking_clicks||0),0);
    const totalCallClicks = ests.reduce((s,e)=>s+(e.call_clicks||0),0);
    // ── Mail queue from Supabase"""

if old_total_scans in html:
    html = html.replace(old_total_scans, new_total_scans, 1)
    print("OK: aggregation added")
else:
    print("FAIL: totalScans block not found")

# 3. Add setStat calls for new fields after an-close-rate
old_set_stats_end = "    setStat('an-close-rate', closeRate+'%');\n    // ── Daily postcards chart"

new_set_stats_end = """    setStat('an-close-rate', closeRate+'%');
    // ── Retargeting stats ─────────────────────────────────────────────────────
    setStat('an-page-views', totalPageViews.toLocaleString());
    setStat('an-booking-clicks', totalBookingClicks.toLocaleString());
    setStat('an-call-clicks', totalCallClicks.toLocaleString());
    const viewRate = totalScans>0 ? Math.round(totalPageViews/totalScans*100) : 0;
    setStat('an-view-rate', viewRate+'%');
    // ── Daily postcards chart"""

if old_set_stats_end in html:
    html = html.replace(old_set_stats_end, new_set_stats_end, 1)
    print("OK: setStat calls added")
else:
    print("FAIL: setStat end not found")

# 4. Add per-estimate table population after the rep table block
# Find the rep table end and add estimate table after it
old_rep_end = "    // ── Material breakdown"

new_rep_end = """    // ── Per-estimate engagement table ────────────────────────────────────────
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
          const firstViewed = e.page_first_viewed_at ? new Date(e.page_first_viewed_at).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'}) : '\u2014';
          const hasActivity = scans+views+bookings+calls > 0;
          return '<tr style="border-bottom:1px solid var(--border);'+(hasActivity?'':'opacity:.5')+'">' +
            '<td style="padding:9px 14px;font-weight:600;color:var(--text);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(e.addr||'\u2014')+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:var(--text);font-weight:700;">'+(e.total?'$'+Math.round(e.total).toLocaleString():'\u2014')+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(scans>0?'#F59E0B':'var(--muted)')+';font-weight:'+(scans>0?'700':'400')+';">'+scans+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(views>0?'#3B82F6':'var(--muted)')+';font-weight:'+(views>0?'700':'400')+';">'+views+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(bookings>0?'#22C55E':'var(--muted)')+';font-weight:'+(bookings>0?'700':'400')+';">'+bookings+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:'+(calls>0?'#A855F7':'var(--muted)')+';font-weight:'+(calls>0?'700':'400')+';">'+calls+'</td>'+
            '<td style="padding:9px 14px;text-align:center;color:var(--muted);font-size:11px;">'+firstViewed+'</td>'+
            '<td style="padding:9px 14px;text-align:center;">'+(e.id?'<a href="https://biddrop.us/e/'+encodeURIComponent(e.id)+'" target="_blank" style="color:var(--accent);font-size:11px;font-weight:700;text-decoration:none;">View \u2197</a>':'\u2014')+'</td>'+
          '</tr>';
        }).join('');
      } else {
        estTbody.innerHTML = '<tr><td colspan="8" style="padding:18px;text-align:center;color:var(--muted);">No estimates in this period. Send some postcards to start tracking!</td></tr>';
      }
    }
    // ── Material breakdown"""

if old_rep_end in html:
    html = html.replace(old_rep_end, new_rep_end, 1)
    print("OK: per-estimate table JS added")
else:
    print("FAIL: Material breakdown comment not found")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Saved")
