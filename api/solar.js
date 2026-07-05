/**
 * BidDrop Solar API Proxy — Vercel Serverless Function
 *
 * Proxies Google Solar API (Building Insights) to keep the API key server-side.
 *
 * GET /api/solar?lat=33.123&lng=-97.456
 *   → returns full solar potential data including:
 *     - Roof measurements (sqft, squares, pitch)
 *     - Panel configuration (maxPanels, systemKw, panelCapacityW)
 *     - Energy production (annualEnergyKwh, peakSunHoursPerDay)
 *     - Carbon offset (carbonOffsetKgPerYear, treesEquivalent)
 *     - Shading analysis per segment (sunshineHours, shadingFactor)
 *     - Individual roof segment breakdown
 */
const GOOGLE_SOLAR_KEY = process.env.GOOGLE_SOLAR_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_KEY;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Convert roof pitch tilt (degrees) to the pitch multiplier BidDrop uses
function tiltToPitchMultiplier(tiltDeg) {
  const rise = 12 * Math.tan((tiltDeg * Math.PI) / 180);
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
  let best = pitches[2];
  let bestDiff = Infinity;
  for (const p of pitches) {
    const diff = Math.abs(p.rise - rise);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return best;
}

// Derive shading quality from sunshine hours per year
function shadingFactor(sunshineHoursPerYear) {
  const maxPossible = 1825; // ~5 hrs/day * 365
  const ratio = Math.min(sunshineHoursPerYear / maxPossible, 1);
  if (ratio >= 0.85) return { label: 'Excellent', color: '#22C55E', pct: Math.round(ratio * 100) };
  if (ratio >= 0.70) return { label: 'Good',      color: '#84CC16', pct: Math.round(ratio * 100) };
  if (ratio >= 0.55) return { label: 'Moderate',  color: '#F59E0B', pct: Math.round(ratio * 100) };
  return                     { label: 'Poor',      color: '#EF4444', pct: Math.round(ratio * 100) };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // ── Auth guard: require valid Supabase JWT ──────────────────────────────────
  const solarToken = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  if (!solarToken) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const solarVerify = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${solarToken}` }
  });
  if (!solarVerify.ok) { res.status(401).json({ error: 'Unauthorized' }); return; }

  if (!GOOGLE_SOLAR_KEY) { res.status(500).json({ status: 'unavailable', message: 'Solar API not configured' }); return; }

  const { lat, lng } = req.query;
  if (!lat || !lng) { res.status(400).json({ error: 'lat and lng are required' }); return; }

  const latF = parseFloat(lat);
  const lngF = parseFloat(lng);
  if (isNaN(latF) || isNaN(lngF)) { res.status(400).json({ error: 'Invalid lat/lng' }); return; }

  try {
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${latF}&location.longitude=${lngF}&requiredQuality=LOW&key=${GOOGLE_SOLAR_KEY}`;
    const solarRes = await fetch(url);
    const data = await solarRes.json();

    if (!solarRes.ok || data.error) {
      const msg = data.error?.message || data.error?.status || 'Solar API error';
      res.status(200).json({ status: 'unavailable', message: msg });
      return;
    }

    const sp = data.solarPotential;
    if (!sp) {
      res.status(200).json({ status: 'unavailable', message: 'No solar data for this location' });
      return;
    }

    // ── Roof Measurements ──────────────────────────────────────────────────────
    const roofAreaM2 = sp.wholeRoofStats?.areaMeters2 || 0;
    const sqft = Math.round(roofAreaM2 * 10.7639);

    // ── Roof Segments with shading ─────────────────────────────────────────────
    const rawSegments = (sp.roofSegmentStats || []).map(seg => {
      const segSqft = Math.round((seg.stats?.areaMeters2 || 0) * 10.7639);
      // Use median of sunshine quantiles if available, otherwise estimate
      const quantiles = seg.stats?.sunshineQuantiles || [];
      const sunHrs = quantiles.length > 0
        ? Math.round(quantiles[Math.floor(quantiles.length / 2)])
        : Math.round((sp.maxSunshineHoursPerYear || 1500) * 0.75);
      const shading = shadingFactor(sunHrs);
      const pitchInfo = tiltToPitchMultiplier(seg.pitchDegrees || 0);
      return {
        sqft: segSqft,
        tiltDeg: Math.round((seg.pitchDegrees || 0) * 10) / 10,
        pitchLabel: pitchInfo.label,
        azimuthDeg: Math.round(seg.azimuthDegrees || 0),
        sunshineHoursPerYear: sunHrs,
        shadingLabel: shading.label,
        shadingColor: shading.color,
        shadingPct: shading.pct,
      };
    });
    rawSegments.sort((a, b) => b.sqft - a.sqft);

    const dominantTilt = rawSegments.length > 0 ? rawSegments[0].tiltDeg : 18.43;
    const pitchInfo = tiltToPitchMultiplier(dominantTilt);

    // ── Panel Configuration ────────────────────────────────────────────────────
    const panelConfigs  = sp.solarPanelConfigs || [];
    const maxConfig     = panelConfigs.length > 0 ? panelConfigs[panelConfigs.length - 1] : null;
    const panelCapacityW = sp.panelCapacityWatts || 400;
    const maxPanels     = maxConfig ? maxConfig.panelsCount : null;
    const systemKw      = maxPanels ? Math.round(maxPanels * panelCapacityW / 100) / 10 : null;

    // ── Energy Production ──────────────────────────────────────────────────────
    const annualEnergyDcKwh = maxConfig?.yearlyEnergyDcKwh
      ? Math.round(maxConfig.yearlyEnergyDcKwh)
      : null;
    // Apply ~80% inverter + system efficiency for AC output
    const annualEnergyAcKwh = annualEnergyDcKwh ? Math.round(annualEnergyDcKwh * 0.80) : null;

    // Peak sun hours per day
    const maxSunshineHrs = sp.maxSunshineHoursPerYear
      ? Math.round(sp.maxSunshineHoursPerYear)
      : null;
    const peakSunHoursPerDay = maxSunshineHrs
      ? Math.round((maxSunshineHrs / 365) * 10) / 10
      : null;

    // ── Carbon Offset ──────────────────────────────────────────────────────────
    // US EPA 2023: 0.386 kg CO2 per kWh; 1 tree absorbs ~21.8 kg CO2/year
    const carbonOffsetKgPerYear = annualEnergyAcKwh
      ? Math.round(annualEnergyAcKwh * 0.386)
      : null;
    const treesEquivalent = carbonOffsetKgPerYear
      ? Math.round(carbonOffsetKgPerYear / 21.8)
      : null;

    // ── Roof-level shading summary ─────────────────────────────────────────────
    const roofShading = maxSunshineHrs ? shadingFactor(maxSunshineHrs) : null;

    res.status(200).json({
      status: 'ok',

      // Roof measurements
      sqft,
      squares: Math.round(sqft / 100 * 10) / 10,
      pitchMultiplier: pitchInfo.mult,
      pitchLabel: pitchInfo.label,
      dominantTiltDeg: Math.round(dominantTilt * 10) / 10,
      roofAreaM2: Math.round(roofAreaM2 * 10) / 10,
      imageryDate: data.imageryDate || null,

      // Panel configuration
      maxPanels,
      systemKw,
      panelCapacityW,
      panelConfigCount: panelConfigs.length,

      // Energy production
      annualEnergyAcKwh,
      annualEnergyDcKwh,
      peakSunHoursPerDay,
      maxSunshineHoursPerYear: maxSunshineHrs,

      // Carbon offset
      carbonOffsetKgPerYear,
      treesEquivalent,

      // Roof-level shading
      roofShadingLabel: roofShading?.label || null,
      roofShadingColor: roofShading?.color || null,
      roofShadingPct:   roofShading?.pct   || null,

      // Segment breakdown (up to 8 segments, sorted by size)
      segments: rawSegments.slice(0, 8),
    });
  } catch (err) {
    console.error('Solar API proxy error:', err);
    res.status(200).json({ status: 'unavailable', message: err.message });
  }
}
