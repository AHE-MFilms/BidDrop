// BidDrop Drip Scheduler — Supabase Edge Function
// Runs on a cron schedule (every hour) to auto-fire postcard drip steps
// that are past their scheduled_send_at date.
//
// Deploy: supabase functions deploy drip-scheduler --no-verify-jwt
// Schedule: set in Supabase Dashboard → Edge Functions → Schedules → "0 * * * *"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const LOB_KEY      = Deno.env.get('LOB_MASTER_KEY') || '';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAddr(addr: string) {
  const parts = addr.split(',').map((s: string) => s.trim());
  let state = parts[2] || 'MI';
  let zip   = parts[3] || '00000';
  if (!zip && state.includes(' ')) {
    const sp = state.split(' ');
    zip   = sp.pop()!;
    state = sp.join(' ');
  }
  return { line1: parts[0] || '', city: parts[1] || '', state, zip };
}

function buildPostcardBack(opts: {
  toName: string; toAddr: string;
  fromName: string; fromAddr: string; fromPhone: string; logoUrl: string;
}): string {
  const toLines = opts.toAddr.split(',').map((l: string) => `<div>${l.trim()}</div>`).join('');
  const fromLines = opts.fromAddr.split(',').map((l: string) => `<div style="font-size:9px;color:#555;">${l.trim()}</div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:6in;height:4in;font-family:Arial,sans-serif;display:flex;padding:0.25in;}
  .left{flex:1.4;display:flex;flex-direction:column;justify-content:space-between;border-right:1px dashed #bbb;padding-right:0.2in;overflow:hidden;}
  .right{flex:1;display:flex;flex-direction:column;justify-content:space-between;padding-left:0.2in;overflow:hidden;}
  .postage{border:1px solid #444;padding:6px 10px;text-align:center;font-size:7pt;color:#333;line-height:1.5;align-self:flex-end;}
  .postage strong{display:block;font-size:9pt;letter-spacing:.3px;}
  .to-name{font-weight:700;font-size:11pt;margin-bottom:4px;}
  .barcode{font-size:6pt;color:#ccc;letter-spacing:2px;text-align:center;}
</style>
</head><body>
  <div class="left">
    <div>
      ${opts.logoUrl ? `<img src="${opts.logoUrl}" style="max-width:100px;max-height:36px;object-fit:contain;display:block;margin-bottom:8px;">` : ''}
      <div style="font-weight:700;font-size:10pt;">${opts.fromName}</div>
      ${fromLines}
      ${opts.fromPhone ? `<div style="font-size:9px;color:#555;">${opts.fromPhone}</div>` : ''}
    </div>
    <div class="barcode">|||||||||||||||||||||||||||||||||||||</div>
  </div>
  <div class="right">
    <div class="postage"><strong>PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000</div>
    <div>
      <div class="to-name">${opts.toName}</div>
      <hr style="border:none;border-top:1px solid #eee;margin-bottom:5px;">
      ${toLines}
    </div>
    <div class="barcode">DELIVERY POINT BARCODE</div>
  </div>
</body></html>`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const now = new Date().toISOString();
  console.log('[drip-scheduler] Running at', now);

  // 1. Fetch all accounts that have drip enabled and a Lob key
  const { data: accounts, error: acctErr } = await sb
    .from('accounts')
    .select('id, config, lob_key');

  if (acctErr) {
    console.error('[drip-scheduler] Failed to fetch accounts:', acctErr.message);
    return new Response(JSON.stringify({ error: acctErr.message }), { status: 500 });
  }

  let fired = 0;
  let skipped = 0;

  for (const account of (accounts || [])) {
    const cfg = account.config || {};
    if (!cfg.dripEnabled) { skipped++; continue; }

    const lobKey = account.lob_key || LOB_KEY;
    if (!lobKey) { skipped++; continue; }

    // 2. Fetch all scheduled/pending drip queue items for this account
    const { data: queueItems, error: qErr } = await sb
      .from('queue')
      .select('*')
      .eq('account_id', account.id)
      .in('status', ['scheduled', 'pending'])
      .not('drip_step', 'is', null);

    if (qErr) { console.warn('[drip-scheduler] Queue fetch error:', qErr.message); continue; }

    for (const item of (queueItems || [])) {
      // Only fire items whose scheduled_send_at has passed
      if (!item.scheduled_send_at || new Date(item.scheduled_send_at) > new Date()) continue;
      if (item.status === 'sent') continue;

      const stepNum = item.drip_step;
      const frontUrl = cfg[`postcardStep${stepNum}`];
      if (!frontUrl) {
        console.log(`[drip-scheduler] No postcard design for step ${stepNum}, account ${account.id} — skipping`);
        skipped++;
        continue;
      }

      // Build address parts
      const to = parseAddr(item.addr || '');
      const fromRaw = cfg.companyAddress || cfg.companyAddr || '123 Main St, Detroit, MI, 48000';
      const from = parseAddr(fromRaw);

      const backHtml = buildPostcardBack({
        toName:   item.owner || 'Homeowner',
        toAddr:   item.addr  || '',
        fromName: cfg.companyName  || 'Your Roofing Co',
        fromAddr: fromRaw,
        fromPhone: cfg.companyPhone || cfg.phone || '',
        logoUrl:  cfg.logoData || ''
      });

      // 3. Send via Lob
      try {
        const lobRes = await fetch('https://api.lob.com/v1/postcards', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(lobKey + ':'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: `Drip Step ${stepNum} — ${item.addr}`,
            to: {
              name:          item.owner || 'Homeowner',
              address_line1: to.line1,
              address_city:  to.city,
              address_state: to.state,
              address_zip:   to.zip,
              address_country: 'US'
            },
            from: {
              name:          cfg.companyName || 'Your Roofing Co',
              address_line1: from.line1 || '123 Main St',
              address_city:  from.city  || 'Detroit',
              address_state: from.state || 'MI',
              address_zip:   from.zip   || '48000',
              address_country: 'US'
            },
            front: frontUrl,
            back:  backHtml,
            size:  '4x6'
          })
        });

        const lobData = await lobRes.json();

        if (lobRes.ok) {
          // 4. Update queue item as sent
          await sb.from('queue').update({
            status:    'sent',
            mailed_at: new Date().toISOString(),
            lob_id:    lobData.id
          }).eq('id', item.id);

          // 5. Insert mailer_log entry
          await sb.from('mailer_log').insert({
            account_id:    account.id,
            address:       item.addr,
            owner_name:    item.owner,
            estimate_total: item.total || 0,
            lob_id:        lobData.id,
            queue_item_id: item.id,
            company_name:  cfg.companyName || '',
            sent_at:       new Date().toISOString()
          });

          console.log(`[drip-scheduler] ✅ Fired drip step ${stepNum} for ${item.addr} (account ${account.id})`);
          fired++;
        } else {
          console.warn(`[drip-scheduler] ❌ Lob error for ${item.addr}:`, lobData.error?.message);
          await sb.from('queue').update({ status: 'failed' }).eq('id', item.id);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[drip-scheduler] Exception for ${item.addr}:`, msg);
        await sb.from('queue').update({ status: 'failed' }).eq('id', item.id);
      }
    }
  }

  const summary = { fired, skipped, ran_at: now };
  console.log('[drip-scheduler] Done:', summary);
  return new Response(JSON.stringify(summary), {
    headers: { 'Content-Type': 'application/json' }
  });
});
