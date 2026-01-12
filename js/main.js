// ================================
// main.js — Application Orchestrator
// ================================

(async function bootstrapApp() {

  console.log("Bootstrapping AQ Platform...");

  try {

    // 1️⃣ Load raw datasets
    console.log("Loading data...");
    await window.initData();

    // 2️⃣ Build spatial FeatureCollections (must happen AFTER data loads)
    console.log("Building geometry...");
    window.stationsFC = buildStationsFC();
    window.purpleFC   = buildPurpleFC(window.purpleTable);

    // 3️⃣ Create map
    console.log("Creating map...");
    const map = await window.initMap();

    // 4️⃣ Render stations
    console.log("Loading stations...");
    const stationsLayer = await window.initStations(map);

    // 5️⃣ Render PurpleAir
    console.log("Loading PurpleAir...");
    const purpleLayer = await window.initPurpleAir(map);

    // 6️⃣ Wire UI
    console.log("Initializing UI...");
    window.initUI({ map, stationsLayer, purpleLayer });

    // 7️⃣ Initialize gauges
    console.log("Initializing gauges...");
    window.initGauges();

    console.log("AQ Platform ready.");

  } catch (err) {
    console.error("Boot failure:", err);
    alert("Application failed to start — see console.");
  }

})();
