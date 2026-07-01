#!/usr/bin/env python3
"""
Generate corrected '5-Photo Grid' template JSON for BidDrop canvas designer.

FRONT LAYOUT (900x600, representing 6x9 inches at screen resolution):
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Photo 1 (top-left)  │  Photo 2 (top-center) │  Photo 3 (top-right)   │  ← row height: 280px
  ├──────────────────────┴───────────────────────┴────────────────────────┤
  │  Branding Panel (bottom-left, 380px wide)     │  Photo 4 (large hero)  │  ← row height: 320px
  │  [Logo] [QR Code]                             │  (520px wide)          │
  │  "Southeast Michigan's"                       │                        │
  │  "MOST TRUSTED" (yellow)                      │                        │
  │  "DECK BUILDER" (white bold)                  │                        │
  └───────────────────────────────────────────────┴────────────────────────┘
  Note: Photo 5 is the large hero (bottom-right). Total = 5 photo zones.

BACK LAYOUT (900x600):
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Left text panel (380px)  │  Photo 5 (top-center, 260px) │  Photo 6    │  ← top row: 240px
  │  "ENJOY A HASSLE-FREE     │  (portrait/people photo)      │  (top-right │
  │   EXPERIENCE"             ├──────────────────────────────┤  260px)     │
  │  DECK ZERO logo           │  Photo 7 (bottom-center)     │             │
  │  0 RISK / 0 SURPRISES /   │  (deck photo)                │             │
  │  0 HASSLE bullets         │                              │             │
  ├───────────────────────────┴──────────────────────────────┴─────────────┤
  │  Bottom bar (full width, 120px):                                        │
  │  [Logo]  [QR Code]  Website / Phone  │  Mailing address  │  Postage    │
  └─────────────────────────────────────────────────────────────────────────┘
  Note: Photo 8 is the large right photo. Total = 4 photo zones on back.
"""

import json

V = "5.3.1"

def locked_rect(left, top, width, height, fill, **kwargs):
    return {
        "type": "rect", "version": V,
        "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": height,
        "fill": fill, "rx": 0, "ry": 0,
        "bdLock": "locked",
        "selectable": False, "evented": False,
        "hasControls": False, "hasBorders": False,
        **kwargs
    }

def photo_zone(label, left, top, width, height, hint="📷 Upload Photo"):
    return [
        {
            "type": "rect", "version": V,
            "originX": "left", "originY": "top",
            "left": left, "top": top, "width": width, "height": height,
            "bdZoneLabel": label,
            "bdLock": "editable",
            "selectable": True, "evented": True,
            "lockMovementX": True, "lockMovementY": True,
            "lockScalingX": True, "lockScalingY": True,
            "lockRotation": True,
            "hasControls": False, "hasBorders": True,
            "borderColor": "#22c55e",
            "strokeDashArray": [6, 4],
            "stroke": "#22c55e",
            "strokeWidth": 2,
            "fill": "rgba(34,197,94,0.08)"
        },
        {
            "type": "textbox", "version": V,
            "originX": "left", "originY": "top",
            "left": left + 10, "top": top + height // 2 - 12,
            "width": width - 20, "height": 0,
            "text": hint,
            "fontSize": 13, "fontFamily": "Arial",
            "fill": "rgba(34,197,94,0.7)",
            "textAlign": "center",
            "bdLock": "locked",
            "selectable": False, "evented": False,
            "hasControls": False, "hasBorders": False
        }
    ]

def logo_zone(left, top, width, height):
    return [
        {
            "type": "rect", "version": V,
            "originX": "left", "originY": "top",
            "left": left, "top": top, "width": width, "height": height,
            "bdZoneLabel": "logo",
            "bdLock": "editable",
            "selectable": True, "evented": True,
            "lockMovementX": True, "lockMovementY": True,
            "lockScalingX": True, "lockScalingY": True,
            "lockRotation": True,
            "hasControls": False, "hasBorders": True,
            "borderColor": "#F25C05",
            "strokeDashArray": [4, 3],
            "stroke": "#F25C05",
            "strokeWidth": 2,
            "fill": "rgba(242,92,5,0.06)"
        },
        {
            "type": "textbox", "version": V,
            "originX": "left", "originY": "top",
            "left": left + 4, "top": top + height // 2 - 10,
            "width": width - 8, "height": 0,
            "text": "🏠 Upload Logo",
            "fontSize": 11, "fontFamily": "Arial",
            "fill": "rgba(242,92,5,0.8)",
            "textAlign": "center",
            "bdLock": "locked",
            "selectable": False, "evented": False,
            "hasControls": False, "hasBorders": False
        }
    ]

def qr_zone(left, top, size):
    return [
        {
            "type": "rect", "version": V,
            "originX": "left", "originY": "top",
            "left": left, "top": top, "width": size, "height": size,
            "bdZoneLabel": "qr_code",
            "bdLock": "locked",
            "selectable": False, "evented": False,
            "hasControls": False, "hasBorders": True,
            "borderColor": "#ffffff",
            "stroke": "#ffffff",
            "strokeWidth": 1,
            "fill": "rgba(255,255,255,0.15)"
        },
        {
            "type": "textbox", "version": V,
            "originX": "left", "originY": "top",
            "left": left + 2, "top": top + size // 2 - 14,
            "width": size - 4, "height": 0,
            "text": "QR\n(auto)",
            "fontSize": 10, "fontFamily": "Arial",
            "fill": "rgba(255,255,255,0.6)",
            "textAlign": "center",
            "bdLock": "locked",
            "selectable": False, "evented": False,
            "hasControls": False, "hasBorders": False
        }
    ]

def editable_text(label, left, top, width, text, font_size, fill, bold=False, align="left"):
    return {
        "type": "textbox", "version": V,
        "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": 0,
        "bdZoneLabel": label,
        "bdLock": "editable",
        "text": text,
        "fontSize": font_size,
        "fontFamily": "Arial",
        "fontWeight": "bold" if bold else "normal",
        "fill": fill,
        "textAlign": align,
        "selectable": True, "evented": True,
        "lockMovementX": True, "lockMovementY": True,
        "lockScalingX": True, "lockScalingY": True,
        "lockRotation": True,
        "hasControls": False, "hasBorders": True,
        "borderColor": "#F25C05"
    }

def locked_text(left, top, width, text, font_size, fill, bold=False, align="left"):
    return {
        "type": "textbox", "version": V,
        "originX": "left", "originY": "top",
        "left": left, "top": top, "width": width, "height": 0,
        "bdLock": "locked",
        "text": text,
        "fontSize": font_size,
        "fontFamily": "Arial",
        "fontWeight": "bold" if bold else "normal",
        "fill": fill,
        "textAlign": align,
        "selectable": False, "evented": False,
        "hasControls": False, "hasBorders": False
    }

# ══════════════════════════════════════════════════════════════════════════════
# FRONT JSON  (900 × 600)
# Layout:
#   Top row (y=0..279):   3 equal photos, each 300×280
#   Bottom-left (y=280..599): dark branding panel, 380×320
#   Bottom-right (y=280..599): large hero photo, 520×320
# ══════════════════════════════════════════════════════════════════════════════

TOP_H = 280          # top row height
BOT_H = 320          # bottom row height
PANEL_W = 380        # branding panel width
HERO_W = 520         # hero photo width
W = 900
H = 600
TOP_PHOTO_W = W // 3  # = 300

front_objects = []

# Background
front_objects.append(locked_rect(0, 0, W, H, "#1a1a1a"))

# ── Top row: 3 equal photos ──────────────────────────────────────────────────
for i in range(3):
    x = i * TOP_PHOTO_W
    front_objects.extend(photo_zone(f"photo{i+1}", x, 0, TOP_PHOTO_W, TOP_H, f"📷 Photo {i+1}"))

# Thin separator line between top and bottom rows
front_objects.append(locked_rect(0, TOP_H, W, 2, "#ffffff"))

# ── Bottom-left: dark branding panel ─────────────────────────────────────────
# Dark wood-grain style background
front_objects.append(locked_rect(0, TOP_H, PANEL_W, BOT_H, "#2c2c2c"))
# Subtle texture overlay
front_objects.append(locked_rect(0, TOP_H, PANEL_W, BOT_H, "rgba(0,0,0,0.3)"))

# Logo zone (top-left of panel)
front_objects.extend(logo_zone(16, TOP_H + 14, 130, 70))

# QR code zone (top-right of panel)
front_objects.extend(qr_zone(PANEL_W - 110, TOP_H + 14, 90))

# Subheadline: "Southeast Michigan's"
front_objects.append(editable_text(
    "subheadline", 16, TOP_H + 100, PANEL_W - 32,
    "Southeast Michigan's", 15, "#ffffff", bold=False
))

# Headline line 1: "MOST TRUSTED" in yellow
front_objects.append(editable_text(
    "headline1", 16, TOP_H + 122, PANEL_W - 32,
    "MOST TRUSTED", 34, "#FFD700", bold=True
))

# Headline line 2: "DECK BUILDER" in white
front_objects.append(editable_text(
    "headline2", 16, TOP_H + 168, PANEL_W - 32,
    "DECK BUILDER", 34, "#ffffff", bold=True
))

# Phone
front_objects.append(editable_text(
    "phone", 16, TOP_H + 218, PANEL_W - 32,
    "555-555-5555", 13, "#cccccc"
))

# Website
front_objects.append(editable_text(
    "website", 16, TOP_H + 238, PANEL_W - 32,
    "www.yourcompany.com", 13, "#cccccc"
))

# Thin vertical separator between panel and hero
front_objects.append(locked_rect(PANEL_W, TOP_H, 2, BOT_H, "#ffffff"))

# ── Bottom-right: large hero photo (Photo 5) ─────────────────────────────────
front_objects.extend(photo_zone("photo5", PANEL_W + 2, TOP_H, HERO_W - 2, BOT_H, "📷 Photo 5 (Hero)"))

front_json = {
    "version": V,
    "objects": front_objects,
    "background": "#1a1a1a"
}

# ══════════════════════════════════════════════════════════════════════════════
# BACK JSON  (900 × 600)
# Layout:
#   Top section (y=0..479, h=480):
#     Left text panel: 0..369 (370px wide)
#     Center column:  370..629 (260px wide) — 2 stacked photos (each 240px tall)
#     Right photo:    630..899 (270px wide, full 480px tall)
#   Bottom bar (y=480..599, h=120):
#     Logo | QR | Website/Phone | Mailing address | Postage box
# ══════════════════════════════════════════════════════════════════════════════

TEXT_W = 370
CTR_W  = 260
RT_W   = 270
TOP_SECTION_H = 480
BAR_H = 120

back_objects = []

# White background (standard postcard back)
back_objects.append(locked_rect(0, 0, W, H, "#ffffff"))

# ── Left text panel (dark background) ────────────────────────────────────────
back_objects.append(locked_rect(0, 0, TEXT_W, TOP_SECTION_H, "#2c2c2c"))
# Subtle dark photo bg behind text
back_objects.append(locked_rect(0, 0, TEXT_W, TOP_SECTION_H, "rgba(0,0,0,0.45)"))

# "ENJOY" in yellow
back_objects.append(locked_text(20, 28, TEXT_W - 40, "ENJOY", 28, "#FFD700", bold=True))
# "A HASSLE-FREE" in white
back_objects.append(locked_text(20, 64, TEXT_W - 40, "A HASSLE-FREE", 26, "#ffffff", bold=True))
# "EXPERIENCE" in yellow
back_objects.append(locked_text(20, 98, TEXT_W - 40, "EXPERIENCE", 26, "#FFD700", bold=True))

# DECK ZERO label
back_objects.append(locked_text(20, 144, TEXT_W - 40, "⬡ DECK ZERO", 13, "#ffffff", bold=True))

# Bullet points
bullets = [
    ("0 RISK:", "Backed by a lifetime warranty and 250+\n5-star reviews, we prioritize your experience."),
    ("0 SURPRISES:", "The price we quote is the price you pay.\nIf our costs go up, your price does not."),
    ("0 HASSLE:", "We handle everything, start on time, and\ncommunicate every step."),
]
y_bullet = 172
for label, body in bullets:
    back_objects.append(locked_text(20, y_bullet, 50, label, 11, "#FFD700", bold=True))
    back_objects.append(locked_text(74, y_bullet, TEXT_W - 94, body, 10, "#dddddd"))
    y_bullet += 52

# ── Center column: 2 stacked photos ──────────────────────────────────────────
STACKED_H = TOP_SECTION_H // 2  # 240 each
back_objects.extend(photo_zone("back_photo1", TEXT_W, 0, CTR_W, STACKED_H, "📷 Photo 6"))
back_objects.append(locked_rect(TEXT_W, STACKED_H, CTR_W, 2, "#ffffff"))
back_objects.extend(photo_zone("back_photo2", TEXT_W, STACKED_H + 2, CTR_W, STACKED_H - 2, "📷 Photo 7"))

# ── Right column: 1 large photo ──────────────────────────────────────────────
back_objects.extend(photo_zone("back_photo3", TEXT_W + CTR_W, 0, RT_W, TOP_SECTION_H, "📷 Photo 8"))

# Thin horizontal separator above bottom bar
back_objects.append(locked_rect(0, TOP_SECTION_H, W, 2, "#cccccc"))

# ── Bottom bar ────────────────────────────────────────────────────────────────
back_objects.append(locked_rect(0, TOP_SECTION_H + 2, W, BAR_H - 2, "#f5f5f5"))

# Logo zone in bottom bar
back_objects.extend(logo_zone(14, TOP_SECTION_H + 14, 110, 90))

# QR code in bottom bar
back_objects.extend(qr_zone(138, TOP_SECTION_H + 18, 80))

# Website (editable)
back_objects.append(editable_text(
    "back_website", 230, TOP_SECTION_H + 26, 160,
    "www.yourcompany.com", 12, "#1a1a1a", bold=True
))
# Phone (editable)
back_objects.append(editable_text(
    "back_phone", 230, TOP_SECTION_H + 52, 160,
    "555-555-5555", 13, "#1a1a1a", bold=True
))

# Vertical divider
back_objects.append(locked_rect(400, TOP_SECTION_H + 10, 1, BAR_H - 20, "#cccccc"))

# Mailing address block (auto-filled at send time)
back_objects.append(locked_text(
    412, TOP_SECTION_H + 16, 340,
    "Program Headquarters\nP.O. Box 3031\nMalvern, PA 19355\n\nCURRENT RESIDENT\n123 Main Street\nAnytown, ST 00000",
    9, "#555555"
))

# Postage box
back_objects.append(locked_rect(830, TOP_SECTION_H + 12, 58, 70, "#ffffff",
    stroke="#aaaaaa", strokeWidth=1))
back_objects.append(locked_text(831, TOP_SECTION_H + 14, 56,
    "PRSRT\nFIRST-CLASS\nU.S. POSTAGE\nPAID", 7, "#555555", align="center"))

back_json = {
    "version": V,
    "objects": back_objects,
    "background": "#ffffff"
}

# ── Output ────────────────────────────────────────────────────────────────────
result = {
    "name": "5-Photo Grid",
    "description": "6×9 print-ready postcard. Front: 3 photos top row + branding panel + large hero photo. Back: text panel + 2 stacked photos + large photo + contact bar.",
    "trade": "general",
    "front_json": front_json,
    "back_json": back_json,
    "published": True
}

with open("template1_v2.json", "w") as f:
    json.dump(result, f, indent=2)

print("✅ template1_v2.json written")
print(f"   Front objects: {len(front_objects)}")
print(f"   Back objects:  {len(back_objects)}")
