"""
Yellow Rose BBQ - Food Cost & Wholesale Invoice Engine
Parses US Foods order invoices and computes exact meat cost-per-pound and portion economics.
Uses range-based cooked yields (~38%-45% net yield, 55%-62% shrinkage & trim).
"""

import csv
import json
from pathlib import Path

from clover_api.analytics.unit_conversions import UNIT_CONVERSIONS

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
INVOICE_1 = (DATA_DIR / "Review order detail_91714857_09042026.csv") if (DATA_DIR / "Review order detail_91714857_09042026.csv").exists() else (BASE_DIR / "Review order detail_91714857_09042026.csv")
INVOICE_2 = (DATA_DIR / "Submitted_Order564310_Cust91714857_09032026.csv") if (DATA_DIR / "Submitted_Order564310_Cust91714857_09032026.csv").exists() else (BASE_DIR / "Submitted_Order564310_Cust91714857_09032026.csv")

# Realistic range bounds for smoked Texas BBQ (Trim scraps + Smoker render loss)
YIELD_RANGES = {
    "brisket": {"min_yield": 0.38, "max_yield": 0.45, "nominal_yield": 0.40},
    "pork_butt": {"min_yield": 0.40, "max_yield": 0.48, "nominal_yield": 0.44},
    "pork_ribs": {"min_yield": 0.55, "max_yield": 0.65, "nominal_yield": 0.60},
    "turkey": {"min_yield": 0.65, "max_yield": 0.75, "nominal_yield": 0.70},
    "sausage": {"min_yield": 0.80, "max_yield": 0.90, "nominal_yield": 0.85},
}

def parse_us_foods_invoices():
    """Extracts confirmed wholesale contract pricing from US Foods invoice files."""
    costs = {
        "raw_beef_brisket_per_lb": 5.08,
        "raw_pork_butt_per_lb": 1.82,
        "raw_pork_sparerib_per_lb": 2.40,
        "raw_turkey_breast_per_lb": 3.58,
        "raw_bacon_per_lb": 4.29,
        "cream_cheese_per_lb": 2.89,
        "cheddar_cheese_per_lb": 2.67,
    }
    
    # Ingest from Review Order Detail if available
    if INVOICE_1.exists():
        with open(INVOICE_1, mode='r', encoding='utf-8-sig', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                desc = (row.get('DESCRIPTION') or '').strip().lower()
                price_str = (row.get('PRICE') or '').replace('$', '').strip()
                try:
                    price = float(price_str)
                    if "beef, brisket" in desc and "raw" in desc:
                        costs["raw_beef_brisket_per_lb"] = price
                    elif "pork, boston butt" in desc:
                        costs["raw_pork_butt_per_lb"] = price
                    elif "pork, sparerib" in desc:
                        costs["raw_pork_sparerib_per_lb"] = price
                    elif "cheese, cream" in desc and price > 0:
                        # 10/3 LB CS = 30 lbs
                        costs["cream_cheese_per_lb"] = round(price / 30.0, 2)
                    elif "cheese, cheddar" in desc and price > 0:
                        # 4/5 LB CS = 20 lbs
                        costs["cheddar_cheese_per_lb"] = round(price / 20.0, 2)
                except ValueError:
                    pass

    # Ingest from Submitted Order if available
    if INVOICE_2.exists():
        with open(INVOICE_2, mode='r', encoding='utf-8-sig', errors='ignore') as f:
            reader = csv.DictReader(f)
            for row in reader:
                desc = (row.get('DESCRIPTION') or '').strip().lower()
                cs_str = (row.get('CS PRICE') or '').replace('$', '').strip()
                try:
                    price = float(cs_str)
                    if "turkey, roast breast" in desc:
                        costs["raw_turkey_breast_per_lb"] = price
                except ValueError:
                    pass
                    
    return costs

def compute_effective_meat_costs():
    """Calculates cooked yield cost ranges reflecting trim & smoke shrinkage."""
    raw = parse_us_foods_invoices()
    
    brisket_raw = raw["raw_beef_brisket_per_lb"]
    pork_raw = raw["raw_pork_butt_per_lb"]
    rib_raw = raw["raw_pork_sparerib_per_lb"]
    turkey_raw = raw["raw_turkey_breast_per_lb"]
    
    cooked_costs = {
        "wholesale_raw_costs": raw,
        "yield_estimates": {
            "brisket": {
                "nominal_cost_per_cooked_lb": round(brisket_raw / YIELD_RANGES["brisket"]["nominal_yield"], 2),
                "cost_range_per_cooked_lb": [
                    round(brisket_raw / YIELD_RANGES["brisket"]["max_yield"], 2),
                    round(brisket_raw / YIELD_RANGES["brisket"]["min_yield"], 2)
                ],
                "expected_yield_pct": "38% - 45% (est. 55% - 62% trim & smoke shrinkage)"
            },
            "pulled_pork": {
                "nominal_cost_per_cooked_lb": round(pork_raw / YIELD_RANGES["pork_butt"]["nominal_yield"], 2),
                "cost_range_per_cooked_lb": [
                    round(pork_raw / YIELD_RANGES["pork_butt"]["max_yield"], 2),
                    round(pork_raw / YIELD_RANGES["pork_butt"]["min_yield"], 2)
                ],
                "expected_yield_pct": "40% - 48% (est. 52% - 60% trim & smoke shrinkage)"
            },
            "pork_spare_ribs": {
                "nominal_cost_per_rack": round(rib_raw * RIB_RACK_RAW_LBS, 2), # invoice catch weight per slab
                "cost_per_lb_raw": rib_raw,
                "expected_yield_pct": f"Approx. 12 bones per {RIB_RACK_RAW_LBS:g} lb raw rack"
            },
            "turkey": {
                "nominal_cost_per_cooked_lb": round(turkey_raw / YIELD_RANGES["turkey"]["nominal_yield"], 2),
                "expected_yield_pct": "65% - 75% yield"
            }
        },
        "item_portions_cost": {
            "brisket_taco_2oz": round((brisket_raw / 0.40) * (2.0 / 16.0), 2),
            "brisket_sandwich_7oz": round((brisket_raw / 0.40) * (7.0 / 16.0), 2),
            "pork_sandwich_8oz": round((pork_raw / 0.44) * (8.0 / 16.0), 2),
            "turkey_sandwich_5oz": round((turkey_raw / 0.70) * (5.0 / 16.0), 2),
            "sausage_sandwich": 1.25,
            "mild_sausage_link": 1.25,
            "jalapeno_cheddar_link": 1.38,
            "mild_sausage_1lb": 5.00,
            "two_step_sandwich": 5.74,
            "quesadilla_brisket": 3.83,
            "smoked_wings_5pc": 2.25,
            "full_rack_ribs": round(rib_raw * RIB_RACK_RAW_LBS, 2),
            "half_rack_ribs": round((rib_raw * RIB_RACK_RAW_LBS) / 2.0, 2),
            "single_bone_rib": round((rib_raw * RIB_RACK_RAW_LBS) / 12.0, 2),
            "beef_dino_rib": 14.50,
            "bbq_plate_brisket": round((brisket_raw / 0.40) * 0.5, 2),
            "two_meat_plate": round((brisket_raw / 0.40) * 0.5 + ((rib_raw * RIB_RACK_RAW_LBS) / 12.0) * 2, 2),
            "pitmaster_platter": round((brisket_raw / 0.40) * 0.5 + (pork_raw / 0.44) * 0.5 + ((rib_raw * RIB_RACK_RAW_LBS) / 12.0) * 3 + 1.25, 2),
            "hill_country_trinity": round((brisket_raw / 0.40) * 0.5 + ((rib_raw * RIB_RACK_RAW_LBS) / 12.0) * 3 + 1.25, 2),
            "bevo_platter": round((brisket_raw / 0.40) * 1.0 + 2.50 + (rib_raw * RIB_RACK_RAW_LBS) * 0.5, 2),
            "rose_buds_portion": 1.85,
            "elote_street_corn": 0.85,
            "charro_beans": 0.65,
            "mac_and_cheese": 0.95,
            "southern_green_beans": 0.60,
            "skillet_cornbread": 0.40,
            "banana_pudding": 0.75,
            "banana_pudding_large": 1.65,
            "loaded_cheese_fries": 2.10,
            "jalapeno_cheddar_1lb": 5.52,
            "pork_belly_burnt_ends_1lb": 6.83,
            "brisket_burnt_ends_8oz": round((brisket_raw / 0.40) * 0.5 + 0.45, 2),
            "wings_catering_40ct": 17.30,
            "crispy_quesa_taco_barbacoa": 2.39,
            "crispy_quesa_taco_pork": round((pork_raw / 0.44) * (2.0 / 16.0) + 0.45, 2),
            "crispy_quesa_taco_turkey": round((turkey_raw / 0.70) * (2.0 / 16.0) + 0.45, 2),
            "street_taco_barbacoa": 1.84,
            "guisada_taco": 1.70,
            "taco_plate_2tacos": 4.95,
            "guisada_plate": 6.00,
            "kids_bbq_plate": 2.25,
            "kids_taco_plate": 1.65,
            "tex_mex_rice": 0.50,
            "seasoned_french_fries": 0.54,
            "caesar_salad_meat": 4.05,
            "caesar_salad_side": 1.10,
            "cowgirl_cucumber_salad": 0.65,
            "dipping_consomme_8oz": 0.55,
            "churros_2pk": 0.60,
            "half_pound_burger": 3.56,
            "texas_frito_pie": 2.90,
            "texas_red_bowl_chili": 2.70,
            "side_catering_tray_half_pan": 14.50
        }
    }
    return cooked_costs

SAUSAGE_LINKS_PER_LB = 3.0
SAUSAGE_COST_PER_LINK = 1.25      # wholesale yield sheet: ~$1.25 per 4 oz link
RIB_RACK_RAW_LBS = UNIT_CONVERSIONS["ribs"]["raw_lbs_per_unit"]  # invoice catch weight
DINO_RIB_COST_EACH = 14.50        # item_portions_cost.beef_dino_rib


def batch_meat_cost(brisket_raw_lbs=0.0, pork_raw_lbs=0.0, turkey_raw_lbs=0.0,
                    sausage_lbs=0.0, rib_racks=0.0, dino_ribs=0.0, raw_costs=None):
    """Total wholesale meat cost (USD) for a prep batch, from raw lbs x invoice price.

    Pure function of its inputs plus invoice prices; never derived from revenue.
    """
    raw = raw_costs or parse_us_foods_invoices()
    cost = (
        float(brisket_raw_lbs) * raw["raw_beef_brisket_per_lb"]
        + float(pork_raw_lbs) * raw["raw_pork_butt_per_lb"]
        + float(turkey_raw_lbs) * raw["raw_turkey_breast_per_lb"]
        + float(sausage_lbs) * SAUSAGE_LINKS_PER_LB * SAUSAGE_COST_PER_LINK
        + float(rib_racks) * RIB_RACK_RAW_LBS * raw["raw_pork_sparerib_per_lb"]
        + float(dino_ribs) * DINO_RIB_COST_EACH
    )
    return round(cost, 2)


def meat_cost_pct(batch_cost_usd, revenue_usd):
    """Estimated Meat Cost % = batch meat cost / revenue x 100. None when revenue is 0 (closed day)."""
    try:
        revenue = float(revenue_usd)
        cost = float(batch_cost_usd)
    except (TypeError, ValueError):
        return None
    if revenue <= 0:
        return None
    return round(cost / revenue * 100.0, 1)


def record_batch_cost(rec):
    """Batch meat cost for a dashboard/historical day record; uses the stored value when present."""
    if rec.get("estimated_cogs_usd") is not None:
        return float(rec["estimated_cogs_usd"])
    turkey_raw = rec.get("turkey_raw_lbs")
    if turkey_raw is None:
        turkey_raw = float(rec.get("turkey_cooked_lbs", rec.get("turkey_lbs", 0.0)) or 0.0) / 0.70
    return batch_meat_cost(
        brisket_raw_lbs=rec.get("brisket_raw_lbs", 0.0) or 0.0,
        pork_raw_lbs=rec.get("pork_shoulder_raw_lbs", 0.0) or 0.0,
        turkey_raw_lbs=turkey_raw or 0.0,
        sausage_lbs=rec.get("sausage_lbs", 0.0) or 0.0,
        rib_racks=rec.get("pork_ribs_racks", 0.0) or 0.0,
        dino_ribs=rec.get("beef_dino_ribs", 0.0) or 0.0,
    )


if __name__ == "__main__":
    costs = compute_effective_meat_costs()
    print("=== US Foods Wholesale & Smoked Yield Economics ===")
    print(json.dumps(costs, indent=2))
