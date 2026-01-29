// purpleair.js
const PURPLE_URL = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PM25_map.json";

function computeEAQHI(pm) {
  if (pm == null || isNaN(pm)) return null;
  let val = Math.floor(pm / 10) + 1;
  if (val < 0) val = 0;
  if (val > 10) val = 10;
  return val;
}

window.renderPurpleAir = async function () {
  if (!window.map || !window.paLayer) throw new Error("Map not initialized");

  const res = await fetch(PURPLE_URL);
  const data = await res.json();

  const records = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
  window.paLayer.clearLayers();

  records.forEach(rec => {
    const lat = parseFloat(rec.lat ?? rec.Latitude ?? rec.latitude);
    const lon = parseFloat(rec.lon ?? rec.Longitude ?? rec.longitude);
    const pm  = parseFloat(rec.pm_corr);

    if (!isFinite(lat) || !isFinite(lon) || !isFinite(pm)) return;

    const eAQHI = computeEAQHI(pm);
    if (eAQHI == null) return;

    const sensorIndex = rec.sensor_index;
    const label = rec.name || (sensorIndex != null ? `Sensor ${sensorIndex}` : "Unnamed sensor");
    const color = window.getAQHIColor(String(eAQHI));

    const marker = L.circleMarker([lat, lon], {
      radius: 5,                 // smaller than stations
      fillColor: color,
      color: "#111",
      weight: 1,
      fillOpacity: 0.88
    }).bindPopup(
      `<strong>PurpleAir</strong><br>
       ${label}<br>
       ${sensorIndex != null ? `Sensor index: ${sensorIndex}<br>` : ""}
       eAQHI: ${eAQHI}<br>
       PM₂.₅ (corr): ${pm.toFixed(1)} µg/m³
       <hr>
       ${sensorIndex != null ? `
         <a href="/AQHI.forecast/history/sensor_compare.html?sensor_index=${sensorIndex}" target="_blank">
           View historical PM2.5
         </a>` : ""}`
    );

    marker.addTo(window.ALLPurple);
  });

  return window.paLayer;
};
