/**
 * BidDrop Storm Report API
 * Fetches comprehensive storm data for a lat/lon location from:
 *   - NOAA MRMS (hail size from Supabase)
 *   - NOAA SPC Storm Reports (hail spotters, wind, tornado)
 *   - NOAA NWS Alerts API (severe weather warnings)
 *
 * GET /api/storm-report?lat=42.3&lon=-83.5&days=365
 * Returns: { hail, wind, tornado, warnings, summary }
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
// The Find panel is a property/local-area decision aid—not a regional storm
// chaser search. Keep radar-only results tight enough that they cannot be
// mistaken for hail at a searched ZIP or property.
const LOCAL_RADIUS_MILES = 5;
const MIN_DISPLAY_HAIL_IN = 0.75; // quarter-sized radar estimate; suppress marginal single-cell noise

// Haversine distance in miles
function distMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Parse SPC CSV and filter by distance from target
function parseSpcCsv(text, lat, lon, maxMiles, type) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 7) continue;
    const rLat = parseFloat(parts[5]);
    const rLon = parseFloat(parts[6]);
    if (isNaN(rLat) || isNaN(rLon)) continue;
    const dist = distMiles(lat, lon, rLat, rLon);
    if (dist > maxMiles) continue;
    const base = {
      time: parts[0],
      location: (parts[2] || '').trim(),
      county: (parts[3] || '').trim(),
      state: (parts[4] || '').trim(),
      lat: rLat,
      lon: rLon,
      dist_miles: Math.round(dist * 10) / 10,
      comments: parts.slice(7).join(',').trim(),
      type
    };
    if (type === 'hail') {
      base.size_in = parseFloat(parts[1]) / 100;
    } else if (type === 'wind') {
      const knots = parseInt(parts[1]);
      base.speed_mph = isNaN(knots) ? null : Math.round(knots * 1.15078);
      base.speed_raw = parts[1]; // may be 'UNK'
    } else if (type === 'tornado') {
      base.f_scale = parts[1];
    }
    results.push(base);
  }
  return results.sort((a, b) => a.dist_miles - b.dist_miles);
}

// Fetch SPC report for a given date (YYMMDD) and type
async function fetchSpc(dateStr, type) {
  const typeMap = { hail: 'hail', wind: 'wind', tornado: 'torn' };
  const url = `https://www.spc.noaa.gov/climo/reports/${dateStr}_rpts_filtered_${typeMap[type]}.csv`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'BidDrop/1.0 (support@biddrop.io)' } });
    if (!r.ok) return '';
    return await r.text();
  } catch { return ''; }
}

// Get date strings for the past N days in YYMMDD format
function getDateStrings(days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push({ str: `${yy}${mm}${dd}`, date: d.toISOString().slice(0, 10) });
  }
  return dates;
}

// Fetch NWS active/recent alerts for a point
async function fetchNwsAlerts(lat, lon) {
  try {
    const url = `https://api.weather.gov/alerts?point=${lat},${lon}&status=actual,expired&limit=50`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'BidDrop/1.0 (support@biddrop.io)', 'Accept': 'application/geo+json' }
    });
    if (!r.ok) return [];
    const data = await r.json();
    if (!data.features) return [];
    return data.features
      .map(f => f.properties)
      .filter(p => ['Severe Thunderstorm Warning', 'Tornado Warning', 'Tornado Watch',
                    'Severe Thunderstorm Watch', 'Flash Flood Warning', 'High Wind Warning',
                    'Wind Advisory'].includes(p.event))
      .map(p => ({
        event: p.event,
        headline: p.headline,
        onset: p.onset,
        expires: p.expires,
        severity: p.severity,
        description: (p.description || '').slice(0, 500)
      }));
  } catch { return []; }
}

// Fetch MRMS hail events from Supabase for this location
async function fetchMrmsHail(lat, lon, days) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().slice(0, 10);
    const latDelta = LOCAL_RADIUS_MILES / 69;
    const lonDelta = LOCAL_RADIUS_MILES / (69 * Math.max(Math.cos(lat * Math.PI / 180), 0.1));
    const latMin = lat - latDelta, latMax = lat + latDelta;
    const lonMin = lon - lonDelta, lonMax = lon + lonDelta;
    const url = `${SUPABASE_URL}/rest/v1/mrms_hail_events?event_date=gte.${sinceStr}&lat=gte.${latMin}&lat=lte.${latMax}&lon=gte.${lonMin}&lon=lte.${lonMax}&hail_size_in=gte.${MIN_DISPLAY_HAIL_IN}&order=event_date.desc&limit=500`;
    const r = await fetch(url, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    });
    if (!r.ok) return [];
    const rows = await r.json();
    return rows.map(row => ({
      date: row.event_date,
      lat: row.lat,
      lon: row.lon,
      hail_size_in: row.hail_size_in,
      dist_miles: Math.round(distMiles(lat, lon, row.lat, row.lon) * 10) / 10,
      source: 'MRMS Radar Estimate'
    }))
      // A bounding box can include locations beyond a circular five-mile scope.
      // Always apply the final geodesic check before returning a “local” result.
      .filter(row => row.dist_miles <= LOCAL_RADIUS_MILES)
      .sort((a, b) => a.date.localeCompare(b.date) || a.dist_miles - b.dist_miles || b.hail_size_in - a.hail_size_in);
  } catch { return []; }
}

// Derive storm direction/speed from SPC hail report comments and timing
function deriveStormInfo(hailReports, windReports) {
  // Look for direction/speed clues in comments
  const allComments = [...hailReports, ...windReports].map(r => r.comments || '').join(' ').toLowerCase();
  const dirMatch = allComments.match(/moving\s+(north|south|east|west|northeast|northwest|southeast|southwest)/i);
  const speedMatch = allComments.match(/(\d+)\s*mph/i);
  return {
    direction: dirMatch ? dirMatch[1].toUpperCase() : null,
    speed_mph: speedMatch ? parseInt(speedMatch[1]) : null
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const days = Math.min(parseInt(req.query.days || '365'), 365);
  // years param: fetch full annual SPC archives going back N years (default 0 = use days only)
  const years = Math.min(parseInt(req.query.years || '0'), 10);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  // Get date strings for the requested period
  const dateStrings = getDateStrings(days);

  // Fetch MRMS hail from Supabase (fast, our own DB)
  const mrmsHail = await fetchMrmsHail(lat, lon, Math.max(days, years * 365));

  // Fetch SPC reports in parallel — limit to 90 days for SPC (performance)
  const spcDates = dateStrings.slice(0, 90);
  const BATCH = 15;
  const spcHail = [], spcWind = [], spcTornado = [];

  for (let b = 0; b < spcDates.length; b += BATCH) {
    const batch = spcDates.slice(b, b + BATCH);
    const results = await Promise.all(batch.flatMap(({ str, date }) => [
      fetchSpc(str, 'hail').then(csv => ({ date, type: 'hail', csv })),
      fetchSpc(str, 'wind').then(csv => ({ date, type: 'wind', csv })),
      fetchSpc(str, 'tornado').then(csv => ({ date, type: 'tornado', csv }))
    ]));
    for (const { date, type, csv } of results) {
      if (!csv) continue;
      const parsed = parseSpcCsv(csv, lat, lon, 50, type); // 50 mile radius for spotters
      parsed.forEach(r => { r.date = date; });
      if (type === 'hail') spcHail.push(...parsed);
      else if (type === 'wind') spcWind.push(...parsed);
      else if (type === 'tornado') spcTornado.push(...parsed);
    }
  }


  // If years > 0, also fetch full annual SPC archives for each past year
  if (years > 0) {
    const currentYear = new Date().getFullYear();
    const annualFetches = [];
    for (let y = 1; y <= years; y++) {
      const yr = currentYear - y;
      annualFetches.push({ yr, type: 'hail' });
      annualFetches.push({ yr, type: 'wind' });
      annualFetches.push({ yr, type: 'tornado' });
    }
    for (let b = 0; b < annualFetches.length; b += 6) {
      const batch = annualFetches.slice(b, b + 6);
      const results = await Promise.all(batch.map(async ({ yr, type }) => {
        const typeMap = { hail: 'hail', wind: 'wind', tornado: 'torn' };
        const url = `https://www.spc.noaa.gov/wcm/data/${yr}_${typeMap[type]}.csv`;
        try {
          const r = await fetch(url, {
            headers: { 'User-Agent': 'BidDrop/1.0 (support@biddrop.io)' },
            signal: AbortSignal.timeout(15000)
          });
          if (!r.ok) return { yr, type, csv: '' };
          return { yr, type, csv: await r.text() };
        } catch { return { yr, type, csv: '' }; }
      }));
      for (const { yr, type, csv } of results) {
        if (!csv) continue;
        const parsed = parseSpcCsv(csv, lat, lon, 50, type);
        parsed.forEach(r => {
          if (!r.date) {
            const t = r.time || '';
            if (t.includes('/')) {
              const [mo, dy] = t.split('/');
              r.date = `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
            } else {
              r.date = `${yr}-01-01`;
            }
          }
          r.source_archive = `SPC Annual ${yr}`;
        });
        if (type === 'hail') spcHail.push(...parsed);
        else if (type === 'wind') spcWind.push(...parsed);
        else if (type === 'tornado') spcTornado.push(...parsed);
      }
    }
  }

  // Fetch NWS alerts
  const nwsAlerts = await fetchNwsAlerts(lat, lon);

  // Derive storm direction/speed from comments
  const stormInfo = deriveStormInfo(spcHail, spcWind);

  // Build summary
  const maxHail = mrmsHail.length > 0 ? Math.max(...mrmsHail.map(h => h.hail_size_in)) : 0;
  const maxWind = spcWind.filter(w => w.speed_mph).length > 0
    ? Math.max(...spcWind.filter(w => w.speed_mph).map(w => w.speed_mph))
    : null;

  // Build NEXRAD radar image URLs for the worst hail dates (IEM archive)
  // Format: https://mesonet.agron.iastate.edu/archive/data/YYYY/MM/DD/GIS/uscomp/max_n0r_0z0z_YYYYMMDD.png
  // max_n0r_0z0z = daily maximum reflectivity composite (best for showing storm extent)
  const radarImages = [];
  const hailDates = [...new Set(mrmsHail.slice(0, 5).map(h => h.date))];
  for (const date of hailDates) {
    const [yyyy, mm, dd] = date.split('-');
    const yyyymmdd = `${yyyy}${mm}${dd}`;
    radarImages.push({
      date,
      url: `https://mesonet.agron.iastate.edu/archive/data/${yyyy}/${mm}/${dd}/GIS/uscomp/max_n0r_0z0z_${yyyymmdd}.png`,
      label: `NEXRAD Radar — ${date} (Daily Max Reflectivity)`
    });
  }

  const summary = {
    hail_events: mrmsHail.length,
    max_hail_in: maxHail,
    wind_events: spcWind.length,
    max_wind_mph: maxWind,
    tornado_events: spcTornado.length,
    spotter_hail_reports: spcHail.length,
    warnings: nwsAlerts.length,
    storm_direction: stormInfo.direction,
    storm_speed_mph: stormInfo.speed_mph,
    severe_warning_issued: nwsAlerts.some(a =>
      ['Severe Thunderstorm Warning', 'Tornado Warning'].includes(a.event)
    )
  };

  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    lat, lon, days,
    local_radius_miles: LOCAL_RADIUS_MILES,
    mrms_min_display_hail_in: MIN_DISPLAY_HAIL_IN,
    summary,
    mrms_hail: mrmsHail.slice(0, 50),
    spc_hail_spotters: spcHail.slice(0, 30),
    spc_wind: spcWind.slice(0, 30),
    spc_tornado: spcTornado.slice(0, 10),
    nws_warnings: nwsAlerts.slice(0, 10),
    radar_images: radarImages
  });
}
