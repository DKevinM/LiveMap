// ================================
// main.js — Application Orchestrator
// ================================

(async function bootstrapApp() {
  console.log("Bootstrapping AQ Platform...");

  try {
    // 1️⃣ Load core datasets (CSV / JSON / APIs)
    console.log("Loading data...");
    await window.initData();                     // data.js

    // 2️⃣ Create map and base layers
    console.log("Creating map...");
    const map = await window.initMap();          // map.js

    // 3️⃣ Build station layers
    console.log("Loading stations...");
    const stationsLayer = await window.initStations(map); // stations.js

    // 4️⃣ Build PurpleAir layers
    console.log("Loading PurpleAir...");
    const purpleLayer = await window.initPurpleAir(map);  // purpleair.js

    // 5️⃣ Initialize UI wiring & toggles
    console.log("Initializing UI...");
    window.initUI({
      map,
      stationsLayer,
      purpleLayer
    });                                          // ui.js

    // 6️⃣ Initialize gauges
    console.log("Initializing gauges...");
    window.initGauges();                         // gauges.js

    console.log("AQ Platform ready.");

  } catch (err) {
    console.error("Boot failure:", err);
    alert("Application failed to start — see console.");
  }
})();
