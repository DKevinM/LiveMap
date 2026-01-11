let stations = [];
let latestData = [];

const group = st.Airshed === "ACA" ? layerACA : layerWCAS;

const marker = L.circleMarker([st.Lat, st.Lon], { ... }).addTo(group);


Promise.all([
  fetch("data/stations.json").then(r => r.json()),
  fetch("data/last6h.json").then(r => r.json())
]).then(([stationList, last6h]) => {
  stations = stationList;
  latestData = last6h;
  drawStations();
});

function drawStations() {
  stations.forEach(st => {
    const row = latestData.find(r => r.StationName === st.StationName && r.ParameterName === "AQHI");
    let val = row ? Number(row.Value) : null;

    if (row?.Value === "10+" || row?.Value === "10 +") val = 11;

    const color = getAQHIColor(val);

    const marker = L.circleMarker([st.Lat, st.Lon], {
      radius: 18,
      color: "black",
      weight: 2,
      fillColor: color,
      fillOpacity: 0.85
    }).addTo(map);

    marker.stationData = {...st, AQHI: val};

    marker.bindTooltip(`${st.StationName}<br>AQHI: ${val ?? "NA"}`);

    marker.on("click", () => {
      showStationModal(marker.stationData);
      buildGauges(marker.stationData);
    });
  });
}
