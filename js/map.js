window.initMap = function () {

  let map;

  // ----------------------------
  // CONFIG-BASED MAP SETUP
  // ----------------------------
  if (window.APP_CONFIG?.lockBounds) {

    map = L.map("map", {
      minZoom: window.APP_CONFIG.minZoom || 6,
      maxZoom: window.APP_CONFIG.maxZoom || 13,
      maxBounds: window.APP_CONFIG.bounds,
      maxBoundsViscosity: 1.0
    });

    map.fitBounds(window.APP_CONFIG.bounds);

  } else {

    // default behaviour (your current setup)
    map = L.map("map").setView([53.53, -113.30], 7);

  }

  window.map = map;

  // ----------------------------
  // BASEMAP
  // ----------------------------
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  // ----------------------------
  // LAYERS
  // ----------------------------
  window.markerGroup = L.layerGroup().addTo(map);
  window.paLayer     = L.layerGroup().addTo(map);

  console.log("Map ready");

};
