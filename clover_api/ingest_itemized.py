"""
Clover POS Itemized Ingestion & Menu Extractor
Fetches itemized POS menu items and line item transactions from Clover REST API.
Generates WEBSITE_MENU.md and populates the SQLite itemized catalog.
"""

import sqlite3
import requests
import pandas as pd
from pathlib import Path
from clover_api.secure_config import get_secure_credentials, get_headers, DB_PATH, BASE_DIR

def fetch_pos_items():
    creds = get_secure_credentials()
    headers = get_headers()
    
    all_items = []
    offset = 0
    print("[ITEMIZED INGEST] Querying Clover API for complete menu catalog...")
    
    while True:
        url = f"{creds['base_url']}/v3/merchants/{creds['merchant_id']}/items?limit=100&offset={offset}"
        res = requests.get(url, headers=headers, timeout=30)
        res.raise_for_status()
        elements = res.json().get("elements", [])
        all_items.extend(elements)
        if len(elements) < 100:
            break
        offset += 100

    print(f"[ITEMIZED INGEST] Fetched {len(all_items)} total POS items.")
    return all_items

def save_items_to_sqlite_and_markdown(all_items):
    # Parse items
    item_rows = []
    for item in all_items:
        item_id = item.get("id")
        name = item.get("name", "").strip()
        price_cents = item.get("price", 0)
        price_usd = price_cents / 100.0 if price_cents else 0.0
        unit = item.get("unitName", "")
        
        if name and name.lower() != "dont make":
            item_rows.append({
                "item_id": item_id,
                "name": name,
                "price_usd": price_usd,
                "unit": unit
            })

    df_items = pd.DataFrame(item_rows)

    # Save to SQLite
    conn = sqlite3.connect(DB_PATH)
    df_items.to_sql("pos_items", conn, if_exists="replace", index=False)
    conn.close()
    print(f"[DATABASE] Saved {len(df_items)} items to 'pos_items' table in {DB_PATH}")

    # Generate Sanitized WEBSITE_MENU.md (Categories and Cuts, No Raw Pricing Table)
    md_content = """# Official POS Menu & Cut Catalog

This document is automatically generated from live POS API metadata.

## Smoked Meats & BBQ Mains
| Item Name | Unit / Notes |
| :--- | :--- |
"""
    meats = []
    sides = []
    drinks = []
    other = []

    for row in item_rows:
        n = row["name"].lower()
        line = f"| **{row['name']}** | {row['unit']} |"

        if any(k in n for k in ["rib", "brisket", "pork", "sausage", "turkey", "burnt", "plate", "platter", "sandwich", "wing", "dino", "taco", "guitada", "quesa", "trinity"]):
            meats.append(line)
        elif any(k in n for k in ["slaw", "salad", "fries", "beans", "corn", "mac", "pasta", "pudding", "churros", "rice", "consum"]):
            sides.append(line)
        elif any(k in n for k in ["tea", "beer", "bock", "carbliss", "seltzer", "limeade", "cola", "drink", "chico"]):
            drinks.append(line)
        else:
            other.append(line)

    md_content += "\n".join(sorted(meats)) + "\n\n"
    
    md_content += "## Sides, Desserts & Extras\n| Item Name | Unit / Notes |\n| :--- |\n"
    md_content += "\n".join(sorted(sides)) + "\n\n"

    md_content += "## Beverages & Refreshments\n| Item Name | Unit / Notes |\n| :--- |\n"
    md_content += "\n".join(sorted(drinks)) + "\n\n"

    md_content += "## Catering & Other\n| Item Name | Unit / Notes |\n| :--- |\n"
    md_content += "\n".join(sorted(other)) + "\n"

    out_md = BASE_DIR.parent / "WEBSITE_MENU.md"
    out_md.write_text(md_content, encoding="utf-8")
    print(f"[MARKDOWN] Saved official website/POS menu catalog to {out_md}")

def run_itemized_pipeline():
    items = fetch_pos_items()
    save_items_to_sqlite_and_markdown(items)

if __name__ == "__main__":
    run_itemized_pipeline()
