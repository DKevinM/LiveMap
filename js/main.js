function buildRoseSVG(p) {

  const bins = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];

  const speeds = ["low","med","high"];   // ignore calm for display

  const R = 28;
  let paths = "";

  bins.forEach((b,i) => {

    let startR = 0;

    speeds.forEach((s,layer) => {

      const key = `${b}_${s}`;
      const val = p[key] || 0;

      // scale thickness by value
      const thickness = val * 0.4;   // adjust scale later
      const endR = startR + thickness;

      const angle = (i * 22.5 - 90) * Math.PI/180;
      const next  = ((i+1)*22.5 - 90) * Math.PI/180;

      const x1 = 30 + startR * Math.cos(angle);
      const y1 = 30 + startR * Math.sin(angle);
      const x2 = 30 + endR   * Math.cos(angle);
      const y2 = 30 + endR   * Math.sin(angle);

      const x3 = 30 + endR   * Math.cos(next);
      const y3 = 30 + endR   * Math.sin(next);
      const x4 = 30 + startR * Math.cos(next);
      const y4 = 30 + startR * Math.sin(next);

      const color =
        layer === 0 ? "rgba(255,200,0,0.7)" :
        layer === 1 ? "rgba(255,120,0,0.7)" :
                      "rgba(255,0,0,0.7)";

      paths += `
        <path d="
          M ${x1},${y1}
          L ${x2},${y2}
          A ${endR},${endR} 0 0,1 ${x3},${y3}
          L ${x4},${y4}
          A ${startR},${startR} 0 0,0 ${x1},${y1}
          Z"
          fill="${color}">
        </path>`;

      startR = endR;

    });

  });

  return `<svg width="60" height="60">${paths}</svg>`;
}



window.bootstrap = async function () {

  console.log("Bootstrapping app...");

  if (!window.initMap) {
    console.error("initMap missing");
    return;
  }



  
  await initMap();

  if (!window.AppData?.ready) {
    console.error("AppData.ready missing");
    return;
  }

  await AppData.ready;
  
  if (window.renderStations) {
    await window.dataReady;  
    await renderStations();
  }

  if (window.renderPurpleAir) {
    await renderPurpleAir();
  }

  console.log("Application ready.");
};

window.addEventListener("load", bootstrap);
