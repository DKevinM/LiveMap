// ================================
// main.js — Application Orchestrator
// ================================

(async function bootstrapApp() {

  console.log("Bootstrapping AQ Platform...");

  try {

    // 1️⃣ Load data & build geometry
    console.log("Loading data...");
    await window.initData();

    // 2️⃣ Create map
    console.log("Creating map...");
    const map = await window.initMap();

    // 3️⃣ Render stations
    console.log("Loading stations...");
    const stationsLayer = await window.initStations(map);

    // 4️⃣ Render PurpleAir
    console.log("Loading PurpleAir...");
    const purpleLayer = await window.initPurpleAir(map);

    // 5️⃣ Wire UI
    console.log("Initializing UI...");
    window.initUI({ map, stationsLayer, purpleLayer });

    // 6️⃣ Initialize gauges
    console.log("Initializing gauges...");
    window.initGauges();

    console.log("AQ Platform ready.");

  } catch (err) {
    console.error("Boot failure:", err);
    alert("Application failed to start — see console.");
  }

})();
