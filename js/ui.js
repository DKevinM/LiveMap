// ui.js
window.initUI = function () {
  if (!window.map) throw new Error("Map not initialized");

  // Legend
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "legend");
    const grades = ["1","2","3","4","5","6","7","8","9","10","10+"];
    div.innerHTML = `<div style="font-weight:700; margin-bottom:6px;">AQHI</div>`;
    grades.forEach(g => {
      div.innerHTML += `<i style="background:${window.getAQHIColor(g)}"></i> ${g}<br>`;
    });
    return div;
  };
  legend.addTo(window.map);

  // Layer control
  const overlays = {
    "Stations": window.markerGroup,
    "Sensors (PurpleAir)": window.paLayer
  };

  // remove old control if re-init
  if (window.layerControl) window.map.removeControl(window.layerControl);

  window.layerControl = L.control.layers(window.baseLayers, overlays, { collapsed: false }).addTo(window.map);
};
