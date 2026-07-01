#!/usr/bin/env python3
"""
Generate the final Template 1 front_json.

From the rendered PSD image (900x603 preview of 3185x2135 canvas):
  - Top-left photo (photo1/coral):   x=0..375,  y=0..237
  - Top-center photo (photo5/teal):  x=376..632, y=0..237
  - Top-right photo (photo3/yellow): x=642..899, y=0..237
  - Bottom-left branding panel:      x=0..374,   y=238..603  (lavender in PSD)
    - Logo (orange):                 x=11..210,  y=263..400
    - QR code (white):               x=222..358, y=263..400
    - Text below logo/QR:            x=11..374,  y=400..540
  - Bottom-right hero photo (photo4):x=375..899, y=238..603

These measurements come from the rendered PSD image (900x603).
Scale to 900x600: SX=1.0, SY=600/603=0.995 ≈ 1.0 (essentially same size)

PSD layer name → zone label mapping:
  photo1 → photo1 (top-left)
  photo5 → photo2 (top-center, note: PSD named it photo5 but it's the 2nd photo)
  photo3 → photo3 (top-right)
  photo4 → photo5 (large hero bottom-right, note: PSD named it photo4)
  photo2 → photo4 (bottom-left area — but this is the branding panel in the actual postcard)
  
  Actually from the original postcard image:
  - The branding panel (bottom-left) has NO photo behind it — it's a dark background
  - The 5 photos are: 3 top + 1 bottom-right hero + the branding panel itself has NO photo
  
  Wait — re-reading the user's message: "FIVE places for Pictures. With text over the bottom Left"
  So the bottom-left IS a photo zone with text overlaid on top of it.
  
  From the PSD: the bottom-left lavender area (photo2 in PSD) is a photo zone.
  The text (subheadline, headline1, headline2) overlays on top of it.
  The logo and QR are also overlaid on the photo zone.

So the 5 photo zones are:
  photo1: top-left     (0..375, 0..237)
  photo2: top-center   (376..632, 0..237)  [PSD: photo5]
  photo3: top-right    (642..899, 0..237)  [PSD: photo3]
  photo4: bottom-left  (0..374, 238..600)  [PSD: photo2 — the branding panel background]
  photo5: bottom-right hero (375..899, 238..600) [PSD: photo4]
"""

import json

V = "5.3.1"
CANVAS_W = 900
CANVAS_H = 600

# Zone bounds measured from rendered PSD (already at 900x600 scale)
# (left, top, width, height)
ZONES = {
    "photo1": (0,   0,   375, 238),   # top-left
    "photo2": (376, 0,   256, 238),   # top-center
    "photo3": (642, 0,   258, 238),   # top-right
    "photo4": (0,   238, 375, 362),   # bottom-left (branding panel bg)
    "photo5": (375, 238, 525, 362),   # bottom-right hero
    "logo":   (11,  263, 199, 137),   # logo overlay on photo4
    "qr_code":(222, 263, 136, 137),   # QR overlay on photo4
    # Text positions (overlaid on photo4)
    "subheadline": (11, 405, 340, 22),
    "headline1":   (11, 430, 340, 38),
    "headline2":   (11, 472, 340, 38),
    "phone":       (11, 514, 340, 20),
    "website":     (11, 536, 340, 20),
}

def locked_rect(left, top, width, height, fill, **kw):
    return {"type":"rect","version":V,"originX":"left","originY":"top",
            "left":left,"top":top,"width":width,"height":height,
            "fill":fill,"rx":0,"ry":0,"bdLock":"locked",
            "selectable":False,"evented":False,"hasControls":False,"hasBorders":False,**kw}

def photo_zone(label, left, top, width, height, num):
    return [
        {"type":"rect","version":V,"originX":"left","originY":"top",
         "left":left,"top":top,"width":width,"height":height,
         "bdZoneLabel":label,"bdLock":"editable",
         "selectable":True,"evented":True,
         "lockMovementX":True,"lockMovementY":True,
         "lockScalingX":True,"lockScalingY":True,"lockRotation":True,
         "hasControls":False,"hasBorders":True,
         "borderColor":"#22c55e","strokeDashArray":[6,4],
         "stroke":"#22c55e","strokeWidth":2,"fill":"rgba(34,197,94,0.08)"},
        {"type":"textbox","version":V,"originX":"left","originY":"top",
         "left":left+6,"top":top+max(4,height//2-10),
         "width":max(10,width-12),"height":0,
         "text":f"📷 Photo {num}",
         "fontSize":max(9,min(14,height//8)),
         "fontFamily":"Arial","fill":"rgba(34,197,94,0.8)","textAlign":"center",
         "bdLock":"locked","selectable":False,"evented":False,
         "hasControls":False,"hasBorders":False}
    ]

def upload_zone(label, left, top, width, height, hint, color="#F25C05"):
    return [
        {"type":"rect","version":V,"originX":"left","originY":"top",
         "left":left,"top":top,"width":width,"height":height,
         "bdZoneLabel":label,"bdLock":"editable",
         "selectable":True,"evented":True,
         "lockMovementX":True,"lockMovementY":True,
         "lockScalingX":True,"lockScalingY":True,"lockRotation":True,
         "hasControls":False,"hasBorders":True,
         "borderColor":color,"strokeDashArray":[4,3],
         "stroke":color,"strokeWidth":2,"fill":"rgba(242,92,5,0.06)"},
        {"type":"textbox","version":V,"originX":"left","originY":"top",
         "left":left+4,"top":top+max(4,height//2-10),
         "width":max(10,width-8),"height":0,
         "text":hint,
         "fontSize":max(8,min(11,height//6)),
         "fontFamily":"Arial","fill":"rgba(242,92,5,0.9)","textAlign":"center",
         "bdLock":"locked","selectable":False,"evented":False,
         "hasControls":False,"hasBorders":False}
    ]

def editable_text(label, left, top, width, text, font_size, fill, bold=False, align="left"):
    return {"type":"textbox","version":V,"originX":"left","originY":"top",
            "left":left,"top":top,"width":width,"height":0,
            "bdZoneLabel":label,"bdLock":"editable",
            "text":text,"fontSize":font_size,
            "fontFamily":"Arial Black" if bold else "Arial",
            "fontWeight":"bold" if bold else "normal",
            "fill":fill,"textAlign":align,
            "selectable":True,"evented":True,
            "lockMovementX":True,"lockMovementY":True,
            "lockScalingX":True,"lockScalingY":True,"lockRotation":True,
            "hasControls":False,"hasBorders":True,"borderColor":"#F25C05"}

# ── Build front objects ───────────────────────────────────────────────────────
front_objects = []

# Dark background
front_objects.append(locked_rect(0, 0, CANVAS_W, CANVAS_H, "#1a1a1a"))

# Thin white separators between zones
front_objects.append(locked_rect(0, 237, CANVAS_W, 2, "#ffffff"))   # horizontal
front_objects.append(locked_rect(374, 0, 2, CANVAS_H, "#ffffff"))   # vertical (top row only visible above 237)
front_objects.append(locked_rect(631, 0, 2, 238, "#ffffff"))         # top-center/right divider

# 5 photo zones
for label, num in [("photo1",1),("photo2",2),("photo3",3),("photo4",4),("photo5",5)]:
    l,t,w,h = ZONES[label]
    front_objects.extend(photo_zone(label, l, t, w, h, num))

# Dark overlay on photo4 (branding panel) — semi-transparent so photo shows through
front_objects.append(locked_rect(0, 238, 375, 362, "rgba(0,0,0,0.55)"))

# Logo upload zone (overlaid on photo4)
l,t,w,h = ZONES["logo"]
front_objects.extend(upload_zone("logo", l, t, w, h, "🏠 Upload Logo"))

# QR code zone (overlaid on photo4)
l,t,w,h = ZONES["qr_code"]
front_objects.extend(upload_zone("qr_code", l, t, w, h, "QR\n(auto)", color="#ffffff"))

# Text overlaid on photo4
l,t,w,h = ZONES["subheadline"]
front_objects.append(editable_text("subheadline", l, t, w, "Southeast Michigan's", 13, "#ffffff"))

l,t,w,h = ZONES["headline1"]
front_objects.append(editable_text("headline1", l, t, w, "MOST TRUSTED", 26, "#FFD700", bold=True))

l,t,w,h = ZONES["headline2"]
front_objects.append(editable_text("headline2", l, t, w, "DECK BUILDER", 26, "#ffffff", bold=True))

l,t,w,h = ZONES["phone"]
front_objects.append(editable_text("phone", l, t, w, "555-555-5555", 11, "#cccccc"))

l,t,w,h = ZONES["website"]
front_objects.append(editable_text("website", l, t, w, "www.yourcompany.com", 11, "#cccccc"))

front_json = {"version": V, "objects": front_objects, "background": "#1a1a1a"}

# ── Load pin postcard back_json ───────────────────────────────────────────────
with open("/home/ubuntu/pin_postcard_back.json") as f:
    back_json = json.load(f)

# ── Assemble full template ────────────────────────────────────────────────────
template = {
    "name": "5-Photo Grid",
    "description": "6×9 print-ready. Front: 3-photo top row + bottom-left photo with branding overlay (logo/QR/text) + large hero photo = 5 photo zones. Back: standard pin postcard.",
    "trade": "general",
    "front_json": front_json,
    "back_json": back_json,
    "published": True
}

with open("/home/ubuntu/template1_final.json", "w") as f:
    json.dump(template, f, indent=2)

print(f"✅ template1_final.json written")
print(f"   Front objects: {len(front_objects)}")
print(f"   Back objects:  {len(back_json['objects'])}")

# ── Render a preview to verify ────────────────────────────────────────────────
from PIL import Image, ImageDraw
img = Image.new("RGB", (CANVAS_W, CANVAS_H), "#1a1a1a")
draw = ImageDraw.Draw(img)

COLORS = {
    "photo1":"#FF6B6B","photo2":"#4ECDC4","photo3":"#FFE66D",
    "photo4":"#C3A6FF","photo5":"#A8E6CF",
    "logo":"#FF9F43","qr_code":"#FFFFFF"
}

for obj in front_objects:
    if obj["type"] == "rect":
        lbl = obj.get("bdZoneLabel","")
        color = COLORS.get(lbl, None)
        if color:
            l,t = obj["left"], obj["top"]
            r,b = l+obj["width"], t+obj["height"]
            draw.rectangle([l,t,r,b], fill=color, outline="#ffffff", width=1)
            draw.text((l+4, t+4), lbl, fill="#000000")
    elif obj["type"] == "textbox":
        lbl = obj.get("bdZoneLabel","")
        if lbl and obj.get("bdLock") == "editable":
            draw.text((obj["left"], obj["top"]), f"[{obj['text'][:18]}]", fill=obj.get("fill","#fff"))

img.save("/home/ubuntu/template_final_preview.png")
print("✅ Preview saved: template_final_preview.png")
