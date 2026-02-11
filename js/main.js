window.bootstrap = async function () {

  console.log("Bootstrapping clean app...");

  await initMap();
  await AppData.ready;
  await window.dataReady;

  await window.buildDataStructures();
  
  await window.renderMap();   // ← the real renderer

  console.log("Application ready.");
};

window.addEventListener("load", bootstrap);
