// ---------- AQHI COLORS ----------
function getAQHIColor(val) {
  if (val == null || isNaN(val) || val < 1) return "#D3D3D3";
  if (val == 1)  return "#01cbff";
  if (val == 2)  return "#0099cb";
  if (val == 3)  return "#016797";
  if (val == 4)  return "#fffe03";
  if (val == 5)  return "#ffcb00";
  if (val == 6)  return "#ff9835";
  if (val == 7)  return "#fd6866";
  if (val == 8)  return "#fe0002";
  if (val == 9)  return "#cc0001";
  if (val == 10) return "#9a0100";
  return "#640100";
}

// ---------- MODAL UI ----------
window.showStationModal = function (st) {

  const body = document.getElementById("modal-body");
  const modal = document.getElementById("modal");

  body.innerHTML = `
    <h2>${st.StationName}</h2>
    <div id="station-gauges"></div>
    <div id="history-chart"></div>
  `;

  modal.style.display = "block";

  buildGauges(st);
  showHistoryChart(st.StationName);
};

window.showLocationModal = function (lat, lon, stations, sensors) {

  const body = document.getElementById("modal-body");
  const modal = document.getElementById("modal");

  let html = `
    <h2>Location Analysis</h2>
    <b>Lat:</b> ${lat.toFixed(4)} <b>Lon:</b> ${lon.toFixed(4)}<br><br>

    <h3>Nearest Stations</h3>
    ${stations.map(s => `• ${s.StationName}`).join("<br>")}

    <h3>Nearest PurpleAir</h3>
    ${sensors.map(p => `• ${p.name}`).join("<br>")}

    <div id="station-gauges"></div>
  `;

  body.innerHTML = html;
  modal.style.display = "block";

  buildGauges(stations[0]);
};

// ---------- HISTORY ----------
window.showHistoryChart = function (stationName) {

  const hist = window.historyData?.[stationName];
  if (!hist) return;

  const trace = {
    x: hist.map(r => r.time),
    y: hist.map(r => r.value),
    type: 'scatter',
    mode: 'lines+markers',
    name: 'AQHI'
  };

  Plotly.newPlot("history-chart", [trace], { height: 300 });
};

// ---------- LEGEND ----------
window.initLegend = function () {

  const legend = L.control({ position: 'bottomleft' });


  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "aqhi-legend");
    div.innerHTML = `
      <img src="aqhilegend.png" style="
        width:160px;
        background:white;
        padding:6px;
        border-radius:8px;
        box-shadow:0 2px 6px rgba(0,0,0,0.25);
      ">
    `;
    return div;
  };

  legend.addTo(window.map);
};


window.initUI = function ({ map }) {
  console.log("Initializing UI components…");

  // Add AQHI legend
  if (typeof initLegend === "function") {
    initLegend();
  }

  console.log("UI ready.");
};
