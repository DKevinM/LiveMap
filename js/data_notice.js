// ----------------------------
// TEMPORARY DATA-OUTAGE NOTICE (2026-11-07)
// ----------------------------
// Alberta Environment and Protected Areas took its data service down for
// the weekend of Nov 7-8 2026 (404s, then rows with every Value blank), so
// government station readings are missing or greyed out on every page.
// Loaded by every page that loads js/data.js. Shows nothing once
// DATA_NOTICE.until has passed, so it clears itself. To reuse it for the
// next outage, change the text and the date and push again.
//
// On map pages it goes in a stack at the top centre of #map. js/map.js
// puts its heads-up banner (alerts/fires) in the same stack so the two
// don't overlap. On pages without #map (mobile digests, gauges) it is a
// plain bar under the page header.
(function () {
  const DATA_NOTICE = {
    until: "2026-11-08T06:00:00Z", // Sun Nov 8, midnight (UTC-6), AEPA back Nov 7
    html:
      "<strong>Alberta government air data is down this weekend (Nov 7&ndash;8)</strong> " +
      "while Alberta Environment and Protected Areas does system work. " +
      "Some station readings may be missing or greyed out until it is back. " +
      "PurpleAir sensors still update as normal."
  };

  if (Date.now() > Date.parse(DATA_NOTICE.until)) return;

  function show() {
    const style = document.createElement("style");
    style.textContent = `
      .map-notice-stack {
        position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
        z-index: 1200; width: max-content; max-width: min(90%, 640px);
        display: flex; flex-direction: column; gap: 6px;
      }
      .map-notice-stack .headsup-banner {
        position: static; transform: none; max-width: none;
      }
      .data-notice {
        display: flex; align-items: flex-start; gap: 8px;
        background: #e7f1fb; border: 1px solid #1c6fb8; border-radius: 8px;
        padding: 8px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif; font-size: 13px; line-height: 1.35;
        color: #0d3a63;
      }
      .data-notice-bar { margin: 8px 12px; box-shadow: none; }
      .data-notice-icon { font-size: 16px; flex-shrink: 0; }
      .data-notice-text { flex: 1; }
      .data-notice-close {
        flex-shrink: 0; cursor: pointer; font-size: 18px; line-height: 1;
        padding: 0 2px; background: none; border: none; color: inherit;
      }
      @media (max-width: 768px) {
        .map-notice-stack { max-width: 96%; }
        .data-notice { font-size: 11.5px; padding: 6px 8px; }
      }
    `;
    document.head.appendChild(style);

    const notice = document.createElement("div");
    notice.className = "data-notice";
    notice.setAttribute("role", "status");
    notice.innerHTML = `
      <span class="data-notice-icon">&#8505;</span>
      <span class="data-notice-text">${DATA_NOTICE.html}</span>
      <button type="button" class="data-notice-close" aria-label="Dismiss">&times;</button>
    `;
    notice.querySelector(".data-notice-close").addEventListener("click", () => notice.remove());

    const mapDiv = document.getElementById("map");
    if (mapDiv) {
      const stack = document.createElement("div");
      stack.className = "map-notice-stack";
      // Keep clicks/scrolls on the notice from panning or zooming the map.
      ["click", "dblclick", "mousedown", "touchstart", "wheel", "pointerdown"].forEach(ev =>
        stack.addEventListener(ev, e => e.stopPropagation())
      );
      stack.appendChild(notice);
      mapDiv.appendChild(stack);
    } else {
      notice.classList.add("data-notice-bar");
      const header = document.querySelector("header");
      if (header) header.insertAdjacentElement("afterend", notice);
      else document.body.insertBefore(notice, document.body.firstChild);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show);
  else show();
})();
