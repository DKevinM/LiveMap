let ACApoly = null;
let WCASpoly = null;

let ACABoundaryLayer = null;
let WCASBoundaryLayer = null;

fetch('data/ACA.geojson')
  .then(r => r.json())
  .then(g => {
    ACApoly = g;
    ACABoundaryLayer = L.geoJSON(g, {
      style: { color: "#1f78b4", weight: 2, fill: false }
    });
  });

fetch('data/WCAS.geojson')
  .then(r => r.json())
  .then(g => {
    WCASpoly = g;
    WCASBoundaryLayer = L.geoJSON(g, {
      style: { color: "#33a02c", weight: 2, fill: false }
    });
  });



window.renderMap = function () {

  const map = window.map;

  // --- Layer Groups ---
  const ACAStations   = L.layerGroup();
  const ACAPurple     = L.layerGroup();

  const WCASStations  = L.layerGroup();
  const WCASPurple    = L.layerGroup();

  const ALLStations   = L.layerGroup().addTo(map);
  const ALLPurple     = L.layerGroup().addTo(map);

  // ---------- STATIONS ----------
  AppData.stations.forEach(st => {

    const inACA  = inside(ACApoly, st.lat, st.lon);
    const inWCAS = inside(WCASpoly, st.lat, st.lon);
    
    const aq = Number(st.aqhi);
    const hasAQHI = Number.isFinite(aq);
    
    const color = hasAQHI ? getAQHIColor(aq) : "#888888";

    const marker = L.circleMarker([st.lat, st.lon], {
      radius: 7,
      fillColor: color,
      color: "#222",
      weight: 1,
      fillOpacity: 0.85
    }).bindPopup(`
      <strong>${st.stationName}</strong><br>
      AQHI: ${aq}
    `);
    
    ALLStations.addLayer(marker);
    
    if (inACA)  ACAStations.addLayer(marker);
    if (inWCAS) WCASStations.addLayer(marker);

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
   
    if (inACA)  ACAStations.addLayer(marker);
    if (inWCAS) WCASStations.addLayer(marker);
    
  });

  // ---------- LAYER CONTROL ----------
  L.control.layers(null, {
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


  
