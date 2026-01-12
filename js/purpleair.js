window.drawPurpleAir = function () {

  console.log("🟣 Drawing PurpleAir…");

  if (!window.map || !window.purpleFC) {
    console.error("❌ Missing map or PurpleAir data");
    return;
  }

  window.layerPA.clearLayers();

  window.purpleFC.features.forEach(f => {

    const p = f.properties;
    const lat = f.geometry.coordinates[1];
    const lon = f.geometry.coordinates[0];

    const pm = p.pm2_5_corrected;

    const color = getPAColor(pm, p.name);

    const marker = L.circleMarker([lat, lon], {
      radius: 8,
      color: "black",
      weight: 1,
      fillColor: color,
      fillOpacity: 0.85
    }).addTo(window.layerPA);

    marker.bindTooltip(
      `<b>${p.name}</b><br>PM2.5: ${pm ?? "Offline"}`
    );
  });

  console.log("✅ PurpleAir rendered.");
};


function getPAColor(pm, name) {

  if (pm == null || isNaN(pm)) return "#808080";

  if (pm > 100) return "#640100";  // AQHI 10+
  if (pm > 90)  return "#9a0100";  // AQHI 10
  if (pm > 80)  return "#cc0001";  // AQHI 9
  if (pm > 70)  return "#fe0002";  // AQHI 8
  if (pm > 60)  return "#fd6866";  // AQHI 7
  if (pm > 50)  return "#ff9835";  // AQHI 6
  if (pm > 40)  return "#ffcb00";  // AQHI 5
  if (pm > 30)  return "#fffe03";  // AQHI 4
  if (pm > 20)  return "#016797";  // AQHI 3
  if (pm > 10)  return "#0099cb";  // AQHI 2
  if (pm > 0)   return "#01cbff";  // AQHI 1

  return "#D3D3D3";
}
