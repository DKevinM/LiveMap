function safeValue(v) {
  if (v === null || v === undefined || isNaN(v)) return null;
  return Number(v);
}

function buildGauge(title, value, min, max, guideline = null, units = "") {

  const v = safeValue(value);

  const axisMax = (v !== null && v > max) ? v * 1.15 : max;

  let steps = [];
  if (guideline !== null) {
    steps.push({ range: [min, guideline], color: "#e0f3f8" });
    steps.push({ range: [guideline, axisMax], color: "#ffd2d2" });
  }

  return {
    type: "indicator",
    mode: "gauge+number",
    value: v ?? 0,
    title: { text: title },
    number: { suffix: units },
    gauge: {
      axis: { range: [min, axisMax] },
      bar: { color: v === null ? "#999" : "#016797" },
      steps: steps,
      threshold: guideline !== null ? {
        line: { color: "red", width: 4 },
        thickness: 0.75,
        value: guideline
      } : undefined
    },
    domain: { x: [0, 1], y: [0, 1] }
  };
}

window.buildFullGaugePanel = function (station) {

  const offline = v => v === null || v === undefined || isNaN(v);

  const gauges = [
    buildGauge("AQHI", station.AQHI, 0, 11),
    buildGauge("PM2.5", station.PM25, 0, 200, 80, " µg/m³"),
    buildGauge("O₃", station.O3, 0, 100, 80, " ppb"),
    buildGauge("NO₂", station.NO2, 0, 200, 100, " ppb"),
    buildGauge("RH", station.RH, 0, 100, null, " %"),
    buildGauge("Temp", station.Temp, -40, 40, null, " °C"),
    buildGauge("Wind", station.WS, 0, 100, null, " km/h")
  ];

  const layout = {
    grid: { rows: 2, columns: 4, pattern: "independent" },
    height: 520,
    annotations: []
  };

  if (offline(station.PM25)) {
    layout.annotations.push({
      text: "Equipment Offline",
      x: 0.5, y: 0.95,
      xref: "paper", yref: "paper",
      showarrow: false,
      font: { color: "red", size: 14 }
    });
  }

  Plotly.newPlot("station-gauges", gauges, layout);
};

window.buildForecastGauges = function (forecast) {

  const gauges = forecast.map((f, i) =>
    buildGauge(`+${i+1} hr`, f.AQHI, 0, 11)
  );

  Plotly.newPlot("forecast-gauges", gauges, { height: 300 });
};

window.initGauges = function () {
  console.log("Gauges ready.");
};



