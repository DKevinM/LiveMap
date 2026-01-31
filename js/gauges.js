// =======================
// gauges_page.js
// =======================

const params = new URLSearchParams(window.location.search);
const station = params.get("station");

document.getElementById("title").innerText = station;

function buildGauge(id, value, title, min, max, zones) {
  const chart = echarts.init(document.getElementById(id));
  chart.setOption({
    series: [{
      type: 'gauge',
      min: min,
      max: max,
      progress: { show: true, width: 12 },
      axisLine: { lineStyle: { width: 12, color: zones }},
      pointer: { width: 4 },
      title: { fontSize: 11 },
      detail: { fontSize: 16, offsetCenter: [0, '60%'] },
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

  const guide = guideLimits[param] || max * 0.5;
  return [
    [guide / max, "#00c853"],
    [1, "#d50000"]
  ];
}



fetch('https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv')
  .then(r => r.text())
  .then(text => {

    const rows = text.trim().split('\n');
    const headers = rows.shift().split(',');

    const data = rows.map(line => {
      const cols = line.split(',');
      return Object.fromEntries(headers.map((h,i)=>[h,cols[i]]));
    }).filter(r => r.StationName === station);

    const byParam = {};
    data.forEach(r => {
      const p = r.ParameterName || "AQHI";
      byParam[p] = byParam[p] || [];
      byParam[p].push(Number(r.Value));
    });

    const container = document.getElementById("gauges");

    Object.entries(byParam).forEach(([param, values]) => {

      const gid = `g_${param.replace(/\s/g,'')}`;
      const sid = `s_${param.replace(/\s/g,'')}`;

      container.insertAdjacentHTML("beforeend", `
        <div id="${gid}" class="g"></div>
        <div id="${sid}" class="s"></div>
      `);

      const latest = values[values.length-1];
      const max = guideLimits[param] || 100;

      buildGauge(gid, latest, param, 0, max, gaugeZones(param, max));
      buildSpark(sid, values.slice(-12)); // last 6 hours (5-min)
    });
  });
