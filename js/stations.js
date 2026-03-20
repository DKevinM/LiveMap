window.loadStations = async function () {

  console.log("Loading stations…");

  // ----------------------------
  // SAFETY CHECKS
  // ----------------------------
  if (!window.fetchAllStationData) {
    console.error("fetchAllStationData not available.");
    return;
  }

  if (!window.layers?.stations) {
    console.error("Stations layer not initialized.");
    return;
  }

  // ----------------------------
  // FETCH DATA
  // ----------------------------
  const allStations = await window.fetchAllStationData();

  if (!allStations || allStations.length === 0) {
    console.warn("No station data available.");
    return;
  }

  // ----------------------------
  // CLEAR EXISTING
  // ----------------------------
  window.layers.stations.clearLayers();

  // ----------------------------
  // RENDER STATIONS
  // ----------------------------
  allStations.forEach(st => {

    let aqhiVal = st.aqhi;
    
    if (!isFinite(aqhiVal)) {
      aqhiVal = "NA";
    } else {
      aqhiVal = Math.round(aqhiVal);
    
      if (aqhiVal > 10) {
        aqhiVal = "10+";
      }
    }
    
    const color = getColor(aqhiVal);    

    const marker = L.circleMarker([st.lat, st.lon], {
      radius: 7,
      fillColor: color,
      color: "#222",
      weight: 1,
      fillOpacity: 0.85
    })
    .bindPopup(st.html)
    .addTo(window.layers.stations);

    // ----------------------------
    // CLICK HANDLER
    // ----------------------------
    marker.on("click", () => {
      if (window.buildFullGaugePanel) {
        window.buildFullGaugePanel({
          StationName: st.stationName,
          AQHI: st.aqhi
        });
      }
    });

  });

  console.log("Stations loaded:", allStations.length);

};
