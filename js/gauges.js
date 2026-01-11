function buildGauges(data) {
  console.log("Build gauges for:", data);
}

function buildGauges(station) {
  const container = document.getElementById("station-gauges");

  const data = [{
    type: "indicator",
    mode: "gauge+number",
    value: station.AQHI ?? 0,
    title: { text: "AQHI" },
    gauge: { axis: { range: [0, 11] } }
  }];

  Plotly.newPlot(container, data, { height: 300 });
}
