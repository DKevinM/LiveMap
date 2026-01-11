let purpleair = [];

fetch("data/purpleair_aca.json")
  .then(r => r.json())
  .then(data => purpleair = data);

fetch("data/purpleair_aca.json")
  .then(r=>r.json())
  .then(data => {
    purpleair = data;

    purpleair.forEach(p => {
      const color = getPAColor(p.pm2_5_corrected);

      L.circleMarker([p.latitude, p.longitude], {
        radius: 8,
        color: "black",
        weight: 1,
        fillColor: color,
        fillOpacity: 0.85
      }).addTo(layerPA)
        .bindTooltip(`${p.name}<br>PM2.5: ${p.pm2_5_corrected ?? "Offline"}`);
    });
  });

function getPAColor(v){
  if(v == null) return "#aaa";
  if(v < 10) return "#00e400";
  if(v < 25) return "#ffff00";
  if(v < 50) return "#ff7e00";
  if(v < 75) return "#ff0000";
  return "#8f3f97";
}
