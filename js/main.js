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

  console.log("Application ready.");
};

window.addEventListener("load", bootstrap);
