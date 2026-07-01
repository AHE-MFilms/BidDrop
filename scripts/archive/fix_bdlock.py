#!/usr/bin/env python3
"""
Add bdLock='editable' to all textbox/text objects in all canvas_templates.
Also adds bdZoneLabel for display in the right panel.
"""
import json, subprocess, uuid

PROJECT_ID   = "gtwbhxnrmfmdenogzuea"
SUPABASE_URL = f"https://{PROJECT_ID}.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0d2JoeG5ybWZtZGVub2d6dWVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMjAwMSwiZXhwIjoyMDkwMzc4MDAxfQ.UdxoP59JF42z6w5pF2Jf3N5LT9mhQ-Ls-OLi-2S5HRI"

def sb_get(path):
    cmd = ["curl", "-s", f"{SUPABASE_URL}/rest/v1/{path}",
           "-H", f"apikey: {SERVICE_KEY}",
           "-H", f"Authorization: Bearer {SERVICE_KEY}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(r.stdout)

def sb_patch(path, data):
    body = json.dumps(data)
    cmd = ["curl", "-s", "-X", "PATCH",
           f"{SUPABASE_URL}/rest/v1/{path}",
           "-H", f"apikey: {SERVICE_KEY}",
           "-H", f"Authorization: Bearer {SERVICE_KEY}",
           "-H", "Content-Type: application/json",
           "-H", "Prefer: return=minimal",
           "-d", body,
           "-w", "\n%{http_code}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    lines = r.stdout.strip().split("\n")
    status = int(lines[-1]) if lines[-1].isdigit() else 0
    return status, "\n".join(lines[:-1])

def label_for_text(text):
    t = text.strip().upper()
    if any(t.startswith(x) for x in ['YOU HAVE', 'YOUR HOME IS', 'WE ASSESSED', 'YOUR HOME HAS']):
        return 'Headline Prefix'
    if any(t.startswith(x) for x in ['WIND DAMAGE', 'SOLAR READY', 'YOUR ROOF', 'FREE ROOF', 'CLOGGED', 'NEIGHBORHOOD', 'YOUR ESTIMATE', 'STORM', 'READY']):
        return 'Main Headline'
    if '555-555' in text or text.strip().replace('-','').replace('(','').replace(')','').replace(' ','').isdigit():
        return 'Phone Number'
    if 'www.' in text.lower() or '.com' in text.lower():
        return 'Website'
    if len(text) > 60:
        return 'Body Text'
    if '✓' in text or '★' in text or '🚨' in text:
        return 'Bullet Points / Badge'
    return 'Text'

def process_side(canvas_json):
    if not canvas_json:
        return canvas_json
    cj = canvas_json if isinstance(canvas_json, dict) else json.loads(canvas_json)
    
    for obj in cj.get('objects', []):
        # Assign ID if missing
        if not obj.get('id'):
            obj['id'] = f"obj_{uuid.uuid4().hex[:8]}"
        
        obj_type = obj.get('type', '')
        text = obj.get('text', '')
        
        if obj_type in ('textbox', 'text', 'i-text'):
            if text and not text.startswith('📷'):
                obj['bdLock'] = 'editable'
                obj['bdZoneLabel'] = label_for_text(text)
                # Make sure selectable in contractor mode
                obj['selectable'] = True
                obj['evented'] = True
            else:
                # Photo hint placeholder - keep as locked visual
                obj['bdLock'] = 'locked'
        elif obj_type == 'rect':
            # Background rects are locked
            obj['bdLock'] = 'locked'
        elif obj_type == 'image':
            # Image zones - mark as editable for logo/photo upload
            obj['bdLock'] = 'editable'
            obj['bdZoneLabel'] = 'Image / Photo'
    
    return cj

# Fetch all templates
print("Fetching templates...")
templates = sb_get("canvas_templates?select=id,name,front_json,back_json")
print(f"Found {len(templates)} templates\n")

for tpl in templates:
    tid = tpl['id']
    name = tpl['name']
    print(f"Processing: {name}")
    
    front = process_side(tpl.get('front_json'))
    back  = process_side(tpl.get('back_json'))
    
    editable_count = sum(1 for o in front.get('objects', []) if o.get('bdLock') == 'editable')
    print(f"  Editable objects on front: {editable_count}")
    for o in front.get('objects', []):
        if o.get('bdLock') == 'editable':
            print(f"    [{o['id']}] {o.get('bdZoneLabel','?')}: {repr(o.get('text',''))[:50]}")
    
    status, body = sb_patch(f"canvas_templates?id=eq.{tid}", {
        'front_json': front,
        'back_json': back
    })
    if status in (200, 201, 204):
        print(f"  ✅ Updated\n")
    else:
        print(f"  ❌ Failed ({status}): {body[:200]}\n")

print("✅ All templates now have bdLock='editable' on text objects.")
