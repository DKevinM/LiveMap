// =======================
// gauges_page.js
// =======================

const params = new URLSearchParams(window.location.search);
const station = params.get("station");

document.getElementById("title").innerText = station;

function buildGauge(id, value, title, min, max, zones, guide) {

  const chart = echarts.init(document.getElementById(id));

  chart.setOption({
    series: [{
      type: 'gauge',
      min: min,
      max: max,
      progress: { show: true, width: 24 },
      axisLine: { lineStyle: { width: 24, color: zones }},
      pointer: { width: 8 },
      radius: '90%',

      axisTick: {
        distance: -30,
        length: 10,
        lineStyle: { width: 2 }
      },

      axisLabel: {
        distance: 25,
        fontSize: 10,
        formatter: function(v) {
          if (guide && Math.abs(v - guide) < 0.01) {
            return `{guide|${v}}`;
          }
          return v;
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



function buildSpark(id, values) {
  const chart = echarts.init(document.getElementById(id));
  chart.setOption({
    xAxis: { show:false },
    yAxis: { show:false },
    grid: { left:0,right:0,top:0,bottom:0 },
    series: [{
      data: values,
      type: 'line',
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 2 }
    }]
  });
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




function normalizeRow(r) {

  let value = Number(r.Value);
  let param = r.ParameterName;
  let units = "ppb";

  
  // AQHI fix
  if (r.ParameterName === "AQHI") {
    param = "AQHI";
    value = Number(r.Value);
    units = "";
  }


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

  // Meteorology (blue gauges)
  if ([
    "Wind Speed",
    "Wind Direction",
    "Outdoor Temperature",
    "Relative Humidity",
    "Precipitation"
  ].includes(param)) {
    units = "";
  }

  // PM stays µg/m³
  if (param === "Fine Particulate Matter") {
    units = "µg/m³";
  }

  return {
    param,
    value,
    time: new Date(r.ReadingDate),
    units
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
    document.getElementById("aqhi").innerHTML = `
      <div class="gaugeBox">
        <div id="g_AQHI" class="gauge"></div>
        <div class="value" id="val_g_AQHI"></div>
        <div class="label">AQHI</div>
      </div>
    `;
    
    buildGauge(
      "g_AQHI",
      aqhiValue,
      "AQHI",
      0,
      11,
      gaugeZones("AQHI", 11),
      null
    );
    
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
        buildGauge(gid, latest.v, param, min, max, gaugeZones(param, max), guide);
      }, 0);
    
      document.getElementById(`val_${gid}`).innerHTML =
        `<b>${latest.v.toFixed(2)}</b> ${latest.u}`;
    });

