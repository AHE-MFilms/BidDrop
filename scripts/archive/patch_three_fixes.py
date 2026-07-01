with open('/home/ubuntu/biddrop/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1: buildPostcardBackInline — replace hardcoded "Homeowner Name / 123 Main St"
# with parameters so the Follow-Up tab can pass real data when previewing
# ══════════════════════════════════════════════════════════════════════════════

old_inline_sig = "function buildPostcardBackInline({ fromName, fromAddr, fromCity, fromPhone, logoUrl }){"
new_inline_sig = "function buildPostcardBackInline({ fromName, fromAddr, fromCity, fromPhone, logoUrl, toName, toAddr }){"

if old_inline_sig in content:
    content = content.replace(old_inline_sig, new_inline_sig, 1)
    print("FIX 1a OK: buildPostcardBackInline signature updated")
else:
    print("FIX 1a FAIL")

old_inline_body = """      <div style="font-size:11px;line-height:1.7;color:#111;">
        <div style="font-weight:700;font-size:12px;margin-bottom:4px;">Homeowner Name</div>
        <div style="border-top:1px solid #eee;margin-bottom:5px;"></div>
        <div>123 Main Street</div>
        <div>City, State 00000</div>
      </div>"""

new_inline_body = """      <div style="font-size:11px;line-height:1.7;color:#111;">
        <div style="font-weight:700;font-size:12px;margin-bottom:4px;">\${toName||'Homeowner Name'}</div>
        <div style="border-top:1px solid #eee;margin-bottom:5px;"></div>
        \${(toAddr||'123 Main Street, City, State 00000').split(',').map(l=>'<div>'+l.trim()+'</div>').join('')}
      </div>"""

if old_inline_body in content:
    content = content.replace(old_inline_body, new_inline_body, 1)
    print("FIX 1b OK: buildPostcardBackInline body uses real toName/toAddr")
else:
    print("FIX 1b FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 1c: renderFollowUpTab — pass a sample homeowner name/address so the
# preview tab shows realistic data (uses first estimate in S.estimates if available)
# ══════════════════════════════════════════════════════════════════════════════

old_render_back = "    const backHtml = buildPostcardBackInline({ fromName, fromAddr, fromCity, fromPhone, logoUrl });"
new_render_back = """    // Use first estimate as sample data for the preview, or generic placeholder
    const sampleEst = (S.estimates||[]).find(e=>!e.isRevision && !e.deleted);
    const previewToName = sampleEst ? (sampleEst.owner||'Sample Homeowner') : 'Sample Homeowner';
    const previewToAddr = sampleEst ? (sampleEst.addr||'123 Main Street, Canton, MI 48188') : '123 Main Street, Canton, MI 48188';
    const backHtml = buildPostcardBackInline({ fromName, fromAddr, fromCity, fromPhone, logoUrl, toName: previewToName, toAddr: previewToAddr });"""

if old_render_back in content:
    content = content.replace(old_render_back, new_render_back, 1)
    print("FIX 1c OK: renderFollowUpTab passes real sample data to back preview")
else:
    print("FIX 1c FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 2: Add ghlAddNoteToContact function for logging drip activity
# Insert after ghlSendEmail function
# ══════════════════════════════════════════════════════════════════════════════

old_after_ghl_email = "async function sendViaGHL(){"
new_ghl_note_fn = """// Add a note to a GHL contact by address lookup
async function ghlAddDripNote(ownerName, address, stepNum, mailedAt){
  if(!S.cfg.ghlApiKey && !S.cfg.ghlLocationId) return;
  try {
    // Find contact by address
    const locationId = S.cfg.ghlLocationId || 'gz85VU6SxGXS7lqHAQGx';
    const search = await ghlRequest('/contacts/?locationId='+locationId+'&query='+encodeURIComponent(address));
    const contacts = search.contacts || [];
    if(!contacts.length){ console.log('[GHL] No contact found for drip note:', address); return; }
    const contactId = contacts[0].id;
    const stepNames = {2:'Follow-Up (Day 7)',3:'Urgency (Day 14)',4:'Final (Day 35)'};
    const stepLabel = stepNames[stepNum] || 'Step '+stepNum;
    const dateStr = mailedAt ? new Date(mailedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const noteBody = '📮 BidDrop Drip — '+stepLabel+' postcard mailed on '+dateStr+'. Address: '+address;
    await ghlRequest('/contacts/'+contactId+'/notes', 'POST', { body: noteBody, userId: contactId });
    console.log('[GHL] Drip note added for', address, 'step', stepNum);
  } catch(e){ console.warn('[GHL] Failed to add drip note:', e.message); }
}

async function sendViaGHL(){"""

if old_after_ghl_email in content:
    content = content.replace(old_after_ghl_email, new_ghl_note_fn, 1)
    print("FIX 2 OK: ghlAddDripNote function added")
else:
    print("FIX 2 FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 3: Call ghlAddDripNote after successful drip postcard send in sendDripPostcard
# ══════════════════════════════════════════════════════════════════════════════

old_after_send_success = "      save(); renderQueue();\n      toast('📮 Drip Step '+item.drip_step+' auto-mailed to '+item.addr,'success');"
new_after_send_success = """      save(); renderQueue();
      toast('📮 Drip Step '+item.drip_step+' auto-mailed to '+item.addr,'success');
      // Sync to GHL contact timeline (fire-and-forget)
      ghlAddDripNote(item.owner, item.addr, item.drip_step, item.mailedAt).catch(e=>console.warn('[GHL drip note]',e));"""

if old_after_send_success in content:
    content = content.replace(old_after_send_success, new_after_send_success, 1)
    print("FIX 3 OK: GHL note added after drip send")
else:
    print("FIX 3 FAIL")

# ══════════════════════════════════════════════════════════════════════════════
# FIX 4: Also call ghlAddDripNote when a rep manually sends a drip item via sendLob
# Find the sendLob success block and add GHL note for drip items
# ══════════════════════════════════════════════════════════════════════════════

old_sendlob_success = "      addAct('Estimate mailed to <strong>'+escHtml(item.owner)+'</strong> at <strong>'+escHtml(item.addr)+'</strong>','converted');"
new_sendlob_success = """      addAct('Estimate mailed to <strong>'+escHtml(item.owner)+'</strong> at <strong>'+escHtml(item.addr)+'</strong>','converted');
      // If this is a drip step, log it to GHL contact timeline
      if(item.drip_step) ghlAddDripNote(item.owner, item.addr, item.drip_step, item.mailedAt).catch(e=>console.warn('[GHL drip note]',e));"""

if old_sendlob_success in content:
    content = content.replace(old_sendlob_success, new_sendlob_success, 1)
    print("FIX 4 OK: GHL note added for manual drip sends via sendLob")
else:
    print("FIX 4 FAIL")

with open('/home/ubuntu/biddrop/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("\nAll patches written.")
