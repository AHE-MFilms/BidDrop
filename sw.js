// BidDrop Service Worker — v1.0
// Cache-first for app shell, network-first for API calls

const CACHE_NAME = 'biddrop-v1';

// Core app shell files to cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: pre-cache the app shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for app shell, network-first for APIs ───────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Network-first for Supabase, GHL, NOAA, and other external APIs
  const isExternal = (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    url.hostname.includes('msgsndr.com') ||
    url.hostname.includes('gohighlevel.com') ||
    url.hostname.includes('spc.noaa.gov') ||
    url.hostname.includes('corsproxy.io') ||
    url.hostname.includes('api.rentcast.io') ||
    url.hostname.includes('nominatim.openstreetmap.org') ||
    url.hostname.includes('lob.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  );

  if (isExternal) {
    // Network-first: try network, fall back to cache if offline
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache map tiles and CDN resources for offline use
          if (
            url.hostname.includes('tile.openstreetmap.org') ||
            url.hostname.includes('unpkg.com') ||
            url.hostname.includes('cdnjs.cloudflare.com')
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for the app shell (same origin)
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
      return cached || networkFetch;
    })
  );
});
