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
    const hasAQHI = Number.isFinite(aq);
    
    const color = hasAQHI ? getAQHIColor(aq) : "#888888";

    const rows = window.dataByStation?.[st.stationName] || [];
    
    function val(p) {
      const r = rows.find(x => x.ParameterName === p);
      return r ? r.Value : "--";
    }
    
    function unit(p) {
      const r = rows.find(x => x.ParameterName === p);
      return r ? r.Unit : "";
    }
    
    const popupHTML = `
      <strong>${st.stationName}</strong><br>
      ${rows[0]?.DateTime || ""}<br><br>
    
      AQHI: <b>${val("AQHI")}</b><br>
      Temp: ${val("Outdoor Temperature")} °C<br>
      Humidity: ${val("Relative Humidity")} %<br>
      Wind Speed: ${val("Wind Speed")} km/h<br>
      Wind Dir: ${val("Wind Direction")}°<br><br>
    
      NO₂: ${val("Nitrogen Dioxide")} ppb<br>
      O₃: ${val("Ozone")} ppb<br>
      PM2.5: ${val("Fine Particulate Matter")} µg/m³<br>
      CO: ${val("Carbon Monoxide")} ppm<br>
    
      <hr>
      <a href="/AQHI.forecast/history/station_history.html?station=${encodeURIComponent(st.stationName)}" target="_blank">
        View historical data
      </a>
    `;
    
    const marker = L.circleMarker([st.lat, st.lon], {
      radius: 7,
      fillColor: color,
      color: "#222",
      weight: 1,
      fillOpacity: 0.85
    }).bindPopup(popupHTML);

    
    if (inACA) {
      ACAStations.addLayer(marker);
    }
    else if (inWCAS) {
      WCASStations.addLayer(marker);
    }
    else {
      ALLStations.addLayer(marker);
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


  
