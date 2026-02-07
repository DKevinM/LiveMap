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

      axisLine: {
        lineStyle: {
          width: 8,
          color: [[1, '#1976d2']]
        }
      },

      pointer: {
        length: '70%',
        width: 6
      },

      axisLabel: {
        formatter: function(v) {
          if (v === 0) return 'N';
          if (v === 90) return 'E';
          if (v === 180) return 'S';
          if (v === 270) return 'W';
          return '';
        },
        fontSize: 16,
        distance: 20
      },

      axisTick: { show: false },
      splitLine: { show: false },

      detail: { show: false },

      data: [{ value: degrees }]
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
        show: true,
        width: 24,
        itemStyle: {
          color: (title === "AQHI") ? aqhiColor(value) : undefined
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




      title: { fontSize: 11 },
      detail: { show: false },
      data: [{ value: value, name: title }]
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
  "Total Oxides of Nitrogen": 159,
  "Nitric Oxide": 159,
  "Nitrogen Dioxide": 159,
  "Hydrogen Sulphide": 10,
  "Total Reduced Sulphur": 10,
  "Sulphur Dioxide": 172,
  "Fine Particulate Matter": 80,
  "Total Hydrocarbons": 5,
  "Carbon Monoxide": 13,
  "Non-methane Hydrocarbons": 3,
  "Methane": 3,
  "Outdoor Temperature": 35,
  "Relative Humidity": 100,
  "Wind Speed": 100,
  "Wind Direction": 360
};

const gaugeMax = {
  "Ozone": 200,
  "Fine Particulate Matter": 200,
  "Nitrogen Dioxide": 300,
  "Sulphur Dioxide": 250,
  "Hydrogen Sulphide": 20,
  "Total Reduced Sulphur": 20,
  "Wind Speed": 120,
  "Wind Direction": 360,
  "Outdoor Temperature": 50,
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



  if ([
    "Wind Speed",
    "Wind Direction",
    "Outdoor Temperature",
    "Relative Humidity",
    "Precipitation"
  ].includes(param)) {
    return [[1, "#1976d2"]];  // all blue
  }
  
  const guide = guideLimits[param] || max * 0.5;

  const greenBreak  = (0.5 * guide) / max;
  const yellowBreak = guide / max;

  return [
    [greenBreak,  "#00c853"],  // green <50% guideline
    [yellowBreak, "#ffd600"],  // yellow 50% → guideline
    [1,           "#d50000"]   // red > guideline
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

  let value = Number(r.Value);
  let param = r.ParameterName ? r.ParameterName.trim() : "";

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



  // ----- Meteorology formatting -----
  if (param === "Wind Direction") {
    value = `${Math.round(value)}° (${toCardinal16(value)})`;
    units = "";
  }
  
  else if (param === "Wind Speed") {
    value = value.toFixed(1);
    units = "km/h";
  }
  
  else if (param === "Outdoor Temperature") {
    value = value.toFixed(1);
    units = "°C";
  }
  
  else if (param === "Relative Humidity") {
    value = value.toFixed(1);
    units = "%";
  }
  
  else if (param === "Precipitation") {
    value = value.toFixed(1);
    units = "mm";
  }


  // PM stays µg/m³
  if (param === "Fine Particulate Matter") {
    units = "µg/m³";
  }

  // ----- Formatting for display -----
  let short = param;
  let unit  = units;
  let dec   = 1;
  
  if (displayMap[param]) {
    short = displayMap[param].short;
    unit  = displayMap[param].unit;
    dec   = displayMap[param].dec;
  }
  
  // Wind direction special case
  if (param === "Wind Direction") {
    value = `${Math.round(value)} (${toCardinal(value)})`;
    unit = "";
  } else {
    value = Number(value).toFixed(dec);
  }
  

  // ----- Formatting for display -----
  let short = param;
  let unit  = units;
  let dec   = 1;
  
  if (displayMap[param]) {
    short = displayMap[param].short;
    unit  = displayMap[param].unit;
    dec   = displayMap[param].dec;
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


  // Wind direction special case
  if (param === "Wind Direction") {
    value = `${Math.round(value)} (${toCardinal(value)})`;
    unit = "";
  } else {
    value = Number(value).toFixed(dec);
  }
  
  return {
    param,
    short,
    value,
    time: new Date(r.ReadingDate),
    unit
  };



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
    
      byParam[n.param] = byParam[n.param] || [];
      byParam[n.param].push({
        v: n.value,
        t: n.time,
        u: n.units
      });
    });


    
    // SORT BY TIME
    Object.keys(byParam).forEach(p => {
      byParam[p].sort((a,b) => a.t - b.t);
    });


    const container = document.getElementById("gauges");
    
    let stationTime = null;
    let aqhiValue = null;
    
    // -------- FIRST PASS: find AQHI and time only --------
    Object.entries(byParam).forEach(([param, rows]) => {
      const latest = rows[rows.length - 1];
    
      if (!stationTime) {
        stationTime = latest.t.toLocaleString("en-CA");
      }
    
      if (param === "AQHI") {
        aqhiValue = latest.v;
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
    Object.entries(byParam).forEach(([param, rows]) => {
    
      if (param === "AQHI") return; // skip
    
      const latest = rows[rows.length - 1];
    
      const gid = `g_${param.replace(/\s/g,'')}`;
    
      let targetRow = "air";
    
      if ([
        "Wind Speed",
        "Wind Direction",
        "Outdoor Temperature",
        "Relative Humidity"
      ].includes(param)) targetRow = "met";
    
      document.getElementById(targetRow).insertAdjacentHTML("beforeend", `
        <div class="gaugeBox">
          <div id="${gid}" class="gauge"></div>
          <div class="value" id="val_${gid}"></div>
          <div class="label">${param}</div>
        </div>
      `);
    
      const max   = gaugeMax[param] || 200;
      const guide = guideLimits[param] || null;
      const min   = param === "Outdoor Temperature" ? -50 : 0;
    
      setTimeout(() => {
        if (param === "Wind Direction") {
          buildCompass(gid, latest.value);
        } else {
          buildGauge(gid, latest.value, param, min, max, gaugeZones(param, max), guide);
        }
      }, 0);
      
      const disp = formatDisplay(param, latest.value);
      
      document.getElementById(`val_${gid}`).innerHTML =
        `<b>${disp.text}</b> ${disp.unit}`;


    });
  })

