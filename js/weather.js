function degToCardinal(deg) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}


window.fetchWeather = async function(lat, lng) {

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,relative_humidity_2m,precipitation,cloudcover,` +
    `wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index` +
    `&timezone=America%2FEdmonton`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    return data;

  } catch (e) {
    console.warn("Weather fetch failed:", e);
    return null;
  }
};


window.extractCurrentWeather = function (data) {
  const now = new Date();
  let i = 0;

  while (i < data.hourly.time.length) {
    if (new Date(data.hourly.time[i]) >= now) break;
    i++;
  }

  return {
    time: now.toLocaleString("en-CA", { timeZone: "America/Edmonton" }),
    temp: data.hourly.temperature_2m[i],
    rh: data.hourly.relative_humidity_2m[i],
    precip: data.hourly.precipitation[i],
    cloud: data.hourly.cloudcover?.[i],
    uv: data.hourly.uv_index[i],
    wind: data.hourly.wind_speed_10m[i],
    gust: data.hourly.wind_gusts_10m?.[i],
    dir: data.hourly.wind_direction_10m[i]
  };
};
