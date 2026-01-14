window.renderMap = function () {

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
