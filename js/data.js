// ---------------- GLOBALS ----------------
window.dataByStation = Object.create(null);

// Alberta stays on UTC-6 (MDT) all year from 2026-11-01. Browsers that haven't picked up that tz change
// (headless Chrome 151 still did not on 2026-11-24) put "America/Edmonton" at UTC-7 and show every live
// time an hour early, so live times are formatted at a fixed UTC-6 instead (wind_anim.js does the same).
// Only use this for times on/after 2026-11-01; older history keeps America/Edmonton.
window.AB_TZ = "Etc/GMT+6";

// Open-Meteo is asked for UTC (&timezone=GMT) and its local-looking "2026-11-24T02:00" strings get a "Z",
// so new Date() reads them right on every browser.
window.omUTC = function (data) {
  if (data?.hourly?.time) data.hourly.time = data.hourly.time.map(t => /Z$/.test(t) ? t : t + "Z");
  if (data?.current_weather?.time && !/Z$/.test(data.current_weather.time)) data.current_weather.time += "Z";
  return data;
};

// raw.githubusercontent.com is served through GitHub's CDN, which can hold
// a stale cached copy well past when the underlying file has updated - a
// plain browser refresh doesn't force past it. Appending a timestamp makes
// every load a distinct URL, forcing a fresh fetch from origin. Use this for
// every raw.githubusercontent.com pull instead of calling fetch() directly.
window.fetchFresh = function (url, options = {}) {
  const sep = url.includes('?') ? '&' : '?';
  return fetch(`${url}${sep}t=${Date.now()}`, { cache: 'no-store', ...options });
};

// This data's timestamps use the "Hour Ending" convention: a 4:00 p.m.
// reading covers the 3:00-4:00 p.m. period, not 4:00-5:00 p.m. That's a
// standard convention in this data's own industry but reads backwards to
// most people, who see a single timestamp and assume it means "as of this
// time" going forward. Rather than relying on a "Hour Ending" label to
// carry that meaning, show the real range - unambiguous either way. Used
// by the station popup (render.js) and gauges.html (gauges.js), the two
// places this timestamp reaches the public.
window.formatHourRange = function (endDate, opts = {}) {
  const tz = opts.timeZone || window.AB_TZ;
  if (!(endDate instanceof Date) || isNaN(endDate)) return "";

  const startDate = new Date(endDate.getTime() - 60 * 60 * 1000);

  const timeFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true
  });
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  });

  const partVal = (parts, type) => parts.find(p => p.type === type)?.value || "";
  const startParts = timeFmt.formatToParts(startDate);
  const endParts = timeFmt.formatToParts(endDate);

  const startPeriod = partVal(startParts, "dayPeriod");
  const endPeriod = partVal(endParts, "dayPeriod");
  const startTime = `${partVal(startParts, "hour")}:${partVal(startParts, "minute")}`;
  const endTime = `${partVal(endParts, "hour")}:${partVal(endParts, "minute")}`;

  // Drop the redundant a.m./p.m. on the start time when both ends share
  // the same period (e.g. "3:00 – 4:00 p.m."), keep both when they
  // don't (e.g. "11:00 a.m. – 12:00 p.m.").
  const rangeStr = startPeriod === endPeriod
    ? `${startTime} – ${endTime} ${endPeriod}`
    : `${startTime} ${startPeriod} – ${endTime} ${endPeriod}`;

  return opts.dateOnEnd === false
    ? rangeStr
    : `${dateFmt.format(endDate)}, ${rangeStr}`;
};


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
            : r.ParameterName === "AQHI"
              ? (r.Value > 10 ? `10+${r.Units}` : `${Math.round(r.Value)}${r.Units}`)
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

  // rows filled from our own MDS weather (station_met_fill.json, 2026-11-04)
  const ourNote = rows.some(r => r.ours)
    ? `<div style="font-size:11px;color:#555;margin-top:4px;">Weather from station data (not on the government feed)</div>` : "";

  return content + ourNote + `
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

// ---------------- AQHI HEALTH MESSAGING ----------------
// Health Canada's standard AQHI health messages, same 4 bands as
// getAQHIColor above (1-3 Low, 4-6 Moderate, 7-10 High, 10+ Very High).
// Two audiences per band, same wording used nationally on provincial
// AQHI pages - not something to reword per-page, it's the standard.
window.getAQHIHealthMessage = function (val) {
  const s = String(val).trim();
  const isPlus = s === "10+";
  const v = isPlus ? 11 : Math.round(Number(s));

  if (!isFinite(v) || v < 1) return null;

  if (v <= 3) {
    return {
      risk: "Low Risk",
      general: "Ideal air quality for outdoor activities.",
      atRisk: "Enjoy your usual outdoor activities."
    };
  }
  if (v <= 6) {
    return {
      risk: "Moderate Risk",
      general: "No need to modify your usual outdoor activities unless you experience symptoms such as coughing and throat irritation.",
      atRisk: "Consider reducing or rescheduling strenuous activities outdoors if you are experiencing symptoms."
    };
  }
  if (v <= 10) {
    return {
      risk: "High Risk",
      general: "Consider reducing or rescheduling strenuous activities outdoors if you experience symptoms such as coughing and throat irritation.",
      atRisk: "Reduce or reschedule strenuous activities outdoors. Children and the elderly should also take it easy."
    };
  }
  return {
    risk: "Very High Risk",
    general: "Reduce or reschedule strenuous activities outdoors, especially if you experience symptoms such as coughing and throat irritation.",
    atRisk: "Avoid strenuous activities outdoors."
  };
};

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
  "Methane": " ppm",
  "Precipitation": " mm"   // our own MDS gauges only - never on the government feed (station_met_fill.json)
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
  "Methane": "CH4",
  "Precipitation": "Precip (last hr)"
};



window.AQHI_GROUPS = {
  Alberta: ["AQHI_Alberta.geojson"],
  Alberta_BLEND: ["AQHI_Alberta_blend.geojson"],

    // 3-hour Cubist AQHI forecast
  Alberta_FORECAST_3H: ["AQHI_forecast_3h_grid.geojson"],
  
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

window.ACTIVE_TYPES = ["CURRENT", "BLEND", "FORECAST_3H"];



// ---------------- LOAD STATIONS (WORKING VERSION) ----------------
// Tried raw.githubusercontent.com, then jsdelivr - both put a CDN with
// independently-lagging edge nodes between this fetch and the data, with
// no reliable way to force every edge to catch up (2026-08-31/09-01,
// confirmed each time: a fresh cache-busted request from one network path
// got current data while an identical request from another didn't).
// This endpoint is nginx on our own Kamatera box serving the exact same
// file run_fetch_last6h.sh writes to disk before it ever touches git - no
// CDN in the path, so no propagation delay of any kind.
// Decommissioned stations: AEPA keeps publishing blank rows for them in last6h.csv, which drew an empty
// dot. Dropped from the live maps only; their history stays in aqhi_data for 2026 reporting.
// Meadows (WCAS): shut down 2026-10-30, Kevin 2026-11-19.
window.RETIRED_STATIONS = { "Meadows": "2026-10-30" };
// Stations that can't make a real AQHI - no ozone and/or no NO2 analyzer (Kevin 2026-11-23: "there is no AQHI
// at O'Morrow, it only collects PM2.5, SO2, TRS"). AEPA still sends the odd stray AQHI row for them and our
// backup AQHI filled the rest from model gases; both are dropped so the dot shows measured pollutants only.
window.NO_AQHI_STATIONS = new Set(["O’Morrow Station 1", "O'Morrow Station 1", "Wagner2"]);

window.dataReady = fetchFresh('https://status.krmenvironmental.com/data/last6h.csv')
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
      if (window.RETIRED_STATIONS[e.StationName.trim()]) return;
    
      // ---- FIX 1: blank ParameterName is AQHI ----
      e.ParameterName = (e.ParameterName && e.ParameterName.trim())
        ? e.ParameterName.trim()
        : "AQHI";
      if (e.ParameterName.startsWith("AQHI") && window.NO_AQHI_STATIONS.has(e.StationName.trim())) return;
    
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
        timeZone: window.AB_TZ,
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
          byParam[p].stale = ageHours > 3;   // Kevin 2026-10-25: grey out anything over 3 h (was 4)
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
    
    // AQHI over 3 h old: our own value for ACA/WCAS stations (aqhiOverrideMap, see below), otherwise
    // null so pages show "no recent reading" instead of a stuck number (2026-10-25)
    window.getStationValue = function(station, param) {
      const rows = window.dataByStation?.[station];
      const row = rows?.find(r => r.ParameterName === param);
      if (param === "AQHI" && (!row || row.stale)) {
        const o = window.aqhiOverrideMap?.[station];
        return o ? o.aqhi : null;
      }
      return row?.Value ?? null;
    };
    
    window.getStationTime = function(station, param) {
      const rows = window.dataByStation?.[station];
      const row = rows?.find(r => r.ParameterName === param);
      if (param === "AQHI" && (!row || row.stale)) {
        const o = window.aqhiOverrideMap?.[station];
        return o ? o.time.toLocaleString("en-CA", { timeZone: window.AB_TZ, hour12: true }) + " (our station data; government feed delayed)" : null;
      }
      return row?.DisplayDate ?? null;
    };
    
  });







// ---------------- OUR OWN AQHI (MDS failover) ----------------
// 2026-10-25: AEPA's AQHI feed stopped at 06:00 on a Sunday and every map kept showing the stuck values.
// For our own ACA/WCAS stations, scripts/aqhi_failover computes AQHI from our MDS data whenever the
// government feed is stale; when a station's government AQHI is over 3 h old (or gone) the map uses
// ours instead (if it is under 3 h old). Everyone else's stale AQHI is drawn grey.
const FAILOVER_MAX_AGE_H = 3;
window.failoverReady = fetchFresh('https://status.krmenvironmental.com/data/aqhi_failover.json')
  .then(r => (r.ok ? r.json() : null))
  .catch(() => null);
// station -> {aqhi, time} for our values under 3 h old; dataReady waits for it so every page that
// waits for station data (incl. the mobile pages' getStationValue) already has it
window.aqhiOverrideMap = {};
window.dataReady = Promise.all([window.dataReady, window.failoverReady]).then(([d, fo]) => {
  const now = new Date();
  Object.entries(fo?.stations || {}).forEach(([n, f]) => {
    if (window.NO_AQHI_STATIONS.has(n)) return;
    const t = new Date(f.reading_utc);
    if (f.aqhi != null && (now - t) / 3600000 <= FAILOVER_MAX_AGE_H) window.aqhiOverrideMap[n] = { aqhi: Number(f.aqhi), time: t };
  });
  return d;
});

// ---------------- OUR OWN STATION WEATHER (MDS) ----------------
// 2026-11-04: AEPA dropped Enoch and Jasper entirely when their gas/PM analyzers were shut down, but the
// weather sensors still run. 2026-11-05: plus precipitation (mm in the hour) from our 4 gauges (Genesee,
// Hinton-Drinnan, Hinton-Hillcrest, O'Morrow 1) - the government feed never carries it. scripts/publish_health.py publishes our hourly MDS wind/temp/RH for any ACA/WCAS
// station whose government weather is missing. A row is used only where the government's is missing, blank
// or over 3 h old, and its time says "station data". Weather only - never gases/PM.
window.metFillReady = fetchFresh('https://status.krmenvironmental.com/data/station_met_fill.json')
  .then(r => (r.ok ? r.json() : null))
  .catch(() => null);
window.dataReady = Promise.all([window.dataReady, window.metFillReady]).then(([d, mf]) => {
  const now = new Date();
  Object.entries(mf?.stations || {}).forEach(([name, s]) => {
    const rows = window.dataByStation[name] || [];
    const newest = {};
    (s.rows || []).forEach(r => { if (!newest[r.param] || r.reading_utc > newest[r.param].reading_utc) newest[r.param] = r; });
    Object.values(newest).forEach(r => {
      const t = new Date(r.reading_utc), age = (now - t) / 3600000;
      if (r.value == null || !isFinite(age) || age > 6) return;
      const i = rows.findIndex(x => x.ParameterName === r.param);
      const gov = i >= 0 ? rows[i] : null;
      if (gov && gov.Value !== null && isFinite(gov.Value) && !gov.stale) return;
      const row = {
        StationName: name, ParameterName: r.param, Value: Number(r.value), ReadingDate: t.toISOString(),
        Latitude: s.lat, Longitude: s.lon, Units: unitsLookup[r.param] || "", Shortform: shortLookup[r.param] || r.param,
        DisplayDate: t.toLocaleString("en-CA", { timeZone: window.AB_TZ, hour12: true }) + " (station data)",
        stale: age > 3, ours: true
      };
      if (i >= 0) rows[i] = row; else rows.push(row);
    });
    if (rows.length) window.dataByStation[name] = rows;
  });
  return d;
});

// ---------------- STATIONS FOR MAP ----------------
window.fetchAllStationData = async function () {
  await window.dataReady;
  const failover = Object.fromEntries(Object.entries((await window.failoverReady)?.stations || {}).filter(([n]) => !window.NO_AQHI_STATIONS.has(n)));
  const now0 = new Date();
  const ourAQHI = name => {
    const f = failover[name];
    if (!f || f.aqhi == null) return null;
    const t = new Date(f.reading_utc);
    return (now0 - t) / 3600000 <= FAILOVER_MAX_AGE_H ? { aqhi: Number(f.aqhi), time: t, lat: f.lat, lon: f.lon, how: f.how || "" } : null;
  };

  const stationNames = Object.keys(dataByStation);

  // our stations whose government rows have aged out of last6h.csv entirely (outage over 6 h)
  const onlyOurs = Object.keys(failover).filter(n => !dataByStation[n]).map(n => {
    const o = ourAQHI(n);
    if (!o || o.lat == null || o.lon == null) return null;
    const row = { StationName: n, ParameterName: "AQHI", Value: o.aqhi, ReadingDate: o.time.toISOString(),
                  Shortform: "AQHI", Units: "", Latitude: o.lat, Longitude: o.lon,
                  DisplayDate: o.time.toLocaleString("en-CA", { timeZone: window.AB_TZ, hour12: true }) };
    return { stationName: n, lat: o.lat, lon: o.lon, aqhi: o.aqhi, aqhi_stale: true, aqhi_override: o,
             rows: [row], html: window.buildStationPopup([row]) };
  }).filter(Boolean);

  return stationNames
    .map(name => {
      const rows = dataByStation[name];
      if (!rows || rows.length === 0) return null;
      
      // HARD FILTER: remove stations with no recent data
      const now = new Date();
      
      const hasRecent = rows.some(r => {
        const t = new Date(r.ReadingDate);
        if (isNaN(t.getTime())) return false;
      
        const ageHours = (now - t) / (1000 * 60 * 60);
        return ageHours <= 6;
      });
      
      if (!hasRecent) return null;      
  
      const locRow = rows.find(r => r.Latitude && r.Longitude) || {};
      const aqhiRow = rows.find(r =>
        r.ParameterName === "AQHI" &&
        r.Value !== null &&
        isFinite(r.Value) &&
        Number(r.Value) >= 1
      );
  
      const aqhiStale = aqhiRow ? !!aqhiRow.stale : true;
      return {
        aqhi_override: aqhiStale ? ourAQHI(name) : null,
        stationName: name,
        lat: isFinite(Number(locRow?.Latitude)) ? Number(locRow.Latitude) : null,
        lon: isFinite(Number(locRow?.Longitude)) ? Number(locRow.Longitude) : null,
        aqhi: (aqhiRow && aqhiRow.Value !== null && isFinite(aqhiRow.Value))
          ? (aqhiRow.Value > 10 ? 11 : aqhiRow.Value)
          : null,
        aqhi_stale: aqhiStale,
        rows: rows,
        html: window.buildStationPopup(Object.values(rows))
      };
    })
    .filter(st =>
      st &&
      st.lat != null &&
      st.lon != null &&
      st.rows &&
      st.rows.length > 0
    )
    .concat(onlyOurs);
};


// ---------------- PURPLEAIR ----------------
// One set of rules for every place a PurpleAir AQHI is shown - the map dots (purpleair.js), the click
// popup's nearest-3 table (click_engine.js) and the mobile pages' nearest sensor (2026-11-23, Kevin: "make
// the popup match the dots - using our proper rules"). Before this the popup used PM2.5-only 10 µg/m³ steps,
// the mobile pages floor(pm/10)+1, and both read the Alberta file only with no exclusions.
//   AQHI = aqhi_rg: full formula from the sensor's 3 h PM2.5 + regional O3/NO2 (build_pa_regional_aqhi.py),
//          incl. the smoke rule and unconfirmed high PM2.5 left out; PM2.5-only steps only if it's missing.
window.PA_SOURCES = {
  AB: "https://dkevinm.github.io/AB_datapull/data/AB_PM25_map.json",
  // 150 km border bands (AB_datapull/PA_border_pull.py; SK cut from SK_datapull), added 2026-09-30
  BC: "https://dkevinm.github.io/AB_datapull/data/BC_PM25_map.json",
  NT: "https://dkevinm.github.io/AB_datapull/data/NT_PM25_map.json",
  SK: "https://dkevinm.github.io/AB_datapull/data/SK_band_PM25_map.json"
};
window.PA_EXCLUDED_SENSORS = [114435, 121565];

window.paPmOnlyAQHI = function (pm) {   // fallback only: PM2.5 in 10 µg/m³ steps, 100+ -> 10
  if (pm == null || isNaN(pm)) return null;
  pm = Number(pm);
  if (pm > 90) return 10;
  if (pm > 0) return Math.ceil(pm / 10);
  return null;
};

window.paSensorAQHI = function (rec) {
  if (rec.aqhi_rg !== null && rec.aqhi_rg !== undefined && rec.aqhi_rg !== "" && Number.isFinite(Number(rec.aqhi_rg)))
    return Number(rec.aqhi_rg);
  return window.paPmOnlyAQHI(rec.pm_corr);
};

// All sensors the dots draw (Alberta + border bands, exclusions applied, a PM2.5 and an AQHI value),
// fetched once and shared by purpleair.js and AppData.purpleair. The border files are optional.
window.paRecordsReady = null;
window.loadPurpleAirRecords = function () {
  if (window.paRecordsReady) return window.paRecordsReady;
  const load = async (prov, url) => {
    const res = await window.fetchFresh(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const recs = Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
    return recs.map(r => ({ ...r, province: prov }));
  };
  const entries = Object.entries(window.PA_SOURCES);
  window.paRecordsReady = Promise.allSettled(entries.map(([prov, url]) => load(prov, url))).then(res => {
    if (res[0].status !== "fulfilled") throw res[0].reason;   // Alberta is required
    let recs = [];
    res.forEach((r, i) => {
      if (r.status === "fulfilled") recs = recs.concat(r.value);
      else console.warn(`PurpleAir ${entries[i][0]} load failed:`, r.reason);
    });
    return recs.filter(r =>
      !window.PA_EXCLUDED_SENSORS.includes(r.sensor_index) &&
      Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) &&
      r.pm_corr !== null && r.pm_corr !== "" && Number.isFinite(Number(r.pm_corr)) &&
      window.paSensorAQHI(r) != null);
  });
  window.paRecordsReady.catch(() => { window.paRecordsReady = null; });   // allow a retry after a failure
  return window.paRecordsReady;
};

async function loadPurpleAir() {
  const records = await window.loadPurpleAirRecords();
  return records.map(r => ({
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    pm: Number(r.pm_corr),
    eAQHI: window.paSensorAQHI(r),
    name: r.name || `Sensor ${r.sensor_index ?? ""}`,
    province: r.province,
    sensor_index: r.sensor_index
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
// Live from ECCC's own ArcGIS service, not the stale static export this
// used to read (unchanged since 2026-07-18, had 2-4 duplicate rows per
// facility - see project_npri_live_source memory). Paginated since the
// server caps ~2000 records/request.
async function fetchNpriLive() {
  const base = "https://maps-cartes.ec.gc.ca/arcgis/rest/services/STB_DGST/NPRI/MapServer/0/query";
  const fields = "FacilityName,CompanyName,ProvinceCode,ReportYear,NpriID,SectorDescriptionEn,City";
  let allFeatures = [];
  let offset = 0;
  const pageSize = 2000;
  while (true) {
    const url = `${base}?where=ProvinceCode%3D%27AB%27&outFields=${fields}&f=geojson&resultRecordCount=${pageSize}&resultOffset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) { console.error("NPRI live fetch failed:", res.status); break; }
    const page = await res.json();
    const feats = page.features || [];
    allFeatures = allFeatures.concat(feats);
    if (feats.length < pageSize) break;
    offset += pageSize;
  }
  return { type: "FeatureCollection", features: allFeatures };
}

window.npriFCReady = fetchNpriLive()
  .then(j => {
    window.NPRI_FC = j;
    console.log("[LiveMap] NPRI_FC:", j.features.length);
  })
  .catch(e => {
    console.error("NPRI load failed", e);
    window.NPRI_FC = { type: "FeatureCollection", features: [] };
  });
