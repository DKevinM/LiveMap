(async function bootstrap() {

  console.log("Booting app...");

  // 1️⃣ Wait for all data to load
  await window.dataReady;
  console.log("Data ready");

  // 2️⃣ Initialize map
  if (typeof window.initMap === "function") {
    window.initMap();
    console.log("Map initialized");
  }

  // 3️⃣ Render stations
  if (typeof window.renderStations === "function") {
    await window.renderStations();
    console.log("Stations rendered");
  }

  // 4️⃣ Render PurpleAir
  if (typeof window.renderPurpleAir === "function") {
    await window.renderPurpleAir();
    console.log("PurpleAir rendered");
  }

  // 5️⃣ Initialize UI + gauges
  if (typeof window.initUI === "function") window.initUI();
  if (typeof window.initGauges === "function") window.initGauges();

  console.log("App fully loaded");

})();
