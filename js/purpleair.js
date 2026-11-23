// Sources, exclusions and the AQHI rule live in data.js (PA_SOURCES, PA_EXCLUDED_SENSORS, paSensorAQHI) so the
// dots, the click popup and the mobile pages always agree (2026-11-23).
window.computeEAQHI = function (pm) { return window.paPmOnlyAQHI(pm); };   // kept for any old callers


window.renderPurpleAir = async function () {

  if (!window.map) throw new Error("Map not initialized");
  // Dots go in their own pane above the AQHI grid, which loads into
  // overlayPane later and would otherwise take the clicks. Same pane as
  // render.js dotPane("sensorPane", 440); made here too because AB_mobile
  // loads this file without render.js.
  if (!window.map.getPane("sensorPane")) window.map.createPane("sensorPane").style.zIndex = 440;

  if (window.layers?.purpleair) {
    window.layers.purpleair.clearLayers();
  }

  let records;
  try {
    records = await window.loadPurpleAirRecords();
  } catch (e) {
    console.error("PurpleAir load failed:", e);
    return;
  }

  records.forEach(rec => {
  const lat = Number(rec.latitude);
  const lon = Number(rec.longitude);
  const pm  = Number(rec.pm_corr);
  
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(pm)) return;

    // Full-formula AQHI (sensor PM2.5 + regional O3/NO2, build_pa_regional_aqhi.py);
    // PM-only estimate if the build hasn't filled it
    const hasRG = rec.aqhi_rg !== null && rec.aqhi_rg !== undefined && rec.aqhi_rg !== "" && Number.isFinite(Number(rec.aqhi_rg));
    const eAQHI = window.paSensorAQHI(rec);
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
      fillOpacity: 0.88,
      pane: "sensorPane"   // above the AQHI grid (see top of renderPurpleAir)
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
