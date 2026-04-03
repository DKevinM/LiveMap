window.handleMapClick = async function(lat, lng, map) {

  let weatherData = null;
  let weatherHtml = "";



  // ---- 1) Marker at clicked point ----
  const marker = L.marker([lat, lng]);
  window.layers.stations.addLayer(marker);

  // ---- 2) TWO CLOSEST AQHI STATIONS ----
  const closestStations = Object.values(dataByStation)
    .map(arr => arr.find(d => d.ParameterName === "AQHI") || arr[0])
    .map(r => ({
      station: r.StationName,
      lat: Number(r.Latitude),
      lng: Number(r.Longitude),
      aqhi: (r.Value == null || r.Value === "" ? null : Math.round(Number(r.Value))),
      dist_km: getDistance(lat, lng, r.Latitude, r.Longitude) / 1000
    }))
    .filter(s => isFinite(s.lat) && isFinite(s.lng))
    .sort((a,b) => a.dist_km - b.dist_km)
    .slice(0,2);

  closestStations.forEach(st => {
    const circle = L.circleMarker([st.lat, st.lng], {
      radius: 15,
      color: "#000",
      fillColor: getColor(st.aqhi),
      weight: 3,
      fillOpacity: 0.8
    });
    window.layers.stations.addLayer(circle);
  });

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
  
  //  ADD THIS BLOCK RIGHT HERE
  if (current) {
    weatherHtml = `
      <div style="font-weight:600; margin:8px 0 3px;">
        Current Weather
      </div>
      <table style="width:100%; font-size:11px;">
        <tr><td>Temp</td><td>${Math.round(current.temp)} °C</td></tr>
        <tr><td>RH</td><td>${Math.round(current.rh)} %</td></tr>
        <tr><td>Wind</td><td>${Math.round(current.wind)} km/h ${degToCardinal(current.dir)}</td></tr>
        <tr><td>Precip</td><td>${current.precip.toFixed(1)} mm</td></tr>
        <tr><td>UV</td><td>${Math.round(current.uv)}</td></tr>
      </table>
    `;
  }

  // ---- AQHI UPDATE (NEW) ----
  if (typeof window.updateAQHIFromClick === "function") {
    window.updateAQHIFromClick(lat, lng);
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
      <td>${s.aqhi ?? "—"}</td>
      <td>${s.dist_km.toFixed(1)} km</td>
    </tr>
  `).join("");

  const paRows = (closestPA.length
    ? closestPA
    : [{name:"(PurpleAir not loaded)", pm:"—", dist_km:0}]
  ).map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${(p.pm == null ? "—" : Number(p.pm).toFixed(1))}</td>
      <td>${p.dist_km ? p.dist_km.toFixed(1)+" km" : ""}</td>
    </tr>
  `).join("");

  const popupHtml = `
    <div style="font-size:12px; line-height:1.25;">
      <div style="font-weight:700; margin-bottom:6px;">
        Nearest stations & sensors
      </div>

      <div style="font-weight:600; margin:6px 0 3px;">
        AQHI stations (2)
      </div>
      <table style="width:100%; font-size:11px;">
        ${stRows}
      </table>

      <div style="font-weight:600; margin:8px 0 3px;">
        PurpleAir (3)
      </div>
      <table style="width:100%; font-size:11px;">
        ${paRows}
      </table>

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
