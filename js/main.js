window.addEventListener("load", () => {

  const mapDiv = document.getElementById("map");

  console.log("Map div check:", mapDiv);

  if (!mapDiv) {
    console.error("Map div STILL not found — stopping.");
    return;
  }

  initMap();

});
