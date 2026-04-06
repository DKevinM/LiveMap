function buildPopupWeatherTable(data) {
  const now = new Date();
  let i = 0;

  while (i < data.hourly.time.length) {
    if (new Date(data.hourly.time[i]) >= now) break;
    i++;
  }

  let rows = "";
  for (let j = 0; j < 6; j++) {
    const t = new Date(data.hourly.time[i + j]);
    rows += `
      <tr>
        <td>${t.toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit"})}</td>
        <td>${Math.round(data.hourly.temperature_2m[i+j])}°C</td>
        <td>${Math.round(data.hourly.wind_speed_10m[i+j])} km/h 
            ${degToCardinal(data.hourly.wind_direction_10m[i+j])}</td>
        <td>${data.hourly.precipitation[i+j].toFixed(1)} mm</td>
        <td>${Math.round(data.hourly.uv_index[i+j])}</td>
      </tr>
    `;
  }

  return `
    <div style="margin-top:10px;">
      <div style="font-weight:600; margin-bottom:6px;">
        Weather (next 6 hours)
      </div>
      <table style="width:100%; font-size:11px; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid #ccc;">
            <th align="left">Time</th>
            <th align="left">Temp</th>
            <th align="left">Wind</th>
            <th align="left">Precip</th>
            <th align="left">UV</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}





window.handleMapClick = async function(lat, lng, map) {

  if (typeof window.clearSelection === "function") {
    window.clearSelection();
    const panel = document.getElementById("panel");
    if (panel) panel.classList.remove("collapsed");
  }
  if (typeof window.updateAQHIFromClick === "function") {
    // await window.updateAQHIFromClick(lat, lng);
  } else {
    console.error("updateAQHIFromClick not found");
  }  


  
  // ---- CLEAR PREVIOUS CLICK STATE ----
  if (window.layers?.stations) {
    window.layers.stations.clearLayers();
  }
  
  let weatherData = null;
  let weatherHtml = "";


  // ---- 1) Marker at clicked point ----
  const marker = L.marker([lat, lng]);
  if (window.layers?.stations) {
    window.layers.stations.addLayer(marker);
  }  
  if (window.layers?.stations) {
    window.layers.stations.addLayer(circle);
  }  

  // ---- 2) TWO CLOSEST AQHI STATIONS ----
  const closestStations = Object.values(dataByStation)
    .map(arr => {
      const aqhiRow = arr.find(d => d.ParameterName === "AQHI");
      if (!aqhiRow) return null;
  
      return {
        station: aqhiRow.StationName,
        lat: Number(aqhiRow.Latitude),
        lng: Number(aqhiRow.Longitude),
        aqhi: (aqhiRow.Value == null || aqhiRow.Value === "")
          ? null
          : Math.round(Number(aqhiRow.Value)),
        dist_km: getDistance(lat, lng, aqhiRow.Latitude, aqhiRow.Longitude) / 1000
      };
    })
    .filter(s => s && isFinite(s.lat) && isFinite(s.lng))
    .sort((a,b) => a.dist_km - b.dist_km)
    .slice(0,2);

  closestStations.forEach(st => {
    const circle = L.circleMarker([st.lat, st.lng], {
      radius: 15,
      color: "#000",
      fillColor: isFinite(st.aqhi) ? getColor(st.aqhi) : "#999",
      weight: 3,
      fillOpacity: 0.8
    });
    window.layers.stations.addLayer(circle);
  });

  

  // ==============================
  // UPDATE LEFT AQHI PANEL
  // ==============================
  if (closestStations && closestStations.length > 0) {
    const s = closestStations[0];
    const aqhiVal = (s.aqhi !== null && isFinite(s.aqhi)) ? s.aqhi : null;
    const aqhiEl = document.getElementById("aqhi-current");
    if (aqhiEl) aqhiEl.textContent = aqhiVal !== null ? aqhiVal : "—";
    const titleEl = document.getElementById("panel-title");
    if (titleEl) {
      titleEl.textContent = `${s.station || "Unknown"} Air Quality (AQHI)`;
    }
    const timeEl = document.getElementById("aqhi-updated");
    if (timeEl) {
      timeEl.textContent = "Latest available";
    }
  }




  
  // ---- 3) REVERSE GEOCODE ----
  let addressText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
    );
    const geo = await r.json();

    if (geo && geo.display_name) {
      addressText = geo.display_name;
    }
  } catch (e) {
    console.warn("Reverse geocoding failed", e);
  }

  // ---- 4) WEATHER ----
  weatherData = await window.fetchWeather(lat, lng);
  const current = window.extractCurrentWeather(weatherData);
  
  if (current && window.renderPanelWeather) {
    window.renderPanelWeather(current);
  }

  
  if (weatherData) {
    weatherHtml = buildPopupWeatherTable(weatherData);
  }


  
  // ---- 5) PURPLEAIR ----
  let closestPA = [];

  try {
    const paList = window.AppData?.purpleair || [];
    
    closestPA = paList
      .map(s => ({
        name: s.name || "PurpleAir",
        pm: s.pm ?? null,
        lat: Number(s.lat),
        lng: Number(s.lon),
        dist_km: getDistance(lat, lng, Number(s.lat), Number(s.lon)) / 1000
      }))
      .filter(s => isFinite(s.lat) && isFinite(s.lng))
      .sort((a,b) => a.dist_km - b.dist_km)
      .slice(0,3);

  } catch (e) {
    console.warn("PurpleAir nearest lookup failed:", e);
  }

  // ---- 6) POPUP ----
  const stRows = closestStations.map(s => `
    <tr>
      <td>${s.station}</td>
      <td style="text-align:center;">
        ${isFinite(s.aqhi) ? s.aqhi : "—"}
      </td>
      <td style="text-align:right;">${s.dist_km.toFixed(1)} km</td>
    </tr>
  `).join("");
  
  const stTable = `
    <table style="width:100%; font-size:11px;">
      <thead>
        <tr>
          <th align="left">Station</th>
          <th align="center">AQHI</th>
          <th align="right">Dist</th>
        </tr>
      </thead>
      <tbody>
        ${stRows}
      </tbody>
    </table>
  `;
  
  const paRows = closestPA.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.pm == null ? "—" : Number(p.pm).toFixed(1)}</td>
      <td>${p.dist_km.toFixed(1)} km</td>
    </tr>
  `).join("");
  
  const paTable = `
    <table style="width:100%; font-size:11px;">
      <thead>
        <tr>
          <th align="left">Sensor</th>
          <th align="left">PM2.5 (µg/m³)</th>
          <th align="right">Dist</th>
        </tr>
      </thead>
      <tbody>
        ${paRows}
      </tbody>
    </table>
  `;

  const popupHtml = `
    <div style="font-size:12px; line-height:1.25;">
  
      <div style="font-weight:700; margin-bottom:6px;">
        Nearest stations & sensors
      </div>
  
      <div style="font-weight:600; margin:6px 0 3px;">
        AQHI stations (2)
      </div>
      ${stTable}
  
      <div style="font-weight:600; margin:8px 0 3px;">
        PurpleAir (3)
      </div>
      ${paTable}
  
      ${weatherHtml}
  
    </div>
  `;


  

  if (typeof window.updatePanelLocation === "function") {
    window.updatePanelLocation(addressText, lat, lng);
  }

  marker.bindPopup(popupHtml, {
    maxWidth: 420,
    minWidth: 380,
    autoPanPadding: [20, 20]
  }).openPopup();
}
