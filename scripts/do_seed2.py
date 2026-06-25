#!/usr/bin/env python3
"""Seed canvas_templates directly into Supabase using requests library."""
import json, subprocess

PROJECT_ID   = "gtwbhxnrmfmdenogzuea"
SUPABASE_URL = f"https://{PROJECT_ID}.supabase.co"
MGMT_TOKEN   = "REDACTED_TOKEN"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d2JoeG5ybWZtZGVub2d6dWVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMjAwMSwiZXhwIjoyMDkwMzc4MDAxfQ.UdxoP59JF42z6w5pF2Jf3N5LT9mhQ-Ls-OLi-2S5HRI"

def rest_post(path, data):
    body = json.dumps(data)
    cmd = [
        "curl", "-s", "-X", "POST",
        f"{SUPABASE_URL}/rest/v1/{path}",
        "-H", f"apikey: {SERVICE_KEY}",
        "-H", f"Authorization: Bearer {SERVICE_KEY}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: return=minimal",
        "-d", body,
        "-w", "\n%{http_code}"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    lines = result.stdout.strip().split("\n")
    status = int(lines[-1]) if lines[-1].isdigit() else 0
    body_out = "\n".join(lines[:-1])
    return status, body_out

def rest_get(path):
    cmd = [
        "curl", "-s",
        f"{SUPABASE_URL}/rest/v1/{path}",
        "-H", f"apikey: {SERVICE_KEY}",
        "-H", f"Authorization: Bearer {SERVICE_KEY}"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(result.stdout)
    except:
        return []

# Load seed templates
with open("seed_templates.json") as f:
    templates = json.load(f)
print(f"Loaded {len(templates)} templates from seed_templates.json")

# Check existing
existing = rest_get("canvas_templates?select=name")
existing_names = {t["name"] for t in existing} if isinstance(existing, list) else set()
print(f"Existing templates in DB: {existing_names or 'none'}")

# Insert each template
inserted = 0
skipped = 0
for t in templates:
    if t.get("name") in existing_names:
        print(f"  SKIP (exists): {t['name']}")
        skipped += 1
        continue
    # Rename 'published' -> 'is_published' to match table schema
    if 'published' in t:
        t['is_published'] = t.pop('published')
    else:
        t['is_published'] = True
    status, body = rest_post("canvas_templates", t)
    if status in (200, 201):
        print(f"  ✅ Inserted: {t['name']}")
        inserted += 1
    else:
        print(f"  ❌ Failed ({status}): {t['name']} — {body[:200]}")

print(f"\n✅ Done. Inserted: {inserted}, Skipped: {skipped}")
