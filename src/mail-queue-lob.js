
function renderQueue(){
  // Agency model: Lob key loaded at login, not shown in UI
  // Promote any scheduled drip items whose send date has passed
  try{ _processDripScheduleSync(); }catch(e){}
  // Auto-fire any due drip steps (fire-and-forget, only when dripEnabled)
  if(S.cfg && S.cfg.dripEnabled) autoFireDueDripSteps().catch(e=>console.warn('[BidDrop] autoFire error:',e));
  const tbody=document.getElementById('q-tbody');
  const tbl=document.getElementById('q-table');
  const empty=document.getElementById('q-empty');
  if(!S.queue.length){tbl.style.display='none';empty.style.display='block';if(typeof updateSidebarBadge==='function')updateSidebarBadge();return;}
  tbl.style.display='table';empty.style.display='none';
  // Sort all items by date
  const sortedQueue = _sortList([...S.queue], _qSort.col, _qSort.dir);
  _updateQSortArrows();

  // Group by address for numbered campaign view
  const _addrOrder = [];
  const _byAddr = {};
  sortedQueue.forEach(function(i){
    if(i.status !== 'sent'){
      const liveEst = (S.estimates||[]).find(function(e){
        return (i.estId && e.id===i.estId) ||
               (i.pinId && e.pinId===i.pinId) ||
               (e.addr||'').trim().toLowerCase()===(i.addr||'').trim().toLowerCase();
      });
      if(liveEst){
        i.total = liveEst.total || i.total;
        i.owner = liveEst.owner || i.owner;
        i.structures = liveEst.structures || i.structures;
        const ms = (liveEst.structures||[])[0]||{};
        const mm={'1.0':'3-Tab Shingle','1.3':'Architectural Shingle','1.8':'Designer Shingle','2.5':'Metal Roofing'};
        i.mat = mm[ms.material] || ms.material || i.mat;
      }
    }
    const key = (i.addr||'').trim().toLowerCase();
    if(!_byAddr[key]){ _byAddr[key] = []; _addrOrder.push(key); }
    _byAddr[key].push(i);
  });

  var rows = [];
  _addrOrder.forEach(function(addrKey){
    const items = _byAddr[addrKey];
    const firstItem = items[0];
    const shortAddr = (firstItem.addr||'').split(',')[0];
    const cityState = (firstItem.addr||'').split(',').slice(1).join(',').trim();
    const hasMultiple = items.length > 1;

    if(hasMultiple){
      rows.push(
        '<tr style="background:rgba(255,255,255,.03);border-top:2px solid var(--border);">'+
        '<td colspan="8" style="padding:8px 12px;">'+
        '<span style="font-size:12px;font-weight:700;color:var(--text);">'+escHtml(shortAddr)+'</span>'+
        '<span style="font-size:11px;color:var(--muted);margin-left:6px;">'+escHtml(cityState)+'</span>'+
        '<span style="font-size:10px;color:var(--accent);margin-left:10px;font-weight:600;">'+items.length+' campaigns</span>'+
        '</td></tr>'
      );
    }

    items.forEach(function(i, idx){
      const sc={pending:'#F59E0B',sent:'#22C55E',failed:'#EF4444',needs_approval:'#A78BFA',approved:'#38BDF8'}[i.status]||'#3D5269';
      const sl={pending:'Pending',sent:'Mailed &#10003;',failed:'Failed',needs_approval:'Needs Approval',approved:'Approved'}[i.status]||i.status;
      const qid = i.id;
      const sendN = i.send_num || (idx + 1);
      const campLabel = i.campaign_label || (sendN === 1 ? 'Free Postcard' : 'Campaign ' + sendN);
      const campBadge = '<span style="font-size:9px;font-weight:700;background:rgba(249,115,22,.15);color:#F97316;border:1px solid rgba(249,115,22,.3);border-radius:10px;padding:1px 7px;white-space:nowrap;">#'+sendN+' '+escHtml(campLabel)+'</span>';

      rows.push('<tr style="border-bottom:1px solid var(--border);">'+
        '<td style="text-align:center;'+(hasMultiple?'padding-left:20px;':'')+'"><input type="checkbox" class="q-row-cb" data-id="'+escHtml(qid)+'" onchange="updateQueueBulkBar()" style="cursor:pointer;width:16px;height:16px;accent-color:var(--accent);"></td>'+
        '<td style="font-weight:600;">'+escHtml(i.owner)+'<br>'+campBadge+(i.drip_step?'<br><span style="font-size:9px;background:#7C3AED22;color:#C4B5FD;border:1px solid #7C3AED44;border-radius:10px;padding:1px 6px;font-weight:700;">&#128232; Drip Step '+i.drip_step+'</span>':'')+'</td>'+
        '<td style="color:var(--mid);font-size:11px;">'+(hasMultiple?'':escHtml(i.addr))+(i.drip_step && S.cfg && S.cfg['postcardStep'+i.drip_step] ? '<br><img src="'+S.cfg['postcardStep'+i.drip_step]+'" style="width:60px;height:40px;object-fit:cover;border-radius:4px;margin-top:3px;border:1px solid var(--border);" title="Postcard front preview">' : '')+'</td>'+
        '<td style="font-family:var(--font-m);color:var(--accent);font-weight:600;">'+(i.total?'$'+i.total.toLocaleString():'&mdash;')+'</td>'+
        '<td style="font-size:11px;color:var(--mid);">'+escHtml(i.mat||'&mdash;')+'</td>'+
        '<td style="font-family:var(--font-m);font-size:10px;color:var(--muted);">'+fmtDate(i.at)+'</td>'+
        '<td><span class="spill" style="background:'+sc+'22;color:'+sc+';border:1px solid '+sc+'44;">'+sl+'</span></td>'+
        '<td style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">'+
        (i.status==='needs_approval'?'<button class="btn-xs" data-id="'+qid+'" onclick="approveQueueItem(this.dataset.id)" style="background:#7C3AED;border-color:#7C3AED;color:#fff;">&#10003; Approve</button>':'')+
        ((i.status==='pending'||i.status==='approved') && S.cfg.enablePostcard!==false?'<button class="btn-xs" data-id="'+qid+'" onclick="openSendPostcardModal(this.dataset.id)" style="background:#0e7490;border-color:#0e7490;color:#fff;" title="Send postcard">&#128236; Send Postcard</button>':'')+
        (i.status==='sent'?'<span style="font-size:10px;color:var(--muted);">'+fmtDate(i.mailedAt)+'</span>':'')+
        (i.status==='failed' && S.cfg.enablePostcard!==false?'<button class="btn-xs" data-id="'+qid+'" onclick="sendLobPostcard6x9(this.dataset.id)" style="background:#0e7490;border-color:#0e7490;color:#fff;">Retry Card</button>':'')+
        (i.status==='pending'?'<button class="btn-xs" data-id="'+qid+'" onclick="editEstimate(this.dataset.id)">&#9999;&#65039; Edit</button>':'')+
        '<button class="btn-xs" data-id="'+qid+'" onclick="previewQueueItem(this.dataset.id)">Preview Letter</button>'+
        '<button class="btn-xs" data-id="'+qid+'" onclick="previewPostcard6x9(this.dataset.id)" style="background:#0e749022;border-color:#0e7490;color:#0e7490;" title="Preview postcard front & back">Preview Card</button>'+
        '<button class="btn-xs danger" data-id="'+qid+'" onclick="rmQ(this.dataset.id)" title="Delete">&#128465; Delete</button>'+
        '</td></tr>'
      );
    });
  });
  tbody.innerHTML = rows.join('');
  // Sync sidebar queue badge
  if(typeof updateSidebarBadge === 'function') updateSidebarBadge();
}

// ── Convert full US state name to 2-letter abbreviation ─────────────────────
function toStateAbbr(s){
  if(!s) return s;
  const map={'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY'};
  const abbr = map[s.trim().toLowerCase()];
  return abbr || s.trim();
}

async function sendLob(id){
  const item=S.queue.find(x=>x.id===id);if(!item)return;
  // Agency model: always use master Lob key loaded at login
  // If not yet loaded (e.g. initial fetch failed), retry once
  if(!masterLobKey){
    toast('Checking mailer service…','info');
    await fetchMasterLobKey();
  }
  if(!masterLobKey){toast('Mailer service not configured — contact your administrator','error');return;}
  const co=S.cfg.companyName||'Your Roofing Co';
  const fromRaw=S.cfg.companyAddr||'123 Main St, Detroit, MI, 48000';
  const fp=fromRaw.split(',').map(s=>s.trim());
  const tp=item.addr.split(',').map(s=>s.trim());
  // Parse recipient address parts (handle 'line1, city, state, zip' or 'line1, city, state zip')
  const toLine1 = tp[0]||'';
  const toCity  = tp[1]||'';
  let   toState = tp[2]||'MI';
  let   toZip   = tp[3]||'';
  // Handle 'State Zip' in one field (e.g. 'Michigan 48188' when address has no 4th comma)
  if((!toZip || toZip==='00000') && toState && toState.includes(' ')){
    const parts=toState.split(' ');
    toZip=parts.pop();
    toState=parts.join(' ');
  }
  if(!toZip) toZip='00000';
  toState = toStateAbbr(toState);
  const fileHtml = buildLobMailerHtml(item);
  toast('Sending direct mail…','info');
  try{
    // Send via secure server-side proxy — Lob key never exposed in browser
    const d = await adminAPI('lob-letter', { payload: {
      description:'Roof Bid — '+item.addr,
      to:{name:item.owner,address_line1:toLine1,address_city:toCity,address_state:toState,address_zip:toZip,address_country:'US'},
      from:{name:co,address_line1:fp[0]||'123 Main St',address_city:fp[1]||'Detroit',address_state:fp[2]||'MI',address_zip:fp[3]||'48000',address_country:'US'},
      file: fileHtml,
      color: true,
      double_sided: false,
      address_placement: 'insert_blank_page',
      use_type: 'marketing'
    }});
    if(d && d.error === 'no_credits'){
      // Not enough credits — show Buy Credits modal
      toast('Not enough credits to send a letter (1 credit = $4.00). Please purchase more credits.','error');
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; }
      updateCreditBadge();
      setTimeout(()=>showBuyCreditsModal(), 800);
      return;
    }
    if(d && d.id){
      item.status='sent';item.mailedAt=new Date().toISOString();item.lobId=d.id;
      sbSaveQueueItem(item).catch(e=>console.warn('Queue save:',e));
      // Auto-unlock print for the linked estimate (free reprint since mailer was sent)
      _unlockPrintForEstimate(item.estId);
      // Update credit badge with new balance
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; updateCreditBadge(); }
      addAct('Bid letter mailed to <strong>'+escHtml(item.addr)+'</strong>','mailed');
      // If this is a drip step, log it to GHL contact timeline
      if(item.drip_step) ghlAddDripNote(item.owner, item.addr, item.drip_step, item.mailedAt).catch(e=>console.warn('[GHL drip note]',e));
      // Auto-advance the linked pin to 'mailed'
      if(typeof autoAdvancePinByAddress === 'function') autoAdvancePinByAddress(item.addr, 'mailed');
      if((item.pinId||item.pin_id) && typeof autoAdvancePinStatus === 'function'){
        const qPin = (S.pins||[]).find(p=>p.id===(item.pinId||item.pin_id));
        if(qPin) autoAdvancePinStatus(qPin, 'mailed');
      }
      // Log to mailer_log for agency billing
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
          mailer_type: 'letter',
          sent_at: new Date().toISOString()
        }).then(({error})=>{ if(error) console.warn('mailer_log insert error:',error.message); });
        // Also mark the linked estimate as sent so the badge shows in the Estimates list
        if(item.estId){
          const sentNow = new Date().toISOString();
          const estIdx = (S.estimates||[]).findIndex(e=>e.id===item.estId);
          if(estIdx>=0){ S.estimates[estIdx].sentAt = sentNow; }
          sb.from('estimates').update({sent_at:sentNow}).eq('id',item.estId).then(({error})=>{if(error)console.warn('estimate sent_at:',error.message);});
        }
      }
      save();renderQueue();toast('✅ Letter queued for mailing!','success');
    } else {
      item.status='failed';save();renderQueue();toast('Mail error: '+(d.error?.message||'Check mail settings & address'),'error');
    }
  } catch(e){item.status='failed';save();renderQueue();toast('Network error — mailer service unavailable','error');}
}

// ─────────────────────────────────────────────────────────────────────────────
//  6×9 Postcard — Front & Back HTML builders + send function
// ─────────────────────────────────────────────────────────────────────────────
async function sendLobPostcard6x9(id){
  const item=S.queue.find(x=>x.id===id);if(!item)return;
  if(!masterLobKey){
    toast('Checking mailer service…','info');
    await fetchMasterLobKey();
  }
  if(!masterLobKey){toast('Mailer service not configured — contact your administrator','error');return;}
  const co=S.cfg.companyName||'Your Roofing Co';
  const fromRaw=S.cfg.companyAddr||'123 Main St, Detroit, MI, 48000';
  const fp=fromRaw.split(',').map(s=>s.trim());
  // Parse recipient address
  const tp=item.addr.split(',').map(s=>s.trim());
  const toLine1=tp[0]||'';
  const toCity=tp[1]||'';
  let toState=tp[2]||'MI';
  let toZip=tp[3]||'';
  if((!toZip||toZip==='00000')&&toState&&toState.includes(' ')){
    const parts=toState.split(' ');toZip=parts.pop();toState=parts.join(' ');
  }
  if(!toZip)toZip='00000';
  toState=toStateAbbr(toState);
  // Parse from address — handle 'City State Zip' in one field (e.g. 'Detroit MI 48227')
  let fromCity=fp[1]||'Detroit';
  let fromState=fp[2]||'MI';
  let fromZip=fp[3]||'';
  if((!fromZip||fromZip==='00000')&&fromState&&fromState.includes(' ')){
    const parts=fromState.split(' ');fromZip=parts.pop();fromState=parts.join(' ');
  }
  if(!fromZip)fromZip='48000';
  fromState=toStateAbbr(fromState);
  // Build a synthetic item with all config fields for the canvas builders
  // Merge design backOverrides if rep selected a custom design in the Send Postcard modal
  const _backOvr = item._sendBackOverrides || {};
  const syntheticItem=Object.assign({},item,{
    companyName:co,companyAddr:fromRaw,companyPhone:S.cfg.companyPhone||'',
    logoData:S.cfg.logoData||'',headshotData:S.cfg.headshotData||'',
    repName:S.cfg.repName||'',repTitle:S.cfg.repTitle||'',
    pcHook:_backOvr.postcardHook||S.cfg.pcHook||'',
    pcWhy:_backOvr.postcardWhy||S.cfg.pcWhy||'',
    pcQuote:_backOvr.postcardQuote||S.cfg.pcQuote||'',
    pcGuarantee:_backOvr.postcardGuarantee||S.cfg.pcGuarantee||'',
    postcardBackBadgeText:_backOvr.postcardBackBadgeText||S.cfg.postcardBackBadgeText||'',
    postcardBackBadgeColor:_backOvr.postcardBackBadgeColor||S.cfg.postcardBackBadgeColor||'',
    postcardScanCta:_backOvr.postcardScanCta||S.cfg.postcardScanCta||'',
    postcardScanSub:_backOvr.postcardScanSub||S.cfg.postcardScanSub||'',
    diff1:S.cfg.diff1||'',diff2:S.cfg.diff2||'',diff3:S.cfg.diff3||'',
    diff4:S.cfg.diff4||'',diff5:S.cfg.diff5||'',diff6:S.cfg.diff6||'',
    yrsInBusiness:S.cfg.yrsInBusiness||'',warrantyYrs:S.cfg.warrantyYrs||'',
    finEnabled:S.cfg.finEnabled,finApr:S.cfg.finApr,finTerm:S.cfg.finTerm,finDown:S.cfg.finDown,
    bookingUrl:S.cfg.bookingUrl||''
  });
  // If a custom design front URL is set, override photo_url for the front render
  if(item._sendDesignUrl) syntheticItem._customFrontUrl = item._sendDesignUrl;
  toast('Rendering postcard images…','info');
  // Render front & back to JPEG via canvas, upload to Supabase, send URLs to Lob
  let frontUrl, backUrl;
  try{
    const ts=Date.now();
    const acctId=(currentAccount&&currentAccount.id)||'shared';
    // Determine back renderer: custom uploaded back vs standard BidDrop back
    const _customBackUrl = item._sendDesignBackUrl || null;
    const backRenderFn = _customBackUrl
      ? () => renderCustomBackCanvas(_customBackUrl, S.cfg||{})
      : () => renderPostcard6x9BackCanvas(syntheticItem);
    const [fDataUrl,bDataUrl]=await Promise.all([
      renderFrontCanvasForDesign(syntheticItem),
      backRenderFn()
    ]);
    if(!fDataUrl||!bDataUrl){toast('Failed to render postcard images','error');return;}
    // Upload both JPEGs via server-side API
    const session=await sb.auth.getSession();
    const jwt=session?.data?.session?.access_token;
    const uploadJpeg=async(dataUrl,name)=>{
      const resp=await fetch('/api/admin?action=upload-photo',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+jwt},
        body:JSON.stringify({path:acctId+'/postcards/'+name,dataUrl,mimeType:'image/jpeg'})
      });
      if(!resp.ok)throw new Error('Upload failed: '+resp.status);
      const r=await resp.json();
      return r.url;
    };
    [frontUrl,backUrl]=await Promise.all([
      uploadJpeg(fDataUrl,'front_'+ts+'.jpg'),
      uploadJpeg(bDataUrl,'back_'+ts+'.jpg')
    ]);
    if(!frontUrl||!backUrl){toast('Failed to upload postcard images','error');return;}
  }catch(renderErr){
    toast('Postcard render error: '+renderErr.message,'error');
    return;
  }
  toast('Sending postcard…','info');
  try{
    // paid_by_unlock: postcard was pre-paid when the pin was unlocked — no additional credit charge
    // Fallback: also check item.id prefix in case source column hasn't propagated yet
    const isPaidByUnlock = item.source === 'unlock' || (item.id && item.id.startsWith('mq_unlock_'));
    // blitz_prepaid: all credits were deducted upfront at Blitz start — skip per-postcard charge
    const isBlitzPrepaid = !!(item.blitz_prepaid);
    const d=await adminAPI('lob-postcard',{payload:{
      description:'Roof Bid Postcard — '+item.addr,
      to:{name:item.owner||'Homeowner',address_line1:toLine1,address_city:toCity,address_state:toState,address_zip:toZip,address_country:'US'},
      from:{name:co,address_line1:fp[0]||'123 Main St',address_city:fromCity,address_state:fromState,address_zip:fromZip,address_country:'US'},
      front:frontUrl,
      back:backUrl,
      size:'6x9',
      use_type:'marketing'
    }, paid_by_unlock: isPaidByUnlock, blitz_prepaid: isBlitzPrepaid});
    if(d&&d.error==='no_credits'){
      toast('Not enough credits to send a postcard (1 credit = $4.00). Please purchase more credits.','error');
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; }
      updateCreditBadge();
      setTimeout(()=>showBuyCreditsModal(),800);
      return;
    }
    if(d&&d.id){
      item.status='sent';item.mailedAt=new Date().toISOString();item.lobId=d.id;
      sbSaveQueueItem(item).catch(e=>console.warn('Queue save:',e));
      // Auto-unlock print for the linked estimate
      _unlockPrintForEstimate(item.estId);
      if(d._credits){ S.cfg.mailerCredits = d._credits.paid_credits ?? S.cfg.mailerCredits; if(d._credits.free_used !== undefined) S.cfg.freeMailerCreditsUsed = d._credits.free_used; updateCreditBadge(); }
      addAct('6×9 postcard mailed to <strong>'+escHtml(item.addr)+'</strong>','mailed');
      if(currentAccount&&sb){
        sb.from('mailer_log').insert({
          account_id:currentAccount.id,
          sent_by:currentUser?.id||null,
          address:item.addr,
          owner_name:item.owner,
          estimate_total:item.total||0,
          lob_id:d.id,
          queue_item_id:item.id,
          company_name:S.cfg.companyName||'',
          mailer_type:'postcard',
          sent_at:new Date().toISOString()
        }).then(({error})=>{if(error)console.warn('mailer_log insert:',error.message);});
        // Also mark the linked estimate as sent so the badge shows in the Estimates list
        if(item.estId){
          const sentNow = new Date().toISOString();
          const estIdx = (S.estimates||[]).findIndex(e=>e.id===item.estId);
          if(estIdx>=0){ S.estimates[estIdx].sentAt = sentNow; }
          sb.from('estimates').update({sent_at:sentNow}).eq('id',item.estId).then(({error})=>{if(error)console.warn('estimate sent_at:',error.message);});
        }
      }
      save();renderQueue();toast('✅ Postcard queued for mailing!','success');
    } else {
      item.status='failed';save();renderQueue();
      const errMsg=typeof d?.error==='string'?d.error:(d?.error?.message||d?.error?.status_code||JSON.stringify(d?.error)||'Check mail settings & address');
      toast('Postcard error: '+errMsg,'error');
    }
  } catch(e){
    item.status='failed';save();renderQueue();
    const msg=typeof e?.message==='string'?e.message:(typeof e==='object'?JSON.stringify(e):String(e));
    toast('Postcard error: '+msg,'error');
  }}
// ─── Canvas-based JPEG renderers for Lob (no HTML renderer dependency) ───────
// Helper: load an image URL as an Image element (handles CORS)


