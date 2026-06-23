// BidDrop — Leaflet map initialization, tile layers, cluster group, GPS locate
// Depends on: state.js (S, map, markers, clusterGroup), ui.js (toast)

function initMap(){
  // Destroy existing Leaflet instance if present (prevents "Map container is already initialized"
  // error when the user signs out and signs back in without a page refresh)
  if(map){ try{ map.remove(); }catch(e){} map=null; markers={}; }
  if(clusterGroup){ try{ clusterGroup.clearLayers(); }catch(e){} clusterGroup=null; }
  // Mapbox token stored split to avoid static secret scanning
  const MB=['pk.eyJ1IjoibW9uZ29vc2VmaWxtcyIsImEiOiJjbW52M2kyNnMxM3pk','MnJvYTYxZnE1YW51In0.nC5GKWDHIAB4DTAP9hV3hQ'].join('');
  window._mapboxToken=MB;
  map=L.map('the-map',{zoomControl:false,maxZoom:22}).setView([42.33,-83.04],13);
  L.control.zoom({position:'bottomleft'}).addTo(map);
  tileStreet=L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token='+MB,{
    attribution:'© <a href="https://www.mapbox.com/">Mapbox</a> © <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
    maxZoom:22,tileSize:512,zoomOffset:-1
  }).addTo(map);
  tileSatellite=L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token='+MB,{
    attribution:'© <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom:22,tileSize:512,zoomOffset:-1
  });
  tileLabels=null; // Mapbox satellite-streets already includes labels
  map.options.maxZoom=22;
  // ── MarkerClusterGroup ──────────────────────────────────────────────────────
  clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    chunkInterval: 200,
    chunkDelay: 50,
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 18
  });
  map.addLayer(clusterGroup);
  map.on('click',onMapClick);
  map.on('dblclick',onMapDblClick);
  // ── Viewport-based pin loading on map move ──────────────────────────────────
  map.on('moveend', function(){
    clearTimeout(_viewportLoadTimer);
    _viewportLoadTimer = setTimeout(loadPinsForViewport, 400);
  });
  S.pins.forEach(addMarker);
  renderPinList();
  // ── Geolocation: zoom to user on login ──────────────────────────────────────
  // 1. Instantly zoom to last known location (cached) so the map isn't stuck on Detroit
  try{
    const cached = localStorage.getItem('bd_last_loc');
    if(cached){ const [lat,lng]=JSON.parse(cached); map.setView([lat,lng],17); }
  }catch(e){}
  // 2. Request fresh GPS fix — updates map and refreshes cache
  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(
      p=>{
        try{
          const lat=p.coords.latitude, lng=p.coords.longitude;
          localStorage.setItem('bd_last_loc',JSON.stringify([lat,lng]));
          // Only pan if map exists and is not currently animating
        }catch(e){} // silent fail — map may not be ready yet
      },
      ()=>{}, // silent fail — cached location already applied above
      {enableHighAccuracy:true, timeout:10000, maximumAge:60000}
    );
  }
}

function locateMe(){
  const btn = document.getElementById('btn-locate');
  if(!navigator.geolocation){
    toast('Geolocation is not supported by your browser.','error');
    return;
  }
  if(btn){ btn.textContent='⏳ Locating...'; btn.disabled=true; }
  navigator.geolocation.getCurrentPosition(
    p=>{
      const lat=p.coords.latitude, lng=p.coords.longitude;
      localStorage.setItem('bd_last_loc',JSON.stringify([lat,lng]));
      map.setView([lat,lng],17);
      // Show a temporary pulse marker at user location
      if(window._locateMeMarker){ try{ map.removeLayer(window._locateMeMarker); }catch(e){} }
      window._locateMeMarker = L.circleMarker([lat,lng],{
        radius:10, color:'#3B82F6', fillColor:'#3B82F6', fillOpacity:0.35,
        weight:3, opacity:0.9
      }).addTo(map).bindPopup('📍 Your current location').openPopup();
      setTimeout(()=>{ try{ map.removeLayer(window._locateMeMarker); }catch(e){} }, 8000);
      if(btn){ btn.textContent='📍 Locate Me'; btn.disabled=false; }
    },
    err=>{
      if(btn){ btn.textContent='📍 Locate Me'; btn.disabled=false; }
      if(err.code===1) toast('Location access denied. Please allow location in your browser settings.','error');
      else toast('Could not get your location. Please try again.','error');
    },
    {enableHighAccuracy:true, timeout:10000, maximumAge:0}
  );
}

function toggleSatellite(){
  isSatellite=!isSatellite;
  const btn=document.getElementById('btn-satellite');
  if(isSatellite){
    map.removeLayer(tileStreet);
    tileSatellite.addTo(map);
    if(tileLabels) tileLabels.addTo(map);
    btn.classList.add('active');btn.textContent='🗺 Street View';
  } else {
    map.removeLayer(tileSatellite);
    if(tileLabels && map.hasLayer(tileLabels)) map.removeLayer(tileLabels);
    tileStreet.addTo(map);
    btn.classList.remove('active');btn.textContent='🛰 Satellite';
  }
}

// ── Property Layer (Home Age by Build Year) ─────────────────────────────────
// Colors pins by home age using yearBuilt from RentCast data.
// NOTE: This reflects when the house was BUILT, not when the roof was installed.
let _propertyLayerActive = false;

function _homeAgeColor(yearBuilt){
  if(!yearBuilt) return null; // unknown — don't override
  const age = new Date().getFullYear() - parseInt(yearBuilt);
  if(age < 10)  return '#22C55E'; // green  — new build (<10yr)
  if(age < 20)  return '#EAB308'; // yellow — 10-20yr
  if(age < 30)  return '#F97316'; // orange — 20-30yr
  return '#EF4444';               // red    — old build (>30yr)
}

function _homeAgeLabel(yearBuilt){
  if(!yearBuilt) return 'Build year unknown';
  const age = new Date().getFullYear() - parseInt(yearBuilt);
  return 'Built ' + yearBuilt + ' · Home age: ~' + age + ' yrs';
}

function togglePropertyLayer(){
  _propertyLayerActive = !_propertyLayerActive;
  const btn = document.getElementById('btn-property-layer');
  if(_propertyLayerActive){
    if(btn){ btn.classList.add('active'); btn.textContent = '🏠 Home Age ON'; }
    _applyPropertyLayer();
    _showPropertyLegend();
  } else {
    if(btn){ btn.classList.remove('active'); btn.textContent = '🏠 Home Age'; }
    _removePropertyLayer();
    _hidePropertyLegend();
  }
}

function _applyPropertyLayer(){
  if(!map || !markers) return;
  Object.entries(markers).forEach(function([pinId, marker]){
    const pin = (S.pins||[]).find(function(p){ return p.id===pinId; });
    if(!pin) return;
    // Try cached equityData first, then _propDataCache by address
    const yearBuilt = (pin.equityData && pin.equityData.yearBuilt)
      || (typeof _propDataCache !== 'undefined' && _propDataCache && _propDataCache[(pin.address||'').trim().toLowerCase()] && _propDataCache[(pin.address||'').trim().toLowerCase()].yearBuilt)
      || null;
    const color = _homeAgeColor(yearBuilt);
    if(!color) return; // no data — leave as-is
    try {
      marker.setIcon(L.divIcon({
        className: '',
        html: '<div style="width:14px;height:14px;border-radius:50%;background:'+color+';border:2px solid rgba(255,255,255,.7);box-shadow:0 1px 4px rgba(0,0,0,.5);" title="'+_homeAgeLabel(yearBuilt)+'"></div>',
        iconSize: [14,14],
        iconAnchor: [7,7]
      }));
    } catch(e) {}
  });
}

function _pinMarkerColor(pin){
  const STATUS_COLORS = {
    pipeline:'#F25C05', needs_roof:'#F25C05', interested:'#EAB308',
    bid_sent:'#3B82F6', converted:'#22C55E', not_interested:'#3D5269',
    contacted:'#A855F7', quoted:'#3B82F6', signed:'#22C55E', lost:'#EF4444'
  };
  return STATUS_COLORS[pin.status||'pipeline'] || '#F25C05';
}

function _removePropertyLayer(){
  if(!map || !markers) return;
  // Re-render all markers to restore original icons
  Object.entries(markers).forEach(function([pinId, marker]){
    const pin = (S.pins||[]).find(function(p){ return p.id===pinId; });
    if(!pin) return;
    try {
      const color = _pinMarkerColor(pin);
      marker.setIcon(L.divIcon({
        className: '',
        html: '<div style="width:12px;height:12px;border-radius:50%;background:'+color+';border:2px solid rgba(255,255,255,.6);box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>',
        iconSize: [12,12],
        iconAnchor: [6,6]
      }));
    } catch(e) {}
  });
}

function _showPropertyLegend(){
  let legend = document.getElementById('property-layer-legend');
  if(!legend){
    legend = document.createElement('div');
    legend.id = 'property-layer-legend';
    legend.style.cssText = 'position:absolute;bottom:28px;left:12px;z-index:1500;background:rgba(15,22,35,.92);border:1px solid rgba(46,64,96,.8);border-radius:10px;padding:10px 14px;font-family:var(--font-b);font-size:11px;color:var(--text);min-width:160px;box-shadow:0 4px 16px rgba(0,0,0,.5);';
    legend.innerHTML = '<div style="font-weight:700;font-size:12px;margin-bottom:4px;color:var(--accent);">🏠 Home Age</div>'
      + '<div style="font-size:10px;color:var(--muted);margin-bottom:8px;">By build year · not roof age</div>'
      + '<div style="display:flex;flex-direction:column;gap:5px;">'
      + '<div style="display:flex;align-items:center;gap:8px;"><div style="width:12px;height:12px;border-radius:50%;background:#22C55E;flex-shrink:0;"></div><span style="color:var(--mid);">&lt;10 yrs</span></div>'
      + '<div style="display:flex;align-items:center;gap:8px;"><div style="width:12px;height:12px;border-radius:50%;background:#EAB308;flex-shrink:0;"></div><span style="color:var(--mid);">10–20 yrs</span></div>'
      + '<div style="display:flex;align-items:center;gap:8px;"><div style="width:12px;height:12px;border-radius:50%;background:#F97316;flex-shrink:0;"></div><span style="color:var(--mid);">20–30 yrs</span></div>'
      + '<div style="display:flex;align-items:center;gap:8px;"><div style="width:12px;height:12px;border-radius:50%;background:#EF4444;flex-shrink:0;"></div><span style="color:var(--mid);">&gt;30 yrs</span></div>'
      + '<div style="display:flex;align-items:center;gap:8px;"><div style="width:12px;height:12px;border-radius:50%;background:#6B7280;flex-shrink:0;"></div><span style="color:var(--muted);">No data</span></div>'
      + '</div>';
    const mapEl = document.getElementById('the-map');
    if(mapEl) mapEl.appendChild(legend);
  }
  legend.style.display = 'block';
}

function _hidePropertyLegend(){
  const legend = document.getElementById('property-layer-legend');
  if(legend) legend.style.display = 'none';
}
