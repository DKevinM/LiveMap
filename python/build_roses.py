import os
import math
import requests
import pandas as pd
from datetime import datetime, timedelta, timezone

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

TABLE = "aqhi_data"   # change if needed

POLLUTANTS = {
    "PM2.5": "PM25",
    "Nitrogen Dioxide": "NO2",
    "Ozone": "O3"
}

BINS = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
        "S","SSW","SW","WSW","W","WNW","NW","NNW"]


def dir_to_bin(deg):
    d = (deg + 11.25) % 360
    return BINS[int(d // 22.5)]


def fetch_last24():
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    params = {
        "select": "station,parameter,value,wind_dir,lat,lon,time",
        "time": f"gte.{since}"
    }

    r = requests.get(url, headers=HEADERS, params=params)
    r.raise_for_status()
    return pd.DataFrame(r.json())


def build_rose(df, pollutant_name):
    df = df[df["parameter"] == pollutant_name].copy()
    df = df.dropna(subset=["value", "wind_dir"])

    df["bin"] = df["wind_dir"].apply(dir_to_bin)

    roses = []

    for station, g in df.groupby("station"):
        lat = g["lat"].iloc[0]
        lon = g["lon"].iloc[0]

        means = g.groupby("bin")["value"].mean().to_dict()

        props = {b: round(means.get(b, 0), 2) for b in BINS}
        props["station"] = station
        props["max"] = max(props.values())

        roses.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat]
            },
            "properties": props
        })

    return {
        "type": "FeatureCollection",
        "features": roses
    }


def main():
    df = fetch_last24()

    for name, short in POLLUTANTS.items():
        geo = build_rose(df, name)
        with open(f"rose_{short}.geojson", "w") as f:
            import json
            json.dump(geo, f)

    print("Roses built:", datetime.now())


if __name__ == "__main__":
    main()
