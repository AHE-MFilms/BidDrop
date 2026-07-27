# Storm Feature Redesign Notes

## DB State
- mrms_hail_events: 2,467,494 rows
- Only 1 distinct event_date in first 1000 rows: 2026-07-27
- The backfill ran for July 14-27 but the DB query with limit=1000 only returns today's date
- This means the date filtering is working (90-day window) but the first 1000 rows all happen to be today

## API: /api/mrms-hail
- Query params: swLat, swLng, neLat, neLng, days (default 90), minSize (default 0.5)
- Returns: [{ event_date, lat, lon, hail_size_in }]
- MAX_ROWS = 20000

## New API needed: /api/mrms-storm-dates
- Should return distinct event_dates with max hail size per date
- Format: [{ date: "2026-07-05", maxSize: 2.12, label: "Baseball+" }]
- Used to populate a date picker in the Storm panel

## UX Redesign Plan (from user feedback + SwathIQ observation)
The user wants a date-picker-first approach:
1. Rep opens Storm Events
2. Sees a dropdown/list of storm dates (e.g. "Jul 5 — Baseball+ 2.12"")
3. Selects a date → MRMS swath for THAT DATE appears on map (red cells)
4. Rep draws a box inside the red → homes appear
5. Rep taps "Work This Area" → campaign created

Key insight from SwathIQ: They show a date picker first, then the swath for that date.
BidDrop currently shows "last N days" which blends all storms together confusingly.

## Bugs Fixed This Session
1. _homeInMrmsCells filter was dropping all homes (tolerance 0.007° < grid 0.01°) — REMOVED
2. Unlock onclick used JSON.stringify(address) in HTML attribute → syntax error on apostrophes
   - Fixed: now uses _slHomeCache[homeKey] lookup via stormLeadsUnlockByKey()
3. Renamed "Radar Swaths" → "Hail Impact Zone"
4. Updated Storm Alert instructions to numbered steps

## Files Changed
- src/storm-leads.js: removed cell filter, fixed unlock onclick
- src/html/tab-map.html: renamed label, updated instructions  
- src/html/tab-storm.html: renamed label
- src/mrms.js: CELL_HALF=0.005, exports _mrmsCells and _mrmsSwathBounds

## Git Commits
- 9f85b0b: Fix cell filter + rename + instructions
- 2596614: Census geocoder for address lookup
