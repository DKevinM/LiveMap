window.initMap = async function () {

  const map = L.map("map").setView([53.53, -113.30], 7);
  window.map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // Core overlay groups (used by stations.js & purpleair.js)
  window.markerGroup = L.layerGroup().addTo(map);   // stations
  window.paLayer     = L.layerGroup().addTo(map);   // purpleair

  // ---- Load boundaries ----
  const [acaBoundary, wcasBoundary] = await Promise.all([
    fetch("data/ACA.geojson").then(r => r.json()),
    fetch("data/WCAS.geojson").then(r => r.json())
  ]);

  L.geoJSON(acaBoundary, {
    style: { color: "#0033cc", weight: 2, fillOpacity: 0 }
  }).addTo(map);

  L.geoJSON(wcasBoundary, {
    style: { color: "#cc3300", weight: 2, fillOpacity: 0 }
  }).addTo(map);

  // ---- Geolocation (optional but nice) ----
  map.locate({ setView: true, maxZoom: 10 });
  map.on("locationfound", e => {
    L.circleMarker(e.latlng, { radius: 6, color: "blue" }).addTo(map);
  });

  console.log("Map ready.");
  return map;
};
