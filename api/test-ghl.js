// /api/test-ghl.js
// Quick diagnostic endpoint to verify GHL API credentials are working.
// Tests:
//   1. Env vars are present
//   2. GHL API responds (fetches location info)
//   3. Optionally creates a test contact (pass ?create=true)
//
// Usage:
//   GET  /api/test-ghl          → check credentials + fetch location info
//   GET  /api/test-ghl?create=true  → also create a test contact tagged "biddrop-test"
//
// SECURITY: Requires BIDDROP_TEST_SECRET env var to be set in Vercel.
// Pass ?secret=YOUR_SECRET. No hardcoded fallback — endpoint is disabled if env var is missing.

export default async function handler(req, res) {
  // Simple auth guard — require ?secret= param matching BIDDROP_TEST_SECRET env var.
  // No hardcoded fallback — if env var is not set, endpoint is locked entirely.
  const expectedSecret = process.env.BIDDROP_TEST_SECRET;
  const providedSecret = req.query.secret;
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden. Set BIDDROP_TEST_SECRET in Vercel env vars and pass ?secret=YOUR_SECRET' });
  }

  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

  const results = {
    env: {
      GHL_API_KEY: GHL_API_KEY ? `✅ Present (${GHL_API_KEY.slice(0, 8)}...)` : '❌ MISSING',
      GHL_LOCATION_ID: GHL_LOCATION_ID ? `✅ Present (${GHL_LOCATION_ID})` : '❌ MISSING',
    },
    location: null,
    contact_test: null,
  };

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return res.status(200).json({ success: false, results });
  }

  // ---- Test 1: Fetch location info ----
  try {
    const locResp = await fetch(`https://services.leadconnectorhq.com/locations/${GHL_LOCATION_ID}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });
    const locData = await locResp.json();
    if (locResp.ok) {
      results.location = {
        status: '✅ Connected',
        name: locData?.location?.name || locData?.name || 'N/A',
        email: locData?.location?.email || locData?.email || 'N/A',
        id: GHL_LOCATION_ID,
      };
    } else {
      results.location = {
        status: `❌ Failed (HTTP ${locResp.status})`,
        error: locData,
      };
    }
  } catch (err) {
    results.location = { status: '❌ Error', error: err.message };
  }

  // ---- Test 2: Create a test contact (optional) ----
  if (req.query.create === 'true') {
    try {
      const contactResp = await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'BidDrop',
          lastName: 'Test',
          email: `test-${Date.now()}@biddrop-test.com`,
          phone: '+15555550000',
          companyName: 'BidDrop Test Co',
          locationId: GHL_LOCATION_ID,
          tags: ['biddrop-test', 'delete-me'],
          source: 'BidDrop GHL Connection Test',
        }),
      });
      const contactData = await contactResp.json();
      if (contactResp.ok) {
        results.contact_test = {
          status: '✅ Test contact created',
          contact_id: contactData?.contact?.id,
          name: `${contactData?.contact?.firstName} ${contactData?.contact?.lastName}`,
          note: 'You can delete this contact from GHL — it was just a test.',
        };
      } else {
        results.contact_test = {
          status: `❌ Failed (HTTP ${contactResp.status})`,
          error: contactData,
        };
      }
    } catch (err) {
      results.contact_test = { status: '❌ Error', error: err.message };
    }
  } else {
    results.contact_test = 'ℹ️ Skipped — add ?create=true to also test contact creation';
  }

  const allGood = results.location?.status?.startsWith('✅');
  return res.status(200).json({ success: allGood, results });
}
