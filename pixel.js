/**
 * BidDrop Pixel — Embeddable Snippet
 * Hosted at: https://biddrop.us/pixel.js
 *
 * Usage (contractors embed on their website):
 *   <script src="https://biddrop.us/pixel.js" data-pixel-id="YOUR_PIXEL_ID" async></script>
 *
 * Behavior:
 *  - Tracks time on page
 *  - Fires a hit to /api/pixel when the visitor has been on the page >= 20 seconds
 *  - Fires again on page unload if session >= 20s (to capture final duration)
 *  - Only fires once per page load (deduped by sessionStorage)
 *  - Respects Do Not Track header
 */
(function () {
  'use strict';

  // Read pixel ID from script tag attribute
  var scripts = document.querySelectorAll('script[data-pixel-id]');
  var pixelId = null;
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].getAttribute('src') && scripts[i].getAttribute('src').indexOf('pixel.js') !== -1) {
      pixelId = scripts[i].getAttribute('data-pixel-id');
      break;
    }
  }
  // Fallback: check current script
  if (!pixelId) {
    var cur = document.currentScript;
    if (cur) pixelId = cur.getAttribute('data-pixel-id');
  }
  if (!pixelId) return;

  // Respect Do Not Track
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  // Dedupe: only fire once per pixel per page session
  var dedupeKey = 'bdpx_fired_' + pixelId;
  if (sessionStorage.getItem(dedupeKey)) return;

  var startTime = Date.now();
  var fired = false;
  var API_BASE = 'https://biddrop.us/api/pixel';

  function getSessionSeconds() {
    return Math.round((Date.now() - startTime) / 1000);
  }

  function fire(seconds) {
    if (fired) return;
    fired = true;
    sessionStorage.setItem(dedupeKey, '1');

    var payload = {
      action: 'hit',
      pixelId: pixelId,
      sessionSeconds: seconds,
      pageUrl: window.location.href.substring(0, 500),
      referrer: document.referrer.substring(0, 500)
    };

    // Use sendBeacon for reliability on page unload, fetch otherwise
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      var blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(API_BASE, blob);
    } else {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(body);
      } catch (e) {}
    }
  }

  // Fire after 20 seconds of engagement
  var engagementTimer = setTimeout(function () {
    fire(getSessionSeconds());
  }, 20000);

  // Also fire on page unload if >= 20s elapsed (catches slow readers)
  function onUnload() {
    var s = getSessionSeconds();
    if (s >= 20) fire(s);
    clearTimeout(engagementTimer);
  }
  window.addEventListener('pagehide', onUnload);
  window.addEventListener('beforeunload', onUnload);

  // Visibility change: pause timer when tab is hidden, resume when visible
  var hiddenAt = null;
  var totalHiddenMs = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt) {
      totalHiddenMs += Date.now() - hiddenAt;
      hiddenAt = null;
    }
  });

})();
