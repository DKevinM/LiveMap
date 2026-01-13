(async function bootstrapApp() {

  console.log("Bootstrapping AQ Platform...");

  try {
    console.log("Loading data...");
    await window.initData();

    console.log("Building geometry...");
    window.stationsFC = buildStationsFC();
    window.purpleFC   = buildPurpleFC(window.purpleTable);

    console.log("Creating map...");
    const map = await window.initMap();

    // Wait for map + layers to exist
    if (!window.map || !window.layerACA || !window.layerPA) {
      throw new Error("Map or base layers not ready");
    }

    console.log("Loading stations...");
    await new Promise(r => setTimeout(r, 0));  // allow DOM & map to settle
    await window.initStations();

    console.log("Loading PurpleAir...");
    await new Promise(r => setTimeout(r, 0));
    await window.initPurpleAir();

    console.log("Initializing UI...");
    window.initUI({ map });

    console.log("Initializing gauges...");
    window.initGauges();

    console.log("AQ Platform ready.");

  } catch (err) {
    console.error("Boot failure:", err);
    alert("Application failed to start — see console.");
  }

})();
