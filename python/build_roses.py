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


def speed_bin(ws):
    ws = float(ws)
    if ws < 2: return "calm"
    if ws < 20: return "low"
    if ws < 40: return "med"
    return "high"




# -------- PROPER PAGED SUPABASE PULL --------
def fetch_last24():
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"

    params = {
        "select": "StationName,ParameterName,Value,ReadingDate",
        "ParameterName": "in.(Fine Particulate Matter,Nitrogen Dioxide,Ozone,Wind Direction)",
        "ReadingDate": f"gte.{since}",
        "order": "ReadingDate.asc"
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

    params = {
        "select": "StationName,Latitude,Longitude"
    }

    r = requests.get(url, headers=HEADERS, params=params)
    r.raise_for_status()

    df = pd.DataFrame(r.json())

    # Force exactly what we expect
    df = df.rename(columns=str.strip)
    df = df[["StationName", "Latitude", "Longitude"]]

    return df




# -------- ROSE BUILDER --------
def build_rose(df, pollutant_name, stations):

    # Separate pollutant and wind direction
    # --- Pull the three required parameters ---
    pol  = df[df["ParameterName"] == pollutant_name].copy()
    wdir = df[df["ParameterName"] == "Wind Direction"].copy()
    wspd = df[df["ParameterName"] == "Wind Speed"].copy()
    
    # --- First merge pollutant with wind direction ---
    merged = pd.merge(
        pol,
        wdir,
        on=["StationName","ReadingDate"],
        suffixes=("_pol","_wdir")
    )
    
    # --- Then merge in wind speed ---
    merged = pd.merge(
        merged,
        wspd,
        on=["StationName","ReadingDate"]
    )
    
    merged = merged.dropna(subset=["Value_pol","Value_wdir","Value"])
    
    # Rename wind speed column for clarity
    merged = merged.rename(columns={"Value": "Value_ws"})
    
    # --- Create bins ---
    merged["dir_bin"] = merged["Value_wdir"].apply(dir_to_bin)
    merged["spd_bin"] = merged["Value_ws"].apply(speed_bin)


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

    
    OUTPUT_DIR = "data"
    os.makedirs(OUTPUT_DIR, exist_ok=True)


    for name, short in POLLUTANTS.items():
        geo = build_rose(df, name, stations)

        out_path = os.path.join(OUTPUT_DIR, f"rose_{short}.geojson")

        with open(out_path, "w") as f:
            import json
            json.dump(geo, f)

        print("Wrote:", out_path)



if __name__ == "__main__":
    main()
