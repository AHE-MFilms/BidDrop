/**
 * BidDrop Solar API Proxy — Vercel Serverless Function
 *
 * Proxies Google Solar API (Building Insights) to keep the API key server-side.
 *
 * GET /api/solar?lat=33.123&lng=-97.456
 *   → returns { sqft, squares, pitchMultiplier, pitchLabel, segments, roofAreaM2, status }
 *
 * The Google Solar API returns roof area in m² and roof segments with pitch tilt.
 * We convert to sq ft and derive the dominant pitch multiplier for roofing estimates.
 */

const GOOGLE_SOLAR_KEY = process.env.GOOGLE_SOLAR_KEY || 'AIzaSyAHE4rd0eFE-lQc9HbfObPq3virNnc9mRY';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Convert roof pitch tilt (degrees) to the pitch multiplier BidDrop uses
// BidDrop pitch multipliers: 4/12=1.054, 5/12=1.083, 6/12=1.118, 7/12=1.158,
//                             8/12=1.202, 9/12=1.250, 10/12=1.302, 11/12=1.357, 12/12=1.414
function tiltToPitchMultiplier(tiltDeg) {
  // tilt is the angle from horizontal (0=flat, 90=vertical)
  // pitch in rise/run: tan(tilt) = rise/12 → rise = 12*tan(tilt)
  const rise = 12 * Math.tan((tiltDeg * Math.PI) / 180);
  // Snap to nearest standard pitch
  const pitches = [
    { rise: 4, mult: 1.054, label: '4/12' },
    { rise: 5, mult: 1.083, label: '5/12' },
    { rise: 6, mult: 1.118, label: '6/12' },
    { rise: 7, mult: 1.158, label: '7/12' },
    { rise: 8, mult: 1.202, label: '8/12' },
    { rise: 9, mult: 1.250, label: '9/12' },
    { rise: 10, mult: 1.302, label: '10/12' },
    { rise: 11, mult: 1.357, label: '11/12' },
    { rise: 12, mult: 1.414, label: '12/12' },
  ];
  let best = pitches[2]; // default 6/12
  let bestDiff = Infinity;
  for (const p of pitches) {
    const diff = Math.abs(p.rise - rise);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return best;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { lat, lng } = req.query;
  if (!lat || !lng) {
    res.status(400).json({ error: 'lat and lng are required' });
    return;
  }

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);
  if (isNaN(latF) || isNaN(lngF)) {
    res.status(400).json({ error: 'Invalid lat/lng' });
    return;
  }

  try {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${latF}&location.longitude=${lngF}&requiredQuality=LOW&key=${GOOGLE_SOLAR_KEY}`;
    const solarRes = await fetch(url);
    const data = await solarRes.json();

    if (!solarRes.ok || data.error) {
      const msg = data.error?.message || data.error?.status || 'Solar API error';
      // Return a graceful degradation — not a hard error
      res.status(200).json({ status: 'unavailable', message: msg });
      return;
    }

    const solarSummary = data.solarPotential;
    if (!solarSummary) {
      res.status(200).json({ status: 'unavailable', message: 'No solar data for this location' });
      return;
    }

    // Whole roof area in m² → sq ft
    const roofAreaM2 = solarSummary.wholeRoofStats?.areaMeters2 || 0;
    const sqft = Math.round(roofAreaM2 * 10.7639);

    // Dominant pitch: find the largest roof segment by area and use its tilt
    const segments = (solarSummary.roofSegmentStats || []).map(seg => ({
      areaM2: seg.stats?.areaMeters2 || 0,
      tiltDeg: seg.pitchDegrees || 0,
    }));

    // Sort segments by area descending, pick the dominant one
    segments.sort((a, b) => b.areaM2 - a.areaM2);
    const dominantTilt = segments.length > 0 ? segments[0].tiltDeg : 18.43; // default ~6/12
    const pitchInfo = tiltToPitchMultiplier(dominantTilt);

    // Build segment summary for display
    const segmentSummary = segments.slice(0, 6).map(s => ({
      sqft: Math.round(s.areaM2 * 10.7639),
      tiltDeg: Math.round(s.tiltDeg * 10) / 10,
      pitchLabel: tiltToPitchMultiplier(s.tiltDeg).label,
    }));

    res.status(200).json({
      status: 'ok',
      sqft,
      squares: Math.round(sqft / 100 * 10) / 10,
      pitchMultiplier: pitchInfo.mult,
      pitchLabel: pitchInfo.label,
      dominantTiltDeg: Math.round(dominantTilt * 10) / 10,
      segments: segmentSummary,
      roofAreaM2: Math.round(roofAreaM2 * 10) / 10,
      buildingCount: data.solarPotential?.solarPanelConfigs?.length || null,
      imageryDate: data.imageryDate || null,
    });
  } catch (err) {
    console.error('Solar API proxy error:', err);
    res.status(200).json({ status: 'unavailable', message: err.message });
  }
}
