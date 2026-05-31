// =======================
// gauges_page.js
// =======================

// window.onerror = function() { return true; };

const params = new URLSearchParams(window.location.search);
const station = params.get("station");
const stationExcludes = {
  "Jasper": [
    "Sulphur Dioxide",
    "Total Reduced Sulphur"
  ]
};

document.getElementById("title").innerText = station;



function buildCompass(id, degrees) {

  const chart = echarts.init(document.getElementById(id));

  chart.setOption({
    series: [{
      type: 'gauge',
      min: 0,
      max: 360,
      startAngle: 90,
      endAngle: -270,
      radius: '90%',

      axisLine: {
        lineStyle: {
          width: 8,
          color: [[1, '#1976d2']]
        }
      },

      // major tick marks every 45°
      splitNumber: 8,
      splitLine: {
        length: 14,
        lineStyle: {
          width: 3,
          color: '#333'
        }
      },

      // small tick marks every 11.25°
      axisTick: {
        show: true,
        splitNumber: 4,
        length: 8,
        lineStyle: {
          width: 1,
          color: '#666'
        }
      },

      // compass letters tight to the ring
      axisLabel: {
        distance: 14,
        fontSize: 11,
        fontWeight: 700,
        formatter: function(v) {
          if (v === 0)   return 'N';
          if (v === 45)  return 'NE';
          if (v === 90)  return 'E';
          if (v === 135) return 'SE';
          if (v === 180) return 'S';
          if (v === 225) return 'SW';
          if (v === 270) return 'W';
          if (v === 315) return 'NW';
          return '';
        }
      },

      pointer: {
        length: '70%',
        width: 6
      },

      detail: { show: false },
      data: [{ value: degrees }]
    }]
  });
}



function buildOfflineGauge(id, param) {
  const chart = echarts.init(document.getElementById(id));

  chart.setOption({
    series: [{
      type: 'gauge',
      min: 0,
      max: 100,
      axisLine: {
        lineStyle: {
          width: 24,
          color: [[1, '#dddddd']]
        }
      },
      pointer: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: { show: false },
      title: { show: false }
    }]
  });
}






function buildGauge(id, value, title, min, max, zones, guide) {

  const chart = echarts.init(document.getElementById(id));

  chart.setOption({
    series: [{
      type: 'gauge',
      min: min,
      max: max,
      progress: {
        show: (title === "AQHI"),   // ONLY AQHI gets a fill
        width: 24,
        itemStyle: {
          color: aqhiColor(value)
        }
      },
      axisLine: { lineStyle: { width: 24, color: zones }},
      pointer: { width: 8 },
      radius: '95%',
      center: ['50%', '62%'],   


      axisTick: {
        distance: -30,
        length: 10,
        lineStyle: { width: 2 }
      },
      
      splitNumber: (title === "AQHI") ? 11 : 10,
      
      axisLabel: {
        distance: 28,
        fontSize: 11,
        interval: 0,
        formatter: function(v) {
      
          // ----- AQHI -----
          if (title === "AQHI") {
            if (v === 11) return "10+";
            if (Number.isInteger(v) && v >= 1 && v <= 10) return String(v);
            return "";
          }
      
          // ----- Guideline bold -----
          if (guide && Math.abs(v - guide) < 0.01) {
            return `{guide|${v}}`;
          }
      
          return Number.isInteger(v) ? v : "";
        },
        rich: {
          guide: {
            fontWeight: 'bold',
            fontSize: 12,
            color: '#000'
          }
        }
      },




      title: {
        fontSize: 13,
        fontWeight: 700
      },
      detail: { show: false },
      data: [{ value: value, name: displayMap[title]?.short || title }]
    }]
  });
}


function aqhiColor(v) {
  if (v <= 1) return "#01cbff";
  if (v <= 2) return "#0099cb";
  if (v <= 3) return "#016797";
  if (v <= 4) return "#fffe03";
  if (v <= 5) return "#ffcb00";
  if (v <= 6) return "#ff9835";
  if (v <= 7) return "#fd6866";
  if (v <= 8) return "#fe0002";
  if (v <= 9) return "#cc0001";
  if (v <= 10) return "#9a0100";
  return "#640100"; // 10+
}

function getAQHIMessage(aqhi) {
  if (!isFinite(aqhi)) return null;
  if (aqhi <= 3) {
    return {
      level: "Low",
      range: "1 - 3",
      atRisk: "Enjoy your usual outdoor activities.",
      general: "Ideal air quality for outdoor activities."
    };
  }
  if (aqhi <= 6) {
    return {
      level: "Moderate",
      range: "4 - 6",
      atRisk: "Consider reducing or rescheduling strenuous activities outdoors if you are experiencing symptoms.",
      general: "No need to modify your usual outdoor activities unless you experience symptoms such as coughing and throat irritation."
    };
  }
  if (aqhi <= 10) {
    return {
      level: "High",
      range: "7 - 10",
      atRisk: "Reduce or reschedule strenuous activities outdoors. Children and the elderly should also take it easy.",
      general: "Consider reducing or rescheduling strenuous activities outdoors if you experience symptoms such as coughing and throat irritation."
    };
  }
  return {
    level: "Very High",
    range: "10+",
    atRisk: "Avoid strenuous activities outdoors. Children and the elderly should also avoid outdoor physical exertion.",
    general: "Reduce or reschedule strenuous activities outdoors, especially if you experience symptoms such as coughing and throat irritation."
  };
}


const guideLimits = {
  "Ozone": 76,
  "Nitrogen Dioxide": 159,
  "Hydrogen Sulphide": 10,
  "Total Reduced Sulphur": 5,
  "Sulphur Dioxide": 172,
  "Fine Particulate Matter": 80,
  "Carbon Monoxide": 13,
};

const guideLabel = {
  "Ozone": "AAAQO",
  "Nitrogen Dioxide": "AAAQO",
  "Sulphur Dioxide": "AAAQO",
  "Hydrogen Sulphide": "AAAQO",
  "Carbon Monoxide": "AAAQO",
  "Fine Particulate Matter": "AAAQG",
  "Total Reduced Sulphur": "AAAQG"
};


const gaugeMax = {
  "Ozone": 120,
  "Fine Particulate Matter": 160,
  "Nitrogen Dioxide": 200,
  "Sulphur Dioxide": 200,
  "Hydrogen Sulphide": 20,
  "Total Reduced Sulphur": 20,
  "Carbon Monoxide": 20,
  "Total Hydrocarbons": 10,
  "Methane": 10,
  "Non-methane Hydrocarbons": 10,
  "Wind Speed": 75,
  "Wind Direction": 360,
  "Outdoor Temperature": 40,
  "Relative Humidity": 100,
  "AQHI": 11
};


function gaugeZones(param, max) {

  if (param === "AQHI") {
    return [
      [1/11, "#01cbff"],
      [2/11, "#0099cb"],
      [3/11, "#016797"],
      [4/11, "#fffe03"],
      [5/11, "#ffcb00"],
      [6/11, "#ff9835"],
      [7/11, "#fd6866"],
      [8/11, "#fe0002"],
      [9/11, "#cc0001"],
      [10/11, "#9a0100"],
      [1, "#640100"]
    ];
  }


  const guide = guideLimits[param];

  // ---- NO GUIDELINE (met data, etc) ----
  if (!guide) {
    return [[1, "#1976d2"]];  // solid blue, nothing fancy
  }

  // ---- GUIDELINE PRESENT (real air pollutant logic) ----
  const guidePct = guide / max;
  const greenBreak  = (0.5 * guide) / max;
  const eps = 0.01;

  return [
    [greenBreak, "#00c853"],            // green
    [guidePct - eps, "#ffd600"],       // yellow up to guide
    [guidePct + eps, "#000000"],       // black line
    [1, "#d50000"]                     // red
  ];
}



function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines.shift().split(',');

  return lines.map(line => {
    const cols = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current);

    return Object.fromEntries(
      headers.map((h, i) => [h, cols[i].replace(/^"|"$/g, '')])
    );
  });
}

const gaugeOrder = [
  // ---- AIR QUALITY ----
  "AQHI",
  "Ozone",
  "Nitrogen Dioxide",
  "Nitric Oxide",
  "Total Oxides of Nitrogen",
  "Sulphur Dioxide",
  "Hydrogen Sulphide",
  "Total Reduced Sulphur",
  "Fine Particulate Matter",
  "Carbon Monoxide",
  "Total Hydrocarbons",
  "Methane",
  "Non-methane Hydrocarbons",

  // ---- METEOROLOGY ----
  "Wind Speed",
  "Wind Direction",
  "Outdoor Temperature",
  "Relative Humidity"
];



const displayMap = {
  "Outdoor Temperature": { short: "ET", unit: "°C", dec: 1 },
  "Relative Humidity":   { short: "RH",   unit: "%",  dec: 1 },
  "Wind Speed":          { short: "Wind", unit: "km/h", dec: 1 },
  "Wind Direction":      { short: "Dir",  unit: "°",  dec: 0 },
  "Fine Particulate Matter": { short: "PM2.5", unit: "µg/m³", dec: 1 },
  "Nitrogen Dioxide":    { short: "NO₂", unit: "ppb", dec: 1 },
  "Nitric Oxide":        { short: "NO",  unit: "ppb", dec: 1 },
  "Total Oxides of Nitrogen": { short: "NOx", unit: "ppb", dec: 1 },
  "Sulphur Dioxide":     { short: "SO₂", unit: "ppb", dec: 1 },
  "Hydrogen Sulphide":     { short: "H₂S", unit: "ppb", dec: 1 },
  "Total Reduced Sulphur":   { short: "TRS", unit: "ppb", dec: 1 },
  "Ozone":               { short: "O₃",  unit: "ppb", dec: 1 },
  "Carbon Monoxide":     { short: "CO",  unit: "ppm", dec: 2 },
  "Total Hydrocarbons":   { short: "THC", unit: "ppm", dec: 2 },
  "Methane":             { short: "CH₄", unit: "ppm", dec: 2 },
  "Non-methane Hydrocarbons": { short: "NMHC", unit: "ppm", dec: 2 }
};

function toCardinal16(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const d = ((Number(deg) % 360) + 360) % 360;
  const ix = Math.floor((d + 11.25) / 22.5) % 16;
  return dirs[ix];
}



function normalizeRow(r) {

  let value;
  if (r.Value === "" || r.Value === null || r.Value === undefined) {
    value = null;
  } else {
    const n = Number(r.Value);
    value = Number.isFinite(n) ? n : null;
  }
  
  let param = r.ParameterName ? r.ParameterName.trim() : "";
  // ---- PARAMETERS THAT SHOULD NEVER BE NEGATIVE ----
  const noNegativeParams = [
    "Nitric Oxide",
    "Nitrogen Dioxide",
    "Total Oxides of Nitrogen",
    "Ozone",
    "Sulphur Dioxide",
    "Hydrogen Sulphide",
    "Total Reduced Sulphur",
    "Fine Particulate Matter",
    "Total Hydrocarbons",
    "Methane",
    "Non-methane Hydrocarbons",
    "Carbon Monoxide"
  ];  

  // ---- HANDLE INVALID VALUES ----
  if (value === null || isNaN(value)) {
    return null;   // still drop true garbage
  }
  
  // ---- FIX NEGATIVES (air data only) ----  
  if (noNegativeParams.includes(param) && value < 0) {
    value = 0;   // clamp instead of losing data
  }

  // AQHI fix
  if (!param) param = "AQHI";

  return {
    param,
    value: Number(value),
    time: new Date(r.ReadingDate)
  };
}




  function formatDisplay(param, raw) {
  
    if (raw === null || raw === undefined || isNaN(Number(raw))) {
      return { text: "—", unit: "" };
    }
  
    if (param === "Wind Direction") {
      return {
        text: `${Math.round(raw)}° (${toCardinal16(raw)})`,
        unit: ""
      };
    }
  
    if (displayMap[param]) {
      return {
        text: Number(raw).toFixed(displayMap[param].dec),
        unit: displayMap[param].unit
      };
    }
  
    return {
      text: Number(raw).toFixed(1),
      unit: "ppb"
    };
  }





function getLatestStatus(rows, now = new Date(), staleHours = 3) {
  if (!rows || rows.length === 0) return { latest: null, status: "missing", ageHours: null };

  // rows already sorted by time ascending
  const latest = rows[rows.length - 1];
  const ageMs = now - latest.time;
  const ageHours = ageMs / (1000 * 60 * 60);

  if (!Number.isFinite(ageHours)) return { latest: null, status: "missing", ageHours: null };

  // fresh enough to show
  if (ageHours <= staleHours) {
    // you can optionally flag "stale-but-usable" if > 1 hour
    const status = (ageHours > 1) ? "stale" : "fresh";
    return { latest, status, ageHours };
  }

  // too old -> offline
  return { latest, status: "offline", ageHours };
}


window.AppData.ready.then(() => {
  const data = window.AppData.stations.find(s => s.stationName === station);
  if (!data) return;

  const rows = data.rows;
  const byParam = {};
  rows.forEach(r => {
    let param = r.ParameterName || r.param || "AQHI";
    const n = normalizeRow(r);
    if (!n) return;
  
    byParam[n.param] = byParam[n.param] || [];
    byParam[n.param].push({
      value: n.value,
      time: n.time
    });
  });
  
  Object.keys(byParam).forEach(p => {
    byParam[p].sort((a,b) => a.time - b.time);
  });

  
    let stationTime = null;
    let aqhiValue = null;

    
    // -------- FIRST PASS: find AQHI and time only --------
    Object.keys(byParam).forEach(param => {  
      if (!byParam[param]) return;    
      const rows = byParam[param] || [];
      if (rows.length === 0) return;    
      const latest = rows[rows.length - 1];    
      if (!stationTime) {
        stationTime = latest.time.toLocaleString("en-CA");
      }    
      if (param === "AQHI") {    
        const { latest: aqhiLatest, status: aqhiStatus } =
          getLatestStatus(rows, new Date(), 4);    
      if (aqhiLatest && aqhiStatus !== "offline") {
      
        const raw = aqhiLatest.value;
      
        if (!Number.isFinite(raw) || raw <= 0) {
          aqhiValue = null;
      } else {
        aqhiValue = raw > 10 ? 11 : Math.round(raw);
      }
      
      } else {
        aqhiValue = null;
      }
      }    
    });

    
    
    // ---------- HEADER ----------
    document.getElementById("title").innerHTML = `
      ${station}<br>
      <span style="font-size:14px;font-weight:400">${stationTime}</span>
    `;
    
    

    // ---------- AQHI GAUGE ----------
    
    // Check if AQHI is valid
    const isValidAQHI = Number.isFinite(aqhiValue) && aqhiValue >= 1;
    
    if (!isValidAQHI) {
    
      // ---- GREY GAUGE ----
      buildOfflineGauge("g_AQHI", "AQHI");
    
      document.getElementById("val_g_AQHI").innerHTML =
        `<span style="color:#999;font-weight:700">N/A</span>`;

      document.getElementById("aqhiBig").innerHTML = `
        <div style="color:#999">
          AQHI —
        </div>
      `;

      // ---- NO MESSAGE ----
      document.getElementById("aqhiMessage").innerHTML = "";
    
    } else {
    
      // ---- NORMAL AQHI ----     
      buildGauge(
        "g_AQHI",
        aqhiValue,
        "AQHI",
        0,
        11,
        gaugeZones("AQHI", 11),
        null
      );
    
      const msg = getAQHIMessage(aqhiValue === 11 ? 11 : aqhiValue);
      const aqhiCol = Number.isFinite(aqhiValue)
        ? aqhiColor(aqhiValue === 11 ? 11 : aqhiValue)
        : "#999";
      
      if (msg) {
        document.getElementById("aqhiMessage").innerHTML = `
          <div style="
            margin-top:12px;
            padding:10px;
            background:#f5f5f5;
            border-radius:8px;
            line-height:1.35;
          ">
    
            <div style="
              font-size: 24px;
              font-weight:700;
              color:${aqhiCol};
              margin-bottom:6px;
              text-shadow:
                -1px -1px 0 #333,
                 1px -1px 0 #333,
                -1px  1px 0 #333,
                 1px  1px 0 #333;
            ">
              ${msg.level} Risk (AQHI ${aqhiValue === 11 ? "10+" : msg.range})
            </div>
    
            <div style="font-size:16px; margin-bottom:6px;">
              <b>At Risk Population:</b><br>
              ${msg.atRisk}
            </div>
    
            <div style="font-size:16px;">
              <b>General Population:</b><br>
              ${msg.general}
            </div>
    
          </div>
        `;
      }

    
    document.getElementById("aqhiBig").innerHTML = `
      <div style="
        color:${aqhiCol};
        text-shadow:
          -1px -1px 0 #333,
           1px -1px 0 #333,
          -1px  1px 0 #333,
           1px  1px 0 #333;
      ">
        AQHI ${aqhiValue >= 10 ? "10+" : aqhiValue}
      </div>
    `;
    
      document.getElementById("val_g_AQHI").innerHTML =
        `<b>${aqhiValue >= 10 ? "10+" : aqhiValue}</b>`;
    }
    
    
    
    // -------- SECOND PASS: build all OTHER gauges --------
    gaugeOrder.forEach(param => {

      if (param === "AQHI") return;
      if (!byParam[param]) return;
      if (stationExcludes[station]?.includes(param)) return;
      const gid = `g_${param.replace(/\s/g,'')}`;
    
      let targetRow = "air";
      if (["Wind Speed","Wind Direction","Outdoor Temperature","Relative Humidity"].includes(param))
        targetRow = "met";
    
      // ---- ALWAYS CREATE THE GAUGE BOX ----
      const rows = byParam[param] || [];
      
      const { latest, status, ageHours } = getLatestStatus(rows, new Date(), 4);
      
      // check if ANY valid data exists historically
      const now = new Date();
      
      const hasRecentValidData = rows.some(r => {
        if (
          r.value === null ||
          r.value === undefined ||
          isNaN(Number(r.value)) ||
          Number(r.value) === -10
        ) return false;
      
        const ageHours = (now - r.time) / (1000 * 60 * 60);
      
        return ageHours <= 4;  // ONLY recent data counts
      });
      
      if (!hasRecentValidData && status === "offline") return;
      
      // If no latest → skip
      if (!latest) return;
      
      // If value is bad BUT data is recent → still show as offline
      const isBadValue =
        latest.value === null ||
        latest.value === undefined ||
        isNaN(Number(latest.value)) ||
        Number(latest.value) === -10;
      
      // Hide ONLY if:
      // - bad value AND
      // - data is too old (true offline)
      if (isBadValue && status === "offline") return;
      
      const container = document.getElementById(targetRow);
      if (!container) return;
      
      container.insertAdjacentHTML("beforeend", `
        <div class="gaugeBox">
          <div id="${gid}" class="gauge"></div>
          <div class="value" id="val_${gid}"></div>
          <div class="label">${param}</div>
        </div>
      `);

      
    
      // ---- STALE ----
      if (status === "stale") {
        document.getElementById(gid).closest(".gaugeBox")
          .style.filter = "grayscale(40%) brightness(0.9)"; 
      }
    
      
      const max   = gaugeMax[param] || 200;
      const guide = guideLimits[param] || null;
      const min   = param === "Outdoor Temperature" ? -40 : 0;
      
      if (isBadValue) {
        if (status === "offline") return;
      } else {
        if (param === "Wind Direction") {
          buildCompass(gid, latest.value);
        } else {
          buildGauge(gid, latest.value, param, min, max, gaugeZones(param, max), guide);
        }
      }



      let disp, updated;
      
      if (isBadValue) {
        disp = { text: "Offline", unit: "" };
        updated = latest.time
          ? latest.time.toLocaleTimeString("en-CA", {hour:"2-digit", minute:"2-digit"})
          : "--";
      } else {
        disp = formatDisplay(param, latest.value);
        updated = latest.time.toLocaleTimeString("en-CA", {hour:"2-digit", minute:"2-digit"});
      }
      const unit  = displayMap[param]?.unit || "ppb";
      
      document.getElementById(`val_${gid}`).innerHTML = `
        <b>${disp.text}</b> ${disp.unit}
        <div style="font-size:11px;color:#666;margin-top:2px">
          Updated ${updated}
          ${guide ? `<br>${guideLabel[param]} = ${guide} ${unit}` : ``}
        </div>
      `;

    });

  })
