const PURPLE_URL = "https://dkevinm.github.io/AB_datapull/data/AB_PM25_map.json";
// BC 150 km border band (AB_datapull/PA_BC_pull.py), added 2026-09-30
const PURPLE_URL_BC = "https://dkevinm.github.io/AB_datapull/data/BC_PM25_map.json";

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

  const load = async (url, province) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const recs = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
    return recs.map(r => ({ ...r, province }));
  };

  // BC is optional: if it fails, still draw AB
  const [ab, bc] = await Promise.allSettled([
    load(PURPLE_URL, "AB"),
    load(PURPLE_URL_BC, "BC")
  ]);
  if (ab.status !== "fulfilled") {
    console.error("PurpleAir load failed:", ab.reason);
    return;
  }
  if (bc.status !== "fulfilled") console.warn("PurpleAir BC load failed:", bc.reason);

  const records = ab.value.concat(bc.status === "fulfilled" ? bc.value : []);

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
      radius: 9,
      fillColor: color,
      color: "#111",
      weight: 1,
      fillOpacity: 0.88
    }).bindPopup(`
      <strong>PurpleAir</strong>${rec.province === "BC" ? " (BC)" : ""}<br>
      ${label}<br>
      ${sensorIndex != null ? `Sensor index: ${sensorIndex}<br>` : ""}
      eAQHI: ${eAQHI}<br>
      PM₂.₅ (corr): ${pm.toFixed(1)} µg/m³
      <hr>
        ${historyLink}
    `);

    if (!window.layers?.purpleair) return;
    marker.addTo(window.layers.purpleair);

    // add AQHI number label inside circle
    const labelMarker = L.marker([lat, lon], {
      icon: L.divIcon({
        className: "purpleair-label",
        html: `<div class="pa-inner">${eAQHI > 10 ? "10+" : Math.round(eAQHI)}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      }),
      interactive: false
    });
    
    labelMarker.addTo(window.layers.purpleair);    

  });
};
