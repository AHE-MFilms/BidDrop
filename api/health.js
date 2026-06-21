/**
 * BidDrop Health Check — /api/health
 * Returns 200 OK with basic status info. Used for uptime monitoring.
 */
module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    service: 'biddrop-api',
    ts: new Date().toISOString(),
    env: process.env.VERCEL_ENV || 'unknown'
  });
};
