let roseLayer = null;

async function loadRose(type) {

  if (roseLayer) {
    map.removeLayer(roseLayer);
  }

  const res = await fetch(`data/rose_${type}.geojson`);
  const geo = await res.json();

  roseLayer = L.geoJSON(geo, {
    pointToLayer: function(feature, latlng) {
      return L.marker(latlng, {
        icon: L.divIcon({
          className: '',
          html: buildRoseSVG(feature.properties),
          iconSize: [60,60]
        })
      });
    }
  }).addTo(map);
}



function buildRoseSVG(p) {

  const bins = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];

  const max = p.max || 1;
  const R = 28;
  let paths = "";

  bins.forEach((b,i) => {

    const val = p[b] || 0;
    const r = (val / max) * R;

    const angle = (i * 22.5 - 90) * Math.PI/180;
    const next  = ((i+1)*22.5 - 90) * Math.PI/180;

    const x1 = 30 + r * Math.cos(angle);
    const y1 = 30 + r * Math.sin(angle);
    const x2 = 30 + r * Math.cos(next);
    const y2 = 30 + r * Math.sin(next);

    paths += `
      <path d="M30,30 L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z"
            fill="rgba(255,0,0,0.6)">
      </path>`;
  });

  return `<svg width="60" height="60">${paths}</svg>`;
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
  
    // ---- LOAD ROSES AFTER STATIONS ----
    await loadRose("PM25");   // start with PM2.5
  }



  if (window.renderPurpleAir) {
    await renderPurpleAir();
  }

  console.log("Application ready.");
};

window.addEventListener("load", bootstrap);


