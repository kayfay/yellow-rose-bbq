"""
Menu Mapping and Classification Logic for Yellow Rose BBQ.
Translates Clover POS line items into unified model categories.
"""

import pandas as pd
import polars as pl
from typing import Dict, Any

MENU_GROUPS = {
    "brisket_lbs": ["brisket", "sliced brisket", "chopped lean", "moist sandwich", "chopped moist", "bevo platter"],
    "pulled_pork_lbs": ["pulled pork", "pork sandwich"],
    "pork_ribs_racks": ["pork spare rib", "spare ribs", "1/2 rack", "full rack", "single bone"],
    "beef_dino_ribs": ["dino rib", "beef rib", "beef dino rib"],
    "sausage_links": ["sausage", "jalapeno cheddar", "texas hot gut", "link", "sausage sandwich"],
    "turkey_lbs": ["turkey", "smoked turkey", "turkey breast", "turkey bacon ranch", "turkey sandwich"],
    "tacos_brisket": ["taco brisket", "brisket taco", "birria"], 
    "tacos_pork": ["taco pork", "pork taco"],
    "tacos_turkey": ["taco turkey", "turkey taco"],
    "rosebuds": ["rosebud"],
    "sides_extras": ["mac & cheese", "cole slaw", "beans", "salad", "fries", "cornbread", "banana pudding", "side"]
}

def classify_item(name: str, mods: str) -> str:
    """
    Classifies a POS item name and its modifications into a standard category using keyword matching.
    """
    if not isinstance(name, str):
        return "other"
    
    name_lower = name.lower()
    mods_lower = mods.lower() if isinstance(mods, str) else ""
    
    combined_string = f"{name_lower} {mods_lower}"
    
    # Specific catch for composed items to route correctly
    if "taco" in name_lower or "quesabirria" in name_lower:
        if "brisket" in combined_string or "birria" in combined_string:
            return "tacos_brisket"
        elif "pork" in combined_string:
            return "tacos_pork"
        elif "turkey" in combined_string:
            return "tacos_turkey"
        else:
            return "tacos_brisket" # default to brisket if unspecified
            
    if "rosebud" in name_lower:
        return "rosebuds"
        
    for category, keywords in MENU_GROUPS.items():
        if any(keyword in combined_string for keyword in keywords):
            return category
            
    return "other"

def aggregate_by_category(df_line_items: pl.DataFrame) -> pl.DataFrame:
    """
    Aggregates a Polars DataFrame of line items by day, hour, and category.
    Returns counts of items sold per category.
    """
    if df_line_items.height == 0:
        return df_line_items

    # Ensure created_time is a datetime and map categories
    df = df_line_items.with_columns(
        pl.col("created_time").str.to_datetime()
    ).with_columns([
        pl.col("created_time").dt.date().alias("date"),
        pl.col("created_time").dt.hour().alias("hour"),
        pl.struct(["item_name", "modifications"]).map_elements(
            lambda x: classify_item(x["item_name"], x["modifications"]), return_dtype=pl.Utf8
        ).alias("category")
    ])

    # Filter out 'other'
    df = df.filter(pl.col("category") != "other")

    # Clover API stores weight in thousandths (e.g. 1000 = 1 lb)
    weight_categories = ["brisket_lbs", "turkey_lbs", "pulled_pork_lbs", "sausage_links"]
    df = df.with_columns(
        pl.when(pl.col("category").is_in(weight_categories))
        .then(pl.col("quantity") / 1000.0)
        .otherwise(pl.col("quantity"))
        .alias("quantity")
    )

    # Group by date, hour, category and sum quantities
    agg_df = df.group_by(["date", "hour", "category"]).agg([
        pl.col("quantity").cast(pl.Float64).sum().alias("qty_sold")
    ]).sort(["date", "hour"])

    return agg_df
