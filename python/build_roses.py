import os
import json
import requests
import pandas as pd
from datetime import datetime, timedelta, timezone

SUPABASE_URL = os.getenv("SUPABASE_DB_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

TABLE = "aqhi_data"

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


# -------- PROPER PAGED SUPABASE PULL --------
def fetch_last24():
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"

    all_rows = []
    start = 0
    step = 1000

    while True:
        headers = HEADERS.copy()
        headers["Range"] = f"{start}-{start+step-1}"

        params = {
            "select": "station,parameter,value,wind_dir,lat,lon,time",
            "time": f"gte.{since}"
        }

        r = requests.get(url, headers=headers, params=params)
        r.raise_for_status()
        chunk = r.json()

        if not chunk:
            break

        all_rows.extend(chunk)
        start += step

    return pd.DataFrame(all_rows)


# -------- ROSE BUILDER --------
def build_rose(df, pollutant_name):
    df = df[df["parameter"] == pollutant_name].copy()
    df = df.dropna(subset=["value", "wind_dir"])

    df["bin"] = df["wind_dir"].apply(dir_to_bin)

    roses = []

    for station, g in df.groupby("station"):
        lat = g["lat"].iloc[0]
        lon = g["lon"].iloc[0]

        means = g.groupby("bin")["value"].mean().to_dict()
        freq  = g["bin"].value_counts(normalize=True).to_dict()

        props = {b: round(means.get(b, 0), 2) for b in BINS}

        for b in BINS:
            props[f"{b}_freq"] = round(freq.get(b, 0), 3)

        props["station"] = station
        props["max"] = max([v for k, v in props.items() if k in BINS])

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


# -------- MAIN --------
def main():
    df = fetch_last24()

    OUTPUT_DIR = "../LiveMap/data"
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for name, short in POLLUTANTS.items():
        geo = build_rose(df, name)

        out_path = os.path.join(OUTPUT_DIR, f"rose_{short}.geojson")

        with open(out_path, "w") as f:
            json.dump(geo, f)

        print("Wrote:", out_path)


if __name__ == "__main__":
    main()
