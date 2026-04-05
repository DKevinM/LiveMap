// EXISTING
window.showStationModal = function (station) {
  const panel = document.getElementById("station-panel");
  if (!panel) return;

  panel.innerHTML = station.html;
  panel.style.display = "block";
};

// ---------------- PANEL TOGGLE ----------------
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("aqhi-panel");
  const header = document.getElementById("aqhi-header");

  if (!panel || !header) return;

  // start collapsed (optional — matches your "tap to expand")
  panel.classList.add("collapsed");

  header.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
  });
});
