"""
prep_data.py
------------
Turns the raw Tableau sample workbook into the small CSV the web page reads.

One row per Year x College x Gift Allocation (the same grain as the
Tableau bubbles), with the summed amount, number of gifts and distinct donors.

Run from the project folder:
    pip install pandas xlrd
    python data/prep_data.py
"""
import pandas as pd
from pathlib import Path

HERE = Path(__file__).parent
RAW = HERE / "advancement_donations_and_giving_demo.xls"
OUT = HERE / "bubbles.csv"

df = pd.read_excel(RAW, sheet_name="GiftRecords", engine="xlrd")
df["Year"] = df["Gift Date"].dt.year

bubbles = (
    df.groupby(["Year", "College", "Gift Allocation"])
      .agg(Amount=("Gift Amount", "sum"),
           Gifts=("Gift Amount", "size"),
           Donors=("Prospect ID", "nunique"))
      .reset_index()
      .rename(columns={"Gift Allocation": "Allocation"})
)
bubbles.to_csv(OUT, index=False)

# ---- Chapter 3: one row per donor, largest giver first ----
by_alloc = df.groupby(["Prospect ID", "Gift Allocation"])["Gift Amount"].sum().unstack(fill_value=0)
donors = (
    df.groupby("Prospect ID")
      .agg(Amount=("Gift Amount", "sum"), Gifts=("Gift Amount", "size"))
      .assign(Allocation=by_alloc.idxmax(axis=1),     # where most of their money went
              Allocations=(by_alloc > 0).sum(axis=1)) # how many allocations they gave to
      .join(by_alloc)                                  # dollars to each allocation
      .sort_values("Amount", ascending=False)
      .reset_index()
      .rename(columns={"Prospect ID": "Donor"})
)
donors["Rank"] = range(1, len(donors) + 1)
donors["CumShare"] = (donors["Amount"].cumsum() / donors["Amount"].sum()).round(6)
donors.to_csv(HERE / "donors.csv", index=False)

# ---- Chapter 4: donors per college x allocation ----
# Careful with scope: a donor who gave to two allocations is counted once in
# EACH allocation, so the segments of one college add up to MORE than its
# distinct donors. CollegeDonors is the true once-per-person count.
colleges = (
    df.groupby(["College", "Gift Allocation"])["Prospect ID"].nunique()
      .rename("Donors").reset_index()
      .rename(columns={"Gift Allocation": "Allocation"})
)
per_college = df.groupby("College").agg(
    CollegeDonors=("Prospect ID", "nunique"),
    CollegeDollars=("Gift Amount", "sum"),
)
colleges = colleges.merge(per_college, on="College")
colleges.to_csv(HERE / "colleges.csv", index=False)

# ---- Chapter 5: dollars per allocation subcategory ----
subcats = (
    df.groupby(["Gift Allocation", "Allocation Subcategory"])
      .agg(Amount=("Gift Amount", "sum"),
           Gifts=("Gift Amount", "size"),
           Donors=("Prospect ID", "nunique"))
      .reset_index()
      .rename(columns={"Gift Allocation": "Allocation", "Allocation Subcategory": "Subcategory"})
      .sort_values("Amount", ascending=False)
)
subcats.to_csv(HERE / "subcategories.csv", index=False)

# ---- Sanity checks: these should match the dashboard ----
by_year = df.groupby("Year")["Gift Amount"].sum()
print(f"Rows written:   {len(bubbles)}  -> {OUT.name}")
print(f"Total raised:   ${df['Gift Amount'].sum():,.0f}")
print(f"Gifts:          {len(df):,}")
print(f"Donors:         {df['Prospect ID'].nunique():,}")
print(f"Growth 2010-15: {by_year.iloc[-1] / by_year.iloc[0] - 1:.1%}")
print(f"Bubble total:   ${bubbles['Amount'].sum():,.0f}  (must equal total raised)")

reach80 = int((donors["CumShare"] < 0.8).sum()) + 1   # first donor where the running share reaches 80%
top20 = round(0.2 * len(donors))
print(f"Donors to 80%:  {reach80:,} of {len(donors):,} ({reach80 / len(donors):.1%})")
print(f"Donor-allocation pairs: {colleges['Donors'].sum():,} "
      f"(more than {donors.shape[0]:,} donors because "
      f"{(df.groupby('Prospect ID')['Gift Allocation'].nunique() > 1).sum()} gave to 2+ allocations)")
multi = (donors["Allocations"] > 1).sum()
print(f"Donors giving to 2+ allocations: {multi} ({multi / len(donors):.1%}); "
      f"with 2+ gifts: {(donors['Gifts'] > 1).sum()} ({(donors['Gifts'] > 1).mean():.1%})")
print(f"Subcategories:  {len(subcats)}, total ${subcats['Amount'].sum():,.0f}")
print(f"Top 20% share:  {donors['Amount'].iloc[:top20].sum() / donors['Amount'].sum():.1%}  ({top20} donors)")
