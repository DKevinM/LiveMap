// Town eAQHI diamonds (added 2026-10-05).
// One estimated AQHI per town (Jasper, Barrhead, Evansburg/Entwistle) from
// that town's own PurpleAir sensors. Calculated once, in
// AB_datapull/scripts/community_eaqhi.py -> data/community_eaqhi.json; the
// LIFX bulbs in those towns and the dk_LIFX page read the same file, so the
// map, the lights and the page always show the same number.
// Shown only on pages that list "towns" in APP_CONFIG.overlays.

const TOWNS_URL = "https://dkevinm.github.io/AB_datapull/data/community_eaqhi.json";
const TOWN_STALE_HOURS = 3;

function townRiskWord(v) {
  if (v >= 10) return "Very high risk";
  if (v >= 7) return "High risk";
  if (v >= 4) return "Moderate risk";
  return "Low risk";
}

function townTime(iso) {
  const t = new Date(iso);
  const opts = { timeZone: "America/Edmonton", hour: "numeric", minute: "2-digit" };
  const sameDay = t.toLocaleDateString("en-CA", { timeZone: "America/Edmonton" }) ===
                  new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
  if (!sameDay) Object.assign(opts, { month: "short", day: "numeric" });
  return t.toLocaleString("en-CA", opts);
}

window.renderTowns = async function () {
  const layer = window.layers?.towns;
  if (!window.map || !layer) return;
  if (!(window.APP_CONFIG?.overlays || []).includes("towns")) return;
  layer.clearLayers();

  let data;
  try {
    const res = await fetch(TOWNS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    console.warn("Town eAQHI load failed:", e);
    return;
  }

  for (const t of data.towns || []) {
    const ageH = t.reading_time_utc ? (Date.now() - new Date(t.reading_time_utc)) / 3.6e6 : Infinity;
    const fresh = t.eaqhi != null && ageH <= TOWN_STALE_HOURS;
    const color = fresh ? window.getAQHIColor(t.eaqhi) : "#D3D3D3";
    const text = fresh ? (t.eaqhi >= 10 ? "10+" : String(t.eaqhi)) : "–";
    const darkText = fresh && t.eaqhi >= 4 && t.eaqhi <= 6;   // yellow/orange need dark numbers

    const icon = L.divIcon({
      className: "town-diamond",
      html: `<div class="td-shape" style="background:${color}"></div>` +
            `<div class="td-num" style="color:${darkText ? "#111" : "#fff"}">${text}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14]
    });

    const valueLine = fresh
      ? `Estimated AQHI: <strong>${text}</strong> (${townRiskWord(t.eaqhi)})`
      : "No recent sensor data";
    const timeLine = t.reading_time_utc ? `Updated: ${townTime(t.reading_time_utc)}` : "";

    L.marker([t.lat, t.lon], { icon, zIndexOffset: 500, title: `${t.label} – estimated AQHI` })
      .bindPopup(`
        <strong>${t.label}</strong><br>
        ${valueLine}<br>
        ${timeLine}
        <hr>
        <small>This is an estimate from community PurpleAir sensors in town. It is not an official government AQHI reading.</small>
        <details style="margin-top:4px"><summary><small>How it's worked out</small></summary>
          <small>${t.how || ""}.<br>
          Sensors used: ${(t.sensors_used || []).join(", ") || "none"}.
          ${t.warning ? "<br>Note: one sensor was set aside (its reading didn't match the others)." : ""}</small>
        </details>
      `)
      .addTo(layer);
  }
  if (!window.map.hasLayer(layer)) layer.addTo(window.map);
};
