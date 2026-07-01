#!/usr/bin/env python3
"""Update the '4-Photo Grid' / '5-Photo Grid' template in Supabase with corrected layout."""
import json, urllib.request, urllib.error

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
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def sb_patch(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=body,
        headers={**HEADERS, "Prefer": "return=representation"},
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

# Load the new template JSON
with open("template1_v2.json") as f:
    t = json.load(f)

# Find the existing template (could be named '4-Photo Grid' or '5-Photo Grid')
existing = sb_get("canvas_templates?name=eq.4-Photo%20Grid&select=id,name,sort_order")
if not existing:
    existing = sb_get("canvas_templates?name=eq.5-Photo%20Grid&select=id,name,sort_order")

if not existing:
    print("❌ Template not found in DB — run insert_template1.py first")
    exit(1)

template_id = existing[0]["id"]
print(f"Found template id={template_id}, name='{existing[0]['name']}'")

# Patch with new content
payload = {
    "name": t["name"],
    "description": t["description"],
    "trade": t["trade"],
    "front_json": t["front_json"],
    "back_json": t["back_json"],
    "is_published": True,
    "updated_at": __import__("time").strftime("%Y-%m-%dT%H:%M:%SZ", __import__("time").gmtime())
}

status, data = sb_patch(f"canvas_templates?id=eq.{template_id}", payload)
if status in (200, 201):
    updated = data[0] if isinstance(data, list) else data
    print(f"✅ Updated template '{updated.get('name')}' (id={updated.get('id')})")
    print(f"   Front objects: {len(t['front_json']['objects'])}")
    print(f"   Back objects:  {len(t['back_json']['objects'])}")
else:
    print(f"❌ Update failed (HTTP {status}): {data}")
