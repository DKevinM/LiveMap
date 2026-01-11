let purpleair = [];

fetch("data/purpleair_aca.json")
  .then(r => r.json())
  .then(data => purpleair = data);
