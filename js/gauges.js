// =======================
// gauges_page.js
// =======================

const params = new URLSearchParams(window.location.search);
const station = params.get("station");

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
  // These are GUIDELINES
  "Fine Particulate Matter": "AAAQG",
  "Total Reduced Sulphur": "AAAQG"
};


const gaugeMax = {
  "Ozone": 120,
  "Fine Particulate Matter": 200,
  "Nitrogen Dioxide": 200,
  "Sulphur Dioxide": 200,
  "Hydrogen Sulphide": 20,
  "Total Reduced Sulphur": 20,
  "Total Hydrocarbons": 20,
  "Methane": 20,
  "Non Methane Hydrocarbons": 5,
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
  "Ozone":               { short: "O₃",  unit: "ppb", dec: 1 }
};

function toCardinal16(deg) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const d = ((Number(deg) % 360) + 360) % 360;
  const ix = Math.floor((d + 11.25) / 22.5) % 16;
  return dirs[ix];
}



function normalizeRow(r) {

  let value = r.Value === "" ? null : Number(r.Value);
  let param = r.ParameterName ? r.ParameterName.trim() : "";

  if (value === null || isNaN(value)) {
    return null;   // skip this row completely
  }
  

  // AQHI fix
  if (!param) param = "AQHI";

  // ppm → ppb conversion
  const ppmParams = [
    "Ozone",
    "Nitric Oxide",
    "Nitrogen Dioxide",
    "Total Oxides of Nitrogen",
    "Sulphur Dioxide",
    "Total Reduced Sulphur",
    "Hydrogen Sulphide"
  ];

  if (ppmParams.includes(param)) {
    value = value * 1000;
  }

  return {
    param,
    value,                         // ALWAYS numeric
    time: new Date(r.ReadingDate)
  };
}





  function formatDisplay(param, raw) {
  
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




fetch('https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv')
  .then(r => r.text())
  .then(text => {

    const data = parseCSV(text)
      .filter(r => r.StationName === station);


    const byParam = {};
    
    data.forEach(r => {
    
      if (!r.ParameterName || r.ParameterName.trim() === "") {
        r.ParameterName = "AQHI";
      }
    
      const n = normalizeRow(r);
      if (!n) return;
      
      byParam[n.param] = byParam[n.param] || [];
      byParam[n.param].push({
        value: n.value,
        time: n.time
      });
    });


    
    // SORT BY TIME
    Object.keys(byParam).forEach(p => {
      byParam[p].sort((a,b) => a.time - b.time);
    });

    
    let stationTime = null;
    let aqhiValue = null;
    
    // -------- FIRST PASS: find AQHI and time only --------
    gaugeOrder.forEach(param => {
    
      if (!byParam[param]) return;
    
      const rows = byParam[param];
      const latest = rows[rows.length - 1];   // <-- MISSING LINE
    
      if (!stationTime) {
        stationTime = latest.time.toLocaleString("en-CA");
      }
    
      if (param === "AQHI") {
        aqhiValue = latest.value;
      }
    });

    
    
    // ---------- HEADER ----------
    document.getElementById("title").innerHTML = `
      ${station}<br>
      <span style="font-size:14px;font-weight:400">${stationTime}</span>
    `;
    
    
    // ---------- AQHI GAUGE ----------
    
    buildGauge(
      "g_AQHI",
      aqhiValue,
      "AQHI",
      0,
      11,
      gaugeZones("AQHI", 11),
      null
    );

    document.getElementById("aqhiBig").innerHTML = `
      <div style="color:${aqhiColor(aqhiValue)}">
        AQHI ${aqhiValue}
      </div>
    `;
    
    
    document.getElementById("val_g_AQHI").innerHTML =
      `<b>${aqhiValue}</b>`;
    
    
    
    // -------- SECOND PASS: build all OTHER gauges --------
    gaugeOrder.forEach(param => {
    
      if (param === "AQHI") return;
    
      const gid = `g_${param.replace(/\s/g,'')}`;
    
      let targetRow = "air";
      if (["Wind Speed","Wind Direction","Outdoor Temperature","Relative Humidity"].includes(param))
        targetRow = "met";
    
      // ---- ALWAYS CREATE THE GAUGE BOX ----
      document.getElementById(targetRow).insertAdjacentHTML("beforeend", `
        <div class="gaugeBox">
          <div id="${gid}" class="gauge"></div>
          <div class="value" id="val_${gid}"></div>
          <div class="label">${param}</div>
        </div>
      `);
    
      const rows = byParam[param] || [];
    
      const { latest, status } = getLatestStatus(rows, new Date(), 3);
    
      // ---- NEVER REPORTED HERE ----
      if (rows.length === 0) {
        buildOfflineGauge(gid, param);
        document.getElementById(`val_${gid}`).innerHTML =
          `<span style="color:#999;font-weight:700">NOT INSTALLED</span>`;
        return;
      }
    
      // ---- OFFLINE ----
      if (!latest || status === "offline") {
        buildOfflineGauge(gid, param);
        document.getElementById(`val_${gid}`).innerHTML =
          `<span style="color:#999;font-weight:700">OFFLINE</span>`;
        return;
      }
    
      // ---- STALE ----
      if (status === "stale") {
        document.getElementById(gid).closest(".gaugeBox").style.opacity = "0.6";
      }
    
      const max   = gaugeMax[param] || 200;
      const guide = guideLimits[param] || null;
      const min   = param === "Outdoor Temperature" ? -40 : 0;
    
      if (param === "Wind Direction") {
        buildCompass(gid, latest.value);
      } else {
        buildGauge(gid, latest.value, param, min, max, gaugeZones(param, max), guide);
      }
    

      const disp = formatDisplay(param, latest.value);
      const updated = latest.time.toLocaleTimeString("en-CA", {hour:"2-digit", minute:"2-digit"});
      const label = guideLabel[param];
      const guide = guideLimits[param];
      const unit  = displayMap[param]?.unit || "ppb";
      
      document.getElementById(`val_${gid}`).innerHTML = `
        <b>${disp.text}</b> ${disp.unit}
        <div style="font-size:11px;color:#666;margin-top:2px">
          Updated ${updated}
          ${guide ? `<br>${label} = ${guide} ${unit}` : ``}
        </div>
      `;

    });

  })

