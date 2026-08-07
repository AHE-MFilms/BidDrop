/**
 * BidDrop — Storage Cleanup Cron
 * Route: GET /api/cron-cleanup-storage
 *
 * Runs weekly (Sunday 3 AM EDT / 7 AM UTC) via Vercel Cron.
 * Deletes orphaned files from the `pin-photos` bucket — files that:
 *   1. Are NOT referenced by any row in the `pins` table (photo_url or all_photos JSONB)
 *   2. Were uploaded more than 60 days ago (safety buffer)
 *
 * Safety features:
 *   - DRY_RUN=true by default in env — set DRY_RUN=false in Vercel env to enable real deletes
 *   - Never touches `biddrop-photos` bucket (logos, brand assets)
 *   - Database is the source of truth — any URL in pins table is safe
 *   - Full logging of every file checked and action taken
 *
 * Manual trigger (dry run): GET /api/cron-cleanup-storage
 * Manual trigger (live):    GET /api/cron-cleanup-storage?force=true  (requires CRON_SECRET)
 */

const SUPABASE_URL   = process.env.SUPABASE_URL  || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const CRON_SECRET    = process.env.CRON_SECRET;
const DRY_RUN        = process.env.STORAGE_CLEANUP_DRY_RUN !== 'false'; // default: dry run
const ORPHAN_DAYS    = 60; // only delete orphans older than this many days
const BUCKET         = 'pin-photos';

export default async function handler(req, res) {
  // Allow GET (cron) or POST (manual trigger)
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check for manual triggers
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  if (!isVercelCron && CRON_SECRET && secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dryRun = DRY_RUN && req.query.force !== 'true';
  const cutoffDate = new Date(Date.now() - ORPHAN_DAYS * 24 * 60 * 60 * 1000);

  console.log(`[cleanup-storage] Starting. dry_run=${dryRun}, cutoff=${cutoffDate.toISOString()}`);

  const stats = {
    files_scanned: 0,
    files_referenced: 0,
    files_too_new: 0,
    files_deleted: 0,
    files_would_delete: 0,
    errors: 0,
    deleted_paths: [],
    would_delete_paths: [],
  };

  try {
    // ── Step 1: Get all referenced photo URLs from pins table ──────────────────
    // We fetch all photo_url values and all_photos JSONB to build a Set of known URLs
    console.log('[cleanup-storage] Fetching all referenced photo URLs from pins table...');
    const referencedUrls = new Set();

    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const pinsResp = await fetch(
        `${SUPABASE_URL}/rest/v1/pins?select=photo_url,all_photos&limit=${pageSize}&offset=${offset}`,
        { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
      );
      if (!pinsResp.ok) throw new Error(`Failed to fetch pins: ${await pinsResp.text()}`);
      const pins = await pinsResp.json();
      if (!pins.length) break;

      for (const pin of pins) {
        // Add single photo_url
        if (pin.photo_url) referencedUrls.add(pin.photo_url);

        // Add all URLs from all_photos JSONB (front/damage/angles/buildings/other arrays)
        if (pin.all_photos && typeof pin.all_photos === 'object') {
          for (const arr of Object.values(pin.all_photos)) {
            if (Array.isArray(arr)) {
              for (const url of arr) {
                if (typeof url === 'string' && url.startsWith('http')) referencedUrls.add(url);
              }
            }
          }
        }
      }

      offset += pageSize;
      if (pins.length < pageSize) break;
    }

    console.log(`[cleanup-storage] Found ${referencedUrls.size} referenced photo URLs in pins table`);

    // ── Step 2: List all top-level folders in pin-photos bucket (account IDs) ──
    const foldersResp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 1000, offset: 0, prefix: '' }),
    });
    if (!foldersResp.ok) throw new Error(`Failed to list storage folders: ${await foldersResp.text()}`);
    const folders = await foldersResp.json();
    const accountFolders = folders.filter(f => f.id === null); // folders have null id

    console.log(`[cleanup-storage] Found ${accountFolders.length} account folders in ${BUCKET}`);

    // ── Step 3: For each account folder, list files and check against referenced URLs ──
    for (const folder of accountFolders) {
      const prefix = folder.name + '/';
      let fileOffset = 0;

      while (true) {
        const filesResp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
          method: 'POST',
          headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 1000, offset: fileOffset, prefix }),
        });
        if (!filesResp.ok) break;
        const files = await filesResp.json();
        if (!files.length) break;

        for (const file of files) {
          if (file.id === null) continue; // skip sub-folders
          stats.files_scanned++;

          const filePath = prefix + file.name;
          const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filePath}`;
          const uploadedAt = new Date(file.created_at || file.updated_at || 0);

          // Check if referenced by any pin
          if (referencedUrls.has(fileUrl)) {
            stats.files_referenced++;
            continue;
          }

          // Check age — only delete if older than cutoff
          if (uploadedAt > cutoffDate) {
            stats.files_too_new++;
            continue;
          }

          // This file is orphaned and old enough to delete
          if (dryRun) {
            stats.files_would_delete++;
            stats.would_delete_paths.push(filePath);
            console.log(`[cleanup-storage] DRY RUN — would delete: ${filePath} (uploaded ${uploadedAt.toISOString()})`);
          } else {
            // Actually delete
            const delResp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`, {
              method: 'DELETE',
              headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` },
            });
            if (delResp.ok) {
              stats.files_deleted++;
              stats.deleted_paths.push(filePath);
              console.log(`[cleanup-storage] DELETED: ${filePath}`);
            } else {
              stats.errors++;
              console.error(`[cleanup-storage] Failed to delete ${filePath}: ${await delResp.text()}`);
            }
          }
        }

        fileOffset += 1000;
        if (files.length < 1000) break;
      }
    }

    console.log(`[cleanup-storage] Done. Stats:`, JSON.stringify(stats));

    return res.status(200).json({
      ok: true,
      dry_run: dryRun,
      cutoff_days: ORPHAN_DAYS,
      cutoff_date: cutoffDate.toISOString(),
      stats: {
        files_scanned: stats.files_scanned,
        files_referenced: stats.files_referenced,
        files_too_new: stats.files_too_new,
        files_deleted: dryRun ? 0 : stats.files_deleted,
        files_would_delete: dryRun ? stats.files_would_delete : 0,
        errors: stats.errors,
      },
      ...(dryRun && stats.would_delete_paths.length > 0 ? { would_delete: stats.would_delete_paths } : {}),
      ...((!dryRun) && stats.deleted_paths.length > 0 ? { deleted: stats.deleted_paths } : {}),
    });

  } catch (err) {
    console.error('[cleanup-storage] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
