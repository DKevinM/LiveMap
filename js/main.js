window.onload = function () {

  const mapDiv = document.getElementById("map");
  console.log("Map div check:", mapDiv);

  if (!mapDiv) {
    alert("MAP DIV NOT FOUND");
    return;
  }

  initMap();

};
