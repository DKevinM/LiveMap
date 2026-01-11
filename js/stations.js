let stations = [];

fetch("data/stations.json")
  .then(r => r.json())
  .then(data => stations = data);
