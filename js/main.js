window.bootstrap = async function () {


  await initMap();

  await window.dataReady;
  
  await window.renderMap();   // ← the real renderer

};

window.addEventListener("load", bootstrap);
