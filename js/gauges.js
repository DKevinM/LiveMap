// =======================
// gauges_page.js
// =======================

const params = new URLSearchParams(window.location.search);
const station = params.get("station");

document.getElementById("title").innerText = station;

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
