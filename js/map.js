window.initMap = async function () {

  const map = L.map("map").setView([53.53, -113.30], 7);
  window.map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Base layers
  window.layerACA  = L.layerGroup().addTo(map);
  window.layerWCAS = L.layerGroup().addTo(map);
  window.layerPA   = L.layerGroup().addTo(map);

  // ---- Load boundaries ----
  const [acaBoundary, wcasBoundary] = await Promise.all([
    fetch("data/ACA.geojson").then(r => r.json()),
    fetch("data/WCAS.geojson").then(r => r.json())
  ]);

  window.layerACA_Boundary = L.geoJSON(acaBoundary, {
    style: { color: "#0033cc", weight: 2, fillOpacity: 0 }
  }).addTo(map);

  window.layerWCAS_Boundary = L.geoJSON(wcasBoundary, {
    style: { color: "#cc3300", weight: 2, fillOpacity: 0 }
  }).addTo(map);

  // ---- Distance helper ----
  function findClosest(lat, lon, list, n = 1) {
    return list
      .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon))
      .map(p => ({
        ...p,
        d: map.distance([lat, lon], [p.lat, p.lon])
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
  }

  // ---- Click → nearest ----
  map.on("click", e => {

    const lat = e.latlng.lat;
    const lon = e.latlng.lng;

    const stationList = (window.stationsFC?.features || []).map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    const paList = (window.purpleFC?.features || []).map(f => ({
      ...f.properties,
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0]
    }));

    const nearestStations = findClosest(lat, lon, stationList, 2);
    const nearestPA = findClosest(lat, lon, paList, 3);

    if (typeof showLocationModal === "function") {
      showLocationModal(lat, lon, nearestStations, nearestPA);
    }
  });

  // ---- Geolocation ----
  map.locate({ setView: true, maxZoom: 10 });

  map.on("locationfound", e => {
    L.circleMarker(e.latlng, { radius: 6, color: "blue" }).addTo(map);
  });

  console.log("Map ready.");
  return map;
};
