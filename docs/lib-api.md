# BidDrop `src/lib/` API Reference

All modules in `src/lib/` are pure functions — no DOM access, no global state, no network calls. They are exported as CommonJS modules so they can be imported and tested with `node tests/unit.test.js`.

**Usage in tests:**
```js
const fmt  = require('../src/lib/format.js');
const geo  = require('../src/lib/geo.js');
const ps   = require('../src/lib/pin-status.js');
const drip = require('../src/lib/drip.js');
const cred = require('../src/lib/credits.js');
```

**Usage in browser (src/ files):**
The lib files also run in the browser because they use `if (typeof module !== 'undefined') module.exports = ...` — the `module.exports` block is skipped in the browser and the functions remain globally available.

---

## `src/lib/format.js`

String formatting utilities for display and normalization.

### `formatPhone(raw)`
Formats a raw phone string to `(NXX) NXX-XXXX`. Strips all non-digits, handles 10-digit and 11-digit (leading 1) inputs. Returns `''` for null/undefined/empty. Returns the input unchanged if it is not 10 or 11 digits.

```js
formatPhone('3135550100')   // → '(313) 555-0100'
formatPhone('13135550100')  // → '(313) 555-0100'
formatPhone('')             // → ''
formatPhone(null)           // → ''
```

### `timeAgo(isoString)`
Returns a human-readable relative time string. Returns `''` for null/empty input.

```js
timeAgo(new Date(Date.now() - 30000).toISOString())     // → 'just now'
timeAgo(new Date(Date.now() - 5 * 60000).toISOString()) // → '5m ago'
timeAgo(new Date(Date.now() - 3 * 3600000).toISOString())// → '3h ago'
timeAgo(new Date(Date.now() - 2 * 86400000).toISOString())// → '2d ago'
```

### `fmtDate(isoString)`
Formats an ISO date string to a locale-readable date (e.g. `Mar 15, 2025`). Returns `''` for null/empty input.

```js
fmtDate('2025-03-15T12:00:00.000Z') // → 'Mar 15, 2025'
fmtDate(null)                        // → ''
```

### `applyFuTokens(template, name, rep, company, address)`
Replaces `{name}`, `{rep}`, `{company}`, `{address}` tokens in a follow-up message template. Replaces all occurrences.

```js
applyFuTokens('Hi {name}, {rep} here.', 'John', 'Mike', 'BidDrop', '123 Main St')
// → 'Hi John, Mike here.'
```

### `normalizeAddr(addr)`
Normalizes an address string for deduplication: lowercases, expands common abbreviations (`street → st`, `avenue → ave`, `boulevard → blvd`, `drive → dr`, `road → rd`, `court → ct`, `lane → ln`, `place → pl`), strips punctuation, collapses whitespace. Returns `''` for null/empty.

```js
normalizeAddr('123 Main Street')  // → '123 main st'
normalizeAddr('456 Oak Avenue')   // → '456 oak ave'
normalizeAddr(null)               // → ''
```

### `toStateAbbr(input)`
Converts a US state full name to its 2-letter abbreviation. Case-insensitive. Returns the input trimmed if not found. Returns `null` for null input.

```js
toStateAbbr('Michigan')     // → 'MI'
toStateAbbr('michigan')     // → 'MI'
toStateAbbr('MI')           // → 'MI'
toStateAbbr('New York')     // → 'NY'
toStateAbbr(null)           // → null
toStateAbbr('Unknown')      // → 'Unknown'
```

### `parseAddr(fullAddr)`
Parses a full address string (`"street, city, state zip"`) into parts. Returns `{ line1, city, state, zip }`. Returns all-empty strings for null/empty input.

```js
parseAddr('123 Main St, Chicago, IL 60601')
// → { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' }

parseAddr('456 Oak Ave, Detroit, MI 48201-1234')
// → { line1: '456 Oak Ave', city: 'Detroit', state: 'MI', zip: '48201-1234' }

parseAddr(null)
// → { line1: '', city: '', state: '', zip: '' }
```

---

## `src/lib/geo.js`

Geographic calculation utilities.

### `haversineM(lat1, lon1, lat2, lon2)`
Returns the great-circle distance in meters between two lat/lng points using the Haversine formula. Returns `0` for identical points.

```js
haversineM(40.7128, -74.0060, 40.7128, -74.0060) // → 0
haversineM(40.7128, -74.0060, 34.0522, -118.2437) // → ~3,940,000 (NYC to LA)
```

### `isPointInPolygon(point, zone)`
Returns `true` if `{ lat, lng }` is inside the zone's polygon (ray-casting algorithm). Returns `false` for empty/missing polygons.

```js
const zone = { polygon: [{ lat: 42, lng: -84 }, { lat: 42, lng: -83 }, { lat: 43, lng: -83 }, { lat: 43, lng: -84 }] };
isPointInPolygon({ lat: 42.5, lng: -83.5 }, zone) // → true
isPointInPolygon({ lat: 41.0, lng: -83.5 }, zone) // → false
```

### `calcPolygonSqFt(points)`
Calculates the area of a lat/lng polygon in square feet using the Shoelace formula with a meters-to-sqft conversion. Returns `0` for fewer than 3 points.

```js
calcPolygonSqFt([
  { lat: 42.3314, lng: -83.0458 }, { lat: 42.3316, lng: -83.0458 },
  { lat: 42.3316, lng: -83.0454 }, { lat: 42.3314, lng: -83.0454 }
]) // → ~2,500 (small polygon in sqft)
```

### `homeAgeColor(yearBuilt)`
Returns a hex color based on home age: green (`#22C55E`) for < 10 years, yellow (`#EAB308`) for 10–20, orange (`#F97316`) for 20–30, red (`#EF4444`) for > 30. Returns `null` for null input.

```js
homeAgeColor(2020) // → '#22C55E' (new build)
homeAgeColor(2000) // → '#EF4444' (25+ years old)
homeAgeColor(null) // → null
```

### `homeAgeLabel(yearBuilt)`
Returns a human-readable label like `"Built 2000 (25 yrs)"`. Returns `'Build year unknown'` for null input.

```js
homeAgeLabel(2000) // → 'Built 2000 (25 yrs)'
homeAgeLabel(null) // → 'Build year unknown'
```

---

## `src/lib/pin-status.js`

Pin pipeline status utilities. All functions accept a status string value.

### `PIN_STATUSES`
Array of 8 status objects: `{ v, label, color, emoji }`. Statuses in order: `pinned`, `mailed`, `emailed`, `called`, `responded`, `quoted`, `signed`, `not_interested`.

### `sColor(status)`
Returns the hex color for a status. Falls back to `#6B7280` (gray) for unknown statuses. Handles legacy aliases (`converted → signed`, `needs_roof → #F25C05`).

```js
sColor('pinned')       // → '#6B7280'
sColor('signed')       // → '#22C55E'
sColor('converted')    // → '#22C55E' (legacy alias)
```

### `sLabel(status)`
Returns the display label for a status. Handles legacy aliases.

```js
sLabel('pinned')    // → 'Pinned'
sLabel('signed')    // → 'Signed'
sLabel('converted') // → 'Signed' (legacy alias)
```

### `sEmoji(status)`
Returns the emoji for a status. Falls back to `📍` for unknown statuses.

```js
sEmoji('pinned') // → '📍'
sEmoji('signed') // → '✅'
```

### `isActivePipelineStatus(status)`
Returns `true` if the status is an active pipeline stage (pinned, mailed, emailed, called, responded, quoted). Returns `false` for terminal statuses (signed, not_interested).

```js
isActivePipelineStatus('pinned')       // → true
isActivePipelineStatus('signed')       // → false
isActivePipelineStatus('not_interested') // → false
```

### `isWonStatus(status)`
Returns `true` only for `'signed'` (and legacy `'converted'`).

```js
isWonStatus('signed') // → true
isWonStatus('pinned') // → false
```

---

## `src/lib/drip.js`

Drip campaign scheduling utilities.

### `getDripStepMessage(stepNum, cfg?)`
Returns `{ headline, subtext }` for a drip step. Uses `cfg.drip2Headline`, `cfg.drip2Subtext`, etc. for custom overrides. Returns `{ headline: 'Follow-Up', subtext: '' }` for unknown step numbers.

```js
getDripStepMessage(2)
// → { headline: 'Still thinking it over?', subtext: '...' }

getDripStepMessage(2, { drip2Headline: 'Custom headline' })
// → { headline: 'Custom headline', subtext: '...' }
```

### `calcDripSendDate(startIso, delayDays)`
Returns an ISO date string (YYYY-MM-DD) for `delayDays` after `startIso`. Handles month boundaries and leap years correctly.

```js
calcDripSendDate('2025-01-01T00:00:00.000Z', 7)  // → '2025-01-08T...'
calcDripSendDate('2024-02-22T00:00:00.000Z', 7)  // → '2024-02-29T...' (leap year)
```

### `buildDripSchedule(startIso, delayDaysArray, cfg?)`
Returns an array of drip step objects `{ step, sendAt, headline, subtext }`. Steps are numbered starting at 2 (step 1 is the initial send). `delayDaysArray` is an array of day offsets from `startIso`.

```js
buildDripSchedule('2025-01-01T00:00:00.000Z', [7, 14, 21])
// → [
//   { step: 2, sendAt: '2025-01-08T...', headline: 'Still thinking it over?', subtext: '...' },
//   { step: 3, sendAt: '2025-01-15T...', headline: 'Storm season is coming.', subtext: '...' },
//   { step: 4, sendAt: '2025-01-22T...', headline: 'Final notice.', subtext: '...' },
// ]
```

### `isDripItemDue(item)`
Returns `true` if a queue item with `status === 'pending'` has a `scheduled_send_at` in the past.

```js
isDripItemDue({ drip_step: 2, status: 'pending', scheduled_send_at: '2020-01-01T00:00:00.000Z' }) // → true
isDripItemDue({ drip_step: 2, status: 'sent',    scheduled_send_at: '2020-01-01T00:00:00.000Z' }) // → false
```

### `shouldPromoteToPending(item)`
Returns `true` if a `status === 'scheduled'` item has a `scheduled_send_at` in the past (ready to be promoted to `'pending'` for sending).

```js
shouldPromoteToPending({ status: 'scheduled', scheduled_send_at: '2020-01-01T00:00:00.000Z' }) // → true
shouldPromoteToPending({ status: 'pending',   scheduled_send_at: '2020-01-01T00:00:00.000Z' }) // → false
```

---

## `src/lib/credits.js`

Credit balance and pricing utilities.

### `calcAvailableCredits(cfg)`
Returns `{ paid, freeLeft, total }` from an account config object. `paid` is `cfg.mailerCredits || 0`. `freeLeft` is reserved for future monthly free credit logic.

```js
calcAvailableCredits({ mailerCredits: 10 }) // → { paid: 10, freeLeft: 0, total: 10 }
calcAvailableCredits({})                    // → { paid: 0,  freeLeft: 0, total: 0 }
```

### `hasEnoughCredits(cfg, count?)`
Returns `true` if `cfg.mailerCredits >= count` (default `count = 1`).

```js
hasEnoughCredits({ mailerCredits: 5 }, 3) // → true
hasEnoughCredits({ mailerCredits: 2 }, 3) // → false
hasEnoughCredits({ mailerCredits: 1 })    // → true  (default count = 1)
```

### `deductCredits(cfg, count)`
Returns a **new** config object with `mailerCredits` reduced by `count`. Does not mutate the original. Does not go below 0.

```js
deductCredits({ mailerCredits: 10 }, 3) // → { mailerCredits: 7 }
deductCredits({ mailerCredits: 1 },  5) // → { mailerCredits: 0 }
// original cfg is unchanged
```

### `creditBundleCost(count)`
Returns the dollar cost for `count` credits using the bundle pricing: 4 credits = $12, 1 credit = $4.

```js
creditBundleCost(1) // → 4   ($4 × 1)
creditBundleCost(4) // → 12  (1 bundle)
creditBundleCost(5) // → 16  (1 bundle + 1 single)
creditBundleCost(8) // → 24  (2 bundles)
creditBundleCost(0) // → 0
```
