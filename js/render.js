// --- Shared Layer Groups (available to all scripts) ---
window.ACAStations  = L.layerGroup();
window.ACAPurple    = L.layerGroup();
window.WCASStations = L.layerGroup();
window.WCASPurple   = L.layerGroup();
window.ALLStations  = L.layerGroup();
window.ALLPurple    = L.layerGroup();


let ACApoly = null;
let WCASpoly = null;

// Create empty layers FIRST
let ACABoundaryLayer = L.layerGroup();
let WCASBoundaryLayer = L.layerGroup();

fetch('data/ACA.geojson')
  .then(r => r.json())
  .then(g => {
    ACApoly = g;
    const gj = L.geoJSON(g, {
      style: { color: "#33a02c", weight: 2, fill: false }
    });
    ACABoundaryLayer.clearLayers();   // important
    ACABoundaryLayer.addLayer(gj);   // add INTO the group
  });

fetch('data/WCAS.geojson')
  .then(r => r.json())
  .then(g => {
    WCASpoly = g;

    const gj = L.geoJSON(g, {
      style: { color: "#1b9e77", weight: 2, fill: false }
    });

    WCASBoundaryLayer.clearLayers();   // important
    WCASBoundaryLayer.addLayer(gj);   // add INTO the group
  });


function inside(poly, lat, lon) {
  if (!poly) return true;
  return turf.booleanPointInPolygon(
    turf.point([lon, lat]),
    poly.features[0]
  );
}



window.renderMap = function () {

  const map = window.map;
  window.ALLStations.addTo(map);
  window.ALLPurple.addTo(map);
  window.ACAStations.addTo(map);
  window.ACAPurple.addTo(map);
  window.WCASStations.addTo(map);
  window.WCASPurple.addTo(map);
  
  ACABoundaryLayer.addTo(map);
  WCASBoundaryLayer.addTo(map);



  // ---------- STATIONS ----------
  AppData.stations.forEach(st => {
  
    const inACA  = inside(ACApoly, st.lat, st.lon);
    const inWCAS = inside(WCASpoly, st.lat, st.lon);
  
    const aq = Number(st.aqhi);
    const color = Number.isFinite(aq) ? getAQHIColor(aq) : "#888888";
  
    const by = window.dataByStation || {};
    const wanted = (st.stationName || "").trim().toLowerCase();
    const matchKey = Object.keys(by).find(k => k.trim().toLowerCase() === wanted);
    const rows = matchKey ? (by[matchKey] || []) : [];
  
    let popupHTML;
  
    if (!rows.length) {
      popupHTML = `
        <strong>${st.stationName}</strong><br>
        AQHI: ${Number.isFinite(aq) ? aq : "--"}<br><br>
        <em>No recent station parameter data loaded.</em>
      `;
    } else {
      const lines = rows.map(r => {
        const u = r.Unit ? ` ${r.Unit}` : "";
        return `${r.ParameterName}: ${r.Value}${u}`;
      }).join("<br>");
  
      popupHTML = `
        <strong>${st.stationName}</strong><br>
        ${rows[0]?.DateTime || ""}<br><br>
        ${lines}
        <hr>
        <a href="/AQHI.forecast/history/station_compare.html?station=${encodeURIComponent(st.stationName)}" target="_blank">
          View historical data
        </a>
      `;
    }
  
    const marker = L.circleMarker([st.lat, st.lon], {
      radius: 7,
      fillColor: color,
      color: "#222",
      weight: 1,
      fillOpacity: 0.85
    }).bindPopup(popupHTML);
  
    if (inACA) {
      window.ACAStations.addLayer(marker);
    } else if (inWCAS) {
      window.WCASStations.addLayer(marker);
    } else {
      window.ALLStations.addLayer(marker);
    }
  
  });


  // ---------- PURPLEAIR ----------
  AppData.purpleair.forEach(p => {

    const aq = Number(p.eAQHI);
    const hasAQHI = Number.isFinite(aq);
    
    const color = hasAQHI ? getAQHIColor(aq) : "#666666";


    const marker = L.circleMarker([p.lat, p.lon], {
      radius: 4,
      fillColor: color,
      color: "#222",
      weight: 0.5,
      fillOpacity: 0.85
    }).bindPopup(`
      <strong>PurpleAir</strong><br>
      ${p.name}<br>
      AQHI: ${aq}<br>
      PM₂.₅: ${p.pm.toFixed(1)} µg/m³
    `);

    ALLPurple.addLayer(marker);
   
    if (inACA)  ACAPurple.addLayer(marker);
    if (inWCAS) WCASPurple.addLayer(marker);
    
  });

  // ---------- LAYER CONTROL ----------
  L.control.layers(null, {
    "ACA Boundary": ACABoundaryLayer,
    "WCAS Boundary": WCASBoundaryLayer,
  
    "ACA Stations": ACAStations,
    "ACA PurpleAir": ACAPurple,
  
    "WCAS Stations": WCASStations,
    "WCAS PurpleAir": WCASPurple,
  
    "All Stations (AB)": ALLStations,
    "All PurpleAir (AB)": ALLPurple
  }, { collapsed: false }).addTo(map);

  console.log("Map rendered.");
};


window.renderStations = window.renderMap;
window.renderPurpleAir = () => {};


  
