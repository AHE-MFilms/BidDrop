#!/usr/bin/env python3
"""Insert the '4-Photo Grid' template directly into Supabase canvas_templates table.
Skips if a template with that name already exists.
Re-numbers existing templates to sort_order 1..N so the new one takes sort_order=0."""
import json, urllib.request, urllib.error, time, uuid

PROJECT_ID   = "gtwbhxnrmfmdenogzuea"
SUPABASE_URL = f"https://{PROJECT_ID}.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d2JoeG5ybWZtZGVub2d6dWVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMjAwMSwiZXhwIjoyMDkwMzc4MDAxfQ.UdxoP59JF42z6w5pF2Jf3N5LT9mhQ-Ls-OLi-2S5HRI"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def sb_get(path):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={**HEADERS, "Prefer": "return=representation"}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def sb_patch(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=body,
        headers={**HEADERS, "Prefer": "return=minimal"},
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def sb_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=body,
        headers=HEADERS,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# ── Check if template already exists ──────────────────────────────────────────
existing = sb_get("canvas_templates?name=eq.4-Photo%20Grid&select=id,name")
if existing:
    print(f"Template '4-Photo Grid' already exists (id={existing[0]['id']}). Nothing to do.")
    exit(0)

# ── Load template JSON ─────────────────────────────────────────────────────────
with open("seed_templates.json") as f:
    templates = json.load(f)

t1 = next((t for t in templates if t["name"] == "4-Photo Grid"), None)
if not t1:
    print("ERROR: '4-Photo Grid' not found in seed_templates.json")
    exit(1)

# ── Re-number existing templates to sort_order 1..N ───────────────────────────
all_existing = sb_get("canvas_templates?select=id,name,sort_order&order=sort_order.asc,created_at.asc")
print(f"Re-numbering {len(all_existing)} existing templates to sort_order 1..{len(all_existing)}...")
for i, t in enumerate(all_existing):
    new_order = i + 1
    status, err = sb_patch(f"canvas_templates?id=eq.{t['id']}", {"sort_order": new_order})
    if status in (200, 204):
        print(f"  '{t['name']}' → sort_order={new_order}")
    else:
        print(f"  WARNING: '{t['name']}' patch failed ({status}): {err}")

# ── Insert the new template at sort_order=0 ───────────────────────────────────
now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
row = {
    "id": str(uuid.uuid4()),
    "name": t1["name"],
    "description": t1.get("description", ""),
    "trade": t1.get("trade", "roofing"),
    "front_json": t1["front_json"],
    "back_json": t1["back_json"],
    "thumbnail_url": None,
    "is_published": True,
    "is_locked": True,
    "editable_fields": [],
    "sort_order": 0,
    "created_at": now,
    "updated_at": now,
}

status, data = sb_post("canvas_templates", row)
if status in (200, 201):
    inserted = data[0] if isinstance(data, list) else data
    print(f"\n✅ Inserted '4-Photo Grid' with id={inserted.get('id')} at sort_order=0")
else:
    print(f"\n❌ Insert failed (HTTP {status}): {data}")
