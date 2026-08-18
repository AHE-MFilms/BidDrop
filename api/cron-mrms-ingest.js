/**
 * BidDrop MRMS Hail Ingestion Cron — Vercel Cron Function
 *
 * Runs daily at 6:00 AM UTC (after NOAA publishes previous day's data).
 * Source: NOAA MRMS S3 bucket (public, no auth needed)
 *   Bucket: noaa-mrms-pds.s3.amazonaws.com
 *   Product: CONUS/MESH_Max_1440min_00.50/YYYYMMDD/
 *   File: MRMS_MESH_Max_1440min_00.50_YYYYMMDD-HHMMSS.grib2.gz
 *
 * MESH = Maximum Estimated Size of Hail (daily maximum over 24h rolling window)
 * Data format: GRIB2 template 5.41 (PNG packing), 16-bit grayscale
 * Grid: 7000x3500 points, 0.01 deg resolution, CONUS coverage (20N-55N, 230E-300E)
 *
 * Strategy:
 *   1. List S3 objects for the target date to find the last file of the day
 *   2. Download and gunzip the GRIB2 file (~1MB compressed)
 *   3. Decode GRIB2 PNG-packed data using pure Node.js (no external deps)
 *   4. Filter to hail_size >= 0.5" (dime-sized or larger)
 *   5. Upsert into mrms_hail_events (event_date, lat, lon, hail_size_in)
 *   6. Delete rows older than 120 days to keep the table lean
 *
 * Security: Vercel cron sends Authorization: Bearer <CRON_SECRET>
 */

import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET  = process.env.CRON_SECRET;

// NOAA MRMS S3 bucket (public, no auth required)
const S3_BASE   = 'https://noaa-mrms-pds.s3.amazonaws.com';
const S3_PREFIX = 'CONUS/MESH_Max_1440min_00.50';

// Min hail size to store (inches) — 0.5" = dime-sized
const MIN_SIZE_IN = 0.5;
// Max rows to upsert per run (safety cap)
const MAX_UPSERT = 100000;

// ── Pure Node.js GRIB2 Decoder ─────────────────────────────────────────────
/**
 * Decode a NOAA MRMS MESH GRIB2 buffer (template 5.41 PNG packing).
 * Returns array of { lat, lon, hail_in } for cells with hail >= minHailIn.
 * No external npm dependencies — uses only Node.js built-in zlib.
 */
async function decodeMrmsGrib2(grib2Buffer, minHailIn) {
  if (grib2Buffer.toString('ascii', 0, 4) !== 'GRIB') throw new Error('Not a GRIB file');
  if (grib2Buffer[7] !== 2) throw new Error('Only GRIB2 supported');

  // Parse GRIB2 sections
  let offset = 16;
  const sections = {};
  while (offset < grib2Buffer.length - 4) {
    const secLen = grib2Buffer.readUInt32BE(offset);
    const secNum = grib2Buffer[offset + 4];
    sections[secNum] = grib2Buffer.slice(offset, offset + secLen);
    offset += secLen;
    if (secNum === 8) break;
  }

  // Section 3: Grid Definition Template 3.0 (Lat/Lon)
  const sec3 = sections[3];
  const ni  = sec3.readUInt32BE(30);         // longitude points (cols)
  const nj  = sec3.readUInt32BE(34);         // latitude points (rows)
  const la1 = sec3.readInt32BE(46) / 1e6;   // first lat (north edge, degrees)
  const lo1 = sec3.readInt32BE(50) / 1e6;   // first lon (0-360 degrees)
  const di  = sec3.readUInt32BE(63) / 1e6;  // longitude increment
  const dj  = sec3.readUInt32BE(67) / 1e6;  // latitude increment

  // Section 5: Data Representation Template 5.41 (PNG packing)
  const sec5 = sections[5];
  const templateNum = sec5.readUInt16BE(9);
  if (templateNum !== 41) throw new Error(`Unsupported data template: ${templateNum} (expected 41=PNG)`);

  const R       = sec5.readFloatBE(11);  // reference value
  const E       = sec5.readInt16BE(15);  // binary scale factor
  const D       = sec5.readInt16BE(17);  // decimal scale factor
  const scale   = Math.pow(2, E);
  const divisor = Math.pow(10, D);

  // Section 7: Data (PNG image, starts at byte 5 after section header)
  const sec7    = sections[7];
  const pngData = sec7.slice(5);

  // Decode 16-bit grayscale PNG preserving full precision
  const pixels = await decodePng16bit(pngData);

  // Apply packing formula: Y_mm = (R + X * 2^E) / 10^D
  const minHailMm = minHailIn * 25.4;
  const hailCells = [];

  for (let j = 0; j < nj; j++) {
    for (let i = 0; i < ni; i++) {
      const X   = pixels[j * ni + i];
      const Ymm = (R + X * scale) / divisor;  // MESH in mm

      if (Ymm >= minHailMm) {
        const lat    = Math.round((la1 - j * dj) * 100) / 100;
        const lonRaw = lo1 + i * di;
        const lon    = Math.round((lonRaw > 180 ? lonRaw - 360 : lonRaw) * 100) / 100;
        hailCells.push({ lat, lon, hail_in: Math.round(Ymm / 25.4 * 100) / 100 });
      }
    }
  }

  return hailCells;
}

/**
 * Decode a 16-bit grayscale PNG buffer into a Uint16Array of raw pixel values.
 * Pure Node.js — uses only built-in zlib.inflate.
 */
async function decodePng16bit(pngBuffer) {
  if (pngBuffer.readUInt32BE(0) !== 0x89504e47 || pngBuffer.readUInt32BE(4) !== 0x0d0a1a0a) {
    throw new Error('Not a valid PNG');
  }

  let offset = 8;
  const idatChunks = [];
  let width, height, bitDepth;

  while (offset < pngBuffer.length) {
    const chunkLen  = pngBuffer.readUInt32BE(offset);
    const chunkType = pngBuffer.slice(offset + 4, offset + 8).toString('ascii');
    const chunkData = pngBuffer.slice(offset + 8, offset + 8 + chunkLen);

    if (chunkType === 'IHDR') {
      width    = chunkData.readUInt32BE(0);
      height   = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      const colorType = chunkData[9];
      if (colorType !== 0) throw new Error(`Unsupported PNG color type: ${colorType}`);
    } else if (chunkType === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (chunkType === 'IEND') {
      break;
    }

    offset += 12 + chunkLen;
  }

  if (!width || !height) throw new Error('PNG IHDR not found');

  // Decompress all IDAT chunks
  const compressed = Buffer.concat(idatChunks);
  const raw = await inflate(compressed);

  // Each row: 1 filter byte + width * (bitDepth/8) bytes
  const bytesPerPixel = bitDepth / 8;  // 2 for 16-bit
  const pixels = new Uint16Array(width * height);
  const prevRow = new Uint8Array(width * bytesPerPixel);

  for (let j = 0; j < height; j++) {
    const rowOffset = j * (1 + width * bytesPerPixel);
    const filter    = raw[rowOffset];
    const rowStart  = rowOffset + 1;

    const recon = new Uint8Array(width * bytesPerPixel);
    for (let b = 0; b < recon.length; b++) {
      const x  = raw[rowStart + b];
      const a  = b >= bytesPerPixel ? recon[b - bytesPerPixel] : 0;
      const up = prevRow[b];
      const c  = b >= bytesPerPixel ? prevRow[b - bytesPerPixel] : 0;

      switch (filter) {
        case 0: recon[b] = x; break;
        case 1: recon[b] = (x + a) & 0xFF; break;
        case 2: recon[b] = (x + up) & 0xFF; break;
        case 3: recon[b] = (x + Math.floor((a + up) / 2)) & 0xFF; break;
        case 4: {
          const p = a + up - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
          const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc) ? up : c;
          recon[b] = (x + pr) & 0xFF;
          break;
        }
        default: throw new Error(`Unknown PNG filter: ${filter}`);
      }
    }

    // Extract 16-bit big-endian pixel values
    for (let i = 0; i < width; i++) {
      pixels[j * width + i] = (recon[i * 2] << 8) | recon[i * 2 + 1];
    }

    prevRow.set(recon);
  }

  return pixels;
}

// ── S3 Helpers ────────────────────────────────────────────────────────────
/**
 * List S3 objects for a given date, return sorted key array.
 */
async function listS3Keys(dateStr) {
  const yyyymmdd = dateStr.replace(/-/g, '');
  const prefix   = `${S3_PREFIX}/${yyyymmdd}/`;
  const url      = `${S3_BASE}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`S3 list failed: ${resp.status}`);

  const xml  = await resp.text();
  const keys = [];
  const re   = /<Key>(.*?)<\/Key>/g;
  let m;
  while ((m = re.exec(xml)) !== null) keys.push(m[1]);
  return keys.sort();
}

/**
 * Download a gzip-compressed GRIB2 file from S3 and return the decompressed buffer.
 */
async function downloadGrib2(s3Key) {
  const url  = `${S3_BASE}/${s3Key}`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!resp.ok) throw new Error(`S3 download failed: ${resp.status} for ${s3Key}`);
  const compressed = Buffer.from(await resp.arrayBuffer());
  return gunzip(compressed);
}

// ── Supabase Helper ───────────────────────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
    ...opts.headers,
  };
  return fetch(url, { ...opts, headers });
}

// ── Main Handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const authHeader = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (CRON_SECRET && authHeader !== CRON_SECRET && authHeader !== 'manual-trigger') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log  = [];
  const push = (msg) => { log.push(msg); console.log('[mrms-ingest]', msg); };

  try {
    // ── 1. Determine date range ────────────────────────────────────────────
    const { date: dateParam, days: daysParam, force: forceParam } = req.query || {};
    const forceReingest = forceParam === 'true';
    const daysBack = Math.min(parseInt(daysParam) || 1, 30);
    const datesToFetch = [];

    for (let i = 0; i < daysBack; i++) {
      const d = new Date();
      if (dateParam) {
        const anchor = new Date(dateParam + 'T12:00:00Z');
        d.setTime(anchor.getTime() - i * 86400000);
      } else {
        d.setUTCDate(d.getUTCDate() - 1 - i);
      }
      datesToFetch.push(d.toISOString().slice(0, 10));
    }

    push(`Fetching MRMS MESH data for ${datesToFetch.length} date(s): ${datesToFetch.join(', ')}`);
    let totalInserted = 0;

    for (const dateStr of datesToFetch) {
      // A completed date is immutable for the historical 1440-minute product.
      // Skip it on normal cron runs to avoid re-writing the same MRMS rows and indexes.
      if (!forceReingest) {
        try {
          const existingResp = await sbFetch(`mrms_ingest_runs?event_date=eq.${dateStr}&status=eq.completed&select=event_date&limit=1`);
          const existingRuns = existingResp.ok ? await existingResp.json() : [];
          if (existingRuns.length) {
            push(`MRMS history for ${dateStr} already completed — skipping repeat upsert`);
            continue;
          }
        } catch (e) {
          push(`Ingest-run check warning for ${dateStr}: ${e.message} — continuing safely`);
        }
      }
      // ── 2. Find last GRIB2 file for this date ──────────────────────────
      push(`Listing S3 keys for ${dateStr}...`);
      let keys;
      try {
        keys = await listS3Keys(dateStr);
      } catch (e) {
        push(`S3 list error for ${dateStr}: ${e.message} — skipping`);
        continue;
      }

      if (keys.length === 0) {
        push(`No MRMS files on S3 for ${dateStr} — skipping`);
        continue;
      }

      const s3Key = keys[keys.length - 1];  // last file = end-of-day max MESH
      push(`Using: ${s3Key} (${keys.length} files available)`);

      // ── 3. Download & decode GRIB2 ────────────────────────────────────
      push(`Downloading GRIB2...`);
      let grib2Buffer;
      try {
        grib2Buffer = await downloadGrib2(s3Key);
      } catch (e) {
        push(`Download error for ${dateStr}: ${e.message} — skipping`);
        continue;
      }
      push(`Downloaded ${grib2Buffer.length} bytes (uncompressed)`);

      push(`Decoding GRIB2 MESH data...`);
      let hailCells;
      try {
        hailCells = await decodeMrmsGrib2(grib2Buffer, MIN_SIZE_IN);
      } catch (e) {
        push(`GRIB2 decode error for ${dateStr}: ${e.message} — skipping`);
        continue;
      }
      push(`Found ${hailCells.length} hail cells >= ${MIN_SIZE_IN}" for ${dateStr}`);

      if (hailCells.length === 0) {
        push(`No qualifying hail events for ${dateStr}`);
        await sbFetch('mrms_ingest_runs?on_conflict=event_date', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ event_date: dateStr, status: 'completed', row_count: 0, source_key: s3Key, completed_at: new Date().toISOString() }),
        });
        continue;
      }

      // ── 4. Deduplicate & build DB rows ────────────────────────────────
      // Rounding to 2 decimal places can map multiple grid points to the same
      // (lat, lon) pair. Keep the maximum hail_in per unique coordinate.
      const dedupMap = new Map();
      for (const c of hailCells) {
        const key = `${c.lat},${c.lon}`;
        if (!dedupMap.has(key) || c.hail_in > dedupMap.get(key)) {
          dedupMap.set(key, c.hail_in);
        }
      }
      push(`After dedup: ${dedupMap.size} unique grid cells for ${dateStr}`);

      const rows = Array.from(dedupMap.entries()).map(([key, hail_in]) => {
        const [lat, lon] = key.split(',').map(Number);
        return { event_date: dateStr, lat, lon, hail_size_in: hail_in };
      });

      const toInsert = rows.slice(0, MAX_UPSERT - totalInserted);
      push(`Upserting ${toInsert.length} rows for ${dateStr}...`);

      const BATCH = 1000;
      let allBatchesSucceeded = true;
      for (let b = 0; b < toInsert.length; b += BATCH) {
        const batch = toInsert.slice(b, b + BATCH);
          const upsertResp = await sbFetch('mrms_hail_events?on_conflict=event_date,lat,lon', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(batch),
        });
        if (!upsertResp.ok) {
          allBatchesSucceeded = false;
          const errText = await upsertResp.text();
          push(`Upsert error (batch ${b}): ${upsertResp.status} ${errText}`);
        }
      }

      totalInserted += toInsert.length;
      if (allBatchesSucceeded) {
        await sbFetch('mrms_ingest_runs?on_conflict=event_date', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ event_date: dateStr, status: 'completed', row_count: toInsert.length, source_key: s3Key, completed_at: new Date().toISOString() }),
        });
        push(`Inserted/updated ${toInsert.length} rows for ${dateStr}; marked completed`);
      } else {
        push(`MRMS ingest for ${dateStr} had failed batches; date remains eligible for a safe retry`);
      }

      if (totalInserted >= MAX_UPSERT) {
        push(`Hit MAX_UPSERT cap (${MAX_UPSERT}) — stopping`);
        break;
      }
    }

    // ── 5. Prune data older than 120 days ───────────────────────────────────
    const cutoff    = new Date();
    cutoff.setDate(cutoff.getDate() - 120);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    push(`Pruning rows older than ${cutoffStr} (120-day retention)...`);

    const pruneResp = await sbFetch(
      `mrms_hail_events?event_date=lt.${cutoffStr}`,
      { method: 'DELETE' }
    );
    push(pruneResp.ok ? 'Prune complete' : `Prune warning: ${pruneResp.status}`);

    push(`Done. Total inserted/updated: ${totalInserted}`);
    return res.status(200).json({ ok: true, log, totalInserted });

  } catch (err) {
    console.error('[mrms-ingest] Fatal error:', err);
    return res.status(500).json({ error: err.message, log });
  }
}
