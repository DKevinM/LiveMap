window.showStationModal = function (station) {
  const panel = document.getElementById("station-panel");
  if (!panel) return;

  panel.innerHTML = station.html;
  panel.style.display = "block";
};
