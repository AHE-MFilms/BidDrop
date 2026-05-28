// BidDrop Service Worker — v2.4
// Network-first for index.html (always get latest code), cache-first for static assets

const CACHE_NAME = 'biddrop-v8';

// Core app shell files to cache on install
const PRECACHE_URLS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ── Install: pre-cache static assets (NOT index.html — always fetch fresh) ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up ALL old caches immediately ─────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for HTML, cache-first for static assets ──────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Network-first (pass-through) for all external APIs — never cache these
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
    url.hostname.includes('app.jobnimbus.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('maps.googleapis.com') ||
    url.hostname.includes('maps.gstatic.com')
  );

  // Network-first for HTML pages, API calls, and special routes (/e/, /open, /r/, /q/)
  const isHTML = (
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/e/') ||
    url.pathname.startsWith('/open') ||
    url.pathname.startsWith('/r/') ||
    url.pathname.startsWith('/q/')
  );

  if (isExternal || isHTML) {
    // Network-first: try network, fall back to cache if offline
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Only cache map tiles and CDN resources for offline use
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
        .catch(() => {
          // Fall back to cache if available, otherwise let the browser handle it
          return caches.match(event.request).then(cached => cached || Response.error());
        })
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, etc.)
  // Always ensure a valid Response is returned — never return undefined
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      // Not in cache — fetch from network and cache for next time
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => Response.error());
    })
  );
});
