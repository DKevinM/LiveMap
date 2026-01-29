window.initMap = function () {

  const map = L.map("map").setView([53.53, -113.30], 7);
  window.map = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  window.markerGroup = L.layerGroup().addTo(map);
  window.paLayer     = L.layerGroup().addTo(map);


  console.log("Map ready");
};
