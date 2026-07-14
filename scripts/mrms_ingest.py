#!/usr/bin/env python3
"""
scripts/mrms_ingest.py
======================
Nightly NOAA MRMS MESH (Maximum Estimated Size of Hail) ingestion pipeline.

What it does:
  1. Downloads yesterday's MRMS MESH GRIB2 file from NOAA's public S3 bucket
     (noaa-mrms-pds) — completely free, no API key required.
  2. Parses the GRIB2 grid using cfgrib/xarray, filters to cells with
     hail >= 0.5 inches (significant hail threshold).
  3. Batch-upserts into the Supabase `mrms_hail_events` table.
  4. Cleans up local temp files.

Run manually:
  SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... python3 scripts/mrms_ingest.py

GitHub Actions runs this nightly at 06:00 UTC (after NOAA publishes yesterday's data).

Dependencies (installed in workflow):
  boto3, cfgrib, xarray, numpy, requests, supabase-py (or direct REST calls)
"""

import os
import sys
import json
import gzip
import shutil
import tempfile
import datetime
import logging
import math

import boto3
from botocore import UNSIGNED
from botocore.config import Config
import xarray as xr
import numpy as np
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S"
)
log = logging.getLogger("mrms_ingest")

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
SUPABASE_TABLE = "mrms_hail_events"

# NOAA MRMS public S3 bucket (no auth required)
S3_BUCKET = "noaa-mrms-pds"
# MESH product path pattern: MESH/YYYYMMDD/MRMS_MESH_00.00_YYYYMMDD-HHMMSS.grib2.gz
# We want the daily max MESH composite — NOAA publishes one per 2-minute interval.
# We'll grab all files for the target date and keep the max per grid cell.
MESH_PREFIX_TEMPLATE = "CONUS/MergedReflectivityQCComposite_00.50/{year}{month}{day}/"

# Actually the MESH product is under:
MESH_PRODUCT_PREFIX = "CONUS/MESH/{year}{month}{day}/"

# Minimum hail size to store (inches)
MIN_HAIL_INCHES = 0.5

# Batch size for Supabase upserts
UPSERT_BATCH = 500

# Grid resolution — MRMS is ~1km, we'll round lat/lng to 3 decimal places
# to merge nearby cells and reduce row count
GRID_PRECISION = 3  # ~111m per 0.001 degree


def get_target_date(days_ago: int = 1) -> datetime.date:
    return datetime.date.today() - datetime.timedelta(days=days_ago)


def list_mesh_files(s3_client, date: datetime.date) -> list[str]:
    """List all MRMS MESH GRIB2 files for a given date."""
    prefix = f"CONUS/MESH/{date.strftime('%Y%m%d')}/"
    log.info(f"Listing S3 objects: s3://{S3_BUCKET}/{prefix}")
    paginator = s3_client.get_paginator("list_objects_v2")
    keys = []
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key.endswith(".grib2.gz") or key.endswith(".grib2"):
                keys.append(key)
    log.info(f"Found {len(keys)} MESH files for {date}")
    return keys


def download_file(s3_client, key: str, dest_path: str) -> str:
    """Download a file from S3 to dest_path. Handles .gz decompression."""
    log.info(f"Downloading s3://{S3_BUCKET}/{key}")
    s3_client.download_file(S3_BUCKET, key, dest_path)
    if dest_path.endswith(".gz"):
        out_path = dest_path[:-3]
        with gzip.open(dest_path, "rb") as f_in, open(out_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
        os.remove(dest_path)
        return out_path
    return dest_path


def parse_mesh_grib2(filepath: str) -> dict[tuple, float]:
    """
    Parse a MRMS MESH GRIB2 file.
    Returns a dict mapping (lat_rounded, lon_rounded) -> max_hail_inches.
    Only includes cells with hail >= MIN_HAIL_INCHES.
    """
    try:
        ds = xr.open_dataset(filepath, engine="cfgrib", errors="ignore")
    except Exception as e:
        log.warning(f"cfgrib failed on {filepath}: {e}")
        return {}

    # Find the MESH variable — could be named 'unknown', 'MESH', 'mesh', etc.
    var_name = None
    for v in ds.data_vars:
        arr = ds[v].values
        if arr.ndim == 2 and arr.shape[0] > 100:
            var_name = v
            break

    if var_name is None:
        log.warning(f"No 2D variable found in {filepath}")
        ds.close()
        return {}

    data = ds[var_name].values  # shape: (lat, lon), values in mm
    lats = ds.latitude.values
    lons = ds.longitude.values
    ds.close()

    # Convert mm to inches (1 mm = 0.0393701 inches)
    data_inches = data * 0.0393701

    cells = {}
    # Flatten and filter
    lat_grid, lon_grid = np.meshgrid(lats, lons, indexing="ij") if lats.ndim == 1 else (lats, lons)

    flat_data = data_inches.flatten()
    flat_lat = lat_grid.flatten()
    flat_lon = lon_grid.flatten()

    mask = (flat_data >= MIN_HAIL_INCHES) & np.isfinite(flat_data)
    for val, lat, lon in zip(flat_data[mask], flat_lat[mask], flat_lon[mask]):
        # Normalize lon to -180..180
        if lon > 180:
            lon -= 360
        key = (round(float(lat), GRID_PRECISION), round(float(lon), GRID_PRECISION))
        if key not in cells or cells[key] < val:
            cells[key] = float(val)

    return cells


def upsert_to_supabase(rows: list[dict], date: datetime.date):
    """Batch upsert hail event rows to Supabase via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",  # upsert on conflict
    }

    total = len(rows)
    inserted = 0
    for i in range(0, total, UPSERT_BATCH):
        batch = rows[i : i + UPSERT_BATCH]
        resp = requests.post(url, headers=headers, json=batch, timeout=30)
        if resp.status_code not in (200, 201):
            log.error(f"Supabase upsert error {resp.status_code}: {resp.text[:200]}")
        else:
            inserted += len(batch)
            log.info(f"Upserted {inserted}/{total} rows")

    log.info(f"Done — {inserted} rows upserted for {date}")


def run(days_ago: int = 1):
    target_date = get_target_date(days_ago)
    log.info(f"Starting MRMS MESH ingestion for {target_date}")

    s3 = boto3.client(
        "s3",
        region_name="us-east-1",
        config=Config(signature_version=UNSIGNED),
    )

    keys = list_mesh_files(s3, target_date)
    if not keys:
        log.warning(f"No MESH files found for {target_date}. NOAA may not have published yet.")
        sys.exit(0)

    # Process files in batches to keep memory low — take every Nth file
    # (NOAA publishes every 2 min = 720 files/day; we sample every 30 min = 48 files)
    SAMPLE_EVERY = 15  # every 15 files ≈ every 30 minutes
    sampled_keys = keys[::SAMPLE_EVERY]
    log.info(f"Sampling {len(sampled_keys)} of {len(keys)} files (every {SAMPLE_EVERY})")

    # Accumulate max hail per grid cell across all sampled files
    daily_max: dict[tuple, float] = {}

    with tempfile.TemporaryDirectory() as tmpdir:
        for idx, key in enumerate(sampled_keys):
            fname = os.path.basename(key)
            dest = os.path.join(tmpdir, fname)
            try:
                local_path = download_file(s3, key, dest)
                cells = parse_mesh_grib2(local_path)
                for k, v in cells.items():
                    if k not in daily_max or daily_max[k] < v:
                        daily_max[k] = v
                os.remove(local_path)
                log.info(f"[{idx+1}/{len(sampled_keys)}] {fname} — {len(cells)} cells ≥ {MIN_HAIL_INCHES}\"")
            except Exception as e:
                log.warning(f"Skipping {key}: {e}")
                continue

    if not daily_max:
        log.info(f"No significant hail (≥ {MIN_HAIL_INCHES}\") found for {target_date}")
        sys.exit(0)

    log.info(f"Total unique grid cells with hail ≥ {MIN_HAIL_INCHES}\": {len(daily_max)}")

    # Build rows for Supabase
    date_str = target_date.isoformat()
    rows = [
        {
            "event_date": date_str,
            "lat": lat,
            "lon": lon,
            "hail_size_in": round(size, 2),
        }
        for (lat, lon), size in daily_max.items()
    ]

    upsert_to_supabase(rows, target_date)
    log.info("MRMS ingestion complete ✓")


if __name__ == "__main__":
    days_ago = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    run(days_ago)
