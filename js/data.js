// ---------------- GLOBALS ----------------
let dataByStation = {};
window.dataByStation = dataByStation;

window.AppData = {
  stations: [],
  purpleair: [],
  ready: null
};

// ---------------- AQHI COLOUR ----------------
window.getAQHIColor = function (val) {
  if (String(val).trim() === "10+") return "#640100";
  const v = Math.round(Number(val));
  if (v < 1)  return "#D3D3D3";
  if (v === 1) return "#01cbff";
  if (v === 2) return "#0099cb";
  if (v === 3) return "#016797";
  if (v === 4) return "#fffe03";
  if (v === 5) return "#ffcb00";
  if (v === 6) return "#ff9835";
  if (v === 7) return "#fd6866";
  if (v === 8) return "#fe0002";
  if (v === 9) return "#cc0001";
  if (v === 10) return "#9a0100";
  return "#640100";
};

// ---------------- LOAD STATIONS ----------------
async function loadStations() {
  const url = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv";
  const res = await fetch(url);
  const text = await res.text();

  const rows = text.trim().split("\n");
  const headers = rows.shift().split(",");

  const raw = {};

  rows.forEach(line => {
    const cols = line.split(",");
    const e = Object.fromEntries(headers.map((h,i)=>[h,cols[i]]));

    if (!e.StationName || !e.Latitude || !e.Longitude) return;

    raw[e.StationName] = raw[e.StationName] || [];
    raw[e.StationName].push(e);
  });

  // build dataByStation (latest per param)
  Object.entries(raw).forEach(([station, arr]) => {
    const byParam = {};
    arr.forEach(e => {
      const p = e.ParameterName || "AQHI";
      if (!byParam[p] || new Date(e.ReadingDate) > new Date(byParam[p].ReadingDate)) {
        byParam[p] = e;
      }
    });
    dataByStation[station] = Object.values(byParam);
  });

  // build AppData.stations for map
  const stations = Object.keys(dataByStation).map(name => {
    const rows = dataByStation[name];
    const aqhiRow = rows.find(r => r.ParameterName === "AQHI");
    const lat = rows[0].Latitude;
    const lon = rows[0].Longitude;

    return {
      stationName: name,
      lat: Number(lat),
      lon: Number(lon),
      aqhi: aqhiRow ? aqhiRow.Value : "NA"
    };
  });

  return stations;
}

// ---------------- PURPLEAIR ----------------
async function loadPurpleAir() {
  const url = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PM25_map.json";
  const res = await fetch(url);
  const json = await res.json();
  const records = Array.isArray(json) ? json : (json.data || []);

  return records.map(r => ({
    lat: Number(r.lat ?? r.Latitude),
    lon: Number(r.lon ?? r.Longitude),
    pm: Number(r.pm_corr),
    eAQHI: Math.floor(Number(r.pm_corr)/10)+1,
    name: r.name || `Sensor ${r.sensor_index ?? ""}`
  }));
}

// ---------------- READY ----------------
window.AppData.ready = Promise.all([
  loadStations(),
  loadPurpleAir()
]).then(([stations, purple]) => {
  AppData.stations = stations;
  AppData.purpleair = purple;
});
