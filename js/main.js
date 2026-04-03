document.addEventListener("DOMContentLoaded", () => {
  const mapDiv = document.getElementById("map");
  console.log("Map div check:", mapDiv);

  if (!mapDiv) {
    console.error("MAP DIV NOT FOUND");
    return;
  }

  if (typeof window.initMap !== "function") {
    console.error("initMap is not available");
    return;
  }

  window.initMap();

  console.log("Map initialized successfully");
});
