/**
 * BidDrop — Pure geographic utilities
 * No DOM, no S object, no window, no fetch.
 * Safe to import in Node.js tests.
 *
 * Sources: campaign.js (haversineM), zones.js (isPointInPolygon),
 *          estimates-calc.js (calcPolygonSqFt), map.js (_homeAgeColor, _homeAgeLabel, _pinMarkerColor)
 */

'use strict';

/**
 * Haversine distance between two lat/lng points, in metres.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance in metres
 */
function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in metres
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Ray-casting point-in-polygon test.
 * @param {{ lat: number, lng: number }} pin
 * @param {{ polygon: Array<{ lat: number, lng: number }> }} zone
 * @returns {boolean}
 */
function isPointInPolygon(pin, zone) {
  const poly = zone.polygon || [];
  let inside = false;
  const x = pin.lng, y = pin.lat;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat;
    const xj = poly[j].lng, yj = poly[j].lat;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Calculate the area of a lat/lng polygon in square feet using the Shoelace formula.
 * Requires at least 3 points.
 * @param {Array<{ lat: number, lng: number }>} pts
 * @returns {number} area in sq ft
 */
function calcPolygonSqFt(pts) {
  if (pts.length < 3) return 0;
  const toM = ll => {
    const R = 6371000;
    return {
      x: R * ll.lng * (Math.PI / 180) * Math.cos(ll.lat * Math.PI / 180),
      y: R * ll.lat * (Math.PI / 180)
    };
  };
  const mp = pts.map(toM);
  let area = 0;
  for (let i = 0; i < mp.length; i++) {
    const j = (i + 1) % mp.length;
    area += mp[i].x * mp[j].y;
    area -= mp[j].x * mp[i].y;
  }
  return Math.round(Math.abs(area) / 2 * 10.7639);
}

/**
 * Return a color hex string for a home's age (for map layer coloring).
 * @param {number|string|null} yearBuilt
 * @returns {string|null} hex color or null if unknown
 */
function homeAgeColor(yearBuilt) {
  if (!yearBuilt) return null;
  const age = new Date().getFullYear() - parseInt(yearBuilt);
  if (age < 10)  return '#22C55E'; // green  — new build (<10yr)
  if (age < 20)  return '#EAB308'; // yellow — 10-20yr
  if (age < 30)  return '#F97316'; // orange — 20-30yr
  return '#EF4444';                // red    — old build (>30yr)
}

/**
 * Return a human-readable label for a home's age.
 * @param {number|string|null} yearBuilt
 * @returns {string}
 */
function homeAgeLabel(yearBuilt) {
  if (!yearBuilt) return 'Build year unknown';
  const age = new Date().getFullYear() - parseInt(yearBuilt);
  return 'Built ' + yearBuilt + ' · Home age: ~' + age + ' yrs';
}

/**
 * Return the marker color hex for a pin's status.
 * @param {{ status?: string }} pin
 * @returns {string}
 */
function pinMarkerColor(pin) {
  const STATUS_COLORS = {
    pipeline: '#F25C05', needs_roof: '#F25C05', interested: '#EAB308',
    bid_sent: '#3B82F6', converted: '#22C55E', not_interested: '#3D5269',
    contacted: '#A855F7', quoted: '#3B82F6', signed: '#22C55E', lost: '#EF4444',
    pinned: '#6B7280', mailed: '#3B82F6', emailed: '#A855F7',
    called: '#EAB308', responded: '#F59E0B'
  };
  return STATUS_COLORS[pin.status || 'pipeline'] || '#F25C05';
}

// CommonJS export for Node.js test runner
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { haversineM, isPointInPolygon, calcPolygonSqFt, homeAgeColor, homeAgeLabel, pinMarkerColor };
}
