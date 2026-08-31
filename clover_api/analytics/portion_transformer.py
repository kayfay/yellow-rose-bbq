import polars as pl
from typing import Dict, Any

# Ensure path is available for imports
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent.parent))
from clover_api.menu_map import classify_item

# PHASE 2: PORTION-TO-WEIGHT TRANSLATION LAYER (PORTION_MAP)
# We will translate all menu items into raw meat cooked-weight equivalents.
# Note: For procurement, these equivalents will later be scaled by yield loss 
# (e.g. 50% loss for brisket) and converted into raw whole units (e.g. whole briskets).

PORTION_MAP = {
    "2 meat plate": {
        "brisket_lbs": 0.5,
        "pork_ribs_racks": 0.17  # approx 2 ribs out of 12
    },
    "bbq plate": {
        "brisket_lbs": 0.5
    },
    "pitmaster platter &3 sm sides": {
        "brisket_lbs": 0.5,
        "pulled_pork_lbs": 0.5,
        "pork_ribs_racks": 0.25, # approx 3 ribs
        "sausage_links": 1.0
    },
    "hill country trinity w/3sides": {
        "brisket_lbs": 0.5,
        "pork_ribs_racks": 0.25,
        "sausage_links": 1.0
    },
    "bevo platter": {
        "brisket_lbs": 1.0,
        "sausage_links": 2.0,
        "pork_ribs_racks": 0.5
    },
    "brisket": {
        "brisket_lbs": 1.0  # assuming unit 1 = 1 lb, handled in processing
    },
    "jalapeno cheddar sausage": {
        "sausage_links": 1.0 # Wait, POS tracks by 1000ths of a lb, so we must normalize first
    },
    "sausage (mild)": {
        "sausage_links": 1.0
    },
    "1/2 rack pork spare ribs": {
        "pork_ribs_racks": 0.5
    },
    "full rack pork spare ribs": {
        "pork_ribs_racks": 1.0
    },
    "single bone pork rib": {
        "pork_ribs_racks": 0.08  # approx 1/12 of a rack
    },
    "turkey sandwich": {
        "turkey_lbs": 0.3
    },
    "bbq sandwich (brisket)": {
        "brisket_lbs": 0.3
    },
    "pork sandwich": {
        "pulled_pork_lbs": 0.3
    },
    "pulled pork sandwich": {
        "pulled_pork_lbs": 0.3
    }
}

def load_transactions(db_path: str = "clover_api/data/clover_sales.db") -> pl.DataFrame:
    """Loads raw transactional data from SQLite."""
    import sqlite3
    conn = sqlite3.connect(db_path)
    query = "SELECT order_id, created_time, item_name, quantity, modifications FROM order_line_items"
    
    # Read directly into Polars via Pandas (since Polars read_database needs an engine)
    import pandas as pd
    df_pd = pd.read_sql_query(query, conn)
    conn.close()
    
    return pl.from_pandas(df_pd)

def normalize_quantity(df: pl.DataFrame) -> pl.DataFrame:
    """
    Normalizes Clover POS quantities. Items rung up by scale/weight 
    are stored in thousandths (e.g. 1000 = 1).
    """
    weight_items = ["brisket", "pulled pork", "turkey", "sausage", "jalapeno cheddar sausage", "sausage (mild)"]

    
    return df.with_columns(
        pl.when(pl.col("item_name").str.to_lowercase().is_in(weight_items))
        .then(pl.col("quantity") / 1000.0)
        .otherwise(pl.col("quantity"))
        .alias("normalized_quantity")
    )

def explode_and_translate_portions(df: pl.DataFrame) -> pl.DataFrame:
    """
    Translates POS item names into raw ingredient components using the PORTION_MAP.
    Falls back to 'unclassified_item' if not found.
    """
    # Create a Polars DataFrame for the PORTION_MAP to join against
    map_rows = []
    for item_name, ingredients in PORTION_MAP.items():
        for ing, val in ingredients.items():
            map_rows.append({"item_name": item_name, "ingredient": ing, "base_portion": val})
            
    df_map = pl.DataFrame(map_rows)
    
    # Lowercase item_name for matching
    df = df.with_columns(pl.col("item_name").str.to_lowercase().alias("item_name_lower"))
    
    # Join the transactions with our portion map
    # A left join means if an item isn't in PORTION_MAP, it will have nulls for ingredient
    df_joined = df.join(df_map, left_on="item_name_lower", right_on="item_name", how="left")
    
    # Use classify_item from menu_map as a fallback
    df_joined = df_joined.with_columns(
        pl.when(pl.col("ingredient").is_null())
        .then(pl.struct(["item_name", "modifications"]).map_elements(
            lambda x: classify_item(x["item_name"], x["modifications"]), return_dtype=pl.Utf8
        ))
        .otherwise(pl.col("ingredient"))
        .alias("ingredient")
    )
    
    # For classified items from classify_item, we treat base_portion as 1.0 (since they weren't in PORTION_MAP)
    df_joined = df_joined.with_columns(
        pl.when(pl.col("base_portion").is_null())
        .then(pl.col("normalized_quantity"))
        .otherwise(pl.col("normalized_quantity") * pl.col("base_portion"))
        .alias("total_ingredient_qty")
    )
    
    return df_joined

def get_daily_category_aggregates(db_path: str = "clover_api/data/clover_sales.db") -> pl.DataFrame:
    """
    Produces a daily aggregate dataframe compatible with ARIMA baseline model.
    Yields 'date', 'category', 'qty_sold' where qty_sold represents the raw yield requirement.
    """
    df_raw = load_transactions(db_path)
    df_norm = normalize_quantity(df_raw)
    df_exploded = explode_and_translate_portions(df_norm)
    
    # Extract date
    df_exploded = df_exploded.with_columns(
        pl.col("created_time").str.to_datetime().dt.date().alias("date")
    )
    
    # Filter out 'other'
    df_exploded = df_exploded.filter(pl.col("ingredient") != "other")
    
    # Group by date and ingredient
    daily_totals = df_exploded.group_by(["date", "ingredient"]).agg([
        pl.col("total_ingredient_qty").sum().alias("total_qty")
    ]).sort(["date", "ingredient"])
    
    # Rename ingredient to category
    daily_totals = daily_totals.rename({"ingredient": "category", "total_qty": "qty_sold"})
    
    # Apply yield factors so ARIMA forecasts the RAW weights natively
    daily_totals = daily_totals.with_columns(
        pl.when(pl.col("category").is_in(["brisket_lbs", "pulled_pork_lbs"]))
        .then(pl.col("qty_sold") / 0.4)
        .otherwise(pl.col("qty_sold"))
        .alias("qty_sold")
    )
    
    return daily_totals

def calculate_daily_procurement(df_joined: pl.DataFrame) -> pl.DataFrame:
    """
    Aggregates the exploded components into total daily procurement demand.
    Converts cooked/yield weights into raw inventory units based on owner's rules.
    """
    # Group by date and ingredient
    df_joined = df_joined.with_columns(
        pl.col("created_time").str.to_datetime().dt.date().alias("date")
    )
    
    daily_totals = df_joined.group_by(["date", "ingredient"]).agg([
        pl.col("total_ingredient_qty").sum().alias("total_qty")
    ]).sort(["date", "ingredient"])
    
    # Pivot for easier viewing
    daily_pivot = daily_totals.pivot(
        values="total_qty",
        index="date",
        columns="ingredient",
        aggregate_function="sum"
    ).fill_null(0.0)
    
    # Apply Yield Losses and Convert to Raw Inventory Units (Owner's Tracking Method)
    # Brisket Yield: ~50% shrinkage. 1 Whole Raw Brisket = ~12 lbs raw
    if "brisket_lbs" in daily_pivot.columns:
        daily_pivot = daily_pivot.with_columns(
            (pl.col("brisket_lbs") / 0.4).alias("Total Raw Brisket Needed (Lbs)"),
            ((pl.col("brisket_lbs") / 0.4) / 14.0).ceil().cast(pl.Int32).alias("Total Whole Briskets Needed"),
            (((pl.col("brisket_lbs") / 0.4) / 14.0) / 5.0).ceil().cast(pl.Int32).alias("Total Cases of Brisket Needed")
        )
        
    if "sausage_links" in daily_pivot.columns:
        daily_pivot = daily_pivot.with_columns(
            pl.col("sausage_links").ceil().cast(pl.Int32).alias("Total Sausage Links Needed")
        )
        
        # Defensive validation sanity check (Cap at 150 lbs/links per owner feedback)
        max_sausage = daily_pivot["Total Sausage Links Needed"].max()
        if max_sausage > 150:
            print(f"WARNING: Daily sausage demand exceeded sanity threshold ({max_sausage} > 150)!")
            # In production, this would trigger an alert. For now, we log it.
        
    if "pork_ribs_racks" in daily_pivot.columns:
        daily_pivot = daily_pivot.with_columns(
            pl.col("pork_ribs_racks").ceil().cast(pl.Int32).alias("Total Rib Racks Needed")
        )
        
    if "pulled_pork_lbs" in daily_pivot.columns:
        # Pork Yield: ~50% shrinkage. 1 Whole Raw Butt = ~8 lbs raw
        daily_pivot = daily_pivot.with_columns(
            (pl.col("pulled_pork_lbs") / 0.4).alias("Total Raw Pork Needed (Lbs)"),
            ((pl.col("pulled_pork_lbs") / 0.4) / 8.0).ceil().cast(pl.Int32).alias("Total Whole Pork Butts Needed")
        )

    return daily_pivot

if __name__ == "__main__":
    print("Loading transactions...")
    df_raw = load_transactions()
    
    print("Normalizing quantities...")
    df_norm = normalize_quantity(df_raw)
    
    print("Exploding combination platters...")
    df_exploded = explode_and_translate_portions(df_norm)
    
    print("Calculating daily procurement...")
    df_final = calculate_daily_procurement(df_exploded)
    
    print("\n--- SAMPLE OUTPUT (First 5 Days) ---")
    
    # Select only the relevant inventory tracking columns
    cols_to_show = ["date"] + [col for col in df_final.columns if "Total" in col]
    if "unclassified_item" in df_final.columns:
        cols_to_show.append("unclassified_item")
        
    print(df_final.select(cols_to_show).head(5))
