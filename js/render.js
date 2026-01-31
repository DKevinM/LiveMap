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
}

window.renderMap = async function () {
  await Promise.all([window.dataReady, acaBoundaryReady, wcasBoundaryReady]);

  const map = window.map;
  if (!map) {
    console.error("renderMap: window.map missing");
    return;
  }
  if (!window.AppData?.stations || !window.AppData?.purpleair) {
    console.error("renderMap: AppData missing stations/purpleair");
    return;
  }

  clearAllLayers();

  // Add base overlay layers (default ON)
  window.ALLStations.addTo(map);
  window.ALLPurple.addTo(map);

  // Optional: boundaries default ON
  ACABoundaryLayer.addTo(map);
  WCASBoundaryLayer.addTo(map);


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
        View historical data
      </a>
      <a href="/LiveMap/gauges.html?station=${encodeURIComponent(stationName)}" target="_blank">
        View gauges & trends
      </a>

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
    `);

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

  window._layerControl = L.control.layers(null, {
    "ACA Boundary": ACABoundaryLayer,
    "WCAS Boundary": WCASBoundaryLayer,

    "ACA Stations": window.ACAStations,
    "ACA PurpleAir": window.ACAPurple,

    "WCAS Stations": window.WCASStations,
    "WCAS PurpleAir": window.WCASPurple,

    "All Stations (AB)": window.ALLStations,
    "All PurpleAir (AB)": window.ALLPurple
  }, { collapsed: false }).addTo(map);

  console.log("Map rendered.");
};

window.renderStations = window.renderMap;
