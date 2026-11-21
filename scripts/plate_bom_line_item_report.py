#!/usr/bin/env python3
"""
Yellow Rose BBQ — Complete Menu (137 Items) & Recipe (34 Recipes / 151 Lines)
Line-by-Line BOM, Fresh Veggies, Sauces (OG / Spicy / Mustard) & To-Go Packaging Report.

Design & Sanity Invariants:
  - Zero double-counting: components already priced into Core Portion (e.g., brioche buns,
    tortillas, pickles/slaw on sandwiches, PET drink cups, deli tubs on bottled sauces) are
    listed explicitly for inventory tracking at $0.00 incremental add-on cost.
  - Balanced, clean formatting: no yellow highlighting or special sauce-cup columns/badges;
    House BBQ Sauce (choice of OG, Spicy, or Mustard, 1.5 oz portion cup + lid) appears as a
    standard inventory line item only on BBQ items that include sauce.
  - Emits clover_api/analytics/plate_cost_explorer.json for the mobile-first interactive
    Plate & Recipe Costs subtab (plain-English copy, zero banned UI jargon, zero raw
    vendor invoice filenames).

Outputs (private under data/vendor_invoices/reports/, mode 0600):
  1. YRBBQ_Plate_Line_Item_BOM_and_ToGo_Packaging_2026-11-19.csv
  2. YRBBQ_Plate_Line_Item_BOM_and_ToGo_Packaging_2026-11-19.html
  3. YRBBQ_Plate_Line_Item_BOM_and_ToGo_Packaging_2026-11-19.pdf
And public SPA explorer payload (mode 0644):
  4. clover_api/analytics/plate_cost_explorer.json (+ analytics/, api/analytics/)
"""

from __future__ import annotations

import csv
import html
import json
import os
import shutil
import subprocess
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = DATA_DIR / "vendor_invoices" / "reports"
BACKUPS_DIR = BASE_DIR / "backups"
ANALYTICS_DIR = BASE_DIR / "clover_api" / "analytics"

MENU_COGS_CSV = DATA_DIR / "yellow_rose_bbq_cogs.csv"
RECIPE_DETAIL_CSV = DATA_DIR / "yellow_rose_bbq_recipe_ingredients_detail.csv"

OUT_CSV = REPORTS_DIR / "YRBBQ_Plate_Line_Item_BOM_and_ToGo_Packaging_2026-11-19.csv"
OUT_HTML = REPORTS_DIR / "YRBBQ_Plate_Line_Item_BOM_and_ToGo_Packaging_2026-11-19.html"
OUT_PDF = REPORTS_DIR / "YRBBQ_Plate_Line_Item_BOM_and_ToGo_Packaging_2026-11-19.pdf"
MASTER_PDF = REPORTS_DIR / "YRBBQ_Complete_COGS_and_Inventory_Master_2026-11-15.pdf"


def parse_float(val: str) -> float:
    cleaned = (val or "").replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def classify_cost_band(pct: float | None) -> tuple[str, str]:
    if pct is None:
        return "neutral", "System / N/A"
    if pct < 32.0:
        return "green", "Healthy (<32%)"
    if pct <= 36.0:
        return "amber", "Watch (32–36%)"
    return "red", "High (>36%)"


def build_item_bom_lines(
    category: str,
    item_name: str,
    portion_spec: str,
    comp_math: str,
    retail_price: float,
) -> list[tuple[str, str, str, float, str]]:
    """
    Build clean, non-double-counted line-by-line inventory & packaging items for every menu item.
    Returns list of (line_category, item_desc, qty_unit, incremental_cost_usd, notes).
    """
    cat = (category or "").lower()
    name = (item_name or "").lower()
    spec_all = f"{portion_spec} {comp_math}".lower()

    has_bun_in_base = any(k in spec_all for k in ("brioche", "bun", "roll"))
    has_tortilla_in_base = "tortilla" in spec_all
    has_pickles_in_base = "pickle" in spec_all
    has_slaw_in_base = "slaw" in spec_all
    has_onion_in_base = "onion" in spec_all
    has_cup_in_base = any(
        k in spec_all
        for k in ("pet cold cup", "cup +", "deli container", "mason jar", "gallon plastic jug", "portion cup")
    )

    lines: list[tuple[str, str, str, float, str]] = []

    # 1. Non-food POS system items, gift cards, delivery fees, merch
    if "merchandise" in cat or "pos system" in cat or retail_price <= 0:
        if any(k in name for k in ("hat", "patch", "sticker")):
            lines.append(("Packaging", "Retail Bag / Tissue Share", "1 ea", 0.05, "Merchandise handoff"))
        else:
            lines.append(("System / Non-Food", "No food or to-go packaging depleted", "0", 0.00, "Fee, gift card, or POS instruction"))
        return lines

    # 2. Beverages, Beer & Cocktails
    if "beverage" in cat or "beer" in cat or "cocktail" in cat:
        if has_cup_in_base:
            lines.append(("Packaging", "Beverage Cup / Jug, Lid & Straw (included in core spec)", "1 set", 0.00, "Already priced in Core Portion"))
        elif any(k in name for k in ("can", "bottle", "water", "topo chico", "lite", "coors", "shiner", "dos equis", "ipa", "carbliss")):
            lines.append(("Packaging", "Grab-and-Go Can / Bottle (optional napkin)", "1 ea", 0.01, "Pre-packaged beverage"))
        else:
            lines.append(("Packaging", "24 oz Cold Cup + Lid + Straw", "1 set", 0.16, "Fountain / house drink"))
        return lines

    # 3. House Sauces, Dressings & Extras
    if "house sauces" in cat or "extras" in cat:
        if "brioche bun" in name:
            lines.append(("Packaging", "12x12 Butcher Paper Wrap Sheet", "1 sheet", 0.07, "Extra bun wrap"))
        elif has_cup_in_base or any(k in name for k in ("8 oz", "16 oz", "pint", "2 oz", "tub", "cup")):
            lines.append(("Packaging", "Deli / Portion Container + Lid (included in core spec)", "1 set", 0.00, "Already priced in Core Portion"))
            lines.append(("Packaging", "To-Go Bag Share", "1 share", 0.03, "Per-order share"))
        else:
            lines.append(("Packaging", "Portion Cup + Lid", "1 set", 0.06, "Side container"))
        return lines

    # 4. Catering Trays & Family Specials
    if "catering" in cat:
        if "wing" in name:
            lines.append(("Fresh Veggies", "Celery / Pickle & Onion Catering Garnish", "8 oz", 0.45, "Catering wing garnish"))
            lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) & Ranch — Bulk Cups", "2x 8 oz", 0.00, "Included in core wing tray spec"))
            lines.append(("Packaging", "Full/Half Aluminum Foil Catering Pan + Lid + Tongs", "1 set", 1.15, "Catering transport"))
        elif "cornbread" in name:
            lines.append(("Packaging", "Half Aluminum Foil Pan + Lid + Serving Spatula", "1 set", 0.95, "10-count cornbread tray"))
        elif "banana pudding" in name:
            lines.append(("Packaging", "Deep Half Aluminum Foil Pan + Lid + Serving Spoon", "1 set", 0.95, "Cold dessert catering tray"))
        elif "caesar" in name:
            lines.append(("Packaging", "Deep Half Foil Pan + Lid + 16 oz Dressing Tub + Tongs", "1 set", 1.10, "Salad catering tray"))
        else:
            lines.append(("Packaging", "Deep Half Aluminum Steam Pan + Lid + Serving Spoon", "1 set", 0.95, "Half-pan catering side tray"))
        return lines

    # 5. Scratch Sides, Appetizers & Desserts
    if "scratch sides" in cat or "appetizer" in cat or "dessert" in cat:
        if any(k in name for k in ("banana pudding", "churro")):
            if "churro" in name:
                lines.append(("Packaging", "Grease-Resistant Pastry Bag / 6x6 Clamshell + Napkins", "1 set", 0.16, "Dessert to-go"))
            else:
                cup_sz = "16 oz Pint Container + Lid" if ("16 oz" in name or "pint" in name) else "6-8 oz Clear Deli Cup + Lid"
                cup_cost = 0.18 if ("16 oz" in name or "pint" in name) else 0.12
                lines.append(("Packaging", f"{cup_sz} + Plastic Spoon + Napkin", "1 set", round(cup_cost + 0.05, 2), "Dessert to-go"))
            return lines

        if "caesar salad" in name:
            lines.append(("Fresh Veggies", "Romaine Lettuce, Parmesan/Cotija & Croutons (in core spec)", "1 portion", 0.00, "Already priced in Core Portion"))
            lines.append(("Packaging", "Clear Hinged Salad Container + 2 oz Dressing Cup/Lid + Fork", "1 set", 0.34, "To-go salad pack"))
            return lines

        if any(k in name for k in ("chili", "consommé", "consomme")):
            sz = "12 oz Soup Container + Vented Lid" if "bowl" in name else "8 oz Deli Cup + Lid"
            cost = 0.22 if "bowl" in name else 0.14
            if "chili" in name:
                lines.append(("Fresh Veggies", "Diced White Onion & Sliced Jalapeno Garnish", "1.0 oz", 0.08, "Optional fresh topping"))
            lines.append(("Packaging", f"{sz} + Spoon + Napkin + Bag Share", "1 set", round(cost + 0.07, 2), "Hot liquid to-go"))
            return lines

        if "cornbread" in name:
            lines.append(("Packaging", "Foil Wrap Sheet / 6x6 Clamshell + Napkin", "1 set", 0.14, "Warm cornbread wrap"))
            return lines

        if any(k in name for k in ("rose bud", "fries", "frito pie", "pimento")):
            if "rose bud" in name:
                lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) — 1.5 oz Portion Cup + Lid", "1 cup", 0.25, "Sauce ($0.19) + cup/lid ($0.06)"))
                lines.append(("Packaging", "6x6 Hinged Clamshell + Butcher Paper Liner + Napkins", "1 set", 0.28, "Appetizer to-go"))
            elif "bbq" in name or "texas cheese" in name:
                if "jalapeño" in spec_all or "jalapeno" in spec_all:
                    lines.append(("Fresh Veggies", "Sliced Jalapenos (included in core spec)", "0.75 oz", 0.00, "Already priced in Core Portion"))
                lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) — 1.5 oz Portion Cup + Lid", "1 cup", 0.25, "Sauce ($0.19) + cup/lid ($0.06)"))
                lines.append(("Packaging", "9x6 Hinged Clamshell + Foil Liner + Fork + Napkins", "1 set", 0.36, "Loaded fries to-go"))
            elif "frito pie" in name or "chili cheese" in name or "cheese fries" in name:
                lines.append(("Fresh Veggies", "Diced White Onion & Pickled Jalapenos", "1.0 oz", 0.08, "Fresh garnish"))
                lines.append(("Packaging", "9x6 Hinged Clamshell + Fork + Napkins + Bag Share", "1 set", 0.34, "Hot appetizer to-go"))
            elif "pimento" in name:
                lines.append(("Packaging", "8 oz Deli Cup + Lid (Pimento) + Cracker Sleeves Bag", "1 set", 0.18, "Cold dip to-go"))
            else:
                lines.append(("Packaging", "Paper Fry Boat / 6x6 Vented Clamshell + Napkins", "1 set", 0.20, "Crispy fries to-go"))
            return lines

        lines.append(("Packaging", "8 oz Side Deli Cup + Tight-Fit Lid", "1 set", 0.12, "Leak-proof side cup"))
        lines.append(("Packaging", "Plastic Fork/Spoon + Napkin + Bag Share", "1 set", 0.07, "To-go utensils"))
        return lines

    # 6. Combination Platters, Plates & Feasts
    if "combination" in cat or "platter" in cat or "plate" in name or "feast" in name:
        if "king of the hill" in name or "bevo platter" in name:
            cups = 4 if "bevo" in name else 6
            lines.append(("Fresh Veggies", "Dill Pickles (4-6 oz), White Onion (4 oz) & Pickled Jalapenos", "8-10 oz", 0.55, "In 8 oz garnish deli cup"))
            lines.append(("Bakery", "Texas Toast / White Bread Loaf Portion", "6-8 slices", 0.65, "Feast bread"))
            lines.append(("Sauces", f"House BBQ Sauce (OG, Spicy, or Mustard) — {cups}x 1.5 oz Portion Cups + Lids", f"{cups} cups", round(cups * 0.25, 2), "Mix of house flavors"))
            lines.append(("Packaging", "Half Foil Pan(s) + Butcher Paper + Quart Side Containers + Bags & Cutlery", "1 set", 2.10, "Family feast to-go pack"))
            return lines
        if "pitmaster platter" in name or "trinity" in name:
            lines.append(("Fresh Veggies", "Dill Pickles (2 oz), White Onion (1.5 oz) & Jalapenos", "3.5 oz", 0.24, "Platter garnish"))
            lines.append(("Bakery", "Texas Toast / White Bread (3 slices)", "3 slices", 0.32, "Platter bread"))
            lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) — 2x 1.5 oz Portion Cups + Lids", "2 cups", 0.50, "Choice of house flavors"))
            lines.append(("Packaging", "9x9 Heavy Clamshell + Butcher Liner + 3x 8 oz Side Cups + Cutlery/Bag", "1 set", 0.88, "3-side platter to-go"))
            return lines
        if "kids" in name:
            lines.append(("Fresh Veggies", "Dill Pickle Chips (optional)", "0.5 oz", 0.05, "Kids garnish"))
            if "taco" not in name:
                lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) — 1.5 oz Portion Cup + Lid", "1 cup", 0.25, "Choice of house flavor"))
            lines.append(("Packaging", "6x6 Clamshell + 6 oz Side Cup + Kids Drink Cup/Lid/Straw + Cutlery", "1 set", 0.42, "Kids meal to-go"))
            return lines
        if "taco plate" in name or "guisada plate" in name:
            lines.append(("Fresh Veggies", "Cilantro, Diced White Onion, Pickled Red Onion & Lime Wedges", "2.0 oz", 0.22, "Fresh Tex-Mex garnish"))
            if has_tortilla_in_base:
                lines.append(("Bakery", "Warm Tortillas (included in core spec)", "2 ea", 0.00, "Already priced in Core Portion"))
            lines.append(("Sauces", "House Salsa / Crema (or BBQ Sauce) — 1.5 oz Portion Cup + Lid", "1 cup", 0.24, "Side dipping cup"))
            lines.append(("Packaging", "9x9 3-Comp Clamshell + Foil Liner + 2x 8 oz Side Cups + Cutlery/Bag", "1 set", 0.72, "Plate to-go kit"))
            return lines
        cups = 2 if ("2 meat" in name or "two meat" in name) else 1
        lines.append(("Fresh Veggies", "Dill Pickle Chips (1.5 oz), White Onion (1.0 oz) & Jalapenos", "2.5 oz", 0.20, "Plate garnish"))
        lines.append(("Bakery", "Texas Toast / White Bread (2 slices)", "2 slices", 0.26, "Plate bread"))
        lines.append(("Sauces", f"House BBQ Sauce (OG, Spicy, or Mustard) — {cups}x 1.5 oz Portion Cup{'s' if cups > 1 else ''} + Lid", f"{cups} cup{'s' if cups > 1 else ''}", round(cups * 0.25, 2), "Choice of house flavors"))
        lines.append(("Packaging", "9x9 3-Comp Clamshell + 12x12 Butcher Liner + 2x 8 oz Side Cups + Cutlery/Bag", "1 set", 0.74, "Plate to-go kit"))
        return lines

    # 7. Smoked Meats by the Pound, Ribs & Wings
    if "smoked meats" in cat or "ribs" in cat:
        if "wing" in name:
            lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) or Ranch — 1.5 oz Portion Cup + Lid", "1 cup", 0.25, "Dipping cup"))
            lines.append(("Packaging", "6x6 Clamshell + Foil Liner + Wet Wipes + Napkins + Bag Share", "1 set", 0.34, "Wings to-go"))
            return lines
        if "single bone" in name or "single" in name or "link" in name:
            lines.append(("Fresh Veggies", "Dill Pickles & White Onion", "1.0 oz", 0.09, "Garnish"))
            lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) — 1.5 oz Portion Cup + Lid", "1 cup", 0.25, "Choice of house flavor"))
            lines.append(("Packaging", "12x12 Pink Butcher Paper + Foil Wrap + Napkins", "1 set", 0.18, "Single item wrap"))
            return lines
        cups = 3 if "full rack" in name else (1 if "0.5 lb" in name else 2)
        lines.append(("Fresh Veggies", "Dill Pickles & Sliced White Onion (in 4 oz garnish cup)", "2.5 oz", 0.18, "Side garnish cup"))
        lines.append(("Sauces", f"House BBQ Sauce (OG, Spicy, or Mustard) — {cups}x 1.5 oz Portion Cup{'s' if cups > 1 else ''} + Lid", f"{cups} cup{'s' if cups > 1 else ''}", round(cups * 0.25, 2), "Choice of house flavors"))
        lines.append(("Packaging", "18x24 Pink Butcher Paper + Heavy Foil Sheet + 4 oz Garnish Cup + Bag/Wipes", "1 set", 0.46, "Bulk meat / rack wrap"))
        return lines

    # 8. Sandwiches, Burgers, Quesadillas & Tacos
    if "quesadilla" in name:
        lines.append(("Bakery", "12 in Flour Tortilla (included in core spec)", "1 ea", 0.00, "Already priced in Core Portion"))
        lines.append(("Fresh Veggies", "Fresh Pico / Pickled Red Onion & Jalapeno Garnish", "1.5 oz", 0.15, "Fresh garnish"))
        if "three-cheese" not in name:
            lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) or Crema — 1.5 oz Portion Cup + Lid", "1 cup", 0.25, "Side dipping cup"))
        lines.append(("Packaging", "9x6 Hinged Clamshell + Foil Liner + Napkins + Bag Share", "1 set", 0.32, "Quesadilla to-go"))
        return lines

    if "taco" in name:
        if has_tortilla_in_base:
            lines.append(("Bakery", "Griddled Corn / Flour Tortilla(s) (included in core spec)", "1-2 ea", 0.00, "Already priced in Core Portion"))
        if not has_onion_in_base:
            lines.append(("Fresh Veggies", "Cilantro, Diced White Onion & Lime Wedge", "1.0 oz", 0.14, "Fresh street taco garnish"))
        else:
            lines.append(("Fresh Veggies", "Cilantro, Onion & Taco Garnish (included in core spec)", "1.0 oz", 0.00, "Already priced in Core Portion"))
        if "consommé" in spec_all or "birria" in name or "quesabirria" in name:
            lines.append(("Packaging", "4 oz Consomme Dipping Cup + Lid + Foil Taco Wrap + Clamshell", "1 set", 0.28, "Birria to-go pack"))
        else:
            lines.append(("Sauces", "House Salsa / Crema (or BBQ Sauce) — 1.5 oz Portion Cup + Lid", "1 cup", 0.24, "Side dipping cup"))
            lines.append(("Packaging", "Foil Taco Liner + 6x6 Clamshell + Napkins + Bag Share", "1 set", 0.26, "Single taco to-go"))
        return lines

    if has_bun_in_base:
        lines.append(("Bakery", "Toasted Brioche Bun (included in core spec)", "1 ea", 0.00, "Already priced in Core Portion"))
    else:
        lines.append(("Bakery", "Toasted Brioche Bun", "1 ea", 0.42, "Sandwich bread"))

    if has_pickles_in_base or has_slaw_in_base:
        lines.append(("Fresh Veggies", "Pickles / Slaw (included in core spec) + Fresh White Onion", "1.5 oz", 0.06, "Only onion is incremental"))
    else:
        lines.append(("Fresh Veggies", "Dill Pickle Chips (1.0 oz) + Sliced White Onion (0.75 oz)", "1.75 oz", 0.15, "Fresh sandwich garnish"))

    if "burger" not in name and "ranch" not in name:
        lines.append(("Sauces", "House BBQ Sauce (OG, Spicy, or Mustard) — 1.5 oz Portion Cup + Lid", "1 cup", 0.25, "Choice of house flavor"))
    elif "ranch" in name:
        lines.append(("Sauces", "House Buttermilk Ranch (included in core spec)", "1 portion", 0.00, "Already priced in Core Portion"))

    lines.append(("Packaging", "12x12 Butcher Paper Wrap + 6x6 Clamshell + Bag/Napkins", "1 set", 0.36, "Sandwich to-go pack"))
    return lines


def compute_plate_cost_explorer_data() -> dict:
    """Build structured explorer dataset (summary, category_rollup, 137 menu items, 34 recipes)."""
    menu_items_raw = []
    with open(MENU_COGS_CSV, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if (row.get("Menu Item") or "").strip():
                menu_items_raw.append(row)

    recipes_by_name: dict[str, list[dict]] = defaultdict(list)
    with open(RECIPE_DETAIL_CSV, "r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            r_name = (row.get("Recipe_Name") or "").strip()
            if r_name:
                recipes_by_name[r_name].append(row)

    menu_items_out = []
    cat_buckets: dict[str, list[dict]] = defaultdict(list)

    for idx, item in enumerate(menu_items_raw, 1):
        cat = (item.get("Category") or "General").strip()
        name = (item.get("Menu Item") or "").strip()
        portion_spec = (item.get("Portion Specification") or "Standard portion").strip()
        comp_math = (item.get("Wholesale Component Math") or "").strip()
        base_cost = parse_float(item.get("Portion COGS ($)"))
        retail_price = parse_float(item.get("Retail Price ($)"))

        addons = build_item_bom_lines(cat, name, portion_spec, comp_math, retail_price)

        veggies_bakery_inc = round(sum(c for lc, _, _, c, _ in addons if lc in ("Fresh Veggies", "Bakery")), 2)
        sauce_inc = round(sum(c for lc, _, _, c, _ in addons if lc == "Sauces"), 2)
        pkg_inc = round(sum(c for lc, _, _, c, _ in addons if lc == "Packaging"), 2)
        addon_total = round(veggies_bakery_inc + sauce_inc + pkg_inc, 2)
        full_cost = round(base_cost + addon_total, 2)

        if retail_price > 0:
            base_pct = round((base_cost / retail_price) * 100.0, 1)
            full_pct = round((full_cost / retail_price) * 100.0, 1)
            left_after_cost = round(retail_price - full_cost, 2)
        else:
            base_pct = None
            full_pct = None
            left_after_cost = 0.0

        assert full_cost >= 0.0, f"Negative food cost on {name}"
        assert abs((base_cost + addon_total) - full_cost) <= 0.01, f"Parity mismatch on {name}"

        band, band_label = classify_cost_band(full_pct)

        lines_list = [
            {
                "type": "Core Portion",
                "item": portion_spec,
                "qty": "1 order",
                "cost_usd": base_cost,
                "note": comp_math[:95],
            }
        ]
        for lc, desc, qty_u, cost, note in addons:
            lines_list.append({
                "type": lc,
                "item": desc,
                "qty": qty_u,
                "cost_usd": cost,
                "note": note,
            })

        rec = {
            "id": idx,
            "category": cat,
            "name": name,
            "portion_spec": portion_spec,
            "retail_usd": retail_price,
            "base_cost_usd": base_cost,
            "base_cost_pct": base_pct,
            "veggies_bakery_addon_usd": veggies_bakery_inc,
            "sauce_addon_usd": sauce_inc,
            "packaging_addon_usd": pkg_inc,
            "addon_total_usd": addon_total,
            "full_cost_usd": full_cost,
            "full_cost_pct": full_pct,
            "left_after_cost_usd": left_after_cost,
            "status_band": band,
            "status_label": band_label,
            "lines": lines_list,
        }
        menu_items_out.append(rec)
        cat_buckets[cat].append(rec)

    # Category-by-Category Base vs. Full To-Go Food Cost % Rollup
    category_rollup = []
    for cat, items in cat_buckets.items():
        priced = [x for x in items if x["retail_usd"] > 0]
        if priced:
            avg_retail = round(sum(x["retail_usd"] for x in priced) / len(priced), 2)
            avg_base = round(sum(x["base_cost_usd"] for x in priced) / len(priced), 2)
            avg_base_pct = round(sum(x["base_cost_pct"] for x in priced) / len(priced), 1)
            avg_addon = round(sum(x["addon_total_usd"] for x in priced) / len(priced), 2)
            avg_full = round(sum(x["full_cost_usd"] for x in priced) / len(priced), 2)
            avg_full_pct = round(sum(x["full_cost_pct"] for x in priced) / len(priced), 1)
            lift_pct = round(avg_full_pct - avg_base_pct, 1)
        else:
            avg_retail = avg_base = avg_addon = avg_full = 0.0
            avg_base_pct = avg_full_pct = lift_pct = 0.0
        c_band, c_label = classify_cost_band(avg_full_pct if priced else None)
        category_rollup.append({
            "category": cat,
            "item_count": len(items),
            "avg_retail_usd": avg_retail,
            "avg_base_cost_usd": avg_base,
            "avg_base_cost_pct": avg_base_pct,
            "avg_addon_usd": avg_addon,
            "avg_full_cost_usd": avg_full,
            "avg_full_cost_pct": avg_full_pct,
            "togo_lift_pct": lift_pct,
            "high_cost_count": sum(1 for x in priced if x["full_cost_pct"] > 36.0),
            "status_band": c_band,
            "status_label": c_label,
        })
    # Sort categories highest full food cost % first for cost-reduction focus
    category_rollup.sort(key=lambda r: r["avg_full_cost_pct"], reverse=True)

    # Recipes (34 recipes, 151 lines)
    recipes_out = []
    total_recipe_lines = 0
    for r_name, r_lines in recipes_by_name.items():
        r_cat = (r_lines[0].get("Recipe_Category") or "House Recipe").strip()
        batch_cost = round(sum(parse_float(x.get("Ingredient_Cost_USD")) for x in r_lines), 2)
        total_recipe_lines += len(r_lines)
        parsed_lines = []
        for rl in r_lines:
            parsed_lines.append({
                "ingredient": (rl.get("Ingredient") or "").strip(),
                "measurement": (rl.get("Recipe_Measurement") or "").strip(),
                "anchor": (rl.get("US_Foods_MOXE_Anchor") or "").strip(),
                "cost_usd": parse_float(rl.get("Ingredient_Cost_USD")),
                "share_pct": (rl.get("Share_of_Batch_Pct") or "").strip(),
            })
        recipes_out.append({
            "name": r_name,
            "category": r_cat,
            "batch_cost_usd": batch_cost,
            "ingredient_count": len(parsed_lines),
            "lines": parsed_lines,
        })

    priced_all = [x for x in menu_items_out if x["retail_usd"] > 0]
    avg_base_pct_all = round(sum(x["base_cost_pct"] for x in priced_all) / len(priced_all), 1) if priced_all else 0.0
    avg_full_pct_all = round(sum(x["full_cost_pct"] for x in priced_all) / len(priced_all), 1) if priced_all else 0.0
    avg_addon_all = round(sum(x["addon_total_usd"] for x in priced_all) / len(priced_all), 2) if priced_all else 0.0
    high_cnt = sum(1 for x in priced_all if x["full_cost_pct"] > 36.0)
    watch_cnt = sum(1 for x in priced_all if 32.0 <= x["full_cost_pct"] <= 36.0)

    now_ny = datetime.now(ZoneInfo("America/New_York"))
    return {
        "generated_at": now_ny.isoformat(),
        "summary": {
            "menu_item_count": len(menu_items_out),
            "recipe_count": len(recipes_out),
            "recipe_line_count": total_recipe_lines,
            "avg_base_food_cost_pct": avg_base_pct_all,
            "avg_full_togo_food_cost_pct": avg_full_pct_all,
            "avg_togo_lift_pct": round(avg_full_pct_all - avg_base_pct_all, 1),
            "avg_togo_addon_usd": avg_addon_all,
            "high_cost_item_count": high_cnt,
            "watch_cost_item_count": watch_cnt,
        },
        "category_rollup": category_rollup,
        "menu_items": menu_items_out,
        "recipes": recipes_out,
    }


def build_page1_category_rollup_html(data: dict | None = None) -> str:
    """Render the Page 1 Category-by-Category Base vs. Full To-Go Food Cost Rollup block for the Master PDF."""
    if data is None:
        data = compute_plate_cost_explorer_data()
    s = data["summary"]
    rows = []
    for c in data["category_rollup"]:
        cls = "alert" if c["status_band"] == "red" else ("ok" if c["status_band"] == "green" else "")
        rows.append(
            f"<tr>"
            f"<td><strong>{html.escape(c['category'])}</strong></td>"
            f"<td class='num'>{c['item_count']}</td>"
            f"<td class='num'>${c['avg_retail_usd']:.2f}</td>"
            f"<td class='num'>${c['avg_base_cost_usd']:.2f} ({c['avg_base_cost_pct']:.1f}%)</td>"
            f"<td class='num'>+${c['avg_addon_usd']:.2f} (+{c['togo_lift_pct']:.1f}%)</td>"
            f"<td class='num'><strong>${c['avg_full_cost_usd']:.2f} ({c['avg_full_cost_pct']:.1f}%)</strong></td>"
            f"<td class='num'>{c['high_cost_count']}</td>"
            f"<td class='{cls}'>{html.escape(c['status_label'])}</td>"
            f"</tr>"
        )
    return (
        "<div style='background:#f8fafc;border:1.5px solid #0072B2;border-radius:6px;padding:10px 12px;margin:10px 0 14px 0;'>"
        "<h2 style='margin-top:0;border-bottom-color:#0072B2;'>Executive Summary Highlight: Category-by-Category Base vs. Full To-Go Food Cost Rollup (137 Items)</h2>"
        f"<p class='sub' style='margin:0 0 8px 0;'>Menu-Wide Average: <strong>{s['avg_base_food_cost_pct']:.1f}% Base Portion</strong> &rarr; "
        f"<strong>{s['avg_full_togo_food_cost_pct']:.1f}% Full To-Go</strong> (+${s['avg_togo_addon_usd']:.2f} / +{s['avg_togo_lift_pct']:.1f}% avg packaging, garnish &amp; sauce lift) "
        f"| <strong>{s['high_cost_item_count']} items &gt; 36%</strong> (Primary Cost-Reduction Targets) | <strong>{s['watch_cost_item_count']} items 32–36%</strong></p>"
        "<table><thead><tr>"
        "<th>Menu Category</th><th class='num'>Items</th><th class='num'>Avg Retail</th>"
        "<th class='num'>Avg Base Cost (%)</th><th class='num'>Avg To-Go Add-On</th>"
        "<th class='num'>Avg Full To-Go (%)</th><th class='num'>Items &gt;36%</th><th>Target Status</th>"
        "</tr></thead><tbody>"
        + "".join(rows)
        + "</tbody></table></div>"
    )


def generate_full_reports() -> dict:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

    data = compute_plate_cost_explorer_data()
    menu_items = data["menu_items"]
    recipes = data["recipes"]

    # 1. Write public SPA explorer payload (mode 0644)
    for target_dir in (ANALYTICS_DIR, BASE_DIR / "analytics", BASE_DIR / "api" / "analytics"):
        target_dir.mkdir(parents=True, exist_ok=True)
        out_json = target_dir / "plate_cost_explorer.json"
        out_json.write_text(json.dumps(data, indent=2), encoding="utf-8")
        os.chmod(out_json, 0o644)

    # 2. Write flat line-by-line CSV (mode 0600)
    flat_csv_rows = []
    summary_rows_html = []
    detail_blocks_html = []

    for m in menu_items:
        pct_str = f"{m['full_cost_pct']:.1f}%" if m["full_cost_pct"] is not None else "N/A"
        summary_rows_html.append(
            f"<tr>"
            f"<td>{html.escape(m['category'])}</td>"
            f"<td>{html.escape(m['name'])}</td>"
            f"<td class='num'>${m['base_cost_usd']:.2f}</td>"
            f"<td class='num'>${m['veggies_bakery_addon_usd']:.2f}</td>"
            f"<td class='num'>${m['sauce_addon_usd']:.2f}</td>"
            f"<td class='num'>${m['packaging_addon_usd']:.2f}</td>"
            f"<td class='num'><strong>${m['full_cost_usd']:.2f}</strong></td>"
            f"<td class='num'>${m['retail_usd']:.2f}</td>"
            f"<td class='num'>{pct_str}</td>"
            f"</tr>"
        )
        line_trs = []
        for ln in m["lines"]:
            line_trs.append(
                f"<tr>"
                f"<td>{html.escape(ln['type'])}</td>"
                f"<td>{html.escape(ln['item'])}</td>"
                f"<td class='num'>{html.escape(ln['qty'])}</td>"
                f"<td class='num'>${ln['cost_usd']:.2f}</td>"
                f"<td>{html.escape(ln['note'])}</td>"
                f"</tr>"
            )
            flat_csv_rows.append({
                "Menu Item": m["name"],
                "Menu Category": m["category"],
                "Line Category": ln["type"],
                "Inventory / Ingredient Item": ln["item"],
                "Qty / Unit": ln["qty"],
                "Incremental Cost ($)": f"{ln['cost_usd']:.2f}",
                "Notes": ln["note"],
            })

        cost_badge = (
            f"Full To-Go Cost: ${m['full_cost_usd']:.2f} ({pct_str} of ${m['retail_usd']:.2f})"
            if m["retail_usd"] > 0
            else "Non-Food / System Item ($0.00)"
        )
        detail_blocks_html.append(
            f"<section class='plate-block'>"
            f"<div class='plate-hdr'>"
            f"<h3>{html.escape(m['name'])} <span class='cat-tag'>({html.escape(m['category'])})</span></h3>"
            f"<span class='pill total-pill'>{cost_badge}</span>"
            f"</div>"
            f"<table><thead><tr><th>Category</th><th>Inventory / Ingredient Item</th><th class='num'>Qty / Unit</th><th class='num'>Cost</th><th>Notes</th></tr></thead>"
            f"<tbody>{''.join(line_trs)}</tbody></table>"
            f"</section>"
        )

    recipe_blocks_html = []
    for r in recipes:
        r_trs = []
        for rl in r["lines"]:
            r_trs.append(
                f"<tr>"
                f"<td>{html.escape(rl['ingredient'])}</td>"
                f"<td class='num'>{html.escape(rl['measurement'])}</td>"
                f"<td>{html.escape(rl['anchor'])}</td>"
                f"<td class='num'>${rl['cost_usd']:.2f}</td>"
                f"<td class='num'>{html.escape(rl['share_pct'])}</td>"
                f"</tr>"
            )
        recipe_blocks_html.append(
            f"<section class='plate-block'>"
            f"<div class='plate-hdr'>"
            f"<h3>{html.escape(r['name'])} <span class='cat-tag'>({html.escape(r['category'])})</span></h3>"
            f"<span class='pill total-pill'>Total Batch Cost: ${r['batch_cost_usd']:.2f} ({r['ingredient_count']} ingredients)</span>"
            f"</div>"
            f"<table><thead><tr><th>Ingredient</th><th class='num'>Measurement</th><th>Supply Anchor</th><th class='num'>Line Cost</th><th class='num'>% of Batch</th></tr></thead>"
            f"<tbody>{''.join(r_trs)}</tbody></table>"
            f"</section>"
        )

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(flat_csv_rows[0].keys()))
        writer.writeheader()
        writer.writerows(flat_csv_rows)
    os.chmod(OUT_CSV, 0o600)

    s = data["summary"]
    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Yellow Rose BBQ — Complete Menu (137 Items) &amp; Recipe (34 Recipes) Line-by-Line BOM</title>
<style>
  @page {{ size: letter landscape; margin: 0.4in; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; font-size: 10px; line-height: 1.3; margin: 0; }}
  h1 {{ font-size: 17px; margin: 0 0 4px 0; }}
  h2 {{ font-size: 13.5px; margin: 14px 0 6px 0; border-bottom: 2px solid #0072B2; padding-bottom: 3px; page-break-after: avoid; }}
  h3 {{ font-size: 11.5px; margin: 0; }}
  .cat-tag {{ font-weight: 400; color: #475569; font-size: 10px; }}
  .meta {{ color: #475569; margin-bottom: 10px; }}
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 8px; }}
  th, td {{ border: 1px solid #cbd5e1; padding: 3px 5px; text-align: left; }}
  th {{ background: #f1f5f9; font-weight: 700; }}
  .num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .alert {{ color: #b91c1c; font-weight: 700; }}
  .ok {{ color: #15803d; font-weight: 600; }}
  .plate-block {{ break-inside: avoid; margin-bottom: 9px; border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px; }}
  .plate-hdr {{ display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px; }}
  .pill {{ display: inline-block; padding: 2px 7px; border-radius: 999px; font-weight: 700; font-size: 9.5px; }}
  .total-pill {{ background: #dcfce7; color: #166534; }}
  .page-break {{ page-break-before: always; }}
</style>
</head>
<body>
  <h1>Yellow Rose BBQ — Complete Line-by-Line Menu BOM, To-Go Packaging &amp; Recipe Breakdown</h1>
  <div class="meta">Generated 2026-11-21 • {s['menu_item_count']} Menu Items • {s['recipe_count']} House Recipes ({s['recipe_line_count']} ingredient lines) • Items already priced in Core Portion are shown at $0.00 add-on to prevent double-counting • Confidential (mode 0600)</div>

  {build_page1_category_rollup_html(data)}

  <h2>Appendix A: Complete Menu Full To-Go Cost Summary ({s['menu_item_count']} Items)</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th><th>Menu Item</th><th class="num">Core Portion</th>
        <th class="num">Add-On Veggies/Bakery</th><th class="num">Add-On Sauce</th>
        <th class="num">Add-On Packaging</th><th class="num">Full To-Go Cost</th>
        <th class="num">Retail</th><th class="num">Full %</th>
      </tr>
    </thead>
    <tbody>{''.join(summary_rows_html)}</tbody>
  </table>

  <div class="page-break"></div>
  <h2>Appendix B: Line-by-Line Inventory &amp; Packaging Breakdown for All {s['menu_item_count']} Menu Items</h2>
  {''.join(detail_blocks_html)}

  <div class="page-break"></div>
  <h2>Appendix C: Line-by-Line Ingredient Breakdown for All {s['recipe_count']} House Recipes ({s['recipe_line_count']} Lines)</h2>
  {''.join(recipe_blocks_html)}
</body>
</html>
"""
    OUT_HTML.write_text(html_doc, encoding="utf-8")
    os.chmod(OUT_HTML, 0o600)

    node_pdf = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://{OUT_HTML}', {{ waitUntil: 'networkidle' }});
  await page.pdf({{ path: '{OUT_PDF}', preferCSSPageSize: true, printBackground: true }});
  await browser.close();
}})();
"""
    subprocess.run(["node", "-e", node_pdf], cwd=str(BASE_DIR), check=True)
    os.chmod(OUT_PDF, 0o600)

    print(f"[OK] Generated plate_cost_explorer.json ({s['menu_item_count']} items, {s['recipe_count']} recipes, {len(data['category_rollup'])} categories)")
    print(f"[OK] Generated {OUT_CSV.name}, {OUT_HTML.name}, {OUT_PDF.name}")
    return data


if __name__ == "__main__":
    generate_full_reports()
