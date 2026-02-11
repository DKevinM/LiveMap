window.bootstrap = async function () {

  await initMap();
  await AppData.ready;
  await window.dataReady;

  await renderStations();   
};
