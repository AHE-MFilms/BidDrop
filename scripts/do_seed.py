#!/usr/bin/env python3
"""Seed canvas_templates directly into Supabase using the service role key."""
import json, sys, urllib.request, urllib.error

SUPABASE_URL = "https://gtwbhxnrmfmdenogzuea.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d2JoeG5ybWZtZGVub2d6dWVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMjAwMSwiZXhwIjoyMDkwMzc4MDAxfQ.UdxoP59JF42z6w5pF2Jf3N5LT9mhQ-Ls-OLi-2S5HRI"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def sb_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", data=body, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# Load seed templates
with open("seed_templates.json") as f:
    templates = json.load(f)

print(f"Loaded {len(templates)} templates from seed_templates.json")

# Check existing templates
existing = sb_get("canvas_templates?select=name")
existing_names = {t["name"] for t in existing}
print(f"Existing templates in DB: {existing_names or 'none'}")

inserted = 0
skipped = 0
for t in templates:
    if t.get("name") in existing_names:
        print(f"  SKIP (exists): {t['name']}")
        skipped += 1
        continue
    status, body = sb_post("canvas_templates", t)
    if status in (200, 201):
        print(f"  ✅ Inserted: {t['name']}")
        inserted += 1
    else:
        print(f"  ❌ Failed ({status}): {t['name']} — {body[:200]}")

print(f"\nDone. Inserted: {inserted}, Skipped: {skipped}")
