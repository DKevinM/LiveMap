const PURPLE_URL = "https://dkevinm.github.io/AB_datapull/data/AB_PM25_map.json";

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

    const lat = parseFloat(rec.lat ?? rec.Latitude ?? rec.latitude);
    const lon = parseFloat(rec.lon ?? rec.Longitude ?? rec.longitude);
    const pm  = parseFloat(rec.pm_corr);

    if (!isFinite(lat) || !isFinite(lon) || !isFinite(pm)) return;

    const eAQHI = computeEAQHI(pm);
    if (eAQHI == null) return;

    const sensorIndex = rec.sensor_index;
    const label = rec.name || (sensorIndex != null ? `Sensor ${sensorIndex}` : "Unnamed sensor");
    const color = window.getAQHIColor(eAQHI);

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
      ${sensorIndex != null ? `
        <a href="https://dkevinm.github.io/AB_datapull/web/sensor_compare.html?sensor_index=${sensorIndex}" target="_blank">
          View historical PM2.5
        </a>` : ""}
    `);

    if (!window.layers?.purpleair) return;
    marker.addTo(window.layers.purpleair);

  });
};
