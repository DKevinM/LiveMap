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
    "Fine Particulate Matter": "PM25",
    "Nitrogen Dioxide": "NO2",
    "Ozone": "O3"
}

BINS = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
        "S","SSW","SW","WSW","W","WNW","NW","NNW"]


def dir_to_bin(deg):
    d = float(deg)
    d = ((d % 360) + 360) % 360      # forces into [0,360)
    ix = int(((d + 11.25) // 22.5) % 16)
    return BINS[ix]


# -------- PROPER PAGED SUPABASE PULL --------
def fetch_last24():
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"

    params = {
        "select": "StationName,ParameterName,Value,ReadingDate",
        "ReadingDate": f"gte.{since}"
    }

    all_rows = []
    start = 0
    step = 1000

    while True:
        headers = HEADERS.copy()
        headers["Range"] = f"{start}-{start+step-1}"

        r = requests.get(url, headers=headers, params=params)
        r.raise_for_status()

        chunk = r.json()
        if not chunk:
            break

        all_rows.extend(chunk)
        start += step

    df = pd.DataFrame(all_rows)
    df["ReadingDate"] = pd.to_datetime(df["ReadingDate"])
    df["Value"] = pd.to_numeric(df["Value"], errors="coerce")

    return df



def fetch_stations():
    url = f"{SUPABASE_URL}/rest/v1/stations"
    r = requests.get(url, headers=HEADERS)
    r.raise_for_status()

    df = pd.DataFrame(r.json())
    print(df.columns)     # <---- ADD THIS
    print(df.head())      # <---- ADD THIS

    return df



# -------- ROSE BUILDER --------
def build_rose(df, pollutant_name, stations):

    # Separate pollutant and wind direction
    pol = df[df["ParameterName"] == pollutant_name].copy()
    wind = df[df["ParameterName"] == "Wind Direction"].copy()

    # Merge on time + station
    merged = pd.merge(
        pol,
        wind,
        on=["StationName","ReadingDate"],
        suffixes=("_pol","_wind")
    )

    merged = merged.dropna(subset=["Value_pol","Value_wind"])

    merged["bin"] = merged["Value_wind"].apply(dir_to_bin)

    roses = []

    for station, g in merged.groupby("StationName"):

        lat = stations.loc[stations.StationName == station, "Latitude"].iloc[0]
        lon = stations.loc[stations.StationName == station, "Longitude"].iloc[0]

        means = g.groupby("bin")["Value_pol"].mean().to_dict()
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
    stations = fetch_stations()

    OUTPUT_DIR = "../data"

    for name, short in POLLUTANTS.items():
        geo = build_rose(df, name, stations)

        out_path = os.path.join(OUTPUT_DIR, f"rose_{short}.geojson")

        with open(out_path, "w") as f:
            import json
            json.dump(geo, f)

        print("Wrote:", out_path)



if __name__ == "__main__":
    main()
