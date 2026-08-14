// api/storm-proxy.js
// Proxies NOAA SPC hail/wind CSV data to bypass browser CSP restrictions.
// Usage: /api/storm-proxy?date=260703&type=hail
//        /api/storm-proxy?date=260703&type=wind
//
// NOAA is an external dependency. Bound its wait time below Vercel's 15-second
// function limit so a slow SPC report never turns into a platform 504.

const NOAA_TIMEOUT_MS = 6500;

function setSharedHeaders(res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

function noaaUnavailable(res, reason) {
  console.warn(`[storm-proxy] NOAA temporarily unavailable: ${reason}`);
  setSharedHeaders(res);
  // Tell callers this is an upstream outage without pretending an empty CSV is
  // a successful no-hail result. A short CDN cache prevents a NOAA slowdown
  // from causing repeated identical requests while the provider recovers.
  res.setHeader('X-Storm-Proxy-Status', 'upstream-unavailable');
  res.setHeader('Retry-After', '60');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
  return res.status(204).end();
}

export default async function handler(req, res) {
  const { date, type } = req.query;

  // Validate inputs
  if (!date || !/^\d{6}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Expected YYMMDD.' });
  }
  const reportType = type === 'wind' ? 'wind' : 'hail';
  const url = `https://www.spc.noaa.gov/climo/reports/${date}_rpts_filtered_${reportType}.csv`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOAA_TIMEOUT_MS);

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'BidDrop/1.0 (storm data proxy)' },
      signal: controller.signal
    });

    if (!upstream.ok) {
      if (upstream.status >= 500) {
        return noaaUnavailable(res, `NOAA returned ${upstream.status}`);
      }
      return res.status(upstream.status).json({ error: `NOAA returned ${upstream.status}` });
    }

    const text = await upstream.text();

    setSharedHeaders(res);
    const today = new Date().toISOString().slice(2, 10).replaceAll('-', '');
    // Today's preliminary SPC report can change; historical daily files are
    // immutable and can be cached much longer at Vercel's CDN edge.
    res.setHeader(
      'Cache-Control',
      date === today
        ? 'public, s-maxage=300, stale-while-revalidate=3600'
        : 'public, s-maxage=86400, stale-while-revalidate=604800'
    );
    return res.status(200).send(text);
  } catch (err) {
    if (err.name === 'AbortError') {
      return noaaUnavailable(res, `request exceeded ${NOAA_TIMEOUT_MS}ms`);
    }
    return noaaUnavailable(res, err.message || 'network request failed');
  } finally {
    clearTimeout(timeout);
  }
}
