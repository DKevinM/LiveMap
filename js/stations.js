// stations.js
window.renderStations = async function () {
  if (!window.map || !window.markerGroup) throw new Error("Map not initialized");

  // Make sure data.js finished building dataByStation
  await window.dataReady;

  const stations = await window.fetchAllStationData(); // <-- your function
  window.markerGroup.clearLayers();

  stations.forEach(({ stationName, lat, lon, html, aqhi }) => {
    const fillColor = window.getAQHIColor(String(aqhi ?? "NA"));

    const marker = L.circleMarker([Number(lat), Number(lon)], {
      radius: 10,                 // station size
      fillColor,
      color: "#111",
      weight: 2,
      fillOpacity: 0.92
    });

    marker.bindPopup(html);

    marker.on("click", () => {
      // Optional: if you want gauges in your modal later, hook here.
      // For now: just open popup
      marker.openPopup();
    });

    marker.addTo(window.markerGroup);
  });

  return window.markerGroup;
};
