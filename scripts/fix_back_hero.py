import re

path = 'src/postcard-designer.js'
content = open(path).read()

old = '''function pdBackHtml() {
  const cfg = (S && S.cfg) || {};
  const accent = cfg.tplAccentColor || '#F25C05';
  const phone = cfg.phone || '(555) 000-0000';
  const website = cfg.website || 'www.yourcompany.com';
  const logoUrl = PD.logoDataUrl || cfg.logoData || null;
  const logoWhiten = PD.logoWhiten != null ? PD.logoWhiten : (cfg.tplLogoWhiten != null ? cfg.tplLogoWhiten : true);
  const logoScale = PD.logoScale != null ? PD.logoScale : (cfg.tplLogoScale != null ? cfg.tplLogoScale : 100);
  const companyName = cfg.companyName || 'Your Company';
  const hook = cfg.postcardHook || 'Your neighbors are talking about us.';
  const why = cfg.postcardWhy || 'We deliver quality roofing with a lifetime warranty.';
  const guarantee = cfg.postcardGuarantee || '100% Satisfaction Guaranteed';'''

new = '''function pdBackHtml() {
  const cfg = (S && S.cfg) || {};
  const accent = cfg.tplAccentColor || '#F25C05';
  const phone = cfg.phone || '(555) 000-0000';
  const website = cfg.website || 'www.yourcompany.com';
  const logoUrl = PD.logoDataUrl || cfg.logoData || null;
  const logoWhiten = PD.logoWhiten != null ? PD.logoWhiten : (cfg.tplLogoWhiten != null ? cfg.tplLogoWhiten : true);
  const logoScale = PD.logoScale != null ? PD.logoScale : (cfg.tplLogoScale != null ? cfg.tplLogoScale : 100);
  const heroUrl = PD.heroDataUrl || cfg.tplHeroUrl || null;
  const heroScale = PD.heroScale != null ? PD.heroScale : (cfg.tplHeroScale != null ? cfg.tplHeroScale : 100);
  const companyName = cfg.companyName || 'Your Company';
  const hook = cfg.postcardHook || 'Your neighbors are talking about us.';
  const why = cfg.postcardWhy || 'We deliver quality roofing with a lifetime warranty.';
  const guarantee = cfg.postcardGuarantee || '100% Satisfaction Guaranteed';'''

assert old in content, 'OLD block not found!'
content = content.replace(old, new, 1)

# Now replace the right column div (mailing address block) to include heroImage zone + hero img
old2 = '''    <div style="position:absolute;top:30%;right:0;width:48%;bottom:10px;border-left:1px dashed #ddd;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;">
      <div style="font-size:9px;color:#999;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Mailing Address</div>
      <div style="font-size:11px;font-weight:700;color:#1a1a2e;">HOMEOWNER NAME</div>
      <div style="font-size:10px;color:#555;">123 Sample Street</div>
      <div style="font-size:10px;color:#555;">Your City, MI 48000</div>
      <div style="margin-top:10px;width:60px;height:60px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;">QR Code</div>
    </div>'''

new2 = '''    <div data-zone="heroImage" class="pd-zone" style="position:absolute;top:30%;right:0;width:48%;bottom:10px;border-left:1px dashed #ddd;overflow:hidden;cursor:pointer;" title="Click to upload hero image">
      \${heroUrl ? `<img src="\${heroUrl}" style="position:absolute;inset:0;width:\${heroScale}%;height:\${heroScale}%;min-width:100%;min-height:100%;object-fit:cover;opacity:.35;">` : ''}
      <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px;">
        <div style="font-size:9px;color:#999;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Mailing Address</div>
        <div style="font-size:11px;font-weight:700;color:#1a1a2e;">HOMEOWNER NAME</div>
        <div style="font-size:10px;color:#555;">123 Sample Street</div>
        <div style="font-size:10px;color:#555;">Your City, MI 48000</div>
        <div style="margin-top:10px;width:60px;height:60px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999;">QR Code</div>
        \${heroUrl ? '' : `<div class="pd-zone-hint" style="position:absolute;bottom:8px;">📷 Upload Hero Image</div>`}
      </div>
    </div>'''

assert old2 in content, 'OLD2 block not found!'
content = content.replace(old2, new2, 1)

open(path, 'w').write(content)
print('Done')
