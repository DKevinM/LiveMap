window.drawStations = function () {

  console.log("Drawing stations…");

  
  if (!window.map || !window.layerACA || !window.layerWCAS || !window.stationsFC || !window.last6hTable) {
    console.error("Station draw blocked: missing dependency", {
      map: !!window.map,
      layerACA: !!window.layerACA,
      layerWCAS: !!window.layerWCAS,
      stationsFC: !!window.stationsFC,
      last6hTable: !!window.last6hTable
    });
    return;
  }


  // Clear previous
  window.layerACA.clearLayers();
  window.layerWCAS.clearLayers();

  const latest = window.last6hTable;

  window.stationsFC.features.forEach(f => {

    const st = f.properties;
    const lat = f.geometry.coordinates[1];
    const lon = f.geometry.coordinates[0];

    const group = st.Airshed === "ACA" ? window.layerACA : window.layerWCAS;
    

    const row = window.last6hTable.find(r =>
      r.StationName === st.StationName &&
      String(r.ParameterName).toUpperCase() === "AQHI"
    );
    
    let val = null;
    if (row && row.Value !== null && row.Value !== undefined) {
      val = row.Value === "10+" ? 11 : Number(row.Value);
    }

      

    const color = getAQHIColor(val);

    const marker = L.circleMarker([lat, lon], {
      radius: 18,
      color: "black",
      weight: 2,
      fillColor: color,
      fillOpacity: 0.85
    }).addTo(group);

    marker.stationData = { ...st, AQHI: val };

    marker.bindTooltip(
      `<b>${st.StationName}</b><br>AQHI: ${val ?? "NA"}`
    );


    marker.on("click", () => {
      showStationModal(marker.stationData);
      window.showGaugesForStation(marker.stationData);
    });

  });

  console.log("Stations rendered.");
};


  window.buildStationsFC = function () {
  
    if (!window.last6hTable) {
      console.error("No last6hTable available for building stations.");
      return { type: "FeatureCollection", features: [] };
    }
  
    const uniqueStations = {};
  
    window.last6hTable.forEach(r => {
      if (!r.Lat || !r.Lon || !r.StationName) return;
  
      if (!uniqueStations[r.StationName]) {
        uniqueStations[r.StationName] = {
          StationName: r.StationName,
          Lat: Number(r.Lat),
          Lon: Number(r.Lon),
          Airshed: r.Airshed || "Unknown"
        };
      }
    });
  
    return {
      type: "FeatureCollection",
      features: Object.values(uniqueStations).map(st => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [st.Lon, st.Lat]
        },
        properties: st
      }))
    };
  };

  window.initStations = async function () {
    if (!window.map || !window.layerACA || !window.layerWCAS) {
      console.error("Map not ready for stations");
      return;
    }
  
    window.drawStations();
    return { ACA: window.layerACA, WCAS: window.layerWCAS };
  };

