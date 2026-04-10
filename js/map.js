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

	// ==============================
	// PANEL COLLAPSE TOGGLE
	// ==============================
	if (!window._panelToggleInit) {
	  const panel = document.getElementById("panel");
	
	  if (panel) {
	    panel.addEventListener("click", () => {
	      panel.classList.toggle("collapsed");
	    });
	  }
	
	  window._panelToggleInit = true;
	}	

	
	// ----------------------------
	// CLICK HANDLER (NEW)
	// ----------------------------
	map.on("overlayadd", async function(e) {
	
	  // ==============================
	  // DETERMINE GROUP
	  // ==============================
	  let group = null;
	
	  if (e.name.includes("Blend")) {
	    group = e.name.replace("AQHI ", "").replace(" Blend", "") + "_BLEND";
	  } else {
	    group = e.name.replace("AQHI ", "");
	  }
	
	  // ==============================
	  // REMOVE OTHER AQHI LAYERS
	  // ==============================
	  Object.entries(window.layers.aqhi || {}).forEach(([key, layer]) => {
	    if (layer !== e.layer) {
	      map.removeLayer(layer);
	    }
	  });
	
	  // ==============================
	  // LOAD + ADD SELECTED LAYER
	  // ==============================
	  if (window.AQHI_GROUPS[group]) {
	    await loadAQHIGroup(group);
	    map.addLayer(window.layers.aqhi[group]);
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
	firesmoke_24h: L.layerGroup(),
	weather_radar: L.layerGroup(),
	weather_lightning: L.layerGroup(),
	weather_precip: L.layerGroup(),
	weather_wind: L.layerGroup(),	
  };


// ---------------- WEATHER LAYERS ----------------

// Radar
const radar = L.tileLayer(
  "https://tilecache.rainviewer.com/v2/radar/latest/256/{z}/{x}/{y}/2/1_1.png",
  { opacity: 0.6 }
);
window.layers.weather_radar.addLayer(radar);

// Satellite
const satellite = L.tileLayer(
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
  { opacity: 0.7 }
);
window.layers.weather_satellite.addLayer(satellite);







	
	
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
	const overlays = {
	
	  // ---------------- CORE DATA ----------------
	  "Stations": window.layers.stations,
	  "Sensors (PurpleAir)": window.layers.purpleair,
	
	  // ---------------- YOUR EXISTING LAYERS ----------------
	  "Grid": window.layers.grid,
	  "Forecast": window.layers.forecast,

	  // ---------------- WEATHER (NEW) ----------------
	  "Radar": window.layers.weather_radar,
	  "Lightning": window.layers.weather_lightning,
	  "Satellite": window.layers.weather_satellite,
	  "Precipitation": window.layers.weather_precip,
	  "Wind": window.layers.weather_wind,		
	
	  // ---------------- FIRESMOKE ----------------
	  "FireSmoke (Now)": window.layers.firesmoke_now,
	  "FireSmoke (6h)": window.layers.firesmoke_6h,
	  "FireSmoke (12h)": window.layers.firesmoke_12h,
	  "FireSmoke (24h)": window.layers.firesmoke_24h,
	
	  // ---------------- AQHI ----------------
	  "AQHI Alberta": window.layers.aqhi?.["Alberta"],
	  "AQHI Alberta Blend": window.layers.aqhi?.["Alberta_BLEND"],
	
	  "AQHI ACA": window.layers.aqhi?.["ACA"],
	  "AQHI ACA Blend": window.layers.aqhi?.["ACA_BLEND"],
	
	  "AQHI WCAS": window.layers.aqhi?.["WCAS"],
	  "AQHI WCAS Blend": window.layers.aqhi?.["WCAS_BLEND"]
	};
	
	L.control.layers(null, overlays, { collapsed: false }).addTo(map);
	
};
