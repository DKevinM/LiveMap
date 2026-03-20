window.initMap = function () {

  if (window.map) {
    window.map.remove();
  }
  
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
// LAYERS (CENTRALIZED)
// ----------------------------
window.layers = {
  stations: L.layerGroup().addTo(map),
  purpleair: L.layerGroup().addTo(map),
  grid: L.layerGroup().addTo(map),
  forecast: L.layerGroup().addTo(map)
};

console.log("Map ready");

// ----------------------------
// LOAD MODULES (SAFE CALLS)
// ----------------------------
if (window.loadStations) {
  window.loadStations();
}

if (window.APP_CONFIG?.showPurpleAir && window.loadPurpleAir) {
  window.loadPurpleAir();
}

if (window.APP_CONFIG?.showAQHIGrid && window.loadGrid) {
  window.loadGrid();
}

};
