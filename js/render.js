// =======================
// render.js
// =======================

window.shouldLoad = function(layerKey) {
  const cfg = window.APP_CONFIG || {};

  // Explicit disable wins
  if (cfg.disableLayers && cfg.disableLayers.includes(layerKey)) return false;

  // If overlays list exists, only allow those
  if (cfg.overlays && !cfg.overlays.includes(layerKey)) return false;

  return true;
}

window.roseVisible = false;

const excludedStations = [
  "Powers"
];

window.stationImages = {
  "Breton": "images/Breton.jpg",
  "Carrot Creek": "images/Carrot Creek.jpg",
  "Drayton Valley": "images/Drayton Valley.jpg",
  "Edson": "images/Edson.jpg",
  "Genesee": "images/Genesee.jpg",
  "Hinton-Drinnan": "images/Hinton-Drinnan.jpg",
  "Hinton-Hillcrest": "images/Hinton-Hillcrest.jpg",
  "Jasper": "images/Jasper.jpg",
  "Meadows": "images/Meadows.jpg",
  "Steeper": "images/Steeper.jpg",
  "Wagner": "images/Wagner.jpg"
};


let ACApoly = null;
let WCASpoly = null;



async function loadAQHIGroup(groupName) {
  const files = window.AQHI_GROUPS[groupName];
  const layerGroup = window.layers.aqhi[groupName];


  if (!files || !layerGroup) return;

  layerGroup.clearLayers();

  for (const file of files) {
    const url = `https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/output/${file}`;
    const res = await fetch(url);
    const geojson = await res.json();

    const layer = L.geoJSON(geojson, {
      interactive: true,
      style: f => {
        const v =
          f.properties?.aqhi ??
          f.properties?.AQHI ??
          f.properties?.value ??
          f.properties?.gridcode ??
          f.properties?.aqhi_blend ??
          f.properties?.blend ??
          f.properties?.blended_aqhi;

        return {
        fillColor: isFinite(Number(v))
          ? window.getAQHIColor(Number(v) > 10 ? 11 : Number(v))
          : "#999",
          color: "none",
          weight: 0,
          fillOpacity: 0.6
        };
      },
      onEachFeature: function(feature, lyr) {
        const p = feature.properties || {};
        const v =
          p.aqhi ??
          p.AQHI ??
          p.value ??
          p.gridcode ??
          p.aqhi_blend ??
          p.blend ??
          p.blended_aqhi ??
          p.AQHI_BLEND ??
          p.aqhiBlend;

          lyr.bindTooltip(`AQHI: ${
            isFinite(Number(v))
              ? (Number(v) > 10 ? "10+" : Math.round(Number(v)))
              : "—"
          }`, {
          sticky: true
        });
      }
    });

    layerGroup.addLayer(layer);
  }
}




// Boundary layers (toggleable)
const ACABoundaryLayer  = L.layerGroup();
const WCASBoundaryLayer = L.layerGroup();

const baseURL = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/output";

const acaBoundaryReady = fetch("data/ACA.geojson")
  .then(r => r.json())
  .then(g => {
    ACApoly = g;
    ACABoundaryLayer.clearLayers();
    ACABoundaryLayer.addLayer(L.geoJSON(g, { style: { color: "#33a02c", weight: 2, fill: false } }));
  })
  .catch(e => console.error("ACA boundary load failed:", e));

const wcasBoundaryReady = fetch("data/WCAS.geojson")
  .then(r => r.json())
  .then(g => {
    WCASpoly = g;
    WCASBoundaryLayer.clearLayers();
    WCASBoundaryLayer.addLayer(L.geoJSON(g, { style: { color: "#1b9e77", weight: 2, fill: false } }));
  })
  .catch(e => console.error("WCAS boundary load failed:", e));


// point-in-polygon helper
function inside(poly, lat, lon) {
  if (!poly || !poly.features || !poly.features.length) return false;
  return turf.booleanPointInPolygon(turf.point([lon, lat]), poly.features[0]);
}


function loadFireSmokeLayer(url, layer) {
  fetch(url)
    .then(r => r.json())
    .then(geo => {
      layer.clearLayers();

      L.geoJSON(geo, {
        style: f => ({
          fillColor: getSmokeColor(f.properties.pm25),
          fillOpacity: 0.4,
          color: "none",
          weight: 0
        }),

        onEachFeature: function (feature, lyr) {
          const pm = Number(feature.properties?.pm25);
          const ts = feature.properties?.timestamp || "";

          lyr.bindTooltip(
            `PM2.5: ${isFinite(pm) ? pm.toFixed(1) : "—"} µg/m³` +
            (ts ? `<br>${ts}` : ""),
            {
              sticky: true
            }
          );
        }
      }).addTo(layer);

      console.log("Loaded FireSmoke:", url);
    })
    .catch(e => console.error("FireSmoke load failed:", e));
}


function getSmokeColor(pm) {
  if (pm < 1)   return "#f2e8b3";
  if (pm < 10)  return "#e8c95c";
  if (pm < 28)  return "#f5a623";
  if (pm < 60)  return "#f57c00";
  if (pm < 120) return "#cc5500";
  return "#662200";
}



function loadFireSmokePNG(imageFile, layer) {
    layer.clearLayers();
    const smokeBounds = [
      [42.0, -130.0],
      [65.0, -90.0]
    ];
  
    const smoke = L.imageOverlay(
      `${baseURL}/${imageFile}`,
      smokeBounds,
      {
        opacity: 0.55,
        interactive: false
      }
    );
    layer.addLayer(smoke);
    console.log("Loaded FireSmoke PNG:", imageFile);
}




// clear layers (so re-render doesn’t duplicate)
function clearAllLayers() {
  if (window.layers?.stations) window.layers.stations.clearLayers();
  if (window.layers?.purpleair) window.layers.purpleair.clearLayers();
  if (window.layers?.eaqhi) window.layers.eaqhi.clearLayers();

  if (window.layers?.aqhi) {
    Object.values(window.layers.aqhi).forEach(layer => {
      if (layer?.clearLayers) layer.clearLayers();
    });
  }
}



function loadEstimatedAQHI() {
  fetch("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/eAQHI_map.json")
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      window.layers.eaqhi.clearLayers();
      data.forEach(st => {
        const color = window.getAQHIColor(st.AQHI);
        const marker = L.circleMarker([st.lat, st.lon], {
          radius: 18,
          fillColor: color,
          color: "#000",
          weight: 1,
          fillOpacity: 0.85,
          dashArray: "4,3"
        });


      
        marker.bindPopup(`
          <b>${st.station}</b><br>
          Estimated AQHI: <b>${st.AQHI > 10 ? "10+" : Math.round(st.AQHI)}</b><br>
          PM2.5 (PurpleAir): ${st.pm25_est} µg/m³<br>
          O3 (3h): ${st.o3_3h} ppb<br>
          NO2 (3h): ${st.no2_3h} ppb<br>
          Sensors used: ${st.purpleair_sensor_count}<br>
          <i>Estimated from nearby PurpleAir</i>
        `);
        marker.addTo(window.layers.eaqhi);
        
        // add AQHI number label
        const label = L.marker([st.lat, st.lon], {
          icon: L.divIcon({
            className: "aqhi-label",
            html: (st.AQHI > 10 ? "10+" : Math.round(st.AQHI)),
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          }),
          interactive: false
        });
        
        label.addTo(window.layers.eaqhi);
        
      });
      console.log("Loaded estimated AQHI:", data.length);
    })
    .catch(err => console.error("eAQHI load error", err));
}



  
  function drawRose(latlng, p, layer, pollutant) {
  
    const map = window.map;
  
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  
    const bins = [
      { suffix: "_calm", color: "#9ecae1" },   // medium light blue
      { suffix: "_low",  color: "#91cf60" },   // green
      { suffix: "_med",  color: "#fc8d59" },   // orange
      { suffix: "_high", color: "#a50026" }    // deep red
    ];
  
    let unit = "";
    if (pollutant === "PM25") unit = " µg/m³";
    if (pollutant === "NO2")  unit = " ppb";
    if (pollutant === "SO2")   unit = " ppb";

    
    let total = Number(p.grand_total);
    
    if (!Number.isFinite(total) || total <= 0) {
      total = 0;
      dirs.forEach(d => {
        bins.forEach(bin => {
          total += Number(p[d + bin.suffix] || 0);
        });
      });
      if (total === 0) total = 1;
    }

    
    // Radius in METERS (not degrees)
    const zoomScale = Math.pow(2, map.getZoom() - 8);
    const R = 10 * zoomScale;

  

    // find max mean concentration for scaling
    let maxVal = 0;
    dirs.forEach(d => {
      bins.forEach(bin => {
        const v = Number(p[`${d}${bin.suffix}`] || 0);
        if (v > maxVal) maxVal = v;
      });
    });
    if (maxVal === 0) maxVal = 1;

    

    dirs.forEach((d, i) => {
    
      const sectorCount = dirs.length;
      const step = 360 / sectorCount;
      const half = step / 2;
    
      const angle1 = (i * step - half - 90) * Math.PI/180;
      const angle2 = ((i+1) * step - half - 90) * Math.PI/180;
    
      const center = map.project(latlng);
    
      let cumulativeRadius = 0;
    

      bins.forEach(bin => {
      
        const val = Number(p[`${d}${bin.suffix}`] || 0);
        if (val <= 0) return;
      
        const r = (val / maxVal) * R;
      
        const innerRadius = cumulativeRadius;
        const outerRadius = cumulativeRadius + r;
      
        const p1 = map.unproject([
          center.x + innerRadius * Math.cos(angle1),
          center.y + innerRadius * Math.sin(angle1)
        ]);
      
        const p2 = map.unproject([
          center.x + outerRadius * Math.cos(angle1),
          center.y + outerRadius * Math.sin(angle1)
        ]);
      
        const p3 = map.unproject([
          center.x + outerRadius * Math.cos(angle2),
          center.y + outerRadius * Math.sin(angle2)
        ]);
      
        const p4 = map.unproject([
          center.x + innerRadius * Math.cos(angle2),
          center.y + innerRadius * Math.sin(angle2)
        ]);
      
        const wedge = L.polygon([p1, p2, p3, p4], {
          color: "#333",
          weight: 0.4,
          fillColor: bin.color,
          fillOpacity: 0.75
        });
      
        const pollutantLabel =
          pollutant === "PM25" ? "PM₂.₅" :
          pollutant === "NO2"  ? "NO₂"  :
          pollutant === "SO2"  ? "SO₂"  : pollutant;
      
        const speedText = {
          "_calm": "Calm (<2 km/h)",
          "_low":  "Low (2–10 km/h)",
          "_med":  "Medium (10–25 km/h)",
          "_high": "High (>25 km/h)"
        };
      
        wedge.bindTooltip(
          `${pollutantLabel}<br>
           ${d} – ${speedText[bin.suffix]}<br>
           ${val.toFixed(1)} ${unit}`
        );
      
        wedge.addTo(layer);
      
        cumulativeRadius += r;
      
      });

    });
  }




window.renderMap = async function () {
  window.layers.aqhi = window.layers.aqhi || {};

  Object.keys(window.AQHI_GROUPS).forEach(group => {
    if (!window.layers.aqhi[group]) {
      window.layers.aqhi[group] = L.layerGroup();
    }
  });

  
  const map = window.map;   

  await Promise.all([
    window.AppData.ready,
    acaBoundaryReady,
    wcasBoundaryReady
  ]);
  
  clearAllLayers();
  
  loadEstimatedAQHI();  
  
  const useSmokePNG =
    window.matchMedia("(pointer: coarse)").matches ||
    window.innerWidth <= 1024;
  
  if (useSmokePNG) {
    loadFireSmokePNG("firesmoke_00h.png", window.layers.firesmoke_now);
    loadFireSmokePNG("firesmoke_06h.png", window.layers.firesmoke_6h);
    loadFireSmokePNG("firesmoke_12h.png", window.layers.firesmoke_12h);
    loadFireSmokePNG("firesmoke_24h.png", window.layers.firesmoke_24h);
  } else {
    loadFireSmokeLayer(
      `${baseURL}/firesmoke_now.geojson`,
      window.layers.firesmoke_now
    );
  
    loadFireSmokeLayer(
      `${baseURL}/firesmoke_6h.geojson`,
      window.layers.firesmoke_6h
    );
  
    loadFireSmokeLayer(
      `${baseURL}/firesmoke_12h.geojson`,
      window.layers.firesmoke_12h
    );
  
    loadFireSmokeLayer(
      `${baseURL}/firesmoke_24h.geojson`,
      window.layers.firesmoke_24h
    );
  }
      
  
  // render PurpleAir
  if (window.renderPurpleAir) {
    await window.renderPurpleAir();
  }
  
  
  // ENSURE LAYERS ARE ATTACHED ONCE
  if (!window._layersAttached) {
  
    // ALWAYS show Alberta
    window.layers.stations.addTo(map);
    window.layers.purpleair.addTo(map);
    window.layers.aca_boundary = ACABoundaryLayer;
    window.layers.wcas_boundary = WCASBoundaryLayer;

    if (window.APP_CONFIG?.defaultAQHI?.length) {
      for (const key of window.APP_CONFIG.defaultAQHI) {
    
        if (!window.AQHI_GROUPS[key]) continue;
    
        if (!window.layers.aqhi[key]) {
          window.layers.aqhi[key] = L.layerGroup();
        }
    
        await loadAQHIGroup(key);
    
        map.addLayer(window.layers.aqhi[key]);
  
        if (window._layerControl && window._layerControl._layers) {
          Object.values(window._layerControl._layers).forEach(l => {
            if (l.name === "AQHI Grid AB Stations") l.layer = window.layers.aqhi["Alberta"];
            else if (l.name === "AQHI Grid AB Stations+Sensors") l.layer = window.layers.aqhi["Alberta_BLEND"];
            else if (l.name === "AQHI Grid ACA Stations") l.layer = window.layers.aqhi["ACA_Boundary_2022"];
            else if (l.name === "AQHI Grid ACA Stations+Sensors") l.layer = window.layers.aqhi["ACA_Boundary_2022_BLEND"];
            else if (l.name === "AQHI Grid Edmonton Stations") l.layer = window.layers.aqhi["Edmonton"];
            else if (l.name === "AQHI Grid Edmonton Stations+Sensors") l.layer = window.layers.aqhi["Edmonton_BLEND"];
            else if (l.name === "AQHI Grid Parkland Stations") l.layer = window.layers.aqhi["Parkland_County"];
            else if (l.name === "AQHI Grid Parkland Stations+Sensors") l.layer = window.layers.aqhi["Parkland_County_BLEND"];
            else if (l.name === "AQHI Grid Strathcona Stations") l.layer = window.layers.aqhi["Strathcona"];
            else if (l.name === "AQHI Grid Strathcona Stations+Sensors") l.layer = window.layers.aqhi["Strathcona_BLEND"];
            else if (l.name === "AQHI Grid WCAS Stations") l.layer = window.layers.aqhi["WCAS_2024"];
            else if (l.name === "AQHI Grid WCAS Stations+Sensors") l.layer = window.layers.aqhi["WCAS_2024_BLEND"];
            else if (l.name === "AQHI Grid Yellowhead Stations") l.layer = window.layers.aqhi["Yellowhead"];
            else if (l.name === "AQHI Grid Yellowhead Stations+Sensors") l.layer = window.layers.aqhi["Yellowhead_BLEND"];
          });
        }
      }
    }
    
    
    // OPTIONAL overlays based on config
    const airshed = window.APP_CONFIG?.airshed;
    
    if (airshed === "ACA") {
      if (window.APP_CONFIG?.showACABoundary) {
        ACABoundaryLayer.addTo(map);
      }
    }
    
    if (airshed === "WCAS") {
      if (window.APP_CONFIG?.showWCASBoundary) {
        WCASBoundaryLayer.addTo(map);
      }
    }
  
    // ---- Roses: PM2.5 only ----
     
  
    window._layersAttached = true;
  }

  

    if (!map) {
      console.error("renderMap: window.map missing");
      return;
    }
  
    if (!window.AppData?.stations) {
      console.error("renderMap: AppData missing stations/purpleair");
      return;
    }

    

  // -----------------------
  // STATIONS
  // -----------------------

  window.AppData.stations.forEach(st => {

    const name = st.stationName || st.StationName || "";    
    if (
      excludedStations.includes(name) ||
      window.APP_CONFIG?.excludeStations?.includes(name)
    ) return;
    
    const stationName = st.stationName;
    const rows = st.rows;
  
    if (!rows || !rows.length) return;
  
  
    const lat = st.lat;
    const lon = st.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  
 
    // AQHI value for color
    const aqhiRow = rows.find(r => r.ParameterName === "AQHI");
    const aqhiVal = aqhiRow ? Number(aqhiRow.Value) : NaN;
  
    const color = Number.isFinite(aqhiVal) ? window.getAQHIColor(aqhiVal) : "#888888";
  
    // timestamp: use latest ReadingDate across the rows (rows[0] is NOT reliable)
    let latest = null;
    rows.forEach(r => {
      const t = new Date(r.ReadingDate);
      if (!latest || t > latest) latest = t;
    });
  
    const displayTime = latest
      ? latest.toLocaleString("en-CA", { timeZone: "America/Edmonton", hour12: true })
      : "";
  
    // Keep the popup dynamic, but order key params first (everything else after)
    const ordered = [
      "AQHI",
      "Outdoor Temperature",
      "Relative Humidity",
      "Wind Speed",
      "Wind Direction",
      "Nitrogen Dioxide",
      "Total Oxides of Nitrogen",
      "Nitric Oxide",
      "Ozone",
      "Fine Particulate Matter",
      "Sulphur Dioxide",
      "Hydrogen Sulphide",
      "Total Reduced Sulphur",
      "Carbon Monoxide",
      "Total Hydrocarbons",
      "Methane",
      "Non-methane Hydrocarbons"
    ];
  
    const byParam = {};
    rows.forEach(r => { byParam[r.ParameterName] = r; });
  
    const used = new Set();
  
    const linesFirst = ordered
      .filter(p => {
        const r = byParam[p];
        return r &&
          r.Value !== null &&
          r.Value !== undefined &&
          !isNaN(Number(r.Value)) &&
          Number(r.Value) !== -10;
      })      
      .map(p => {
        used.add(p);
        const r = byParam[p];
        const u = r.Units ? `${r.Units}` : "";
        const label = r.Shortform || r.ParameterName;
    
        let val = r.Value;
    
        if (r.ParameterName === "AQHI") {
          const num = Number(val);
          if (val === null || val === undefined || val === "" || isNaN(num) || num === 0) {
            val = "-";
          } else {
            val = num > 10 ? "10+" : Math.round(num);
          }
        }
    
        return `${label}: ${val}${u}`;
      });
  
      const linesRest = rows
        .filter(r =>
          !used.has(r.ParameterName) &&
          r.Value !== null &&
          r.Value !== undefined &&
          !isNaN(Number(r.Value)) &&
          Number(r.Value) !== -10
        )
        
        .map(r => {
          const u = r.Units ? `${r.Units}` : "";
          const label = r.Shortform || r.ParameterName;
      
          let val = r.Value;
      
          if (r.ParameterName === "AQHI") {
            const num = Number(val);
            if (val === null || val === undefined || val === "" || isNaN(num) || num === 0) {
              val = "-";
            } else {
              val = num > 10 ? "10+" : Math.round(num);
            }
          }
      
          return `${label}: ${val}${u}`;
        });


    const imgPath = window.stationImages[stationName];
    
    const imageHTML = imgPath
      ? `<br><img src="${imgPath}" 
               style="width:100%;max-width:260px;border-radius:6px;margin-top:6px;">`
      : "";

    const showHistory = window.APP_CONFIG?.enableHistory === true;
    const historyLink = showHistory
      ? `<a href="https://dkevinm.github.io/AB_datapull/web/station_compare.html?station=${encodeURIComponent(stationName)}" target="_blank">
           View historical data
         </a><br>`
      : "";
    
    
    const popupHTML = `
      <strong>${stationName}</strong><br>
      <small>${displayTime}</small><br>
      <small>Hour Ending</small><br><br>
      ${[...linesFirst, ...linesRest].join("<br>")}
      ${imageHTML}
      <hr>
      ${historyLink}
      <a href="/LiveMap/gauges.html?station=${encodeURIComponent(stationName)}" target="_blank">
        View gauges</a>
    `;
  
    const marker = L.circleMarker([lat, lon], {
      radius: 18,
      fillColor: color,
      color: "#222",
      weight: 2,
      fillOpacity: 0.85
    }).bindPopup(popupHTML);
    
    // choose which layer the marker belongs to
    // ALWAYS add to Alberta layer
    window.layers.stations.addLayer(marker);
    
    
    
    // add AQHI number inside circle
    if (Number.isFinite(aqhiVal)) {
    
      const label = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "aqhi-label",
          html: (!isFinite(aqhiVal) || aqhiVal === 0
            ? "-"
            : (aqhiVal > 10 ? "10+" : Math.round(aqhiVal))
          ),
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }),
        interactive: false
      });
    
      window.layers.stations.addLayer(label);
      
    }  

  });


  // ---- ROSES ----
  if (
    map.hasLayer(window.layers.rose_pm25) ||
    map.hasLayer(window.layers.rose_no2) ||
    map.hasLayer(window.layers.rose_so2)
  ) {
    await loadRoses();
  } else {
    window.layers.rose_pm25.clearLayers();
    window.layers.rose_no2.clearLayers();
    window.layers.rose_so2.clearLayers();
  }
  
  console.log("Map rendered.");
};



  function buildRoseTable(p, pollutant) {
  
    let unit = "";
    if (pollutant === "PM25") unit = "µg/m³";
    if (pollutant === "NO2")  unit = "ppb";
    if (pollutant === "SO2")   unit = "ppb";
  
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

    const bins = ["calm","low","med","high"];
  
    let html = `
      <div style="min-width:260px">
        <strong>${p.station || "Station"}</strong><br>
        <small>${p.period || "Last 7 Days"} – ${p.pollutant || pollutant}</small>
        <br><br>
        <table style="
          border-collapse: collapse;
          width:100%;
          font-size:12px;
          text-align:center;
        ">
          <tr style="background:#f0f0f0;">
            <th style="border:1px solid #ccc;padding:4px;">Dir</th>
            <th style="border:1px solid #ccc;padding:4px;">Calm</th>
            <th style="border:1px solid #ccc;padding:4px;">Low</th>
            <th style="border:1px solid #ccc;padding:4px;">Med</th>
            <th style="border:1px solid #ccc;padding:4px;">High</th>
          </tr>
    `;
  
    dirs.forEach(d => {
      html += `<tr>`;
      html += `<td style="border:1px solid #ccc;padding:4px;"><b>${d}</b></td>`;
  
      bins.forEach(b => {
        const val = Number(p[`${d}_${b}`] || 0);
        html += `<td style="border:1px solid #ccc;padding:4px;">
                  ${val.toFixed(1)}
                 </td>`;
      });
  
      html += `</tr>`;
    });
  
    html += `</table><br>`;
  
    html += `
      <div style="font-size:12px">
        <b>Summary:</b><br>
        Period: ${p.start_date} → ${p.end_date}<br>
        Overall Mean: ${Number(p.overall_mean || 0).toFixed(1)} ${unit}<br>
        Predominant Direction: <b>${p.dominant_dir || "--"}</b>
        (${Number(p.dominant_value || 0).toFixed(1)} ${unit},
        ${Number(p.dominant_percent || 0).toFixed(1)}%)<br>
        Calm Conditions: ${Number(p.calm_percent || 0).toFixed(1)}%<br>
        Total Samples: ${p.n_total || 0}
      </div>
    </div>
    `;
  
    return html;
  }






  // roses
  window.loadRoses = async function () {

    const map = window.map;

    console.log("Loading roses...");
  
    const types = [
      { key: "PM25", layer: window.layers.rose_pm25 },
      { key: "NO2",  layer: window.layers.rose_no2  },
      { key: "SO2",  layer: window.layers.rose_so2  }
    ];
    
  
    // Clear all rose layers upfront
    types.forEach(t => {
      if (map.hasLayer(t.layer)) {
        t.layer.clearLayers();
      }
    });
    // Fetch all GeoJSON files in parallel
    const results = await Promise.all(
      types.map(t =>
        fetch(`data/rose_${t.key}.geojson`)
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status} loading rose_${t.key}.geojson`);
            return r.json();
          })
          .then(geo => ({ t, geo }))
          .catch(err => { console.error(`Failed to load rose_${t.key}.geojson:`, err); return null; })
      )
    );
    results.forEach(item => {
      if (!item) return;
      const { t, geo } = item;    
  
  
      geo.features.forEach(f => {

        const bounds = map.getBounds();
        const lat = f.geometry.coordinates[1];
        const lon = f.geometry.coordinates[0];
        
        if (!bounds.contains([lat, lon])) return;
        
    

  
        const latlng = L.latLng(
          f.geometry.coordinates[1],
          f.geometry.coordinates[0]
        );
  
        // draw wedges
        drawRose(latlng, f.properties, t.layer, t.key);
  
        // add center marker for popup
        const centerMarker = L.circleMarker(latlng, {
          radius: 4,
          fillColor: "#000",
          color: "#000",
          weight: 1,
          fillOpacity: 1
        });
  
        centerMarker.bindPopup(
          buildRoseTable(f.properties, t.key)
        );
  
        centerMarker.addTo(t.layer);
      });
    });  
  
    console.log("Roses done.");
  }








