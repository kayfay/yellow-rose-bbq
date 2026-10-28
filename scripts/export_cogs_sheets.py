#!/usr/bin/env python3
"""
Yellow Rose BBQ - COGS & Food Cost Spreadsheet Generator
Extracts menu item COGS, portions, retail prices, wholesale yields, and component math
directly from the live site markup (index.html) and exports them to structured CSV files
tailored for Google Sheets import and financial analysis.
"""

import re
import csv
import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
INDEX_HTML = ROOT_DIR / "index.html"
DATA_DIR = ROOT_DIR / "data"
ARTIFACTS_DIR = Path("/home/atools/.gemini/antigravity/brain/87a5109a-947a-41fd-a34d-546b65b0ff13")

def extract_wholesale_yields(html_content):
    """Extracts the wholesale commodity and cooked meat yield economics table."""
    wholesale_match = re.search(r'<tbody id="predictive-costs-tbody">(.*?)</tbody>', html_content, re.DOTALL)
    if not wholesale_match:
        return []
    
    rows = re.findall(r'<tr.*?>(.*?)</tr>', wholesale_match.group(1), re.DOTALL)
    items = []
    for r in rows:
        tds = re.findall(r'<td.*?>(.*?)</td>', r, re.DOTALL)
        if len(tds) >= 5:
            clean = [re.sub(r'<.*?>', '', td).strip() for td in tds]
            items.append({
                "wholesale_item": clean[0],
                "us_foods_raw_price": clean[1],
                "estimated_cooked_yield": clean[2],
                "effective_cooked_cost": clean[3],
                "yield_and_trim_notes": clean[4]
            })
    return items

def extract_menu_cogs(html_content):
    """Extracts the complete 61-item portion-level COGS breakdown."""
    cogs_match = re.search(r'📋 Complete Menu Item & Portion-Level COGS Breakdown.*?<tbody>(.*?)</tbody>', html_content, re.DOTALL)
    if not cogs_match:
        return []
    
    rows = re.findall(r'<tr.*?>(.*?)</tr>', cogs_match.group(1), re.DOTALL)
    current_category = ""
    items = []
    
    for r in rows:
        cat_match = re.search(r'<td colspan="6".*?>(.*?)</td>', r, re.DOTALL)
        if cat_match:
            current_category = re.sub(r'<.*?>', '', cat_match.group(1)).strip()
            # Clean leading emoji for clean sorting/filtering
            clean_category = current_category
            continue
            
        tds = re.findall(r'<td.*?>(.*?)</td>', r, re.DOTALL)
        if len(tds) == 6:
            clean = [re.sub(r'<.*?>', '', td).strip() for td in tds]
            name, portion, comp_math, cogs_str, retail_str, fc_str = clean
            
            cogs_val = float(cogs_str.replace('$', '').strip())
            retail_val = float(retail_str.replace('$', '').strip())
            gross_margin_usd = round(retail_val - cogs_val, 2)
            actual_fc_pct = round((cogs_val / retail_val) * 100, 1)
            gross_margin_pct = round((gross_margin_usd / retail_val) * 100, 1)
            
            # Profitability Tier & Actionable Guidance
            if actual_fc_pct < 20.0:
                tier = "⭐ Super Star (<20% FC)"
                action = "Promote heavily; ultra-high profit anchor"
            elif actual_fc_pct <= 25.0:
                tier = "🟢 High Margin (20-25% FC)"
                action = "Strong profit driver; maintain portion consistency"
            elif actual_fc_pct <= 32.0:
                tier = "🎯 Target Benchmark (25-32% FC)"
                action = "Healthy restaurant margin; ideal balance"
            else:
                tier = "⚠️ Watch Margin (>32% FC)"
                action = "Premium meat pull; pair with high-margin sides/drinks"
                
            items.append({
                "category": current_category,
                "item_name": name,
                "portion_spec": portion,
                "component_cost_math": comp_math,
                "portion_cogs_usd": cogs_val,
                "menu_retail_usd": retail_val,
                "gross_margin_usd": gross_margin_usd,
                "food_cost_pct": actual_fc_pct,
                "gross_margin_pct": gross_margin_pct,
                "profitability_tier": tier,
                "operational_guidance": action
            })
            
    return items

def main():
    if not INDEX_HTML.exists():
        print(f"Error: {INDEX_HTML} not found.")
        return

    with open(INDEX_HTML, "r", encoding="utf-8") as f:
        html = f.read()

    wholesale_items = extract_wholesale_yields(html)
    menu_items = extract_menu_cogs(html)
    
    DATA_DIR.mkdir(exist_ok=True)
    if ARTIFACTS_DIR.exists():
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Export Menu COGS CSV
    cogs_csv_path = ROOT_DIR / "yellow_rose_bbq_cogs.csv"
    data_cogs_path = DATA_DIR / "yellow_rose_bbq_cogs.csv"
    
    fieldnames = [
        "Category",
        "Menu Item",
        "Portion Specification",
        "Wholesale Component Math",
        "Portion COGS ($)",
        "Retail Price ($)",
        "Gross Profit ($)",
        "Food Cost %",
        "Gross Margin %",
        "Profitability Tier",
        "Operational Guidance"
    ]
    
    for target in [cogs_csv_path, data_cogs_path]:
        with open(target, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(fieldnames)
            for item in menu_items:
                writer.writerow([
                    item["category"],
                    item["item_name"],
                    item["portion_spec"],
                    item["component_cost_math"],
                    f"{item['portion_cogs_usd']:.2f}",
                    f"{item['menu_retail_usd']:.2f}",
                    f"{item['gross_margin_usd']:.2f}",
                    f"{item['food_cost_pct']:.1f}%",
                    f"{item['gross_margin_pct']:.1f}%",
                    item["profitability_tier"],
                    item["operational_guidance"]
                ])
                
    # 2. Export Wholesale Yields CSV
    yields_csv_path = ROOT_DIR / "yellow_rose_bbq_wholesale_yields.csv"
    data_yields_path = DATA_DIR / "yellow_rose_bbq_wholesale_yields.csv"
    
    yields_fields = [
        "Wholesale Item",
        "US Foods Raw Contract Price",
        "Estimated Cooked Yield",
        "Effective Cost (Cooked / Portion)",
        "Yield & Shrinkage Notes"
    ]
    
    for target in [yields_csv_path, data_yields_path]:
        with open(target, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(yields_fields)
            for item in wholesale_items:
                writer.writerow([
                    item["wholesale_item"],
                    item["us_foods_raw_price"],
                    item["estimated_cooked_yield"],
                    item["effective_cooked_cost"],
                    item["yield_and_trim_notes"]
                ])
                
    # 3. Export Comprehensive All-in-One CSV with Executive Summary
    summary_csv_path = ROOT_DIR / "yellow_rose_bbq_complete_cogs_model.csv"
    with open(summary_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["YELLOW ROSE BBQ - COST OF GOODS SOLD (COGS) & MARGIN ANALYSIS"])
        writer.writerow(["Target Food Cost Benchmark", "28.0% - 32.0%"])
        writer.writerow(["Average Menu Food Cost", f"{sum(i['food_cost_pct'] for i in menu_items) / len(menu_items):.1f}%"])
        writer.writerow(["Total Menu Items Analyzed", len(menu_items)])
        writer.writerow([])
        writer.writerow(["--- WHOLESALE COMMODITY CONTRACT PRICES & SMOKED YIELDS ---"])
        writer.writerow(yields_fields)
        for item in wholesale_items:
            writer.writerow([
                item["wholesale_item"],
                item["us_foods_raw_price"],
                item["estimated_cooked_yield"],
                item["effective_cooked_cost"],
                item["yield_and_trim_notes"]
            ])
        writer.writerow([])
        writer.writerow(["--- COMPLETE PORTION-LEVEL COGS & RETAIL MENU BREAKDOWN ---"])
        writer.writerow(fieldnames)
        for item in menu_items:
            writer.writerow([
                item["category"],
                item["item_name"],
                item["portion_spec"],
                item["component_cost_math"],
                f"{item['portion_cogs_usd']:.2f}",
                f"{item['menu_retail_usd']:.2f}",
                f"{item['gross_margin_usd']:.2f}",
                f"{item['food_cost_pct']:.1f}%",
                f"{item['gross_margin_pct']:.1f}%",
                item["profitability_tier"],
                item["operational_guidance"]
            ])
            
    # Copy to artifacts directory for direct user download
    if ARTIFACTS_DIR.exists():
        shutil.copy(cogs_csv_path, ARTIFACTS_DIR / "yellow_rose_bbq_cogs.csv")
        shutil.copy(yields_csv_path, ARTIFACTS_DIR / "yellow_rose_bbq_wholesale_yields.csv")
        shutil.copy(summary_csv_path, ARTIFACTS_DIR / "yellow_rose_bbq_complete_cogs_model.csv")
        
    print(f"Successfully generated COGS sheets:")
    print(f" - Menu COGS: {cogs_csv_path} ({len(menu_items)} items)")
    print(f" - Wholesale Yields: {yields_csv_path} ({len(wholesale_items)} items)")
    print(f" - Complete Master Model: {summary_csv_path}")

if __name__ == "__main__":
    main()
