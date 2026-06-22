#!/usr/bin/env python3
"""
Patches index.html to:
1. Insert <script src="/src/integrations.js"></script> after ghl.js script tag
2. Remove the integrations section comment header + all 6 functions
"""
import shutil

INPUT  = 'index.html'
BACKUP = 'index.html.bak7'

with open(INPUT, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Original length: {len(content.splitlines())} lines")
shutil.copy(INPUT, BACKUP)

def remove_block(text, start_marker, end_marker, label):
    idx = text.find(start_marker)
    if idx == -1:
        print(f"  WARNING: start of {label} not found")
        return text
    end_idx = text.find(end_marker, idx)
    if end_idx == -1:
        print(f"  WARNING: end of {label} not found")
        return text
    # remove up to but not including the end_marker (which is the next function)
    removed = text[idx:end_idx]
    print(f"  Removed {label} ({len(removed.splitlines())} lines)")
    return text[:idx] + text[end_idx:]

# 1. Remove section comment header + updateIntStatus + refreshAllIntStatuses
content = remove_block(content,
    "// ═══════════════════════════════\n// ── JobNimbus Integration",
    "async function jobberTestConnection(){",
    "section header + updateIntStatus + refreshAllIntStatuses")

# 2. Remove jobberTestConnection
content = remove_block(content,
    "async function jobberTestConnection(){",
    "async function webhookTest(){",
    "jobberTestConnection")

# 3. Remove webhookTest
content = remove_block(content,
    "async function webhookTest(){",
    "async function jnTestConnection(){",
    "webhookTest")

# 4. Remove jnTestConnection
content = remove_block(content,
    "async function jnTestConnection(){",
    "// Upsert a contact in JobNimbus",
    "jnTestConnection")

# 5. Remove jnUpsertContact (ends just before printNow)
content = remove_block(content,
    "// Upsert a contact in JobNimbus",
    "\nfunction printNow(){",
    "jnUpsertContact")

# 6. Insert script tag after ghl.js
ghl_tag = '<script src="/src/ghl.js"></script>'
int_tag = '<script src="/src/integrations.js"></script>'
if ghl_tag in content:
    content = content.replace(ghl_tag, ghl_tag + '\n' + int_tag, 1)
    print("  Inserted integrations.js tag after ghl.js tag")
else:
    print("  WARNING: ghl.js tag not found!")

with open(INPUT, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. New file: {len(content.splitlines())} lines")
