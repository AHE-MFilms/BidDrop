with open('/home/ubuntu/biddrop/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# ── 2. Fix renderFollowUpTab: remove overflow:hidden from front container when image loaded
old_render = "    // Front side\n    if(url){\n      frontEl.innerHTML = '<img src=\"'+url+'\" style=\"width:100%;height:auto;display:block;border-radius:6px;\">';\n    } else {"
new_render = """    // Front side
    if(url){
      frontEl.style.display = 'block';
      frontEl.style.overflow = 'visible';
      frontEl.innerHTML = '<img src="'+url+'" style="width:100%;height:auto;display:block;border-radius:6px;">';
    } else {"""
if old_render in content:
    content = content.replace(old_render, new_render, 1)
    print("PATCH 2 OK: front render fixed")
else:
    print("PATCH 2 FAIL")

# ── 3. Fix buildPostcardBackInline: use proper flex fill layout
old_back = (
  '  <div style="display:flex;font-family:Arial,sans-serif;font-size:12px;background:#fff;padding:16px;gap:16px;box-sizing:border-box;min-height:160px;">\n'
  '    <div style="flex:1.4;display:flex;flex-direction:column;gap:10px;border-right:1px solid #ddd;padding-right:16px;">\n'
  '      ${logoUrl ? \'<img src="\'+logoUrl+\'" style="max-width:110px;max-height:40px;object-fit:contain;display:block;">\' : \'\'}\n'
  '      <div>\n'
  '        <div style="font-weight:700;font-size:11px;color:#111;">${fromName}</div>\n'
  '        <div style="color:#555;font-size:10px;line-height:1.6;margin-top:3px;">${fromAddr}<br>${fromCity}${fromPhone ? \'<br>\'+fromPhone : \'\'}</div>\n'
  '      </div>\n'
  '      <div style="margin-top:auto;border-top:1px dashed #ccc;padding-top:6px;font-size:7px;color:#bbb;letter-spacing:2px;text-align:center;">|||||||||||||||||||||||||||||||||||</div>\n'
  '    </div>\n'
  '    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:10px;">\n'
  '      <div style="border:1px solid #333;padding:5px 8px;text-align:center;font-size:8px;color:#333;line-height:1.5;align-self:flex-end;">\n'
  '        <strong style="display:block;font-size:10px;">PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000\n'
  '      </div>\n'
  '      <div style="font-size:11px;line-height:1.7;color:#111;">\n'
  '        <div style="font-weight:700;font-size:12px;">Homeowner Name</div>\n'
  '        <div style="border-top:1px solid #eee;margin:4px 0;"></div>\n'
  '        <div>123 Main Street</div>\n'
  '        <div>City, State 00000</div>\n'
  '      </div>\n'
  '      <div style="font-size:7px;color:#ccc;letter-spacing:1px;text-align:center;">DELIVERY POINT BARCODE</div>\n'
  '    </div>\n'
  '  </div>'
)

new_back = (
  '  <div style="display:flex;font-family:Arial,sans-serif;font-size:12px;background:#fff;padding:20px;gap:20px;box-sizing:border-box;min-height:180px;">\n'
  '    <div style="flex:1.4;display:flex;flex-direction:column;justify-content:space-between;border-right:2px dashed #ddd;padding-right:20px;">\n'
  '      <div>\n'
  '        ${logoUrl ? \'<img src="\'+logoUrl+\'" style="max-width:120px;max-height:44px;object-fit:contain;display:block;margin-bottom:10px;">\' : \'\'}\n'
  '        <div style="font-weight:700;font-size:12px;color:#111;line-height:1.4;">${fromName}</div>\n'
  '        <div style="color:#555;font-size:11px;line-height:1.6;margin-top:4px;">${fromAddr}${fromCity ? \'<br>\'+fromCity : \'\'}${fromPhone ? \'<br>\'+fromPhone : \'\'}</div>\n'
  '      </div>\n'
  '      <div style="border-top:1px dashed #ccc;padding-top:8px;font-size:7px;color:#bbb;letter-spacing:3px;text-align:center;margin-top:16px;">|||||||||||||||||||||||||||||||||||||||||</div>\n'
  '    </div>\n'
  '    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;">\n'
  '      <div style="align-self:flex-end;border:1px solid #333;padding:6px 10px;text-align:center;font-size:8px;color:#333;line-height:1.6;">\n'
  '        <strong style="display:block;font-size:10px;letter-spacing:.5px;">PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000\n'
  '      </div>\n'
  '      <div style="font-size:12px;line-height:1.8;color:#111;margin-top:16px;">\n'
  '        <div style="font-weight:700;font-size:13px;border-bottom:1px solid #eee;padding-bottom:4px;margin-bottom:6px;">Homeowner Name</div>\n'
  '        <div>123 Main Street</div>\n'
  '        <div>City, State 00000</div>\n'
  '      </div>\n'
  '      <div style="font-size:7px;color:#ccc;letter-spacing:2px;text-align:center;margin-top:10px;">DELIVERY POINT BARCODE</div>\n'
  '    </div>\n'
  '  </div>'
)

if old_back in content:
    content = content.replace(old_back, new_back, 1)
    print("PATCH 3 OK: back side layout fixed")
else:
    print("PATCH 3 FAIL - trying to find it...")
    # Debug: find what's actually there
    idx = content.find('buildPostcardBackInline')
    print(repr(content[idx:idx+200]))

with open('/home/ubuntu/biddrop/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("DONE")
