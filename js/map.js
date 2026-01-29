window.initMap = function () {

  const map = L.map("map").setView([53.53, -113.30], 7);
  window.map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  window.markerGroup = L.layerGroup().addTo(map);
  window.paLayer     = L.layerGroup().addTo(map);

  // Load boundaries (fire and forget)
  fetch("data/ACA.geojson")
    .then(r => r.json())
    .then(j => L.geoJSON(j, { style:{color:"#0033cc",weight:2,fillOpacity:0} }).addTo(map));

  fetch("data/WCAS.geojson")
    .then(r => r.json())
    .then(j => L.geoJSON(j, { style:{color:"#cc3300",weight:2,fillOpacity:0} }).addTo(map));

  // map.locate({ setView:true, maxZoom:10 });

//  map.on("locationfound", e => {
//    L.circleMarker(e.latlng,{radius:6,color:"blue"}).addTo(map);
//  });

  console.log("Map ready");
};
