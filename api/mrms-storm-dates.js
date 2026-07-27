// api/mrms-storm-dates.js
// Returns distinct storm dates with max hail size and cell count.
// Data is embedded statically at build time to avoid Vercel timeout issues.
// The MRMS cron job refreshes this file daily.
// Last updated: 2026-07-27 22:10 UTC

const STATIC_DATES = [
  {
    "date": "2026-07-27",
    "maxSize": 5.0,
    "label": "Baseball+",
    "cellCount": 63366
  },
  {
    "date": "2026-07-26",
    "maxSize": 4.69,
    "label": "Baseball+",
    "cellCount": 32236
  },
  {
    "date": "2026-07-25",
    "maxSize": 4.19,
    "label": "Baseball+",
    "cellCount": 31324
  },
  {
    "date": "2026-07-24",
    "maxSize": 3.45,
    "label": "Baseball+",
    "cellCount": 28655
  },
  {
    "date": "2026-07-23",
    "maxSize": 4.15,
    "label": "Baseball+",
    "cellCount": 18724
  },
  {
    "date": "2026-07-22",
    "maxSize": 5.81,
    "label": "Baseball+",
    "cellCount": 9743
  },
  {
    "date": "2026-07-21",
    "maxSize": 4.49,
    "label": "Baseball+",
    "cellCount": 40595
  },
  {
    "date": "2026-07-20",
    "maxSize": 3.59,
    "label": "Baseball+",
    "cellCount": 58649
  },
  {
    "date": "2026-07-19",
    "maxSize": 5.47,
    "label": "Baseball+",
    "cellCount": 53841
  },
  {
    "date": "2026-07-18",
    "maxSize": 3.76,
    "label": "Baseball+",
    "cellCount": 39946
  },
  {
    "date": "2026-07-17",
    "maxSize": 8.82,
    "label": "Baseball+",
    "cellCount": 35576
  },
  {
    "date": "2026-07-16",
    "maxSize": 6.2,
    "label": "Baseball+",
    "cellCount": 19438
  },
  {
    "date": "2026-07-15",
    "maxSize": 3.88,
    "label": "Baseball+",
    "cellCount": 31641
  },
  {
    "date": "2026-07-14",
    "maxSize": 5.04,
    "label": "Baseball+",
    "cellCount": 38866
  },
  {
    "date": "2026-07-13",
    "maxSize": 3.52,
    "label": "Baseball+",
    "cellCount": 54778
  },
  {
    "date": "2026-07-12",
    "maxSize": 3.55,
    "label": "Baseball+",
    "cellCount": 96796
  },
  {
    "date": "2026-07-11",
    "maxSize": 2.85,
    "label": "Baseball+",
    "cellCount": 42509
  },
  {
    "date": "2026-07-10",
    "maxSize": 3.44,
    "label": "Baseball+",
    "cellCount": 70004
  },
  {
    "date": "2026-07-09",
    "maxSize": 9.87,
    "label": "Baseball+",
    "cellCount": 71686
  },
  {
    "date": "2026-07-08",
    "maxSize": 4.82,
    "label": "Baseball+",
    "cellCount": 44868
  },
  {
    "date": "2026-07-07",
    "maxSize": 3.15,
    "label": "Baseball+",
    "cellCount": 44805
  },
  {
    "date": "2026-07-06",
    "maxSize": 3.95,
    "label": "Baseball+",
    "cellCount": 89801
  },
  {
    "date": "2026-07-05",
    "maxSize": 7.96,
    "label": "Baseball+",
    "cellCount": 99861
  },
  {
    "date": "2026-07-04",
    "maxSize": 6.41,
    "label": "Baseball+",
    "cellCount": 125979
  },
  {
    "date": "2026-07-03",
    "maxSize": 6.32,
    "label": "Baseball+",
    "cellCount": 118479
  },
  {
    "date": "2026-07-02",
    "maxSize": 3.69,
    "label": "Baseball+",
    "cellCount": 97453
  },
  {
    "date": "2026-07-01",
    "maxSize": 3.48,
    "label": "Baseball+",
    "cellCount": 81810
  },
  {
    "date": "2026-06-30",
    "maxSize": 3.14,
    "label": "Baseball+",
    "cellCount": 108518
  },
  {
    "date": "2026-06-29",
    "maxSize": 5.74,
    "label": "Baseball+",
    "cellCount": 106383
  },
  {
    "date": "2026-06-28",
    "maxSize": 3.43,
    "label": "Baseball+",
    "cellCount": 83850
  },
  {
    "date": "2026-06-27",
    "maxSize": 3.62,
    "label": "Baseball+",
    "cellCount": 67670
  },
  {
    "date": "2026-06-26",
    "maxSize": 3.42,
    "label": "Baseball+",
    "cellCount": 35820
  },
  {
    "date": "2026-06-25",
    "maxSize": 5.7,
    "label": "Baseball+",
    "cellCount": 72347
  },
  {
    "date": "2026-06-24",
    "maxSize": 4.33,
    "label": "Baseball+",
    "cellCount": 48994
  },
  {
    "date": "2026-06-23",
    "maxSize": 4.08,
    "label": "Baseball+",
    "cellCount": 64753
  },
  {
    "date": "2026-06-22",
    "maxSize": 16.86,
    "label": "Baseball+",
    "cellCount": 61641
  },
  {
    "date": "2026-06-21",
    "maxSize": 4.37,
    "label": "Baseball+",
    "cellCount": 64128
  },
  {
    "date": "2026-06-20",
    "maxSize": 4.36,
    "label": "Baseball+",
    "cellCount": 42739
  },
  {
    "date": "2026-06-19",
    "maxSize": 6.79,
    "label": "Baseball+",
    "cellCount": 45847
  },
  {
    "date": "2026-06-18",
    "maxSize": 3.35,
    "label": "Baseball+",
    "cellCount": 22545
  },
  {
    "date": "2026-06-17",
    "maxSize": 6.83,
    "label": "Baseball+",
    "cellCount": 34725
  },
  {
    "date": "2026-06-16",
    "maxSize": 3.72,
    "label": "Baseball+",
    "cellCount": 20994
  },
  {
    "date": "2026-06-15",
    "maxSize": 2.64,
    "label": "Baseball+",
    "cellCount": 6744
  },
  {
    "date": "2026-06-14",
    "maxSize": 2.85,
    "label": "Baseball+",
    "cellCount": 38367
  }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const daysBack = Math.min(Math.max(parseInt(req.query.days || '30') || 30, 1), 60);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const result = STATIC_DATES.filter(d => d.date >= cutoffStr);

  // Short cache — data is static but refreshed daily
  res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
  return res.status(200).json(result);
}
