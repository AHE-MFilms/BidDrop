// api/mrms-address-lookup.js
// Address-level hail history lookup.
// Given a street address (or lat/lon), returns every MRMS hail event
// that hit within ~1km of that point, sorted newest-first.
//
// Query params (one of two modes):
//   address  — street address string (geocoded via Nominatim/OSM, free)
//   lat, lon — already-geocoded coordinates (skips geocoding)
//   days     — how many days back to search (default: 365, max: 1825 = 5 years)
//   minSize  — minimum hail size in inches (default: 0.5)
//
// Returns JSON:
//   { address, lat, lon, events: [{ event_date, hail_size_in, distance_km }] }
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gtwbhxnrmfmdenogzuea.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TABLE = 'mrms_hail_events';

// Search radius: MRMS cells are on a 0.01° grid (~1km).
// We search ±0.05° (~5km) to catch the nearest cell even if address is between grid points.
const SEARCH_DEG = 0.05;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });
  }

  let { address, lat, lon, days = '365', minSize = '0.5' } = req.query;

  let resolvedLat = parseFloat(lat);
  let resolvedLon = parseFloat(lon);
  let resolvedAddress = address || null;

  // --- Geocode if address provided and no lat/lon ---
  if (address && (isNaN(resolvedLat) || isNaN(resolvedLon))) {
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
      const geoResp = await fetch(geoUrl, {
        headers: { 'User-Agent': 'BidDrop/1.0 (biddrop.us)' },
      });
      const geoData = await geoResp.json();
      if (!geoData || geoData.length === 0) {
        return res.status(404).json({ error: 'Address not found. Try a more specific address.' });
      }
      resolvedLat = parseFloat(geoData[0].lat);
      resolvedLon = parseFloat(geoData[0].lon);
      resolvedAddress = geoData[0].display_name;
    } catch (e) {
      return res.status(502).json({ error: 'Geocoding failed: ' + e.message });
    }
  }

  if (isNaN(resolvedLat) || isNaN(resolvedLon)) {
    return res.status(400).json({ error: 'Provide address= or lat= and lon= parameters.' });
  }

  // --- Query Supabase for hail events near this point ---
  const daysBack = Math.min(Math.max(parseInt(days) || 365, 1), 1825);
  const minSizeIn = Math.max(parseFloat(minSize) || 0.5, 0.1);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const swLat = (resolvedLat - SEARCH_DEG).toFixed(4);
  const neLat = (resolvedLat + SEARCH_DEG).toFixed(4);
  const swLng = (resolvedLon - SEARCH_DEG).toFixed(4);
  const neLng = (resolvedLon + SEARCH_DEG).toFixed(4);

  const params = new URLSearchParams({
    select: 'event_date,lat,lon,hail_size_in',
    event_date: `gte.${cutoffStr}`,
    lat: `gte.${swLat}`,
    hail_size_in: `gte.${minSizeIn}`,
    order: 'event_date.desc',
    limit: '500',
  });
  const andFilter = `lat.lte.${neLat},lon.gte.${swLng},lon.lte.${neLng}`;
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?${params.toString()}&and=(${encodeURIComponent(andFilter)})`;

  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: 'Database query failed', detail: err });
    }
    const rows = await resp.json();

    // Compute distance from address to each cell center, keep closest per date
    const byDate = {};
    for (const r of rows) {
      const cellLat = parseFloat(r.lat);
      const cellLon = parseFloat(r.lon);
      const distKm = haversineKm(resolvedLat, resolvedLon, cellLat, cellLon);
      const key = r.event_date;
      if (!byDate[key] || distKm < byDate[key].distance_km) {
        byDate[key] = {
          event_date:    r.event_date,
          hail_size_in:  parseFloat(r.hail_size_in),
          distance_km:   Math.round(distKm * 10) / 10,
          cell_lat:      cellLat,
          cell_lon:      cellLon,
        };
      }
    }

    // Sort by date descending
    const events = Object.values(byDate).sort((a, b) => b.event_date.localeCompare(a.event_date));

    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    return res.status(200).json({
      address: resolvedAddress,
      lat: resolvedLat,
      lon: resolvedLon,
      events,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// Haversine distance in km
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
