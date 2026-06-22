#!/usr/bin/env python3
"""
Patches index.html to:
1. Insert <script src="/src/auth.js"></script> after campaign.js
2. Remove fetchMasterLobKey, onSignedIn, onSignedOut, showLoginScreen,
   hideLoginScreen, doLogin, showForgotPassword, showSignIn,
   showSetNewPassword, doForgotPassword, doSetNewPassword, doLogout
"""
import shutil

INPUT  = 'index.html'
BACKUP = 'index.html.bak9'

with open(INPUT, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"Original length: {len(content.splitlines())} lines")
shutil.copy(INPUT, BACKUP)

def remove_block(text, start_marker, end_marker, label):
    idx = text.find(start_marker)
    if idx == -1:
        print(f"  WARNING: start of '{label}' not found")
        return text
    end_idx = text.find(end_marker, idx)
    if end_idx == -1:
        print(f"  WARNING: end of '{label}' not found")
        return text
    removed = text[idx:end_idx]
    print(f"  Removed {label} ({len(removed.splitlines())} lines)")
    return text[:idx] + text[end_idx:]

# 1. fetchMasterLobKey (ends at onSignedIn)
content = remove_block(content,
    "async function fetchMasterLobKey(){",
    "async function onSignedIn(user){",
    "fetchMasterLobKey")

# 2. onSignedIn (ends at onSignedOut)
content = remove_block(content,
    "async function onSignedIn(user){",
    "\nfunction onSignedOut(){",
    "onSignedIn")

# 3. onSignedOut (ends at showLoginScreen)
content = remove_block(content,
    "\nfunction onSignedOut(){",
    "\nfunction showLoginScreen(){",
    "onSignedOut")

# 4. showLoginScreen (ends at hideLoginScreen)
content = remove_block(content,
    "\nfunction showLoginScreen(){",
    "\nfunction hideLoginScreen(){",
    "showLoginScreen")

# 5. hideLoginScreen (ends at doLogin)
content = remove_block(content,
    "\nfunction hideLoginScreen(){",
    "\nasync function doLogin(){",
    "hideLoginScreen")

# 6. doLogin (ends at showForgotPassword comment)
content = remove_block(content,
    "\nasync function doLogin(){",
    "\n// ─── FORGOT PASSWORD FLOW",
    "doLogin")

# 7. Forgot password comment + showForgotPassword through doLogout
content = remove_block(content,
    "\n// ─── FORGOT PASSWORD FLOW",
    "\n// ── CANVASS AREAS",
    "forgot/set-pw/doLogout block")

# 8. Insert script tag after campaign.js
camp_tag = '<script src="/src/campaign.js"></script>'
auth_tag = '<script src="/src/auth.js"></script>'
if camp_tag in content:
    content = content.replace(camp_tag, camp_tag + '\n' + auth_tag, 1)
    print("  Inserted auth.js tag after campaign.js tag")
else:
    print("  WARNING: campaign.js tag not found!")

with open(INPUT, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. New file: {len(content.splitlines())} lines")
