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


# Load data
station = pd.read_csv("station_data.csv")
purple  = pd.read_csv("purpleair_data.csv")

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

df.to_json("carrot_creek_eaqhi.json", orient="records")
