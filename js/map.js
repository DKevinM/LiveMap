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

    if (window.APP_CONFIG.center && window.APP_CONFIG.zoom) {
      map.setView(window.APP_CONFIG.center, window.APP_CONFIG.zoom);
    } else {
      map.fitBounds(window.APP_CONFIG.bounds);
    }

  } else {

    const albertaBounds = [
      [48.9, -120.0],
      [60.0, -110.0]
    ];

    // zoomSnap defaults to Leaflet's normal 1 (whole levels only) unless a
    // page opts into fractional steps - needed for zoomBoost below to
    // land on a half-level nudge instead of being rounded back to a
    // whole one.
    map = L.map(mapDiv, { zoomSnap: window.APP_CONFIG?.zoomSnap ?? 1 });
    // Apply bounds only if defined
    if (window.APP_CONFIG.center && window.APP_CONFIG.zoom) {
      map.setView(window.APP_CONFIG.center, window.APP_CONFIG.zoom);
    } else if (window.APP_CONFIG.bounds) {
      map.fitBounds(window.APP_CONFIG.bounds);
    } else {
      map.fitBounds(albertaBounds);
    }
  }

  // Optional per-page zoom nudge on top of whatever fitBounds/setView
  // above already computed - kept relative (+N levels) rather than a
  // fixed zoom number so it still adapts to the viewer's screen size the
  // same way fitBounds does, instead of a fixed zoom clipping Alberta
  // more aggressively on a smaller window than fitBounds would have.
  if (window.APP_CONFIG?.zoomBoost) {
    map.setZoom(map.getZoom() + window.APP_CONFIG.zoomBoost);
  }

  window.map = map;

  // ----------------------------
  // PROACTIVE "HEADS UP" STATE (alerts + fire hotspots)
  // ----------------------------
  // The Sturgeon Lake sit-rep surfaces active EC alerts and nearby fire
  // detections unconditionally in its narrative every refresh - a real
  // heads-up, not something a visitor has to think to go looking for.
  // The alerts/firms layers below are opt-in toggles like every other
  // overlay here (off by default), which on their own loses that
  // "you should know about this" behavior. headsUpCheck() (built after
  // both fetches below) restores it: counts scoped to this page's own
  // area (its configured bounds, or the Alberta-wide fallback used
  // elsewhere in this file), shown only if something's actually there.
  const HEADSUP_SCOPE_BOUNDS = L.latLngBounds(
    window.APP_CONFIG?.bounds || [[48.9, -120.0], [60.0, -110.0]]
  );
  let headsUpPending = 0;
  let headsUpAlertCount = 0;
  let headsUpFirmsCount = 0;

  function headsUpCheck() {
    headsUpPending--;
    if (headsUpPending > 0) return;
    if (headsUpAlertCount === 0 && headsUpFirmsCount === 0) return;

    const banner = L.DomUtil.create("div", "headsup-banner", map.getContainer());
    L.DomEvent.disableClickPropagation(banner);
    L.DomEvent.disableScrollPropagation(banner);

    const bits = [];
    if (headsUpAlertCount > 0) {
      bits.push(`<button type="button" class="headsup-link" id="headsup-show-alerts">${headsUpAlertCount} active weather alert${headsUpAlertCount === 1 ? "" : "s"}</button>`);
    }
    if (headsUpFirmsCount > 0) {
      bits.push(`<button type="button" class="headsup-link" id="headsup-show-firms">${headsUpFirmsCount} fire hotspot${headsUpFirmsCount === 1 ? "" : "s"}</button>`);
    }

    banner.innerHTML = `
      <span class="headsup-icon">&#9888;</span>
      <span class="headsup-text">Heads up: ${bits.join(" &middot; ")} detected in this area.</span>
      <span class="headsup-close" id="headsup-close" role="button" aria-label="Dismiss">&times;</span>
    `;

    const alertsBtn = banner.querySelector("#headsup-show-alerts");
    if (alertsBtn) alertsBtn.addEventListener("click", () => map.addLayer(window.layers.alerts));

    const firmsBtn = banner.querySelector("#headsup-show-firms");
    if (firmsBtn) firmsBtn.addEventListener("click", () => map.addLayer(window.layers.firms));

    banner.querySelector("#headsup-close").addEventListener("click", () => banner.remove());
  }

  if (window.APP_CONFIG?.overlays?.includes("alerts")) headsUpPending++;
  if (window.APP_CONFIG?.overlays?.includes("firms")) headsUpPending++;

  const legend = L.control({ position: "bottomright" });
  
  legend.onAdd = function () {
    const img = L.DomUtil.create("img");
    img.src = "images/aqhi_legend.png";
    img.style.width = (window.APP_CONFIG?.aqhiLegendWidth || 275) + "px";
    return img;
  };
  
  legend.addTo(map);

  // FireSmoke PM2.5 legend - swatch colours match the exact colour ramp
  // baked into the firesmoke_*.png overlays themselves (AB_datapull's
  // fetch_firesmoke.py: PowerNorm gamma=0.30, vmin=0.1, vmax=80 over the
  // same 7-stop cmap), so this stays accurate as long as that ramp does.
  // Only built on pages that actually configure a firesmoke overlay, and
  // only shown once one of those layers is actually toggled on (see the
  // overlayadd/overlayremove handlers below) - hidden by default.
  let smokeLegend = null;

  if (window.APP_CONFIG?.overlays?.some(o => o.startsWith("firesmoke"))) {
    smokeLegend = L.DomUtil.create("div", "smoke-legend", map.getContainer());
    smokeLegend.style.display = "none";
    L.DomEvent.disableClickPropagation(smokeLegend);
    L.DomEvent.disableScrollPropagation(smokeLegend);

    const stops = [
      { value: "≥ 80", color: "#a00000" },
      { value: "40",        color: "#e0432a" },
      { value: "20",        color: "#ff7b3c" },
      { value: "10",        color: "#ffb84c" },
      { value: "5",         color: "#ffde60" },
      { value: "1",         color: "#ddff92" },
      { value: "≤ 0.1", color: "#d2ffd2" }
    ];

    smokeLegend.innerHTML = `
      <div class="smoke-legend-title">PM2.5 Smoke<br>(&micro;g/m&sup3;)</div>
      <div class="smoke-legend-hour" id="smoke-legend-hour">Click on map to pick a time</div>
      ${stops.map(s => `
        <div class="smoke-legend-row">
          <span class="smoke-legend-swatch" style="background:${s.color}"></span>
          <span>${s.value}</span>
        </div>
      `).join("")}
    `;
  }

  // UV Index legend - same treatment as the smoke legend above: colours
  // sampled directly from GeoMet's own GetLegendGraphic for
  // UVIndex_LowtoExtreme_Dis, so it matches the actual tile colours
  // exactly rather than a guessed generic WHO scale. Only built on
  // pages that configure the layer, hidden until it's toggled on.
  let uvLegend = null;

  if (window.APP_CONFIG?.overlays?.includes("weather_uv")) {
    uvLegend = L.DomUtil.create("div", "uv-legend", map.getContainer());
    uvLegend.style.display = "none";
    L.DomEvent.disableClickPropagation(uvLegend);
    L.DomEvent.disableScrollPropagation(uvLegend);

    const uvStops = [
      { value: "≥ 11 Extreme",   color: "#8f63cc" },
      { value: "8 - 10 Very High", color: "#ee3340" },
      { value: "6 - 7 High",     color: "#fe8100" },
      { value: "3 - 5 Moderate", color: "#fbe200" },
      { value: "0 - 2 Low",      color: "#96d600" }
    ];

    uvLegend.innerHTML = `
      <div class="uv-legend-title">UV Index</div>
      ${uvStops.map(s => `
        <div class="uv-legend-row">
          <span class="uv-legend-swatch" style="background:${s.color}"></span>
          <span>${s.value}</span>
        </div>
      `).join("")}
    `;
  }

  // Environment Canada alerts legend - risk_colour_en straight from the
  // API (yellow/orange/red are ECCC's own advisory/watch/warning
  // convention), same treatment as the smoke/UV legends above.
  let alertsLegend = null;

  if (window.APP_CONFIG?.overlays?.includes("alerts")) {
    alertsLegend = L.DomUtil.create("div", "alerts-legend", map.getContainer());
    alertsLegend.style.display = "none";
    L.DomEvent.disableClickPropagation(alertsLegend);
    L.DomEvent.disableScrollPropagation(alertsLegend);

    const alertStops = [
      { value: "Warning", color: "#c92a2a" },
      { value: "Watch",   color: "#e8590c" },
      { value: "Advisory/Statement", color: "#e0a800" }
    ];

    alertsLegend.innerHTML = `
      <div class="alerts-legend-title">EC Alerts</div>
      ${alertStops.map(s => `
        <div class="alerts-legend-row">
          <span class="alerts-legend-swatch" style="background:${s.color}"></span>
          <span>${s.value}</span>
        </div>
      `).join("")}
    `;
  }

  // FIRMS fire-hotspot legend - colours match FIRMS_CONFIDENCE_COLORS
  // in the layer block below (h/n/l = FIRMS' own confidence buckets).
  let firmsLegend = null;

  if (window.APP_CONFIG?.overlays?.includes("firms")) {
    firmsLegend = L.DomUtil.create("div", "alerts-legend", map.getContainer());
    firmsLegend.style.display = "none";
    firmsLegend.style.top = "230px";
    L.DomEvent.disableClickPropagation(firmsLegend);
    L.DomEvent.disableScrollPropagation(firmsLegend);

    const firmsStops = [
      { value: "High confidence", color: "#c92a2a" },
      { value: "Nominal",         color: "#e8590c" },
      { value: "Low confidence",  color: "#e0a800" }
    ];

    firmsLegend.innerHTML = `
      <div class="alerts-legend-title">Fire Hotspots</div>
      ${firmsStops.map(s => `
        <div class="alerts-legend-row">
          <span class="alerts-legend-swatch" style="background:${s.color}"></span>
          <span>${s.value}</span>
        </div>
      `).join("")}
    `;
  }

  const FIRESMOKE_LAYER_KEYS = ["firesmoke"];

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
    
    if (e.name.startsWith("FireSmoke") && smokeLegend) {
      smokeLegend.style.display = "block";
    }

    if (e.name === "UV Index" && uvLegend) {
      uvLegend.style.display = "block";
    }

    if (e.name === "Environment Canada Alerts" && alertsLegend) {
      alertsLegend.style.display = "block";
    }

    if (e.name === "Fire Hotspots (satellite)" && firmsLegend) {
      firmsLegend.style.display = "block";
    }

    // ----------------------------
    // AQHI GRID FIX
    // ----------------------------
    if (!e.name.startsWith("AQHI Grid")) {
      // do nothing, let other layers behave normally
    } else {
    
    let group = null;
    
    if (e.name === "AQHI Grid AB Stations") group = "Alberta";
    else if (e.name === "AQHI Grid AB Stations+Sensors") group = "Alberta_BLEND";

    else if (e.name === "AQHI Grid Forecast (3h)") group = "Alberta_FORECAST_3H";
    
    else if (e.name === "AQHI Grid ACA Stations") group = "ACA_Boundary_2022";
    else if (e.name === "AQHI Grid ACA Stations+Sensors") group = "ACA_Boundary_2022_BLEND";
    
    else if (e.name === "AQHI Grid Edmonton Stations") group = "Edmonton";
    else if (e.name === "AQHI Grid Edmonton Stations+Sensors") group = "Edmonton_BLEND";
    
    else if (e.name === "AQHI Grid Parkland Stations") group = "Parkland_County";
    else if (e.name === "AQHI Grid Parkland Stations+Sensors") group = "Parkland_County_BLEND";
    
    else if (e.name === "AQHI Grid Strathcona Stations") group = "Strathcona";
    else if (e.name === "AQHI Grid Strathcona Stations+Sensors") group = "Strathcona_BLEND";
    
    else if (e.name === "AQHI Grid WCAS Stations") group = "WCAS_2024";
    else if (e.name === "AQHI Grid WCAS Stations+Sensors") group = "WCAS_2024_BLEND";
    
    else if (e.name === "AQHI Grid Yellowhead Stations") group = "Yellowhead";
    else if (e.name === "AQHI Grid Yellowhead Stations+Sensors") group = "Yellowhead_BLEND";
    
    if (!group) return;
    if (!window.layers?.aqhi) return;
    await loadAQHIGroup(group);
    }
  });

  map.on("overlayremove", function (e) {

    if (e.name.startsWith("FireSmoke") && smokeLegend) {
      const anyStillOn = FIRESMOKE_LAYER_KEYS.some(k => map.hasLayer(window.layers[k]));
      if (!anyStillOn) smokeLegend.style.display = "none";
    }

    if (e.name === "UV Index" && uvLegend) {
      uvLegend.style.display = "none";
    }

    if (e.name === "Environment Canada Alerts" && alertsLegend) {
      alertsLegend.style.display = "none";
    }

    if (e.name === "Fire Hotspots (satellite)" && firmsLegend) {
      firmsLegend.style.display = "none";
    }

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
    airsheds: L.layerGroup(),
    rose_pm25: L.layerGroup(),
    rose_no2: L.layerGroup(),
    rose_so2: L.layerGroup(),
    firesmoke: L.layerGroup(),
    weather_radar: L.layerGroup(),
    weather_wind_u: L.layerGroup(),
    weather_lightning: L.layerGroup(),
    weather_uv: L.layerGroup(),
    weather_thunderstorm: L.layerGroup(),
    alerts: L.layerGroup(),
    firms: L.layerGroup()
  };

  
  // ----------------------------
  // ACA / WCAS BOUNDARY ADD
  // ----------------------------
  const airshed = window.APP_CONFIG?.airshed;
  
  if (airshed === "ACA" && window.APP_CONFIG?.showACABoundary) {
    if (typeof ACABoundaryLayer !== "undefined") {
      ACABoundaryLayer.addTo(map);
    }
  }
  
  if (airshed === "WCAS" && window.APP_CONFIG?.showWCASBoundary) {
    if (typeof WCASBoundaryLayer !== "undefined") {
      WCASBoundaryLayer.addTo(map);
    }
  }

  
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

  // GDPS forecast UV index - GeoMet has a time dimension with a default
  // (nearest-current) value, same as the layers above, so omitting TIME
  // is fine here too.
  const uvIndex = L.tileLayer.wms("https://geo.weather.gc.ca/geomet/?lang=en", {
    layers: "GDPS_15km_UVIndex",
    styles: "UVIndex_LowtoExtreme_Dis",
    format: "image/png",
    transparent: true,
    opacity: 0.7
  });
  window.layers.weather_uv.addLayer(uvIndex);

  // ----------------------------
  // SEVERE THUNDERSTORM OUTLOOK
  // ----------------------------
  
  fetch(
    "https://api.weather.gc.ca/collections/thunderstorm_outlook/items?f=json"
  )
  
  .then(r => r.json())
  
  .then(data => {
  
    console.log(
      "Thunderstorm outlook loaded:",
      data
    );
  
    const thunder = L.geoJSON(data, {
  
      filter: function(feature) {
      
        const p = feature.properties || {};
      
        return true;
      
      },
  
      style: function(feature) {
      
        const p = feature.properties || {};
      
        const type =
          (p.product_type || "").toUpperCase();
      
        let color = "#ffff00";
      
        // Prairie Severe Prediction Centre
        if (type.includes("PASPC")) {
          color = "#ff8800";
        }
      
        // Pacific Severe Prediction Centre
        else if (type.includes("PSPC")) {
          color = "#ff0000";
        }
      
        // Ontario
        else if (type.includes("OSPC")) {
          color = "#ffcc00";
        }
      
        // Atlantic
        else if (type.includes("ASPC")) {
          color = "#ffaa00";
        }
      
        return {
      
          color: color,
          fillColor: color,
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: "4 4"
      
        };
      
      },
  
      onEachFeature: function(feature, layer) {
  
        const p = feature.properties || {};
  
        layer.bindTooltip(`
        
        <b>Thunderstorm Outlook</b><br>
        
        Region:
        ${p.product_sub_type || "-"}<br>
        
        Centre:
        Outlook Region:
        ${p.product_sub_type || "-"}<br>
        
        Issued:
        ${new Date(
          p.publication_datetime
        ).toLocaleString()}<br>
        
        Expires:
        ${new Date(
          p.expiration_datetime
        ).toLocaleString()}
        
        `, {
        
          sticky: true,
          direction: "top"
        
        });
  
      }
  
    });
  
    window.layers.weather_thunderstorm
      .addLayer(thunder);
  
  })
  
  .catch(err => {
  
    console.error(
      "Thunderstorm layer failed:",
      err
    );

  });

  // ----------------------------
  // ENVIRONMENT CANADA ALERTS (western Canada - BC/AB/SK/MB/YT/NT/NU)
  // ----------------------------
  // Same weather-alerts collection the Sturgeon Lake environmental
  // intelligence sit-rep already pulls for its single-point boundary
  // check (modules/alerts/service.py), widened here to one shared bbox
  // covering the western provinces and territories since this layer
  // isn't tied to one site. api.weather.gc.ca sends
  // Access-Control-Allow-Origin: * (confirmed directly), so this can
  // fetch straight from the browser like the thunderstorm outlook above,
  // no server-side mirror needed.
  if (window.APP_CONFIG?.overlays?.includes("alerts")) {
    const WESTERN_CANADA_BBOX = "-141,48.2,-88,78";
    const ALERT_ACTIVE_STATUSES = ["issued", "continued"];
    const ALERT_RISK_COLORS = {
      red: "#c92a2a",
      orange: "#e8590c",
      yellow: "#e0a800",
      green: "#2f9e44"
    };

    fetch(`https://api.weather.gc.ca/collections/weather-alerts/items?f=json&bbox=${WESTERN_CANADA_BBOX}&limit=500`)
      .then(r => r.json())
      .then(data => {

        const features = (data.features || []).filter(f =>
          ALERT_ACTIVE_STATUSES.includes(f.properties?.status_en)
        );

        const alertsLayer = L.geoJSON({ type: "FeatureCollection", features }, {

          style: function (feature) {
            const p = feature.properties || {};
            const color = ALERT_RISK_COLORS[(p.risk_colour_en || "").toLowerCase()] || "#868e96";
            return {
              color: color,
              fillColor: color,
              fillOpacity: 0.12,
              weight: 1.5
            };
          },

          onEachFeature: function (feature, layer) {
            const p = feature.properties || {};
            layer.bindTooltip(`
              <b>${p.alert_name_en || "Alert"}</b><br>
              ${p.feature_name_en || p.province || ""}<br>
              Issued: ${p.publication_datetime ? new Date(p.publication_datetime).toLocaleString() : "-"}<br>
              Expires: ${p.expiration_datetime ? new Date(p.expiration_datetime).toLocaleString() : "-"}
            `, {
              sticky: true,
              direction: "top"
            });
          }

        });

        window.layers.alerts.addLayer(alertsLayer);

        alertsLayer.eachLayer(lyr => {
          if (lyr.getBounds && lyr.getBounds().intersects(HEADSUP_SCOPE_BOUNDS)) headsUpAlertCount++;
        });
        headsUpCheck();

      })
      .catch(err => {
        console.error("Environment Canada alerts layer failed:", err);
        headsUpCheck();
      });
  }

  // ----------------------------
  // NASA FIRMS ACTIVE-FIRE HOTSPOTS (western Canada)
  // ----------------------------
  // Same VIIRS_SNPP_NRT detections as the DSAI backend's per-station fire
  // check (dsai/fire_hotspots.py), covering the whole western-Canada bbox
  // instead of one point. FIRMS' area API takes the MAP_KEY in the URL
  // path, so unlike the ECCC alerts layer above this can't be fetched
  // straight from this public page - fetch_firms_map.py holds the key
  // server-side and writes this plain GeoJSON hourly, served with no key
  // in it (same no-CDN-lag pattern as js/data.js's last6h.csv fetch).
  // Detections are satellite heat signatures only - FIRMS doesn't
  // distinguish a wildfire from a prescribed burn, so this layer covers
  // both.
  if (window.APP_CONFIG?.overlays?.includes("firms")) {
    const FIRMS_CONFIDENCE_COLORS = { h: "#c92a2a", n: "#e8590c", l: "#e0a800" };

    window.fetchFresh("https://status.krmenvironmental.com/data/firms_hotspots.geojson")
      .then(r => r.json())
      .then(data => {

        const firmsLayer = L.geoJSON(data, {

          pointToLayer: function (feature, latlng) {
            const p = feature.properties || {};
            const color = FIRMS_CONFIDENCE_COLORS[(p.confidence || "").toLowerCase()] || "#868e96";
            const frp = Number(p.frp);
            const radius = isFinite(frp) ? Math.min(14, 5 + Math.sqrt(frp) * 2) : 6;
            return L.circleMarker(latlng, {
              radius: radius,
              color: "#111",
              weight: 1,
              fillColor: color,
              fillOpacity: 0.8
            });
          },

          onEachFeature: function (feature, layer) {
            const p = feature.properties || {};
            const when = (p.acq_date || "") + (p.acq_time ? " " + String(p.acq_time).padStart(4, "0").replace(/(\d{2})(\d{2})/, "$1:$2") + " UTC" : "");
            layer.bindTooltip(`
              <b>Fire hotspot</b><br>
              Detected: ${when || "-"}<br>
              Confidence: ${p.confidence || "-"}${p.frp != null ? " &middot; FRP " + p.frp + " MW" : ""}
            `, {
              sticky: true,
              direction: "top"
            });
          }

        });

        window.layers.firms.addLayer(firmsLayer);

        firmsLayer.eachLayer(lyr => {
          if (lyr.getLatLng && HEADSUP_SCOPE_BOUNDS.contains(lyr.getLatLng())) headsUpFirmsCount++;
        });
        headsUpCheck();

      })
      .catch(err => {
        console.error("FIRMS hotspots layer failed:", err);
        headsUpCheck();
      });
  }

  // ----------------------------
  // AIRSHED BOUNDARIES (all 10, one uniform style, one toggle)
  // ----------------------------
  // Unlike WallMap.html (ACA/WCAS drawn bold+black, the other 8 grey,
  // always on) - here every airshed gets the same neutral outline and
  // the whole set is one layer-control checkbox, on only when asked for.
  if (window.APP_CONFIG?.overlays?.includes("airsheds")) {
    const AIRSHED_NAMES = ["ACA", "CRAZ", "HAMP", "LICA", "PAMZ", "PAS", "PAZA", "PRAMP", "WBEA", "WCAS"];
    const airshedStyle = {
      color: "#444444",
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0
    };

    AIRSHED_NAMES.forEach(name => {
      fetch(`airshed/${name}.geojson`)
        .then(r => r.json())
        .then(data => {
          const gj = L.geoJSON(data, {
            style: airshedStyle,
            // fillOpacity 0 in the style above is a hollow outline visually,
            // but SVG hit-testing (pointer-events: visiblePainted) treats an
            // unpainted fill as un-hoverable - so the tooltip would only
            // trigger right on the boundary line, not the interior. A near-
            // zero fillOpacity here keeps it visually identical (see
            // airshedStyle) while making the whole polygon hoverable, same
            // as the AQHI grid cells.
            onEachFeature: function (feature, lyr) {
              lyr.setStyle({ fillOpacity: 0.01 });
              const label = feature.properties?.Name || name;
              lyr.bindTooltip(label, { sticky: true });
            }
          });
          window.layers.airsheds.addLayer(gj);
        })
        .catch(err => console.error(`Airshed boundary load failed: ${name}`, err));
    });
  }

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
    weather_uv: "UV Index",
    weather_thunderstorm: "Thunderstorm Outlook",
    purpleair: "PM sensors",
    stations: "Stations",
    rose_pm25: "PM2.5 Rose",
    rose_no2: "NO2 Rose",
    rose_so2: "SO2 Rose",
    eaqhi: "eAQHI (PurpleAir)",
    airsheds: "Airsheds",
    firesmoke: "FireSmoke",
    alerts: "Environment Canada Alerts",
    firms: "Fire Hotspots (satellite)",
    "AQHI Alberta": "AQHI Grid AB Stations",
    "AQHI Alberta_BLEND": "AQHI Grid AB Stations+Sensors",
    "AQHI Alberta_FORECAST_3H": "AQHI Grid Forecast (3h)",
    "AQHI ACA_Boundary_2022": "AQHI Grid ACA Stations",
    "AQHI ACA_Boundary_2022_BLEND": "AQHI Grid ACA Stations+Sensors",
    "AQHI Edmonton": "AQHI Grid Edmonton Stations",
    "AQHI Edmonton_BLEND": "AQHI Grid Edmonton Stations+Sensors",
    "AQHI Parkland_County": "AQHI Grid Parkland Stations",
    "AQHI Parkland_County_BLEND": "AQHI Grid Parkland Stations+Sensors",
    "AQHI Strathcona": "AQHI Grid Strathcona Stations",
    "AQHI Strathcona_BLEND": "AQHI Grid Strathcona Stations+Sensors",
    "AQHI WCAS_2024": "AQHI Grid WCAS Stations",
    "AQHI WCAS_2024_BLEND": "AQHI Grid WCAS Stations+Sensors",
    "AQHI Yellowhead": "AQHI Grid Yellowhead Stations",
    "AQHI Yellowhead_BLEND": "AQHI Grid Yellowhead Stations+Sensors"
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
        "firesmoke"
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
        const label = labelMap["AQHI " + key];
    
        if (label && window.layers.aqhi[key]) {
          overlays[label] = window.layers.aqhi[key];
        }
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


  // ----------------------------
  // PAGE REFRESH
  // ----------------------------
  
  setInterval(() => {
    console.log("Reloading page for fresh data");
    location.reload();
  }, 20 * 60 * 1000);
  
};
