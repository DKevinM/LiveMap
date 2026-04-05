// EXISTING
window.showStationModal = function (station) {
  const panel = document.getElementById("station-panel");
  if (!panel) return;

  panel.innerHTML = station.html;
  panel.style.display = "block";
};

// ---------------- PANEL TOGGLE ----------------
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("panel");

  // create button dynamically (no need to touch HTML again)
  const header = document.createElement("div");
  header.id = "panel-header";

  const toggle = document.createElement("button");
  toggle.id = "togglePanel";
  toggle.textContent = "⮜";

  header.appendChild(toggle);

  // insert header at top of panel
  panel.prepend(header);

  toggle.addEventListener("click", () => {
    panel.classList.toggle("collapsed");
    toggle.textContent = panel.classList.contains("collapsed") ? "⮞" : "⮜";
  });
});
