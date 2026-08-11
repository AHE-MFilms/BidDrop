/**
 * BidDrop Address Monitoring Cron
 *
 * Runs every 15 minutes. It reads the newest public NOAA MRMS MESHMax30min
 * swath directly, evaluates only cells around watched addresses in memory,
 * and writes to Supabase only when it sends an alert. Historical maps and
 * reports continue to use the separate daily 90-day MRMS history table.
 */

import zlib from 'zlib';
import { promisify } from 'util';

const inflate = promisify(zlib.inflate);
const gunzip = promisify(zlib.gunzip);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const NOAA_S3_BASE = 'https://noaa-mrms-pds.s3.amazonaws.com';
const NOAA_REALTIME_PREFIX = 'CONUS/MESH_Max_30min_00.50';
const WATCH_RADIUS_MILES = 3;
const ALERT_COOLDOWN_HOURS = 20;

async function supabaseFetch(path, opts = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(opts.headers || {}),
    },
  });
  if (response.status === 204 || response.headers.get('content-length') === '0') return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function distanceMiles(lat1, lon1, lat2, lon2) {
  const r = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getYmd(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function getNewestMmeshKey() {
  // Search today first, then the prior UTC day around midnight.
  for (let offset = 0; offset <= 1; offset++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - offset);
    const ymd = getYmd(day);
    const prefix = `${NOAA_REALTIME_PREFIX}/${ymd}/`;
    const url = `${NOAA_S3_BASE}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) continue;
    const xml = await response.text();
    const keys = Array.from(xml.matchAll(/<Key>(.*?)<\/Key>/g), m => m[1]).sort();
    if (keys.length) return keys[keys.length - 1];
  }
  return null;
}

async function downloadGrib2(s3Key) {
  const response = await fetch(`${NOAA_S3_BASE}/${s3Key}`, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`NOAA download failed: ${response.status}`);
  return gunzip(Buffer.from(await response.arrayBuffer()));
}

function parseGrib2Sections(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'GRIB' || buffer[7] !== 2) throw new Error('Expected a GRIB2 file');
  let offset = 16;
  const sections = {};
  while (offset < buffer.length - 4) {
    const length = buffer.readUInt32BE(offset);
    const number = buffer[offset + 4];
    sections[number] = buffer.slice(offset, offset + length);
    offset += length;
    if (number === 8) break;
  }
  const sec3 = sections[3];
  const sec5 = sections[5];
  const sec7 = sections[7];
  if (!sec3 || !sec5 || !sec7 || sec5.readUInt16BE(9) !== 41) throw new Error('Unsupported MRMS GRIB2 packing');
  return {
    ni: sec3.readUInt32BE(30),
    nj: sec3.readUInt32BE(34),
    la1: sec3.readInt32BE(46) / 1e6,
    lo1: sec3.readInt32BE(50) / 1e6,
    di: sec3.readUInt32BE(63) / 1e6,
    dj: sec3.readUInt32BE(67) / 1e6,
    refValue: sec5.readFloatBE(11),
    binaryScale: Math.pow(2, sec5.readInt16BE(15)),
    decimalScale: Math.pow(10, sec5.readInt16BE(17)),
    png: sec7.slice(5),
  };
}

function buildTargetCells(watched, grid) {
  const targets = new Map();
  // MESH grid is ~0.01°. Six cells safely covers a three-mile radius nationwide.
  const radiusCells = 6;
  for (const watch of watched) {
    const centerRow = Math.round((grid.la1 - watch.lat) / grid.dj);
    const rawLon = watch.lon < 0 ? watch.lon + 360 : watch.lon;
    const centerCol = Math.round((rawLon - grid.lo1) / grid.di);
    for (let row = centerRow - radiusCells; row <= centerRow + radiusCells; row++) {
      if (row < 0 || row >= grid.nj) continue;
      if (!targets.has(row)) targets.set(row, []);
      for (let col = centerCol - radiusCells; col <= centerCol + radiusCells; col++) {
        if (col < 0 || col >= grid.ni) continue;
        targets.get(row).push({ col, watch });
      }
    }
  }
  return targets;
}

// Decode only the grid cells near watched addresses. PNG scanline filters still
// require sequential rows, but this avoids storing or iterating the full CONUS grid.
async function findWatchedHail(grid, watched) {
  const png = grid.png;
  if (png.readUInt32BE(0) !== 0x89504e47 || png.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error('Invalid MRMS PNG data');
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.slice(offset + 4, offset + 8).toString('ascii');
    const data = png.slice(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (width !== grid.ni || height !== grid.nj || bitDepth !== 16) throw new Error('Unexpected MRMS MESH PNG dimensions');

  const raw = await inflate(Buffer.concat(idat));
  const bytesPerPixel = 2;
  const rowBytes = width * bytesPerPixel;
  const previous = new Uint8Array(rowBytes);
  const targets = buildTargetCells(watched, grid);
  const maxByWatch = new Map();

  for (let row = 0; row < height; row++) {
    const rowOffset = row * (rowBytes + 1);
    const filter = raw[rowOffset];
    const sourceStart = rowOffset + 1;
    const reconstructed = new Uint8Array(rowBytes);
    for (let byte = 0; byte < rowBytes; byte++) {
      const x = raw[sourceStart + byte];
      const left = byte >= bytesPerPixel ? reconstructed[byte - bytesPerPixel] : 0;
      const up = previous[byte];
      const upperLeft = byte >= bytesPerPixel ? previous[byte - bytesPerPixel] : 0;
      if (filter === 0) reconstructed[byte] = x;
      else if (filter === 1) reconstructed[byte] = (x + left) & 0xff;
      else if (filter === 2) reconstructed[byte] = (x + up) & 0xff;
      else if (filter === 3) reconstructed[byte] = (x + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upperLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upperLeft);
        reconstructed[byte] = (x + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft)) & 0xff;
      } else throw new Error(`Unknown PNG filter: ${filter}`);
    }

    const rowTargets = targets.get(row);
    if (rowTargets) {
      for (const target of rowTargets) {
        const index = target.col * 2;
        const packed = (reconstructed[index] << 8) | reconstructed[index + 1];
        const hailIn = (grid.refValue + packed * grid.binaryScale) / grid.decimalScale / 25.4;
        if (hailIn < target.watch.minSize) continue;
        const cellLat = grid.la1 - row * grid.dj;
        const rawLon = grid.lo1 + target.col * grid.di;
        const cellLon = rawLon > 180 ? rawLon - 360 : rawLon;
        if (distanceMiles(target.watch.lat, target.watch.lon, cellLat, cellLon) > WATCH_RADIUS_MILES) continue;
        maxByWatch.set(target.watch.id, Math.max(maxByWatch.get(target.watch.id) || 0, hailIn));
      }
    }
    previous.set(reconstructed);
  }
  return maxByWatch;
}

function hailCategory(size) {
  if (size >= 2.75) return 'Baseball+';
  if (size >= 1.75) return 'Baseball';
  if (size >= 1.0) return 'Golf Ball';
  return 'Quarter';
}

function buildAddressAlertEmail({ address, label, hailSize, frameTime, company }) {
  const displayAddress = label ? `${label} — ${address}` : address;
  const category = hailCategory(hailSize);
  return `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:#111827;padding:20px 24px;color:#fff;"><div style="font-size:17px;font-weight:800;color:#a5b4fc;">📍 ADDRESS HAIL ALERT</div><div style="font-size:12px;color:#9ca3af;margin-top:3px;">${company} · BidDrop Address Monitoring</div></div>
      <div style="padding:22px 24px;"><p style="font-size:15px;font-weight:700;margin:0 0 10px;">Hail detected at a monitored address.</p><p style="font-size:13px;line-height:1.55;background:#f3f4f6;border-radius:8px;padding:10px 12px;margin:0 0 16px;">📍 <b>${displayAddress}</b></p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:48%;padding:13px 8px;background:#fef3c7;border-radius:8px;text-align:center;"><div style="font-size:25px;font-weight:800;color:#d97706;">${hailSize.toFixed(2)}&quot;</div><div style="font-size:10px;font-weight:700;color:#92400e;margin-top:4px;letter-spacing:.05em;">MAX HAIL</div></td><td style="width:8px;"></td><td style="width:48%;padding:13px 8px;background:#ede9fe;border-radius:8px;text-align:center;"><div style="font-size:19px;font-weight:800;color:#6d28d9;">${category}</div><div style="font-size:10px;font-weight:700;color:#5b21b6;margin-top:4px;letter-spacing:.05em;">CATEGORY</div></td></tr></table>
      <p style="font-size:12px;line-height:1.6;color:#4b5563;margin:18px 0;">BidDrop checked the latest NOAA MRMS 30-minute hail swath, timestamped <b>${frameTime}</b>, and found hail within ${WATCH_RADIUS_MILES} miles of this monitored address.</p>
      <div style="text-align:center;"><a href="https://biddrop.us" style="display:inline-block;background:#818cf8;color:#fff;text-decoration:none;border-radius:8px;padding:13px 24px;font-size:14px;font-weight:700;">Open BidDrop → View Storm Map</a></div></div>
      <div style="padding:13px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">You are receiving this because Address Monitoring is enabled for ${company}.</div>
    </div></body></html>`;
}

export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!CRON_SECRET || (token !== CRON_SECRET && req.query.secret !== CRON_SECRET)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const watchedRows = await supabaseFetch('watched_addresses?alert_enabled=eq.true&select=id,account_id,address,label,lat,lon,min_hail_size,last_alert_sent_at');
    if (!watchedRows?.length) return res.status(200).json({ message: 'No active watched addresses' });

    const accountIds = [...new Set(watchedRows.map(row => row.account_id).filter(Boolean))];
    const accountRows = await supabaseFetch(`accounts?id=in.(${accountIds.join(',')})&select=id,name,plan`);
    const accounts = new Map((accountRows || []).filter(row => ['monthly', 'omnipresent'].includes(row.plan)).map(row => [row.id, row]));
    const watched = watchedRows.map(row => ({ ...row, minSize: Number(row.min_hail_size || 1.0) })).filter(row => accounts.has(row.account_id));
    if (!watched.length) return res.status(200).json({ message: 'No active Monthly or Omnipresent monitored addresses' });

    const latestKey = await getNewestMmeshKey();
    if (!latestKey) return res.status(200).json({ message: 'No current NOAA MESHMax30min file available' });
    const match = latestKey.match(/(\d{8})-(\d{6})\.grib2/);
    const frameTime = match ? `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)} ${match[2].slice(0, 2)}:${match[2].slice(2, 4)} UTC` : 'latest available frame';

    const grid = parseGrib2Sections(await downloadGrib2(latestKey));
    const maxHailByWatch = await findWatchedHail(grid, watched);
    const now = new Date();
    const alerts = [];

    const qualifying = watched.filter(watch => {
      const hail = maxHailByWatch.get(watch.id);
      if (!hail) return false;
      if (!watch.last_alert_sent_at) return true;
      return (now - new Date(watch.last_alert_sent_at)) / 3600000 >= ALERT_COOLDOWN_HOURS;
    });
    if (!qualifying.length) return res.status(200).json({ frame: latestKey, watched_count: watched.length, alerts_sent: 0, message: 'No new qualifying address alerts' });

    const profileRows = await supabaseFetch(`user_profiles?account_id=in.(${[...new Set(qualifying.map(w => w.account_id))].join(',')})&role=in.(admin,owner)&select=account_id,email`);
    const emailsByAccount = new Map();
    for (const profile of profileRows || []) {
      if (!profile.email) continue;
      if (!emailsByAccount.has(profile.account_id)) emailsByAccount.set(profile.account_id, []);
      emailsByAccount.get(profile.account_id).push(profile.email);
    }

    for (const watch of qualifying) {
      const hailSize = maxHailByWatch.get(watch.id);
      const account = accounts.get(watch.account_id);
      const recipients = emailsByAccount.get(watch.account_id) || [];
      if (!recipients.length) { alerts.push({ address: watch.address, sent: false, reason: 'no admin or owner email' }); continue; }
      const subject = `📍 Hail Alert: ${hailSize.toFixed(2)}" hail at ${watch.label || watch.address.split(',')[0]}`;
      const html = buildAddressAlertEmail({ address: watch.address, label: watch.label, hailSize, frameTime, company: account.name || 'Your Company' });
      const send = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: 'BidDrop Address Monitor <support@biddrop.io>', to: recipients, subject, html }) });
      if (!send.ok) { alerts.push({ address: watch.address, sent: false, reason: `Resend ${send.status}` }); continue; }
      await supabaseFetch(`watched_addresses?id=eq.${watch.id}`, { method: 'PATCH', body: JSON.stringify({ last_alert_sent_at: now.toISOString(), last_hail_date: now.toISOString().slice(0, 10), last_hail_size: Math.round(hailSize * 100) / 100 }) });
      alerts.push({ address: watch.address, sent: true, max_hail: Math.round(hailSize * 100) / 100, recipients });
    }
    return res.status(200).json({ frame: latestKey, frame_time: frameTime, watched_count: watched.length, alerts_sent: alerts.filter(a => a.sent).length, alerts });
  } catch (error) {
    console.error('[address-monitor]', error);
    return res.status(500).json({ error: error.message });
  }
}
