// ---------------- GLOBALS ----------------
window.dataByStation = Object.create(null);


window.buildStationPopup = function (rows) {

  const content = `
  <div style="width:280px;">
    ${rows.map(r => `
      <div style="
        display:flex;
        justify-content:space-between;
        gap: 20px;
        align-items:center;
        padding:2px 4px;
      ">
        <span><b>${r.Shortform}</b></span>
        <span style="text-align:right;">
          ${r.Value === null
            ? "NA"
            : r.stale
              ? `${r.Value}${r.Units}*`
              : `${r.Value}${r.Units}`
          }          
        </span>
      </div>
    `).join("")}
  </div>
  `;

  const stationName = (rows && rows.length > 0 && rows[0].StationName)
    ? rows[0].StationName
    : "Unknown";

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



window.AQHI_GROUPS = {
  Alberta: ["AQHI_Alberta.geojson"],
  Alberta_BLEND: ["AQHI_Alberta_blend.geojson"],

  ACA_Boundary_2022: ["AQHI_ACA_Boundary_2022.geojson"],
  ACA_Boundary_2022_BLEND: ["AQHI_ACA_Boundary_2022_blend.geojson"],

  Edmonton: ["AQHI_Edm.geojson"],
  Edmonton_BLEND: ["AQHI_Edm_blend.geojson"],

  Parkland_County: ["AQHI_Parkland_County.geojson"],
  Parkland_County_BLEND: ["AQHI_Parkland_County_blend.geojson"],

  Strathcona: ["AQHI_Strathcona.geojson"],
  Strathcona_BLEND: ["AQHI_Strathcona_blend.geojson"],

  WCAS_2024: ["AQHI_WCAS_2024.geojson"],
  WCAS_2024_BLEND: ["AQHI_WCAS_2024_blend.geojson"],

  Yellowhead: ["AQHI_Yellowhead.geojson"],
  Yellowhead_BLEND: ["AQHI_Yellowhead_blend.geojson"]
};


window.ACTIVE_REGIONS = ["Alberta", "ACA", "WCAS"];

window.ACTIVE_TYPES = ["CURRENT", "BLEND"];



// ---------------- LOAD STATIONS (WORKING VERSION) ----------------
window.dataReady = fetch('https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv')
  .then(res => res.text())
  .then(text => {
    const rows = text.trim().split('\n');
    const headers = rows.shift().split(',');

    const raw = {};
    rows.forEach(line => {
      const cols = line.split(",");
      if (cols.length < headers.length) return;
      const e = Object.fromEntries(headers.map((h,i)=>[h,cols[i]]));
    
      if (!e.StationName || !e.Latitude || !e.Longitude) return;
    
      // ---- FIX 1: blank ParameterName is AQHI ----
      e.ParameterName = (e.ParameterName && e.ParameterName.trim())
        ? e.ParameterName.trim()
        : "AQHI";
    
      // ---- FIX 2: numeric value ----     
      let v = parseFloat(e.Value);      
      if (!isFinite(v)) {
        v = null;
      }
      
      // ---- FIX: ppm → ppb conversion ----
      const ppmToPpbParams = [
        "Ozone",
        "Nitrogen Dioxide",
        "Nitric Oxide",
        "Total Oxides of Nitrogen",
        "Sulphur Dioxide",
        "Hydrogen Sulphide",
        "Total Reduced Sulphur"
      ];
      
      if (v !== null && ppmToPpbParams.includes(e.ParameterName)) {
        v = v * 1000;
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



    const now = new Date();
    
    Object.entries(raw).forEach(([station, arr]) => {
      const byParam = {};
    
      // STEP 1: get latest per parameter
      // STEP 1: get latest VALID per parameter
      arr.forEach(e => {
        const p = e.ParameterName || "AQHI";
        const t = new Date(e.ReadingDate);
        if (isNaN(t.getTime())) return;
      
        const isAQHI = p === "AQHI";
      
        // AQHI: treat null, non-numeric, or <1 as invalid for circle display
        const hasValidValue = isAQHI
          ? (e.Value !== null && isFinite(e.Value) && Number(e.Value) >= 1)
          : (e.Value !== null && isFinite(e.Value));
      
        // If we don't have anything yet, keep this row
        if (!byParam[p]) {
          byParam[p] = e;
          return;
        }
      
        const oldT = new Date(byParam[p].ReadingDate);
        const oldIsAQHI = p === "AQHI";
        const oldHasValidValue = oldIsAQHI
          ? (byParam[p].Value !== null && isFinite(byParam[p].Value) && Number(byParam[p].Value) >= 1)
          : (byParam[p].Value !== null && isFinite(byParam[p].Value));
      
        // Prefer newer VALID rows over older ones
        if (hasValidValue && (!oldHasValidValue || t > oldT)) {
          byParam[p] = e;
          return;
        }
      
        // If both are invalid, keep the newer one
        if (!hasValidValue && !oldHasValidValue && t > oldT) {
          byParam[p] = e;
        }
      
        // If old is valid and new is invalid, keep old
        // If both valid, newer valid already handled above
      });

      
      // STEP 2: apply age filter AFTER
      Object.keys(byParam).forEach(p => {
        const t = new Date(byParam[p].ReadingDate);
        const ageHours = (now - t) / (1000 * 60 * 60);
      
        if (ageHours > 6) {
          delete byParam[p];   // 🔥 remove truly old data
        } else {
          byParam[p].stale = ageHours > 4;
        }
      });
        const cleaned = Object.values(byParam);
        if (cleaned.length > 0) {
          dataByStation[station] = cleaned;
        }      
      });      

    // ==============================
    // GLOBAL ACCESS HELPERS
    // ==============================
    
    window.getStationValue = function(station, param) {
      const rows = window.dataByStation?.[station];
      if (!rows) return null;
    
      const row = rows.find(r => r.ParameterName === param);
      return row?.Value ?? null;
    };
    
    window.getStationTime = function(station, param) {
      const rows = window.dataByStation?.[station];
      if (!rows) return null;
    
      const row = rows.find(r => r.ParameterName === param);
      return row?.DisplayDate ?? null;
    };
    
  });







// ---------------- STATIONS FOR MAP ----------------
window.fetchAllStationData = async function () {
  await window.dataReady;

  const stationNames = Object.keys(dataByStation);

  return stationNames
    .map(name => {
      const rows = dataByStation[name];
      if (!rows || rows.length === 0) return null;
  
      const locRow = rows.find(r => r.Latitude && r.Longitude) || {};
      const aqhiRow = rows.find(r =>
        r.ParameterName === "AQHI" &&
        r.Value !== null &&
        isFinite(r.Value) &&
        Number(r.Value) >= 1
      );
  
      return {
        stationName: name,
        lat: isFinite(Number(firstRow?.Latitude)) ? Number(firstRow.Latitude) : null,
        lon: isFinite(Number(firstRow?.Longitude)) ? Number(firstRow.Longitude) : null,
        aqhi: (aqhiRow && aqhiRow.Value !== null && isFinite(aqhiRow.Value))
          ? aqhiRow.Value
          : null,
        aqhi_stale: aqhiRow ? aqhiRow.stale : false,
        rows: rows,
        html: window.buildStationPopup(Object.values(rows))
      };
    })
    .filter(s => s && s.lat !== null && s.lon !== null);
};


// ---------------- PURPLEAIR ----------------
async function loadPurpleAir() {
  const url = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PM25_map.json";
  const res = await fetch(url);
  const json = await res.json();
  const records = Array.isArray(json) ? json : (json.data || []);
  const pm = isFinite(r.pm_corr) ? Number(r.pm_corr) : null;


  return {
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    pm: pm,
    eAQHI: pm !== null ? Math.floor(pm/10)+1 : null,
    name: r.name || `Sensor ${r.sensor_index ?? ""}`
  };
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
      features: (window.AppData.stations || [])
        .filter(s => s && s.lat != null && s.lon != null)
        .map(s => ({
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
