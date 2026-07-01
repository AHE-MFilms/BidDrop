with open('/home/ubuntu/biddrop/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add aspect-ratio:3/2 to all three back containers in HTML
for step in [2, 3, 4]:
    old = f'<div id="fu-pc{step}-back" style="width:100%;border-radius:6px;border:1px solid #ddd;background:#fff;min-height:120px;"></div>'
    new = f'<div id="fu-pc{step}-back" style="width:100%;aspect-ratio:3/2;border-radius:6px;border:1px solid #ddd;background:#fff;overflow:hidden;position:relative;"></div>'
    if old in content:
        content = content.replace(old, new, 1)
        print(f"PATCH back-container-{step} OK")
    else:
        print(f"PATCH back-container-{step} FAIL")

# Fix 2: Rewrite buildPostcardBackInline to fill the 3:2 container properly
# Find and replace the entire function body
old_back_start = '  <div style="display:flex;font-family:Arial,sans-serif;background:#fff;padding:14px 16px;gap:14px;box-sizing:border-box;min-height:120px;border-radius:5px;">'
new_back = '''  <div style="position:absolute;inset:0;display:flex;font-family:Arial,sans-serif;background:#fff;padding:16px 20px;gap:16px;box-sizing:border-box;">
    <!-- Return address left column -->
    <div style="flex:1.4;display:flex;flex-direction:column;justify-content:space-between;border-right:1px dashed #bbb;padding-right:16px;overflow:hidden;">
      <div>
        ${logoUrl ? '<img src="'+logoUrl+'" style="max-width:100px;max-height:36px;object-fit:contain;display:block;margin-bottom:8px;">' : ''}
        <div style="font-weight:700;font-size:11px;color:#111;line-height:1.3;">${fromName}</div>
        <div style="color:#666;font-size:10px;line-height:1.5;margin-top:3px;">${fromAddr}${fromCity ? '<br>'+fromCity : ''}${fromPhone ? '<br>'+fromPhone : ''}</div>
      </div>
      <div style="font-size:6px;color:#ccc;letter-spacing:3px;text-align:center;padding-top:6px;border-top:1px dashed #ddd;">|||||||||||||||||||||||||||||||||||||</div>
    </div>
    <!-- Delivery right column -->
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;">
      <div style="align-self:flex-end;border:1px solid #444;padding:5px 8px;text-align:center;font-size:7px;color:#333;line-height:1.5;">
        <strong style="display:block;font-size:9px;letter-spacing:.3px;">PRSRT STD</strong>U.S. POSTAGE<br>PAID<br>PERMIT #000
      </div>
      <div style="font-size:11px;line-height:1.7;color:#111;">
        <div style="font-weight:700;font-size:12px;margin-bottom:4px;">Homeowner Name</div>
        <div style="border-top:1px solid #eee;margin-bottom:5px;"></div>
        <div>123 Main Street</div>
        <div>City, State 00000</div>
      </div>
      <div style="font-size:6px;color:#ccc;letter-spacing:2px;text-align:center;">DELIVERY POINT BARCODE</div>
    </div>
  </div>'''

if old_back_start in content:
    back_start_idx = content.index(old_back_start)
    # Find the closing backtick of the template literal
    back_end_idx = content.index('`;\n}\n\nfunction populateEstPinPicker', back_start_idx)
    content = content[:back_start_idx] + new_back + content[back_end_idx:]
    print("PATCH back-inline-fn OK")
else:
    print("PATCH back-inline-fn FAIL")
    idx = content.find('buildPostcardBackInline')
    print(repr(content[idx:idx+300]))

with open('/home/ubuntu/biddrop/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("ALL DONE")
