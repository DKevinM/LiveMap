import pandas as pd

df = pd.read_csv("https://raw.githubusercontent.com/DKevinM/AB_datapull/main/data/last6h.csv")
df.to_json("../data/last6h.json", orient="records")
