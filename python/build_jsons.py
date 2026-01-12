from pathlib import Path
import pandas as pd

# ------------------------------------------------------------------
# 1️⃣ Load your source data
# ------------------------------------------------------------------

# Example — replace this with your real data source
# df = pd.read_csv("input/last6h.csv")
# OR df = fetch_from_database()
# OR df = some_processing_pipeline()

df = pd.read_csv("python/last6h.csv")   

# ------------------------------------------------------------------
# 2️⃣ Ensure output directory exists
# ------------------------------------------------------------------

out_dir = Path(__file__).resolve().parent.parent / "data"
out_dir.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------
# 3️⃣ Write outputs
# ------------------------------------------------------------------

df.to_json(out_dir / "last6h.json", orient="records")
