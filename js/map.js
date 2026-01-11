const map = L.map("map").setView([53.518, -115.917], 7);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

function distance(a, b) {
  return map.distance([a.lat, a.lon], [b.lat, b.lon]);
}

function findClosest(lat, lon, list, n=1) {
  return list
    .map(p => ({
      ...p,
      d: map.distance([lat,lon],[p.Lat ?? p.lat, p.Lon ?? p.lon])
    }))
    .sort((a,b)=>a.d-b.d)
    .slice(0,n);
}

map.on("click", e => {
  const lat = e.latlng.lat;
  const lon = e.latlng.lng;

  const nearestStations = findClosest(lat, lon, stations, 2);
  const nearestPA = findClosest(lat, lon, purpleair, 3);

  showLocationModal(lat, lon, nearestStations, nearestPA);
});
