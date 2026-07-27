#!/usr/bin/env python3
"""
scripts/mrms_backfill.py
========================
Backfill MRMS MESH hail data for a date range using NOAA S3 GRIB2 files.
Uses the same pure-Python approach as the new cron-mrms-ingest.js:
  - Downloads the LAST file of each day (end-of-day max MESH)
  - Decodes GRIB2 template 5.41 (PNG packing) with 16-bit grayscale
  - Upserts into Supabase mrms_hail_events

Usage:
  SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... python3 scripts/mrms_backfill.py 2026-07-14 2026-07-27
  
Or for a single date:
  SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... python3 scripts/mrms_backfill.py 2026-07-14
"""
import os
import sys
import gzip
import struct
import zlib
import datetime
import logging
import requests
import numpy as np
from io import BytesIO

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S"
)
log = logging.getLogger("mrms_backfill")

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://gtwbhxnrmfmdenogzuea.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_TABLE = "mrms_hail_events"

S3_BASE   = "https://noaa-mrms-pds.s3.amazonaws.com"
S3_PREFIX = "CONUS/MESH_Max_1440min_00.50"

MIN_HAIL_INCHES = 0.5   # dime-sized or larger
UPSERT_BATCH    = 1000  # rows per Supabase upsert call

# ── GRIB2 Decoder ─────────────────────────────────────────────────────────────
def decode_png_16bit(png_bytes: bytes) -> np.ndarray:
    """
    Decode a 16-bit grayscale PNG and return a 2D uint16 numpy array.
    """
    from PIL import Image
    img = Image.open(BytesIO(png_bytes))
    return np.array(img, dtype=np.uint16)


def decode_mrms_grib2(grib2_bytes: bytes, min_hail_in: float) -> list[dict]:
    """
    Decode a NOAA MRMS MESH GRIB2 buffer (template 5.41 PNG packing).
    Returns list of {lat, lon, hail_in} dicts for cells >= min_hail_in.
    """
    if grib2_bytes[:4] != b'GRIB':
        raise ValueError("Not a GRIB file")
    if grib2_bytes[7] != 2:
        raise ValueError("Only GRIB2 supported")

    # Parse sections
    offset = 16
    sections = {}
    while offset < len(grib2_bytes) - 4:
        sec_len = struct.unpack_from('>I', grib2_bytes, offset)[0]
        sec_num = grib2_bytes[offset + 4]
        sections[sec_num] = grib2_bytes[offset:offset + sec_len]
        offset += sec_len
        if sec_num == 8:
            break

    # Section 3: Grid Definition Template 3.0 (Lat/Lon)
    sec3 = sections[3]
    ni  = struct.unpack_from('>I', sec3, 30)[0]   # longitude points
    nj  = struct.unpack_from('>I', sec3, 34)[0]   # latitude points
    la1 = struct.unpack_from('>i', sec3, 46)[0] / 1e6  # first lat (north)
    lo1 = struct.unpack_from('>i', sec3, 50)[0] / 1e6  # first lon (0-360)
    di  = struct.unpack_from('>I', sec3, 63)[0] / 1e6  # lon increment
    dj  = struct.unpack_from('>I', sec3, 67)[0] / 1e6  # lat increment

    # Section 5: Data Representation Template 5.41 (PNG packing)
    sec5 = sections[5]
    template_num = struct.unpack_from('>H', sec5, 9)[0]
    if template_num != 41:
        raise ValueError(f"Unsupported data template: {template_num} (expected 41=PNG)")

    R = struct.unpack_from('>f', sec5, 11)[0]   # reference value
    E = struct.unpack_from('>h', sec5, 15)[0]   # binary scale factor
    D = struct.unpack_from('>h', sec5, 17)[0]   # decimal scale factor
    scale   = 2.0 ** E
    divisor = 10.0 ** D

    # Section 7: Data (PNG image, starts at byte 5)
    sec7     = sections[7]
    png_data = sec7[5:]

    # Decode 16-bit grayscale PNG
    pixels = decode_png_16bit(png_data)  # shape: (nj, ni)

    # Apply packing formula: Y_mm = (R + X * 2^E) / 10^D
    values_mm = (R + pixels.astype(np.float32) * scale) / divisor

    # Find hail cells
    min_hail_mm = min_hail_in * 25.4
    mask = values_mm >= min_hail_mm
    rows_idx, cols_idx = np.where(mask)

    hail_cells = []
    for j, i in zip(rows_idx, cols_idx):
        lat    = round(float(la1 - j * dj), 2)
        lon_raw = lo1 + i * di
        lon    = round(float(lon_raw - 360 if lon_raw > 180 else lon_raw), 2)
        hail_in = round(float(values_mm[j, i]) / 25.4, 2)
        hail_cells.append({'lat': lat, 'lon': lon, 'hail_in': hail_in})

    return hail_cells


# ── S3 Helpers ────────────────────────────────────────────────────────────────
def list_s3_keys(date_str: str) -> list[str]:
    """List S3 keys for the given date (YYYY-MM-DD), return sorted list."""
    yyyymmdd = date_str.replace('-', '')
    prefix   = f"{S3_PREFIX}/{yyyymmdd}/"
    url      = f"{S3_BASE}/?list-type=2&prefix={requests.utils.quote(prefix)}&max-keys=1000"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    import re
    keys = re.findall(r'<Key>(.*?)</Key>', resp.text)
    return sorted(keys)


def download_grib2(s3_key: str) -> bytes:
    """Download and gunzip a GRIB2 file from S3."""
    url  = f"{S3_BASE}/{s3_key}"
    resp = requests.get(url, timeout=120, stream=True)
    resp.raise_for_status()
    compressed = resp.content
    return gzip.decompress(compressed)


# ── Supabase Upsert ───────────────────────────────────────────────────────────
def upsert_to_supabase(rows: list[dict], date_str: str):
    """Batch upsert hail event rows to Supabase via REST API."""
    if not SUPABASE_SERVICE_KEY:
        log.error("SUPABASE_SERVICE_KEY not set — skipping upsert")
        return

    url = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}?on_conflict=event_date,lat,lon"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    total    = len(rows)
    inserted = 0
    for i in range(0, total, UPSERT_BATCH):
        batch = rows[i:i + UPSERT_BATCH]
        resp  = requests.post(url, headers=headers, json=batch, timeout=60)
        if resp.status_code not in (200, 201):
            log.error(f"Supabase upsert error {resp.status_code}: {resp.text[:200]}")
        else:
            inserted += len(batch)
            log.info(f"  Upserted {inserted}/{total} rows for {date_str}")

    log.info(f"Done — {inserted}/{total} rows upserted for {date_str}")


# ── Main ──────────────────────────────────────────────────────────────────────
def process_date(date_str: str):
    log.info(f"=== Processing {date_str} ===")

    # Find the last GRIB2 file of the day (end-of-day max MESH)
    log.info(f"Listing S3 keys for {date_str}...")
    try:
        keys = list_s3_keys(date_str)
    except Exception as e:
        log.error(f"S3 list error: {e} — skipping")
        return

    if not keys:
        log.warning(f"No MRMS files on S3 for {date_str} — skipping")
        return

    s3_key = keys[-1]  # last file = end-of-day max MESH
    log.info(f"Using: {s3_key} ({len(keys)} files available)")

    # Download and decode
    log.info("Downloading GRIB2...")
    try:
        grib2_bytes = download_grib2(s3_key)
    except Exception as e:
        log.error(f"Download error: {e} — skipping")
        return
    log.info(f"Downloaded {len(grib2_bytes):,} bytes (uncompressed)")

    log.info("Decoding GRIB2 MESH data...")
    try:
        hail_cells = decode_mrms_grib2(grib2_bytes, MIN_HAIL_INCHES)
    except Exception as e:
        log.error(f"GRIB2 decode error: {e} — skipping")
        return
    log.info(f"Found {len(hail_cells):,} hail cells >= {MIN_HAIL_INCHES}\" for {date_str}")

    if not hail_cells:
        log.info(f"No qualifying hail events for {date_str}")
        return

    # Deduplicate: keep max hail_in per (lat, lon) — rounding can cause multiple
    # grid points to map to the same coordinate pair.
    dedup: dict[tuple, float] = {}
    for c in hail_cells:
        key = (c['lat'], c['lon'])
        if key not in dedup or c['hail_in'] > dedup[key]:
            dedup[key] = c['hail_in']

    rows = [
        {
            "event_date":   date_str,
            "lat":          lat,
            "lon":          lon,
            "hail_size_in": hail_in,
        }
        for (lat, lon), hail_in in dedup.items()
    ]
    log.info(f"After dedup: {len(rows):,} unique grid cells for {date_str}")

    # Upsert
    upsert_to_supabase(rows, date_str)


def main():
    args = sys.argv[1:]
    if not args:
        # Default: yesterday
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        dates = [yesterday]
    elif len(args) == 1:
        dates = [args[0]]
    elif len(args) == 2:
        # Date range: start end (inclusive)
        start = datetime.date.fromisoformat(args[0])
        end   = datetime.date.fromisoformat(args[1])
        dates = []
        d = start
        while d <= end:
            dates.append(d.isoformat())
            d += datetime.timedelta(days=1)
    else:
        print("Usage: mrms_backfill.py [start_date [end_date]]")
        sys.exit(1)

    log.info(f"Backfilling {len(dates)} date(s): {dates[0]} to {dates[-1]}")
    for date_str in dates:
        process_date(date_str)

    log.info("Backfill complete!")


if __name__ == "__main__":
    main()
