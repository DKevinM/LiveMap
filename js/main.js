function buildRoseSVG(p) {

  const bins = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];

  const max = p.max || 1;
  const R = 55;                 // ← BIGGER RADIUS
  let paths = "";

  bins.forEach((b,i) => {

    const val = p[b] || 0;
    const r = (val / max) * R;

    const a1 = (i * 22.5 - 90) * Math.PI/180;
    const a2 = ((i+1)*22.5 - 90) * Math.PI/180;

    const x1 = 60 + r * Math.cos(a1);
    const y1 = 60 + r * Math.sin(a1);
    const x2 = 60 + r * Math.cos(a2);
    const y2 = 60 + r * Math.sin(a2);

    paths += `
      <path d="M60,60 L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z"
            fill="rgba(220,30,30,0.85)"
            stroke="#222"
            stroke-width="0.5"/>
    `;
  });

  return `
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="58" fill="rgba(255,255,255,0.85)" stroke="#333" stroke-width="2"/>
      ${paths}
    </svg>
  `;
}


// ================= ROSE LAYERS =================
let roseLayers = {};

async function loadRose(type) {

  const res = await fetch(`data/rose_${type}.geojson`);
  const geo = await res.json();

  const layer = L.geoJSON(geo, {
    pointToLayer: function(feature, latlng) {

      const marker = L.marker(latlng, {
        icon: L.divIcon({
          className: '',
          html: buildRoseSVG(feature.properties),
          iconSize: [120,120],
          iconAnchor: [60,60]
        })
      });

      const p = feature.properties;

      marker.bindTooltip(`
        <b>${p.station}</b><br>
        Max: ${p.max}
      `);

      return marker;
    }
  });

  roseLayers[type] = layer;

  layer.addTo(window.map);   // << THIS IS WHAT WAS MISSING
}






window.bootstrap = async function () {

  console.log("Bootstrapping app...");

  if (!window.initMap) {
    console.error("initMap missing");
    return;
  }
  
  await initMap();

  if (!window.AppData?.ready) {
    console.error("AppData.ready missing");
    return;
  }

  await AppData.ready;
  
  if (window.renderStations) {
    await window.dataReady;  
    await renderStations();
  }

  if (window.renderPurpleAir) {
    await renderPurpleAir();
  }
  
  await loadRose("PM25");
  await loadRose("NO2");
  await loadRose("O3");
  
  console.log("Application ready.");
};

window.addEventListener("load", bootstrap);
