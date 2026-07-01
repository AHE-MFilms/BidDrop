with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add retargeting KPI row after the second stats-row
old_kpi = '      <div class="stat-card"><div class="stat-icon">\U0001f3af</div><div class="stat-lbl">Close Rate</div><div class="stat-val" id="an-close-rate">\u2014</div><div class="stat-sub">Signed / Estimates</div></div>\n    </div>\n    <div class="dash-grid">'

new_kpi = ('      <div class="stat-card"><div class="stat-icon">\U0001f3af</div><div class="stat-lbl">Close Rate</div><div class="stat-val" id="an-close-rate">\u2014</div><div class="stat-sub">Signed / Estimates</div></div>\n'
'    </div>\n'
'    <!-- Retargeting KPIs row -->\n'
'    <div class="stats-row" style="background:rgba(59,130,246,.05);border:1px solid rgba(59,130,246,.15);border-radius:12px;padding:12px;">\n'
'      <div style="width:100%;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid rgba(59,130,246,.15);display:flex;align-items:center;gap:8px;">\n'
'        <span style="font-size:13px;font-weight:700;color:#3B82F6;letter-spacing:.4px;">\U0001f3af RETARGETING PERFORMANCE</span>\n'
'        <span style="font-size:10px;color:var(--muted);">Homeowner estimate page engagement \u2014 fires your Meta &amp; Google pixels</span>\n'
'      </div>\n'
'      <div class="stat-card" style="background:transparent;border:none;"><div class="stat-icon">\U0001f441\ufe0f</div><div class="stat-lbl">Page Views</div><div class="stat-val" id="an-page-views">\u2014</div><div class="stat-sub">Homeowners who opened page</div></div>\n'
'      <div class="stat-card" style="background:transparent;border:none;"><div class="stat-icon">\U0001f4c5</div><div class="stat-lbl">Booking Clicks</div><div class="stat-val" id="an-booking-clicks">\u2014</div><div class="stat-sub">Tapped Schedule button</div></div>\n'
'      <div class="stat-card" style="background:transparent;border:none;"><div class="stat-icon">\U0001f4de</div><div class="stat-lbl">Call Clicks</div><div class="stat-val" id="an-call-clicks">\u2014</div><div class="stat-sub">Tapped phone number</div></div>\n'
'      <div class="stat-card" style="background:transparent;border:none;"><div class="stat-icon">\U0001f504</div><div class="stat-lbl">View Rate</div><div class="stat-val" id="an-view-rate">\u2014</div><div class="stat-sub">Views / QR Scans</div></div>\n'
'    </div>\n'
'    <div class="dash-grid">')

if old_kpi in html:
    html = html.replace(old_kpi, new_kpi, 1)
    print("OK: Retargeting KPI row added")
else:
    # Try raw search
    idx = html.find('an-close-rate')
    print(f"FAIL: Close Rate context: {repr(html[idx-5:idx+200])}")

# 2. Add per-estimate breakdown table before the materials/status grid
old_grid = ('    <div class="dash-grid">\n'
'      <div class="dash-card"><div class="dc-title">\U0001f3e0 Top Material Choices</div><div id="an-materials" style="min-height:80px;"></div></div>\n'
'      <div class="dash-card"><div class="dc-title">\U0001f4cd Pin Status Breakdown</div><div style="position:relative;height:160px;"><canvas id="an-chart-status"></canvas></div></div>\n'
'    </div>\n'
'  </div>\n'
'  <!-- AGENCY VIEW')

new_grid = ('    <!-- Per-Estimate Engagement Table -->\n'
'    <div class="dash-card">\n'
'      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">\n'
'        <div class="dc-title" style="margin-bottom:0;">\U0001f4cb Estimate Page Engagement</div>\n'
'        <div style="font-size:11px;color:var(--muted);">Per-estimate scan, view &amp; click data \u2014 proof your postcards are working</div>\n'
'      </div>\n'
'      <div style="overflow-x:auto;">\n'
'        <table style="width:100%;border-collapse:collapse;font-size:12px;">\n'
'          <thead><tr style="background:var(--card2);border-bottom:1px solid var(--border);">\n'
'            <th style="padding:10px 14px;text-align:left;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">ADDRESS</th>\n'
'            <th style="padding:10px 14px;text-align:center;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">ESTIMATE</th>\n'
'            <th style="padding:10px 14px;text-align:center;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">QR SCANS</th>\n'
'            <th style="padding:10px 14px;text-align:center;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">PAGE VIEWS</th>\n'
'            <th style="padding:10px 14px;text-align:center;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">BOOKING CLICKS</th>\n'
'            <th style="padding:10px 14px;text-align:center;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">CALL CLICKS</th>\n'
'            <th style="padding:10px 14px;text-align:center;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">FIRST VIEWED</th>\n'
'            <th style="padding:10px 14px;text-align:center;font-family:var(--font-h);font-size:11px;letter-spacing:.6px;color:var(--muted);font-weight:600;">VIEW PAGE</th>\n'
'          </tr></thead>\n'
'          <tbody id="an-est-table"></tbody>\n'
'        </table>\n'
'      </div>\n'
'    </div>\n'
'    <div class="dash-grid">\n'
'      <div class="dash-card"><div class="dc-title">\U0001f3e0 Top Material Choices</div><div id="an-materials" style="min-height:80px;"></div></div>\n'
'      <div class="dash-card"><div class="dc-title">\U0001f4cd Pin Status Breakdown</div><div style="position:relative;height:160px;"><canvas id="an-chart-status"></canvas></div></div>\n'
'    </div>\n'
'  </div>\n'
'  <!-- AGENCY VIEW')

if old_grid in html:
    html = html.replace(old_grid, new_grid, 1)
    print("OK: Per-estimate engagement table added")
else:
    idx = html.find('an-materials')
    print(f"FAIL: an-materials context: {repr(html[idx-50:idx+200])}")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Saved")
