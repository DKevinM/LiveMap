// =======================
// story_panel.js
// =======================
// Station "Full story" panel. Built on ACA_demo.html (2026-10-31); live on the
// members' ACA.html + WCAS.html since 2026-11-20 (not the public maps).
// Clicking a station slides this panel in from the side (bottom sheet on a
// phone) instead of opening the popup; "Back to map" slides it away and
// leaves a tab on the edge to pull it back. It answers, in order: is the air
// OK right now, why, which way is it heading, and can I trust the reading.
// It also draws where the air came from on the map (a back-trace from the
// station's own hourly winds) and lists the NPRI facilities and PurpleAir
// sensors along that path.
//
// 2026-11-13: readings laid out like the Howe Sound Environment page - dials
// against the Alberta objective, a "now / 24 h avg / low-high / trend" table
// with the weather rows, and a 5-week daily calendar with a pollutant picker
// (daily summaries from /data/station_daily.json, built hourly on dklinux by
// scripts/station_daily/build_station_daily.py).
//
// Page-local: nothing in the shared js/ files calls this, and it only reads
// globals they already set (map, AppData, NPRI_FC, stationSmokeForecast,
// getAQHIColor, getAQHIHealthMessage, findClosestCommunityName).

(function () {

  // last6h.csv actually holds ~24 h of hourly rows per station
  const HIST_URL = "https://status.krmenvironmental.com/data/last6h.csv";
  const HIST_MAX_AGE_MS = 10 * 60 * 1000;

  // same conversion data.js applies before anything is drawn
  const PPM_TO_PPB = [
    "Ozone", "Nitrogen Dioxide", "Nitric Oxide", "Total Oxides of Nitrogen",
    "Sulphur Dioxide", "Hydrogen Sulphide", "Total Reduced Sulphur"
  ];

  const DAILY_URL = "https://status.krmenvironmental.com/data/station_daily.json";
  const COMMUNITY_URL = "https://data.environment.alberta.ca/EdwServices/aqhi/odata/CommunityAqhis?$format=json";

  // Alberta limits the dials and calendar are read against: [value, name,
  // averaging]. All 1-hour, the same ones gauges.js uses. PM2.5 is the 1-hour
  // guideline (AAAQG, 80 µg/m³), not the 24-hour objective - Kevin's rule from
  // the Spruce Grove page 2026-11-22, brought back here 2026-11-23 (it had
  // only been changed in that copy). AAAQO = objective, AAAQG = guideline.
  // Alberta has no 8-hour ozone objective.
  const GUIDE = {
    "Fine Particulate Matter": [80, "AAAQG", "1-hour"],
    "Ozone": [76, "AAAQO", "1-hour"],
    "Nitrogen Dioxide": [159, "AAAQO", "1-hour"],
    "Sulphur Dioxide": [172, "AAAQO", "1-hour"],
    "Hydrogen Sulphide": [10, "AAAQO", "1-hour"],
    "Total Reduced Sulphur": [5, "AAAQG", "30-minute"],   // 30-min clock average (July 2024); compared hourly, see halfHour
    "Carbon Monoxide": [13, "AAAQO", "1-hour"]
  };
  const gword = g => g[1] === "AAAQG" ? "guideline" : "objective";
  // A 30-minute limit read off hourly data (TRS; 2026-11-23, Kevin): an hour above it means at least one half-hour
  // was above it, but a half-hour can be above it without the hour being.
  const halfHour = g => !!g && g[2] === "30-minute";

  // dial full-scale when there's no objective (otherwise twice the objective,
  // so the tick sits at the top of the dial - same as the Howe Sound page)
  const NO_OBJ_MAX = { "Nitric Oxide": 100, "Total Oxides of Nitrogen": 200 };

  // [parameter, short label, unit, plain-language note, daily-file key]
  const POLLUTANTS = [
    ["Fine Particulate Matter", "PM2.5", "µg/m³", "fine particles (smoke, dust)", "PM25"],
    ["Ozone", "O₃", "ppb", "ozone", "O3"],
    ["Nitrogen Dioxide", "NO₂", "ppb", "nitrogen dioxide (traffic, engines, burning)", "NO2"],
    ["Sulphur Dioxide", "SO₂", "ppb", "", "SO2"],
    ["Hydrogen Sulphide", "H₂S", "ppb", "", "H2S"],
    ["Total Reduced Sulphur", "TRS", "ppb", "", "TRS"],
    ["Nitric Oxide", "NO", "ppb", "", "NO"],
    ["Total Oxides of Nitrogen", "NOx", "ppb", "", "NOX"],
    ["Carbon Monoxide", "CO", "ppm", "", "CO"]
  ];

  // Calendar: each pollutant uses the daily measure that matches its
  // 1-hour limit (highest hour each day), on one fixed scale
  // so stations can be compared. i = position in the daily file's
  // [average, highest hour, hours]. When the last cut is the objective, a
  // red band sits above it; lists with 4 cuts have no objective and no red.
  const CAL = {
    AQHI: { i: 1, what: "highest hour each day" },
    PM25: { i: 1, what: "highest hour each day", cuts: [5, 10, 20, 40, 80] },
    O3: { i: 1, what: "highest hour each day", cuts: [20, 30, 40, 50, 76] },
    NO2: { i: 1, what: "highest hour each day", cuts: [10, 20, 40, 80, 159] },
    SO2: { i: 1, what: "highest hour each day", cuts: [1, 2, 5, 20, 172] },
    H2S: { i: 1, what: "highest hour each day", cuts: [1, 2, 4, 7, 10] },
    TRS: { i: 1, what: "highest hour each day", cuts: [0.5, 1, 2, 3.5, 5] },
    NO: { i: 1, what: "highest hour each day", cuts: [5, 15, 30, 60] },
    NOX: { i: 1, what: "highest hour each day", cuts: [10, 30, 60, 120] },
    CO: { i: 1, what: "highest hour each day", cuts: [0.2, 0.5, 1, 3, 13] }
  };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const DRIVER_WORDS = {
    "PM2.5": "fine particles (smoke, dust)",
    "O3": "ozone",
    "NO2": "nitrogen dioxide (traffic, engines, burning)"
  };

  const CORRIDOR_KM = 3;   // how close to the air path counts as "along it"
  const CALM_KM = 5;       // radius used when the air barely moved
  const TRACE_HOURS = 12;

  // ---------- small helpers ----------

  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  function distKm(aLat, aLon, bLat, bLon) {
    const dLat = toRad(bLat - aLat), dLon = toRad(bLon - aLon);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }

  function bearing(aLat, aLon, bLat, bLon) {
    const y = Math.sin(toRad(bLon - aLon)) * Math.cos(toRad(bLat));
    const x = Math.cos(toRad(aLat)) * Math.sin(toRad(bLat)) -
      Math.sin(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLon - aLon));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  function move(lat, lon, brg, km) {
    const d = km / 6371, b = toRad(brg), p1 = toRad(lat), l1 = toRad(lon);
    const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
    const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2));
    return [toDeg(p2), toDeg(l2)];
  }

  function cardinal(deg) {
    const n = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return n[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  }

  // Alberta is locked to UTC-6 (no fall-back this year) - America/Regina is
  // permanently UTC-6, so it stays right whatever the browser's tz data says.
  function fmtTime(t) {
    return t.toLocaleTimeString("en-CA", { timeZone: "America/Regina", hour: "numeric", minute: "2-digit" });
  }
  function localHour(t) {
    return Number(t.toLocaleString("en-CA", { timeZone: "America/Regina", hour: "numeric", hour12: false })) % 24;
  }

  function fmtNum(v, unit) {
    if (v == null) return "—";
    const d = unit === "ppm" ? 2 : (Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0);
    return Number(v).toFixed(d);
  }

  function median(a) {
    const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y);
    if (!s.length) return null;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }

  // ---------- history (24 h) ----------

  let histP = null, histAt = 0;
  function loadHistory() {
    if (histP && Date.now() - histAt < HIST_MAX_AGE_MS) return histP;
    histAt = Date.now();
    histP = fetch(`${HIST_URL}?t=${Date.now()}`, { cache: "no-store" })
      .then(r => r.text())
      .then(text => {
        const lines = text.trim().split("\n");
        const head = lines.shift().split(",");
        const iV = head.indexOf("Value"), iS = head.indexOf("StationName"),
          iP = head.indexOf("ParameterName"), iT = head.indexOf("ReadingDate");
        const out = {};
        lines.forEach(line => {
          const c = line.split(",");
          const p = (c[iP] || "").trim() || "AQHI";
          if (p.startsWith("AQHI") && window.NO_AQHI_STATIONS?.has((c[iS] || "").trim())) return;   // see data.js
          let v = parseFloat(c[iV]);
          if (!isFinite(v)) v = null;
          if (v !== null && PPM_TO_PPB.includes(p)) v *= 1000;
          const t = new Date(c[iT]);
          if (isNaN(t)) return;
          const st = (out[c[iS]] = out[c[iS]] || {});
          (st[p] = st[p] || []).push({ t, v });
        });
        return out;
      });
    histP.catch(() => { histP = null; });
    return histP;
  }

  // ---------- 5-week daily summaries + community forecast ----------

  let dailyP = null, dailyAt = 0;
  function loadDaily() {
    if (dailyP && Date.now() - dailyAt < HIST_MAX_AGE_MS) return dailyP;
    dailyAt = Date.now();
    dailyP = fetch(`${DAILY_URL}?t=${Date.now()}`, { cache: "no-store" }).then(r => r.json());
    dailyP.catch(() => { dailyP = null; });
    return dailyP;
  }

  let commP = null;
  async function communityForecast(st) {
    if (typeof window.findClosestCommunityName !== "function") return null;
    commP = commP || fetch(COMMUNITY_URL).then(r => r.json());
    commP.catch(() => { commP = null; });
    const [name, data] = await Promise.all([window.findClosestCommunityName(st.lat, st.lon), commP]);
    const m = (data?.value || []).find(c => c.CommunityName?.toLowerCase() === name?.toLowerCase());
    return m ? { name: m.CommunityName, today: m.ForecastToday, tonight: m.ForecastTonight, tomorrow: m.ForecastTomorrow } : null;
  }

  // Alberta local calendar day (UTC-6 all year now; America/Regina is fixed
  // UTC-6, so this stays right whatever the browser's tz data says)
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Regina", year: "numeric", month: "2-digit", day: "2-digit" });

  // One value per hour for the 24 hours ending at `end` (oldest first);
  // missing hours stay null so gaps show as gaps.
  function hourly(series, end) {
    const byHour = {};
    (series || []).forEach(r => {
      const k = Math.round(r.t.getTime() / 3600000);
      if (r.v != null || !(k in byHour)) byHour[k] = r.v;
    });
    const endK = Math.round(end.getTime() / 3600000);
    const out = [];
    for (let k = endK - 23; k <= endK; k++) out.push(k in byHour ? byHour[k] : null);
    return out;
  }

  function lastValid(arr) {
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return { v: arr[i], i };
    return null;
  }

  // ---------- AQHI maths ----------

  function aqhiRaw(no2, o3, pm) {
    if (no2 == null || o3 == null || pm == null) return null;
    return (1000 / 10.4) * (Math.exp(0.000871 * no2) - 1 + Math.exp(0.000537 * o3) - 1 + Math.exp(0.000487 * pm) - 1);
  }

  function drivers(no2, o3, pm) {
    if (no2 == null || o3 == null || pm == null) return null;
    const t = { NO2: Math.exp(0.000871 * no2) - 1, O3: Math.exp(0.000537 * o3) - 1, "PM2.5": Math.exp(0.000487 * pm) - 1 };
    const sum = t.NO2 + t.O3 + t["PM2.5"];
    if (!(sum > 0)) return null;
    return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, 100 * v / sum]));
  }

  // 3-hour mean ending at index i (AQHI uses 3 h averages)
  function mean3(arr, i) {
    const a = [arr[i], arr[i - 1], arr[i - 2]].filter(v => v != null);
    return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  }

  // ---------- SVG bits ----------

  // Howe Sound-style 24 h trend: thin line, lowest hour green, highest red,
  // latest dark. Scaled to its own range, so it shows shape, not level.
  function trend24(vals, w = 76, h = 22) {
    const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
    if (pts.length < 2) return "";
    const lo = Math.min(...pts.map(p => p[1])), hi = Math.max(...pts.map(p => p[1]));
    const X = i => 3 + i / (vals.length - 1) * (w - 6);
    const Y = v => h - 4 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * (h - 8);
    // break the line over gaps of 2+ hours
    let d = "", prev = null;
    pts.forEach(([i, v]) => { d += `${prev == null || i - prev > 2 ? "M" : "L"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`; prev = i; });
    const dot = (p, c) => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.3" fill="${c}"/>`;
    const pl = pts.find(p => p[1] === lo), ph = [...pts].reverse().find(p => p[1] === hi), last = pts[pts.length - 1];
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--sp-muted)" stroke-width="1.4"/>${dot(pl, "var(--sp-lo)")}${dot(ph, "var(--sp-hi)")}${dot(last, "var(--sp-ink)")}</svg>`;
  }

  // The gauges.html dial as drawn on the Howe Sound page: 270° sweep, green
  // to half the objective, yellow to it, dark tick at it, red above; plain
  // blue when there's no objective. Inline SVG, so no ECharts here.
  function miniGauge(p, v, size = 84) {
    const g = GUIDE[p]?.[0], max = g ? 2 * g : NO_OBJ_MAX[p] || 100;
    const c = size / 2, r = size / 2 - 7;
    const pt = (f, rr) => {
      const a = toRad(-135 + 270 * Math.min(1, Math.max(0, f)));
      return [(c + rr * Math.sin(a)).toFixed(1), (c - rr * Math.cos(a)).toFixed(1)];
    };
    const arc = (f0, f1, col) => {
      const [x0, y0] = pt(f0, r), [x1, y1] = pt(f1, r);
      return `<path d="M${x0},${y0} A${r},${r} 0 ${(f1 - f0) * 270 > 180 ? 1 : 0} 1 ${x1},${y1}" stroke="${col}" stroke-width="8" fill="none"/>`;
    };
    let bands;
    if (g) {
      const gf = g / max;
      bands = arc(0, 0.5 * gf, "#00c853") + arc(0.5 * gf, gf, "#ffd600") + arc(gf, 1, "#d50000");
      const [a0, b0] = pt(gf, r - 6), [a1, b1] = pt(gf, r + 6);
      bands += `<line x1="${a0}" y1="${b0}" x2="${a1}" y2="${b1}" stroke="var(--sp-ink)" stroke-width="2.5"/>`;
    } else {
      bands = arc(0, 1, "#1976d2");
    }
    const needle = v == null ? "" : (() => {
      const [nx, ny] = pt(v / max, r - 10);
      return `<line x1="${c}" y1="${c}" x2="${nx}" y2="${ny}" stroke="var(--sp-ink)" stroke-width="3" stroke-linecap="round"/>
        <circle cx="${c}" cy="${c}" r="4" fill="var(--sp-ink)"/>`;
    })();
    const [lx, ly] = pt(0, r + 1), [hx, hy] = pt(1, r + 1);
    return `<svg class="sp-gauge" viewBox="0 0 ${size} ${size - 8}" role="img" aria-label="${v == null ? "no reading" : fmtNum(v)} on a 0-${max} scale">
      ${bands}${needle}
      <text x="${lx}" y="${+ly + 9}" text-anchor="middle">0</text>
      <text x="${hx}" y="${+hy + 9}" text-anchor="middle">${max}</text>
    </svg>`;
  }

  function aqhiStrip(vals, end) {
    const cells = vals.map((v, i) => {
      const t = new Date(end.getTime() - (23 - i) * 3600000);
      const label = v == null ? "no reading" : (v > 10 ? "10+" : Math.round(v));
      const col = v == null ? "var(--sp-gap)" : window.getAQHIColor(v > 10 ? "10+" : Math.round(v));
      return `<span style="background:${col}" title="${fmtTime(t)}: AQHI ${label}"></span>`;
    }).join("");
    return `<div class="sp-strip">${cells}</div>
      <div class="sp-strip-axis"><span>24 h ago</span><span>12 h ago</span><span>now</span></div>`;
  }

  // ---------- 5-week calendar ----------

  const calIdx = (v, cuts) => { const k = cuts.findIndex((b, i) => i === 4 ? v <= b : v < b); return k < 0 ? cuts.length : k; };
  const calKey = c => [`under ${c[0]}`, ...c.slice(1).map((b, i) => `${c[i]}–${b}`), `over ${c[c.length - 1]}`];
  const aqhiInk = n => [1, 4, 5, 6, 7].includes(n) ? "#1d2733" : "#fff";

  // [key, label, unit, objective] for each calendar choice this station has
  function calOptions(days) {
    const opts = [["AQHI", "AQHI", "", null]];
    POLLUTANTS.forEach(([p, short, unit, , k]) => opts.push([k, short, unit, GUIDE[p] || null]));
    return opts.filter(([k]) => days.some(o => o.p?.[k]?.[CAL[k].i] != null));
  }

  let calPick = "PM25";
  try { calPick = sessionStorage.getItem("spCal") || calPick; } catch (e) {}

  function calendar(days, opt, stName) {
    const [k, label, unit, guide] = opt, C = CAL[k], by = {};
    days.forEach(o => { by[o.d] = o; });
    const today = dayFmt.format(Date.now()), [y, m, d] = today.split("-").map(Number);
    const t0 = Date.UTC(y, m - 1, d), start = t0 - (new Date(t0).getUTCDay() + 28) * 864e5;
    let cells = `<span></span>${"SMTWTFS".split("").map(c => `<span class="lab">${c}</span>`).join("")}`;
    for (let r = 0; r < 5; r++) {
      const ws = new Date(start + r * 7 * 864e5);
      let lab = r === 0 ? ws.getUTCMonth() : -1;
      for (let q = 0; q < 7; q++) { const dt = new Date(+ws + q * 864e5); if (dt.getUTCDate() === 1) lab = dt.getUTCMonth(); }
      cells += `<span class="lab">${lab < 0 ? "" : MON[lab]}</span>`;
      for (let q = 0; q < 7; q++) {
        const t = +ws + q * 864e5, dt = new Date(t), key = dt.toISOString().slice(0, 10), o = by[key], isT = t === t0, P = o?.p?.[k];
        if (t > t0) { cells += `<span></span>`; continue; }
        const name = `${WDAY[dt.getUTCDay()]} ${MON[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
        const ok = P && P[C.i] != null && (isT ? P[2] >= 6 : P[2] >= 18);
        if (!ok) {
          cells += `<span class="none${isT ? " today" : ""}" data-tip="<b>${name}</b><br>${o ? `Not enough readings (${P ? P[2] : 0} of 24 hours)` : "No data"}">${dt.getUTCDate()}</span>`;
          continue;
        }
        let style;
        if (k === "AQHI") {
          const n = Math.min(11, Math.max(1, Math.round(P[1])));
          style = `background:${window.getAQHIColor(n > 10 ? "10+" : n)};color:${aqhiInk(n)}`;
        } else {
          const c = calIdx(P[C.i], C.cuts);
          style = `background:var(--sp-c${c});color:var(--sp-ci${c})`;
        }
        const wx = [o.temp != null ? `${o.temp} °C` : "", o.spd != null ? `wind ${o.spd} km/h${o.dir != null ? ` from ${cardinal(o.dir)}` : ""}` : ""].filter(Boolean).join(", ");
        const vals = k === "AQHI"
          ? `Highest AQHI: ${P[1] > 10 ? "10+" : P[1]}`
          : `Daily average: ${P[0]} ${unit}<br>Highest hour: ${P[1]} ${unit}`;
        cells += `<span class="${isT ? "today" : ""}" style="${style}" data-tip="<b>${name}</b>${isT ? ` (so far, ${P[2]} hours)` : ""}<br>${vals}${wx ? `<br>${wx}` : ""}">${dt.getUTCDate()}</span>`;
      }
    }

    const full = days.filter(o => o.d !== today && o.p?.[k]?.[C.i] != null && o.p[k][2] >= 18);
    let txt = "";
    if (full.length) {
      const hi = full.reduce((b, o) => o.p[k][C.i] > b.p[k][C.i] ? o : b), [, hm, hd] = hi.d.split("-").map(Number);
      const hiV = k === "AQHI" && hi.p[k][C.i] > 10 ? "10+" : hi.p[k][C.i];
      if (k === "AQHI") {
        const mod = full.filter(o => o.p[k][1] >= 4).length;
        txt = `<p>Past ${full.length} full days: highest ${MON[hm - 1]} ${hd} at ${hiV}. ${mod === 0 ? "Every day stayed low risk (1–3)." : `${mod === 1 ? "1 day" : mod + " days"} reached moderate risk (4+) for at least an hour.`}</p>`;
      } else {
        const over = guide ? full.filter(o => o.p[k][C.i] > guide[0]).length : 0;
        txt = `<p>Past ${full.length} full days: highest ${MON[hm - 1]} ${hd} at ${hiV} ${unit}. ${!guide ? "Alberta has no objective for this."
          : halfHour(guide)
            ? `${over === 0 ? "No hour was" : over === 1 ? "1 day had an hour" : over + " days had an hour"} above ${guide[0]} ${unit}, the Alberta 30-minute ${gword(guide)} (${guide[1]})${over ? ", so the guideline was exceeded" : ""}. These are hourly averages, so a single half-hour above it may not show.`
            : `${over === 0 ? "No days" : over === 1 ? "1 day" : over + " days"} above the Alberta ${guide[2]} ${gword(guide)} of ${guide[0]} ${unit} (${guide[1]}).`}</p>`;
      }
    }
    const key = k === "AQHI"
      ? `<div class="sp-calkey">${[[1, "1–3 low"], [5, "4–6 moderate"], [8, "7–10 high"], [11, "10+ very high"]].map(([n, l]) => `<span><i style="background:${window.getAQHIColor(n > 10 ? "10+" : n)}"></i>${l}</span>`).join("")}</div>`
      : `<div class="sp-calkey">${calKey(C.cuts).map((l, i) => `<span><i style="background:var(--sp-c${i})"></i>${l}</span>`).join("")}</div>`;
    return `<div class="sp-calwrap">
        <div class="sp-cal" role="img" aria-label="Calendar of ${label}, ${C.what}, for ${esc(stName)}">${cells}</div>
        <div class="sp-calinfo"><h4>${label}: ${C.what}</h4>${txt}${key}
          <p class="sp-note">${unit ? unit + ". " : ""}Outlined: today so far. Grey: not enough readings.</p></div>
      </div>`;
  }

  function calBox(days, stName) {
    const opts = calOptions(days);
    if (!opts.length) return `<p class="sp-small">No daily history for this station yet.</p>`;
    const cur = opts.find(o => o[0] === calPick) || opts.find(o => o[0] === "PM25") || opts[0];
    return `<div class="sp-calpick" role="group" aria-label="Choose what the calendar shows">
        ${opts.map(o => `<button type="button" data-k="${o[0]}" aria-pressed="${o[0] === cur[0]}">${o[1]}</button>`).join("")}
      </div>
      <div class="sp-calbody">${calendar(days, cur, stName)}</div>`;
  }

  // ---------- where the air came from ----------

  // Walk back one hour at a time: the wind direction is where the air came
  // FROM, so an hour earlier the air was `speed` km away in that direction.
  function backTrace(lat, lon, ws, wd) {
    const pts = [[lat, lon]];
    let cur = [lat, lon];
    for (let i = 0; i < TRACE_HOURS; i++) {
      const s = ws[ws.length - 1 - i], d = wd[wd.length - 1 - i];
      if (s == null || d == null) break;
      cur = move(cur[0], cur[1], d, s);
      pts.push(cur);
    }
    return pts;
  }

  function pathLengthKm(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += distKm(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    return L;
  }

  function nearPath(lat, lon, pts, calm) {
    if (calm) return distKm(lat, lon, pts[0][0], pts[0][1]) <= CALM_KM;
    if (distKm(lat, lon, pts[0][0], pts[0][1]) <= CORRIDOR_KM) return true;
    if (window.turf) {
      const line = turf.lineString(pts.map(p => [p[1], p[0]]));
      return turf.pointToLineDistance(turf.point([lon, lat]), line, { units: "kilometers" }) <= CORRIDOR_KM;
    }
    return pts.some(p => distKm(lat, lon, p[0], p[1]) <= CORRIDOR_KM);
  }

  function npriAlong(pts, calm) {
    const seen = {};
    (window.NPRI_FC?.features || []).forEach(f => {
      const p = f.properties || {}, c = f.geometry?.coordinates;
      if (!c) return;
      const prev = seen[p.NpriID];
      if (prev && prev.p.ReportYear >= p.ReportYear) return;
      seen[p.NpriID] = { p, lat: c[1], lon: c[0] };
    });
    const [sLat, sLon] = pts[0];
    // cheap box filter before the per-point line distance
    const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
    const padDeg = (calm ? CALM_KM : CORRIDOR_KM) / 70 + 0.02;
    const box = [Math.min(...lats) - padDeg, Math.max(...lats) + padDeg, Math.min(...lons) - padDeg * 1.7, Math.max(...lons) + padDeg * 1.7];
    return Object.values(seen)
      .filter(f => f.lat >= box[0] && f.lat <= box[1] && f.lon >= box[2] && f.lon <= box[3])
      .filter(f => nearPath(f.lat, f.lon, pts, calm))
      .map(f => ({ ...f, km: distKm(sLat, sLon, f.lat, f.lon), dir: cardinal(bearing(sLat, sLon, f.lat, f.lon)) }))
      .sort((a, b) => a.km - b.km);
  }

  // ---------- trust checks ----------

  function trustChecks(name, st, hist, end, series) {
    const out = [];
    const ageH = (Date.now() - end.getTime()) / 3600000;
    out.push(ageH <= 2
      ? ["ok", `Latest reading ${fmtTime(end)} (${ageH < 1 ? "under an hour" : Math.floor(ageH) + " h"} ago).`]
      : ageH <= 3
        ? ["warn", `Latest reading ${fmtTime(end)}, ${Math.floor(ageH)} h ago. A little behind.`]
        : ["bad", `Latest reading ${fmtTime(end)}, ${Math.floor(ageH)} h ago. Treat as out of date.`]);

    // hours reported for the AQHI pollutants
    const core = ["Fine Particulate Matter", "Ozone", "Nitrogen Dioxide"].filter(p => series[p]);
    // out of the hours the file actually covers (it can start <24 h back)
    if (core.length) {
      const first = Math.min(...Object.values(hist[name] || {}).flat().map(r => r.t.getTime()));
      const span = Math.min(24, Math.round((end.getTime() - first) / 3600000) + 1);
      const n = Math.min(...core.map(p => series[p].slice(-span).filter(v => v != null).length));
      out.push([n >= span - 2 ? "ok" : n >= span * 0.6 ? "warn" : "bad", `${n} of the last ${span} hours reported.`]);
    }

    // stuck readings: same non-zero value 6+ hours, or PM2.5 sitting at 0
    POLLUTANTS.forEach(([p, short]) => {
      const a = series[p];
      if (!a) return;
      const tail = a.slice(-6);
      if (tail.some(v => v == null)) return;
      const same = tail.every(v => v === tail[0]);
      if (same && (tail[0] !== 0 || p === "Fine Particulate Matter")) {
        out.push(["warn", `${short} has read exactly ${fmtNum(tail[0])} for 6+ hours. Could be a stuck instrument.`]);
      }
    });

    // PurpleAir neighbours vs station PM2.5
    const pm = lastValid(series["Fine Particulate Matter"] || [])?.v;
    if (pm != null) {
      const near = (window.AppData?.purpleair || [])
        .map(p => ({ ...p, km: distKm(st.lat, st.lon, p.lat, p.lon) }))
        .filter(p => p.km <= 10 && isFinite(p.pm));
      if (near.length) {
        const m = median(near.map(p => p.pm));
        const agree = Math.abs(m - pm) <= Math.max(5, 0.4 * pm);
        out.push([agree ? "ok" : "warn",
          `${near.length} PurpleAir sensor${near.length > 1 ? "s" : ""} within 10 km read ${fmtNum(m)} µg/m³ (median) vs ${fmtNum(pm)} here: ${agree ? "they agree" : "they disagree, worth a look"}.`]);
      } else {
        out.push(["info", "No PurpleAir sensors within 10 km to cross-check PM2.5."]);
      }
    }

    // wind speed vs neighbouring stations (6 h means)
    const ws = series["Wind Speed"];
    if (ws) {
      const mine = median(ws.slice(-6));
      const nb = (window.AppData?.stations || [])
        .filter(s => s.stationName !== name && distKm(st.lat, st.lon, s.lat, s.lon) <= 60)
        .map(s => median(hourly(hist[s.stationName]?.["Wind Speed"], end).slice(-6)))
        .filter(v => v != null);
      const theirs = median(nb);
      if (mine != null && theirs != null && nb.length >= 2 && theirs >= 4) {
        const r = mine / theirs;
        if (r < 0.4 || r > 2.5) {
          out.push(["warn", `Wind speed here (${fmtNum(mine)} km/h) is ${r < 1 ? Math.round(1 / r) + "x lower" : Math.round(r) + "x higher"} than ${nb.length} nearby stations (${fmtNum(theirs)} km/h). Check the sensor or its units.`]);
        } else {
          out.push(["ok", `Wind speed agrees with ${nb.length} nearby stations.`]);
        }
      }
    }
    return out;
  }

  // ---------- the story ----------

  function headline(aqhi, shares, trend, wsNow, wdNow, temp, end) {
    const s = [];
    if (aqhi == null) s.push("There's no current AQHI here.");
    else if (aqhi <= 3) s.push("The air is good right now.");
    else if (aqhi <= 6) s.push("The air is moderate right now.");
    else if (aqhi <= 10) s.push("The air is poor right now.");
    else s.push("The air is very poor right now.");

    if (shares) {
      const top = Object.entries(shares).sort((a, b) => b[1] - a[1])[0];
      s.push(`Most of the AQHI comes from ${DRIVER_WORDS[top[0]]}${aqhi != null && aqhi <= 2 ? ", but all three pollutants are low" : ""}.`);
    }
    if (trend != null) {
      if (trend > 0.5) s.push("It has been rising over the last 3 hours.");
      else if (trend < -0.5) s.push("It has been easing over the last 3 hours.");
      else s.push("It has been steady over the last 3 hours.");
    }
    if (wsNow != null) {
      const h = localHour(end);
      const night = h >= 17 || h <= 10;
      if (wsNow < 5) {
        s.push(temp != null && temp < 5 && night
          ? "Winds are nearly calm and the air is cold. That can trap pollution near the ground."
          : "Winds are nearly calm, so local sources matter most.");
      } else if (wdNow != null) {
        s.push(`${wsNow < 15 ? "Light" : wsNow < 30 ? "Steady" : "Strong"} winds from the ${cardinal(wdNow)}.`);
      }
    }
    return s.join(" ");
  }

  function peakNote(series, end) {
    const notes = [];
    [["Fine Particulate Matter", "PM2.5", "µg/m³", 15], ["Nitrogen Dioxide", "NO₂", "ppb", 20], ["Ozone", "O₃", "ppb", 50]]
      .forEach(([p, short, unit, floor]) => {
        const a = series[p];
        if (!a) return;
        const now = lastValid(a)?.v;
        let pk = -Infinity, pi = -1;
        a.forEach((v, i) => { if (v != null && v > pk) { pk = v; pi = i; } });
        if (pi < 0 || now == null) return;
        if (pk >= floor && pk >= 2 * Math.max(now, 1) && pi < a.length - 1) {
          const t = new Date(end.getTime() - (23 - pi) * 3600000);
          notes.push(`${short} peaked at ${fmtNum(pk)} ${unit} around ${fmtTime(t).replace(/\.$/, "")}.`);
        }
      });
    return notes;
  }

  // ---------- panel ----------

  let panel, tab, tip, mapLayer, current = null, currentDays = [];

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("aside");
    panel.id = "story-panel";
    panel.setAttribute("aria-label", "Station full story");
    document.body.appendChild(panel);

    // the tab left on the edge after "Back to map" - tap to pull the panel back
    tab = document.createElement("div");
    tab.id = "story-tab";
    tab.innerHTML = `<button type="button" class="sp-tab-open"></button><button type="button" class="sp-tab-x" aria-label="Dismiss">&times;</button>`;
    tab.querySelector(".sp-tab-open").addEventListener("click", () => current && openStory(current));
    tab.querySelector(".sp-tab-x").addEventListener("click", () => { current = null; tab.classList.remove("show"); });
    document.body.appendChild(tab);

    tip = document.createElement("div");
    tip.id = "sp-tip";
    document.body.appendChild(tip);
    const showTip = (ev, html) => {
      tip.innerHTML = html;
      tip.style.display = "block";
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, ev.clientX - w / 2)) + "px";
      tip.style.top = (ev.clientY - h - 14 < 8 ? ev.clientY + 18 : ev.clientY - h - 14) + "px";
    };
    const hideTip = () => { tip.style.display = "none"; };
    panel.addEventListener("pointermove", ev => { const t = ev.target.closest("[data-tip]"); t ? showTip(ev, t.dataset.tip) : hideTip(); });
    panel.addEventListener("pointerdown", ev => { const t = ev.target.closest("[data-tip]"); if (t) showTip(ev, t.dataset.tip); });
    panel.addEventListener("pointerleave", hideTip);
    panel.addEventListener("scroll", hideTip, { passive: true });
    panel.addEventListener("click", ev => {
      const b = ev.target.closest(".sp-calpick button");
      if (!b) return;
      calPick = b.dataset.k;
      try { sessionStorage.setItem("spCal", calPick); } catch (e) {}
      b.parentNode.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
      const opt = calOptions(currentDays).find(o => o[0] === calPick);
      panel.querySelector(".sp-calbody").innerHTML = calendar(currentDays, opt, current);
      hideTip();
    });

    document.addEventListener("keydown", e => { if (e.key === "Escape") closeStory(); });
    return panel;
  }

  function closeStory() {
    if (panel) panel.classList.remove("open");
    if (tip) tip.style.display = "none";
    document.body.classList.remove("sp-panel-open");
    if (mapLayer) { window.map.removeLayer(mapLayer); mapLayer = null; }
    if (tab && current) {
      tab.querySelector(".sp-tab-open").innerHTML = `<span aria-hidden="true">‹</span> ${esc(current)}`;
      tab.classList.add("show");
    }
  }
  window.closeStory = closeStory;

  const backBtn = name => `<div class="sp-bar">
      <button class="sp-back" type="button" onclick="closeStory()"><span aria-hidden="true">‹</span> Back to map</button>
      <span class="sp-bar-name">${esc(name)}</span>
    </div>`;

  async function openStory(name) {
    const st = (window.AppData?.stations || []).find(s => s.stationName === name);
    if (!st) return;
    current = name;
    const el = ensurePanel();
    tab.classList.remove("show");
    el.innerHTML = `${backBtn(name)}<div class="sp-loading">Loading ${esc(name)}…</div>`;
    el.scrollTop = 0;
    el.classList.add("open");
    document.body.classList.add("sp-panel-open");
    window.map.closePopup();

    const dailyQ = loadDaily().catch(() => null);
    const fcQ = communityForecast(st).catch(() => null);
    let hist;
    try { hist = await loadHistory(); } catch (e) {
      el.querySelector(".sp-loading").textContent = "Couldn't load the last 24 hours. Try again in a minute.";
      return;
    }
    if (current !== name) return;   // another station was clicked while this one loaded
    const mine = hist[name] || {};
    const all = Object.values(mine).flat().filter(r => r.v != null);
    if (!all.length) {
      // Enoch/Jasper (analyzers shut down 2026-10-29, Bettair coming): only our own weather rows (data.js
      // station_met_fill), which the government history doesn't have (Kevin 2026-11-16)
      el.querySelector(".sp-loading").textContent = (st.rows || []).some(r => r.ours)
        ? "Weather only being collected right now." : "No readings for this station in the last 24 hours.";
      return;
    }
    const end = new Date(Math.max(...all.map(r => r.t.getTime())));
    const series = {};
    Object.keys(mine).forEach(p => { series[p] = hourly(mine[p], end); });

    // AQHI now + drivers + 3 h trend (computed from 3 h means, like AQHI itself)
    const aqhiNow = st.aqhi != null && isFinite(st.aqhi) ? Number(st.aqhi) : lastValid(series.AQHI || [])?.v;
    const pm = series["Fine Particulate Matter"], o3 = series.Ozone, no2 = series["Nitrogen Dioxide"];
    let shares = null, trend = null;
    if (pm && o3 && no2) {
      shares = drivers(mean3(no2, 23), mean3(o3, 23), mean3(pm, 23));
      const a = aqhiRaw(mean3(no2, 23), mean3(o3, 23), mean3(pm, 23));
      const b = aqhiRaw(mean3(no2, 20), mean3(o3, 20), mean3(pm, 20));
      if (a != null && b != null) trend = a - b;
    }
    const wsArr = series["Wind Speed"] || [], wdArr = series["Wind Direction"] || [];
    const wsNow = lastValid(wsArr)?.v, wdNow = lastValid(wdArr)?.v;
    const temp = lastValid(series["Outdoor Temperature"] || [])?.v;

    const msg = aqhiNow != null ? window.getAQHIHealthMessage(aqhiNow > 10 ? "10+" : Math.round(aqhiNow)) : null;
    const aqhiLabel = aqhiNow == null ? "—" : aqhiNow > 10 ? "10+" : Math.round(aqhiNow);
    const aqhiCol = aqhiNow == null ? "#ccc" : window.getAQHIColor(aqhiNow > 10 ? "10+" : Math.round(aqhiNow));
    const darkText = aqhiNow != null && aqhiNow >= 4 && aqhiNow <= 6;

    // where the air came from
    const pts = backTrace(st.lat, st.lon, wsArr, wdArr);
    const lenKm = pathLengthKm(pts);
    const calm = lenKm < 3;
    const npri = npriAlong(pts, calm);
    const paAlong = (window.AppData?.purpleair || []).filter(p => isFinite(p.lat) && nearPath(p.lat, p.lon, pts, calm));
    drawPath(st, pts, calm, npri, paAlong);

    const hoursTraced = pts.length - 1;
    const pathText = !hoursTraced
      ? "No wind readings, so we can't trace where this air came from."
      : calm
        ? `Winds were nearly calm, so this air is mostly local. It moved only about ${lenKm.toFixed(1)} km in ${hoursTraced} hours.`
        : `Over the last ${hoursTraced} hours this air travelled about ${Math.round(lenKm)} km to get here, mostly from the ${cardinal(bearing(st.lat, st.lon, pts[pts.length - 1][0], pts[pts.length - 1][1]))}.`;

    const npriList = npri.slice(0, 6).map(f =>
      `<li><b>${esc(f.p.FacilityName)}</b><span>${esc(f.p.SectorDescriptionEn || "")} · ${f.km < 1 ? "<1" : Math.round(f.km)} km ${f.dir}</span></li>`).join("");
    const paHigh = paAlong.filter(p => p.pm > Math.max(15, (lastValid(pm || [])?.v || 0) * 1.5));

    // dials: latest hour against the 1-hour limits (a 24-hour limit would use the 24 h average, 18 of 24 hours)
    const have = POLLUTANTS.filter(([p]) => series[p] && series[p].some(v => v != null));
    const dials = have.map(([p, short, unit]) => {
      const a = series[p], g = GUIDE[p];
      let val = null, basis = "latest hour";
      if (g && g[2] === "24-hour") {
        const good = a.filter(v => v != null);
        basis = "24-hour average";
        if (good.length >= 18) val = good.reduce((x, y) => x + y, 0) / good.length;
      } else {
        const lv = lastValid(a);
        if (lv && lv.i >= a.length - 3) val = lv.v;
      }
      const shown = val == null ? "–" : fmtNum(val, unit);
      const tipTxt = g
        ? `<b>${short}</b><br>${basis}: ${val == null ? "no reading" : shown + " " + unit}<br>Alberta ${g[2]} ${gword(g)}: ${g[0]} ${unit} (${g[1]})${halfHour(g) ? `<br>Compared with the hourly average: an hour above ${g[0]} ${unit} means at least one half-hour was above it.` : ""}`
        : `<b>${short}</b><br>Latest hour: ${val == null ? "no reading" : shown + " " + unit}<br>Alberta has no objective for this`;
      return `<div class="sp-gg" data-tip="${tipTxt}">${miniGauge(p, val)}<span class="sp-gg-name">${short}</span>
        <b>${shown} <small>${unit}</small></b><span class="sp-note">${basis}</span></div>`;
    }).join("");

    // table: now / 24 h avg / 24 h low-high / 24 h trend
    const row = (label, unit, a, nowTxt) => {
      const good = a.filter(v => v != null);
      const lv = lastValid(a);
      const stale = lv && lv.i < a.length - 3;
      const now = nowTxt != null ? nowTxt
        : !lv ? `<span class="sp-nr">not reporting</span>`
        : stale ? `<span class="sp-nr">last ${fmtTime(new Date(end.getTime() - (23 - lv.i) * 3600000))}</span>`
        : `<b>${fmtNum(lv.v, unit)}</b> <small>${unit}</small>`;
      const avg = good.length ? fmtNum(good.reduce((x, y) => x + y, 0) / good.length, unit) : "–";
      const lohi = good.length ? `${fmtNum(Math.min(...good), unit)}–${fmtNum(Math.max(...good), unit)}` : "–";
      return `<tr><td>${label}</td><td>${now}</td><td>${avg}</td><td>${lohi}</td><td>${trend24(a)}</td></tr>`;
    };
    let rows = have.map(([p, short, unit]) => row(short, unit, series[p])).join("");
    const MET_ROWS = [["Outdoor Temperature", "Temperature", "°C"], ["Relative Humidity", "Humidity", "%"], ["Wind Speed", "Wind speed", "km/h"]]
      .filter(([p]) => series[p] && series[p].some(v => v != null));
    if (MET_ROWS.length) {
      rows += `<tr><th class="sp-sect" colspan="5">Weather at this station</th></tr>` +
        MET_ROWS.map(([p, label, unit]) => row(label, unit, series[p])).join("") +
        (wdNow != null ? `<tr><td>Wind direction</td><td><b>from ${cardinal(wdNow)}</b> <i class="sp-wind" style="transform:rotate(${(wdNow + 180) % 360}deg)" title="blowing toward ${cardinal(wdNow + 180)}">↑</i></td><td>–</td><td>–</td><td></td></tr>` : "");
    }
    const table = `<div class="sp-tw"><table class="sp-aqt">
        <tr><th>Reading</th><th>Now</th><th>24 h avg</th><th>Low–high</th><th>Trend</th></tr>${rows}</table></div>
      ${MET_ROWS.length ? "" : `<p class="sp-note">This station does not report weather.</p>`}`;

    // radar ("DNA") chart, drawn into #sp-radar after the panel is filled
    const shareBar = shares ? `<div id="sp-radar" class="sp-radar" role="img"
        aria-label="AQHI drivers: PM2.5 ${Math.round(shares["PM2.5"])}%, ozone ${Math.round(shares.O3)}%, NO2 ${Math.round(shares.NO2)}%"></div>
      <div class="sp-share-key">
        <span><i style="background:#7a5cff"></i>PM2.5 ${Math.round(shares["PM2.5"])}%</span>
        <span><i style="background:#1e9bd7"></i>O₃ ${Math.round(shares.O3)}%</span>
        <span><i style="background:#e8833a"></i>NO₂ ${Math.round(shares.NO2)}%</span>
      </div>` : "";

    const smoke = window.inSmokeSeason?.() ? window.stationSmokeForecast?.[name] : null;
    const smokeHTML = smoke ? `<div class="sp-smoke">
        ${["now", "6h", "12h", "24h"].map(h => `<div><span>${h === "now" ? "Now" : "+" + h}</span><b>${smoke[h] ?? "—"}</b></div>`).join("")}
      </div>
      <p class="sp-note">Wildfire smoke added to PM2.5 (µg/m³), from the FireSmoke forecast.${Math.max(...["now", "6h", "12h", "24h"].map(h => smoke[h] || 0)) < 5 ? " Smoke stays negligible." : ""}</p>` : "";

    const trust = trustChecks(name, st, hist, end, series);
    const peaks = peakNote(series, end);
    const photo = window.stationImages?.[name];
    const photoHTML = photo ? `<a class="sp-photo" href="${esc(photo)}" target="_blank" rel="noopener" title="Open the full photo">
        <img src="${esc(photo)}" alt="The ${esc(name)} monitoring station" loading="lazy"></a>` : "";
    const [daily, fc] = await Promise.all([dailyQ, fcQ]);
    if (current !== name) return;
    currentDays = daily?.stations?.[name] || [];
    // AEPA sends "N/A" for today once today's forecast period is over
    const fcParts = fc ? [["today", fc.today], ["tonight", fc.tonight], ["tomorrow", fc.tomorrow]]
      .filter(([, v]) => v != null && String(v).trim() !== "" && isFinite(Number(v))) : [];
    const fcLine = fcParts.length
      ? `<div class="sp-sub">Forecast for ${esc(fc.name)}: ${fcParts.map(([k, v]) => `${k} ${Number(v) > 10 ? "10+" : Number(v)}`).join(", ")}</div>` : "";

    el.innerHTML = `
      ${backBtn(name)}
      <header class="sp-head">
        <div class="sp-aqhi" style="background:${aqhiCol};color:${darkText ? "#222" : "#fff"}">
          <small>AQHI</small><b>${aqhiLabel}</b>
        </div>
        <div>
          <h2>${esc(name)}</h2>
          <div class="sp-sub"><b>${msg ? msg.risk : "No AQHI"}</b> · latest hour ${fmtTime(end)}</div>
          ${fcLine}
        </div>
      </header>
      <p class="sp-lede">${headline(aqhiNow, shares, trend, median(wsArr.slice(-3)), wdNow, temp, end)}</p>
      ${peaks.length ? `<p class="sp-lede sp-peak">${peaks.join(" ")}</p>` : ""}
      ${msg ? `<div class="sp-health"><div><span>Most people</span>${msg.general}</div><div><span>At-risk people</span>${msg.atRisk}</div></div>` : ""}
      ${photoHTML}

      <section>
        <h3>Why it's this number</h3>
        ${shareBar || `<p class="sp-small">Needs PM2.5, ozone and NO₂ at this station.</p>`}
        ${shareBar ? `<p class="sp-note">Share of the AQHI from each pollutant, last 3 hours.</p>` : ""}
      </section>

      <section>
        <h3>Right now</h3>
        <div class="sp-gauges">${dials}</div>
        <p class="sp-note">The needle shows the latest hour against Alberta's 1-hour limits: the objectives (AAAQO) for the gases and the guideline (AAAQG, 80 µg/m³) for PM2.5.${have.some(([p]) => p === "Total Reduced Sulphur") ? " TRS has a 30-minute guideline (AAAQG, 5 ppb); with hourly data, an hour above 5 ppb means at least one half-hour was above it." : ""} Green is up to half the limit, yellow is up to it (the dark tick), red is above. Blue means Alberta has no limit for it. These are preliminary readings.</p>
      </section>

      <section>
        <h3>Last 24 hours</h3>
        ${series.AQHI ? aqhiStrip(series.AQHI, end) : ""}
        ${table}
        <p class="sp-note">Trend: <i class="sp-dot" style="background:var(--sp-lo)"></i>lowest hour <i class="sp-dot" style="background:var(--sp-hi)"></i>highest hour <i class="sp-dot" style="background:var(--sp-ink)"></i>latest. Units are ppb except PM2.5 (µg/m³) and CO (ppm).</p>
      </section>

      <section>
        <h3>Past 5 weeks</h3>
        ${daily ? calBox(currentDays, name) : `<p class="sp-small">Couldn't load the daily history. Try again in a minute.</p>`}
      </section>

      <section>
        <h3>Where this air came from</h3>
        <p>${pathText}</p>
        ${npri.length ? `<p class="sp-small">${npri.length} reporting facilit${npri.length > 1 ? "ies" : "y"} (NPRI) ${calm ? `within ${CALM_KM} km` : "along this path"}:</p><ul class="sp-list">${npriList}</ul>${npri.length > 6 ? `<p class="sp-note">+ ${npri.length - 6} more, shown on the map.</p>` : ""}`
          : hoursTraced ? `<p class="sp-small">No NPRI reporting facilities ${calm ? `within ${CALM_KM} km` : "along this path"}.</p>` : ""}
        ${paAlong.length ? `<p class="sp-small">${paAlong.length} PurpleAir sensor${paAlong.length > 1 ? "s" : ""} on the path${paHigh.length ? `, ${paHigh.length} reading high` : ", none reading high"}.</p>` : ""}
        <p class="sp-note">Traced back from this station's own hourly winds. A quick estimate, not a dispersion model.</p>
      </section>

      ${smokeHTML ? `<section><h3>Smoke, next 24 hours</h3>${smokeHTML}</section>` : ""}

      <section>
        <h3>Can I trust this reading?</h3>
        <ul class="sp-trust">${trust.map(([lvl, txt]) => `<li class="${lvl}">${txt}</li>`).join("")}</ul>
      </section>

      <footer class="sp-foot-links">
        <a href="gauges.html?station=${encodeURIComponent(name)}" target="_blank">All gauges</a>
        <a href="https://dkevinm.github.io/AB_datapull/web/station_compare.html?station=${encodeURIComponent(name)}" target="_blank">Past data</a>
      </footer>`;
    if (shares) drawRadar(el.querySelector("#sp-radar"), shares, aqhiLabel);
  }

  // Same radar as the popup's "What's driving this AQHI" chart (ACA.html/WCAS.html
  // renderDNAChartInto), but fed the panel's 3-hour shares so it agrees with
  // the summary text.
  function drawRadar(div, shares, aqhiLabel) {
    if (!div || !window.Plotly) return;
    const theta = ["NO₂", "O₃", "PM2.5", "NO₂"];
    const r = [shares.NO2, shares.O3, shares["PM2.5"], shares.NO2];
    Plotly.newPlot(div, [{
      type: "scatterpolar", r, theta, fill: "toself",
      line: { color: "#5b3fd1" }, fillcolor: "rgba(122,92,255,.25)",
      hovertemplate: "%{theta}: %{r:.0f}%<extra></extra>"
    }], {
      title: { text: `AQHI: ${aqhiLabel}`, font: { size: 12 } },
      polar: { radialaxis: { visible: true, range: [0, 100], tickvals: [0, 50, 100], ticktext: ["0%", "50%", "100%"], tickfont: { size: 9 } },
        angularaxis: { tickfont: { size: 12 } } },
      showlegend: false,
      margin: { t: 28, b: 24, l: 40, r: 40 },
      height: 220, width: 260,
      paper_bgcolor: "rgba(0,0,0,0)"
    }, { displayModeBar: false, staticPlot: false });
  }

  function drawPath(st, pts, calm, npri, paAlong) {
    if (mapLayer) window.map.removeLayer(mapLayer);
    mapLayer = L.layerGroup().addTo(window.map);
    const latlngs = pts.map(p => L.latLng(p[0], p[1]));

    if (calm || pts.length < 2) {
      L.circle(latlngs[0], { radius: CALM_KM * 1000, color: "#5b3fd1", weight: 1.5, dashArray: "4 4", fillColor: "#7a5cff", fillOpacity: 0.08, interactive: false }).addTo(mapLayer);
    } else {
      if (window.turf) {
        const buf = turf.buffer(turf.lineString(pts.map(p => [p[1], p[0]])), CORRIDOR_KM, { units: "kilometers" });
        L.geoJSON(buf, { style: { color: "#5b3fd1", weight: 1, fillColor: "#7a5cff", fillOpacity: 0.1 }, interactive: false }).addTo(mapLayer);
      }
      L.polyline(latlngs, { color: "#5b3fd1", weight: 3, dashArray: "6 5", interactive: false }).addTo(mapLayer);
      latlngs.forEach((ll, i) => {
        if (i === 0 || (i % 3 && i !== latlngs.length - 1)) return;
        L.circleMarker(ll, { radius: 4, color: "#fff", weight: 1.5, fillColor: "#5b3fd1", fillOpacity: 1 })
          .bindTooltip(`${i} h ago`, { permanent: true, direction: "right", className: "sp-hour-tip", offset: [6, 0] })
          .addTo(mapLayer);
      });
    }

    npri.forEach(f => {
      L.marker([f.lat, f.lon], {
        icon: L.divIcon({ className: "sp-npri", html: "", iconSize: [12, 12] })
      }).bindTooltip(`<b>${esc(f.p.FacilityName)}</b><br>${esc(f.p.SectorDescriptionEn || "")}<br>NPRI ${f.p.ReportYear}`).addTo(mapLayer);
    });
    paAlong.forEach(p => {
      L.circleMarker([p.lat, p.lon], { radius: 11, color: "#5b3fd1", weight: 2, fill: false, interactive: false }).addTo(mapLayer);
    });

    const bounds = L.latLngBounds(latlngs);
    npri.slice(0, 6).forEach(f => bounds.extend([f.lat, f.lon]));
    bounds.extend(calm ? L.latLng(st.lat, st.lon).toBounds(CALM_KM * 2200) : latlngs[0]);
    const wide = window.innerWidth > 700;
    window.map.fitBounds(bounds, {
      paddingTopLeft: [40, 40],
      paddingBottomRight: wide ? [520, 40] : [40, Math.round(window.innerHeight * 0.72)],
      maxZoom: 12
    });
  }

  // ---------- station click opens the panel ----------

  // A station's popup opening is the click: swap it for the side panel.
  // Other popups (PurpleAir, map clicks, NPRI) are left alone.
  function hook() {
    if (!window.map?.on || !window.AppData) return setTimeout(hook, 400);
    window.map.on("popupopen", e => {
      const content = e.popup.getElement()?.querySelector(".leaflet-popup-content");
      const strong = content?.querySelector("strong");
      if (!strong) return;
      const name = strong.textContent.trim();
      if (!(window.AppData.stations || []).some(s => s.stationName === name)) return;
      setTimeout(() => openStory(name), 0);
    });
  }
  hook();
})();
