import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# -------- SETTINGS --------
INPUT_CSV = "data/last6h.csv"
OUTPUT_DIR = "roses"
POLLUTANT = "Fine Particulate Matter"   # change to "AQHI" or "Ozone" etc
WD_COL = "Wind Direction"
WS_COL = "Wind Speed"
BIN_SIZE = 10  # degrees
PERCENTILE = 0.90  # P90 rose (very informative)

os.makedirs(OUTPUT_DIR, exist_ok=True)

# -------- LOAD DATA --------
df = pd.read_csv(INPUT_CSV)

# Clean column names just in case
df.columns = df.columns.str.strip()

# Ensure numeric
df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
df[WD_COL] = pd.to_numeric(df[WD_COL], errors="coerce")

# -------- FUNCTION TO BUILD ROSE --------
def build_rose(station_df, station_name):
    bins = np.arange(0, 360 + BIN_SIZE, BIN_SIZE)

    station_df["dir_bin"] = pd.cut(
        station_df[WD_COL],
        bins=bins,
        right=False,
        include_lowest=True
    )

    rose = (
        station_df.groupby("dir_bin")["Value"]
        .quantile(PERCENTILE)
        .reset_index()
    )

    # Bin centers for plotting
    centers = [b.left + BIN_SIZE / 2 for b in rose["dir_bin"]]
    theta = np.deg2rad(centers)
    values = rose["Value"].values

    # Normalize for color scale
    vmax = np.nanmax(values)
    colors = plt.cm.inferno(values / vmax if vmax > 0 else values)

    fig = plt.figure(figsize=(6, 6), dpi=200)
    ax = fig.add_subplot(111, polar=True)

    bars = ax.bar(
        theta,
        values,
        width=np.deg2rad(BIN_SIZE),
        bottom=0,
        color=colors,
        edgecolor="none"
    )

    ax.set_theta_zero_location("N")
    ax.set_theta_direction(-1)
    ax.set_axis_off()

    outfile = os.path.join(OUTPUT_DIR, f"{station_name}.png")
    plt.savefig(outfile, transparent=True, bbox_inches="tight", pad_inches=0)
    plt.close()
    print(f"Built rose for {station_name}")


# -------- BUILD ROSES FOR EACH STATION --------
stations = df["StationName"].unique()

for station in stations:
    sdf = df[
        (df["StationName"] == station) &
        (df["ParameterName"] == POLLUTANT)
    ].copy()

    # Need wind data too
    wind = df[
        (df["StationName"] == station) &
        (df["ParameterName"] == WD_COL)
    ][["ReadingDate", "Value"]].rename(columns={"Value": WD_COL})

    sdf = sdf.merge(wind, on="ReadingDate", how="inner")

    if len(sdf) < 10:
        continue

    build_rose(sdf, station.replace(" ", "_"))
