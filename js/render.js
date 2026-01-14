window.renderMap = function () {

function normalizeStationForGauges(st) {

  const params = {};
  const list = window.dataByStation?.[st.stationName] || [];

  list.forEach(r => {
    const p = r.ParameterName;
    const v = Number(r.Value);

    if (p === "AQHI") params.AQHI = v;
    if (p === "Fine Particulate Matter") params.PM25 = v;
    if (p === "Ozone") params.O3 = v;
    if (p === "Nitrogen Dioxide") params.NO2 = v;
    if (p === "Relative Humidity") params.RH = v;
    if (p === "Outdoor Temperature") params.Temp = v;
    if (p === "Wind Speed") params.WS = v;
  });

  return {
    ...st,
    ...params
  };
}


  
  const map = window.map;

  const stationLayer = L.layerGroup().addTo(map);
  const purpleLayer  = L.layerGroup().addTo(map);

  // --- Stations ---
  AppData.stations.forEach(st => {
    const color = getAQHIColor(st.aqhi);
  
    const marker = L.circleMarker([st.lat, st.lon], {
      radius: 7,
      fillColor: color,
      color: "#222",
      weight: 1,
      fillOpacity: 0.85
    })
    .addTo(stationLayer);
  
    marker.on("click", () => {
      if (typeof showStationModal === "function") {
        showStationModal(st);
      }
      if (typeof buildGauges === "function") {
        buildGauges(st);
      }
    });

  marker.bindPopup(st.html);
});


  // --- PurpleAir ---
  AppData.purpleair.forEach(p => {
    L.circleMarker([p.lat, p.lon], {
      radius: 4,
      fillColor: p.color,
      color: "#222",
      weight: 0.5,
      fillOpacity: 0.85
    })
    .bindPopup(
      `<strong>PurpleAir</strong><br>
       ${p.name}<br>
       eAQHI: ${p.eAQHI}<br>
       PM₂.₅: ${p.pm.toFixed(1)} µg/m³`
    )
    .addTo(purpleLayer);
  });

  console.log("Map rendered.");
};


marker.on("click", () => {

  const fullStation = normalizeStationForGauges(st);

  if (typeof showStationModal === "function") {
    showStationModal(fullStation);
  }

  if (typeof showGaugesForStation === "function") {
    showGaugesForStation(fullStation);
  }

});
