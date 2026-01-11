function showStationModal(station) {
  alert("Station: " + station.name);
}

function getAQHIColor(val) {
  if (!val || val < 1) return "#D3D3D3";
  if (val == 1) return "#01cbff";
  if (val == 2) return "#0099cb";
  if (val == 3) return "#016797";
  if (val == 4) return "#fffe03";
  if (val == 5) return "#ffcb00";
  if (val == 6) return "#ff9835";
  if (val == 7) return "#fd6866";
  if (val == 8) return "#fe0002";
  if (val == 9) return "#cc0001";
  if (val == 10) return "#9a0100";
  return "#640100";
}

function showLocationModal(lat, lon, stations, sensors) {

  let html = `<h2>Location Analysis</h2>
              <b>Lat:</b> ${lat.toFixed(4)} <b>Lon:</b> ${lon.toFixed(4)}<br><br>`;

  html += `<h3>Nearest Stations</h3>`;
  stations.forEach(s => html += `• ${s.StationName}<br>`);

  html += `<h3>Nearest PurpleAir</h3>`;
  sensors.forEach(p => html += `• ${p.name}<br>`);

  html += `<div id="station-gauges"></div>`;

  body.innerHTML = html;
  modal.style.display = "block";

  buildFullGaugePanel(stations[0]);   // Primary station
}


const modal = document.getElementById("modal");
const body = document.getElementById("modal-body");
document.getElementById("close").onclick = () => modal.style.display = "none";

const legend = L.control({position:'bottomleft'});

legend.onAdd = function () {
  const div = L.DomUtil.create('div','info legend');
  div.innerHTML = `<img src="aep-aqhi-scale.png" style="width:150px">`;
  return div;
};

legend.addTo(map);



function showStationModal(st) {
  body.innerHTML = `
    <h2>${st.StationName}</h2>
    <div id="station-gauges"></div>
  `;
  modal.style.display = "block";
}
