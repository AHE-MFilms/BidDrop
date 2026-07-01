#!/usr/bin/env python3
"""Create canvas_templates table and seed it directly via Supabase SQL API."""
import json, urllib.request, urllib.error

PROJECT_ID   = "gtwbhxnrmfmdenogzuea"
SUPABASE_URL = f"https://{PROJECT_ID}.supabase.co"
MGMT_TOKEN   = "REDACTED_TOKEN"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d2JoeG5ybWZtZGVub2d6dWVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMjAwMSwiZXhwIjoyMDkwMzc4MDAxfQ.UdxoP59JF42z6w5pF2Jf3N5LT9mhQ-Ls-OLi-2S5HRI"

REST_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def run_sql(sql):
    """Run SQL via Supabase Management API."""
    url = f"https://api.supabase.com/v1/projects/{PROJECT_ID}/database/query"
    body = json.dumps({"query": sql}).encode()
    req = urllib.request.Request(url, data=body, headers={
        "Authorization": f"Bearer {MGMT_TOKEN}",
        "Content-Type": "application/json"
    }, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def sb_post(path, data):
    """Insert a row via REST API."""
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=REST_HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=REST_HEADERS)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return []

# ── Step 1: Create the canvas_templates table ──────────────────────────────
print("Step 1: Creating canvas_templates table...")
create_sql = """
CREATE TABLE IF NOT EXISTS canvas_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  trade       TEXT DEFAULT 'roofing',
  front_json  JSONB,
  back_json   JSONB,
  thumbnail   TEXT,
  is_published BOOLEAN DEFAULT false,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_canvas_templates_trade ON canvas_templates(trade);
CREATE INDEX IF NOT EXISTS idx_canvas_templates_published ON canvas_templates(is_published);
"""
status, body = run_sql(create_sql)
print(f"  Table creation: {status} — {body[:200]}")

# ── Step 2: Load seed templates ────────────────────────────────────────────
print("\nStep 2: Loading seed templates...")
with open("seed_templates.json") as f:
    templates = json.load(f)
print(f"  Loaded {len(templates)} templates")

# ── Step 3: Check existing ─────────────────────────────────────────────────
existing = sb_get("canvas_templates?select=name")
existing_names = {t["name"] for t in existing} if isinstance(existing, list) else set()
print(f"  Existing: {existing_names or 'none'}")

# ── Step 4: Insert each template ───────────────────────────────────────────
print("\nStep 3: Inserting templates...")
inserted = 0
skipped = 0
for t in templates:
    if t.get("name") in existing_names:
        print(f"  SKIP (exists): {t['name']}")
        skipped += 1
        continue
    # Ensure is_published is True so contractors can see them
    t["is_published"] = True
    status, body = sb_post("canvas_templates", t)
    if status in (200, 201):
        print(f"  ✅ Inserted: {t['name']}")
        inserted += 1
    else:
        print(f"  ❌ Failed ({status}): {t['name']} — {body[:300]}")

print(f"\n✅ Done. Inserted: {inserted}, Skipped: {skipped}")
