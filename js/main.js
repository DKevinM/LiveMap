// js/main.js

async function bootstrap() {
  console.log("Booting app…");

  // 1. Wait for station + PurpleAir data
  if (window.dataReady) {
    await window.dataReady;
    console.log("Data ready");
  } else {
    console.error("dataReady missing");
    return;
  }

  // 2. Init map
  if (typeof window.initMap === "function") {
    window.initMap();
    console.log("Map initialized");
  } else {
    console.error("initMap missing");
    return;
  }

  // 3. Render stations
  if (typeof window.renderStations === "function") {
    await window.renderStations();
    console.log("Stations rendered");
  } else {
    console.error("renderStations missing");
  }

  // 4. Render PurpleAir
  if (typeof window.renderPurpleAir === "function") {
    await window.renderPurpleAir();
    console.log("PurpleAir rendered");
  } else {
    console.error("renderPurpleAir missing");
  }

  console.log("App ready");
}

window.addEventListener("load", bootstrap);
