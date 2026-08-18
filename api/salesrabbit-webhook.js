/**
 * SalesRabbit → BidDrop Lead Create webhook.
 * One-way import only: no credits, enrichment unlocks, mailers, GHL sync, or status automation.
 */
'use strict';
const crypto = require('crypto');
const { sbFetch } = require('./_admin-shared');

const rateBuckets = new Map();
function allowed(connectionId) {
  const now = Date.now();
  const b = rateBuckets.get(connectionId) || { started: now, count: 0 };
  if (now - b.started > 60000) { b.started = now; b.count = 0; }
  b.count += 1; rateBuckets.set(connectionId, b);
  return b.count <= 120;
}
function equalHash(secret, expected) {
  if (!secret || !expected) return false;
  const actual = crypto.createHash('sha256').update(secret).digest('hex');
  const a = Buffer.from(actual, 'utf8'), b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function enc(v) { return encodeURIComponent(String(v || '')); }
function clean(v, max = 500) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function leadAddress(lead) {
  const line1 = clean(lead.street1 || lead.address || lead.address1 || lead.street || '', 180);
  const line2 = clean(lead.street2 || lead.unit || '', 80);
  const locality = [clean(lead.city, 80), clean(lead.state || lead.stateRegion, 40), clean(lead.zip || lead.postalCode, 20)].filter(Boolean).join(', ');
  return [line1, line2, locality].filter(Boolean).join(', ');
}
function normalizedAddress(value) { return clean(value, 320).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  const connectionId = clean(req.query?.connection, 100);
  const token = clean(req.query?.token, 200);
  if (!connectionId || !token || !allowed(connectionId)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const accountR = await sbFetch(`accounts?salesrabbit_connection_id=eq.${enc(connectionId)}&salesrabbit_enabled=eq.true&select=id,created_by,salesrabbit_webhook_secret_hash&limit=1`);
    if (!accountR.ok) throw new Error('Connection lookup failed');
    const account = (await accountR.json())[0];
    if (!account || !equalHash(token, account.salesrabbit_webhook_secret_hash)) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const raw = req.body && typeof req.body === 'object' ? req.body : {};
    const lead = raw.data && typeof raw.data === 'object' ? raw.data : (raw.lead && typeof raw.lead === 'object' ? raw.lead : raw);
    const leadId = clean(lead.id || lead.leadId || lead.lead_id, 100);
    const lat = Number(lead.latitude ?? lead.lat);
    const lng = Number(lead.longitude ?? lead.lng ?? lead.lon);
    const address = leadAddress(lead);
    if (!leadId) { res.status(422).json({ error: 'SalesRabbit lead ID is required' }); return; }
    if (!address) { res.status(422).json({ error: 'SalesRabbit lead address is required' }); return; }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      res.status(422).json({ error: 'SalesRabbit lead must include a valid map location before it can be pinned in BidDrop' }); return;
    }

    const existingR = await sbFetch(`pins?account_id=eq.${enc(account.id)}&external_source=eq.salesrabbit&external_source_id=eq.${enc(leadId)}&select=id&limit=1`);
    if (!existingR.ok) throw new Error('Duplicate check failed');
    const existing = (await existingR.json())[0];
    if (existing) { res.status(200).json({ ok: true, result: 'duplicate_ignored', pinId: existing.id }); return; }

    // A rep can create a new SalesRabbit lead for a house already pinned directly
    // in BidDrop. Treat the same geocoded property as one record rather than making
    // a duplicate customer/property card.
    const latDelta = 0.00014;
    const lngDelta = 0.00014 / Math.max(0.2, Math.abs(Math.cos(lat * Math.PI / 180)));
    const nearbyR = await sbFetch(`pins?account_id=eq.${enc(account.id)}&lat=gte.${lat-latDelta}&lat=lte.${lat+latDelta}&lng=gte.${lng-lngDelta}&lng=lte.${lng+lngDelta}&select=id,address&limit=10`);
    if (!nearbyR.ok) throw new Error('Property duplicate check failed');
    const sameAddress = (await nearbyR.json()).find((pin) => normalizedAddress(pin.address) === normalizedAddress(address));
    if (sameAddress) { res.status(200).json({ ok: true, result: 'existing_property', pinId: sameAddress.id }); return; }

    const salesRabbitUserId = clean(lead.userId || lead.user_id || lead.ownerId || lead.owner_id, 100);
    let assignedProfile = null;
    if (salesRabbitUserId) {
      const assigneeR = await sbFetch(`user_profiles?account_id=eq.${enc(account.id)}&salesrabbit_user_id=eq.${enc(salesRabbitUserId)}&select=id,name&limit=1`);
      if (assigneeR.ok) assignedProfile = (await assigneeR.json())[0] || null;
    }
    let fallbackProfile = null;
    if (!assignedProfile && account.created_by) {
      const fallbackR = await sbFetch(`user_profiles?id=eq.${enc(account.created_by)}&account_id=eq.${enc(account.id)}&select=id,name&limit=1`);
      if (fallbackR.ok) fallbackProfile = (await fallbackR.json())[0] || null;
    }
    const assignee = assignedProfile || fallbackProfile;
    const importedStatus = clean(lead.status, 120);
    const sourceNote = `SalesRabbit import${importedStatus ? ` · SalesRabbit status: ${importedStatus}` : ''}${salesRabbitUserId && !assignedProfile ? ' · Team mapping needed' : ''}`;
    const note = [sourceNote, clean(lead.notes, 1000)].filter(Boolean).join('\n');
    const pinId = `sr_${connectionId.replace(/-/g, '').slice(0, 12)}_${leadId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 70)}`;
    const pin = {
      id: pinId,
      account_id: account.id,
      created_by: assignee?.id || account.created_by,
      rep_name: clean(assignee?.name || lead.userName || lead.ownerName || 'SalesRabbit Import', 140),
      lat, lng, address, status: 'pinned', notes: note,
      external_source: 'salesrabbit', external_source_id: leadId,
      source_metadata: {
        provider: 'salesrabbit', lead_id: leadId, lead_status: importedStatus || null,
        salesrabbit_user_id: salesRabbitUserId || null, assigned_to_bidrop_user_id: assignee?.id || null,
        imported_at: new Date().toISOString(), webhook_event: clean(raw.eventType || raw.event_type || raw.type || 'lead_create', 100)
      },
      updated_at: new Date().toISOString()
    };
    const insertR = await sbFetch('pins', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(pin) });
    if (insertR.status === 409) { res.status(200).json({ ok: true, result: 'duplicate_ignored' }); return; }
    if (!insertR.ok) { throw new Error(`Pin import failed (${insertR.status})`); }
    res.status(201).json({ ok: true, result: 'imported', pinId, assigned: !!assignedProfile });
  } catch (err) {
    console.error('[salesrabbit-webhook]', err.message);
    res.status(500).json({ error: 'Unable to import SalesRabbit lead' });
  }
};
