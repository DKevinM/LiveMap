const PURPLE_URL = "https://dkevinm.github.io/AB_datapull/data/AB_PM25_map.json";

const excludedSensors = [
  114435,
  121565
];

window.computeEAQHI = function(pm) {
  if (pm == null || isNaN(pm)) return null;

  pm = Number(pm);

  if (pm > 100) return 10;
  else if (pm > 90) return 10;
  else if (pm > 80) return 9;
  else if (pm > 70) return 8;
  else if (pm > 60) return 7;
  else if (pm > 50) return 6;
  else if (pm > 40) return 5;
  else if (pm > 30) return 4;
  else if (pm > 20) return 3;
  else if (pm > 10) return 2;
  else if (pm > 0) return 1;

  return null;
}


window.renderPurpleAir = async function () {

  if (!window.map) throw new Error("Map not initialized");

  if (window.layers?.purpleair) {
    window.layers.purpleair.clearLayers();
  }

  let data = [];

  try {
    const res = await fetch(PURPLE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error("PurpleAir load failed:", err);
    return;
  }

  const records = Array.isArray(data)
    ? data
    : (Array.isArray(data.data) ? data.data : []);

  records.forEach(rec => {
  if (excludedSensors.includes(rec.sensor_index)) return;
    
  const lat = Number(rec.latitude);
  const lon = Number(rec.longitude);
  const pm  = Number(rec.pm_corr);
  
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pm)) return;

    const eAQHI = computeEAQHI(pm);
    if (eAQHI == null) return;

    const sensorIndex = rec.sensor_index;
    const label = rec.name || (sensorIndex != null ? `Sensor ${sensorIndex}` : "Unnamed sensor");
    const color = window.getAQHIColor(eAQHI);
    const showHistory = window.APP_CONFIG?.enableHistory === true;
    const historyLink = (showHistory && sensorIndex != null)
      ? `<a href="https://dkevinm.github.io/AB_datapull/web/sensor_compare.html?sensor_index=${sensorIndex}" target="_blank">
           View historical PM2.5
         </a>`
      : "";    

    const marker = L.circleMarker([lat, lon], {
      radius: 5,
      fillColor: color,
      color: "#111",
      weight: 1,
      fillOpacity: 0.88
    }).bindPopup(`
      <strong>PurpleAir</strong><br>
      ${label}<br>
      ${sensorIndex != null ? `Sensor index: ${sensorIndex}<br>` : ""}
      eAQHI: ${eAQHI}<br>
      PM₂.₅ (corr): ${pm.toFixed(1)} µg/m³
      <hr>
        ${historyLink}
    `);

    if (!window.layers?.purpleair) return;
    marker.addTo(window.layers.purpleair);

  });
};
