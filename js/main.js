document.addEventListener("DOMContentLoaded", () => {

  const mapDiv = document.getElementById("map");
  console.log("Map div check:", mapDiv);

  if (!mapDiv) {
    console.error("MAP DIV NOT FOUND");
    return;
  }

  initMap();

});
