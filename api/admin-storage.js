/**
 * BidDrop API — Supabase Storage photo upload and bucket management
 * Sub-module of admin.js, called by the main router.
 */
'use strict';
const { SUPABASE_URL, SERVICE_KEY, LOB_KEY, RENTCAST_KEY, AGENCY_ACCT_ID,
  STRIPE_SECRET_KEY, SUPABASE_PAT, TRACERFY_KEY, _checkRate, _checkIdem, sbFetch } = require('./_admin-shared');

/**
 * Handle actions for this module.
 * Returns true if the action was handled, false if unknown (caller should try next module).
 */
async function handle(action, req, res, ctx) {
  const { profile, isSuperAdmin, isAdmin, effectiveAccountId, caller } = ctx;
  switch (action) {
      case 'upload-photo': {
        // Upload a photo to Supabase Storage using service key (bypasses RLS)
        // Accepts: { path: string, dataUrl: string, mimeType: string }
        const { path: uploadPath, dataUrl, mimeType: uploadMime } = req.body;
        if (!uploadPath || !dataUrl) { res.status(400).json({ error: 'path and dataUrl required' }); return; }
        // Convert base64 data URL to buffer
        const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const contentType = uploadMime || 'image/jpeg';
        // Upload to Supabase Storage using service key
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/pin-photos/${uploadPath}`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': contentType,
            'x-upsert': 'true'
          },
          body: buffer
        });
        if (!uploadRes.ok) {
          const errBody = await uploadRes.text();
          return res.status(uploadRes.status).json({ error: errBody });
        }
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/pin-photos/${uploadPath}`;
        return res.json({ url: publicUrl });
      }

      case 'create-bucket': {
        // Create the pin-photos storage bucket with public read + authenticated write
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'super_admin only' });
        }
        // Create bucket
        const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: 'pin-photos',
            name: 'pin-photos',
            public: true,
            file_size_limit: 10485760, // 10MB
            allowed_mime_types: ['image/jpeg','image/png','image/webp','image/gif']
          })
        });
        const bucketBody = await bucketRes.json();
        return res.json({ bucket_status: bucketRes.status, bucket: bucketBody });
      }

      case 'fix-storage-policy': {
        // Fix RLS policies on pin-photos bucket to allow authenticated uploads
        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'super_admin only' });
        }
        // Use Supabase Management API to add storage policies
        const policyResults = [];
        const policies = [
          { name: 'Allow authenticated uploads', definition: `(bucket_id = 'pin-photos' AND auth.role() = 'authenticated')`, operation: 'INSERT' },
          { name: 'Allow authenticated updates', definition: `(bucket_id = 'pin-photos' AND auth.role() = 'authenticated')`, operation: 'UPDATE' },
          { name: 'Allow public reads', definition: `(bucket_id = 'pin-photos')`, operation: 'SELECT' },
          { name: 'Allow authenticated deletes', definition: `(bucket_id = 'pin-photos' AND auth.role() = 'authenticated')`, operation: 'DELETE' }
        ];
        for (const policy of policies) {
          const pr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: `CREATE POLICY IF NOT EXISTS "${policy.name}" ON storage.objects FOR ${policy.operation} USING ${policy.operation === 'INSERT' ? 'true' : `(${policy.definition})`} WITH CHECK (${policy.definition})` })
          });
          const prBody = await pr.text();
          policyResults.push({ policy: policy.name, status: pr.status, body: prBody.substring(0, 200) });
        }
        return res.json({ policyResults });
      }

    default:
      return false;
  }
  return true;
}

module.exports = { handle };
