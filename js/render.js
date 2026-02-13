// =======================
// render.js
// =======================

// --- Shared Layer Groups (available to all scripts) ---
window.ACAStations  = window.ACAStations  || L.layerGroup();
window.ACAPurple    = window.ACAPurple    || L.layerGroup();
window.WCASStations = window.WCASStations || L.layerGroup();
window.WCASPurple   = window.WCASPurple   || L.layerGroup();
window.ALLStations  = window.ALLStations  || L.layerGroup();
window.ALLPurple    = window.ALLPurple    || L.layerGroup();
window.RosePM25 = window.RosePM25 || L.layerGroup();
window.RoseNO2  = window.RoseNO2  || L.layerGroup();
window.RoseO3   = window.RoseO3   || L.layerGroup();


let ACApoly = null;
let WCASpoly = null;

// Boundary layers (toggleable)
const ACABoundaryLayer  = L.layerGroup();
const WCASBoundaryLayer = L.layerGroup();


const acaBoundaryReady = fetch("data/ACA.geojson")
  .then(r => r.json())
  .then(g => {
    ACApoly = g;
    ACABoundaryLayer.clearLayers();
    ACABoundaryLayer.addLayer(L.geoJSON(g, { style: { color: "#33a02c", weight: 2, fill: false } }));
  })
  .catch(e => console.error("ACA boundary load failed:", e));

const wcasBoundaryReady = fetch("data/WCAS.geojson")
  .then(r => r.json())
  .then(g => {
    WCASpoly = g;
    WCASBoundaryLayer.clearLayers();
    WCASBoundaryLayer.addLayer(L.geoJSON(g, { style: { color: "#1b9e77", weight: 2, fill: false } }));
  })
  .catch(e => console.error("WCAS boundary load failed:", e));


// point-in-polygon helper
function inside(poly, lat, lon) {
  if (!poly || !poly.features || !poly.features.length) return false;
  return turf.booleanPointInPolygon(turf.point([lon, lat]), poly.features[0]);
}


// clear layers (so re-render doesn’t duplicate)
function clearAllLayers() {
  window.ACAStations.clearLayers();
  window.WCASStations.clearLayers();
  window.ALLStations.clearLayers();
  window.ACAPurple.clearLayers();
  window.WCASPurple.clearLayers();
  window.ALLPurple.clearLayers();

  window.RosePM25.clearLayers();
  window.RoseNO2.clearLayers();
  window.RoseO3.clearLayers();
}





  
  function drawRose(latlng, p, layer, pollutant) {
  
    const map = window.map;
  
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  
    const bins = [
      { suffix: "_calm", color: "#d9f0ff" },
      { suffix: "_low",  color: "#9ecae1" },
      { suffix: "_med",  color: "#3182bd" },
      { suffix: "_high", color: "#08519c" }
    ];
  
    let unit = "";
    if (pollutant === "PM25") unit = " µg/m³";
    if (pollutant === "NO2")  unit = " ppb";
    if (pollutant === "O3")   unit = " ppb";
  
    const total = Number(p.total) || 1;
  
    // Radius in METERS (not degrees)
    const R = 500;  
  
    dirs.forEach((d, i) => {
  
      let cumulative = 0;
  
      bins.forEach(bin => {
  
        const val = Number(p[d + bin.suffix] || 0);
        if (val <= 0) return;
  
        const r1 = (cumulative / total) * R;
        const r2 = ((cumulative + val) / total) * R;
        
        cumulative += val;
  
        const angle1 = (i * 45 - 90) * Math.PI/180;
        const angle2 = ((i+1) * 45 - 90) * Math.PI/180;
  
        const center = map.project(latlng);
  
        const p1 = map.unproject([
          center.x + r1 * Math.cos(angle1),
          center.y + r1 * Math.sin(angle1)
        ]);
  
        const p2 = map.unproject([
          center.x + r2 * Math.cos(angle1),
          center.y + r2 * Math.sin(angle1)
        ]);
  
        const p3 = map.unproject([
          center.x + r2 * Math.cos(angle2),
          center.y + r2 * Math.sin(angle2)
        ]);
  
        const p4 = map.unproject([
          center.x + r1 * Math.cos(angle2),
          center.y + r1 * Math.sin(angle2)
        ]);
  
        L.polygon([p1, p2, p3, p4], {
          color: "#333",
          weight: 0.4,
          fillColor: bin.color,
          fillOpacity: 0.8
        })
        .bindTooltip(`${d} ${bin.suffix.replace("_","")}<br>Value: ${val}${unit}`)
        .addTo(layer);
  
      });
    });
  }





window.renderMap = async function () {
  const map = window.map;   

  await window.AppData.ready; 
  await Promise.all([window.dataReady, acaBoundaryReady, wcasBoundaryReady]);
  
  // ENSURE LAYERS ARE ATTACHED ONCE
  if (!window._layersAttached) {
  
    window.ACAStations.addTo(map);
    window.WCASStations.addTo(map);
    window.ALLStations.addTo(map);
  
    window.ACAPurple.addTo(map);
    window.WCASPurple.addTo(map);
    window.ALLPurple.addTo(map);
  
    window.RosePM25.addTo(map);
    window.RoseNO2.addTo(map);
    window.RoseO3.addTo(map);
  
    ACABoundaryLayer.addTo(map);
    WCASBoundaryLayer.addTo(map);
      
    window._layersAttached = true;
  }
  
  


  if (!map) {
    console.error("renderMap: window.map missing");
    return;
  }
  if (!window.AppData?.stations || !window.AppData?.purpleair) {
    console.error("renderMap: AppData missing stations/purpleair");
    return;
  }

  clearAllLayers();
  
  while (!window.AppData?.purpleair || !window.dataByStation) {
    await new Promise(r => setTimeout(r, 50));
  }
    

  // -----------------------
  // STATIONS
  // -----------------------

  Object.entries(window.dataByStation).forEach(([stationName, rows]) => {
  
    if (!rows || !rows.length) return;
  
    const lat = Number(rows[0].Latitude);
    const lon = Number(rows[0].Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  
    const inACA  = inside(ACApoly,  lat, lon);
    const inWCAS = inside(WCASpoly, lat, lon);
  
    // AQHI value for color
    const aqhiRow = rows.find(r => r.ParameterName === "AQHI");
    const aqhiVal = aqhiRow ? Number(aqhiRow.Value) : NaN;
  
    const color = Number.isFinite(aqhiVal) ? window.getAQHIColor(aqhiVal) : "#888888";
  
    // timestamp: use latest ReadingDate across the rows (rows[0] is NOT reliable)
    let latest = null;
    rows.forEach(r => {
      const t = new Date(r.ReadingDate);
      if (!latest || t > latest) latest = t;
    });
  
    const displayTime = latest
      ? latest.toLocaleString("en-CA", { timeZone: "America/Edmonton", hour12: true })
      : "";
  
    // Keep the popup dynamic, but order key params first (everything else after)
    const ordered = [
      "AQHI",
      "Outdoor Temperature",
      "Relative Humidity",
      "Wind Speed",
      "Wind Direction",
      "Nitrogen Dioxide",
      "Total Oxides of Nitrogen",
      "Nitric Oxide",
      "Ozone",
      "Fine Particulate Matter",
      "Sulphur Dioxide",
      "Hydrogen Sulphide",
      "Total Reduced Sulphur",
      "Carbon Monoxide",
      "Total Hydrocarbons",
      "Methane",
      "Non-methane Hydrocarbons"
    ];
  
    const byParam = {};
    rows.forEach(r => { byParam[r.ParameterName] = r; });
  
    const used = new Set();
  
    const linesFirst = ordered
      .filter(p => byParam[p])
      .map(p => {
        used.add(p);
        const r = byParam[p];
        const u = r.Units ? `${r.Units}` : "";
        const label = r.Shortform || r.ParameterName;
        return `${label}: ${r.Value}${u}`;
      });
  
    const linesRest = rows
      .filter(r => !used.has(r.ParameterName))
      .map(r => {
        const u = r.Units ? `${r.Units}` : "";
        const label = r.Shortform || r.ParameterName;
        return `${label}: ${r.Value}${u}`;
      });
  
    const popupHTML = `
      <strong>${stationName}</strong><br>
      <small>${displayTime}</small><br><br>
      ${[...linesFirst, ...linesRest].join("<br>")}
      <hr>
      <a href="/AQHI.forecast/history/station_compare.html?station=${encodeURIComponent(stationName)}" target="_blank">
        View historical data</a><br>
      <a href="/LiveMap/gauges.html?station=${encodeURIComponent(stationName)}" target="_blank">
        View gauges</a>

    `;
  
    const marker = L.circleMarker([lat, lon], {
      radius: 7,
      fillColor: color,
      color: "#222",
      weight: 1,
      fillOpacity: 0.85
    }).bindPopup(popupHTML);
  
    if (inACA) window.ACAStations.addLayer(marker);
    else if (inWCAS) window.WCASStations.addLayer(marker);
    else window.ALLStations.addLayer(marker);
  });






  // -----------------------
  // PURPLEAIR
  // -----------------------
  window.AppData.purpleair.forEach(p => {
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const inACA  = inside(ACApoly,  lat, lon);
    const inWCAS = inside(WCASpoly, lat, lon);

    const aq = Number(p.eAQHI);
    const color = Number.isFinite(aq) ? window.getAQHIColor(aq) : "#666666";

    const marker = L.circleMarker([lat, lon], {
      radius: 4,
      fillColor: color,
      color: "#222",
      weight: 0.5,
      fillOpacity: 0.85
    }).bindPopup(`
      <strong>PurpleAir</strong><br>
      ${p.name || "Unnamed"}<br>
      AQHI: ${Number.isFinite(aq) ? aq : "--"}<br>
      PM₂.₅: ${Number.isFinite(p.pm) ? p.pm.toFixed(1) : "--"} µg/m³
      <hr>
      <a href="/LiveMap/purple_history.html?sensor=${encodeURIComponent(p.name)}" target="_blank">
        View historical data
      </a>
    `)


    // Add to All + optionally ACA/WCAS
    window.ALLPurple.addLayer(marker);
    if (inACA)  window.ACAPurple.addLayer(marker);
    if (inWCAS) window.WCASPurple.addLayer(marker);
  });


  // Layer control (build once per render; remove old if needed)
  // Optional: store ref to avoid duplicates
  if (window._layerControl) {
    map.removeControl(window._layerControl);
  }

  await loadRoses();




  
  map.addLayer(window.ALLPurple);
  
  window._layerControl = L.control.layers(null, {
    "ACA Boundary": ACABoundaryLayer,
    "WCAS Boundary": WCASBoundaryLayer,

    "ACA Stations": window.ACAStations,
    "ACA PurpleAir": window.ACAPurple,

    "WCAS Stations": window.WCASStations,
    "WCAS PurpleAir": window.WCASPurple,

    "All Stations (AB)": window.ALLStations,
    "All PurpleAir (AB)": window.ALLPurple,

    "Rose PM2.5": window.RosePM25,
    "Rose NO₂": window.RoseNO2,
    "Rose O₃": window.RoseO3,

  }, { collapsed: false }).addTo(map);

  console.log("Map rendered.");
};


  function buildRoseTable(p, pollutant) {
  
    let unit = "";
    if (pollutant === "PM25") unit = "µg/m³";
    if (pollutant === "NO2")  unit = "ppb";
    if (pollutant === "O3")   unit = "ppb";
  
    const dirs = ["N","NE","E","SE","S","SW","W","NW"];
    const bins = ["calm","low","med","high"];
  
    let html = `<strong>${p.station}</strong><br>`;
    html += `<table style="border-collapse:collapse;font-size:12px;">`;
    html += `<tr><th>Dir</th><th>Calm</th><th>Low</th><th>Med</th><th>High</th></tr>`;
  
    dirs.forEach(d => {
      html += `<tr><td><b>${d}</b></td>`;
      bins.forEach(b => {
        const val = Number(p[`${d}_${b}`] || 0);
        html += `<td>${val.toFixed(1)}</td>`;
      });
      html += `</tr>`;
    });
  
    html += `</table><br>`;
    html += `Units: ${unit}`;
  
    return html;
  }





  // roses
  async function loadRoses() {
  
    console.log("Loading roses...");
  
    const types = [
      { key: "PM25", layer: window.RosePM25 },
      { key: "NO2",  layer: window.RoseNO2  },
      { key: "O3",   layer: window.RoseO3   }
    ];
  
    for (const t of types) {
  
      t.layer.clearLayers();
  
      const res = await fetch(`data/rose_${t.key}.geojson`);
      const geo = await res.json();
  
      geo.features.forEach(f => {
  
        const latlng = L.latLng(
          f.geometry.coordinates[1],
          f.geometry.coordinates[0]
        );
  
        // draw wedges
        drawRose(latlng, f.properties, t.layer, t.key);
  
        // add center marker for popup
        const centerMarker = L.circleMarker(latlng, {
          radius: 4,
          fillColor: "#000",
          color: "#000",
          weight: 1,
          fillOpacity: 1
        });
  
        centerMarker.bindPopup(
          buildRoseTable(f.properties, t.key)
        );
  
        centerMarker.addTo(t.layer);
      });
  
    }
  
    console.log("Roses done.");
  }



