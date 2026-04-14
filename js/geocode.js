async function lookupAddress() {
  const address = document.getElementById("addressInput").value;
  if (!address) return;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    const data = await res.json();

    if (!data || data.length === 0) {
      alert("Address not found");
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    console.log("Geocoded:", lat, lon);

    
    handleMapClickFromCoords(lat, lon);

  } catch (err) {
    console.error("Geocode error:", err);
  }
}
