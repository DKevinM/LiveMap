
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


// ================= ROSE LAYERS =================
let roseLayers = {};

async function loadRose(type) {

  const res = await fetch(`data/rose_${type}.geojson`);
  const geo = await res.json();

  const layer = L.geoJSON(geo, {
    pointToLayer: function(feature, latlng) {
      return L.marker(latlng, {
        icon: L.divIcon({
          className: '',
          html: buildRoseSVG(feature.properties),
          iconSize: [60,60]
        })
      });
    }
  });

  roseLayers[type] = layer;

  layerControl.addOverlay(layer, `Rose ${type}`);
}

function buildRoseSVG(p) {
  // simple placeholder — we improve next
  return `<div style="
    width:60px;height:60px;
    border-radius:50%;
    background:rgba(255,255,255,0.6);
    border:2px solid #333;">
  </div>`;
}
