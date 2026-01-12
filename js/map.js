window.initMap = async function () {

  const map = L.map("map").setView([53.53, -113.30], 8);
  window.map = map;

  const layerACA  = L.layerGroup().addTo(map);
  const layerWCAS = L.layerGroup().addTo(map);
  const layerPA   = L.layerGroup().addTo(map);
  const layerWind = L.layerGroup();

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);


  console.log("Loading boundary layers…");
  
  const acaBoundary = await fetch("data/ACA.geojson").then(r => r.json());
  const wcasBoundary = await fetch("data/WCAS.geojson").then(r => r.json());
  
  window.layerACA_Boundary = L.geoJSON(acaBoundary, {
    style: { color: "#0033cc", weight: 2, fillOpacity: 0 }
  }).addTo(map);
  
  window.layerWCAS_Boundary = L.geoJSON(wcasBoundary, {
    style: { color: "#cc3300", weight: 2, fillOpacity: 0 }
  }).addTo(map);


  
  function distance(a, b) {
    return map.distance([a.lat, a.lon], [b.lat, b.lon]);
  }

  function findClosest(lat, lon, list, n = 1) {
    return list
      .map(p => ({
        ...p,
        d: map.distance([lat, lon], [p.Lat ?? p.lat, p.Lon ?? p.lon])
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
  }

  map.on("click", e => {
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    const nearestStations = findClosest(lat, lon, window.stationsFC.features, 2)
      .map(f => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], ...f.properties }));

    const nearestPA = findClosest(lat, lon, window.purpleFC.features, 3)
      .map(f => ({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], ...f.properties }));

    const windLayer = L.tileLayer.wms("https://geo.weather.gc.ca/geomet", {
      layers: "HRDPS.CONTINENTAL_UU",
      format: "image/png",
      transparent: true,
      opacity: 0.6
    });

    layerWind.clearLayers();
    layerWind.addLayer(windLayer);

    const overlays = {
      "ACA Boundary": window.layerACA_Boundary,
      "WCAS Boundary": window.layerWCAS_Boundary,
      "ACA Stations": layerACA,
      "WCAS Stations": layerWCAS,
      "PurpleAir": layerPA,
      "Wind": layerWind
    };

    L.control.layers(null, overlays, { collapsed: false }).addTo(map);

    showLocationModal(lat, lon, nearestStations, nearestPA);
  });

  map.locate({ setView: true, maxZoom: 10 });

  map.on("locationfound", e => {
    L.circleMarker(e.latlng, { radius: 6, color: 'blue' }).addTo(map);
  });

  // Expose layers & map
  window.map = map;
  window.layerACA  = L.layerGroup().addTo(map);
  window.layerWCAS = L.layerGroup().addTo(map);
  window.layerPA   = L.layerGroup().addTo(map);

  console.log("Map ready.");

  return map;
};
