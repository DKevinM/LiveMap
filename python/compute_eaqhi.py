import argparse
import sys
import pandas as pd
import numpy as np

def aqhi(o3, no2, pm25):

    val = (1000/10.4) * (
        np.exp(0.000537 * o3) +
        np.exp(0.000871 * no2) +
        np.exp(0.000487 * pm25) - 3
    )

    val = round(val)

    if val > 10:
        val = "10+"

    return val

def main():
    parser = argparse.ArgumentParser(description="Compute estimated AQHI from station + PurpleAir data")
    parser.add_argument("--station",  default="station_data.csv",  help="Path to station CSV")
    parser.add_argument("--purpleair", default="purpleair_data.csv", help="Path to PurpleAir CSV")
    parser.add_argument("--output",   default="carrot_creek_eaqhi.json", help="Output JSON path")
    args = parser.parse_args()

    try:
        station = pd.read_csv(args.station)
    except FileNotFoundError:
        print(f"ERROR: station file not found: {args.station}", file=sys.stderr)
        sys.exit(1)

	
    try:
        purple = pd.read_csv(args.purpleair)
    except FileNotFoundError:
        print(f"ERROR: PurpleAir file not found: {args.purpleair}", file=sys.stderr)
        sys.exit(1)

    # merge timestamps
    df = station.merge(purple, on="datetime")

	
    # 3-hour averages
    df["O3_3h"]  = df["O3"].rolling(3).mean()
    df["NO2_3h"] = df["NO2"].rolling(3).mean()
    df["PM25_3h"]= df["PM25"].rolling(3).mean()
    # compute eAQHI
    df["eAQHI"] = df.apply(
        lambda r: aqhi(r.O3_3h, r.NO2_3h, r.PM25_3h),
        axis=1
    )
    df.to_json(args.output, orient="records")
    print(f"Wrote {len(df)} rows to {args.output}")
if __name__ == "__main__":
    main()

