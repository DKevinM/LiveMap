// =======================
// wind_anim.js
// =======================
// Animated 10 m winds + forecast time bar for the members' ACA.html and
// WCAS.html (2026-11-20). Not loaded by the public maps.
//
// Renderer and slider ported from SK_Air_Map/js/winds_anim.js (same look as
// the WCAS emergency / Hinton / Howe Sound pages). Data are the small Alberta
// files AB_winds/py/sk_wind_slim.py ab writes every hour (~100 KB per time
// step, vs ~19 MB for the full HRDPS files ACA_demo.html reads): HRDPS 10 m
// u/v, 48-61.5N / 134-100W, ~7 km, earth-relative (u east, v north),
// adjusted to ECCC station winds for past hours, with the correction fading
// over the forecast. Reader convention, as in every HRDPS reader:
//   i = (lon - lo1) / dx ,  j = (la1 - lat) / dy
//
// Page-local: nothing in the shared js/ files calls this. It waits for
// window.map + window._layerControl and adds "Wind animation (HRDPS model)",
// switched on (APP_CONFIG.windAnimOn === false leaves it off).

(function () {
  const BASE = "https://zcunoncbyitfsilrhymv.supabase.co/storage/v1/object/public/winds/";
  const INDEX = "ab_slim/index.json";
  // Alberta stays on UTC-6 (MDT) year-round from 2026-11-01. Every time this bar shows is
  // now or later, so pin UTC-6 instead of trusting the visitor's tz data ("America/Edmonton"
  // still gives UTC-7 on browsers/phones that haven't updated).
  const TZ = "Etc/GMT+6";
  const HOUR = 3600e3;
  const PLAY_MS = 1200;   // time on each hour while playing

  const BINS = [[2, "#1e3a8a"], [4, "#2563eb"], [7, "#7c3aed"], [10, "#c026d3"], [14, "#ea580c"], [Infinity, "#dc2626"]];
  const STOPS = [[0, "#1e3a8a"], ...BINS.slice(0, -1).map(([hi], i) => [hi, BINS[i + 1][1]])]
    .map(([v, c]) => [v, [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16))]);
  const NCOL = 12, VMAX = 16;   // m/s: shades up to ~58 km/h, top colour beyond
  const SHADES = Array.from({ length: NCOL }, (_, i) => {
    const v = i / (NCOL - 1) * VMAX; let k = 0; while (k < STOPS.length - 2 && v > STOPS[k + 1][0]) k++;
    const [v0, c0] = STOPS[k], [v1, c1] = STOPS[k + 1], f = Math.min(1, Math.max(0, (v - v0) / (v1 - v0)));
    return `rgb(${c0.map((x, j) => Math.round(x + (c1[j] - x) * f)).join(",")})`;
  });
  const SHADES_SAT = SHADES.map(c => `rgb(${c.slice(4, -1).split(",").map(x => Math.round(+x + (255 - +x) * 0.45)).join(",")})`);
  const shadeOf = sp => Math.min(NCOL - 1, Math.round(sp / VMAX * (NCOL - 1)));
  const PX_PER_MS = 0.35, MAX_AGE = 130, TRAIL = 24, STRIDE = 2, NALPHA = 3;

  const fmtLocal = t => new Date(t).toLocaleString("en-CA", {
    timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit"
  });

  // ---------- styles (kept here so each page needs only the script tag) ----------
  const css = document.createElement("style");
  css.textContent = `
    .wind-panel { position: absolute; left: 10px; bottom: 60px; z-index: 1000; width: 300px;
      max-width: calc(100% - 20px); box-sizing: border-box; background: #fff; padding: 8px 10px 9px;
      border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.28); color: #222;
      font: 11px/1.3 Arial, sans-serif; }
    .wind-panel-title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
    .wind-panel-status { color: #555; min-height: 14px; }
    .wind-panel-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
    .wind-panel-row button { font: 700 11px/1 Arial, sans-serif; padding: 5px 9px; border-radius: 999px;
      border: 1px solid #b8c2cc; background: #fff; color: #1d2733; cursor: pointer; white-space: nowrap; }
    .wind-panel-row button:hover:not(:disabled) { background: #eef3f8; }
    .wind-panel-row button:disabled { opacity: .5; cursor: default; }
    .wind-panel-row button.on { background: #0b5ed7; border-color: #0b5ed7; color: #fff; }
    .wind-panel-slider { flex: 1; min-width: 0; margin: 0; accent-color: #0b5ed7; }
    .wind-panel-when { font-weight: 700; font-size: 13px; color: #0b5ed7; margin-top: 5px; }
    .wind-panel-ends { display: flex; justify-content: space-between; color: #777; font-size: 10px; margin-top: 1px; }
    .wind-panel-legend { margin-top: 6px; display: flex; align-items: center; gap: 6px; color: #333; }
    .wind-panel-legend i { width: 150px; height: 6px; border-radius: 3px; display: inline-block; }
    body.sp-panel-open .wind-panel { display: none !important; }
    @media (max-width: 768px) {
      .wind-panel { bottom: 195px; width: 270px; padding: 6px 8px; font-size: 10px; }
    }`;
  document.head.appendChild(css);

  // ---------- data ----------
  async function loadCatalogue() {
    const r = await fetch(BASE + INDEX + "?v=" + Date.now());
    if (!r.ok) throw new Error("wind index " + r.status);
    const idx = await r.json();
    return (idx.entries || []).map(e => ({ t: Date.parse(e.t), run: Date.parse(e.run), lead: e.lead, path: e.path,
                                           adjust: e.adjust || { kind: "none" } }))
                              .sort((a, b) => a.t - b.t);
  }

  const snapCache = new Map();   // path -> Promise<snapshot>
  function loadSnapshot(entry) {
    if (!snapCache.has(entry.path)) {
      const p = (async () => {
        const r = await fetch(BASE + entry.path);
        if (!r.ok) throw new Error("wind file " + r.status);
        const d = await r.json();
        if (!d.meta || !d.meta.grid_version) throw new Error("old-layout wind file - refusing to draw it");
        const toF32 = a => Float32Array.from(a, x => (x === null ? NaN : x));
        return { ...entry, grid: d.grid, u: toF32(d.u), v: toF32(d.v) };
      })();
      snapCache.set(entry.path, p);
      p.catch(() => snapCache.delete(entry.path));
    }
    return snapCache.get(entry.path);
  }

  function sampleSnap(s, lat, lon) {
    const g = s.grid, fi = (lon - g.lo1) / g.dx, fj = (g.la1 - lat) / g.dy;
    if (!(fi >= 0 && fj >= 0 && fi < g.nx - 1 && fj < g.ny - 1)) return null;
    const i = fi | 0, j = fj | 0, di = fi - i, dj = fj - j, k = j * g.nx + i;
    const bl = a => a[k] * (1 - di) * (1 - dj) + a[k + 1] * di * (1 - dj) + a[k + g.nx] * (1 - di) * dj + a[k + g.nx + 1] * di * dj;
    const u = bl(s.u), v = bl(s.v);
    return (isFinite(u) && isFinite(v)) ? { u, v } : null;
  }

  // two snapshots bracketing the chosen time, blended by real time
  function makeField(a, b, t) {
    const w = (b && b.t > a.t) ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    return {
      t, a, b, w,
      sample(lat, lon) {
        const x = sampleSnap(a, lat, lon);
        if (!b || w === 0) return x;
        const y = sampleSnap(b, lat, lon);
        if (!x || !y) return x || y;
        return { u: x.u * (1 - w) + y.u * w, v: x.v * (1 - w) + y.v * w };
      }
    };
  }

  // ---------- panel: status, forecast bar, legend ----------
  function buildPanel(map) {
    const el = L.DomUtil.create("div", "wind-panel", map.getContainer());
    el.style.display = "none";
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
    el.innerHTML = `
      <div class="wind-panel-title">Wind &ndash; now and forecast</div>
      <div class="wind-panel-status">Loading wind&hellip;</div>
      <div class="wind-panel-when">Now</div>
      <div class="wind-panel-row">
        <button type="button" class="wp-play" disabled aria-label="Play the forecast">&#9654; Play</button>
        <input class="wind-panel-slider" type="range" min="0" max="0" step="1" value="0" disabled aria-label="Forecast time" />
        <button type="button" class="wp-now" disabled>Now</button>
      </div>
      <div class="wind-panel-ends"><span style="margin-left:62px">now</span><span class="wp-last"></span></div>
      <div class="wind-panel-legend">0 <i style="background:linear-gradient(90deg,${SHADES.join(",")})"></i>
        ${Math.round(VMAX * 3.6)}+ km/h</div>`;
    return {
      el,
      status: el.querySelector(".wind-panel-status"),
      when: el.querySelector(".wind-panel-when"),
      slider: el.querySelector(".wind-panel-slider"),
      play: el.querySelector(".wp-play"),
      nowBtn: el.querySelector(".wp-now"),
      last: el.querySelector(".wp-last")
    };
  }

  // ---------- the layer ----------
  const WindAnimLayer = L.Layer.extend({
    onAdd(m) {
      this._map = m;
      this._canvas = L.DomUtil.create("canvas", "leaflet-zoom-hide");
      this._canvas.style.pointerEvents = "none";
      // above the AQHI grid (overlayPane 400), below PurpleAir (sensorPane 440) and stations (450)
      if (!m.getPane("windAnim")) m.createPane("windAnim").style.zIndex = 430;
      m.getPane("windAnim").style.pointerEvents = "none";
      m.getPane("windAnim").appendChild(this._canvas);
      this._ctx = this._canvas.getContext("2d");
      m.on("movestart zoomstart", this._pause, this);
      m.on("moveend zoomend resize", this._reset, this);
      if (!this._ui) this._initUI(m);
      this._onSat = false;
      m.on("baselayerchange", this._baseChange, this);
      this._ui.el.style.display = "block";
      this._reset();
      this._refresh();
      this._timers = [
        setInterval(() => this._refresh(), 10 * 60e3),     // the index is rebuilt hourly
        setInterval(() => { if (this._following && this._catalogue.length) this._showTime(Date.now()); }, 60e3)
      ];
    },
    onRemove(m) {
      m.off("movestart zoomstart", this._pause, this);
      m.off("moveend zoomend resize", this._reset, this);
      m.off("baselayerchange", this._baseChange, this);
      cancelAnimationFrame(this._raf); this._raf = null;
      this._timers.forEach(clearInterval);
      this._stopPlay();
      this._canvas.remove();
      this._ui.el.style.display = "none";
    },

    _initUI(m) {
      this._ui = buildPanel(m);
      this._catalogue = []; this._hours = []; this._following = true; this._field = null; this._playTimer = null;
      const { slider, nowBtn, play } = this._ui;
      slider.addEventListener("input", () => { this._stopPlay(); this._go(Number(slider.value)); });
      nowBtn.addEventListener("click", () => { this._stopPlay(); this._go(0); });
      play.addEventListener("click", () => (this._playTimer ? this._stopPlay() : this._startPlay()));
    },

    _go(i) {
      this._ui.slider.value = i;
      this._following = i === 0;
      return this._showTime(this._following ? Date.now() : this._hours[i]);
    },
    _startPlay() {
      const ui = this._ui;
      ui.play.classList.add("on"); ui.play.innerHTML = "&#10073;&#10073; Pause";
      const step = () => {
        const n = this._hours.length; if (n < 2) return;
        const i = (Number(ui.slider.value) + 1) % n;
        this._go(i);
        this._playTimer = setTimeout(step, i === n - 1 ? PLAY_MS * 2 : PLAY_MS);   // hold on the last hour
      };
      this._playTimer = setTimeout(step, 200);
    },
    _stopPlay() {
      if (!this._playTimer) return;
      clearTimeout(this._playTimer); this._playTimer = null;
      this._ui.play.classList.remove("on"); this._ui.play.innerHTML = "&#9654; Play";
    },

    async _refresh() {
      const ui = this._ui;
      try {
        this._catalogue = await loadCatalogue();
        if (!this._catalogue.length) throw new Error("no wind files available");
        const now = Date.now(), first = Math.ceil(now / HOUR) * HOUR;
        const last = this._catalogue[this._catalogue.length - 1].t;
        this._hours = [now];
        for (let t = first; t <= last; t += HOUR) this._hours.push(t);
        ui.slider.max = this._hours.length - 1;
        ui.slider.disabled = ui.nowBtn.disabled = ui.play.disabled = this._hours.length < 2;
        ui.last.textContent = `+${Math.round((last - now) / HOUR)} h`;
        if (this._following) { ui.slider.value = 0; await this._showTime(now); }
        else if (Number(ui.slider.value) > this._hours.length - 1) await this._go(this._hours.length - 1);
      } catch (e) {
        ui.status.innerHTML = `<b style="color:#b91c1c">Wind unavailable right now</b>`;
        console.error("Animated winds:", e);
      }
    },

    async _showTime(t) {
      const cat = this._catalogue, ui = this._ui;
      if (!cat.length) return;
      let i = cat.findIndex(e => e.t > t);
      if (i === -1) i = cat.length;
      const a = cat[Math.max(0, i - 1)], b = cat[Math.min(cat.length - 1, i)];
      const [sa, sb] = await Promise.all([loadSnapshot(a), loadSnapshot(b)]);
      this._field = makeField(sa, sb, t);
      const src = this._field.w < 0.5 ? sa : sb;
      const adj = src.adjust || { kind: "none" };
      const how = adj.kind === "stations" ? `matched to ${adj.n} weather stations`
        : adj.kind === "fading" && adj.weight >= 0.2 ? "forecast, partly matched to stations"
        : "forecast";
      ui.status.textContent = `Environment Canada HRDPS model, ${how}`;
      const ahead = Math.round((t - Date.now()) / HOUR);
      ui.when.textContent = this._following ? `Now · ${fmtLocal(t)} MDT` : `${fmtLocal(t)} MDT (+${ahead} h)`;
    },

    _baseChange(e) { this._onSat = /satellite|imagery/i.test(e.name || ""); },

    _pause() {
      cancelAnimationFrame(this._raf); this._raf = null;
      this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    },
    _reset() {
      const m = this._map, size = m.getSize(), dpr = window.devicePixelRatio || 1;
      L.DomUtil.setPosition(this._canvas, m.containerPointToLayerPoint([0, 0]));
      this._canvas.width = size.x * dpr; this._canvas.height = size.y * dpr;
      this._canvas.style.width = size.x + "px"; this._canvas.style.height = size.y + "px";
      this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._w = size.x; this._h = size.y;
      const n = Math.min(2200, Math.round(size.x * size.y / 520));
      this._particles = Array.from({ length: n }, () => this._spawn(true));
      if (!this._raf) this._loop();
    },
    _spawn(randomAge) {
      const x = Math.random() * this._w, y = Math.random() * this._h;
      const ll = this._map.containerPointToLatLng([x, y]);
      return { lat: ll.lat, lng: ll.lng, age: randomAge ? (Math.random() * MAX_AGE) | 0 : 0, xs: [x], ys: [y], sp: 0 };
    },
    _loop() {
      this._raf = requestAnimationFrame(() => this._loop());
      const field = this._field;
      if (!field) return;
      const ctx = this._ctx, m = this._map;
      const paths = Array.from({ length: NALPHA * NCOL }, () => new Path2D());
      for (const p of this._particles) {
        if (++p.age > MAX_AGE) { Object.assign(p, this._spawn(false)); continue; }
        const w = field.sample(p.lat, p.lng);
        if (w) {
          // earth-relative wind on a conformal (Web Mercator) map: east = +x, north = -y
          const ax = p.xs[p.xs.length - 1], ay = p.ys[p.ys.length - 1];
          const bx = ax + w.u * PX_PER_MS, by = ay - w.v * PX_PER_MS;
          if (bx < 0 || by < 0 || bx > this._w || by > this._h) { Object.assign(p, this._spawn(false)); continue; }
          const ll = m.containerPointToLatLng([bx, by]); p.lat = ll.lat; p.lng = ll.lng;
          if (p.age % STRIDE === 0 || p.xs.length < 2) { p.xs.push(bx); p.ys.push(by); }
          else { p.xs[p.xs.length - 1] = bx; p.ys[p.ys.length - 1] = by; }
          p.sp = Math.hypot(w.u, w.v);
          if (p.xs.length > TRAIL) { p.xs.shift(); p.ys.shift(); }
        } else if (p.xs.length < 2) { Object.assign(p, this._spawn(false)); continue; }
        else { p.xs.shift(); p.ys.shift(); }          // left the wind area: let the tail run out
        const n = p.xs.length, ci = shadeOf(p.sp);
        const life = Math.min(1, p.age / 8, (MAX_AGE - p.age) / 12);
        for (let seg = 0; seg < NALPHA; seg++) {
          const i0 = Math.floor(seg * (n - 1) / NALPHA), i1 = Math.floor((seg + 1) * (n - 1) / NALPHA);
          if (i1 <= i0) continue;
          const a = Math.max(0, Math.min(NALPHA - 1, Math.round(seg * life))), path = paths[a * NCOL + ci];
          path.moveTo(p.xs[i0], p.ys[i0]);
          for (let k = i0 + 1; k <= i1; k++) path.lineTo(p.xs[k], p.ys[k]);
        }
      }
      ctx.clearRect(0, 0, this._w, this._h);
      ctx.lineWidth = 1.5; ctx.lineCap = "butt"; ctx.lineJoin = "miter";
      const shades = this._onSat ? SHADES_SAT : SHADES;
      for (let a = 0; a < NALPHA; a++) {
        ctx.globalAlpha = [0.45, 0.7, 0.95][a];
        for (let c = 0; c < NCOL; c++) { ctx.strokeStyle = shades[c]; ctx.stroke(paths[a * NCOL + c]); }
      }
      ctx.globalAlpha = 1;
    }
  });

  // ---------- wait for LiveMap's map + layer menu, then add the layer ----------
  function whenReady(fn) { if (window.map && window._layerControl) fn(); else setTimeout(() => whenReady(fn), 300); }
  whenReady(() => {
    const layer = new WindAnimLayer();
    window._layerControl.addOverlay(layer, "Wind animation (HRDPS model)");
    if (window.APP_CONFIG?.windAnimOn !== false) layer.addTo(window.map);
    window.windAnimLayer = layer;
  });
})();
