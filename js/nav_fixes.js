// Navigation fixes, shared by every LiveMap page (moved here 2026-10-26 from
// AB_Overview.html, where they were first made on 2026-10-16 after AAC/Airhub
// reviewer feedback). map.js calls applyNavFixes(map) as soon as the map
// exists; pages that build their own map (ACA_mobile, WCAS_mobile) call it
// themselves.
//   1. Popups: never taller than the visible map (the content scrolls), and
//      re-fitted when their content grows. Before: a popup opened small, the
//      map panned, then the "What's driving this AQHI" chart made it grow
//      upward, so the station name ended up ~200 px above the map on laptops.
//   2. Trackpads: a two-finger swipe used to jump ~6 zoom levels (Leaflet
//      rounds each scroll batch up to a whole zoomSnap step). Now quarter-level
//      steps, 120 ms batches, 150 px per level. The +/- buttons still step one
//      whole level.
//   3. A "?" button under the zoom buttons opens a short "Moving around the
//      map" guide, built from the controls this page actually has.
(function () {
  const CSS = `
  .nav-help-btn { width:30px; height:30px; line-height:30px; text-align:center; font:bold 18px Arial, sans-serif; cursor:pointer; background:#fff; color:#1F4244; }
  .nav-help-btn:hover { background:#f4f4f4; }
  #navhelp { position:fixed; inset:0; z-index:5000; background:rgba(0,0,0,.45); display:none; align-items:center; justify-content:center; padding:16px; }
  #navhelp .box { background:#fff; color:#1b1f23; max-width:440px; width:100%; max-height:calc(100vh - 32px); overflow:auto; border-radius:10px; padding:18px 20px; font:15px/1.5 Arial, sans-serif; box-shadow:0 8px 30px rgba(0,0,0,.35); }
  #navhelp h2 { margin:0 0 10px; font-size:19px; color:#1F4244; }
  #navhelp table { border-collapse:collapse; width:100%; }
  #navhelp td { padding:6px 4px; vertical-align:top; border-top:1px solid #e5e7eb; }
  #navhelp td:first-child { font-weight:bold; width:42%; }
  #navhelp .close { float:right; border:0; background:none; font-size:22px; cursor:pointer; line-height:1; color:#1b1f23; }
  #navhelp .tip { color:#57606a; font-size:13px; margin-top:10px; }`;

  // Rows only for what this page has; checked when the guide opens, since
  // the layer list and search box are added after the map.
  function helpRows(map) {
    const has = sel => !!document.querySelector(sel);
    const rows = [
      ["Move the map", "Click and drag. On a trackpad, press and drag."],
      ["Zoom in or out", "Use the <b>+</b> and <b>&minus;</b> buttons, pinch on a trackpad, or scroll with a mouse wheel."],
      ["See a station", "Click a coloured circle. A box opens with its readings. Scroll inside the box if it is long."],
    ];
    if (map._navOpts.clickSpot) rows.push(["Check a spot", "Click anywhere on the map to see the nearest stations, sensors and weather."]);
    if (has("#addressInput")) rows.push(["Find a place", "Type an address or town in the search box and press <b>Go</b>."]);
    if (has("#clear-btn")) rows.push(["Start over", "Press <b>Clear Selection</b>."]);
    if (has(".leaflet-control-layers")) rows.push(["Show or hide layers", "Tick the boxes in the layer list."]);
    return rows.map(([a, b]) => "<tr><td>" + a + "</td><td>" + b + "</td></tr>").join("");
  }
  function openNavHelp(map) {
    let el = document.getElementById("navhelp");
    if (!el) {
      el = document.createElement("div");
      el.id = "navhelp"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "navhelp-title");
      el.innerHTML = '<div class="box"><button class="close" aria-label="Close">&times;</button><h2 id="navhelp-title">Moving around the map</h2>' +
        '<table></table><p class="tip">Tip: if the map moves too much on a trackpad, use the + and &minus; buttons to zoom and drag to move.</p></div>';
      el.addEventListener("click", e => { if (e.target === el || e.target.classList.contains("close")) el.style.display = "none"; });
      document.addEventListener("keydown", e => { if (e.key === "Escape") el.style.display = "none"; });
      document.body.appendChild(el);
    }
    el.querySelector("table").innerHTML = helpRows(map);
    el.style.display = "flex";
  }

  window.applyNavFixes = function (map, opts) {
    if (!map || map._navFixed) return;
    map._navFixed = true;
    map._navOpts = Object.assign({ help: true, clickSpot: true }, opts);
    if (!document.getElementById("nav-fixes-css")) {
      const st = document.createElement("style"); st.id = "nav-fixes-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    L.Popup.mergeOptions({ autoPanPaddingTopLeft: L.point(10, 10), autoPanPaddingBottomRight: L.point(10, 10) });

    // 2. gentler scroll / trackpad zoom
    map.options.zoomSnap = 0.25;
    map.options.zoomDelta = 1;
    map.options.wheelPxPerZoomLevel = 150;
    map.options.wheelDebounceTime = 120;

    // 1. popups fit the visible map, and re-fit when their content grows
    map.on("popupopen", e => {
      const p = e.popup;
      p.options.maxHeight = Math.max(200, map.getSize().y - 30);
      p.update();
      const content = p.getElement() && p.getElement().querySelector(".leaflet-popup-content");
      if (!content || !window.ResizeObserver) return;
      let last = 0, raf = 0;
      const ro = new ResizeObserver(() => {
        const h = content.scrollHeight;
        if (Math.abs(h - last) < 4) return;
        last = h; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (map.hasLayer(p)) p.update(); });
      });
      ro.observe(content);
      p.once("remove", () => ro.disconnect());
    });

    // 3. "?" button under the zoom buttons
    if (map._navOpts.help) {
      const Help = L.Control.extend({ options: { position: "topleft" },
        onAdd() { const d = L.DomUtil.create("div", "leaflet-bar"); const a = L.DomUtil.create("a", "nav-help-btn", d);
          a.href = "#"; a.title = "How to move around the map"; a.setAttribute("role", "button"); a.innerHTML = "?";
          L.DomEvent.on(a, "click", ev => { L.DomEvent.preventDefault(ev); L.DomEvent.stopPropagation(ev); openNavHelp(map); });
          return d; } });
      new Help().addTo(map);
    }
  };
})();
