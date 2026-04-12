with open('/home/ubuntu/biddrop/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ══════════════════════════════════════════════════════════════════════════════
# PATCH A: Hide drip button in Estimates tab when dripEnabled is false
# ══════════════════════════════════════════════════════════════════════════════
old_drip_btn = (
    '            +`<button onclick="openDripModal(\'${eid}\')" style="background:#7C3AED;border:none;border-radius:6px;'
    'padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128336; Drip</button>`'
)
new_drip_btn = (
    '            +(S.cfg && S.cfg.dripEnabled ? `<button onclick="openDripModal(\'${eid}\')" style="background:#7C3AED;border:none;border-radius:6px;'
    'padding:6px 10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">&#128336; Drip</button>` : \'\')'
)
if old_drip_btn in content:
    content = content.replace(old_drip_btn, new_drip_btn, 1)
    print("PATCH A OK: drip button hidden when dripEnabled=false")
else:
    print("PATCH A FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# PATCH B: Add postcard thumbnail + drip badge to Mail Queue rows
# Drip items have i.drip_step set. Show a small postcard thumb and a "Drip Step X" badge.
# ══════════════════════════════════════════════════════════════════════════════
old_queue_owner_cell = "      '<td style=\"font-weight:600;\">'+escHtml(i.owner)+'</td>'+\n      '<td style=\"color:var(--mid);font-size:11px;\">'+escHtml(i.addr)+'</td>'+"
new_queue_owner_cell = """      '<td style="font-weight:600;">'+escHtml(i.owner)+(i.drip_step?'<br><span style="font-size:9px;background:#7C3AED22;color:#C4B5FD;border:1px solid #7C3AED44;border-radius:10px;padding:1px 6px;font-weight:700;">📮 Drip Step '+i.drip_step+'</span>':'')+'</td>'+
      '<td style="color:var(--mid);font-size:11px;">'+escHtml(i.addr)+(i.drip_step && S.cfg && S.cfg['postcardStep'+i.drip_step] ? '<br><img src="'+S.cfg['postcardStep'+i.drip_step]+'" style="width:60px;height:40px;object-fit:cover;border-radius:4px;margin-top:3px;border:1px solid var(--border);" title="Postcard front preview">' : '')+'</td>'+"""

if old_queue_owner_cell in content:
    content = content.replace(old_queue_owner_cell, new_queue_owner_cell, 1)
    print("PATCH B OK: postcard thumbnail added to queue rows")
else:
    print("PATCH B FAIL")
    # Debug
    idx = content.find("'<td style=\"font-weight:600;\">'+escHtml(i.owner)")
    print(repr(content[idx:idx+200]))

# ══════════════════════════════════════════════════════════════════════════════
# PATCH C: Auto-fire drip steps — enhance _processDripScheduleSync to also
# auto-send items that are past their scheduled date (not just promote to pending)
# Add a new autoFireDripStep function that calls sendLob silently
# ══════════════════════════════════════════════════════════════════════════════
old_process_drip = "// Check scheduled drip items on app load and when queue renders — promote to 'pending' if sendAt has passed\nfunction processDripSchedule(){"
new_process_drip = """// Check scheduled drip items on app load and when queue renders — promote to 'pending' if sendAt has passed
// Also auto-fires items that are past their sendAt and have a postcard design uploaded
async function autoFireDueDripSteps(){
  if(!S.cfg || !S.cfg.dripEnabled) return; // only fire if drip is enabled
  const now = new Date();
  const due = (S.queue||[]).filter(q=>
    q.drip_step &&
    q.status === 'pending' &&
    q.scheduled_send_at &&
    new Date(q.scheduled_send_at) <= now &&
    S.cfg['postcardStep'+q.drip_step] // postcard design must be uploaded
  );
  for(const item of due){
    console.log('[BidDrop] Auto-firing drip step', item.drip_step, 'for', item.addr);
    await sendDripPostcard(item.id);
  }
}

async function sendDripPostcard(id){
  const item = S.queue.find(x=>x.id===id);
  if(!item || item.status==='sent') return;
  const key = masterLobKey || S.cfg.lobKey;
  if(!key) return;
  const co = S.cfg.companyName||'Your Roofing Co';
  const fromRaw = S.cfg.companyAddr||'123 Main St, Detroit, MI, 48000';
  const fp = fromRaw.split(',').map(s=>s.trim());
  const tp = item.addr.split(',').map(s=>s.trim());
  const toLine1 = tp[0]||'';
  const toCity  = tp[1]||'';
  let   toState = tp[2]||'MI';
  let   toZip   = tp[3]||'00000';
  if(!toZip && toState && toState.includes(' ')){
    const parts=toState.split(' '); toZip=parts.pop(); toState=parts.join(' ');
  }
  const frontUrl = S.cfg['postcardStep'+item.drip_step];
  if(!frontUrl){ console.warn('[BidDrop] No postcard design for step', item.drip_step); return; }
  const backHtml = buildPostcardBack({
    fromName: co,
    fromAddr: fromRaw,
    fromCity: '',
    fromPhone: S.cfg.companyPhone||'',
    logoUrl: S.cfg.logoData||'',
    toName: item.owner||'Homeowner',
    toAddr: item.addr
  });
  try{
    const res = await fetch('https://api.lob.com/v1/postcards',{
      method:'POST',
      headers:{'Authorization':'Basic '+btoa(key+':'),'Content-Type':'application/json'},
      body: JSON.stringify({
        description: 'Drip Step '+item.drip_step+' — '+item.addr,
        to:{name:item.owner,address_line1:toLine1,address_city:toCity,address_state:toState,address_zip:toZip,address_country:'US'},
        from:{name:co,address_line1:fp[0]||'123 Main St',address_city:fp[1]||'Detroit',address_state:fp[2]||'MI',address_zip:fp[3]||'48000',address_country:'US'},
        front: frontUrl,
        back: backHtml,
        size: '4x6'
      })
    });
    const d = await res.json();
    if(res.ok){
      item.status='sent'; item.mailedAt=new Date().toISOString(); item.lobId=d.id;
      addAct('Drip Step '+item.drip_step+' postcard mailed to <strong>'+escHtml(item.addr)+'</strong>','converted');
      if(currentAccount && sb){
        sb.from('mailer_log').insert({
          account_id: currentAccount.id,
          sent_by: currentUser?.id||null,
          address: item.addr,
          owner_name: item.owner,
          estimate_total: item.total||0,
          lob_id: d.id,
          queue_item_id: item.id,
          company_name: S.cfg.companyName||'',
          sent_at: new Date().toISOString()
        }).then(({error})=>{ if(error) console.warn('mailer_log insert:',error.message); });
      }
      save(); renderQueue();
      toast('📮 Drip Step '+item.drip_step+' auto-mailed to '+item.addr,'success');
    } else {
      item.status='failed'; save(); renderQueue();
      console.warn('[BidDrop] Drip send failed:', d.error?.message);
    }
  } catch(e){ item.status='failed'; save(); renderQueue(); console.warn('[BidDrop] Drip send error:',e); }
}

function processDripSchedule(){"""

if old_process_drip in content:
    content = content.replace(old_process_drip, new_process_drip, 1)
    print("PATCH C OK: autoFireDueDripSteps + sendDripPostcard added")
else:
    print("PATCH C FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# PATCH D: Call autoFireDueDripSteps in renderQueue after _processDripScheduleSync
# ══════════════════════════════════════════════════════════════════════════════
old_render_queue_start = "  // Agency model: Lob key loaded at login, not shown in UI\n  // Promote any scheduled drip items whose send date has passed\n  try{ _processDripScheduleSync(); }catch(e){}"
new_render_queue_start = """  // Agency model: Lob key loaded at login, not shown in UI
  // Promote any scheduled drip items whose send date has passed
  try{ _processDripScheduleSync(); }catch(e){}
  // Auto-fire any due drip steps (fire-and-forget, only when dripEnabled)
  if(S.cfg && S.cfg.dripEnabled) autoFireDueDripSteps().catch(e=>console.warn('[BidDrop] autoFire error:',e));"""

if old_render_queue_start in content:
    content = content.replace(old_render_queue_start, new_render_queue_start, 1)
    print("PATCH D OK: autoFireDueDripSteps called in renderQueue")
else:
    print("PATCH D FAIL")

with open('/home/ubuntu/biddrop/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("\nALL PATCHES DONE")
