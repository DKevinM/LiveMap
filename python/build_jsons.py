from pathlib import Path
import sys
import pandas as pd

SRC = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv"
SRC2 = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PA_sensors.csv"

out_dir = Path(__file__).resolve().parent.parent / "data"
out_dir.mkdir(parents=True, exist_ok=True)

errors = []

try:
    df = pd.read_csv(SRC)
    df.to_json(out_dir / "last6h.json", orient="records", indent=2)
    print(f"Saved last6h.json ({len(df)} rows)")
except Exception as e:
    errors.append(f"last6h: {e}")
    print(f"WARNING: could not fetch last6h data: {e}", file=sys.stderr)

try:
    df2 = pd.read_csv(SRC2)
    df2.to_json(out_dir / "AB_PA_sensors.json", orient="records", indent=2)
    print(f"Saved AB_PA_sensors.json ({len(df2)} rows)")
except Exception as e:
    errors.append(f"AB_PA_sensors: {e}")
    print(f"WARNING: could not fetch PurpleAir sensor list: {e}", file=sys.stderr)

if errors:
    print(f"Completed with {len(errors)} warning(s): {'; '.join(errors)}", file=sys.stderr)
