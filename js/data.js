const DATA_BASE = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data";

window.dataReady = (async () => {
  // Load all remote data in parallel
  const [stations, equipment, last6h, purple] = await Promise.all([
    fetch(`${DATA_BASE}/station_list.csv`).then(r => r.text()),
    fetch(`${DATA_BASE}/equipment.csv`).then(r => r.text()),
    fetch(`${DATA_BASE}/last6h.csv`).then(r => r.text()),
    fetch(`${DATA_BASE}/AB_PA_sensors.json`).then(r => r.json())
  ]);

  // Parse CSVs
  const parse = txt => Papa.parse(txt, { header:true, dynamicTyping:true }).data;

  window.stationTable  = parse(stations);
  window.equipmentTable= parse(equipment);
  window.last6hTable   = parse(last6h);

  // Convert to spatial layers
  window.stationsFC = buildStationsFC();
  window.purpleFC   = buildPurpleFC(purple);

})();
