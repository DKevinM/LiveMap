from pathlib import Path
import pandas as pd

# Ensure output directory exists
out_dir = Path(__file__).resolve().parent.parent / "data"
out_dir.mkdir(parents=True, exist_ok=True)

# your dataframe logic...
df.to_json(out_dir / "last6h.json", orient="records")
