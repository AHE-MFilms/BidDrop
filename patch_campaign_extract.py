#!/usr/bin/env python3
"""
Patches index.html to:
1. Insert <script src="/src/campaign.js"></script> after integrations.js
2. Remove the Nearby Campaign section (lines ~19963–20433)
"""
import shutil

INPUT  = 'index.html'
BACKUP = 'index.html.bak8'

with open(INPUT, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Original length: {len(content.splitlines())} lines")
shutil.copy(INPUT, BACKUP)

# The entire campaign section starts at the comment header and ends
# just before the closing </script> + proposal modal HTML
CAMPAIGN_START = "// NEARBY CAMPAIGN — Address Blitz approach (like DOPE Marketing)"
CAMPAIGN_END   = "\n// ══════════════════════════════════════════════════════════\n</script>"

idx = content.find(CAMPAIGN_START)
end_idx = content.find(CAMPAIGN_END, idx)

if idx == -1:
    print("  WARNING: campaign start not found!")
elif end_idx == -1:
    print("  WARNING: campaign end not found!")
else:
    removed = content[idx:end_idx]
    print(f"  Removing campaign section ({len(removed.splitlines())} lines)")
    # Replace the block with nothing; keep the </script> tag
    content = content[:idx] + content[end_idx + len("\n// ══════════════════════════════════════════════════════════\n"):]
    print("  Campaign section removed")

# Insert script tag after integrations.js
int_tag  = '<script src="/src/integrations.js"></script>'
camp_tag = '<script src="/src/campaign.js"></script>'
if int_tag in content:
    content = content.replace(int_tag, int_tag + '\n' + camp_tag, 1)
    print("  Inserted campaign.js tag after integrations.js tag")
else:
    print("  WARNING: integrations.js tag not found!")

with open(INPUT, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. New file: {len(content.splitlines())} lines")
