window.addEventListener("load", async () => {
  console.log("App starting...");

  // ----------------------------
  // WAIT FOR ALL DATA
  // ----------------------------
  if (window.loadAllData) {
    await window.loadAllData();
  } else {
    console.warn("loadAllData not found");
  }

  // ----------------------------
  // INIT MAP
  // ----------------------------
  if (typeof window.initMap === "function") {
    window.initMap();
  } else {
    console.error("initMap is not available");
    return;
  }

  console.log("Map initialized");


  // ----------------------------
  // RENDER DATA INTO LAYERS
  // ----------------------------
  if (window.renderMap) {
    window.renderMap();
  } else {
    console.warn("renderMap not found");
  }

  console.log("App ready");
});
