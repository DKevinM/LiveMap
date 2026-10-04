const PURPLE_URL = "https://dkevinm.github.io/AB_datapull/data/AB_PM25_map.json";
// 150 km border bands (AB_datapull/PA_border_pull.py; SK cut from SK_datapull), added 2026-09-30
const PURPLE_BORDER_URLS = {
  BC: "https://dkevinm.github.io/AB_datapull/data/BC_PM25_map.json",
  NT: "https://dkevinm.github.io/AB_datapull/data/NT_PM25_map.json",
  SK: "https://dkevinm.github.io/AB_datapull/data/SK_band_PM25_map.json"
};

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

  // Border bands are optional: if one fails, still draw the rest
  const borders = Object.entries(PURPLE_BORDER_URLS);
  const [ab, ...rest] = await Promise.allSettled([
    load(PURPLE_URL, "AB"),
    ...borders.map(([prov, url]) => load(url, prov))
  ]);
  if (ab.status !== "fulfilled") {
    console.error("PurpleAir load failed:", ab.reason);
    return;
  }
  let records = ab.value;
  rest.forEach((r, i) => {
    if (r.status === "fulfilled") records = records.concat(r.value);
    else console.warn(`PurpleAir ${borders[i][0]} load failed:`, r.reason);
  });

  records.forEach(rec => {
  if (excludedSensors.includes(rec.sensor_index)) return;
    
  const lat = Number(rec.latitude);
  const lon = Number(rec.longitude);
  const pm  = Number(rec.pm_corr);
  
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pm)) return;

    // Full-formula AQHI (sensor PM2.5 + regional O3/NO2, build_pa_regional_aqhi.py);
    // PM-only estimate if the build hasn't filled it
    const hasRG = Number.isFinite(Number(rec.aqhi_rg)) && rec.aqhi_rg !== null;
    const eAQHI = hasRG ? Number(rec.aqhi_rg) : computeEAQHI(pm);
    if (eAQHI == null) return;
    let aqhiNote = !hasRG
      ? "PM₂.₅ only"
      : rec.aqhi_method === "regional_gas"
        ? (rec.aqhi_override === "applied"
            ? "Set by local PM₂.₅ (smoke rule)"
            : `PM₂.₅ + regional O₃ ${rec.o3_ppb} / NO₂ ${rec.no2_ppb} ppb`)
        : "PM₂.₅ + seasonal adjustment";
    // High local PM2.5 that nearby sensors / the sensor's own history didn't back up
    if (rec.aqhi_override === "questioned") {
      aqhiNote += "<br>⚠ High PM₂.₅ reading not confirmed - not used";
    }

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
      <strong>PurpleAir</strong>${rec.province !== "AB" ? ` (${rec.province})` : ""}<br>
      ${label}<br>
      ${sensorIndex != null ? `Sensor index: ${sensorIndex}<br>` : ""}
      eAQHI: ${eAQHI > 10 ? "10+" : eAQHI}<br>
      <small>${aqhiNote}</small><br>
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
