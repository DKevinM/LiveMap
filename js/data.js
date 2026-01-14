window.AppData = {
  stations: [],
  purpleair: []
};

// --- AQHI color helper (mirrors Python exactly)
window.getAQHIColor = function(val) {
  try {
    if (String(val).trim() === "10+") return "#640100";
    const v = Math.round(Number(val));
    if (v < 1) return "#D3D3D3";
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
  } catch {
    return "#D3D3D3";
  }
};

// --- PurpleAir eAQHI (same formula as Python)
window.computeEAQHI = function(pm) {
  if (!isFinite(pm)) return null;
  let v = Math.floor(pm / 10) + 1;
  if (v < 0) v = 0;
  if (v > 10) v = 10;
  return v;
};


async function loadPurpleAir() {
  const url = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PM25_map.json";
  const res = await fetch(url);
  const json = await res.json();
  const records = Array.isArray(json) ? json : json.data || [];

  const result = [];

  records.forEach(r => {
    const lat = Number(r.lat ?? r.Latitude);
    const lon = Number(r.lon ?? r.Longitude);
    const pm  = Number(r.pm_corr);

    if (!isFinite(lat) || !isFinite(lon) || !isFinite(pm)) return;

    const eAQHI = computeEAQHI(pm);
    if (eAQHI === null) return;

    result.push({
      lat,
      lon,
      pm,
      eAQHI,
      color: getAQHIColor(eAQHI),
      name: r.name || `Sensor ${r.sensor_index ?? ""}`.trim(),
      sensor_index: r.sensor_index
    });
  });

  return result;
}


window.AppData.ready = Promise.all([
  window.dataReady,
  loadPurpleAir()
]).then(async ([_, purple]) => {      
  AppData.stations = await fetchAllStationData();
  AppData.purpleair = purple;
});

window.fetchAllStationData = async function () {

  const url = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv";
  const res = await fetch(url);
  const text = await res.text();

  const rows = text.trim().split("\n");
  const headers = rows.shift().split(",");

  const byStation = {};

  rows.forEach(line => {
    const cols = line.split(",");
    const e = Object.fromEntries(headers.map((h,i)=>[h, cols[i]]));

    if (!e.Latitude || !e.Longitude || !e.StationName) return;

    const val = Number(e.Value);
    if (!isFinite(val)) return;

    const station = e.StationName;

    byStation[station] ??= {
      stationName: station,
      lat: Number(e.Latitude),
      lon: Number(e.Longitude),
      params: {}
    };

    byStation[station].params[e.ParameterName || "AQHI"] = e;
  });

  const stations = [];

  Object.values(byStation).forEach(st => {
    const aqhi = st.params["AQHI"]?.Value ?? "NA";

    const lines = Object.values(st.params)
      .filter(p => p.ParameterName !== "AQHI")
      .map(p => `${p.ParameterName}: ${p.Value}`);

    stations.push({
      stationName: st.stationName,
      lat: st.lat,
      lon: st.lon,
      aqhi,
      html: `
        <strong>${st.stationName}</strong><br>
        AQHI: ${aqhi}<br>
        ${lines.join("<br>")}
      `
    });
  });

  return stations;
};
