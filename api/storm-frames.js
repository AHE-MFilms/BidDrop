/**
 * BidDrop Storm Frames API
 * Returns a list of NEXRAD radar composite image URLs for a given date
 * from the IEM (Iowa Environmental Mesonet) archive.
 *
 * GET /api/storm-frames?date=2026-08-07&start_hour=14&end_hour=22
 * Returns: { frames: [{ time, url, label }], bounds }
 *
 * Images are CONUS composites (N0Q = dual-pol base reflectivity)
 * Geographic bounds: [[24, -126], [50, -66]] (covers all of CONUS)
 * Frame interval: ~5 minutes
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const date = req.query.date; // YYYY-MM-DD
  const startHour = parseInt(req.query.start_hour || '0');
  const endHour = parseInt(req.query.end_hour || '23');

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
  }

  const [yyyy, mm, dd] = date.split('-');
  const yyyymmdd = `${yyyy}${mm}${dd}`;

  // IEM archive base URL for CONUS N0Q composite
  const baseUrl = `https://mesonet.agron.iastate.edu/archive/data/${yyyy}/${mm}/${dd}/GIS/uscomp`;

  // Generate frame URLs for every 5 minutes in the requested hour range
  // IEM stores files as n0q_YYYYMMDDhhmm.png (5-min intervals)
  const frames = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 5) {
      const hh = String(h).padStart(2, '0');
      const mm2 = String(m).padStart(2, '0');
      const timeStr = `${yyyymmdd}${hh}${mm2}`;
      const timeLabel = `${hh}:${mm2} UTC`;
      frames.push({
        time: `${date}T${hh}:${mm2}:00Z`,
        url: `${baseUrl}/n0q_${timeStr}.png`,
        label: timeLabel,
        yyyymmdd,
        hhmm: `${hh}${mm2}`
      });
    }
  }

  // Leaflet ImageOverlay bounds for CONUS N0Q composite
  // World file says: upper_left=(-126, 50), pixel_size=0.005 deg
  // Standard CONUS composite covers lon -126 to -66, lat 24 to 50
  const bounds = [[24, -126], [50, -66]];

  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({
    date,
    start_hour: startHour,
    end_hour: endHour,
    frame_count: frames.length,
    bounds,
    frames,
    // Also provide the daily max composite for quick reference
    daily_max_url: `${baseUrl}/max_n0q_0z0z_${yyyymmdd}.png`
  });
}
