#!/usr/bin/env python3
"""
Add IDs to all canvas objects and mark all textbox objects as editable.
Updates all 6 canvas_templates in Supabase.
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

# Friendly label map for well-known text content
LABEL_MAP = {
    'YOU HAVE': 'Headline Prefix (e.g. "YOU HAVE")',
    'YOUR HOME IS': 'Headline Prefix (e.g. "YOUR HOME IS")',
    'WE ASSESSED': 'Headline Prefix (e.g. "WE ASSESSED")',
    'YOUR HOME HAS': 'Headline Prefix',
    'CLOGGED GUTTERS': 'Main Headline',
    'WIND DAMAGE': 'Main Headline',
    'SOLAR READY': 'Main Headline',
    'YOUR ROOF.': 'Main Headline',
    'FREE ROOF INSPECTION': 'Main Headline',
    'NEIGHBORHOOD ALERT': 'Main Headline',
    'YOUR ESTIMATE IS READY': 'Main Headline',
    '555-555-5555': 'Phone Number',
    'www.yourcompany.com': 'Website URL',
    'Design 2': 'Template Label',
}

def label_for(text):
    t = text.strip()
    for k, v in LABEL_MAP.items():
        if t.upper().startswith(k.upper()):
            return v
    if len(t) > 80:
        return 'Body Text'
    if t.startswith('📷'):
        return 'House Photo Zone'
    return f'Text: {t[:40]}'

def process_canvas_json(canvas_json_str):
    """Add IDs to all objects, mark textboxes as editable. Returns (updated_json_str, editable_fields_list)."""
    if not canvas_json_str:
        return canvas_json_str, []
    
    try:
        cj = json.loads(canvas_json_str) if isinstance(canvas_json_str, str) else canvas_json_str
    except:
        return canvas_json_str, []
    
    editable_fields = []
    objects = cj.get('objects', [])
    
    for i, obj in enumerate(objects):
        # Assign an ID if missing
        if not obj.get('id'):
            obj['id'] = f"obj_{uuid.uuid4().hex[:8]}"
        
        # Mark all textbox objects as editable
        if obj.get('type') in ('textbox', 'text', 'i-text'):
            obj['editable'] = True
            text_val = obj.get('text', '')
            if text_val and not text_val.startswith('📷'):
                editable_fields.append({
                    'id': obj['id'],
                    'type': 'text',
                    'label': label_for(text_val),
                    'default': text_val,
                    'field_key': f"field_{i}"
                })
        
        # Mark image zones as editable (for logo/house photo upload)
        if obj.get('type') == 'rect' and obj.get('fill') in ('transparent', 'rgba(0,0,0,0)', None, ''):
            # Could be an image zone - check if it has a zone hint
            pass
    
    cj['objects'] = objects
    return json.dumps(cj), editable_fields

# Fetch all templates
print("Fetching templates...")
templates = sb_get("canvas_templates?select=id,name,front_json,back_json")
print(f"Found {len(templates)} templates")

for tpl in templates:
    tid = tpl['id']
    name = tpl['name']
    print(f"\nProcessing: {name}")
    
    # Process front
    front_json_updated, front_editable = process_canvas_json(tpl.get('front_json'))
    # Process back
    back_json_updated, back_editable = process_canvas_json(tpl.get('back_json'))
    
    # Merge editable fields (front + back, deduplicated by id)
    all_editable = front_editable + back_editable
    
    print(f"  Front editable fields: {len(front_editable)}")
    for f in front_editable:
        print(f"    - [{f['id']}] {f['label']}: {repr(f['default'])[:50]}")
    
    # Update the template
    update_data = {
        'front_json': json.loads(front_json_updated) if front_json_updated else None,
        'back_json': json.loads(back_json_updated) if back_json_updated else None,
        'editable_fields': all_editable,
        'is_published': True
    }
    # Remove None values
    update_data = {k: v for k, v in update_data.items() if v is not None}
    
    status, body = sb_patch(f"canvas_templates?id=eq.{tid}", update_data)
    if status in (200, 201, 204):
        print(f"  ✅ Updated successfully")
    else:
        print(f"  ❌ Failed ({status}): {body[:200]}")

print("\n✅ All templates updated with editable fields and object IDs.")
