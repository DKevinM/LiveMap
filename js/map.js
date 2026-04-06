console.log("map.js loaded");

window.initMap = function () {
  const mapDiv = document.getElementById("map");
  console.log("initMap mapDiv:", mapDiv);

  if (!mapDiv) {
    console.error("No #map div found.");
    return;
  }

  // prevent double init
  if (window.map instanceof L.Map) {
    console.log("Map already exists, skipping re-init.");
    return;
  }

  let map;

  // ----------------------------
  // CONFIG-BASED MAP SETUP
  // ----------------------------
  if (window.APP_CONFIG?.lockBounds) {
    map = L.map(mapDiv, {
      minZoom: window.APP_CONFIG.minZoom || 6,
      maxZoom: window.APP_CONFIG.maxZoom || 13,
      maxBounds: window.APP_CONFIG.bounds,
      maxBoundsViscosity: 1.0
    });

    map.fitBounds(window.APP_CONFIG.bounds);

  } else {
    const albertaBounds = [
      [48.9, -120.0],
      [60.0, -110.0]
    ];

    map = L.map(mapDiv);
    map.fitBounds(albertaBounds);
  }

  window.map = map;

	// ----------------------------
	// CLICK HANDLER (NEW)
	// ----------------------------
	map.on("click", function(e) {
	  if (typeof window.handleMapClick === "function") {
		window.handleMapClick(e.latlng.lat, e.latlng.lng, map);
	  } else {
		console.error("handleMapClick not found");
	  }
	});
	

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  window.layers = {
    stations: L.layerGroup().addTo(map),
    purpleair: L.layerGroup().addTo(map),
    grid: L.layerGroup().addTo(map),
	forecast: L.layerGroup().addTo(map),
	firesmoke_now: L.layerGroup(),
	firesmoke_6h: L.layerGroup(),
	firesmoke_12h: L.layerGroup(),
	firesmoke_24h: L.layerGroup()
  };

  console.log("Map ready");
	
  console.log("Calling renderMap...");
  if (window.renderMap) {
    window.renderMap();
  } else {
    console.error("renderMap not found");
  }

	// ==============================
	// AQHI LAYER CONTROL (NEW)
	// ==============================
	const overlays = {};
	
	window.ACTIVE_REGIONS = ["Alberta", "ACA", "WCAS"];
	window.ACTIVE_TYPES = ["CURRENT", "BLEND"];
	
	window.ACTIVE_REGIONS.forEach(region => {
	
	  if (window.ACTIVE_TYPES.includes("CURRENT")) {
	    overlays[`AQHI ${region}`] = window.layers.aqhi?.[region];
	  }
	
	  if (window.ACTIVE_TYPES.includes("BLEND")) {
	    overlays[`AQHI ${region} Blend`] = window.layers.aqhi?.[region + "_BLEND"];
	  }
	
	});
	
	L.control.layers(null, overlays, { collapsed: false }).addTo(map);

	
};
