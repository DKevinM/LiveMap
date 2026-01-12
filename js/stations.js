window.drawStations = function () {

  console.log("Drawing stations…");

  if (!window.map || !window.stationsFC || !window.last6hTable) {
    console.error("Missing map or station data");
    return;
  }

  // Clear previous
  window.layerACA.clearLayers();
  window.layerWCAS.clearLayers();

  const latest = window.last6hTable;

  window.stationsFC.features.forEach(f => {

    const st = f.properties;
    const lat = f.geometry.coordinates[1];
    const lon = f.geometry.coordinates[0];

    const group = st.Airshed === "ACA" ? window.layerACA : window.layerWCAS;

    const row = latest.find(r =>
      r.StationName === st.StationName &&
      r.ParameterName === "AQHI"
    );

    let val = row ? Number(row.Value) : null;
    if (row?.Value === "10+" || row?.Value === "10 +") val = 11;

    const color = getAQHIColor(val);

    const marker = L.circleMarker([lat, lon], {
      radius: 18,
      color: "black",
      weight: 2,
      fillColor: color,
      fillOpacity: 0.85
    }).addTo(group);

    marker.stationData = { ...st, AQHI: val };

    marker.bindTooltip(
      `<b>${st.StationName}</b><br>AQHI: ${val ?? "NA"}`
    );

    marker.on("click", () => {
      showStationModal(marker.stationData);
      buildGauges(marker.stationData);
    });
  });

  console.log("Stations rendered.");
};
