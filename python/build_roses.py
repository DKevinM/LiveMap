import os
import json
import requests
import pandas as pd
from datetime import datetime, timedelta, timezone
import time

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}"
}

# Read the live table directly. Until 2026-09-28 this read "rose_data_7day",
# a one-off snapshot of aqhi_data that nothing ever refreshed - so every
# hourly run rebuilt identical June 13-20 roses, git saw no change, and the
# workflow reported success for 3 months while the map showed stale roses.
TABLE = "aqhi_data"
ROSE_PARAMETERS = [
    "Fine Particulate Matter", "Nitrogen Dioxide", "Sulphur Dioxide",
    "Wind Direction", "Wind Speed",
]
# Fail the run (red X in Actions) rather than quietly publish old roses.
MAX_DATA_AGE_HOURS = 6

POLLUTANTS = {
    "Fine Particulate Matter": "PM25",
    "Nitrogen Dioxide": "NO2",
    "Sulphur Dioxide": "SO2"
}

BINS = [
    "N","NNE","NE","ENE",
    "E","ESE","SE","SSE",
    "S","SSW","SW","WSW",
    "W","WNW","NW","NNW"
]


def dir_to_bin(deg):
    d = float(deg)
    d = ((d % 360) + 360) % 360
    ix = int(((d + 11.25) // 22.5) % 16)
    return BINS[ix]



def speed_bin(ws):
    ws = float(ws)
    if ws < 2: return "calm"
    if ws < 10: return "low"
    if ws < 25: return "med"
    return "high"




# -------- PROPER PAGED SUPABASE PULL --------

def _fetch_window(url, param_filter, t0, t1):
    """All rose rows with t0 <= ReadingDate < t1, in ONE unsorted request.
    Supabase caps a response at 1000 rows; if a window comes back full it
    may have been truncated, so split it in half and fetch each half."""
    params = {
        "select": "StationName,ParameterName,Value,ReadingDate",
        "ParameterName": param_filter,
        "and": f"(ReadingDate.gte.{t0.isoformat()},ReadingDate.lt.{t1.isoformat()})",
    }
    # The anon key gets a short statement timeout, and aqhi_data is busy while
    # the hourly ingest writes to it - an occasional window times out (57014)
    # even at 2 h (2 of 4 runs on 2026-09-29). Retry with a pause, then fall
    # back to fetching the window as two halves, before giving up.
    for attempt in range(3):
        r = requests.get(url, headers=HEADERS, params=params, timeout=60)
        if r.status_code in (200, 206):
            break
        timed_out = "57014" in r.text
        print(f"  {t0:%m-%d %H:%M} window: HTTP {r.status_code}{' (statement timeout)' if timed_out else ''}, attempt {attempt + 1}/3")
        if not timed_out:
            break
        time.sleep(5 * (attempt + 1))
    else:
        if t1 - t0 > timedelta(minutes=30):
            mid = t0 + (t1 - t0) / 2
            return _fetch_window(url, param_filter, t0, mid) + _fetch_window(url, param_filter, mid, t1)
    if r.status_code not in (200, 206):
        print("Response:")
        print(r.text)
    r.raise_for_status()
    rows = r.json()
    if len(rows) >= 1000:
        if t1 - t0 <= timedelta(minutes=30):
            raise SystemExit(f"{len(rows)} rows in a 30-min window at {t0} - can't split further, raise the row cap")
        mid = t0 + (t1 - t0) / 2
        return _fetch_window(url, param_filter, t0, mid) + _fetch_window(url, param_filter, mid, t1)
    return rows


def fetch_last7days():
    """Last 168 h of the rose parameters, straight from aqhi_data.

    Fetched in 2-hour windows with no ORDER BY and no Range paging: a single
    7-day query - or even a sorted, offset-paged one-day query - hits
    Supabase's statement timeout (57014) on aqhi_data (2025-onward, every
    parameter), while an unsorted 2-hour slice (~700 rows) returns in a
    fraction of a second. That timeout is presumably why the old
    rose_data_7day snapshot existed at all."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=168)

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    param_filter = "in.(" + ",".join(f'"{p}"' for p in ROSE_PARAMETERS) + ")"
    all_rows = []

    t0 = since
    while t0 < now:
        t1 = min(t0 + timedelta(hours=2), now)
        all_rows.extend(_fetch_window(url, param_filter, t0, t1))
        t0 = t1

    df = pd.DataFrame(all_rows)
    print("Rows pulled:", len(df))
    if df.empty:
        raise SystemExit(f"No rows in {TABLE} since {since:%Y-%m-%d %H:%M} UTC - refusing to write empty roses")
    df["ReadingDate"] = pd.to_datetime(df["ReadingDate"])
    df["Value"] = pd.to_numeric(df["Value"], errors="coerce")

    newest = df["ReadingDate"].max()
    age_h = (now - newest).total_seconds() / 3600
    print(f"Data window: {df['ReadingDate'].min():%Y-%m-%d %H:%M} to {newest:%Y-%m-%d %H:%M} UTC (newest is {age_h:.1f} h old)")
    if age_h > MAX_DATA_AGE_HOURS:
        raise SystemExit(f"Newest reading is {age_h:.0f} h old (limit {MAX_DATA_AGE_HOURS} h) - source is stale, not publishing roses")
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

    # ---- Pivot parameters into columns by hour ----
    pol = df[df["ParameterName"] == pollutant_name].copy()
    pol = pol.rename(columns={"Value": "Value_pol"})
    
    wdir = df[df["ParameterName"] == "Wind Direction"].copy()
    wdir = wdir.rename(columns={"Value": "Value_wdir"})
    
    wspd = df[df["ParameterName"] == "Wind Speed"].copy()
    wspd = wspd.rename(columns={"Value": "Value_ws"})
    
    # ---- REQUIRED FOR merge_asof ----
    pol  = pol.sort_values(["ReadingDate", "StationName"]).reset_index(drop=True)
    wdir = wdir.sort_values(["ReadingDate", "StationName"]).reset_index(drop=True)
    wspd = wspd.sort_values(["ReadingDate", "StationName"]).reset_index(drop=True)

    
    # attach nearest wind direction
    merged = pd.merge_asof(
        pol,
        wdir,
        on="ReadingDate",
        by="StationName",
        suffixes=("_pol","_wdir"),
        tolerance=pd.Timedelta("30min"),
        direction="nearest"
    )
    
    # attach nearest wind speed
    merged = pd.merge_asof(
        merged,
        wspd,
        on="ReadingDate",
        by="StationName",
        suffixes=("","_ws"),
        tolerance=pd.Timedelta("30min"),
        direction="nearest"
    )
    
    merged = merged.dropna(subset=["Value_pol","Value_wdir","Value_ws"])

    print(f"Building rose for {pollutant_name} ({len(merged)} rows after merge)")
	
    merged["dir_bin"] = merged["Value_wdir"].apply(dir_to_bin)
    merged["spd_bin"] = merged["Value_ws"].apply(speed_bin)

    roses = []

    for station, g in merged.groupby("StationName"):

        loc = stations.loc[stations.StationName == station]
        if loc.empty:
            # reporting in aqhi_data but missing from the stations table
            # (e.g. a station added since that table was last filled) -
            # skip it rather than crash every other station's rose
            print(f"  skip {station}: no coordinates in the stations table")
            continue
        lat = loc["Latitude"].iloc[0]
        lon = loc["Longitude"].iloc[0]

        # 2D matrix: dir x speed
        matrix = g.groupby(["dir_bin","spd_bin"])["Value_pol"].mean()
        counts = g.groupby(["dir_bin","spd_bin"])["Value_pol"].size()

        
        total_val = matrix.sum()
        
        props = {}
        
        sector_totals = {}
        

        for d in BINS:
            sector_total = 0  # <-- don't use "total" for mean roses (doesn't mean anything)
            for s in ["calm","low","med","high"]:
                val = float(matrix.get((d,s), 0) or 0)
                n   = int(counts.get((d,s), 0) or 0)
        
                props[f"{d}_{s}"] = round(val, 2)       # mean concentration in that bin
                props[f"{d}_{s}_n"] = n                 # optional counts
        
            # optional: a direction-level mean across speeds, weighted by counts
            wsum = 0.0
            nsum = 0
            for s in ["calm","low","med","high"]:
                v = float(matrix.get((d,s), 0) or 0)
                n = int(counts.get((d,s), 0) or 0)
                wsum += v * n
                nsum += n
            props[f"{d}_mean"] = round(wsum/nsum, 2) if nsum else 0
            props[f"{d}_n"] = nsum
            
	
            # Summary stats computed once after all directions are populated
            props["overall_mean"] = round(g["Value_pol"].mean(), 2)
            props["n_total"] = int(len(g))
            props["station"] = station
            props["pollutant"] = pollutant_name
            props["period"] = "Last 7 Days"
            props["start_date"] = g["ReadingDate"].min().strftime("%Y-%m-%d %H:%M")
            props["end_date"]   = g["ReadingDate"].max().strftime("%Y-%m-%d %H:%M")
            direction_means = {d: props.get(f"{d}_mean", 0) for d in BINS}
            dominant = max(direction_means, key=direction_means.get)
            props["dominant_dir"] = dominant
            props["dominant_value"] = round(direction_means[dominant], 2)            
            dir_counts      = {d: props.get(f"{d}_n", 0)    for d in BINS}
            total_counts = sum(dir_counts.values())
            
            if total_counts > 0:
                props["dominant_percent"] = round(
                    (dir_counts[dominant] / total_counts) * 100, 1
                )
            else:
                props["dominant_percent"] = 0
     
	
        calm_total = sum(int(counts.get((d, "calm"), 0)) for d in BINS)
        if total_counts > 0:
            props["calm_percent"] = round(
                (calm_total / total_counts) * 100, 1
            )
        else:
            props["calm_percent"] = 0
            
        
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
    df = fetch_last7days()


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
