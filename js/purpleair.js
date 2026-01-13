// ================================
// purpleair.js
// ================================

window.drawPurpleAir = function () {

  console.log("Drawing PurpleAir…");

  if (!window.map || !window.purpleFC) {
    console.error("Missing map or PurpleAir data");
    return;
  }

  window.layerPA.clearLayers();

  window.purpleFC.features.forEach(f => {

    const p = f.properties;
    const lat = f.geometry.coordinates[1];
    const lon = f.geometry.coordinates[0];

    const pm = Number(
      p.pm2_5_corrected ??
      p.pm25 ??
      p.pm2_5_atm ??
      p.PM2_5 ??
      p.PM25 ??
      p.value ??
      p.Value
    );

    const color = getPAColor(pm);

    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      color: "black",
      weight: 1.5,
      fillColor: color,
      fillOpacity: 0.85,
      className: "pa-dot"
    }).addTo(window.layerPA);

    marker.bindTooltip(
      `<b>${p.name || "PurpleAir"}</b><br>
       PM2.5: ${Number.isFinite(pm) ? pm.toFixed(1) : "Offline"}`
    );

    // click wiring
    marker.on("click", () => {
      showStationModal({ StationName: p.name });
      window.showGaugesForStation({ PM25: pm });
    });

  });

  console.log("PurpleAir rendered.");
};


// ================================
// PurpleAir Color Scale
// ================================

function getPAColor(pm) {

  if (!Number.isFinite(pm)) return "#808080";
  if (pm > 100) return "#640100";
  if (pm > 90)  return "#9a0100";
  if (pm > 80)  return "#cc0001";
  if (pm > 70)  return "#fe0002";
  if (pm > 60)  return "#fd6866";
  if (pm > 50)  return "#ff9835";
  if (pm > 40)  return "#ffcb00";
  if (pm > 30)  return "#fffe03";
  if (pm > 20)  return "#016797";
  if (pm > 10)  return "#0099cb";
  if (pm > 0)   return "#01cbff";

  return "#D3D3D3";
}


// ================================
// GeoJSON Builder
// ================================

window.buildPurpleFC = function (data) {
  return {
    type: "FeatureCollection",
    features: data
      .filter(p => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
      .map(p => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [Number(p.longitude), Number(p.latitude)]
        },
        properties: p
      }))
  };
};


// ================================
// Init hook
// ================================

window.initPurpleAir = async function () {
  console.log("Initializing PurpleAir layers…");

  window.map = map;
  
  window.drawPurpleAir();
  return window.layerPA;
};
