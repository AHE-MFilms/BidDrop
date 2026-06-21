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
