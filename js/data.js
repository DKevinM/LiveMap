const DATA_BASE = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data";

window.initData = async function () {

  console.log("Loading AB_datapull datasets...");

  const [stations, equipment, last6h, purple] = await Promise.all([
    fetch(`${DATA_BASE}/station_list.csv`).then(r => r.text()),
    fetch(`${DATA_BASE}/equipment.csv`).then(r => r.text()),
    fetch(`${DATA_BASE}/last6h.csv`).then(r => r.text()),
    fetch(`${DATA_BASE}/AB_PA_sensors.json`).then(r => r.json())
  ]);

  // CSV parser
  const parse = txt => Papa.parse(txt, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true
  }).data;

  window.stationTable   = parse(stations);
  window.equipmentTable = parse(equipment);
  window.last6hTable    = parse(last6h);

  console.log("Tables loaded:", {
    stations: window.stationTable.length,
    equipment: window.equipmentTable.length,
    last6h: window.last6hTable.length,
    purple: purple.length
  });

  // Build spatial FeatureCollections
  window.stationsFC = buildStationsFC();
  window.purpleFC   = buildPurpleFC(purple);

  console.log("Data ready.");
};
