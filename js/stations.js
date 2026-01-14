window.renderStations = async function () {

  console.log("Rendering stations…");

  if (!window.fetchAllStationData) {
    console.error("fetchAllStationData not available yet.");
    return;
  }

  const allStations = await window.fetchAllStationData();

  if (!window.map || !window.markerGroup) {
    console.error("Map not ready for stations.");
    return;
  }

  window.markerGroup.clearLayers();

  allStations.forEach(st => {

    const color = getColor(String(st.aqhi || "NA"));

    const marker = L.circleMarker([st.lat, st.lon], {
      radius: 7,
      fillColor: color,
      color: "#222",
      weight: 1,
      fillOpacity: 0.85
    })
    .bindPopup(st.html)
    .addTo(window.markerGroup);

    marker.on("click", () => {
      if (window.buildFullGaugePanel) {
        window.buildFullGaugePanel({
          StationName: st.stationName,
          AQHI: st.aqhi
        });
      }
    });
  });

  console.log("Stations rendered.");
};
