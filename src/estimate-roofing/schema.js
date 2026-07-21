// ── Dynamic SEO & Schema Injection ────────────────────────────────────────
// Called by buildPage() after _acct and _est are loaded.
// Injects: dynamic <title>, <meta description>, <link canonical>,
//          Open Graph tags, and JSON-LD structured data.
// The noindex meta tag is intentionally NOT present in head.html —
// estimate pages are indexable by design (each is a unique local service page).
function injectSEO(){
  const acct = _acct || {};
  const est  = _est  || {};

  // ── Build dynamic strings ──────────────────────────────────────────────
  const co    = acct.companyName || 'Your Roofing Contractor';
  const city  = (acct.city || (est.addr ? est.addr.split(',').slice(-3,-2).join('').trim() : '')) || '';
  const state = (acct.state || (est.addr ? est.addr.split(',').slice(-2,-1).join('').trim() : '')) || '';
  const loc   = [city, state].filter(Boolean).join(', ');
  const addr  = est.addr || '';
  const price = est.priceOverride
    ? Math.round(est.priceOverride).toLocaleString()
    : (_prices['1.3'] ? Math.round(_prices['1.3']).toLocaleString() : null);

  // Dynamic title: "Roof Replacement Estimate — Rapid Roof | Canton, MI"
  const titleParts = ['Roof Replacement Estimate', co];
  if(loc) titleParts.push(loc);
  const dynamicTitle = titleParts.join(' — ').replace(' — ', ' \u2014 ');
  document.title = dynamicTitle;

  // Dynamic meta description
  const descParts = [`Personalized roofing estimate prepared by ${co}`];
  if(addr) descParts.push(`for ${addr}`);
  if(price) descParts.push(`Starting from $${price}`);
  descParts.push('Satellite-measured roof area, material options, and transparent pricing.');
  const dynamicDesc = descParts.join('. ');

  // ── Inject / update <meta name="description"> ─────────────────────────
  let metaDesc = document.querySelector('meta[name="description"]');
  if(!metaDesc){ metaDesc = document.createElement('meta'); metaDesc.name='description'; document.head.appendChild(metaDesc); }
  metaDesc.content = dynamicDesc;

  // ── Inject <link rel="canonical"> ─────────────────────────────────────
  let canonical = document.querySelector('link[rel="canonical"]');
  if(!canonical){ canonical = document.createElement('link'); canonical.rel='canonical'; document.head.appendChild(canonical); }
  canonical.href = window.location.origin + window.location.pathname;

  // ── Open Graph tags ───────────────────────────────────────────────────
  const ogTags = {
    'og:type':        'website',
    'og:title':       dynamicTitle,
    'og:description': dynamicDesc,
    'og:url':         canonical.href,
    'og:image':       est.photoUrl || (est.allPhotos && est.allPhotos.front && est.allPhotos.front[0]) || '',
    'og:site_name':   'BidDrop',
  };
  Object.entries(ogTags).forEach(([prop, content]) => {
    if(!content) return;
    let el = document.querySelector(`meta[property="${prop}"]`);
    if(!el){ el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
    el.content = content;
  });

  // ── JSON-LD Structured Data ───────────────────────────────────────────
  // Build LocalBusiness schema from account data
  const schema = {
    '@context': 'https://schema.org',
    '@graph': []
  };

  // LocalBusiness (the contractor)
  const localBiz = {
    '@type': ['LocalBusiness', 'RoofingContractor'],
    'name': co,
    'url': acct.bookingUrl || canonical.href,
  };
  if(acct.companyPhone) localBiz['telephone'] = acct.companyPhone;
  if(acct.companyAddr || loc){
    localBiz['address'] = {
      '@type': 'PostalAddress',
      'streetAddress': acct.companyAddr || '',
      'addressLocality': city,
      'addressRegion': state,
      'addressCountry': 'US',
    };
  }
  if(acct.logoData && acct.logoData.startsWith('http')){
    localBiz['logo'] = acct.logoData;
    localBiz['image'] = acct.logoData;
  }
  if(acct.yearsInBusiness){
    const founded = new Date().getFullYear() - parseInt(acct.yearsInBusiness);
    if(founded > 1900) localBiz['foundingDate'] = String(founded);
  }
  // AggregateRating — only inject if we have real Google data
  const ratingEl = document.getElementById('ep-rating-score');
  const countEl  = document.getElementById('ep-rating-count');
  if(ratingEl && ratingEl.textContent && parseFloat(ratingEl.textContent) > 0){
    const ratingVal  = parseFloat(ratingEl.textContent);
    const countText  = (countEl && countEl.textContent) || '';
    const countMatch = countText.match(/\d+/);
    const ratingCount = countMatch ? parseInt(countMatch[0]) : 1;
    if(ratingCount >= 1){
      localBiz['aggregateRating'] = {
        '@type': 'AggregateRating',
        'ratingValue': ratingVal.toFixed(1),
        'reviewCount': ratingCount,
        'bestRating': '5',
        'worstRating': '1',
      };
    }
  }
  schema['@graph'].push(localBiz);

  // Service (Roof Replacement)
  const service = {
    '@type': 'Service',
    'name': 'Roof Replacement',
    'serviceType': 'Roofing',
    'provider': { '@type': 'LocalBusiness', 'name': co },
    'areaServed': loc ? { '@type': 'City', 'name': loc } : undefined,
    'description': 'Full roof replacement including tear-off, materials, labor, disposal, and cleanup.',
  };
  if(price){
    service['offers'] = {
      '@type': 'Offer',
      'priceCurrency': 'USD',
      'price': price.replace(/,/g,''),
      'priceSpecification': {
        '@type': 'PriceSpecification',
        'priceCurrency': 'USD',
        'price': price.replace(/,/g,''),
        'description': 'Preliminary estimate based on satellite measurements. Final price confirmed after on-site inspection.',
      },
    };
  }
  // Remove undefined keys
  Object.keys(service).forEach(k => service[k] === undefined && delete service[k]);
  schema['@graph'].push(service);

  // ── Inject or replace JSON-LD script tag ──────────────────────────────
  let ldScript = document.getElementById('ep-jsonld');
  if(!ldScript){
    ldScript = document.createElement('script');
    ldScript.id = 'ep-jsonld';
    ldScript.type = 'application/ld+json';
    document.head.appendChild(ldScript);
  }
  ldScript.textContent = JSON.stringify(schema, null, 2);
}
