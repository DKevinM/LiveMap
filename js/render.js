// =======================
// render.js
// =======================

// --- Shared Layer Groups (available to all scripts) ---
window.ACAStations  = window.ACAStations  || L.layerGroup();
window.ACAPurple    = window.ACAPurple    || L.layerGroup();
window.WCASStations = window.WCASStations || L.layerGroup();
window.WCASPurple   = window.WCASPurple   || L.layerGroup();
window.ALLStations  = window.ALLStations  || L.layerGroup();
window.ALLPurple    = window.ALLPurple    || L.layerGroup();
window.roseRegionFilter = "WCAS";   // "ALL", "ACA", "WCAS", "OTHER"
window.roseVisible = false;
window.RosePM25 = window.RosePM25 || L.layerGroup();
window.RoseNO2  = window.RoseNO2  || L.layerGroup();
window.RoseSO2   = window.RoseSO2   || L.layerGroup();

window.eAQHIStations = window.eAQHIStations || L.layerGroup();


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

// Boundary layers (toggleable)
const ACABoundaryLayer  = L.layerGroup();
const WCASBoundaryLayer = L.layerGroup();


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


// clear layers (so re-render doesn’t duplicate)
function clearAllLayers() {
  window.ACAStations.clearLayers();
  window.WCASStations.clearLayers();
  window.ALLStations.clearLayers();
  window.ACAPurple.clearLayers();
  window.WCASPurple.clearLayers();
  window.ALLPurple.clearLayers();

  window.RosePM25.clearLayers();
  window.RoseNO2.clearLayers();
  window.RoseSO2.clearLayers();

  window.eAQHIStations.clearLayers();
}



function loadEstimatedAQHI() {
  fetch("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/eAQHI_map.json")
    .then(r => r.json())
    .then(data => {
      window.eAQHIStations.clearLayers();
      data.forEach(st => {
        const color = window.getAQHIColor(st.AQHI);
        const marker = L.circleMarker([st.lat, st.lon], {
          radius: 7,
          fillColor: color,
          color: "#000",
          weight: 1,
          fillOpacity: 0.9,
          dashArray: "4,3"   // dashed outline = estimated
        });

        marker.bindPopup(`
          <b>${st.station}</b><br>
          Estimated AQHI: <b>${st.AQHI}</b><br>
          PM2.5 (PurpleAir): ${st.pm25_est} µg/m³<br>
          O3 (3h): ${st.o3_3h} ppb<br>
          NO2 (3h): ${st.no2_3h} ppb<br>
          Sensors used: ${st.purpleair_sensor_count}<br>
          <i>Estimated from nearby PurpleAir</i>
        `);
        marker.addTo(window.eAQHIStations);
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
  const map = window.map;   

  await window.AppData.ready; 
  await Promise.all([window.dataReady, acaBoundaryReady, wcasBoundaryReady]);
  
  clearAllLayers();
  
  loadEstimatedAQHI();  
  
  // render PurpleAir
  if (window.renderPurpleAir) {
    await window.renderPurpleAir();
  }
  
  
  // ENSURE LAYERS ARE ATTACHED ONCE
  if (!window._layersAttached) {
  
    // ---- Show WCAS only ----
    window.WCASStations.addTo(map);
    window.WCASPurple.addTo(map);
    WCASBoundaryLayer.addTo(map);
  
    // ---- Roses: PM2.5 only ----
    window.RosePM25.addTo(map);
  
    // Do NOT auto-add:
    // ACAStations
    // ACAPurple
    // ALLStations
    // ALLPurple
    // RoseNO2
    // RoseSO2
    // ACABoundary
  
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
  
  while (!window.dataByStation) {
    await new Promise(r => setTimeout(r, 50));
  }
    

  // -----------------------
  // STATIONS
  // -----------------------

  Object.entries(window.dataByStation).forEach(([stationName, rows]) => {
  
    if (!rows || !rows.length) return;
  
    const lat = Number(rows[0].Latitude);
    const lon = Number(rows[0].Longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  
    const inACA  = inside(ACApoly,  lat, lon);
    const inWCAS = inside(WCASpoly, lat, lon);
  
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
      .filter(p => byParam[p])
      .map(p => {
        used.add(p);
        const r = byParam[p];
        const u = r.Units ? `${r.Units}` : "";
        const label = r.Shortform || r.ParameterName;
        return `${label}: ${r.Value}${u}`;
      });
  
    const linesRest = rows
      .filter(r => !used.has(r.ParameterName))
      .map(r => {
        const u = r.Units ? `${r.Units}` : "";
        const label = r.Shortform || r.ParameterName;
        return `${label}: ${r.Value}${u}`;
      });


    const imgPath = window.stationImages[stationName];
    
    const imageHTML = imgPath
      ? `<br><img src="${imgPath}" 
               style="width:100%;max-width:260px;border-radius:6px;margin-top:6px;">`
      : "";

    
    const popupHTML = `
      <strong>${stationName}</strong><br>
      <small>${displayTime}</small><br><br>
      ${[...linesFirst, ...linesRest].join("<br>")}
      ${imageHTML}
      <hr>
      <a href="/AQHI.forecast/history/station_compare.html?station=${encodeURIComponent(stationName)}" target="_blank">
        View historical data</a><br>
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
    let targetLayer;
    if (inACA) targetLayer = window.ACAStations;
    else if (inWCAS) targetLayer = window.WCASStations;
    else targetLayer = window.ALLStations;
    
    targetLayer.addLayer(marker);
    
    // add AQHI number inside circle
    if (Number.isFinite(aqhiVal)) {
    
      const label = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "aqhi-label",
          html: aqhiVal,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }),
        interactive: false
      });
    
      targetLayer.addLayer(label);
    }  

    
    if (inACA) window.ACAStations.addLayer(marker);
    else if (inWCAS) window.WCASStations.addLayer(marker);
    else window.ALLStations.addLayer(marker);
  });



/*
  // -----------------------
  // PURPLEAIR
  // -----------------------
  window.AppData.purpleair.forEach(p => {
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const inACA  = inside(ACApoly,  lat, lon);
    const inWCAS = inside(WCASpoly, lat, lon);

    const aq = Number(p.eAQHI);
    const color = Number.isFinite(aq) ? window.getAQHIColor(aq) : "#666666";

    console.log(window.AppData.purpleair[0]);
    
    const marker = L.circleMarker([lat, lon], {
      radius: 4,
      fillColor: color,
      color: "#222",
      weight: 0.5,
      fillOpacity: 0.85
    }).bindPopup(`
      <strong>PurpleAir</strong><br>
      ${p.name || "Unnamed"}<br>
      AQHI: ${Number.isFinite(aq) ? aq : "--"}<br>
      PM₂.₅: ${Number.isFinite(p.pm) ? p.pm.toFixed(1) : "--"} µg/m³
      <hr>
      <a href="/ACA_Community/history/sensor_compare.html?sensor_index=${p.sensor_index}" target="_blank">
        View historical data
      </a>
    `)
       // <a href="/LiveMap/purple_history.html?sensor=${encodeURIComponent(p.name)}" target="_blank">   
      // https://dkevinm.github.io/ACA_Community/history/sensor_compare.html?sensor_index=27741
    
    // Add to All + optionally ACA/WCAS
    window.ALLPurple.addLayer(marker);
    if (inACA)  window.ACAPurple.addLayer(marker);
    if (inWCAS) window.WCASPurple.addLayer(marker);
  });


  // Layer control (build once per render; remove old if needed)
  // Optional: store ref to avoid duplicates
  if (window._layerControl) {
    map.removeControl(window._layerControl);
  }

  await loadRoses();

*/

  
  if (window._layerControl) {
    map.removeControl(window._layerControl);
    window._layerControl = null;
  }  

  
  // map.addLayer(window.ALLPurple);
  
  window._layerControl = L.control.layers(null, {
    "ACA Boundary": ACABoundaryLayer,
    "WCAS Boundary": WCASBoundaryLayer,

    "ACA Stations": window.ACAStations,
    "ACA PurpleAir": window.ACAPurple,

    "WCAS Stations": window.WCASStations,
    "WCAS PurpleAir": window.WCASPurple,

    "Estimated AQHI": window.eAQHIStations,
    
    "All Stations (AB)": window.ALLStations,
    "All PurpleAir (AB)": window.ALLPurple,

    "Rose PM2.5": window.RosePM25,
    "Rose NO₂": window.RoseNO2,
    "Rose SO₂": window.RoseSO2,

  }, { collapsed: false }).addTo(map);

    // ---- ROSE FILTER CONTROL ----
    if (!window._roseControlAdded) {
    
      const RoseControl = L.control({ position: "topright" });
    
      RoseControl.onAdd = function () {
        const div = L.DomUtil.create("div", "leaflet-bar");
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        
        div.style.background = "white";
        div.style.padding = "6px";
        div.style.fontSize = "12px";
    
        div.innerHTML = `
          <b>Roses</b><br>
          <label><input type="checkbox" id="roseToggle"> Show</label><br>
          <label><input type="radio" name="roseRegion" value="ALL"> All</label>
          <label><input type="radio" name="roseRegion" value="ACA"> ACA</label><br>
          <label><input type="radio" name="roseRegion" value="WCAS" checked> WCAS</label>
          <label><input type="radio" name="roseRegion" value="OTHER"> Other</label>
        `;
    
        return div;
      };
    
      RoseControl.addTo(map);
    
      // Wire up events
      document.addEventListener("change", e => {
    
        if (e.target.id === "roseToggle") {
          window.roseVisible = e.target.checked;
          renderMap();
        }
    
        if (e.target.name === "roseRegion") {
          window.roseRegionFilter = e.target.value;
          renderMap();
        }
    
      });
    
      window._roseControlAdded = true;
    }


  // ---- ROSES ----
  if (window.roseVisible) {
    await loadRoses();
  } else {
    // ensure they disappear when unchecked
    window.RosePM25.clearLayers();
    window.RoseNO2.clearLayers();
    window.RoseSO2.clearLayers();
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
  async function loadRoses() {

    const map = window.map;

    console.log("Loading roses...");
  
    const types = [
      { key: "PM25", layer: window.RosePM25 },
      { key: "NO2",  layer: window.RoseNO2  },
      { key: "SO2",   layer: window.RoseSO2   }
    ];
  
    for (const t of types) {
  
      t.layer.clearLayers();
  
      const res = await fetch(`data/rose_${t.key}.geojson`);
      const geo = await res.json();
  
      geo.features.forEach(f => {

        const bounds = map.getBounds();
        const lat = f.geometry.coordinates[1];
        const lon = f.geometry.coordinates[0];
        
        if (!bounds.contains([lat, lon])) return;
        
      
        const inACA  = inside(ACApoly,  lat, lon);
        const inWCAS = inside(WCASpoly, lat, lon);
      
        if (!window.roseVisible) return;
      
        if (window.roseRegionFilter === "ACA" && !inACA) return;
        if (window.roseRegionFilter === "WCAS" && !inWCAS) return;
        if (window.roseRegionFilter === "OTHER" && (inACA || inWCAS)) return;

  
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
  
    }
  
    console.log("Roses done.");
  }



