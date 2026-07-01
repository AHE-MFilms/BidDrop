#!/usr/bin/env python3
"""
Generate Template 1: "4-Photo Grid" postcard template
Layout matches the Custom Deck Creations postcard:
  FRONT:
    Left panel (~340px wide, dark charcoal/wood bg):
      - Bold vertical headline (rotated 90° or stacked) — editable
      - Subheadline (e.g. "Southeast Michigan's") — editable
      - Company logo zone — editable
      - QR code placeholder — locked (auto-generated at send time)
    Right panel (~560px wide):
      - 2x2 grid of 4 photo upload zones — editable
  BACK: Standard mailing back
Canvas display size: 900 x 600 (Fabric.js display coords)
Actual print: 2775 x 1875 @ 300 DPI (6x9 + bleed)
"""

import json

# ── Fabric.js JSON skeleton ────────────────────────────────────────────────────
def mk_rect(left, top, w, h, fill, bdLock='locked', bdZoneLabel=None, uid=None, rx=0, ry=0, opacity=1.0, stroke=None, strokeWidth=0):
    obj = {
        "type": "rect",
        "version": "5.3.1",
        "originX": "left",
        "originY": "top",
        "left": left,
        "top": top,
        "width": w,
        "height": h,
        "fill": fill,
        "stroke": stroke,
        "strokeWidth": strokeWidth,
        "rx": rx,
        "ry": ry,
        "opacity": opacity,
        "angle": 0,
        "scaleX": 1,
        "scaleY": 1,
        "selectable": False,
        "evented": False,
        "bdLock": bdLock,
    }
    if bdZoneLabel:
        obj["bdZoneLabel"] = bdZoneLabel
    if uid is not None:
        obj["__uid"] = uid
    return obj

def mk_text(left, top, w, text, fontSize, fill, fontWeight=400, bdLock='locked', bdZoneLabel=None, uid=None,
            angle=0, fontFamily='Arial', textAlign='left', lineHeight=1.16, charSpacing=0):
    obj = {
        "type": "textbox",
        "version": "5.3.1",
        "originX": "left",
        "originY": "top",
        "left": left,
        "top": top,
        "width": w,
        "height": 0,
        "fill": fill,
        "text": text,
        "fontSize": fontSize,
        "fontFamily": fontFamily,
        "fontWeight": fontWeight,
        "fontStyle": "normal",
        "textAlign": textAlign,
        "lineHeight": lineHeight,
        "charSpacing": charSpacing,
        "angle": angle,
        "scaleX": 1,
        "scaleY": 1,
        "selectable": False,
        "evented": False,
        "bdLock": bdLock,
    }
    if bdZoneLabel:
        obj["bdZoneLabel"] = bdZoneLabel
    if uid is not None:
        obj["__uid"] = uid
    return obj

# ── FRONT JSON ─────────────────────────────────────────────────────────────────
# Canvas: 900 wide x 600 tall
# Left panel: 0..340  (dark charcoal, wood-inspired)
# Right panel: 340..900 (white/light, photo grid)
# Photo grid: 4 cells, each 280x300, with 2px gap
#   Top-left:    340, 0,   280, 300
#   Top-right:   622, 0,   278, 300
#   Bottom-left: 340, 302, 280, 298
#   Bottom-right:622, 302, 278, 298

LEFT_W = 340
RIGHT_X = 340
PHOTO_W = 280
PHOTO_H = 300
GAP = 2

front_objects = [
    # ── Background: full canvas dark ──
    mk_rect(0, 0, 900, 600, "#1C1C1C"),

    # ── Left panel background (dark charcoal) ──
    mk_rect(0, 0, LEFT_W, 600, "#1A1A1A"),

    # ── Left panel: subtle wood-grain texture overlay (dark brown stripe) ──
    mk_rect(0, 0, LEFT_W, 600, "rgba(60,35,15,0.45)"),

    # ── Left panel: thin accent line on right edge ──
    mk_rect(LEFT_W - 3, 0, 3, 600, "#F5C518"),

    # ── Subheadline (e.g. "Southeast Michigan's") — editable ──
    mk_text(
        left=22, top=28, w=LEFT_W - 44,
        text="Southeast Michigan's",
        fontSize=14, fill="#FFFFFF", fontWeight=400,
        bdLock='editable', bdZoneLabel='subheadline', uid=1,
        fontFamily='Arial', textAlign='left', charSpacing=60
    ),

    # ── Main headline line 1 (e.g. "MOST TRUSTED") — editable, bold, yellow ──
    mk_text(
        left=22, top=62, w=LEFT_W - 44,
        text="MOST TRUSTED",
        fontSize=52, fill="#F5C518", fontWeight=900,
        bdLock='editable', bdZoneLabel='headline1', uid=2,
        fontFamily='Arial', textAlign='left', lineHeight=1.0
    ),

    # ── Main headline line 2 (e.g. "DECK BUILDER") — editable, bold, white ──
    mk_text(
        left=22, top=170, w=LEFT_W - 44,
        text="DECK BUILDER",
        fontSize=52, fill="#FFFFFF", fontWeight=900,
        bdLock='editable', bdZoneLabel='headline2', uid=3,
        fontFamily='Arial', textAlign='left', lineHeight=1.0
    ),

    # ── Logo zone (company logo) — editable ──
    mk_rect(
        left=22, top=295, w=150, h=80,
        fill="rgba(255,255,255,0.08)",
        bdLock='editable', bdZoneLabel='logo', uid=4,
        stroke="rgba(255,255,255,0.25)", strokeWidth=1, rx=4, ry=4
    ),
    # Logo placeholder label
    mk_text(
        left=22, top=385, w=150,
        text="Upload Logo",
        fontSize=10, fill="rgba(255,255,255,0.4)",
        textAlign='center'
    ),

    # ── QR code zone placeholder ──
    mk_rect(
        left=185, top=295, w=130, h=130,
        fill="rgba(255,255,255,0.9)",
        bdLock='locked', bdZoneLabel=None,
        rx=4, ry=4
    ),
    mk_text(
        left=185, top=360, w=130,
        text="QR Code\n(auto)",
        fontSize=11, fill="#333333",
        textAlign='center'
    ),

    # ── Phone number — editable ──
    mk_text(
        left=22, top=440, w=LEFT_W - 44,
        text="555-555-5555",
        fontSize=18, fill="#F5C518", fontWeight=700,
        bdLock='editable', bdZoneLabel='phone', uid=5,
        fontFamily='Arial'
    ),

    # ── Website — editable ──
    mk_text(
        left=22, top=470, w=LEFT_W - 44,
        text="www.yourcompany.com",
        fontSize=12, fill="rgba(255,255,255,0.75)", fontWeight=400,
        bdLock='editable', bdZoneLabel='website', uid=6,
        fontFamily='Arial'
    ),

    # ── Right panel: white background ──
    mk_rect(RIGHT_X, 0, 900 - RIGHT_X, 600, "#F0F0F0"),

    # ── Photo zone 1: top-left ──
    mk_rect(
        left=RIGHT_X, top=0, w=PHOTO_W, h=PHOTO_H,
        fill="rgba(30,40,60,0.85)",
        bdLock='editable', bdZoneLabel='photo1', uid=10,
        stroke="#FFFFFF", strokeWidth=GAP
    ),
    mk_text(
        left=RIGHT_X + 10, top=PHOTO_H // 2 - 20, w=PHOTO_W - 20,
        text="📷 Photo 1",
        fontSize=14, fill="rgba(34,197,94,0.8)",
        textAlign='center'
    ),

    # ── Photo zone 2: top-right ──
    mk_rect(
        left=RIGHT_X + PHOTO_W + GAP, top=0, w=900 - RIGHT_X - PHOTO_W - GAP, h=PHOTO_H,
        fill="rgba(30,40,60,0.85)",
        bdLock='editable', bdZoneLabel='photo2', uid=11,
        stroke="#FFFFFF", strokeWidth=GAP
    ),
    mk_text(
        left=RIGHT_X + PHOTO_W + GAP + 5, top=PHOTO_H // 2 - 20, w=900 - RIGHT_X - PHOTO_W - GAP - 10,
        text="📷 Photo 2",
        fontSize=14, fill="rgba(34,197,94,0.8)",
        textAlign='center'
    ),

    # ── Photo zone 3: bottom-left ──
    mk_rect(
        left=RIGHT_X, top=PHOTO_H + GAP, w=PHOTO_W, h=600 - PHOTO_H - GAP,
        fill="rgba(30,40,60,0.85)",
        bdLock='editable', bdZoneLabel='photo3', uid=12,
        stroke="#FFFFFF", strokeWidth=GAP
    ),
    mk_text(
        left=RIGHT_X + 10, top=PHOTO_H + GAP + (600 - PHOTO_H - GAP) // 2 - 20, w=PHOTO_W - 20,
        text="📷 Photo 3",
        fontSize=14, fill="rgba(34,197,94,0.8)",
        textAlign='center'
    ),

    # ── Photo zone 4: bottom-right ──
    mk_rect(
        left=RIGHT_X + PHOTO_W + GAP, top=PHOTO_H + GAP, w=900 - RIGHT_X - PHOTO_W - GAP, h=600 - PHOTO_H - GAP,
        fill="rgba(30,40,60,0.85)",
        bdLock='editable', bdZoneLabel='photo4', uid=13,
        stroke="#FFFFFF", strokeWidth=GAP
    ),
    mk_text(
        left=RIGHT_X + PHOTO_W + GAP + 5, top=PHOTO_H + GAP + (600 - PHOTO_H - GAP) // 2 - 20, w=900 - RIGHT_X - PHOTO_W - GAP - 10,
        text="📷 Photo 4",
        fontSize=14, fill="rgba(34,197,94,0.8)",
        textAlign='center'
    ),
]

front_json = {
    "version": "5.3.1",
    "objects": front_objects,
    "background": "#1C1C1C"
}

# ── BACK JSON ──────────────────────────────────────────────────────────────────
# Standard mailing back layout:
#   Left half: logo + company info + QR code + phone/website
#   Right half: mailing address block + postage indicia

back_objects = [
    # Full background
    mk_rect(0, 0, 900, 600, "#FFFFFF"),

    # Header bar (dark)
    mk_rect(0, 0, 900, 75, "#1A1A1A"),

    # Logo zone in header
    mk_rect(
        left=20, top=10, w=180, h=55,
        fill="rgba(255,255,255,0.08)",
        bdLock='editable', bdZoneLabel='logo', uid=20,
        stroke="rgba(255,255,255,0.3)", strokeWidth=1, rx=3, ry=3
    ),

    # Phone in header
    mk_text(
        left=560, top=20, w=300,
        text="555-555-5555",
        fontSize=20, fill="#F5C518", fontWeight=700,
        bdLock='editable', bdZoneLabel='phone', uid=21,
        textAlign='right'
    ),
    mk_text(
        left=560, top=48, w=300,
        text="www.yourcompany.com",
        fontSize=13, fill="rgba(255,255,255,0.75)", fontWeight=400,
        bdLock='editable', bdZoneLabel='website', uid=22,
        textAlign='right'
    ),

    # Divider line
    mk_rect(430, 85, 1, 500, "#CCCCCC"),

    # LEFT SIDE: company message
    mk_text(
        left=30, top=100, w=380,
        text='"Most homeowners dread the pushy salesman.\nI do things differently — I lead with honesty."',
        fontSize=15, fill="#1A1A1A", fontWeight=700,
        bdLock='editable', bdZoneLabel='headline1', uid=23,
        fontFamily='Arial', lineHeight=1.4
    ),

    mk_text(
        left=30, top=200, w=380,
        text="We assessed your neighborhood and identified your home as a candidate for a free inspection. No pressure, no obligation.",
        fontSize=13, fill="#444444", fontWeight=400,
        bdLock='editable', bdZoneLabel='subtext', uid=24,
        fontFamily='Arial', lineHeight=1.5
    ),

    # Guarantee bar
    mk_rect(30, 355, 380, 38, "#1A1A1A", rx=4, ry=4),
    mk_text(
        left=38, top=364, w=364,
        text="🚫 No door-knocking. No pressure. Just your price.",
        fontSize=13, fill="#F5C518", fontWeight=700,
        bdLock='editable', bdZoneLabel='guarantee', uid=25,
        fontFamily='Arial'
    ),

    # QR code placeholder
    mk_rect(30, 410, 110, 110, "#F0F0F0", rx=4, ry=4, stroke="#CCCCCC", strokeWidth=1),
    mk_text(
        left=30, top=455, w=110,
        text="QR Code\n(auto)",
        fontSize=11, fill="#666666",
        textAlign='center'
    ),

    # RIGHT SIDE: mailing address block
    mk_text(
        left=460, top=100, w=410,
        text="MAILING ADDRESS",
        fontSize=10, fill="#999999", fontWeight=700,
        charSpacing=100
    ),

    mk_rect(480, 125, 370, 80, "#F5F5F5", rx=3, ry=3, stroke="#DDDDDD", strokeWidth=1),
    mk_text(
        left=480, top=138, w=370,
        text="HOMEOWNER NAME\n123 Sample Street\nYour City, MI 48000",
        fontSize=14, fill="#1A1A1A", fontWeight=600,
        textAlign='center', lineHeight=1.6
    ),

    # Postage indicia
    mk_rect(720, 100, 145, 80, "#FFFFFF", stroke="#CCCCCC", strokeWidth=1, rx=3, ry=3),
    mk_text(
        left=720, top=118, w=145,
        text="PRESORTED\nFIRST CLASS\nU.S. POSTAGE\nPAID",
        fontSize=10, fill="#666666",
        textAlign='center', lineHeight=1.4
    ),
]

back_json = {
    "version": "5.3.1",
    "objects": back_objects,
    "background": "#FFFFFF"
}

# ── Build the template entry ───────────────────────────────────────────────────
template1 = {
    "name": "4-Photo Grid",
    "description": "Bold left-panel headline with logo & QR code, right panel 2×2 photo grid. Great for showcasing multiple job photos.",
    "trade": "roofing",
    "published": True,
    "front_json": front_json,
    "back_json": back_json
}

# Output as JSON
print(json.dumps(template1, indent=2))
