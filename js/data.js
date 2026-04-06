// ---------------- GLOBALS ----------------
window.dataByStation = {};


window.buildStationPopup = function (rows) {

  const content = rows.map(r => {
    return `<b>${r.Shortform}</b>: ${r.Value}${r.Units}`;
  }).join("<br>");

  const stationName = rows[0]?.StationName || "Unknown";

  return content + `
    <br><br>
    <a href="#" onclick="if(window.buildFullGaugePanel){ window.buildFullGaugePanel({ StationName: '${stationName.replace(/'/g, "\\'")}' }); } return false;">
      View Gauges
    </a>
    &nbsp;|&nbsp;
    <a href="https://dkevinm.github.io/AB_datapull/" target="_blank">
      Historical Data
    </a>
  `;
};



window.AppData = {
  stations: [],
  purpleair: [],
  ready: null
};

// ---------------- AQHI COLOUR ----------------
window.getAQHIColor = function (val) {
  if (val === null || val === undefined) return "#D3D3D3";

  const s = String(val).trim();

  if (s === "" || s === "NA" || s === "NaN" || s === "null" || s === "undefined") {
    return "#D3D3D3";
  }

  if (s === "10+") return "#640100";

  const v = Math.round(Number(s));

  if (!isFinite(v)) return "#D3D3D3";
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

window.getColor = window.getAQHIColor;

const unitsLookup = {
  "AQHI": "",
  "Ozone": " ppb",
  "Total Oxides of Nitrogen": " ppb",
  "Hydrogen Sulphide": " ppb",
  "Total Reduced Sulphur": " ppb",
  "Sulphur Dioxide": " ppb",
  "Fine Particulate Matter": " µg/m³",
  "Total Hydrocarbons": " ppm",
  "Carbon Monoxide": " ppm",
  "Wind Direction": " degrees",
  "Relative Humidity": " %",
  "Outdoor Temperature": " °C",
  "Nitric Oxide": " ppb",
  "Wind Speed": " km/hr",
  "Non-methane Hydrocarbons": " ppm",
  "Nitrogen Dioxide": " ppb",
  "Methane": " ppm"
};

const shortLookup = {
  "AQHI": "AQHI",
  "Ozone": "O3",
  "Total Oxides of Nitrogen": "NOX",
  "Hydrogen Sulphide": "H2S",
  "Total Reduced Sulphur": "TRS",
  "Sulphur Dioxide": "SO2",
  "Fine Particulate Matter": "PM2.5",
  "Total Hydrocarbons": "THC",
  "Carbon Monoxide": "CO",
  "Wind Direction": "Wind Dir",
  "Relative Humidity": "Humidity",
  "Outdoor Temperature": "Temp",
  "Nitric Oxide": "NO",
  "Wind Speed": "Wind Speed",
  "Non-methane Hydrocarbons": "NMHC",
  "Nitrogen Dioxide": "NO2",
  "Methane": "CH4"
};





// ---------------- LOAD STATIONS (WORKING VERSION) ----------------
window.dataReady = fetch('https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv')
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split('\n');
    const headers = rows.shift().split(',');

    const raw = {};
    rows.forEach(line => {
      const cols = line.split(",");
      const e = Object.fromEntries(headers.map((h,i)=>[h,cols[i]]));
    
      if (!e.StationName || !e.Latitude || !e.Longitude) return;
    
      // ---- FIX 1: blank ParameterName is AQHI ----
      e.ParameterName = (e.ParameterName && e.ParameterName.trim())
        ? e.ParameterName.trim()
        : "AQHI";
    
      // ---- FIX 2: numeric value ----
      let v = parseFloat(e.Value);
      
      if (!isFinite(v)) {
        e.Value = null;
      } else {
        e.Value = v;
      }
    
      // ---- FIX 3: ppm → ppb conversion (what your working script does) ----
      if ([
        "Ozone","Total Oxides of Nitrogen","Hydrogen Sulphide",
        "Total Reduced Sulphur","Sulphur Dioxide",
        "Nitric Oxide","Nitrogen Dioxide"
      ].includes(e.ParameterName)) {
        v *= 1000;
      }
      e.Value = v;
    
      // ---- FIX 4: Units + Shortform (missing in LiveMap) ----
      e.Units = unitsLookup[e.ParameterName] || "";
      e.Shortform = shortLookup[e.ParameterName] || e.ParameterName;
    
      // ---- FIX 5: Edmonton timestamp ----
      const dt = new Date(e.ReadingDate);
      e.DisplayDate = dt.toLocaleString("en-CA", {
        timeZone: "America/Edmonton",
        hour12: true
      });
    
      raw[e.StationName] = raw[e.StationName] || [];
      raw[e.StationName].push(e);
    });



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
  });

// ---------------- STATIONS FOR MAP ----------------
window.fetchAllStationData = async function () {
  await window.dataReady;

  const stationNames = Object.keys(dataByStation);

  return stationNames.map(name => {
    const rows = dataByStation[name];
    const aqhiRow = rows.find(r => r.ParameterName === "AQHI");

    return {
      stationName: name,
      lat: Number(rows[0].Latitude),
      lon: Number(rows[0].Longitude),
      aqhi: (aqhiRow && aqhiRow.Value !== null && isFinite(aqhiRow.Value))
        ? aqhiRow.Value
        : null,
      rows: rows,  
      html: window.buildStationPopup(rows)  
    };
  });
};


// ---------------- PURPLEAIR ----------------
async function loadPurpleAir() {
  const url = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PM25_map.json";
  const res = await fetch(url);
  const json = await res.json();
  const records = Array.isArray(json) ? json : (json.data || []);

  return records.map(r => ({
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    pm: isFinite(r.pm_corr) ? Number(r.pm_corr) : null,
    eAQHI: Math.floor(Number(r.pm_corr)/10)+1,
    name: r.name || `Sensor ${r.sensor_index ?? ""}`
  }));
}

// ---------------- READY ----------------
window.AppData.ready = (async () => {

  await window.dataReady;
  
  const [stations, purple] = await Promise.all([
    window.fetchAllStationData(),
    loadPurpleAir()
  ]);

  AppData.stations = stations;
  AppData.purpleair = purple;

})();



// ======================================================
// ORIGIN / TRAJECTORY SUPPORT (ADD THIS BLOCK)
// ======================================================

// Global FeatureCollections (used by origin.html)
window.STATIONS_FC = { type: "FeatureCollection", features: [] };
window.PURPLE_FC   = { type: "FeatureCollection", features: [] };
window.NPRI_FC     = { type: "FeatureCollection", features: [] };

// ---------------- STATIONS FC ----------------
window.stationsFCReady = (async () => {
  try {
    await window.AppData.ready;

    window.STATIONS_FC = {
      type: "FeatureCollection",
      features: (window.AppData.stations || []).map(s => ({
        type: "Feature",
        properties: s,
        geometry: {
          type: "Point",
          coordinates: [s.lon, s.lat]
        }
      }))
    };

    console.log("[LiveMap] STATIONS_FC:", window.STATIONS_FC.features.length);

  } catch (e) {
    console.error("stationsFCReady failed", e);
  }
})();

// ---------------- PURPLE FC ----------------
window.purpleFCReady = (async () => {
  try {
    await window.AppData.ready;

    window.PURPLE_FC = {
      type: "FeatureCollection",
      features: (window.AppData.purpleair || []).map(p => ({
        type: "Feature",
        properties: p,
        geometry: {
          type: "Point",
          coordinates: [p.lon, p.lat]
        }
      }))
    };

    console.log("[LiveMap] PURPLE_FC:", window.PURPLE_FC.features.length);

  } catch (e) {
    console.error("purpleFCReady failed", e);
  }
})();

// ---------------- NPRI FC ----------------
//  
window.npriFCReady = fetch("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/output/NPRI.geojson")
  .then(r => r.json())
  .then(j => {
    window.NPRI_FC = j;
    console.log("[LiveMap] NPRI_FC:", j.features.length);
  })
  .catch(e => {
    console.error("NPRI load failed", e);
    window.NPRI_FC = { type: "FeatureCollection", features: [] };
  });// ---------------- GLOBALS ----------------
window.dataByStation = {};


window.buildStationPopup = function (rows) {

  const content = rows.map(r => {
    return `<b>${r.Shortform}</b>: ${r.Value}${r.Units}`;
  }).join("<br>");

  const stationName = rows[0]?.StationName || "Unknown";

  return content + `
    <br><br>
    <a href="#" onclick="if(window.buildFullGaugePanel){ window.buildFullGaugePanel({ StationName: '${stationName.replace(/'/g, "\\'")}' }); } return false;">
      View Gauges
    </a>
    &nbsp;|&nbsp;
    <a href="https://dkevinm.github.io/AB_datapull/" target="_blank">
      Historical Data
    </a>
  `;
};



window.AppData = {
  stations: [],
  purpleair: [],
  ready: null
};

// ---------------- AQHI COLOUR ----------------
window.getAQHIColor = function (val) {
  if (val === null || val === undefined) return "#D3D3D3";

  const s = String(val).trim();

  if (s === "" || s === "NA" || s === "NaN" || s === "null" || s === "undefined") {
    return "#D3D3D3";
  }

  if (s === "10+") return "#640100";

  const v = Math.round(Number(s));

  if (!isFinite(v)) return "#D3D3D3";
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

window.getColor = window.getAQHIColor;

const unitsLookup = {
  "AQHI": "",
  "Ozone": " ppb",
  "Total Oxides of Nitrogen": " ppb",
  "Hydrogen Sulphide": " ppb",
  "Total Reduced Sulphur": " ppb",
  "Sulphur Dioxide": " ppb",
  "Fine Particulate Matter": " µg/m³",
  "Total Hydrocarbons": " ppm",
  "Carbon Monoxide": " ppm",
  "Wind Direction": " degrees",
  "Relative Humidity": " %",
  "Outdoor Temperature": " °C",
  "Nitric Oxide": " ppb",
  "Wind Speed": " km/hr",
  "Non-methane Hydrocarbons": " ppm",
  "Nitrogen Dioxide": " ppb",
  "Methane": " ppm"
};

const shortLookup = {
  "AQHI": "AQHI",
  "Ozone": "O3",
  "Total Oxides of Nitrogen": "NOX",
  "Hydrogen Sulphide": "H2S",
  "Total Reduced Sulphur": "TRS",
  "Sulphur Dioxide": "SO2",
  "Fine Particulate Matter": "PM2.5",
  "Total Hydrocarbons": "THC",
  "Carbon Monoxide": "CO",
  "Wind Direction": "Wind Dir",
  "Relative Humidity": "Humidity",
  "Outdoor Temperature": "Temp",
  "Nitric Oxide": "NO",
  "Wind Speed": "Wind Speed",
  "Non-methane Hydrocarbons": "NMHC",
  "Nitrogen Dioxide": "NO2",
  "Methane": "CH4"
};





// ---------------- LOAD STATIONS (WORKING VERSION) ----------------
window.dataReady = fetch('https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv')
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split('\n');
    const headers = rows.shift().split(',');

    const raw = {};
    rows.forEach(line => {
      const cols = line.split(",");
      const e = Object.fromEntries(headers.map((h,i)=>[h,cols[i]]));
    
      if (!e.StationName || !e.Latitude || !e.Longitude) return;
    
      // ---- FIX 1: blank ParameterName is AQHI ----
      e.ParameterName = (e.ParameterName && e.ParameterName.trim())
        ? e.ParameterName.trim()
        : "AQHI";
    
      // ---- FIX 2: numeric value ----
      let v = parseFloat(e.Value);
      
      if (!isFinite(v)) {
        e.Value = null;
      } else {
        e.Value = v;
      }
    
      // ---- FIX 3: ppm → ppb conversion (what your working script does) ----
      if ([
        "Ozone","Total Oxides of Nitrogen","Hydrogen Sulphide",
        "Total Reduced Sulphur","Sulphur Dioxide",
        "Nitric Oxide","Nitrogen Dioxide"
      ].includes(e.ParameterName)) {
        v *= 1000;
      }
      e.Value = v;
    
      // ---- FIX 4: Units + Shortform (missing in LiveMap) ----
      e.Units = unitsLookup[e.ParameterName] || "";
      e.Shortform = shortLookup[e.ParameterName] || e.ParameterName;
    
      // ---- FIX 5: Edmonton timestamp ----
      const dt = new Date(e.ReadingDate);
      e.DisplayDate = dt.toLocaleString("en-CA", {
        timeZone: "America/Edmonton",
        hour12: true
      });
    
      raw[e.StationName] = raw[e.StationName] || [];
      raw[e.StationName].push(e);
    });



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
  });

// ---------------- STATIONS FOR MAP ----------------
window.fetchAllStationData = async function () {
  await window.dataReady;

  const stationNames = Object.keys(dataByStation);

  return stationNames.map(name => {
    const rows = dataByStation[name];
    const aqhiRow = rows.find(r => r.ParameterName === "AQHI");

    return {
      stationName: name,
      lat: Number(rows[0].Latitude),
      lon: Number(rows[0].Longitude),
      aqhi: (aqhiRow && aqhiRow.Value !== null && isFinite(aqhiRow.Value))
        ? aqhiRow.Value
        : null,
      rows: rows,  
      html: window.buildStationPopup(rows)  
    };
  });
};


// ---------------- PURPLEAIR ----------------
async function loadPurpleAir() {
  const url = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PM25_map.json";
  const res = await fetch(url);
  const json = await res.json();
  const records = Array.isArray(json) ? json : (json.data || []);

  return records.map(r => ({
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    pm: isFinite(r.pm_corr) ? Number(r.pm_corr) : null,
    eAQHI: Math.floor(Number(r.pm_corr)/10)+1,
    name: r.name || `Sensor ${r.sensor_index ?? ""}`
  }));
}

// ---------------- READY ----------------
window.AppData.ready = (async () => {

  await window.dataReady;
  
  const [stations, purple] = await Promise.all([
    window.fetchAllStationData(),
    loadPurpleAir()
  ]);

  AppData.stations = stations;
  AppData.purpleair = purple;

})();



// ======================================================
// ORIGIN / TRAJECTORY SUPPORT (ADD THIS BLOCK)
// ======================================================

// Global FeatureCollections (used by origin.html)
window.STATIONS_FC = { type: "FeatureCollection", features: [] };
window.PURPLE_FC   = { type: "FeatureCollection", features: [] };
window.NPRI_FC     = { type: "FeatureCollection", features: [] };

// ---------------- STATIONS FC ----------------
window.stationsFCReady = (async () => {
  try {
    await window.AppData.ready;

    window.STATIONS_FC = {
      type: "FeatureCollection",
      features: (window.AppData.stations || []).map(s => ({
        type: "Feature",
        properties: s,
        geometry: {
          type: "Point",
          coordinates: [s.lon, s.lat]
        }
      }))
    };

    console.log("[LiveMap] STATIONS_FC:", window.STATIONS_FC.features.length);

  } catch (e) {
    console.error("stationsFCReady failed", e);
  }
})();

// ---------------- PURPLE FC ----------------
window.purpleFCReady = (async () => {
  try {
    await window.AppData.ready;

    window.PURPLE_FC = {
      type: "FeatureCollection",
      features: (window.AppData.purpleair || []).map(p => ({
        type: "Feature",
        properties: p,
        geometry: {
          type: "Point",
          coordinates: [p.lon, p.lat]
        }
      }))
    };

    console.log("[LiveMap] PURPLE_FC:", window.PURPLE_FC.features.length);

  } catch (e) {
    console.error("purpleFCReady failed", e);
  }
})();

// ---------------- NPRI FC ----------------
//  
window.npriFCReady = fetch("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/output/NPRI.geojson")
  .then(r => r.json())
  .then(j => {
    window.NPRI_FC = j;
    console.log("[LiveMap] NPRI_FC:", j.features.length);
  })
  .catch(e => {
    console.error("NPRI load failed", e);
    window.NPRI_FC = { type: "FeatureCollection", features: [] };
  });
