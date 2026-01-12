window.initData = async function () {
  console.log("Loading published JSON datasets...");

  const DATA_BASE = "https://dkevinm.github.io/LiveMap/data";

  const [last6h, purple] = await Promise.all([
    fetch(`${DATA_BASE}/last6h.json`).then(r => r.json()),
    fetch(`${DATA_BASE}/AB_PA_sensors.json`).then(r => r.json())
  ]);

  window.last6hTable = last6h;
  window.purpleTable = purple;

  console.log("Data ready.");
};
