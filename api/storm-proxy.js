// api/storm-proxy.js
// Proxies NOAA SPC hail/wind CSV data to bypass browser CSP restrictions.
// Usage: /api/storm-proxy?date=260703&type=hail
//        /api/storm-proxy?date=260703&type=wind

export default async function handler(req, res) {
  const { date, type } = req.query;

  // Validate inputs
  if (!date || !/^\d{6}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYMMDD.' });
  }
  const reportType = type === 'wind' ? 'wind' : 'hail';
  const url = `https://www.spc.noaa.gov/climo/reports/${date}_rpts_filtered_${reportType}.csv`;

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'BidDrop/1.0 (storm data proxy)' }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `NOAA returned ${upstream.status}` });
    }

    const text = await upstream.text();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // cache 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
