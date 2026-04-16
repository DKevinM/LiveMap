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

  const legend = L.control({ position: "bottomright" });
  
  legend.onAdd = function () {
    const img = L.DomUtil.create("img");
    img.src = "images/aqhi_legend.png";
    img.style.width = "275px";
    return img;
  };
  
  legend.addTo(map);

  // ----------------------------
  // AQHI CLICK HANDLER
  // ----------------------------
  map.on("overlayadd", async function (e) { 

    if (
      e.name === "PM2.5 Rose" ||
      e.name === "NO2 Rose" ||
      e.name === "SO2 Rose"
    ) {
  
      const map = window.map;
  
      if (map.hasLayer(window.layers.rose_pm25) ||
          map.hasLayer(window.layers.rose_no2) ||
          map.hasLayer(window.layers.rose_so2)) {
  
        if (typeof window.loadRoses === "function") {
          await window.loadRoses();
        }
      }
    }
    
    const name = e.name.replace("AQHI ", "");
    const group = name;

    if (!window.AQHI_GROUPS[group]) return;
    if (!window.layers?.aqhi) return;

    // remove other AQHI layers
    Object.entries(window.layers.aqhi || {}).forEach(([key, layer]) => {
      if (key !== group && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    await loadAQHIGroup(group);
    map.addLayer(window.layers.aqhi[group]);
  });


  map.on("overlayremove", function (e) {
  
    if (
      e.name === "PM2.5 Rose" ||
      e.name === "NO2 Rose" ||
      e.name === "SO2 Rose"
    ) {
      window.layers.rose_pm25.clearLayers();
      window.layers.rose_no2.clearLayers();
      window.layers.rose_so2.clearLayers();
    }
  
  });



  
  // ----------------------------
  // LAYER REGISTRY
  // ----------------------------
  window.layers = {
    stations: L.layerGroup().addTo(map),
    click: L.layerGroup().addTo(map),
    purpleair: L.layerGroup().addTo(map),
    grid: L.layerGroup().addTo(map),
    forecast: L.layerGroup().addTo(map),
    eaqhi: L.layerGroup(),
    rose_pm25: L.layerGroup(),
    rose_no2: L.layerGroup(),
    rose_so2: L.layerGroup(),
    firesmoke_now: L.layerGroup(),
    firesmoke_6h: L.layerGroup(),
    firesmoke_12h: L.layerGroup(),
    firesmoke_24h: L.layerGroup(),
    weather_radar: L.layerGroup(),
    weather_wind_u: L.layerGroup(),
    weather_lightning: L.layerGroup(),
    weather_thunderstorm: L.layerGroup()
  };

  // ----------------------------
  // WEATHER WMS LAYERS
  // ----------------------------

  const radar = L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {
    layers: "RADAR_1KM_RRAI",
    format: "image/png",
    transparent: true,
    opacity: 0.85
  });
  window.layers.weather_radar.addLayer(radar);

  const windU = L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {
    layers: "HRDPS.CONTINENTAL_UU",
    format: "image/png",
    transparent: true,
    opacity: 0.7
  });
  window.layers.weather_wind_u.addLayer(windU);

  const lightning = L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {
    layers: "Lightning_2.5km_Density",
    format: "image/png",
    transparent: true,
    opacity: 0.85
  });
  window.layers.weather_lightning.addLayer(lightning);

  const thunder = L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {
    layers: "GDPS-WEonG_15km_Thunderstorm-Prob.3h",
    format: "image/png",
    transparent: true,
    opacity: 0.75
  });
  window.layers.weather_thunderstorm.addLayer(thunder);

  // ----------------------------
  // BASE MAPS
  // ----------------------------
  const osm = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom: 18 }
  ).addTo(map);

  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles © Esri",
      maxZoom: 19
    }
  );

  const baseLayers = {
    "OpenStreetMap": osm,
    "Satellite": satellite
  };

  // ----------------------------
  // OVERLAYS
  // ----------------------------
  const overlays = {};
  
  const labelMap = {
    weather_radar: "Radar",
    weather_wind_u: "Winds",
    weather_lightning: "Lightning",
    weather_thunderstorm: "Thunderstorm (3h)",
    purpleair: "Sensors (PurpleAir)",
    stations: "Stations",
    rose_pm25: "PM2.5 Rose",
    rose_no2: "NO2 Rose",
    rose_so2: "SO2 Rose",
    eaqhi: "eAQHI (PurpleAir)",
    firesmoke_now: "FireSmoke Now",
    firesmoke_6h: "FireSmoke +6h",
    firesmoke_12h: "FireSmoke +12h",
    firesmoke_24h: "FireSmoke +24h",
    AQHI Alberta: "AQHI Grid AB Stations",
    AQHI Alberta_BLEND: "AQHI Grid AB Stations+Sensors",
    AQHI ACA_Boundary_2022: "AQHI Grid ACA Stations",
    AQHI ACA_Boundary_2022_BLEND: "AQHI Grid ACA Stations+Sensors",
    AQHI Edmonton: "AQHI Grid Edmonton Stations",
    AQHI Edmonton_BLEND: "AQHI Grid Edmonton Stations+Sensors",
    AQHI Parkland_County: "AQHI Grid Parkland Stations",
    AQHI Parkland_County_BLEND:  "AQHI Grid Parkland Stations+Sensors",
    AQHI Strathcona:  "AQHI Grid Strathcona Stations+Sensors",
    AQHI Strathcona_BLEND: "AQHI Grid Strathcona Stations+Sensors",
    AQHI WCAS_2024: "AQHI Grid WCAS Stations",
    AQHI WCAS_2024_BLEND: "AQHI Grid WCAS Stations+Sensors",
    AQHI Yellowhead: "AQHI Grid Yellowhead Stations",
    AQHI Yellowhead_BLEND: "AQHI Grid Yellowhead Stations+Sensors"
  };
  
  const overlayKeys = (window.APP_CONFIG?.overlays && window.APP_CONFIG.overlays.length)
    ? window.APP_CONFIG.overlays
    : [
        "stations",
        "rose_pm25",
        "rose_no2",
        "rose_so2",      
        "purpleair",
        "eaqhi",
        "weather_radar",
        "weather_wind_u",
        "weather_lightning",
        "weather_thunderstorm",
        "firesmoke_now",
        "firesmoke_6h",
        "firesmoke_12h",
        "firesmoke_24h"
      ];
  
  overlayKeys.forEach(key => {
    if (window.layers[key]) {
      overlays[labelMap[key] || key] = window.layers[key];
    }
  });

  // ----------------------------
  // AQHI LAYERS
  // ----------------------------
  if (!window.layers.aqhi) {
    window.layers.aqhi = {};
  }
  
  const aqhiKeys = (window.APP_CONFIG?.aqhi !== undefined)
    ? window.APP_CONFIG.aqhi
    : Object.keys(window.AQHI_GROUPS);
  
  aqhiKeys.forEach(key => {
    if (!window.layers.aqhi[key]) {
      window.layers.aqhi[key] = L.layerGroup();
    }
    if (!window.APP_CONFIG?.aqhi || window.APP_CONFIG.aqhi.includes(key)) {
      overlays[labelMap[key] || ("AQHI " + key)] = window.layers.aqhi[key];
    }
  });
  
  window._layerControl = L.control.layers(baseLayers, overlays, { collapsed: false }).addTo(map);

  // ----------------------------
  // MAP CLICK
  // ----------------------------
  map.on("click", async function (e) {
    if (typeof window.handleMapClick === "function") {
      await window.handleMapClick(e.latlng.lat, e.latlng.lng, map);
    }
  });

};
