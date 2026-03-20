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
  
    // DEFAULT = ALBERTA
    const albertaBounds = [
      [48.9, -120.0],
      [60.0, -110.0]
    ];
  
    map = L.map("map");
    map.fitBounds(albertaBounds);
  
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
