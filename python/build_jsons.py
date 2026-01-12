from pathlib import Path
import pandas as pd

SRC = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv"
df = pd.read_csv(SRC)

SRC2 = "https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/AB_PA_sensors.csv"
df2 = pd.read_csv(SRC2)


out_dir = Path(__file__).resolve().parent.parent / "data"
out_dir.mkdir(parents=True, exist_ok=True)


df.to_json(out_dir / "last6h.json", orient="records", indent=2)
df2.to_json(out_dir / "AB_PA_sensors.json", orient="records", indent=2)
