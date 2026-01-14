// main.js
(async function bootstrap() {
  try {
    console.log("Starting…");

    window.initMap();

    // wait for last6h.csv parsing + dataByStation build
    await window.dataReady;

    await window.renderStations();
    await window.renderPurpleAir();

    window.initUI();

    console.log("Ready.");
  } catch (e) {
    console.error("Boot failure:", e);
    alert("Boot failure — see console.");
  }
})();
