function buildGauge(id, title, value, min, max) {
  return {
    type: "indicator",
    mode: "gauge+number",
    value: value ?? 0,
    title: { text: title },
    gauge: { axis: { range: [min, max] } }
  };
}

function buildFullGaugePanel(station) {

  const gauges = [
    buildGauge("AQHI","AQHI",station.AQHI,0,11),
    buildGauge("PM2.5","PM2.5",station.PM25,0,200),
    buildGauge("O3","O₃",station.O3,0,100),
    buildGauge("NO2","NO₂",station.NO2,0,200),
    buildGauge("RH","RH",station.RH,0,100),
    buildGauge("Temp","Temp",station.Temp,-40,40),
    buildGauge("WS","Wind",station.WS,0,100)
  ];

  Plotly.newPlot("station-gauges", gauges, {
    grid: { rows: 2, columns: 4, pattern: "independent" },
    height: 500
  });
}

function buildForecastGauges(forecast) {

  const gauges = forecast.map((f,i)=>({
    type:"indicator",
    mode:"gauge+number",
    value:f.AQHI,
    title:{text:`+${i+1} hr`},
    gauge:{axis:{range:[0,11]}}
  }));

  Plotly.newPlot("forecast-gauges", gauges, {height:300});
}
